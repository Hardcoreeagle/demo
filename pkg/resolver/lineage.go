package resolver

import (
	"strings"

	"supply-bo-builder/pkg/models"
)

// BatchGenealogy represents the complete 360-degree traceability graph
// for an individual Batch, centered around its Process Order (for Output Batches)
// or its upstream procurement and downstream consumption/deliveries.
type BatchGenealogy struct {
	BatchID             string `json:"batch_id"`
	MaterialID          string `json:"material_id"`
	MaterialDescription string `json:"material_description,omitempty"`
	PlantID             string `json:"plant_id,omitempty"`
	BatchType           string `json:"batch_type,omitempty"`
	Status              string `json:"status,omitempty"`
	ManufacturingDate   string `json:"manufacturing_date,omitempty"`
	ExpiryDate          string `json:"expiry_date,omitempty"`

	// Manufacturing & Process Order Lineage
	ProcessOrders       []models.ProcessOrder           `json:"process_orders,omitempty"`
	PlannedOrders       []models.PlannedOrder           `json:"planned_orders,omitempty"`
	ProductionVersions  []models.ProductionVersion      `json:"production_versions,omitempty"`
	BOMs                []models.BOM                    `json:"boms,omitempty"`
	Recipes             []models.Recipe                 `json:"recipes,omitempty"`
	Confirmations       []models.ProductionConfirmation `json:"production_confirmations,omitempty"`
	Yields              []models.Yield                  `json:"yields,omitempty"`

	// Transformation & Ingredients
	TransformationsAsOutput []models.BatchTransformation `json:"transformations_as_output,omitempty"`
	TransformationsAsInput  []models.BatchTransformation `json:"transformations_as_input,omitempty"`
	BatchDeterminations     []models.BatchDetermination  `json:"batch_determinations,omitempty"`
	MaterialConsumptions    []models.MaterialConsumption `json:"material_consumptions,omitempty"`
	Reservations            []models.Reservation         `json:"reservations,omitempty"`

	// Quality Management
	QualityInspectionLots []models.QualityInspectionLot `json:"quality_inspection_lots,omitempty"`
	Samplings             []models.Sampling             `json:"samplings,omitempty"`
	InspectionResults     []models.InspectionResult     `json:"inspection_results,omitempty"`
	UsageDecisions        []models.UsageDecision        `json:"usage_decisions,omitempty"`

	// Inventory & Material Movements
	InventoryStocks   []models.InventoryStock   `json:"inventory_stocks,omitempty"`
	MaterialMovements []models.MaterialMovement `json:"material_movements,omitempty"`
	GoodsReceipts     []models.GoodsReceipt     `json:"goods_receipts,omitempty"`

	// Sales, Distribution & Deliveries
	SalesBatchAllocations []models.SalesBatchAllocation `json:"sales_batch_allocations,omitempty"`
	DeliveryItems         []models.DeliveryItem         `json:"delivery_items,omitempty"`
	OutboundDeliveries    []models.OutboundDelivery     `json:"outbound_deliveries,omitempty"`
	SalesOrderItems       []models.SalesOrderItem       `json:"sales_order_items,omitempty"`
	SalesOrders           []models.SalesOrder           `json:"sales_orders,omitempty"`
	BillingDocuments      []models.BillingDocument      `json:"billing_documents,omitempty"`
	SalesReturns          []models.SalesReturn          `json:"sales_returns,omitempty"`
	Customers             []models.CustomerOrCFA        `json:"customers,omitempty"`
	Events                []BusinessEvent               `json:"events,omitempty"`
}

