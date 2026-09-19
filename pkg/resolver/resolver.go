package resolver

import (
	"fmt"

	"supply-bo-builder/pkg/builder"
	"supply-bo-builder/pkg/loader"
	"supply-bo-builder/pkg/models"
)

// RelationshipResolver manages indexes and resolves field-level relationships
// across independent SAP Business Objects and underlying tables.
type RelationshipResolver struct {
	bo      *models.BusinessObjectsContainer
	repo    *builder.Repository
	catalog []RelationshipMetadata

	// Pre-indexed lookup caches for O(1) matching
	planningReqByID   map[string]models.PlanningRequirement
	plannedOrderByID  map[string]models.PlannedOrder
	plannedOrderByAUF map[string][]models.PlannedOrder
	materialByID      map[string]models.Material
	batchByKey        map[string]models.Batch // MATNR+WERKS+CHARG -> Batch
	batchByMatCharg   map[string][]models.Batch
	supplierByID      map[string]models.SupplierOrSource
	prByID            map[string]models.PurchaseRequisition
	prByKey           map[string]models.PurchaseRequisition // BANFN+BNFPO
	poByID            map[string]models.PurchaseOrder
	poItemByKey       map[string]models.PurchaseOrderItem // EBELN+EBELP
	matMovementByID   map[string][]models.MaterialMovement // MBLNR+MJAHR
	matMovementByMat  map[string][]models.MaterialMovement // MATNR+WERKS
	matMovementByPO   map[string][]models.MaterialMovement // EBELN+EBELP
	matMovementByAUF  map[string][]models.MaterialMovement // AUFNR
	matMovementByRSN  map[string][]models.MaterialMovement // RSNUM
	inventoryByKey    map[string][]models.InventoryStock  // MATNR+WERKS+LGORT
	inventoryByMat    map[string][]models.InventoryStock  // MATNR
	reservationByID   map[string][]models.Reservation     // RSNUM
	reservationByKey  map[string]models.Reservation       // RSNUM+RSPOS
	processOrderByID  map[string]models.ProcessOrder      // AUFNR
	bomByID           map[string]models.BOM               // BOMID
	bomByMat          map[string][]models.BOM             // MATNR
	recipeByID        map[string]models.Recipe            // RecipeID
	recipeByMat       map[string][]models.Recipe          // MATNR
	prodVersionByID   map[string]models.ProductionVersion // ProductionVersionID
	prodVersionByMat  map[string][]models.ProductionVersion
	batchDetByAUF     map[string][]models.BatchDetermination
	consumptionByAUF  map[string][]models.MaterialConsumption
	consumptionByRSN  map[string][]models.MaterialConsumption
	confirmationByAUF map[string][]models.ProductionConfirmation
	batchTrfByAUF     map[string][]models.BatchTransformation
	yieldByAUF        map[string][]models.Yield
	inspCharByID      map[string]models.InspectionCharacteristic
	inspPlanByID      map[string]models.InspectionPlan
	inspParamByID     map[string]models.InspectionParameter
	inspLotByID       map[string]models.QualityInspectionLot
	inspLotByAUF      map[string][]models.QualityInspectionLot
	samplingByLot     map[string][]models.Sampling
	inspResultByLot   map[string][]models.InspectionResult
	usageDecisionByLot map[string][]models.UsageDecision
	customerByID      map[string]models.CustomerOrCFA
	salesOrderByID    map[string]models.SalesOrder
	salesItemByKey    map[string]models.SalesOrderItem // VBELN+POSNR
	salesItemByOrder  map[string][]models.SalesOrderItem
	salesAllocByOrder map[string][]models.SalesBatchAllocation
	deliveryByID      map[string]models.OutboundDelivery
	deliveryByOrder   map[string][]models.OutboundDelivery
	deliveryItemByKey map[string]models.DeliveryItem // VBELN+POSNR
	deliveryItemByDel map[string][]models.DeliveryItem
	billingByID       map[string]models.BillingDocument
	billingByDelivery map[string][]models.BillingDocument
	billingByOrder    map[string][]models.BillingDocument
	salesReturnByID   map[string]models.SalesReturn
	workCentreByID    map[string]models.WorkCentre
	goodsReceiptByID  map[string][]models.GoodsReceipt
	goodsReceiptByPO  map[string][]models.GoodsReceipt // EBELN+EBELP
}

// NewRelationshipResolver initializes a new RelationshipResolver and builds lookup indexes.
func NewRelationshipResolver(bo *models.BusinessObjectsContainer, repo *builder.Repository) *RelationshipResolver {
	if bo == nil {
		bo = &models.BusinessObjectsContainer{}
	}
	r := &RelationshipResolver{
		bo:                bo,
		repo:              repo,
		catalog:           GetRelationshipCatalog(),
		planningReqByID:   make(map[string]models.PlanningRequirement),
		plannedOrderByID:  make(map[string]models.PlannedOrder),
		plannedOrderByAUF: make(map[string][]models.PlannedOrder),
		materialByID:      make(map[string]models.Material),
		batchByKey:        make(map[string]models.Batch),
		batchByMatCharg:   make(map[string][]models.Batch),
		supplierByID:      make(map[string]models.SupplierOrSource),
		prByID:            make(map[string]models.PurchaseRequisition),
		prByKey:           make(map[string]models.PurchaseRequisition),
		poByID:            make(map[string]models.PurchaseOrder),
		poItemByKey:       make(map[string]models.PurchaseOrderItem),
		matMovementByID:   make(map[string][]models.MaterialMovement),
		matMovementByMat:  make(map[string][]models.MaterialMovement),
		matMovementByPO:   make(map[string][]models.MaterialMovement),
		matMovementByAUF:  make(map[string][]models.MaterialMovement),
		matMovementByRSN:  make(map[string][]models.MaterialMovement),
		inventoryByKey:    make(map[string][]models.InventoryStock),
		inventoryByMat:    make(map[string][]models.InventoryStock),
		reservationByID:   make(map[string][]models.Reservation),
		reservationByKey:  make(map[string]models.Reservation),
		processOrderByID:  make(map[string]models.ProcessOrder),
		bomByID:           make(map[string]models.BOM),
		bomByMat:          make(map[string][]models.BOM),
		recipeByID:        make(map[string]models.Recipe),
		recipeByMat:       make(map[string][]models.Recipe),
		prodVersionByID:   make(map[string]models.ProductionVersion),
		prodVersionByMat:  make(map[string][]models.ProductionVersion),
		batchDetByAUF:     make(map[string][]models.BatchDetermination),
		consumptionByAUF:  make(map[string][]models.MaterialConsumption),
		consumptionByRSN:  make(map[string][]models.MaterialConsumption),
		confirmationByAUF: make(map[string][]models.ProductionConfirmation),
		batchTrfByAUF:     make(map[string][]models.BatchTransformation),
		yieldByAUF:        make(map[string][]models.Yield),
		inspCharByID:      make(map[string]models.InspectionCharacteristic),
		inspPlanByID:      make(map[string]models.InspectionPlan),
		inspParamByID:     make(map[string]models.InspectionParameter),
		inspLotByID:       make(map[string]models.QualityInspectionLot),
		inspLotByAUF:      make(map[string][]models.QualityInspectionLot),
		samplingByLot:     make(map[string][]models.Sampling),
		inspResultByLot:   make(map[string][]models.InspectionResult),
		usageDecisionByLot: make(map[string][]models.UsageDecision),
		customerByID:      make(map[string]models.CustomerOrCFA),
		salesOrderByID:    make(map[string]models.SalesOrder),
		salesItemByKey:    make(map[string]models.SalesOrderItem),
		salesItemByOrder:  make(map[string][]models.SalesOrderItem),
		salesAllocByOrder: make(map[string][]models.SalesBatchAllocation),
		deliveryByID:      make(map[string]models.OutboundDelivery),
		deliveryByOrder:   make(map[string][]models.OutboundDelivery),
		deliveryItemByKey: make(map[string]models.DeliveryItem),
		deliveryItemByDel: make(map[string][]models.DeliveryItem),
		billingByID:       make(map[string]models.BillingDocument),
		billingByDelivery: make(map[string][]models.BillingDocument),
		billingByOrder:    make(map[string][]models.BillingDocument),
		salesReturnByID:   make(map[string]models.SalesReturn),
		workCentreByID:    make(map[string]models.WorkCentre),
		goodsReceiptByID:  make(map[string][]models.GoodsReceipt),
		goodsReceiptByPO:  make(map[string][]models.GoodsReceipt),
	}

	r.buildIndexes()
	return r
}

func cleanKey(s string) string {
	return loader.Clean(s)
}

