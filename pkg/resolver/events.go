package resolver

import (
	"fmt"
)

// BusinessEvent captures a business event occurrence across any of the 36+ SAP business objects.
type BusinessEvent struct {
	EventID        string `json:"event_id"`
	EventName      string `json:"event_name"`
	BusinessObject string `json:"business_object"`
	EntityKey      string `json:"entity_key"`
	BatchID        string `json:"batch_id,omitempty"`
	ProcessOrderID string `json:"process_order_id,omitempty"`
	MaterialID     string `json:"material_id,omitempty"`
	PlantID        string `json:"plant_id,omitempty"`
	MovementType   string `json:"movement_type,omitempty"`
	Timestamp      string `json:"timestamp,omitempty"`
	Status         string `json:"status,omitempty"`
	Description    string `json:"description"`
}

// DetectBusinessEvents detects all business events according to the SAP Business Events Specification.
func (r *RelationshipResolver) DetectBusinessEvents() []BusinessEvent {
	var events []BusinessEvent
	counter := 1

	addEvent := func(name, boName, entityKey, batchID, aufnr, matID, plantID, bwart, timestamp, status, desc string) {
		events = append(events, BusinessEvent{
			EventID:        fmt.Sprintf("EVT-%06d", counter),
			EventName:      name,
			BusinessObject: boName,
			EntityKey:      entityKey,
			BatchID:        batchID,
			ProcessOrderID: aufnr,
			MaterialID:     matID,
			PlantID:        plantID,
			MovementType:   bwart,
			Timestamp:      timestamp,
			Status:         status,
			Description:    desc,
		})
		counter++
	}

	// 1. Planning Requirement Events
	for _, pr := range r.bo.PlanningRequirements {
		addEvent("PlanningRequirementCreated", "Planning Requirement", pr.PlanningRequirementID, "", "", pr.MaterialID, pr.PlantID, "", pr.RequirementDate, "Active",
			fmt.Sprintf("Planning requirement created for material %s at plant %s, qty %.2f %s", pr.MaterialID, pr.PlantID, pr.RequirementQuantity, pr.UOM))
	}

	// 2. Planned Order Events
	for _, po := range r.bo.PlannedOrders {
		addEvent("PlannedOrderCreated", "Planned Order", po.PlanOrderID, "", po.ProcessOrderID, po.MaterialID, po.PlantID, "", po.StartDate, "Created",
			fmt.Sprintf("Planned order created for material %s with quantity %.2f", po.MaterialID, po.OrderQuantity))

		// PlannedOrderConverted: Matching Process Order exists
		if po.ProcessOrderID != "" {
			addEvent("PlannedOrderConverted", "Planned Order", po.PlanOrderID, "", po.ProcessOrderID, po.MaterialID, po.PlantID, "", po.StartDate, "Converted",
				fmt.Sprintf("Planned order %s converted to Process Order %s", po.PlanOrderID, po.ProcessOrderID))
		}
	}

	// 3. Material Events
	for _, m := range r.bo.Materials {
		addEvent("MaterialCreated", "Material", m.MaterialID, "", "", m.MaterialID, m.PlantID, "", "", m.Status,
			fmt.Sprintf("Material master created: %s (%s)", m.MaterialID, m.MaterialDescription))
		if m.Status == "Blocked" || m.Status == "01" || m.Status == "02" {
			addEvent("MaterialBlocked", "Material", m.MaterialID, "", "", m.MaterialID, m.PlantID, "", "", "Blocked",
				fmt.Sprintf("Material %s is currently blocked", m.MaterialID))
		}
	}

	// 4. Batch Master Events
	for _, b := range r.bo.Batches {
		addEvent("ProductionBatchCreated", "Batch", b.BatchID, b.BatchID, "", b.MaterialID, b.PlantID, "", b.ManufacturingDate, b.Status,
			fmt.Sprintf("Batch %s registered for material %s at plant %s (type: %s)", b.BatchID, b.MaterialID, b.PlantID, b.BatchType))
		if b.Status == "Released" || b.Status == "Unrestricted" {
			addEvent("BatchStatusChanged", "Batch", b.BatchID, b.BatchID, "", b.MaterialID, b.PlantID, "", b.ManufacturingDate, b.Status,
				fmt.Sprintf("Batch %s status updated to %s", b.BatchID, b.Status))
		}
	}

	// 5. Supplier Source Events
	for _, s := range r.bo.Suppliers {
		addEvent("SupplierSourceCreated", "Supplier or Source", s.SupplierID, "", "", s.MaterialID, "", "", "", s.Status,
			fmt.Sprintf("Supplier source %s (%s) created for material %s", s.SupplierID, s.SourceName, s.MaterialID))
	}

	// 6. Purchase Requisition Events
	for _, pr := range r.bo.PurchaseRequisitions {
		addEvent("PurchaseRequisitionCreated", "Purchase Requisition", pr.PurchaseRequisitionID, "", "", pr.MaterialID, pr.PlantID, "", pr.RequestedDeliveryDate, "Created",
			fmt.Sprintf("Purchase requisition %s item %s created for material %s (qty %.2f)", pr.PurchaseRequisitionID, pr.ItemID, pr.MaterialID, pr.RequestedQuantity))
	}

	// 7. Purchase Order Events
	for _, po := range r.bo.PurchaseOrders {
		addEvent("PurchaseOrderCreated", "Purchase Order", po.PurchaseOrderID, "", "", "", "", "", po.OrderDate, "Created",
			fmt.Sprintf("Purchase order %s created with %d items", po.PurchaseOrderID, len(po.Items)))
		for _, item := range po.Items {
			addEvent("PurchaseOrderReleased", "Purchase Order Item", fmt.Sprintf("%s-%s", po.PurchaseOrderID, item.ItemID), "", "", item.MaterialID, item.PlantID, "", item.DeliveryDate, "Released",
				fmt.Sprintf("Purchase order %s item %s released for delivery on %s", po.PurchaseOrderID, item.ItemID, item.DeliveryDate))
		}
	}

	// 8. Material Movement Events (Unified MATDOC)
	for _, mm := range r.bo.MaterialMovements {
		switch mm.MovementType {
		case "101":
			if mm.PurchaseOrderID != "" {
				addEvent("GoodsReceiptPosted", "Material Movement", mm.MaterialDocumentID, mm.BatchID, mm.ProcessOrderID, mm.MaterialID, mm.PlantID, mm.MovementType, mm.PostingDate, "Posted",
					fmt.Sprintf("Goods receipt posted against PO %s for material %s (qty %.2f)", mm.PurchaseOrderID, mm.MaterialID, mm.Quantity))
			} else if mm.ProcessOrderID != "" {
				addEvent("YieldRecorded", "Material Movement", mm.MaterialDocumentID, mm.BatchID, mm.ProcessOrderID, mm.MaterialID, mm.PlantID, mm.MovementType, mm.PostingDate, "Posted",
					fmt.Sprintf("Production yield posted for Process Order %s with batch %s (qty %.2f)", mm.ProcessOrderID, mm.BatchID, mm.Quantity))
			}
		case "261":
			addEvent("MaterialConsumptionPosted", "Material Movement", mm.MaterialDocumentID, mm.BatchID, mm.ProcessOrderID, mm.MaterialID, mm.PlantID, mm.MovementType, mm.PostingDate, "Consumed",
				fmt.Sprintf("Material consumption posted for Process Order %s (qty %.2f %s)", mm.ProcessOrderID, mm.Quantity, mm.UOM))
		case "601":
			addEvent("GoodsIssuePosted", "Material Movement", mm.MaterialDocumentID, mm.BatchID, mm.ProcessOrderID, mm.MaterialID, mm.PlantID, mm.MovementType, mm.PostingDate, "Goods Issued",
				fmt.Sprintf("Goods issue posted for delivery with batch %s (qty %.2f)", mm.BatchID, mm.Quantity))
			addEvent("DeliveryShipped", "Material Movement", mm.MaterialDocumentID, mm.BatchID, mm.ProcessOrderID, mm.MaterialID, mm.PlantID, mm.MovementType, mm.PostingDate, "Shipped",
				fmt.Sprintf("Delivery shipment completed under material document %s", mm.MaterialDocumentID))
		default:
			addEvent("MaterialTransferred", "Material Movement", mm.MaterialDocumentID, mm.BatchID, mm.ProcessOrderID, mm.MaterialID, mm.PlantID, mm.MovementType, mm.PostingDate, "Transferred",
				fmt.Sprintf("Material movement type %s recorded for material %s", mm.MovementType, mm.MaterialID))
		}
	}

	// 9. Inventory Stock Events
	for _, inv := range r.bo.InventoryStocks {
		if inv.StockQuantity > 0 {
			addEvent("StockIncreased", "Inventory Stock", fmt.Sprintf("%s-%s-%s", inv.MaterialID, inv.PlantID, inv.StorageLocation), inv.BatchID, "", inv.MaterialID, inv.PlantID, "", "", inv.StockStatus,
				fmt.Sprintf("Stock balance recorded: %.2f %s (%s)", inv.StockQuantity, inv.UOM, inv.StockStatus))
		}
		if inv.QualityInspection > 0 {
			addEvent("StockStatusChanged", "Inventory Stock", fmt.Sprintf("%s-%s-%s", inv.MaterialID, inv.PlantID, inv.StorageLocation), inv.BatchID, "", inv.MaterialID, inv.PlantID, "", "", "Quality Inspection",
				fmt.Sprintf("Stock placed under quality inspection: %.2f %s", inv.QualityInspection, inv.UOM))
		}
	}

	// 10. Reservation Events
	for _, res := range r.bo.Reservations {
		addEvent("ReservationCreated", "Reservation", fmt.Sprintf("%s-%s", res.ReservationID, res.ItemID), res.BatchID, res.ProcessOrderID, res.MaterialID, res.PlantID, res.MovementType, res.RequirementDate, "Created",
			fmt.Sprintf("Reservation created for Process Order %s: material %s, qty %.2f", res.ProcessOrderID, res.MaterialID, res.ReservationQuantity))
		if res.BatchID != "" {
			addEvent("BatchAssigned", "Reservation", fmt.Sprintf("%s-%s", res.ReservationID, res.ItemID), res.BatchID, res.ProcessOrderID, res.MaterialID, res.PlantID, res.MovementType, res.RequirementDate, "Assigned",
				fmt.Sprintf("Batch %s assigned to reservation %s", res.BatchID, res.ReservationID))
		}
	}

	// 11. Process Order Events
	for _, po := range r.bo.ProcessOrders {
		addEvent("ProcessOrderCreated", "Process Order", po.ProcessOrderID, po.BatchID, po.ProcessOrderID, po.MaterialID, po.PlantID, "", po.BasicStartDate, po.Status,
			fmt.Sprintf("Process Order %s created for material %s at plant %s (batch: %s)", po.ProcessOrderID, po.MaterialID, po.PlantID, po.BatchID))
		if po.BatchID != "" {
			addEvent("BatchAssigned", "Process Order", po.ProcessOrderID, po.BatchID, po.ProcessOrderID, po.MaterialID, po.PlantID, "", po.BasicStartDate, "Assigned",
				fmt.Sprintf("Output batch %s assigned to Process Order %s", po.BatchID, po.ProcessOrderID))
		}
	}

	// 12. BOM Events
	for _, bom := range r.bo.BOMs {
		addEvent("BOMCreated", "BOM", bom.BOMID, "", "", bom.MaterialID, bom.PlantID, "", "", bom.BOMStatus,
			fmt.Sprintf("BOM %s created for material %s with %d components", bom.BOMID, bom.MaterialID, len(bom.Components)))
	}

	// 13. Recipe Events
	for _, rc := range r.bo.Recipes {
		addEvent("RecipeCreated", "Recipe", rc.RecipeID, "", "", rc.MaterialID, rc.PlantID, "", "", rc.RecipeStatus,
			fmt.Sprintf("Recipe %s created for material %s with %d operations", rc.RecipeID, rc.MaterialID, len(rc.Operations)))
	}

	// 14. Production Version Events
	for _, pv := range r.bo.ProductionVersions {
		addEvent("ProductionVersionCreated", "Production Version", pv.ProductionVersionID, "", "", pv.MaterialID, pv.PlantID, "", pv.ValidFrom, pv.ProductionVersionStatus,
			fmt.Sprintf("Production version %s created for material %s (BOM: %s, Recipe: %s)", pv.ProductionVersionID, pv.MaterialID, pv.BOMID, pv.RecipeID))
	}

	// 15. Batch Determination Events
	for _, bd := range r.bo.BatchDeterminations {
		addEvent("BatchDetermined", "Batch Determination", bd.DeterminationID, bd.BatchID, bd.ProcessOrderID, bd.MaterialID, bd.PlantID, "", "", bd.Status,
			fmt.Sprintf("Batch %s determined for Process Order %s (qty %.2f)", bd.BatchID, bd.ProcessOrderID, bd.Quantity))
		if bd.BatchID != "" {
			addEvent("BatchAssigned", "Batch Determination", bd.DeterminationID, bd.BatchID, bd.ProcessOrderID, bd.MaterialID, bd.PlantID, "", "", "Assigned",
				fmt.Sprintf("Batch %s assigned to component requirement in Process Order %s", bd.BatchID, bd.ProcessOrderID))
		}
	}

	// 16. Material Consumption Events
	for _, mc := range r.bo.MaterialConsumptions {
		addEvent("MaterialConsumptionPosted", "Material Consumption", mc.MaterialDocumentID, mc.BatchID, mc.ProcessOrderID, "", mc.PlantID, mc.MovementType, mc.PostingDate, mc.Status,
			fmt.Sprintf("Material consumption posted for Process Order %s with batch %s (qty %.2f)", mc.ProcessOrderID, mc.BatchID, mc.ConsumedQuantity))
	}

	// 17. Production Confirmation Events
	for _, pc := range r.bo.ProductionConfirmations {
		addEvent("ProductionConfirmationRecorded", "Production Confirmation", pc.ConfirmationID, "", pc.ProcessOrderID, "", "", "", pc.ConfirmationDate, pc.Status,
			fmt.Sprintf("Production confirmation %s recorded for Process Order %s (yield %.2f)", pc.ConfirmationID, pc.ProcessOrderID, pc.YieldQuantity))
		if pc.Status == "Confirmed" {
			addEvent("OperationCompleted", "Production Confirmation", pc.ConfirmationID, "", pc.ProcessOrderID, "", "", "", pc.ActualFinishDate, "Completed",
				fmt.Sprintf("Operation %s completed for Process Order %s", pc.OperationNumber, pc.ProcessOrderID))
		}
	}

	// 18. Batch Transformation Events
	for _, bt := range r.bo.BatchTransformations {
		addEvent("BatchTransformationCreated", "Batch Transformation", bt.TransformationID, bt.OutputBatchID, bt.ProcessOrderID, bt.MaterialID, bt.PlantID, "", bt.TransformationDate, bt.Status,
			fmt.Sprintf("Transformation created: input [%s] -> output batch %s via Process Order %s", bt.InputBatchID, bt.OutputBatchID, bt.ProcessOrderID))
	}

	// 19. Yield Events
	for _, y := range r.bo.Yields {
		addEvent("YieldRecorded", "Yield", fmt.Sprintf("YLD-%s-%s", y.ProcessOrderID, y.BatchID), y.BatchID, y.ProcessOrderID, y.MasterID, "", "", y.PostingDate, y.Status,
			fmt.Sprintf("Production yield of %.2f %s recorded for batch %s in Process Order %s", y.YieldQuantity, y.UOM, y.BatchID, y.ProcessOrderID))
	}

	// 20. Inspection Characteristic Events
	for _, ic := range r.bo.InspectionCharacteristics {
		addEvent("InspectionCharacteristicCreated", "Inspection Characteristic", ic.InspectionCharacteristicID, "", "", ic.MaterialID, ic.PlantID, "", "", ic.Status,
			fmt.Sprintf("Master inspection characteristic %s (%s) created", ic.InspectionCharacteristicID, ic.Description))
	}

	// 21. Inspection Plan Events
	for _, ip := range r.bo.InspectionPlans {
		addEvent("InspectionPlanCreated", "Inspection Plan", ip.InspectionPlanID, "", "", ip.MaterialID, ip.PlantID, "", "", ip.Status,
			fmt.Sprintf("Quality inspection plan %s created for material %s", ip.InspectionPlanID, ip.MaterialID))
	}

	// 22. Inspection Parameter Events
	for _, prm := range r.bo.InspectionParameters {
		addEvent("InspectionParameterAssigned", "Inspection Parameter", prm.ParameterID, "", "", prm.MaterialID, prm.PlantID, "", "", prm.Status,
			fmt.Sprintf("Inspection parameter %s assigned to material %s", prm.InspectionParameter, prm.MaterialID))
	}

	// 23. Quality Inspection Lot Events
	for _, ql := range r.bo.QualityInspectionLots {
		addEvent("InspectionLotCreated", "Quality Inspection Lot", ql.InspectionLotID, ql.BatchID, ql.ProcessOrder, ql.MaterialID, ql.PlantID, "", ql.CreationDate, ql.Status,
			fmt.Sprintf("Inspection lot %s created for batch %s (quantity %.2f %s)", ql.InspectionLotID, ql.BatchID, ql.Quantity, ql.UOM))
		if ql.InspectionStartDate != "" {
			addEvent("InspectionStarted", "Quality Inspection Lot", ql.InspectionLotID, ql.BatchID, ql.ProcessOrder, ql.MaterialID, ql.PlantID, "", ql.InspectionStartDate, "In Inspection",
				fmt.Sprintf("Quality inspection started on %s for lot %s", ql.InspectionStartDate, ql.InspectionLotID))
		}
	}

	// 24. Sampling Events
	for _, sm := range r.bo.Samplings {
		addEvent("SampleCreated", "Sampling", sm.SampleID, sm.BatchID, "", sm.MaterialID, "", "", sm.SampleDate, sm.Status,
			fmt.Sprintf("Sample %s drawn for inspection lot %s (batch: %s)", sm.SampleID, sm.InspectionLotID, sm.BatchID))
	}

	// 25. Inspection Result Events
	for _, ir := range r.bo.InspectionResults {
		addEvent("InspectionResultRecorded", "Inspection Result", ir.InspectionResultID, ir.BatchID, "", ir.MaterialID, "", "", ir.RecordDate, ir.ResultStatus,
			fmt.Sprintf("Inspection result recorded for characteristic %s: %s (status: %s)", ir.InspectionCharacteristicID, ir.ResultValue, ir.ResultStatus))
	}

	// 26. Quality Usage Decision Events
	for _, ud := range r.bo.UsageDecisions {
		addEvent("QualityDecisionRecorded", "Usage Decision", ud.UsageDecisionID, ud.BatchID, "", ud.MaterialID, ud.PlantID, "", ud.DecisionDate, ud.DecisionStatus,
			fmt.Sprintf("Quality usage decision recorded for lot %s: %s (%s)", ud.InspectionLotID, ud.DecisionCode, ud.DecisionStatus))
	}

	// 27. Customer Events
	for _, c := range r.bo.Customers {
		addEvent("CustomerCreated", "Customer", c.CustomerID, "", "", "", "", "", "", c.Status,
			fmt.Sprintf("Customer %s (%s) registered", c.CustomerID, c.CustomerName))
	}

	// 28. Sales Order Events
	for _, so := range r.bo.SalesOrders {
		addEvent("SalesOrderCreated", "Sales Order", so.SalesOrderID, "", "", "", "", "", so.OrderDate, so.Status,
			fmt.Sprintf("Sales order %s created for customer %s", so.SalesOrderID, so.CustomerID))
	}

	// 29. Sales Order Item Events
	for _, soi := range r.bo.SalesOrderItems {
		addEvent("SalesOrderItemAdded", "Sales Order Item", fmt.Sprintf("%s-%s", soi.SalesOrderID, soi.ItemID), "", "", soi.MaterialID, "", "", soi.RequestedDeliveryDate, soi.Status,
			fmt.Sprintf("Sales order item %s added: material %s, qty %.2f %s", soi.ItemID, soi.MaterialID, soi.OrderedQuantity, soi.UOM))
	}

	// 30. Sales Batch Allocation Events
	for _, sba := range r.bo.SalesBatchAllocations {
		addEvent("BatchAllocated", "Sales Batch Allocation", fmt.Sprintf("%s-%s", sba.SalesOrderID, sba.SalesOrderItemID), sba.BatchID, "", sba.MaterialID, "", "", "", sba.AllocatedStatus,
			fmt.Sprintf("Batch %s allocated to Sales Order %s Item %s", sba.BatchID, sba.SalesOrderID, sba.SalesOrderItemID))
	}

	// 31. Outbound Delivery Events
	for _, od := range r.bo.OutboundDeliveries {
		addEvent("DeliveryCreated", "Outbound Delivery", od.DeliveryID, "", "", "", "", "", od.DeliveryDate, od.Status,
			fmt.Sprintf("Outbound delivery %s created for customer %s", od.DeliveryID, od.CustomerID))
	}

	// 32. Delivery Item Events
	for _, di := range r.bo.DeliveryItems {
		addEvent("DeliveryItemCreated", "Delivery Item", fmt.Sprintf("%s-%s", di.DeliveryID, di.ItemID), di.BatchID, "", di.MaterialID, di.PlantID, "", "", di.Status,
			fmt.Sprintf("Delivery item %s created: material %s, qty %.2f %s", di.ItemID, di.MaterialID, di.DeliveryQuantity, di.UOM))
		if di.BatchID != "" {
			addEvent("BatchAssigned", "Delivery Item", fmt.Sprintf("%s-%s", di.DeliveryID, di.ItemID), di.BatchID, "", di.MaterialID, di.PlantID, "", "", "Assigned",
				fmt.Sprintf("Batch %s assigned to delivery item %s-%s", di.BatchID, di.DeliveryID, di.ItemID))
		}
	}

	// 33. Billing Document Events
	for _, bd := range r.bo.BillingDocuments {
		addEvent("InvoiceCreated", "Billing Document", bd.BillingDocumentID, "", "", "", "", "", bd.BillingDate, bd.Status,
			fmt.Sprintf("Billing invoice %s created for customer %s, gross value: %.2f %s", bd.BillingDocumentID, bd.CustomerID, bd.GrossValue, bd.Currency))
		addEvent("InvoicePosted", "Billing Document", bd.BillingDocumentID, "", "", "", "", "", bd.BillingDate, "Posted",
			fmt.Sprintf("Invoice %s posted to financial accounting", bd.BillingDocumentID))
	}

	// 34. Sales Return Events
	for _, sr := range r.bo.SalesReturns {
		addEvent("ReturnCreated", "Sales Return", sr.ReturnID, sr.BatchID, "", sr.MaterialID, "", "", sr.ReturnDate, "Created",
			fmt.Sprintf("Sales return %s created for batch %s (return qty: %.2f %s)", sr.ReturnID, sr.BatchID, sr.ReturnQuantity, sr.UOM))
	}

	// 35. Goods Receipt (GRN) Events (Dedicated Rule Engine)
	for _, gr := range r.bo.GoodsReceipts {
		addEvent("GRNCreated", "Goods Receipt (GRN)", gr.GRNID, gr.BatchID, "", gr.MaterialID, gr.PlantID, gr.MovementType, gr.PostingDate, "Created",
			fmt.Sprintf("Goods receipt document %s item %s created for material %s", gr.GRNID, gr.GRNItemID, gr.MaterialID))

		// Rule: GRNPosted when MATDOC.BWART = 101 AND EBELN IS NOT NULL AND EBELP IS NOT NULL
		if gr.MovementType == "101" && gr.PurchaseOrderID != "" && gr.PurchaseOrderItemID != "" {
			addEvent("GRNPosted", "Goods Receipt (GRN)", gr.GRNID, gr.BatchID, "", gr.MaterialID, gr.PlantID, gr.MovementType, gr.PostingDate, "Posted",
				fmt.Sprintf("Procurement GRN posted against PO %s item %s (batch: %s, qty: %.2f %s)", gr.PurchaseOrderID, gr.PurchaseOrderItemID, gr.BatchID, gr.ReceivedQuantity, gr.UnitOfMeasure))
		}

		if gr.BatchID != "" {
			addEvent("BatchReceived", "Goods Receipt (GRN)", gr.GRNID, gr.BatchID, "", gr.MaterialID, gr.PlantID, gr.MovementType, gr.PostingDate, "Received",
				fmt.Sprintf("Batch %s received into stock at plant %s", gr.BatchID, gr.PlantID))
		}
	}

	return events
}

// DetectBatchEvents filters all business events pertaining to a specific batch ID.
func (r *RelationshipResolver) DetectBatchEvents(batchID string) []BusinessEvent {
	all := r.DetectBusinessEvents()
	var results []BusinessEvent
	for _, ev := range all {
		if ev.BatchID == batchID {
			results = append(results, ev)
		}
	}
	return results
}

// DetectProcessOrderEvents filters all business events pertaining to a specific Process Order ID.
func (r *RelationshipResolver) DetectProcessOrderEvents(processOrderID string) []BusinessEvent {
	all := r.DetectBusinessEvents()
	var results []BusinessEvent
	for _, ev := range all {
		if ev.ProcessOrderID == processOrderID {
			results = append(results, ev)
		}
	}
	return results
}
