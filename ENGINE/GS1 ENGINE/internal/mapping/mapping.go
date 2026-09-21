// Package mapping converts classified canonical visibility events into EPCIS
// events. Each domain mapper is explicit about semantics; deduplication is
// identity-based so a physical occurrence yields exactly one EPCIS event.
package mapping

import (
	"fmt"
	"sort"
	"strings"

	"gs1-engine/internal/classifier"
	"gs1-engine/internal/epcis/event"
	"gs1-engine/internal/errors"
	"gs1-engine/internal/gs1/identifier"
	cbv "gs1-engine/internal/gs1/vocabulary/cbv"
	"gs1-engine/internal/normalization"
	"gs1-engine/internal/relationship"
)

// DefaultTimeZoneOffset is used because canonical timestamps carry no zone.
// The engine documents this assumption explicitly.
const DefaultTimeZoneOffset = "+00:00"

// Result captures what the mapping stage produced for the summary.
type Result struct {
	Events        []event.EPCISEvent
	Duplicates    []string
	Unsupported   []string
	MappingErrors []error
}

// Deduplicator tracks deterministic physical-event identity.
type Deduplicator struct {
	seen map[string]string
}

// NewDeduplicator builds an empty deduplicator.
func NewDeduplicator() *Deduplicator {
	return &Deduplicator{seen: map[string]string{}}
}

// Identity builds the deterministic physical-occurrence identity of a
// normalized event. Records that describe the same physical occurrence share
// an identity regardless of the canonical event name that reported them
// (e.g. GRNPosted and BatchReceived for the same material document).
func Identity(ev *normalization.NormalizedEvent) string {
	parts := []string{physicalKind(ev)}
	parts = append(parts, deref(ev.BatchID), deref(ev.MaterialID), deref(ev.PlantID))
	return strings.Join(parts, "|")
}

// physicalKind collapses canonical event names that describe the same
// physical occurrence into one identity class.
func physicalKind(ev *normalization.NormalizedEvent) string {
	switch ev.EventName {
	case "GRNPosted", "BatchReceived", "GoodsReceiptPosted":
		// Same goods receipt occurrence; identity includes the entity key
		// (material document) + movement type via entity context below.
		return "GOODS_RECEIPT:" + ev.EntityKey + ":" + deref(ev.MovementType)
	case "GoodsIssuePosted", "DeliveryShipped":
		return "GOODS_ISSUE:" + ev.EntityKey + ":" + deref(ev.MovementType)
	default:
		return ev.EventName + ":" + ev.EntityKey
	}
}

// Add returns true when the identity is new; false when it is a duplicate.
func (d *Deduplicator) Add(identity string) bool {
	if _, ok := d.seen[identity]; ok {
		return false
	}
	d.seen[identity] = identity
	return true
}

// deref is a nil-safe string dereference.
func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

// Mapper carries the shared resolution dependencies of the domain mappers.
type Mapper struct {
	Resolver *relationship.Resolver
	IDs      *identifier.Resolver
}

// Map converts all classified visibility events into EPCIS events. Business
// context and master data never become EPCIS events. Duplicate physical
// occurrences are collapsed and reported. skip maps event ids to exclude
// (physical occurrences already represented by a dedicated construction,
// e.g. yields absorbed into a canonical transformation).
func (m *Mapper) Map(classified []Classified, skip map[string]bool) (*Result, error) {
	res := &Result{}
	dedup := NewDeduplicator()

	for _, c := range classified {
		if c.Category != classifier.VISIBILITY_EVENT {
			continue
		}
		if skip != nil && skip[c.Event.EventID] {
			continue
		}
		id := Identity(c.Event)
		if !dedup.Add(id) {
			res.Duplicates = append(res.Duplicates, fmt.Sprintf("%s (%s)", c.Event.EventID, id))
			continue
		}

		var (
			ev  *event.EPCISEvent
			dom string
			err error
		)
		switch {
		case c.Event.EventName == "MaterialConsumptionPosted":
			ev, dom, err = m.mapConsumption(c.Event)
		case c.Event.EventName == "YieldRecorded" || c.Event.EventName == "ProductionConfirmationRecorded" || c.Event.EventName == "OperationCompleted":
			ev, dom, err = m.mapYield(c.Event)
		case c.Event.EventName == "GRNPosted" || c.Event.EventName == "BatchReceived" || c.Event.EventName == "GoodsReceiptPosted":
			ev, dom, err = m.mapGoodsReceipt(c.Event)
		case c.Event.EventName == "GoodsIssuePosted" || c.Event.EventName == "DeliveryShipped":
			ev, dom, err = m.mapGoodsIssue(c.Event)
		case c.Event.EventName == "ReturnCreated":
			ev, dom, err = m.mapReturn(c.Event)
		case isQualityEvent(c.Event.EventName):
			ev, dom, err = m.mapQuality(c.Event)
		default:
			err = errors.New(errors.CodeUnsupportedEvent, c.Event.EventID,
				"canonical event %q has no EPCIS mapping", c.Event.EventName)
		}

		if err != nil {
			res.MappingErrors = append(res.MappingErrors, err)
			continue
		}
		ev.Domain = dom
		ev.SourceRef = c.Event.EventID
		res.Events = append(res.Events, *ev)
	}

	sort.SliceStable(res.Events, func(i, j int) bool { return res.Events[i].SourceRef < res.Events[j].SourceRef })
	return res, nil
}

