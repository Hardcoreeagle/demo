package models

// BusinessObjectsContainer aggregates all independently built Business Objects
// allowing them to remain independent while enabling relationship resolution.
type BusinessObjectsContainer struct {
	PlanningRequirements      []PlanningRequirement      `json:"planning_requirements"`
	PlannedOrders             []PlannedOrder             `json:"planned_orders"`
	Materials                 []Material                 `json:"materials"`
	Batches                   []Batch                    `json:"batches"`
	Suppliers                 []SupplierOrSource         `json:"suppliers"`
	PurchaseRequisitions      []PurchaseRequisition      `json:"purchase_requisitions"`
	PurchaseOrders            []PurchaseOrder            `json:"purchase_orders"`
	MaterialMovements         []MaterialMovement         `json:"material_movements"`
	InventoryStocks           []InventoryStock           `json:"inventory_stocks"`
	Reservations              []Reservation              `json:"reservations"`
	ProcessOrders             []ProcessOrder             `json:"process_orders"`
	BOMs                      []BOM                      `json:"boms"`
	Recipes                   []Recipe                   `json:"recipes"`
	ProductionVersions        []ProductionVersion        `json:"production_versions"`
	BatchDeterminations       []BatchDetermination       `json:"batch_determinations"`
	MaterialConsumptions      []MaterialConsumption      `json:"material_consumptions"`
	ProductionConfirmations   []ProductionConfirmation   `json:"production_confirmations"`
	BatchTransformations      []BatchTransformation      `json:"batch_transformations"`
	Yields                    []Yield                    `json:"yields"`
	InspectionCharacteristics []InspectionCharacteristic `json:"inspection_characteristics"`
	InspectionPlans           []InspectionPlan           `json:"inspection_plans"`
	InspectionParameters      []InspectionParameter      `json:"inspection_parameters"`
	QualityInspectionLots     []QualityInspectionLot     `json:"quality_inspection_lots"`
	Samplings                 []Sampling                 `json:"samplings"`
	InspectionResults         []InspectionResult         `json:"inspection_results"`
	UsageDecisions            []UsageDecision            `json:"usage_decisions"`
	Customers                 []CustomerOrCFA            `json:"customers"`
	SalesOrders               []SalesOrder               `json:"sales_orders"`
	SalesOrderItems           []SalesOrderItem           `json:"sales_order_items"`
	SalesBatchAllocations     []SalesBatchAllocation     `json:"sales_batch_allocations"`
	OutboundDeliveries        []OutboundDelivery         `json:"outbound_deliveries"`
	DeliveryItems             []DeliveryItem             `json:"delivery_items"`
	BillingDocuments          []BillingDocument          `json:"billing_documents"`
	SalesReturns              []SalesReturn              `json:"sales_returns"`
	WorkCentres               []WorkCentre               `json:"work_centres"`
	GoodsReceipts             []GoodsReceipt             `json:"goods_receipts"`
}