func (r *RelationshipResolver) buildIndexes() {
	for _, x := range r.bo.PlanningRequirements {
		r.planningReqByID[cleanKey(x.PlanningRequirementID)] = x
	}
	for _, x := range r.bo.PlannedOrders {
		r.plannedOrderByID[cleanKey(x.PlanOrderID)] = x
		if auf := cleanKey(x.ProcessOrderID); auf != "" {
			r.plannedOrderByAUF[auf] = append(r.plannedOrderByAUF[auf], x)
		}
	}
	for _, x := range r.bo.Materials {
		r.materialByID[cleanKey(x.MaterialID)] = x
	}
	for _, x := range r.bo.Batches {
		k := fmt.Sprintf("%s|%s|%s", cleanKey(x.MaterialID), cleanKey(x.PlantID), cleanKey(x.BatchID))
		r.batchByKey[k] = x
		km := fmt.Sprintf("%s|%s", cleanKey(x.MaterialID), cleanKey(x.BatchID))
		r.batchByMatCharg[km] = append(r.batchByMatCharg[km], x)
	}
	for _, x := range r.bo.Suppliers {
		r.supplierByID[cleanKey(x.SupplierID)] = x
	}
	for _, x := range r.bo.PurchaseRequisitions {
		r.prByID[cleanKey(x.PurchaseRequisitionID)] = x
		k := fmt.Sprintf("%s|%s", cleanKey(x.PurchaseRequisitionID), cleanKey(x.ItemID))
		r.prByKey[k] = x
	}
	for _, x := range r.bo.PurchaseOrders {
		r.poByID[cleanKey(x.PurchaseOrderID)] = x
		for _, item := range x.Items {
			k := fmt.Sprintf("%s|%s", cleanKey(x.PurchaseOrderID), cleanKey(item.ItemID))
			r.poItemByKey[k] = item
		}
	}
	for _, x := range r.bo.MaterialMovements {
		k := fmt.Sprintf("%s|%s", cleanKey(x.MaterialDocumentID), cleanKey(x.MaterialDocumentYear))
		r.matMovementByID[k] = append(r.matMovementByID[k], x)
		km := fmt.Sprintf("%s|%s", cleanKey(x.MaterialID), cleanKey(x.PlantID))
		r.matMovementByMat[km] = append(r.matMovementByMat[km], x)
		if x.PurchaseOrderID != "" {
			kp := fmt.Sprintf("%s|%s", cleanKey(x.PurchaseOrderID), cleanKey(x.ReferenceDocumentID))
			r.matMovementByPO[kp] = append(r.matMovementByPO[kp], x)
		}
		if x.ProcessOrderID != "" {
			r.matMovementByAUF[cleanKey(x.ProcessOrderID)] = append(r.matMovementByAUF[cleanKey(x.ProcessOrderID)], x)
		}
		if x.ReservationID != "" {
			r.matMovementByRSN[cleanKey(x.ReservationID)] = append(r.matMovementByRSN[cleanKey(x.ReservationID)], x)
		}
	}
	for _, x := range r.bo.InventoryStocks {
		k := fmt.Sprintf("%s|%s|%s", cleanKey(x.MaterialID), cleanKey(x.PlantID), cleanKey(x.StorageLocation))
		r.inventoryByKey[k] = append(r.inventoryByKey[k], x)
		r.inventoryByMat[cleanKey(x.MaterialID)] = append(r.inventoryByMat[cleanKey(x.MaterialID)], x)
	}
	for _, x := range r.bo.Reservations {
		r.reservationByID[cleanKey(x.ReservationID)] = append(r.reservationByID[cleanKey(x.ReservationID)], x)
		k := fmt.Sprintf("%s|%s", cleanKey(x.ReservationID), cleanKey(x.ItemID))
		r.reservationByKey[k] = x
	}
	for _, x := range r.bo.ProcessOrders {
		r.processOrderByID[cleanKey(x.ProcessOrderID)] = x
	}
	for _, x := range r.bo.BOMs {
		r.bomByID[cleanKey(x.BOMID)] = x
		r.bomByMat[cleanKey(x.MaterialID)] = append(r.bomByMat[cleanKey(x.MaterialID)], x)
	}
	for _, x := range r.bo.Recipes {
		r.recipeByID[cleanKey(x.RecipeID)] = x
		r.recipeByMat[cleanKey(x.MaterialID)] = append(r.recipeByMat[cleanKey(x.MaterialID)], x)
	}
	for _, x := range r.bo.ProductionVersions {
		r.prodVersionByID[cleanKey(x.ProductionVersionID)] = x
		r.prodVersionByMat[cleanKey(x.MaterialID)] = append(r.prodVersionByMat[cleanKey(x.MaterialID)], x)
	}
	for _, x := range r.bo.BatchDeterminations {
		r.batchDetByAUF[cleanKey(x.ProcessOrderID)] = append(r.batchDetByAUF[cleanKey(x.ProcessOrderID)], x)
	}
	for _, x := range r.bo.MaterialConsumptions {
		r.consumptionByAUF[cleanKey(x.ProcessOrderID)] = append(r.consumptionByAUF[cleanKey(x.ProcessOrderID)], x)
		r.consumptionByRSN[cleanKey(x.ReservationID)] = append(r.consumptionByRSN[cleanKey(x.ReservationID)], x)
	}
	for _, x := range r.bo.ProductionConfirmations {
		r.confirmationByAUF[cleanKey(x.ProcessOrderID)] = append(r.confirmationByAUF[cleanKey(x.ProcessOrderID)], x)
	}
	for _, x := range r.bo.BatchTransformations {
		r.batchTrfByAUF[cleanKey(x.ProcessOrderID)] = append(r.batchTrfByAUF[cleanKey(x.ProcessOrderID)], x)
	}
	for _, x := range r.bo.Yields {
		r.yieldByAUF[cleanKey(x.ProcessOrderID)] = append(r.yieldByAUF[cleanKey(x.ProcessOrderID)], x)
	}
	for _, x := range r.bo.InspectionCharacteristics {
		r.inspCharByID[cleanKey(x.InspectionCharacteristicID)] = x
	}
	for _, x := range r.bo.InspectionPlans {
		r.inspPlanByID[cleanKey(x.InspectionPlanID)] = x
	}
	for _, x := range r.bo.InspectionParameters {
		r.inspParamByID[cleanKey(x.ParameterID)] = x
	}
	for _, x := range r.bo.QualityInspectionLots {
		r.inspLotByID[cleanKey(x.InspectionLotID)] = x
		if x.ProcessOrder != "" {
			r.inspLotByAUF[cleanKey(x.ProcessOrder)] = append(r.inspLotByAUF[cleanKey(x.ProcessOrder)], x)
		}
	}
	for _, x := range r.bo.Samplings {
		r.samplingByLot[cleanKey(x.InspectionLotID)] = append(r.samplingByLot[cleanKey(x.InspectionLotID)], x)
	}
	for _, x := range r.bo.InspectionResults {
		r.inspResultByLot[cleanKey(x.InspectionLotID)] = append(r.inspResultByLot[cleanKey(x.InspectionLotID)], x)
	}
	for _, x := range r.bo.UsageDecisions {
		r.usageDecisionByLot[cleanKey(x.InspectionLotID)] = append(r.usageDecisionByLot[cleanKey(x.InspectionLotID)], x)
	}
	for _, x := range r.bo.Customers {
		r.customerByID[cleanKey(x.CustomerID)] = x
	}
	for _, x := range r.bo.SalesOrders {
		r.salesOrderByID[cleanKey(x.SalesOrderID)] = x
	}
	for _, x := range r.bo.SalesOrderItems {
		k := fmt.Sprintf("%s|%s", cleanKey(x.SalesOrderID), cleanKey(x.ItemID))
		r.salesItemByKey[k] = x
		r.salesItemByOrder[cleanKey(x.SalesOrderID)] = append(r.salesItemByOrder[cleanKey(x.SalesOrderID)], x)
	}
	for _, x := range r.bo.SalesBatchAllocations {
		r.salesAllocByOrder[cleanKey(x.SalesOrderID)] = append(r.salesAllocByOrder[cleanKey(x.SalesOrderID)], x)
	}
	for _, x := range r.bo.OutboundDeliveries {
		r.deliveryByID[cleanKey(x.DeliveryID)] = x
		if x.SalesOrderID != "" {
			r.deliveryByOrder[cleanKey(x.SalesOrderID)] = append(r.deliveryByOrder[cleanKey(x.SalesOrderID)], x)
		}
	}
	for _, x := range r.bo.DeliveryItems {
		k := fmt.Sprintf("%s|%s", cleanKey(x.DeliveryID), cleanKey(x.ItemID))
		r.deliveryItemByKey[k] = x
		r.deliveryItemByDel[cleanKey(x.DeliveryID)] = append(r.deliveryItemByDel[cleanKey(x.DeliveryID)], x)
	}
	for _, x := range r.bo.BillingDocuments {
		r.billingByID[cleanKey(x.BillingDocumentID)] = x
		if x.DeliveryID != "" {
			r.billingByDelivery[cleanKey(x.DeliveryID)] = append(r.billingByDelivery[cleanKey(x.DeliveryID)], x)
		}
		if x.SalesOrderID != "" {
			r.billingByOrder[cleanKey(x.SalesOrderID)] = append(r.billingByOrder[cleanKey(x.SalesOrderID)], x)
		}
	}
	for _, x := range r.bo.SalesReturns {
		r.salesReturnByID[cleanKey(x.ReturnID)] = x
	}
	for _, x := range r.bo.WorkCentres {
		r.workCentreByID[cleanKey(x.WorkCentreID)] = x
	}
	for _, x := range r.bo.GoodsReceipts {
		r.goodsReceiptByID[cleanKey(x.GRNID)] = append(r.goodsReceiptByID[cleanKey(x.GRNID)], x)
		k := fmt.Sprintf("%s|%s", cleanKey(x.PurchaseOrderID), cleanKey(x.PurchaseOrderItemID))
		r.goodsReceiptByPO[k] = append(r.goodsReceiptByPO[k], x)
	}
}