func isQualityEvent(name string) bool {
	switch name {
	case "InspectionLotCreated", "InspectionStarted", "SampleCreated",
		"InspectionResultRecorded", "QualityDecisionRecorded":
		return true
	}
	return false
}

// resolveLocation resolves the EPCIS bizLocation for an event. The canonical
// plant id is NOT a GLN; when no explicit GLN mapping exists the canonical
// plant is used as an internal location id (documented behavior) — the
// GS1-not-fabricated rule applies to GS1 keys, not internal references.
func (m *Mapper) resolveLocation(plantID, eventID string) (*event.BizLocation, error) {
	if plantID == "" {
		return nil, errors.New(errors.CodeEPCISMappingFailed, eventID, "plant missing; WHERE dimension unresolvable")
	}
	if m.IDs != nil {
		if gln, err := m.IDs.GLN(plantID, eventID); err == nil {
			return &event.BizLocation{ID: "urn:epcglobal:cbv:sbdh:" + gln}, nil
		}
	}
	// No explicit mapping: use canonical location reference, clearly
	// namespaced so it is never mistaken for a GLN.
	return &event.BizLocation{ID: "urn:internal:plant:" + plantID}, nil
}

// epcFor builds the EPC for a material+batch when explicit mappings allow it;
// otherwise it falls back to the canonical instance reference namespaced as
// internal (never presented as a GS1 EPC).
func (m *Mapper) epcFor(materialID, batchID, eventID string) (string, error) {
	if materialID == "" || batchID == "" {
		return "", errors.New(errors.CodeGS1IdentifierNotResolved, eventID,
			"material/batch missing; cannot build EPC")
	}
	if m.IDs != nil {
		if epc, err := m.IDs.EPC(materialID, batchID, eventID); err == nil {
			return epc, nil
		}
	}
	// Deterministic internal instance reference (not a fabricated GS1 key).
	return fmt.Sprintf("urn:internal:batch:%s:%s", materialID, batchID), nil
}

func epcClassFor(m *Mapper, materialID, eventID string) string {
	if m.IDs != nil {
		if gtin, err := m.IDs.GTIN(materialID, eventID); err == nil {
			return "urn:epc:class:lgtin:" + gtin
		}
	}
	return "urn:internal:material:" + materialID
}

// plantFor resolves the plant of an event via canonical context.
func (m *Mapper) plantFor(ev *normalization.NormalizedEvent, t *relationship.Transformation) string {
	if p := deref(ev.PlantID); p != "" {
		return p
	}
	if t != nil && t.PlantID != "" {
		return t.PlantID
	}
	if b := deref(ev.BatchID); b != "" {
		if p, ok := m.Resolver.PlantForBatch(b); ok {
			return p
		}
	}
	return ""
}

// mapConsumption builds the transformation-input context ObjectEvent for
// movement 261 consumption. When the canonical model already represents the
// physical transformation, this stays a dedicated input event (261 postings
// are distinct material documents; the transformation itself is emitted once
// from BatchTransformationCompleted).
func (m *Mapper) mapConsumption(ev *normalization.NormalizedEvent) (*event.EPCISEvent, string, error) {
	out := &event.EPCISEvent{
		Type:                "ObjectEvent",
		EventID:             "urn:uuid:gs1-engine:" + strings.ToLower(ev.EventID),
		EventTime:           ev.Timestamp.Format("2006-01-02T15:04:05Z"),
		EventTimeZoneOffset: DefaultTimeZoneOffset,
		Action:              "OBSERVE",
	}
	epc, err := m.epcFor(deref(ev.MaterialID), deref(ev.BatchID), ev.EventID)
	if err != nil {
		return nil, "", err
	}
	out.EPCList = []string{epc}

	step, err := cbv.BusinessStep(ev.EventName, ev.EventID)
	if err != nil {
		return nil, "", err
	}
	out.BizStep = step

	loc, err := m.resolveLocation(m.plantFor(ev, nil), ev.EventID)
	if err != nil {
		return nil, "", err
	}
	out.BizLocation = loc
	return out, DomainProduction, nil
}

