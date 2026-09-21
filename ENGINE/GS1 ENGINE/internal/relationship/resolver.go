// Package relationship consumes the relationships and batch genealogy already
// resolved by the Canonical Model. It performs no SAP joins of its own; when a
// required link is absent from the canonical input it reports
// RELATIONSHIP_NOT_FOUND.
package relationship

import (
	"sort"

	"gs1-engine/internal/canonical/model"
	"gs1-engine/internal/errors"
)

// Resolver provides lookup over canonical business objects and relationships.
type Resolver struct {
	genealogy *model.BatchGenealogy
}

// New builds a resolver over the canonical genealogy context.
func New(g *model.BatchGenealogy) *Resolver {
	return &Resolver{genealogy: g}
}

// Transformation is a resolved input -> output batch transformation, sourced
// from the canonical batch transformation objects (top-level, semi-finished
// stage, and raw-material flows).
type Transformation struct {
	TransformationID string
	ProcessOrderID   string
	MaterialID       string
	PlantID          string
	InputBatches     []model.ConsumedBatch
	OutputBatch      model.ProducedProduct
	Type             string
	// CompletionDate is the transformation completion date as evidenced by
	// the canonical context (process order dates, confirmation or posting
	// dates). Empty when the canonical context carries none.
	CompletionDate string
}

// TransformationKey is the deterministic identity of a transformation.
func (t Transformation) Key() string {
	return t.TransformationID + "|" + t.ProcessOrderID + "|" + t.OutputBatch.BatchID
}

// Genealogy exposes the canonical genealogy context.
func (r *Resolver) Genealogy() *model.BatchGenealogy { return r.genealogy }

// PlantForBatch resolves the plant of a batch through the canonical context
// only (batch object, process orders, inspection lots, delivery items). No SAP
// joins are performed.
func (r *Resolver) PlantForBatch(batchID string) (string, bool) {
	if batchID == "" {
		return "", false
	}
	candidates := []string{}

	if b := r.genealogy.Batch; b != nil && b.BatchID == batchID && b.PlantID != "" {
		candidates = append(candidates, b.PlantID)
	}
	if po := r.genealogy.ProcessOrder; po != nil && contains(po.OutputBatches, batchID) && po.PlantID != "" {
		candidates = append(candidates, po.PlantID)
	}
	if sfs := r.genealogy.SemiFinishedStage; sfs != nil && sfs.BatchID == batchID && sfs.PlantID != "" {
		candidates = append(candidates, sfs.PlantID)
	}
	for _, flow := range r.genealogy.RawMaterialFlows {
		if flow.Batch != nil && flow.Batch.BatchID == batchID && flow.Batch.PlantID != "" {
			candidates = append(candidates, flow.Batch.PlantID)
		}
		if flow.QualityInspectionLot != nil && flow.QualityInspectionLot.BatchID == batchID && flow.QualityInspectionLot.PlantID != "" {
			candidates = append(candidates, flow.QualityInspectionLot.PlantID)
		}
	}
	if lot := r.genealogy.QualityInspectionLot; lot != nil && lot.BatchID == batchID && lot.PlantID != "" {
		candidates = append(candidates, lot.PlantID)
	}
	if di := r.genealogy.DeliveryItem; di != nil && di.BatchID == batchID && di.PlantID != "" {
		candidates = append(candidates, di.PlantID)
	}
	if sba := r.genealogy.SalesBatchAllocation; sba != nil && sba.BatchID == batchID && false {
		candidates = append(candidates, sba.BatchID) // allocation carries no plant
	}

	// Deterministic: first non-empty candidate in canonical object order.
	for _, c := range candidates {
		if c != "" {
			return c, true
		}
	}
	return "", false
}

// QualityPlant resolves the plant for a quality object through the canonical
// batch relationship (quality -> batch -> plant). It returns
// RELATIONSHIP_NOT_FOUND when the canonical context cannot supply it.
func (r *Resolver) QualityPlant(batchID string) (string, error) {
	if plant, ok := r.PlantForBatch(batchID); ok {
		return plant, nil
	}
	return "", errors.New(errors.CodeRelationshipNotFound, "",
		"plant for quality object on batch %q not present in canonical context", batchID)
}