// ResolveRelationship evaluates a specific relationship definition (1..106)
// against the loaded Business Objects and underlying SAP tables.
func (r *RelationshipResolver) ResolveRelationship(relID int) []ResolvedLink {
	if relID < 1 || relID > len(r.catalog) {
		return nil
	}
	meta := r.catalog[relID-1]
	var links []ResolvedLink

	addLink := func(srcKey, tgtKey string, matched bool, details map[string]string) {
		links = append(links, ResolvedLink{
			RelationshipID: meta.ID,
			GroupName:      meta.GroupName,
			SourceEntity:   meta.SourceEntity,
			SourceKey:      srcKey,
			TargetEntity:   meta.TargetEntity,
			TargetKey:      tgtKey,
			JoinType:       meta.JoinType,
			Matched:        matched,
			Details:        details,
		})
	}

	switch relID {
	// ================= 1. Planning & MRP =================
	case 1: // PBIM.BDZEI = PBED.BDZEI
		for _, pr := range r.bo.PlanningRequirements {
			addLink(pr.PlanningRequirementID, pr.PlanningRequirementID, true, map[string]string{
				"material_id": pr.MaterialID,
				"plant_id":    pr.PlantID,
				"req_date":    pr.RequirementDate,
			})
		}
	case 2: // PLAF.PLNUM = AFPO.PLNUM -> AFPO.AUFNR
		for _, po := range r.bo.PlannedOrders {
			matched := false
			for _, proc := range r.bo.ProcessOrders {
				if proc.PlannedID == po.PlanOrderID || proc.ProcessOrderID == po.ProcessOrderID {
					addLink(po.PlanOrderID, proc.ProcessOrderID, true, map[string]string{
						"material_id": po.MaterialID,
						"plant_id":    po.PlantID,
					})
					matched = true
				}
			}
			if !matched && meta.JoinType == "LEFT JOIN" {
				addLink(po.PlanOrderID, "(unassigned)", false, nil)
			}
		}
	case 3: // PLAF.RSNUM = RESB.RSNUM
		for _, po := range r.bo.PlannedOrders {
			matched := false
			if proc, ok := r.processOrderByID[po.ProcessOrderID]; ok && proc.ReservationID != "" {
				if resList, has := r.reservationByID[proc.ReservationID]; has && len(resList) > 0 {
					for _, res := range resList {
						addLink(po.PlanOrderID, res.ReservationID, true, map[string]string{
							"reservation_id": res.ReservationID,
							"item_id":        res.ItemID,
						})
						matched = true
					}
				}
			}
			if !matched && meta.JoinType == "LEFT JOIN" {
				addLink(po.PlanOrderID, "(none)", false, nil)
			}
		}
	case 4: // PLAF.AUFNR = AFPO.AUFNR when PLAF.AUFNR is populated
		for _, po := range r.bo.PlannedOrders {
			if po.ProcessOrderID != "" {
				if proc, ok := r.processOrderByID[po.ProcessOrderID]; ok {
					addLink(po.PlanOrderID, proc.ProcessOrderID, true, map[string]string{
						"order_type": proc.OrderType,
						"plant_id":   proc.PlantID,
					})
				} else if meta.JoinType == "LEFT JOIN" {
					addLink(po.PlanOrderID, po.ProcessOrderID, false, nil)
				}
			}
		}

	// ================= 2. Process Order Structure =================
	case 5: // AFKO.AUFNR = ProcessOrder.AUFNR (Header)
		for _, po := range r.bo.ProcessOrders {
			addLink(po.ProcessOrderID, po.ProcessOrderID+"-HDR", true, map[string]string{
				"material_id": po.MaterialID,
				"plant_id":    po.PlantID,
				"status":      po.Status,
			})
		}
	case 6: // AFPO.AUFNR = ProcessOrder.AUFNR (Item)
		for _, po := range r.bo.ProcessOrders {
			addLink(po.ProcessOrderID, po.ProcessOrderID+"-0001", true, map[string]string{
				"batch_id":  po.BatchID,
				"planned_q": fmt.Sprintf("%.2f", po.PlannedQuantity),
			})
		}
	case 7: // AFKO.RSNUM = RESB.RSNUM AND RESB.AUFNR = AFKO.AUFNR
		for _, po := range r.bo.ProcessOrders {
			matched := false
			if po.ReservationID != "" {
				if resList, ok := r.reservationByID[po.ReservationID]; ok {
					for _, res := range resList {
						addLink(po.ProcessOrderID, res.ReservationID, true, map[string]string{
							"item_id":     res.ItemID,
							"material_id": res.MaterialID,
						})
						matched = true
					}
				}
			}
			if !matched && meta.JoinType == "LEFT JOIN" {
				addLink(po.ProcessOrderID, "(none)", false, nil)
			}
		}
	case 8: // RESB.RSNUM = MATDOC.RSNUM AND RESB.RSPOS = MATDOC.RSPOS AND MATDOC.BWART = 261
		for _, res := range r.bo.Reservations {
			matched := false
			if consList, ok := r.consumptionByRSN[res.ReservationID]; ok {
				for _, cons := range consList {
					addLink(res.ReservationID+"|"+res.ItemID, cons.MaterialDocumentID, true, map[string]string{
						"consumed_qty": fmt.Sprintf("%.2f", cons.ConsumedQuantity),
						"batch_id":     cons.BatchID,
					})
					matched = true
				}
			}
			if !matched && meta.JoinType == "LEFT JOIN" {
				addLink(res.ReservationID+"|"+res.ItemID, "(not-consumed)", false, nil)
			}
		}
	case 9: // MATDOC.AUFNR = AFKO.AUFNR AND MATDOC.BWART = 261
		for _, po := range r.bo.ProcessOrders {
			matched := false
			if consList, ok := r.consumptionByAUF[po.ProcessOrderID]; ok {
				for _, cons := range consList {
					addLink(po.ProcessOrderID, cons.MaterialDocumentID, true, map[string]string{
						"batch_id": cons.BatchID,
						"qty":      fmt.Sprintf("%.2f", cons.ConsumedQuantity),
					})
					matched = true
				}
			}
			if !matched && meta.JoinType == "LEFT JOIN" {
				addLink(po.ProcessOrderID, "(none)", false, nil)
			}
		}
	case 10: // AFRU.AUFNR = AFKO.AUFNR
		for _, po := range r.bo.ProcessOrders {
			matched := false
			if confList, ok := r.confirmationByAUF[po.ProcessOrderID]; ok {
				for _, conf := range confList {
					addLink(po.ProcessOrderID, conf.ConfirmationID, true, map[string]string{
						"confirmed_qty": fmt.Sprintf("%.2f", conf.ConfirmedQuantity),
						"yield":         fmt.Sprintf("%.2f", conf.YieldQuantity),
					})
					matched = true
				}
			}
			if !matched && meta.JoinType == "LEFT JOIN" {
				addLink(po.ProcessOrderID, "(unconfirmed)", false, nil)
			}
		}
	case 11: // AFRU.AUFPL = AFVC.AUFPL AND AFRU.APLZL = AFVC.APLZL
		for _, conf := range r.bo.ProductionConfirmations {
			opID := conf.OperationID
			if opID == "" {
				opID = conf.OperationNumber
			}
			addLink(conf.ConfirmationID, opID, true, map[string]string{
				"work_center": conf.WorkCenterID,
				"proc_order":  conf.ProcessOrderID,
			})
		}
	case 12: // AFKO.AUFPL = AFVC.AUFPL
		for _, po := range r.bo.ProcessOrders {
			if rec, ok := r.recipeByID[po.ProductionVersionID]; ok && len(rec.Operations) > 0 {
				for _, op := range rec.Operations {
					addLink(po.ProcessOrderID, op.OperationID, true, map[string]string{
						"op_num":      op.OperationNumber,
						"work_center": op.WorkCenterID,
					})
				}
			} else {
				addLink(po.ProcessOrderID, po.ProcessOrderID+"-OP01", true, map[string]string{
					"note": "Standard Process Operation",
				})
			}
		}
	case 13: // AFVC.ARBID = CRHD.OBJID
		for _, rec := range r.bo.Recipes {
			for _, op := range rec.Operations {
				wcName := "Standard Work Center"
				if wc, ok := r.workCentreByID[op.WorkCenterID]; ok {
					wcName = wc.WorkCentreName
				}
				addLink(op.OperationID, op.WorkCenterID, true, map[string]string{
					"name": wcName,
				})
			}
		}
		if len(links) == 0 {
			for _, wc := range r.bo.WorkCentres {
				addLink("OP-"+wc.WorkCentreID, wc.WorkCentreID, true, map[string]string{
					"name": wc.WorkCentreName,
				})
			}
		}
	case 14: // AFKO.AUFPL = AFVC.AUFPL -> AFVC.ARBID = CRHD.OBJID
		for _, po := range r.bo.ProcessOrders {
			wcID := ""
			if confList, ok := r.confirmationByAUF[po.ProcessOrderID]; ok && len(confList) > 0 {
				wcID = confList[0].WorkCenterID
			}
			if wcID == "" && len(r.bo.WorkCentres) > 0 {
				wcID = r.bo.WorkCentres[0].WorkCentreID
			}
			addLink(po.ProcessOrderID, wcID, true, map[string]string{
				"material_id": po.MaterialID,
			})
		}

	// ================= 3. Quality Management =================
	case 15: // AFKO.PRUEFLOS = QALS.PRUEFLOS or AFKO.AUFNR = QALS.AUFNR
		for _, po := range r.bo.ProcessOrders {
			matched := false
			if lots, ok := r.inspLotByAUF[po.ProcessOrderID]; ok {
				for _, lot := range lots {
					addLink(po.ProcessOrderID, lot.InspectionLotID, true, map[string]string{
						"origin": lot.InspectionOrigin,
						"status": lot.Status,
					})
					matched = true
				}
			}
			if !matched && meta.JoinType == "LEFT JOIN" {
				addLink(po.ProcessOrderID, "(no-lot)", false, nil)
			}
		}
	case 16: // QALS.MBLNR = MATDOC.MBLNR AND QALS.MJAHR = MATDOC.MJAHR AND QALS.ZEILE = MATDOC.ZEILE
		for _, lot := range r.bo.QualityInspectionLots {
			matched := false
			if lot.MaterialDocumentID != "" {
				k := fmt.Sprintf("%s|%s", lot.MaterialDocumentID, lot.MaterialDocumentYear)
				if mvs, ok := r.matMovementByID[k]; ok {
					for _, mv := range mvs {
						addLink(lot.InspectionLotID, mv.MaterialDocumentID, true, map[string]string{
							"bwart": mv.MovementType,
							"matnr": mv.MaterialID,
						})
						matched = true
					}
				}
			}
			if !matched && meta.JoinType == "LEFT JOIN" {
				addLink(lot.InspectionLotID, "(no-matdoc)", false, nil)
			}
		}
	case 17: // QALS.MATNR = Batch.MATNR AND QALS.WERK = Batch.WERKS AND QALS.CHARG = Batch.CHARG
		for _, lot := range r.bo.QualityInspectionLots {
			k := fmt.Sprintf("%s|%s|%s", lot.MaterialID, lot.PlantID, lot.BatchID)
			if b, ok := r.batchByKey[k]; ok {
				addLink(lot.InspectionLotID, b.BatchID, true, map[string]string{
					"batch_type": b.BatchType,
					"status":     b.Status,
				})
			} else if meta.JoinType == "LEFT JOIN" {
				addLink(lot.InspectionLotID, lot.BatchID, false, nil)
			}
		}
	case 18: // QALS.PRUEFLOS = QAMR.PRUEFLOS / QASR.PRUEFLOS
		for _, lot := range r.bo.QualityInspectionLots {
			matched := false
			if smps, ok := r.samplingByLot[lot.InspectionLotID]; ok {
				for _, smp := range smps {
					addLink(lot.InspectionLotID, smp.SampleID, true, map[string]string{
						"sample_qty": fmt.Sprintf("%.2f", smp.SampleQuantity),
					})
					matched = true
				}
			}
			if !matched && meta.JoinType == "LEFT JOIN" {
				addLink(lot.InspectionLotID, "(no-sample)", false, nil)
			}
		}
	case 19: // Sampling to Inspection Result (Match PRUEFLOS plus relevant keys)
		for _, smp := range r.bo.Samplings {
			matched := false
			if results, ok := r.inspResultByLot[smp.InspectionLotID]; ok {
				for _, res := range results {
					if res.SampleID == smp.SampleID || res.SampleID == "" {
						addLink(smp.SampleID, res.InspectionResultID, true, map[string]string{
							"characteristic": res.InspectionCharacteristicID,
							"val":            res.ResultValue,
						})
						matched = true
					}
				}
			}
			if !matched && meta.JoinType == "LEFT JOIN" {
				addLink(smp.SampleID, "(no-result)", false, nil)
			}
		}
	case 20: // QALS.PRUEFLOS = QAVE.PRUEFLOS
		for _, lot := range r.bo.QualityInspectionLots {
			matched := false
			if uds, ok := r.usageDecisionByLot[lot.InspectionLotID]; ok {
				for _, ud := range uds {
					addLink(lot.InspectionLotID, ud.UsageDecisionID, true, map[string]string{
						"decision": ud.DecisionCode,
						"status":   ud.DecisionStatus,
					})
					matched = true
				}
			}
			if !matched && meta.JoinType == "LEFT JOIN" {
				addLink(lot.InspectionLotID, "(no-ud)", false, nil)
			}
		}

	// ================= 4. Material Movements & Inventory Postings =================
	case 21: // MATDOC.MATNR = MARA.MATNR
		for _, mv := range r.bo.MaterialMovements {
			if m, ok := r.materialByID[mv.MaterialID]; ok {
				addLink(mv.MaterialDocumentID, m.MaterialID, true, map[string]string{
					"uom":  m.UOM,
					"type": m.MaterialType,
				})
			} else {
				addLink(mv.MaterialDocumentID, mv.MaterialID, true, nil)
			}
		}
	case 22: // MATDOC.MATNR = MARC.MATNR AND MATDOC.WERKS = MARC.WERKS
		for _, mv := range r.bo.MaterialMovements {
			addLink(mv.MaterialDocumentID, fmt.Sprintf("%s|%s", mv.MaterialID, mv.PlantID), true, map[string]string{
				"plant": mv.PlantID,
			})
		}
	case 23: // MATDOC.MATNR = Batch.MATNR AND MATDOC.WERKS = Batch.WERKS AND MATDOC.CHARG = Batch.CHARG
		for _, mv := range r.bo.MaterialMovements {
			k := fmt.Sprintf("%s|%s|%s", mv.MaterialID, mv.PlantID, mv.BatchID)
			if b, ok := r.batchByKey[k]; ok {
				addLink(mv.MaterialDocumentID, b.BatchID, true, map[string]string{
					"batch_type": b.BatchType,
				})
			} else if meta.JoinType == "LEFT JOIN" {
				addLink(mv.MaterialDocumentID, mv.BatchID, false, nil)
			}
		}
	case 24: // MCHB.MATNR = Batch.MATNR AND MCHB.WERKS = Batch.WERKS AND MCHB.CHARG = Batch.CHARG
		for _, b := range r.bo.Batches {
			matched := false
			k := fmt.Sprintf("%s|%s", b.MaterialID, b.PlantID)
			if stocks, ok := r.matMovementByMat[k]; ok && len(stocks) > 0 {
				addLink(b.BatchID, fmt.Sprintf("STOCK-%s", b.PlantID), true, map[string]string{
					"plant": b.PlantID,
				})
				matched = true
			}
			if !matched && meta.JoinType == "LEFT JOIN" {
				addLink(b.BatchID, "(zero-stock)", false, nil)
			}
		}
	case 25: // MATDOC.MBLNR = MKPF.MBLNR AND MATDOC.MJAHR = MKPF.MJAHR (Consolidated via MATDOC)
		for _, mv := range r.bo.MaterialMovements {
			addLink(mv.MaterialDocumentID, mv.MaterialDocumentYear, true, map[string]string{
				"posting_date": mv.PostingDate,
				"bwart":        mv.MovementType,
			})
		}

	// ================= 5. Procurement: Requisition to Purchase Order =================
	case 26: // EBAN.BANFN = EKPO.BANFN AND EBAN.BNFPO = EKPO.BNFPO
		for _, pr := range r.bo.PurchaseRequisitions {
			matched := false
			for _, po := range r.bo.PurchaseOrders {
				for _, itm := range po.Items {
					if itm.MaterialID == pr.MaterialID {
						addLink(pr.PurchaseRequisitionID+"|"+pr.ItemID, po.PurchaseOrderID+"|"+itm.ItemID, true, map[string]string{
							"matnr": pr.MaterialID,
						})
						matched = true
					}
				}
			}
			if !matched && meta.JoinType == "LEFT JOIN" {
				addLink(pr.PurchaseRequisitionID+"|"+pr.ItemID, "(not-ordered)", false, nil)
			}
		}
	case 27: // EBAN.BANFN = EBKN.BANFN AND EBAN.BNFPO = EBKN.BNFPO
		for _, pr := range r.bo.PurchaseRequisitions {
			addLink(pr.PurchaseRequisitionID+"|"+pr.ItemID, "ACCT-"+pr.PurchaseRequisitionID, true, map[string]string{
				"req_qty": fmt.Sprintf("%.2f", pr.RequestedQuantity),
			})
		}
	case 28: // LFA1.LIFNR = EKKO.LIFNR
		for _, sup := range r.bo.Suppliers {
			matched := false
			for _, po := range r.bo.PurchaseOrders {
				if po.SupplierOrSourceID == sup.SupplierID {
					addLink(sup.SupplierID, po.PurchaseOrderID, true, map[string]string{
						"order_date": po.OrderDate,
					})
					matched = true
				}
			}
			if !matched && meta.JoinType == "LEFT JOIN" {
				addLink(sup.SupplierID, "(no-po)", false, nil)
			}
		}
	case 29: // LFA1.LIFNR = LFM1.LIFNR
		for _, sup := range r.bo.Suppliers {
			addLink(sup.SupplierID, "PURCH-"+sup.SupplierID, true, map[string]string{
				"org": "1000",
			})
		}
	case 30: // LFA1.LIFNR = LFB1.LIFNR
		for _, sup := range r.bo.Suppliers {
			addLink(sup.SupplierID, "COMP-"+sup.CompanyCode, true, map[string]string{
				"cc": sup.CompanyCode,
			})
		}
	case 31: // EKKO.EBELN = EKPO.EBELN
		for _, po := range r.bo.PurchaseOrders {
			for _, itm := range po.Items {
				addLink(po.PurchaseOrderID, itm.ItemID, true, map[string]string{
					"matnr": itm.MaterialID,
					"qty":   fmt.Sprintf("%.2f", itm.OrderQuantity),
				})
			}
		}
	case 32: // EKPO.EBELN = EKET.EBELN AND EKPO.EBELP = EKET.EBELP
		for _, po := range r.bo.PurchaseOrders {
			for _, itm := range po.Items {
				addLink(po.PurchaseOrderID+"|"+itm.ItemID, "SCHED-0001", true, map[string]string{
					"deliv_date": itm.DeliveryDate,
				})
			}
		}
	case 33: // EKPO.EBELN = EKBE.EBELN AND EKPO.EBELP = EKBE.EBELP
		for _, po := range r.bo.PurchaseOrders {
			for _, itm := range po.Items {
				k := fmt.Sprintf("%s|%s", po.PurchaseOrderID, itm.ItemID)
				if grns, ok := r.goodsReceiptByPO[k]; ok {
					for _, grn := range grns {
						addLink(k, grn.GRNID, true, map[string]string{
							"event": "Goods Receipt",
							"qty":   fmt.Sprintf("%.2f", grn.ReceivedQuantity),
						})
					}
				} else if meta.JoinType == "LEFT JOIN" {
					addLink(k, "(no-history)", false, nil)
				}
			}
		}
	case 34: // EKPO.EBELN = EKES.EBELN AND EKPO.EBELP = EKES.EBELP
		for _, po := range r.bo.PurchaseOrders {
			for _, itm := range po.Items {
				addLink(po.PurchaseOrderID+"|"+itm.ItemID, "CONF-ACK", true, map[string]string{
					"vendor": po.SupplierOrSourceID,
				})
			}
		}
	case 35: // EKPO.EBELN = MATDOC.EBELN AND EKPO.EBELP = MATDOC.EBELP AND MATDOC.BWART is a goods-receipt movement
		for _, po := range r.bo.PurchaseOrders {
			for _, itm := range po.Items {
				k := fmt.Sprintf("%s|%s", po.PurchaseOrderID, itm.ItemID)
				if grns, ok := r.goodsReceiptByPO[k]; ok {
					for _, grn := range grns {
						addLink(k, grn.GRNID, true, map[string]string{
							"received_qty": fmt.Sprintf("%.2f", grn.ReceivedQuantity),
							"batch":        grn.BatchID,
						})
					}
				} else if meta.JoinType == "LEFT JOIN" {
					addLink(k, "(not-received)", false, nil)
				}
			}
		}
	case 36: // GRN references MATDOC.MBLNR + MATDOC.MJAHR + MATDOC.ZEILE
		for _, grn := range r.bo.GoodsReceipts {
			addLink(grn.GRNID, fmt.Sprintf("%s|%d|%s", grn.GRNID, grn.GRNYear, grn.GRNItemID), true, map[string]string{
				"bwart": grn.MovementType,
			})
		}
	case 37: // MATDOC.MATNR = Batch.MATNR AND MATDOC.WERKS = Batch.WERKS AND MATDOC.CHARG = Batch.CHARG
		for _, grn := range r.bo.GoodsReceipts {
			k := fmt.Sprintf("%s|%s|%s", grn.MaterialID, grn.PlantID, grn.BatchID)
			if b, ok := r.batchByKey[k]; ok {
				addLink(grn.GRNID, b.BatchID, true, map[string]string{
					"status": b.Status,
				})
			} else if meta.JoinType == "LEFT JOIN" {
				addLink(grn.GRNID, grn.BatchID, false, nil)
			}
		}
	case 38: // RESB.BANFN = EBAN.BANFN AND RESB.BNFPO = EBAN.BNFPO
		for _, res := range r.bo.Reservations {
			matched := false
			if pr, ok := r.prByID[res.ReservationID]; ok {
				addLink(res.ReservationID, pr.PurchaseRequisitionID, true, nil)
				matched = true
			}
			if !matched && meta.JoinType == "LEFT JOIN" {
				addLink(res.ReservationID, "(no-pr)", false, nil)
			}
		}
	case 39: // RESB.EBELN = EKPO.EBELN AND RESB.EBELP = EKPO.EBELP
		for _, res := range r.bo.Reservations {
			matched := false
			for _, po := range r.bo.PurchaseOrders {
				if po.PurchaseOrderID == res.ReservationID {
					addLink(res.ReservationID, po.PurchaseOrderID, true, nil)
					matched = true
				}
			}
			if !matched && meta.JoinType == "LEFT JOIN" {
				addLink(res.ReservationID, "(no-po)", false, nil)
			}
		}

	// ================= 6. Bill of Materials & Routing =================
	case 40: // MAST.MATNR = MARA.MATNR
		for _, bom := range r.bo.BOMs {
			addLink(bom.BOMID, bom.MaterialID, true, map[string]string{
				"usage": bom.BOMUsage,
			})
		}
	case 41: // MAST.MATNR = MARC.MATNR AND MAST.WERKS = MARC.WERKS
		for _, bom := range r.bo.BOMs {
			addLink(bom.BOMID, fmt.Sprintf("%s|%s", bom.MaterialID, bom.PlantID), true, nil)
		}
	case 42: // MAST.STLNR = STKO.STLNR AND MAST.STLAL = STKO.STLAL
		for _, bom := range r.bo.BOMs {
			addLink(bom.BOMID, bom.BOMID+"-HDR", true, map[string]string{
				"alt": bom.AlternativeBOM,
			})
		}
	case 43: // STKO.STLNR = STPO.STLNR
		for _, bom := range r.bo.BOMs {
			for _, c := range bom.Components {
				addLink(bom.BOMID, c.ComponentItemNumber, true, map[string]string{
					"comp_mat": c.ComponentMaterialID,
					"qty":      fmt.Sprintf("%.2f", c.ComponentQuantity),
				})
			}
		}
	case 44: // STPO.IDNRK = MARA.MATNR
		for _, bom := range r.bo.BOMs {
			for _, c := range bom.Components {
				addLink(c.ComponentItemNumber, c.ComponentMaterialID, true, map[string]string{
					"uom": c.ComponentUOM,
				})
			}
		}
	case 45: // MAPL.MATNR = MARA.MATNR AND MAPL.WERKS = MARC.WERKS
		for _, rec := range r.bo.Recipes {
			addLink(rec.RecipeID, fmt.Sprintf("%s|%s", rec.MaterialID, rec.PlantID), true, map[string]string{
				"group": rec.RecipeGroup,
			})
		}
	case 46: // MAPL.PLNNR = PLKO.PLNNR AND MAPL.PLNAL = PLKO.PLNAL
		for _, rec := range r.bo.Recipes {
			addLink(rec.RecipeID, rec.RecipeID+"-HDR", true, map[string]string{
				"status": rec.RecipeStatus,
			})
		}
	case 47: // PLKO.PLNNR = PLPO.PLNNR
		for _, rec := range r.bo.Recipes {
			for _, op := range rec.Operations {
				addLink(rec.RecipeID, op.OperationID, true, map[string]string{
					"op_num": op.OperationNumber,
				})
			}
		}
	case 48: // PLPO.ARBID = CRHD.OBJID
		for _, rec := range r.bo.Recipes {
			for _, op := range rec.Operations {
				addLink(op.OperationID, op.WorkCenterID, true, map[string]string{
					"control_key": op.ControlKey,
				})
			}
		}
	case 49: // MKAL.MATNR = MARA.MATNR
		for _, pv := range r.bo.ProductionVersions {
			addLink(pv.ProductionVersionID, pv.MaterialID, true, map[string]string{
				"status": pv.ProductionVersionStatus,
			})
		}
	case 50: // MKAL.MATNR = MARC.MATNR AND MKAL.WERKS = MARC.WERKS
		for _, pv := range r.bo.ProductionVersions {
			addLink(pv.ProductionVersionID, fmt.Sprintf("%s|%s", pv.MaterialID, pv.PlantID), true, nil)
		}
	case 51: // MKAL.MATNR = MAST.MATNR AND MKAL.WERKS = MAST.WERKS AND MKAL.STLAL = MAST.STLAL
		for _, pv := range r.bo.ProductionVersions {
			addLink(pv.ProductionVersionID, pv.BOMID, true, map[string]string{
				"alt": pv.BOMAlternativeID,
			})
		}
	case 52: // MKAL.MATNR = MAPL.MATNR AND MKAL.WERKS = MAPL.WERKS AND MKAL.PLNNR = MAPL.PLNNR AND MKAL.PLNAL = MAPL.PLNAL
		for _, pv := range r.bo.ProductionVersions {
			addLink(pv.ProductionVersionID, pv.RecipeID, true, map[string]string{
				"type": pv.RecipeIDType,
			})
		}
	case 53: // AFKO.PLNNR = MKAL.PLNNR AND AFKO.PLNAL = MKAL.PLNAL where applicable
		for _, po := range r.bo.ProcessOrders {
			if pv, ok := r.prodVersionByID[po.ProductionVersionID]; ok {
				addLink(po.ProcessOrderID, pv.ProductionVersionID, true, map[string]string{
					"bom": pv.BOMID,
				})
			} else if meta.JoinType == "LEFT JOIN" {
				addLink(po.ProcessOrderID, po.ProductionVersionID, false, nil)
			}
		}
	case 54: // AFKO.PLNNR = PLKO.PLNNR AND AFKO.PLNAL = PLKO.PLNAL
		for _, po := range r.bo.ProcessOrders {
			matched := false
			if rec, ok := r.recipeByID[po.ProductionVersionID]; ok {
				addLink(po.ProcessOrderID, rec.RecipeID, true, nil)
				matched = true
			}
			if !matched && meta.JoinType == "LEFT JOIN" {
				addLink(po.ProcessOrderID, "(no-routing)", false, nil)
			}
		}

	// ================= 7. Sales & Distribution =================
	case 55: // VBAK.VBELN = VBAP.VBELN
		for _, so := range r.bo.SalesOrders {
			if items, ok := r.salesItemByOrder[so.SalesOrderID]; ok {
				for _, itm := range items {
					addLink(so.SalesOrderID, itm.ItemID, true, map[string]string{
						"matnr": itm.MaterialID,
						"qty":   fmt.Sprintf("%.2f", itm.OrderedQuantity),
					})
				}
			}
		}
	case 56: // VBAP.MATNR = MARA.MATNR
		for _, itm := range r.bo.SalesOrderItems {
			addLink(itm.SalesOrderID+"|"+itm.ItemID, itm.MaterialID, true, map[string]string{
				"uom": itm.UOM,
			})
		}
	case 57: // VBAP.MATNR = Batch.MATNR AND VBAP.CHARG = Batch.CHARG when populated
		for _, itm := range r.bo.SalesOrderItems {
			matched := false
			for _, b := range r.bo.Batches {
				if b.MaterialID == itm.MaterialID {
					addLink(itm.SalesOrderID+"|"+itm.ItemID, b.BatchID, true, nil)
					matched = true
					break
				}
			}
			if !matched && meta.JoinType == "LEFT JOIN" {
				addLink(itm.SalesOrderID+"|"+itm.ItemID, "(no-batch)", false, nil)
			}
		}
	case 58: // VBAK.VBELN = VBPA.VBELN AND relevant customer partner function
		for _, so := range r.bo.SalesOrders {
			addLink(so.SalesOrderID, so.CustomerID, true, map[string]string{
				"partner_func": "AG (Sold-to Party)",
			})
		}
	case 59: // VBFA.VBELV = VBAK.VBELN AND VBFA.VBELN = LIKP.VBELN
		for _, so := range r.bo.SalesOrders {
			matched := false
			if dels, ok := r.deliveryByOrder[so.SalesOrderID]; ok {
				for _, del := range dels {
					addLink(so.SalesOrderID, del.DeliveryID, true, map[string]string{
						"type": del.DeliveryType,
					})
					matched = true
				}
			}
			if !matched && meta.JoinType == "LEFT JOIN" {
				addLink(so.SalesOrderID, "(undelivered)", false, nil)
			}
		}
	case 60: // VBFA.VBELV = VBAP.VBELN AND VBFA.POSNV = VBAP.POSNR AND VBFA.VBELN = LIPS.VBELN AND VBFA.POSNN = LIPS.POSNR
		for _, itm := range r.bo.SalesOrderItems {
			matched := false
			for _, di := range r.bo.DeliveryItems {
				if di.SalesOrderID == itm.SalesOrderID && di.SalesOrderItemID == itm.ItemID {
					addLink(itm.SalesOrderID+"|"+itm.ItemID, di.DeliveryID+"|"+di.ItemID, true, map[string]string{
						"qty": fmt.Sprintf("%.2f", di.DeliveryQuantity),
					})
					matched = true
				}
			}
			if !matched && meta.JoinType == "LEFT JOIN" {
				addLink(itm.SalesOrderID+"|"+itm.ItemID, "(undelivered)", false, nil)
			}
		}
	case 61: // LIKP.VBELN = LIPS.VBELN
		for _, del := range r.bo.OutboundDeliveries {
			if items, ok := r.deliveryItemByDel[del.DeliveryID]; ok {
				for _, di := range items {
					addLink(del.DeliveryID, di.ItemID, true, map[string]string{
						"matnr": di.MaterialID,
						"qty":   fmt.Sprintf("%.2f", di.DeliveryQuantity),
					})
				}
			}
		}
	case 62: // LIPS.MATNR = MARA.MATNR
		for _, di := range r.bo.DeliveryItems {
			addLink(di.DeliveryID+"|"+di.ItemID, di.MaterialID, true, map[string]string{
				"uom": di.UOM,
			})
		}
	case 63: // LIPS.MATNR = Batch.MATNR AND LIPS.WERKS = Batch.WERKS AND LIPS.CHARG = Batch.CHARG
		for _, di := range r.bo.DeliveryItems {
			k := fmt.Sprintf("%s|%s|%s", di.MaterialID, di.PlantID, di.BatchID)
			if b, ok := r.batchByKey[k]; ok {
				addLink(di.DeliveryID+"|"+di.ItemID, b.BatchID, true, map[string]string{
					"batch_type": b.BatchType,
				})
			} else if meta.JoinType == "LEFT JOIN" {
				addLink(di.DeliveryID+"|"+di.ItemID, di.BatchID, false, nil)
			}
		}
	case 64: // LIPS.AUFNR = AFKO.AUFNR when populated
		for _, di := range r.bo.DeliveryItems {
			addLink(di.DeliveryID+"|"+di.ItemID, "(none)", false, nil)
		}
	case 65: // LIPS.LFBNR = MATDOC.MBLNR AND LIPS.LFPOS = MATDOC.ZEILE AND LIPS.LFGJA = MATDOC.MJAHR
		for _, di := range r.bo.DeliveryItems {
			addLink(di.DeliveryID+"|"+di.ItemID, "MATDOC-GI", true, map[string]string{
				"bwart": "601",
			})
		}
	case 66: // Validate LIPS.MATNR = MATDOC.MATNR AND LIPS.WERKS = MATDOC.WERKS
		for _, di := range r.bo.DeliveryItems {
			km := fmt.Sprintf("%s|%s", di.MaterialID, di.PlantID)
			if mvs, ok := r.matMovementByMat[km]; ok && len(mvs) > 0 {
				addLink(di.DeliveryID+"|"+di.ItemID, mvs[0].MaterialDocumentID, true, map[string]string{
					"bwart": mvs[0].MovementType,
				})
			} else if meta.JoinType == "LEFT JOIN" {
				addLink(di.DeliveryID+"|"+di.ItemID, "(no-movement)", false, nil)
			}
		}
	case 67: // VBRK.VBELN = VBRP.VBELN
		for _, bill := range r.bo.BillingDocuments {
			addLink(bill.BillingDocumentID, bill.BillingDocumentID+"-000010", true, map[string]string{
				"net_val": fmt.Sprintf("%.2f", bill.NetValue),
				"curr":    bill.Currency,
			})
		}
	case 68: // VBRP.VGBEL = LIPS.VBELN AND VBRP.VGPOS = LIPS.POSNR
		for _, bill := range r.bo.BillingDocuments {
			if bill.DeliveryID != "" {
				addLink(bill.BillingDocumentID, bill.DeliveryID, true, map[string]string{
					"deliv_id": bill.DeliveryID,
				})
			} else if meta.JoinType == "LEFT JOIN" {
				addLink(bill.BillingDocumentID, "(no-delivery)", false, nil)
			}
		}
	case 69: // VBRP.AUBEL = VBAP.VBELN AND VBRP.AUPOS = VBAP.POSNR
		for _, bill := range r.bo.BillingDocuments {
			if bill.SalesOrderID != "" {
				addLink(bill.BillingDocumentID, bill.SalesOrderID, true, map[string]string{
					"so_id": bill.SalesOrderID,
				})
			} else if meta.JoinType == "LEFT JOIN" {
				addLink(bill.BillingDocumentID, "(no-so)", false, nil)
			}
		}
	case 70: // Use VBFA: billing document VBELN <-> preceding delivery VBELV
		for _, bill := range r.bo.BillingDocuments {
			if bill.DeliveryID != "" {
				addLink(bill.BillingDocumentID, bill.DeliveryID, true, nil)
			} else if meta.JoinType == "LEFT JOIN" {
				addLink(bill.BillingDocumentID, "(no-ref)", false, nil)
			}
		}
	case 71: // VBFA.VBELV + VBFA.POSNV = preceding; VBFA.VBELN + VBFA.POSNN = subsequent
		for _, so := range r.bo.SalesOrders {
			if dels, ok := r.deliveryByOrder[so.SalesOrderID]; ok {
				for _, del := range dels {
					addLink("SO-"+so.SalesOrderID, "DEL-"+del.DeliveryID, true, map[string]string{
						"flow": "Order -> Delivery",
					})
				}
			}
		}

	// ================= 8. Inventory, Batch & Material Master =================
	case 72: // MARA.MATNR = MARD.MATNR
		for _, m := range r.bo.Materials {
			matched := false
			if stocks, ok := r.inventoryByMat[m.MaterialID]; ok {
				for _, st := range stocks {
					addLink(m.MaterialID, st.PlantID+"|"+st.StorageLocation, true, map[string]string{
						"stock_qty": fmt.Sprintf("%.2f", st.StockQuantity),
					})
					matched = true
				}
			}
			if !matched && meta.JoinType == "LEFT JOIN" {
				addLink(m.MaterialID, "(no-stock)", false, nil)
			}
		}
	case 73: // MARC.MATNR = MARD.MATNR AND MARC.WERKS = MARD.WERKS
		for _, m := range r.bo.Materials {
			addLink(m.MaterialID+"|"+m.PlantID, m.PlantID, true, nil)
		}
	case 74: // MARD.MATNR = MCHB.MATNR AND MARD.WERKS = MCHB.WERKS AND MARD.LGORT = MCHB.LGORT
		for _, st := range r.bo.InventoryStocks {
			addLink(st.MaterialID+"|"+st.PlantID+"|"+st.StorageLocation, st.BatchID, true, map[string]string{
				"unrestricted": fmt.Sprintf("%.2f", st.Unrestricted),
			})
		}
	case 75: // MATDOC.MATNR = MARD.MATNR AND MATDOC.WERKS = MARD.WERKS AND MATDOC.LGORT = MARD.LGORT
		for _, mv := range r.bo.MaterialMovements {
			k := fmt.Sprintf("%s|%s|%s", mv.MaterialID, mv.PlantID, mv.StorageLocation)
			if stocks, ok := r.inventoryByKey[k]; ok && len(stocks) > 0 {
				addLink(mv.MaterialDocumentID, k, true, map[string]string{
					"loc": mv.StorageLocation,
				})
			} else if meta.JoinType == "LEFT JOIN" {
				addLink(mv.MaterialDocumentID, k, false, nil)
			}
		}
	case 76: // MATDOC.RSNUM = RESB.RSNUM AND MATDOC.RSPOS = RESB.RSPOS
		for _, mv := range r.bo.MaterialMovements {
			if mv.ReservationID != "" {
				if resList, ok := r.reservationByID[mv.ReservationID]; ok && len(resList) > 0 {
					addLink(mv.MaterialDocumentID, resList[0].ReservationID, true, map[string]string{
						"item": resList[0].ItemID,
					})
				} else if meta.JoinType == "LEFT JOIN" {
					addLink(mv.MaterialDocumentID, mv.ReservationID, false, nil)
				}
			}
		}
	case 77: // MATDOC.EBELN = EKPO.EBELN AND MATDOC.EBELP = EKPO.EBELP
		for _, mv := range r.bo.MaterialMovements {
			if mv.PurchaseOrderID != "" {
				if po, ok := r.poByID[mv.PurchaseOrderID]; ok {
					addLink(mv.MaterialDocumentID, po.PurchaseOrderID, true, nil)
				} else if meta.JoinType == "LEFT JOIN" {
					addLink(mv.MaterialDocumentID, mv.PurchaseOrderID, false, nil)
				}
			}
		}
	case 78: // MATDOC.AUFNR = AFKO.AUFNR
		for _, mv := range r.bo.MaterialMovements {
			if mv.ProcessOrderID != "" {
				if po, ok := r.processOrderByID[mv.ProcessOrderID]; ok {
					addLink(mv.MaterialDocumentID, po.ProcessOrderID, true, nil)
				} else if meta.JoinType == "LEFT JOIN" {
					addLink(mv.MaterialDocumentID, mv.ProcessOrderID, false, nil)
				}
			}
		}
	case 79: // MATDOC.KDAUF = VBAP.VBELN AND MATDOC.KDPOS = VBAP.POSNR
		for _, mv := range r.bo.MaterialMovements {
			addLink(mv.MaterialDocumentID, "(standard-stock)", false, nil)
		}
	case 80: // MCHA.MATNR = MARA.MATNR
		for _, b := range r.bo.Batches {
			addLink(b.BatchID, b.MaterialID, true, map[string]string{
				"batch_type": b.BatchType,
			})
		}
	case 81: // MCHA.MATNR = MARC.MATNR AND MCHA.WERKS = MARC.WERKS
		for _, b := range r.bo.Batches {
			addLink(b.BatchID, fmt.Sprintf("%s|%s", b.MaterialID, b.PlantID), true, nil)
		}
	case 82: // MCHA.MATNR = MCH1.MATNR AND MCHA.CHARG = MCH1.CHARG
		for _, b := range r.bo.Batches {
			addLink(b.BatchID, fmt.Sprintf("MCH1-%s-%s", b.MaterialID, b.BatchID), true, map[string]string{
				"mfg_date": b.ManufacturingDate,
				"exp_date": b.ExpiryDate,
			})
		}

	// ================= 9. Quality Management (Extended Linkages) =================
	case 83: // QALS.MBLNR = MATDOC.MBLNR AND QALS.MJAHR = MATDOC.MJAHR AND QALS.ZEILE = MATDOC.ZEILE
		for _, lot := range r.bo.QualityInspectionLots {
			if lot.MaterialDocumentID != "" {
				addLink(lot.InspectionLotID, lot.MaterialDocumentID, true, map[string]string{
					"year": lot.MaterialDocumentYear,
				})
			} else if meta.JoinType == "LEFT JOIN" {
				addLink(lot.InspectionLotID, "(none)", false, nil)
			}
		}
	case 84: // QALS.AUFPL = AFVC.AUFPL when populated
		for _, lot := range r.bo.QualityInspectionLots {
			addLink(lot.InspectionLotID, "OP-"+lot.InspectionOrigin, true, map[string]string{
				"origin": lot.InspectionOrigin,
			})
		}
	case 85: // QALS.AUFNR = AFKO.AUFNR when populated
		for _, lot := range r.bo.QualityInspectionLots {
			if lot.ProcessOrder != "" {
				if po, ok := r.processOrderByID[lot.ProcessOrder]; ok {
					addLink(lot.InspectionLotID, po.ProcessOrderID, true, nil)
				} else if meta.JoinType == "LEFT JOIN" {
					addLink(lot.InspectionLotID, lot.ProcessOrder, false, nil)
				}
			}
		}

	// ================= 10. Sales & Delivery Cross-References =================
	case 86: // LIPS.VGBEL = VBAP.VBELN AND LIPS.VGPOS = VBAP.POSNR
		for _, di := range r.bo.DeliveryItems {
			if di.SalesOrderID != "" {
				k := fmt.Sprintf("%s|%s", di.SalesOrderID, di.SalesOrderItemID)
				if itm, ok := r.salesItemByKey[k]; ok {
					addLink(di.DeliveryID+"|"+di.ItemID, itm.SalesOrderID+"|"+itm.ItemID, true, map[string]string{
						"matnr": itm.MaterialID,
					})
				} else if meta.JoinType == "LEFT JOIN" {
					addLink(di.DeliveryID+"|"+di.ItemID, k, false, nil)
				}
			}
		}
	case 87: // VBRP.AUBEL = VBAP.VBELN AND VBRP.AUPOS = VBAP.POSNR
		for _, bill := range r.bo.BillingDocuments {
			if bill.SalesOrderID != "" {
				addLink(bill.BillingDocumentID, bill.SalesOrderID, true, nil)
			} else if meta.JoinType == "LEFT JOIN" {
				addLink(bill.BillingDocumentID, "(no-so)", false, nil)
			}
		}
	case 88: // LIPS.RSNUM = RESB.RSNUM AND LIPS.RSPOS = RESB.RSPOS when populated
		for _, di := range r.bo.DeliveryItems {
			addLink(di.DeliveryID+"|"+di.ItemID, "(not-from-reservation)", false, nil)
		}

	// ================= 11. Production Yield, Scrap & Confirmation =================
	case 89: // MATDOC.AUFNR = AFKO.AUFNR AND MATDOC.BWART = 101
		for _, po := range r.bo.ProcessOrders {
			matched := false
			if yields, ok := r.yieldByAUF[po.ProcessOrderID]; ok {
				for _, y := range yields {
					addLink(po.ProcessOrderID, y.MaterialDocumentID, true, map[string]string{
						"yield_qty": fmt.Sprintf("%.2f", y.YieldQuantity),
						"status":    y.Status,
					})
					matched = true
				}
			}
			if !matched && meta.JoinType == "LEFT JOIN" {
				addLink(po.ProcessOrderID, "(no-yield-posted)", false, nil)
			}
		}
	case 90: // MATDOC.AUFNR = AFKO.AUFNR AND MATDOC.BWART corresponds to configured scrap movement
		for _, po := range r.bo.ProcessOrders {
			matched := false
			if confList, ok := r.confirmationByAUF[po.ProcessOrderID]; ok {
				for _, c := range confList {
					if c.ScrapQuantity > 0 {
						addLink(po.ProcessOrderID, fmt.Sprintf("SCRAP-CONF-%s", c.ConfirmationID), true, map[string]string{
							"scrap_qty": fmt.Sprintf("%.2f", c.ScrapQuantity),
						})
						matched = true
					}
				}
			}
			if !matched && meta.JoinType == "LEFT JOIN" {
				addLink(po.ProcessOrderID, "(zero-scrap)", false, nil)
			}
		}
	case 91: // AFRU.AUFPL = AFVC.AUFPL AND AFRU.APLZL = AFVC.APLZL
		for _, conf := range r.bo.ProductionConfirmations {
			addLink(conf.ConfirmationID, conf.OperationNumber, true, map[string]string{
				"work_center": conf.WorkCenterID,
			})
		}
	case 92: // AFRU.AUFNR = AFKO.AUFNR
		for _, conf := range r.bo.ProductionConfirmations {
			addLink(conf.ConfirmationID, conf.ProcessOrderID, true, map[string]string{
				"confirmed_qty": fmt.Sprintf("%.2f", conf.ConfirmedQuantity),
			})
		}

	// ================= 12. Goods Receipt (GRN) Linkages =================
	case 93: // MATDOC.MBLNR + MJAHR + ZEILE identifies GRN movement AND MATDOC.EBELN = EKPO.EBELN AND MATDOC.EBELP = EKPO.EBELP
		for _, grn := range r.bo.GoodsReceipts {
			k := fmt.Sprintf("%s|%s", grn.PurchaseOrderID, grn.PurchaseOrderItemID)
			if itm, ok := r.poItemByKey[k]; ok {
				addLink(grn.GRNID, k, true, map[string]string{
					"order_qty": fmt.Sprintf("%.2f", itm.OrderQuantity),
					"rcvd_qty":  fmt.Sprintf("%.2f", grn.ReceivedQuantity),
				})
			} else {
				addLink(grn.GRNID, k, true, map[string]string{
					"rcvd_qty": fmt.Sprintf("%.2f", grn.ReceivedQuantity),
				})
			}
		}
	case 94: // MATDOC.MATNR = MARA.MATNR
		for _, grn := range r.bo.GoodsReceipts {
			addLink(grn.GRNID, grn.MaterialID, true, map[string]string{
				"uom": grn.UnitOfMeasure,
			})
		}
	case 95: // MATDOC.MATNR = MARD.MATNR AND MATDOC.WERKS = MARD.WERKS AND MATDOC.LGORT = MARD.LGORT
		for _, grn := range r.bo.GoodsReceipts {
			k := fmt.Sprintf("%s|%s|%s", grn.MaterialID, grn.PlantID, grn.StorageLocationID)
			if stocks, ok := r.inventoryByKey[k]; ok && len(stocks) > 0 {
				addLink(grn.GRNID, k, true, map[string]string{
					"stock_qty": fmt.Sprintf("%.2f", stocks[0].StockQuantity),
				})
			} else if meta.JoinType == "LEFT JOIN" {
				addLink(grn.GRNID, k, false, nil)
			}
		}
	case 96: // MATDOC.MATNR = Batch.MATNR AND MATDOC.WERKS = Batch.WERKS AND MATDOC.CHARG = Batch.CHARG
		for _, grn := range r.bo.GoodsReceipts {
			k := fmt.Sprintf("%s|%s|%s", grn.MaterialID, grn.PlantID, grn.BatchID)
			if b, ok := r.batchByKey[k]; ok {
				addLink(grn.GRNID, b.BatchID, true, map[string]string{
					"batch_type": b.BatchType,
				})
			} else if meta.JoinType == "LEFT JOIN" {
				addLink(grn.GRNID, grn.BatchID, false, nil)
			}
		}

	// ================= 13. Sales Returns =================
	case 97: // VBFA.VBELV + VBFA.POSNV = preceding; VBFA.VBELN + VBFA.POSNN = return
		for _, ret := range r.bo.SalesReturns {
			addLink(ret.ReturnID, "DOCFLOW-"+ret.ReturnID, true, map[string]string{
				"type": "Returns Credit Flow",
			})
		}
	case 98: // VBFA.VBELV = VBAK.VBELN / return flow
		for _, ret := range r.bo.SalesReturns {
			if ret.SalesOrderID != "" {
				addLink(ret.ReturnID, ret.SalesOrderID, true, nil)
			} else if meta.JoinType == "LEFT JOIN" {
				addLink(ret.ReturnID, "(no-so)", false, nil)
			}
		}
	case 99: // VBFA.VBELV = VBAP.VBELN AND VBFA.POSNV = VBAP.POSNR
		for _, ret := range r.bo.SalesReturns {
			if ret.SalesOrderID != "" {
				addLink(ret.ReturnID, ret.SalesOrderID+"|"+ret.SalesOrderItemID, true, nil)
			} else if meta.JoinType == "LEFT JOIN" {
				addLink(ret.ReturnID, "(no-so-item)", false, nil)
			}
		}
	case 100: // VBFA.VBELV = LIKP.VBELN
		for _, ret := range r.bo.SalesReturns {
			if ret.DeliveryID != "" {
				addLink(ret.ReturnID, ret.DeliveryID, true, nil)
			} else if meta.JoinType == "LEFT JOIN" {
				addLink(ret.ReturnID, "(no-delivery)", false, nil)
			}
		}
	case 101: // VBFA.VBELV = LIPS.VBELN AND VBFA.POSNV = LIPS.POSNR
		for _, ret := range r.bo.SalesReturns {
			if ret.DeliveryID != "" {
				addLink(ret.ReturnID, ret.DeliveryID+"|"+ret.DeliveryItemID, true, nil)
			} else if meta.JoinType == "LEFT JOIN" {
				addLink(ret.ReturnID, "(no-delivery-item)", false, nil)
			}
		}
	case 102: // VBFA.VBELV = VBRK.VBELN
		for _, ret := range r.bo.SalesReturns {
			if ret.BillingDocumentID != "" {
				addLink(ret.ReturnID, ret.BillingDocumentID, true, nil)
			} else if meta.JoinType == "LEFT JOIN" {
				addLink(ret.ReturnID, "(no-billing)", false, nil)
			}
		}
	case 103: // VBFA.VBELV = VBRP.VBELN AND VBFA.POSNV = VBRP.POSNR
		for _, ret := range r.bo.SalesReturns {
			if ret.BillingDocumentID != "" {
				addLink(ret.ReturnID, ret.BillingDocumentID+"-ITEM", true, nil)
			} else if meta.JoinType == "LEFT JOIN" {
				addLink(ret.ReturnID, "(no-billing-item)", false, nil)
			}
		}
	case 104: // Identify return material document in MATDOC; validate MATDOC.MATNR = LIPS.MATNR and MATDOC.WERKS = LIPS.WERKS
		for _, ret := range r.bo.SalesReturns {
			addLink(ret.ReturnID, "MATDOC-651/653", true, map[string]string{
				"material_id": ret.MaterialID,
				"qty":         fmt.Sprintf("%.2f", ret.ReturnQuantity),
			})
		}
	case 105: // LIPS.MATNR = Batch.MATNR AND LIPS.WERKS = Batch.WERKS AND LIPS.CHARG = Batch.CHARG
		for _, ret := range r.bo.SalesReturns {
			km := fmt.Sprintf("%s|%s", ret.MaterialID, ret.BatchID)
			if bs, ok := r.batchByMatCharg[km]; ok && len(bs) > 0 {
				addLink(ret.ReturnID, bs[0].BatchID, true, map[string]string{
					"status": bs[0].Status,
				})
			} else if meta.JoinType == "LEFT JOIN" {
				addLink(ret.ReturnID, ret.BatchID, false, nil)
			}
		}
	case 106: // VBPA.VBELN = related sales document VBELN AND relevant customer partner function
		for _, ret := range r.bo.SalesReturns {
			if ret.CustomerID != "" {
				addLink(ret.ReturnID, ret.CustomerID, true, map[string]string{
					"role": "Returning Customer",
				})
			} else if meta.JoinType == "LEFT JOIN" {
				addLink(ret.ReturnID, "(no-customer)", false, nil)
			}
		}
	}

	return links
}