// ResolveBatchGenealogy builds the complete lineage for a given batch ID.
func (r *RelationshipResolver) ResolveBatchGenealogy(batchID string) *BatchGenealogy {
	if batchID == "" {
		return nil
	}

	genealogy := &BatchGenealogy{
		BatchID: batchID,
	}

	// 1. Batch Master
	var foundBatch *models.Batch
	for _, b := range r.bo.Batches {
		if b.BatchID == batchID {
			foundBatch = &b
			break
		}
	}
	if foundBatch != nil {
		genealogy.MaterialID = foundBatch.MaterialID
		genealogy.PlantID = foundBatch.PlantID
		genealogy.BatchType = foundBatch.BatchType
		genealogy.Status = foundBatch.Status
		genealogy.ManufacturingDate = foundBatch.ManufacturingDate
		genealogy.ExpiryDate = foundBatch.ExpiryDate
	} else {
		// Fallback for intermediate, consumed, or raw material sub-batches
		for _, mm := range r.bo.MaterialMovements {
			if mm.BatchID == batchID {
				genealogy.MaterialID = mm.MaterialID
				genealogy.PlantID = mm.PlantID
				genealogy.BatchType = "RAW_MATERIAL"
				genealogy.Status = "Received"
				genealogy.ManufacturingDate = mm.PostingDate
				break
			}
		}
		if genealogy.MaterialID == "" {
			for _, res := range r.bo.Reservations {
				if res.BatchID == batchID {
					genealogy.MaterialID = res.MaterialID
					genealogy.PlantID = res.PlantID
					genealogy.BatchType = "CONSUMED_BATCH"
					genealogy.Status = "Consumed"
					break
				}
			}
		}
		if genealogy.MaterialID == "" {
			for _, trf := range r.bo.BatchTransformations {
				if trf.InputBatchID == batchID || trf.OutputBatchID == batchID {
					genealogy.MaterialID = trf.MaterialID
					break
				}
			}
		}
		if genealogy.PlantID == "" {
			for _, mc := range r.bo.MaterialConsumptions {
				if mc.BatchID == batchID {
					genealogy.PlantID = mc.PlantID
					genealogy.BatchType = "CONSUMED_BATCH"
					genealogy.Status = "Consumed"
					genealogy.ManufacturingDate = mc.PostingDate
					break
				}
			}
		}
		if strings.HasSuffix(batchID, "-CORE") {
			genealogy.BatchType = "SEMI_FINISHED"
			genealogy.Status = "Released"
			if genealogy.PlantID == "" {
				genealogy.PlantID = "EP04"
			}
		}
	}

	// Material Description
	if genealogy.MaterialID != "" {
		if mat, ok := r.materialByID[genealogy.MaterialID]; ok {
			genealogy.MaterialDescription = mat.MaterialDescription
		}
	}

	// Track associated Process Orders
	processOrderIDs := make(map[string]bool)

	// 2. Process Orders producing this batch
	for _, po := range r.bo.ProcessOrders {
		if po.BatchID == batchID {
			genealogy.ProcessOrders = append(genealogy.ProcessOrders, po)
			processOrderIDs[po.ProcessOrderID] = true
			if genealogy.MaterialID == "" {
				genealogy.MaterialID = po.MaterialID
			}
			if genealogy.PlantID == "" {
				genealogy.PlantID = po.PlantID
			}
		}
	}

	// 3. Batch Transformations
	for _, trf := range r.bo.BatchTransformations {
		if trf.OutputBatchID == batchID {
			genealogy.TransformationsAsOutput = append(genealogy.TransformationsAsOutput, trf)
			if trf.ProcessOrderID != "" {
				processOrderIDs[trf.ProcessOrderID] = true
			}
		}
		if trf.InputBatchID == batchID || strings.Contains(trf.InputBatchID, batchID) {
			genealogy.TransformationsAsInput = append(genealogy.TransformationsAsInput, trf)
			if trf.ProcessOrderID != "" {
				processOrderIDs[trf.ProcessOrderID] = true
			}
		}
	}

	// Also check if any transformation referenced an AUFNR that we have
	for aufnr := range processOrderIDs {
		if po, ok := r.processOrderByID[aufnr]; ok {
			alreadyInPO := false
			for _, existing := range genealogy.ProcessOrders {
				if existing.ProcessOrderID == aufnr {
					alreadyInPO = true
					break
				}
			}
			if !alreadyInPO {
				genealogy.ProcessOrders = append(genealogy.ProcessOrders, po)
			}
		}
	}

	// 4. Planned Orders
	seenPlnum := make(map[string]bool)
	for _, po := range genealogy.ProcessOrders {
		if po.PlannedID != "" && !seenPlnum[po.PlannedID] {
			if pl, ok := r.plannedOrderByID[po.PlannedID]; ok {
				genealogy.PlannedOrders = append(genealogy.PlannedOrders, pl)
				seenPlnum[po.PlannedID] = true
			}
		}
	}
	for aufnr := range processOrderIDs {
		for _, pl := range r.plannedOrderByAUF[aufnr] {
			if !seenPlnum[pl.PlanOrderID] {
				genealogy.PlannedOrders = append(genealogy.PlannedOrders, pl)
				seenPlnum[pl.PlanOrderID] = true
			}
		}
	}

	// 5. Yields
	for _, y := range r.bo.Yields {
		if y.BatchID == batchID || (y.ProcessOrderID != "" && processOrderIDs[y.ProcessOrderID]) {
			genealogy.Yields = append(genealogy.Yields, y)
		}
	}

	// 6. Production Confirmations
	for aufnr := range processOrderIDs {
		for _, conf := range r.confirmationByAUF[aufnr] {
			genealogy.Confirmations = append(genealogy.Confirmations, conf)
		}
	}

	// 7. Material Consumptions
	for _, mc := range r.bo.MaterialConsumptions {
		if mc.BatchID == batchID || (mc.ProcessOrderID != "" && processOrderIDs[mc.ProcessOrderID]) {
			genealogy.MaterialConsumptions = append(genealogy.MaterialConsumptions, mc)
		}
	}

	// 8. Batch Determinations
	for _, bd := range r.bo.BatchDeterminations {
		if bd.BatchID == batchID || (bd.ProcessOrderID != "" && processOrderIDs[bd.ProcessOrderID]) {
			genealogy.BatchDeterminations = append(genealogy.BatchDeterminations, bd)
		}
	}

	// 9. Reservations
	for _, res := range r.bo.Reservations {
		if res.BatchID == batchID || (res.ProcessOrderID != "" && processOrderIDs[res.ProcessOrderID]) {
			genealogy.Reservations = append(genealogy.Reservations, res)
		}
	}

	// 10. BOMs, Recipes, Production Versions for the Material
	matID := genealogy.MaterialID
	if matID != "" {
		genealogy.BOMs = append(genealogy.BOMs, r.bomByMat[matID]...)
		genealogy.Recipes = append(genealogy.Recipes, r.recipeByMat[matID]...)
		genealogy.ProductionVersions = append(genealogy.ProductionVersions, r.prodVersionByMat[matID]...)
	}

	// 11. Quality Management
	seenLot := make(map[string]bool)
	for _, ql := range r.bo.QualityInspectionLots {
		if ql.BatchID == batchID || (ql.ProcessOrder != "" && processOrderIDs[ql.ProcessOrder]) {
			if !seenLot[ql.InspectionLotID] {
				genealogy.QualityInspectionLots = append(genealogy.QualityInspectionLots, ql)
				seenLot[ql.InspectionLotID] = true
			}
		}
	}
	for lotID := range seenLot {
		genealogy.Samplings = append(genealogy.Samplings, r.samplingByLot[lotID]...)
		genealogy.InspectionResults = append(genealogy.InspectionResults, r.inspResultByLot[lotID]...)
		genealogy.UsageDecisions = append(genealogy.UsageDecisions, r.usageDecisionByLot[lotID]...)
	}

	// 12. Inventory Stocks
	for _, inv := range r.bo.InventoryStocks {
		if inv.BatchID == batchID {
			genealogy.InventoryStocks = append(genealogy.InventoryStocks, inv)
		}
	}

	// 13. Material Movements
	for _, mm := range r.bo.MaterialMovements {
		if mm.BatchID == batchID || (mm.ProcessOrderID != "" && processOrderIDs[mm.ProcessOrderID]) {
			genealogy.MaterialMovements = append(genealogy.MaterialMovements, mm)
		}
	}

	// 14. Goods Receipts (GRN)
	for _, gr := range r.bo.GoodsReceipts {
		if gr.BatchID == batchID {
			genealogy.GoodsReceipts = append(genealogy.GoodsReceipts, gr)
		}
	}

	// 15. Sales Batch Allocations
	for _, sba := range r.bo.SalesBatchAllocations {
		if sba.BatchID == batchID {
			genealogy.SalesBatchAllocations = append(genealogy.SalesBatchAllocations, sba)
		}
	}

	// 16. Delivery Items & Outbound Deliveries
	seenDel := make(map[string]bool)
	seenSO := make(map[string]bool)
	seenCust := make(map[string]bool)

	for _, di := range r.bo.DeliveryItems {
		if di.BatchID == batchID {
			genealogy.DeliveryItems = append(genealogy.DeliveryItems, di)
			if di.DeliveryID != "" && !seenDel[di.DeliveryID] {
				seenDel[di.DeliveryID] = true
				if del, ok := r.deliveryByID[di.DeliveryID]; ok {
					genealogy.OutboundDeliveries = append(genealogy.OutboundDeliveries, del)
					if del.CustomerID != "" && !seenCust[del.CustomerID] {
						seenCust[del.CustomerID] = true
						if cust, ok := r.customerByID[del.CustomerID]; ok {
							genealogy.Customers = append(genealogy.Customers, cust)
						}
					}
				}
			}
			if di.SalesOrderID != "" && !seenSO[di.SalesOrderID] {
				seenSO[di.SalesOrderID] = true
				if so, ok := r.salesOrderByID[di.SalesOrderID]; ok {
					genealogy.SalesOrders = append(genealogy.SalesOrders, so)
					if so.CustomerID != "" && !seenCust[so.CustomerID] {
						seenCust[so.CustomerID] = true
						if cust, ok := r.customerByID[so.CustomerID]; ok {
							genealogy.Customers = append(genealogy.Customers, cust)
						}
					}
				}
			}
		}
	}

	// Sales Order Items
	for _, so := range genealogy.SalesOrders {
		for _, soi := range r.salesItemByOrder[so.SalesOrderID] {
			genealogy.SalesOrderItems = append(genealogy.SalesOrderItems, soi)
		}
	}

	// Billing Documents
	for delID := range seenDel {
		for _, bill := range r.billingByDelivery[delID] {
			genealogy.BillingDocuments = append(genealogy.BillingDocuments, bill)
		}
	}

	// 17. Sales Returns
	for _, ret := range r.bo.SalesReturns {
		if ret.BatchID == batchID {
			genealogy.SalesReturns = append(genealogy.SalesReturns, ret)
			if ret.CustomerID != "" && !seenCust[ret.CustomerID] {
				seenCust[ret.CustomerID] = true
				if cust, ok := r.customerByID[ret.CustomerID]; ok {
					genealogy.Customers = append(genealogy.Customers, cust)
				}
			}
		}
	}

	return genealogy
}