// MaterialForBatch resolves the material of a batch through canonical context.
func (r *Resolver) MaterialForBatch(batchID string) (string, bool) {
	if batchID == "" {
		return "", false
	}
	if b := r.genealogy.Batch; b != nil && b.BatchID == batchID && b.MaterialID != "" {
		return b.MaterialID, true
	}
	if bt := r.genealogy.BatchTransformation; bt != nil && bt.OutputBatchID == batchID && bt.MaterialID != "" {
		return bt.MaterialID, true
	}
	if po := r.genealogy.ProcessOrder; po != nil && po.ProducedProduct != nil &&
		po.ProducedProduct.BatchID == batchID && po.ProducedProduct.MaterialID != "" {
		return po.ProducedProduct.MaterialID, true
	}
	for _, flow := range r.genealogy.RawMaterialFlows {
		if flow.Batch != nil && flow.Batch.BatchID == batchID && flow.Batch.MaterialID != "" {
			return flow.Batch.MaterialID, true
		}
		if flow.BatchTransformation != nil && flow.BatchTransformation.OutputBatchID == batchID &&
			flow.BatchTransformation.MaterialID != "" {
			return flow.BatchTransformation.MaterialID, true
		}
	}
	return "", false
}

// Transformations returns all resolved batch transformations, consuming only
// canonical objects: the top-level batch transformation/process order, the
// semi-finished stage, and the raw-material flow transformations. Ordered
// deterministically by (process order, transformation id).
func (r *Resolver) Transformations() []Transformation {
	var out []Transformation
	seen := map[string]bool{}

	add := func(bt *model.BatchTransformation, processOrderID, plantID, materialID, fallbackID, completionDate string) {
		if bt == nil {
			return
		}
		id := bt.TransformationID
		if id == "" {
			id = fallbackID
		}
		if id == "" || seen[id+"|"+processOrderID+"|"+outputBatchID(bt)] {
			return
		}
		inputs := canonicalInputs(bt)
		output := canonicalOutput(bt)
		if len(inputs) == 0 || output == "" {
			return // required relationship absent -> not mappable
		}
		seen[id+"|"+processOrderID+"|"+output] = true
		outProd := model.ProducedProduct{BatchID: output}
		if bt.ProducedProduct != nil && bt.ProducedProduct.BatchID == output {
			outProd = *bt.ProducedProduct
		}
		out = append(out, Transformation{
			TransformationID: id,
			ProcessOrderID:   processOrderID,
			MaterialID:       firstNonEmpty(materialID, bt.MaterialID, outProd.MaterialID),
			PlantID:          plantID,
			InputBatches:     inputs,
			OutputBatch:      outProd,
			Type:             bt.TransformationType,
			CompletionDate:   completionDate,
		})
	}

	g := r.genealogy

	// Top-level finished transformation. Prefer the dedicated canonical
	// batch_transformation object (consumed_batches carry quantities/UOM);
	// fall back to the process order's resolved input/output lists.
	plant := ""
	poDates := ""
	if po := g.ProcessOrder; po != nil {
		plant = po.PlantID
		poDates = firstNonEmpty(po.ActualFinishDate, po.BasicFinishDate, po.ActualStartDate, po.BasicStartDate)
	}
	if g.BatchTransformation != nil {
		poID := g.BatchTransformation.ProcessOrderID
		if poID == "" && g.ProcessOrder != nil {
			poID = g.ProcessOrder.ProcessOrderID
		}
		add(g.BatchTransformation, poID, plant, g.BatchTransformation.MaterialID, g.BatchTransformation.TransformationID, poDates)
	} else if po := g.ProcessOrder; po != nil {
		// Fallback: derive from the process order's resolved input/output lists
		// only when no canonical batch transformation object exists.
		add(transformationFromProcessOrder(po), po.ProcessOrderID, plant, po.MaterialID, "PO-"+po.ProcessOrderID, poDates)
	}

	// Semi-finished stage transformation (raw -> core). Completion evidence:
	// the stage's confirmation date, then its yield/consumption posting dates.
	if sfs := g.SemiFinishedStage; sfs != nil && sfs.BatchTransformation != nil {
		bt := sfs.BatchTransformation
		completion := ""
		if sfs.ProductionConfirmation != nil {
			completion = sfs.ProductionConfirmation.ConfirmationDate
		}
		if completion == "" && sfs.Yield != nil {
			completion = sfs.Yield.PostingDate
		}
		if completion == "" && sfs.MaterialConsumption != nil {
			completion = sfs.MaterialConsumption.PostingDate
		}
		add(bt, firstNonEmpty(bt.ProcessOrderID, sfs.ProcessOrderID), sfs.PlantID,
			firstNonEmpty(bt.MaterialID, sfs.MaterialID), "SFG-"+sfs.ProcessOrderID, completion)
	}

	// Raw-material flow transformations whose output batch is not already
	// covered by the top-level context. A flow transformation restating the
	// same output batch (with a subset of inputs) is a partial view of the
	// same physical transformation and is skipped; a flow producing a
	// different output batch is a distinct physical transformation.
	coveredOutputs := map[string]bool{}
	for _, t := range out {
		coveredOutputs[t.OutputBatch.BatchID] = true
	}
	for _, flow := range g.RawMaterialFlows {
		if flow.BatchTransformation == nil {
			continue
		}
		bt := flow.BatchTransformation
		if coveredOutputs[outputBatchID(bt)] {
			continue
		}
		poID := firstNonEmpty(bt.ProcessOrderID, poIDOf(flow))
		plantID := ""
		if flow.Plant != nil {
			plantID = flow.Plant.PlantID
		}
		if flow.Batch != nil && flow.Batch.PlantID != "" {
			plantID = flow.Batch.PlantID
		}
		add(bt, poID, plantID,
			firstNonEmpty(bt.MaterialID, materialIDOf(flow)), "FLOW-"+bt.OutputBatchID+"-"+inputKey(bt), flowCompletionDate(flow, poID))
	}

	sort.SliceStable(out, func(i, j int) bool {
		if out[i].ProcessOrderID != out[j].ProcessOrderID {
			return out[i].ProcessOrderID < out[j].ProcessOrderID
		}
		return out[i].TransformationID < out[j].TransformationID
	})
	return out
}

