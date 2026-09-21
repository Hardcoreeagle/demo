// Package document assembles EPCIS documents per domain and writes them as
// deterministic JSON. There is intentionally no logistics domain:
// transportation (VTTK/VTTP) is outside GS1 Engine scope.
package document

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"time"

	"gs1-engine/internal/epcis/event"
	"gs1-engine/internal/errors"
)

// Build builds one EPCIS document from the given events. Events are ordered
// deterministically (eventTime, type, eventID) before embedding.
func Build(events []event.EPCISEvent, creationDate string) (*event.Document, error) {

	sorted := make([]event.EPCISEvent, len(events))
	copy(sorted, events)
	sort.SliceStable(sorted, func(i, j int) bool {
		a, b := sorted[i], sorted[j]
		if a.EventTime != b.EventTime {
			return a.EventTime < b.EventTime
		}
		if a.Type != b.Type {
			return a.Type < b.Type
		}
		return a.EventID < b.EventID
	})

	doc := event.NewDocument(creationDate)
	doc.EPCISBody.EventList = sorted
	return doc, nil
}

// Validate enforces EPCIS 2.0.1 semantics that matter for downstream consumers.
func Validate(doc *event.Document) []error {
	var errs []error
	if doc.Type != "EPCISDocument" {
		errs = append(errs, errors.New(errors.CodeEPCISValidationFailed, "", "document type must be EPCISDocument"))
	}
	if doc.SchemaVersion != "2.0" {
		errs = append(errs, errors.New(errors.CodeEPCISValidationFailed, "", "schemaVersion must be 2.0"))
	}
	if len(doc.Context) == 0 {
		errs = append(errs, errors.New(errors.CodeEPCISValidationFailed, "", "@context missing"))
	}
	if _, err := time.Parse(time.RFC3339, doc.CreationDate); err != nil {
		errs = append(errs, errors.New(errors.CodeEPCISValidationFailed, "", "creationDate not RFC3339"))
	}

	for i := range doc.EPCISBody.EventList {
		errs = append(errs, validateEvent(&doc.EPCISBody.EventList[i])...)
	}
	return errs
}

func validateEvent(ev *event.EPCISEvent) []error {
	var errs []error
	ref := ev.EventID
	if ev.EventTime == "" {
		errs = append(errs, errors.New(errors.CodeEPCISValidationFailed, ref, "eventTime required"))
	} else if _, err := time.Parse(time.RFC3339, ev.EventTime); err != nil {
		errs = append(errs, errors.New(errors.CodeEPCISValidationFailed, ref, "eventTime not RFC3339"))
	}
	if !validTZ(ev.EventTimeZoneOffset) {
		errs = append(errs, errors.New(errors.CodeEPCISValidationFailed, ref, "eventTimeZoneOffset must be +/-hh:mm"))
	}

	switch ev.Type {
	case "ObjectEvent":
		if len(ev.EPCList) == 0 && len(ev.QuantityElementList) == 0 {
			errs = append(errs, errors.New(errors.CodeEPCISValidationFailed, ref, "ObjectEvent requires epcList or quantityList"))
		}
		if ev.Action != "ADD" && ev.Action != "OBSERVE" && ev.Action != "DELETE" {
			errs = append(errs, errors.New(errors.CodeEPCISValidationFailed, ref, "ObjectEvent action invalid"))
		}
	case "TransformationEvent":
		if len(ev.InputEPCList) == 0 && len(ev.InputQuantityList) == 0 {
			errs = append(errs, errors.New(errors.CodeEPCISValidationFailed, ref, "TransformationEvent requires input list"))
		}
		if len(ev.OutputEPCList) == 0 && len(ev.OutputQuantityList) == 0 {
			errs = append(errs, errors.New(errors.CodeEPCISValidationFailed, ref, "TransformationEvent requires output list"))
		}
	case "AggregationEvent":
		if ev.ParentID == "" || (len(ev.ChildEPCs) == 0 && len(ev.ChildQuantityList) == 0) {
			errs = append(errs, errors.New(errors.CodeEPCISValidationFailed, ref, "AggregationEvent requires parentID and children"))
		}
		if ev.Action != "ADD" && ev.Action != "OBSERVE" && ev.Action != "DELETE" {
			errs = append(errs, errors.New(errors.CodeEPCISValidationFailed, ref, "AggregationEvent action invalid"))
		}
	case "TransactionEvent":
		if len(ev.BizTransactionList) == 0 {
			errs = append(errs, errors.New(errors.CodeEPCISValidationFailed, ref, "TransactionEvent requires bizTransactionList"))
		}
		if len(ev.EPCList) == 0 && len(ev.QuantityElementList) == 0 {
			errs = append(errs, errors.New(errors.CodeEPCISValidationFailed, ref, "TransactionEvent requires epcList/quantityList"))
		}
		if ev.Action != "ADD" && ev.Action != "OBSERVE" && ev.Action != "DELETE" {
			errs = append(errs, errors.New(errors.CodeEPCISValidationFailed, ref, "TransactionEvent action invalid"))
		}
	case "AssociationEvent":
		if ev.ParentID == "" || len(ev.ChildEPCs) == 0 {
			errs = append(errs, errors.New(errors.CodeEPCISValidationFailed, ref, "AssociationEvent requires parentID and childEPCs"))
		}
		if ev.Action != "ADD" && ev.Action != "OBSERVE" && ev.Action != "DELETE" {
			errs = append(errs, errors.New(errors.CodeEPCISValidationFailed, ref, "AssociationEvent action invalid"))
		}
	default:
		errs = append(errs, errors.New(errors.CodeEPCISValidationFailed, ref, "unsupported event type %q", ev.Type))
	}
	return errs
}

func validTZ(tz string) bool {
	if len(tz) != 6 {
		return false
	}
	if tz[0] != '+' && tz[0] != '-' {
		return false
	}
	if tz[3] != ':' {
		return false
	}
	for _, i := range []int{1, 2, 4, 5} {
		if tz[i] < '0' || tz[i] > '9' {
			return false
		}
	}
	return true
}

// WriteJSON writes the document deterministically (2-space indent, struct
// order fixed by field declaration, no map iteration).
func WriteJSON(doc *event.Document, path string) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return fmt.Errorf("create output dir: %w", err)
	}
	data, err := json.MarshalIndent(doc, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal: %w", err)
	}
	data = append(data, '\n')
	if err := os.WriteFile(path, data, 0o644); err != nil {
		return fmt.Errorf("write %s: %w", path, err)
	}
	return nil
}
