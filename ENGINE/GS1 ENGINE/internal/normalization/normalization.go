// Package normalization canonicalizes field values (timestamps, identifiers,
// quantities extracted from canonical descriptions) into a stable form before
// classification and EPCIS mapping.
package normalization

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"

	"gs1-engine/internal/canonical/model"
	"gs1-engine/internal/errors"
)

var qtyRe = regexp.MustCompile(`(?:qty[^0-9]*|of |quantity )([0-9]+(?:\.[0-9]+)?)\s*([A-Za-z%]+)`)

// Quantity is a canonical quantity/UOM pair. Zero value means "not available".
type Quantity struct {
	Value float64
	UOM   string
	Set   bool
}

// NormalizedEvent is a canonical event plus derived, normalized context.
type NormalizedEvent struct {
	model.CanonicalEvent

	// SourceFile identifies which canonical input the event came from.
	SourceFile model.SourceFile

	// Quantity parsed from the canonical description, when present.
	Quantity Quantity
}

// Normalize validates and canonicalizes the loaded canonical events.
func Load(events []model.CanonicalEvent, src model.SourceFile) ([]*NormalizedEvent, []error) {
	out := make([]*NormalizedEvent, 0, len(events))
	var errs []error
	for i := range events {
		ne, err := normalizeEvent(events[i], src)
		if err != nil {
			errs = append(errs, fmt.Errorf("event %s: %w", events[i].EventID, err))
			continue
		}
		out = append(out, ne)
	}
	return out, errs
}

func normalizeEvent(ev model.CanonicalEvent, src model.SourceFile) (*NormalizedEvent, error) {
	if ev.EventID == "" {
		return nil, fmt.Errorf("%w: event_id missing", errors.ErrCanonicalInputInvalid)
	}
	if ev.EventName == "" {
		return nil, fmt.Errorf("%w: event_name missing on %s", errors.ErrCanonicalInputInvalid, ev.EventID)
	}

	ne := &NormalizedEvent{CanonicalEvent: ev, SourceFile: src}

	// Identifier normalization: trim surrounding whitespace.
	ne.BatchID = trimPtr(ne.BatchID)
	ne.ProcessOrderID = trimPtr(ne.ProcessOrderID)
	ne.MaterialID = trimPtr(ne.MaterialID)
	ne.PlantID = trimPtr(ne.PlantID)

	// Quantity normalization: quantities are embedded in canonical
	// descriptions ("qty 104.03 KG", "yield of 104.03 KG"). Extract when
	// present; the value is enrichment only, never a fabricated fact.
	if ne.Description != nil {
		if m := qtyRe.FindStringSubmatch(*ne.Description); m != nil {
			if v, err := strconv.ParseFloat(m[1], 64); err == nil {
				ne.Quantity = Quantity{Value: v, UOM: m[2], Set: true}
			}
		}
	}
	return ne, nil
}

func trimPtr(s *string) *string {
	if s == nil {
		return nil
	}
	t := strings.TrimSpace(*s)
	if t == "" {
		return nil
	}
	return &t
}