// mapYield enriches/derives the production output event for YieldRecorded /
// ProductionConfirmationRecorded. Yield confirms the transformation output;
// it does not create a second physical transformation.
func (m *Mapper) mapYield(ev *normalization.NormalizedEvent) (*event.EPCISEvent, string, error) {
	out := &event.EPCISEvent{
		Type:                "ObjectEvent",
		EventID:             "urn:uuid:gs1-engine:" + strings.ToLower(ev.EventID),
		EventTime:           ev.Timestamp.Format("2006-01-02T15:04:05Z"),
		EventTimeZoneOffset: DefaultTimeZoneOffset,
		Action:              "ADD",
	}
	materialID := deref(ev.MaterialID)
	batchID := deref(ev.BatchID)
	if batchID == "" && ev.ProcessOrderID != nil {
		if m.Resolver != nil {
			for _, t := range m.Resolver.Transformations() {
				if t.ProcessOrderID == *ev.ProcessOrderID && t.OutputBatch.BatchID != "" {
					batchID = t.OutputBatch.BatchID
					if materialID == "" {
						materialID = t.OutputBatch.MaterialID
					}
					break
				}
			}
		}
	}
	epc, err := m.epcFor(materialID, batchID, ev.EventID)
	if err != nil {
		return nil, "", err
	}
	out.EPCList = []string{epc}

	step, err := cbv.BusinessStep(ev.EventName, ev.EventID)
	if err != nil {
		return nil, "", err
	}
	out.BizStep = step

	loc, err := m.resolveLocation(m.plantFor(ev, nil), ev.EventID)
	if err != nil {
		return nil, "", err
	}
	out.BizLocation = loc
	return out, DomainProduction, nil
}

// mapGoodsReceipt builds the procurement receiving ObjectEvent. Deduplication
// upstream already collapsed GRNPosted/BatchReceived describing the same
// material document.
func (m *Mapper) mapGoodsReceipt(ev *normalization.NormalizedEvent) (*event.EPCISEvent, string, error) {
	out := &event.EPCISEvent{
		Type:                "ObjectEvent",
		EventID:             "urn:uuid:gs1-engine:" + strings.ToLower(ev.EventID),
		EventTime:           ev.Timestamp.Format("2006-01-02T15:04:05Z"),
		EventTimeZoneOffset: DefaultTimeZoneOffset,
		Action:              "ADD",
	}
	epc, err := m.epcFor(deref(ev.MaterialID), deref(ev.BatchID), ev.EventID)
	if err != nil {
		return nil, "", err
	}
	out.EPCList = []string{epc}

	step, err := cbv.BusinessStep(ev.EventName, ev.EventID)
	if err != nil {
		return nil, "", err
	}
	out.BizStep = step

	loc, err := m.resolveLocation(m.plantFor(ev, nil), ev.EventID)
	if err != nil {
		return nil, "", err
	}
	out.BizLocation = loc
	return out, DomainProcurement, nil
}

// mapGoodsIssue builds the sales shipping ObjectEvent.
func (m *Mapper) mapGoodsIssue(ev *normalization.NormalizedEvent) (*event.EPCISEvent, string, error) {
	out := &event.EPCISEvent{
		Type:                "ObjectEvent",
		EventID:             "urn:uuid:gs1-engine:" + strings.ToLower(ev.EventID),
		EventTime:           ev.Timestamp.Format("2006-01-02T15:04:05Z"),
		EventTimeZoneOffset: DefaultTimeZoneOffset,
		Action:              "OBSERVE",
	}
	epc, err := m.epcFor(deref(ev.MaterialID), deref(ev.BatchID), ev.EventID)
	if err != nil {
		return nil, "", err
	}
	out.EPCList = []string{epc}

	step, err := cbv.BusinessStep(ev.EventName, ev.EventID)
	if err != nil {
		return nil, "", err
	}
	out.BizStep = step

	loc, err := m.resolveLocation(m.plantFor(ev, nil), ev.EventID)
	if err != nil {
		return nil, "", err
	}
	out.BizLocation = loc
	return out, DomainSales, nil
}