// Lineage returns the ordered raw -> intermediate -> finished batch lineage
// for the root batch, consuming only canonical transformation objects.
func (r *Resolver) Lineage() ([]Transformation, error) {
	transformations := r.Transformations()
	if len(transformations) == 0 {
		return nil, errors.New(errors.CodeRelationshipNotFound, "",
			"no batch transformation resolved from canonical genealogy for root batch %q", r.genealogy.RootBatchID)
	}
	return transformations, nil
}

// --- helpers -------------------------------------------------------------

func transformationFromProcessOrder(po *model.ProcessOrderFull) *model.BatchTransformation {
	if len(po.InputBatches) == 0 || len(po.OutputBatches) == 0 {
		return nil
	}
	return &model.BatchTransformation{
		TransformationID: "PO-" + po.ProcessOrderID,
		ProcessOrderID:   po.ProcessOrderID,
		MaterialID:       po.MaterialID,
		InputBatches:     po.InputBatches,
		OutputBatches:    po.OutputBatches,
		ConsumedBatches:  po.ConsumedBatches,
		ProducedProduct:  po.ProducedProduct,
	}
}

func outputBatchID(bt *model.BatchTransformation) string {
	if bt.ProducedProduct != nil && bt.ProducedProduct.BatchID != "" {
		return bt.ProducedProduct.BatchID
	}
	if bt.OutputBatchID != "" {
		return bt.OutputBatchID
	}
	if len(bt.OutputBatches) > 0 {
		return bt.OutputBatches[0]
	}
	return ""
}

func canonicalInputs(bt *model.BatchTransformation) []model.ConsumedBatch {
	if len(bt.ConsumedBatches) > 0 {
		out := make([]model.ConsumedBatch, len(bt.ConsumedBatches))
		copy(out, bt.ConsumedBatches)
		return out
	}
	var inputs []model.ConsumedBatch
	for _, b := range bt.InputBatches {
		if b == "" {
			continue
		}
		inputs = append(inputs, model.ConsumedBatch{BatchID: b})
	}
	return inputs
}

func canonicalOutput(bt *model.BatchTransformation) string {
	if bt.ProducedProduct != nil && bt.ProducedProduct.BatchID != "" {
		return bt.ProducedProduct.BatchID
	}
	if bt.OutputBatchID != "" {
		return bt.OutputBatchID
	}
	if len(bt.OutputBatches) > 0 {
		return bt.OutputBatches[0]
	}
	return ""
}

func poIDOf(flow *model.RawMaterialFlow) string {
	if flow.ProcessOrder != nil {
		return flow.ProcessOrder.ProcessOrderID
	}
	return ""
}

// flowCompletionDate resolves completion evidence for a flow transformation
// from its canonical process order dates.
func flowCompletionDate(flow *model.RawMaterialFlow, poID string) string {
	if flow.ProcessOrder != nil && (poID == "" || flow.ProcessOrder.ProcessOrderID == poID) {
		po := flow.ProcessOrder
		return firstNonEmpty(po.ActualFinishDate, po.BasicFinishDate, po.ActualStartDate, po.BasicStartDate)
	}
	return ""
}

func materialIDOf(flow *model.RawMaterialFlow) string {
	if flow.Batch != nil {
		return flow.Batch.MaterialID
	}
	return ""
}

func inputKey(bt *model.BatchTransformation) string {
	if len(bt.InputBatches) > 0 {
		return bt.InputBatches[0]
	}
	return "in"
}

func contains(list []string, v string) bool {
	for _, s := range list {
		if s == v {
			return true
		}
	}
	return false
}

func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if v != "" {
			return v
		}
	}
	return ""
}