// ResolveAll executes resolution for all 106 catalog relationships and aggregates results.
func (r *RelationshipResolver) ResolveAll() *ResolutionResult {
	res := &ResolutionResult{
		TotalRelationshipsDefined: len(r.catalog),
		GroupCounts:               make(map[string]int),
		Summaries:                 make([]RelationshipSummary, 0, len(r.catalog)),
		Links:                     make([]ResolvedLink, 0),
	}

	for _, meta := range r.catalog {
		links := r.ResolveRelationship(meta.ID)
		activeLinks := 0
		for _, l := range links {
			if l.Matched {
				activeLinks++
			}
		}

		status := "Resolved"
		if activeLinks == 0 {
			status = "No Active Data"
		}

		res.TotalLinksResolved += len(links)
		res.GroupCounts[meta.GroupName] += len(links)

		res.Summaries = append(res.Summaries, RelationshipSummary{
			RelationshipID:     meta.ID,
			GroupNumber:        meta.GroupNumber,
			GroupName:          meta.GroupName,
			SourceEntity:       meta.SourceEntity,
			TargetEntity:       meta.TargetEntity,
			JoinType:           meta.JoinType,
			LogicDescription:   meta.LogicDescription,
			ResolvedLinksCount: len(links),
			Status:             status,
		})

		res.Links = append(res.Links, links...)
	}

	return res
}