// ResolveProcessOrderLineage resolves batch genealogy starting from a Process Order ID.
func (r *RelationshipResolver) ResolveProcessOrderLineage(processOrderID string) *BatchGenealogy {
	po, ok := r.processOrderByID[processOrderID]
	if !ok {
		return nil
	}

	if po.BatchID != "" {
		return r.ResolveBatchGenealogy(po.BatchID)
	}

	// If no batch_id, create genealogy for the order
	pseudoBatchID := "PO-" + processOrderID
	genealogy := &BatchGenealogy{
		BatchID:             pseudoBatchID,
		MaterialID:          po.MaterialID,
		PlantID:             po.PlantID,
		BatchType:           "Order Work-in-Progress",
		Status:              po.Status,
		ManufacturingDate:   po.BasicStartDate,
		ProcessOrders:       []models.ProcessOrder{po},
	}

	if po.PlannedID != "" {
		if pl, ok := r.plannedOrderByID[po.PlannedID]; ok {
			genealogy.PlannedOrders = append(genealogy.PlannedOrders, pl)
		}
	}

	genealogy.Yields = append(genealogy.Yields, r.yieldByAUF[processOrderID]...)
	genealogy.Confirmations = append(genealogy.Confirmations, r.confirmationByAUF[processOrderID]...)
	genealogy.MaterialConsumptions = append(genealogy.MaterialConsumptions, r.consumptionByAUF[processOrderID]...)
	genealogy.BatchDeterminations = append(genealogy.BatchDeterminations, r.batchDetByAUF[processOrderID]...)
	genealogy.TransformationsAsOutput = append(genealogy.TransformationsAsOutput, r.batchTrfByAUF[processOrderID]...)
	genealogy.QualityInspectionLots = append(genealogy.QualityInspectionLots, r.inspLotByAUF[processOrderID]...)

	return genealogy
}

// ResolveAllBatchGenealogies resolves genealogies for all batches in the container.
func (r *RelationshipResolver) ResolveAllBatchGenealogies() []*BatchGenealogy {
	var results []*BatchGenealogy
	seen := make(map[string]bool)

	// First: Output Batches produced by Process Orders
	for _, po := range r.bo.ProcessOrders {
		if po.BatchID != "" && !seen[po.BatchID] {
			seen[po.BatchID] = true
			if g := r.ResolveBatchGenealogy(po.BatchID); g != nil {
				results = append(results, g)
			}
		}
	}

	// Second: Any other batches in the batch catalog
	for _, b := range r.bo.Batches {
		if b.BatchID != "" && !seen[b.BatchID] {
			seen[b.BatchID] = true
			if g := r.ResolveBatchGenealogy(b.BatchID); g != nil {
				results = append(results, g)
			}
		}
	}

	return results
}
