// Production-domain construction: EPCIS TransformationEvents derived from the
// canonical batch transformation context (the authoritative physical
// representation), with yield/confirmation absorption per spec §14/§15/§17.
package mapping

import (
	"sort"

	"gs1-engine/internal/canonical/model"
	"gs1-engine/internal/epcis/event"
	"gs1-engine/internal/errors"
	"gs1-engine/internal/gs1/vocabulary/cbv"
	"gs1-engine/internal/normalization"
	"gs1-engine/internal/relationship"
)

// ProductionResult reports production-domain construction.
type ProductionResult struct {
	Events         []event.EPCISEvent
	AbsorbedYields []string // event ids of yields absorbed into transformations
	MappingErrors  []error
}

// BuildProductionEvents constructs TransformationEvents from the canonical
// genealogy transformations. Each physical transformation is emitted exactly
// once (deduplicated by output batch + process order). YieldRecorded events
// for the same output batch/process order are absorbed as context and do not
// produce duplicate physical output events.
func BuildProductionEvents(
	transformations []relationship.Transformation,
	yields []*normalization.NormalizedEvent,
	m *Mapper,
) *ProductionResult {
	res := &ProductionResult{}

	// Deterministic order (already sorted by resolver, but enforce again).
	ts := make([]relationship.Transformation, len(transformations))
	copy(ts, transformations)
	sort.SliceStable(ts, func(i, j int) bool {
		if ts[i].ProcessOrderID != ts[j].ProcessOrderID {
			return ts[i].ProcessOrderID < ts[j].ProcessOrderID
		}
		return ts[i].TransformationID < ts[j].TransformationID
	})

	emittedOutputs := map[string]bool{}
	for i := range ts {
		t := ts[i]

		// Dedup: one physical transformation per output batch + process order.
		key := t.OutputBatch.BatchID + "|" + t.ProcessOrderID
		if emittedOutputs[key] {
			continue
		}

		ev, err := buildTransformationEvent(t, m)
		if err != nil {
			res.MappingErrors = append(res.MappingErrors, err)
			continue
		}
		emittedOutputs[key] = true
		ev.Domain = DomainProduction
		ev.SourceRef = "production:" + t.TransformationID
		res.Events = append(res.Events, *ev)
	}

	// Absorb yields whose physical occurrence is already represented by an
	// emitted transformation (same output batch + process order). Remaining
	// yields keep their own ObjectEvent mapping (generic mapper).
	for _, y := range yields {
		batchID := ""
		if y.BatchID != nil {
			batchID = *y.BatchID
		} else if y.ProcessOrderID != nil {
			for _, t := range ts {
				if t.ProcessOrderID == *y.ProcessOrderID && t.OutputBatch.BatchID != "" {
					batchID = t.OutputBatch.BatchID
					break
				}
			}
		}
		if batchID == "" {
			continue
		}
		if emittedOutputs[batchID+"|"+deref(y.ProcessOrderID)] {
			res.AbsorbedYields = append(res.AbsorbedYields, y.EventID)
		}
	}
	return res
}

// buildTransformationEvent builds one EPCIS TransformationEvent from a
// resolved canonical transformation.
func buildTransformationEvent(t relationship.Transformation, m *Mapper) (*event.EPCISEvent, error) {
	out := &event.EPCISEvent{
		Type:                "TransformationEvent",
		EventID:             "urn:uuid:gs1-engine:transformation:" + t.TransformationID,
		EventTimeZoneOffset: DefaultTimeZoneOffset,
		TransformationID:    t.TransformationID,
	}

	// WHEN: transformation completion, as evidenced by the canonical context
	// (process order dates, confirmation or posting dates). Never invented.
	if t.CompletionDate == "" {
		return nil, errors.New(errors.CodeRelationshipNotFound, t.TransformationID,
			"canonical context carries no completion date evidence for the transformation")
	}
	out.EventTime = t.CompletionDate + "T00:00:00Z"

	// WHAT: inputs from the canonical consumed_batches / input_batches.
	for _, in := range t.InputBatches {
		epc, err := m.epcFor(in.MaterialID, in.BatchID, t.TransformationID)
		if err != nil {
			return nil, err
		}
		out.InputQuantityList = append(out.InputQuantityList, event.QuantityElement{
			EPCClass: epc, Quantity: in.ConsumedQuantity, UOM: in.UOM,
		})
	}

	// WHAT: output batch + quantity/UOM when the canonical context provides it.
	outEPC, err := m.epcFor(t.OutputBatch.MaterialID, t.OutputBatch.BatchID, t.TransformationID)
	if err != nil {
		return nil, err
	}
	out.OutputQuantityList = append(out.OutputQuantityList, event.QuantityElement{
		EPCClass: outEPC, Quantity: t.OutputBatch.ProducedQuantity, UOM: t.OutputBatch.UOM,
	})

	// WHY: CBV bizStep for the physical transformation.
	step, err := cbv.BusinessStep("BatchTransformationCompleted", t.TransformationID)
	if err != nil {
		return nil, err
	}
	out.BizStep = step

	// WHERE: plant via canonical context only.
	if t.PlantID == "" {
		if p, ok := m.Resolver.PlantForBatch(t.OutputBatch.BatchID); ok {
			t.PlantID = p
		}
	}
	if t.PlantID == "" {
		return nil, errors.New(errors.CodeEPCISMappingFailed, t.TransformationID,
			"transformation plant unresolvable from canonical context")
	}
	loc, err := m.resolveLocation(t.PlantID, t.TransformationID)
	if err != nil {
		return nil, err
	}
	out.BizLocation = loc
	return out, nil
}

// transformationTime is retained for tests and future enrichment: it resolves
// the completion time of a transformation from a canonical process order.
func transformationTime(po *model.ProcessOrderFull) (string, bool) {
	if po == nil {
		return "", false
	}
	for _, d := range []string{po.ActualFinishDate, po.BasicFinishDate, po.ActualStartDate, po.BasicStartDate} {
		if d != "" {
			return d + "T00:00:00Z", true
		}
	}
	return "", false
}