// mapQuality builds quality ObjectEvents only for records with visibility
// semantics, resolving plant through the canonical quality->batch relationship.
func (m *Mapper) mapQuality(ev *normalization.NormalizedEvent) (*event.EPCISEvent, string, error) {
	batchID := deref(ev.BatchID)
	plantID := deref(ev.PlantID)
	if plantID == "" {
		p, err := m.Resolver.QualityPlant(batchID)
		if err != nil {
			return nil, "", errors.New(errors.CodeEPCISMappingFailed, ev.EventID,
				"quality event without plant and canonical context cannot supply one: %v", err)
		}
		plantID = p
	}

	out := &event.EPCISEvent{
		Type:                "ObjectEvent",
		EventID:             "urn:uuid:gs1-engine:" + strings.ToLower(ev.EventID),
		EventTime:           ev.Timestamp.Format("2006-01-02T15:04:05Z"),
		EventTimeZoneOffset: DefaultTimeZoneOffset,
		Action:              "OBSERVE",
	}
	materialID := deref(ev.MaterialID)
	if materialID == "" {
		if mat, ok := m.Resolver.MaterialForBatch(batchID); ok {
			materialID = mat
		}
	}
	epc, err := m.epcFor(materialID, batchID, ev.EventID)
	if err != nil {
		return nil, "", err
	}
	out.EPCList = []string{epc}

	step, err := cbv.BusinessStep(ev.EventName, ev.EventID)
	if err != nil {
		return nil, "", err
	}
	out.BizStep = step

	// WHY: disposition from the canonical decision/status when mappable.
	if disp, err := cbv.Disposition(ev.Status, ev.EventID); err == nil {
		out.Disposition = disp
	}

	loc, err := m.resolveLocation(plantID, ev.EventID)
	if err != nil {
		return nil, "", err
	}
	out.BizLocation = loc
	return out, DomainQuality, nil
}

// mapReturn builds the returns receiving ObjectEvent. Returns without any
// physical semantics (e.g. zero quantity, status NO_RETURN) are skipped via
// classification (ReturnCreated with zero qty still denotes a return document;
// the canonical model provides no physical return movement, so the mapper
// emits the document-level receiving visibility event it can support).
func (m *Mapper) mapReturn(ev *normalization.NormalizedEvent) (*event.EPCISEvent, string, error) {
	out := &event.EPCISEvent{
		Type:                "ObjectEvent",
		EventID:             "urn:uuid:gs1-engine:" + strings.ToLower(ev.EventID),
		EventTime:           ev.Timestamp.Format("2006-01-02T15:04:05Z"),
		EventTimeZoneOffset: DefaultTimeZoneOffset,
		Action:              "ADD",
	}
	materialID := deref(ev.MaterialID)
	batchID := deref(ev.BatchID)
	if materialID == "" || batchID == "" {
		return nil, "", errors.New(errors.CodeEPCISMappingFailed, ev.EventID,
			"return event missing material/batch")
	}
	epc, err := m.epcFor(materialID, batchID, ev.EventID)
	if err != nil {
		return nil, "", err
	}
	out.EPCList = []string{epc}

	step, err := cbv.BusinessStep(ev.EventName, ev.EventID)
	if err != nil {
		return nil, "", err
	}
	out.BizStep = step

	// Plant: canonical events for returns carry no plant; use the canonical
	// batch context only.
	loc, err := m.resolveLocation(m.plantFor(ev, nil), ev.EventID)
	if err != nil {
		return nil, "", err
	}
	out.BizLocation = loc
	return out, DomainReturns, nil
}

// evQuantity extracts the quantity parsed from the canonical description.
func evQuantity(ev *normalization.NormalizedEvent) *float64 {
	if ev.Quantity.Set {
		v := ev.Quantity.Value
		return &v
	}
	return nil
}

// Domain names used by the partitioner.
const (
	DomainProduction  = "production"
	DomainProcurement = "procurement"
	DomainSales       = "sales"
	DomainQuality     = "quality"
	DomainReturns     = "returns"
	DomainPlanning    = "planning"
)

// Classified pairs a normalized event with its classification.
type Classified struct {
	Event    *normalization.NormalizedEvent
	Category classifier.Category
}

// ClassifyAll classifies a normalized event list.
func ClassifyAll(events []*normalization.NormalizedEvent) []Classified {
	out := make([]Classified, 0, len(events))
	for _, ev := range events {
		out = append(out, Classified{Event: ev, Category: classifier.Classify(ev)})
	}
	return out
}

// Partition groups events by domain deterministically.
func Partition(events []event.EPCISEvent) map[string][]event.EPCISEvent {
	out := map[string][]event.EPCISEvent{}
	for _, ev := range events {
		out[ev.Domain] = append(out[ev.Domain], ev)
	}
	for dom := range out {
		sort.SliceStable(out[dom], func(i, j int) bool {
			return out[dom][i].SourceRef < out[dom][j].SourceRef
		})
	}
	return out
}
