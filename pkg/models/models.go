package models

// 1. Planning Requirement
type PlanningRequirement struct {
	PlanningRequirementID string  `json:"planning_requirement_id"`
	MaterialID            string  `json:"material_id"`
	PlantID               string  `json:"plant_id"`
	RequirementQuantity   float64 `json:"requirement_quantity"`
	RequirementDate       string  `json:"requirement_date"`
	PlantName             string  `json:"plant_name"`
	UOM                   string  `json:"uom"`
	BOMRelatedInformation string  `json:"bom_related_information"`
}

// 2. Planned Order
type PlannedOrder struct {
	PlanOrderID     string  `json:"plan_order_id"`
	MaterialID      string  `json:"material_id"`
	PlantID         string  `json:"plant_id"`
	OrderQuantity   float64 `json:"order_quantity"`
	StartDate       string  `json:"start_date"`
	FinishDate      string  `json:"finish_date"`
	OrderType       string  `json:"order_type"`
	MaterialName    string  `json:"material_name"`
	ProcurementType string  `json:"procurement_type"`
	ProcessOrderID  string  `json:"process_order_id"`
	StorageLocation string  `json:"storage_location"`
}

// 3. Material
type Material struct {
	MaterialID          string `json:"material_id"`
	MaterialDescription string `json:"material_description"`
	MaterialType        string `json:"material_type"`
	PlantID             string `json:"plant_id"`
	UOM                 string `json:"uom"`
	Status              string `json:"status"`
	MaterialName        string `json:"material_name"`
}

// 4. Batch
type Batch struct {
	BatchID           string `json:"batch_id"`
	MaterialID        string `json:"material_id"`
	BatchType         string `json:"batch_type"`
	PlantID           string `json:"plant_id"`
	ManufacturingDate string `json:"manufacturing_date"`
	ExpiryDate        string `json:"expiry_date"`
	Status            string `json:"status"`
}

// 5. Supplier or Source
type SupplierOrSource struct {
	SupplierID    string `json:"supplier_id"`
	SourceName    string `json:"source_name"`
	SourceType    string `json:"source_type"`
	Country       string `json:"country"`
	Region        string `json:"region"`
	PostalCode    string `json:"postal_code"`
	AddressID     string `json:"address_id"`
	Email         string `json:"email"`
	Status        string `json:"status"`
	CompanyCode   string `json:"company_code"`
	Valid         string `json:"valid"`
	ApprovedOrNot string `json:"approved_or_not"`
	MaterialID    string `json:"material_id"`
}

// 6. Purchase Requisition
type PurchaseRequisition struct {
	PurchaseRequisitionID string  `json:"purchase_requisition_id"`
	ItemID                string  `json:"item_id"`
	MaterialID            string  `json:"material_id"`
	MaterialDescription   string  `json:"material_description"`
	PlantID               string  `json:"plant_id"`
	RequestedQuantity     float64 `json:"requested_quantity"`
	UOM                   string  `json:"uom"`
	RequestedDeliveryDate string  `json:"requested_delivery_date"`
	Requisitioner         string  `json:"requisitioner"`
}

// 7. Purchase Order Item
type PurchaseOrderItem struct {
	ItemID            string  `json:"item_id"`
	MaterialID        string  `json:"material_id"`
	Description       string  `json:"description"`
	OrderQuantity     float64 `json:"order_quantity"`
	PlantID           string  `json:"plant_id"`
	StorageLocationID string  `json:"storage_location_id"`
	DeliveryDate      string  `json:"delivery_date"`
	UOM               string  `json:"uom"`
	Price             float64 `json:"price"`
	Currency          string  `json:"currency"`
}

// 7. Purchase Order
type PurchaseOrder struct {
	PurchaseOrderID    string              `json:"purchase_order_id"`
	SupplierOrSourceID string              `json:"supplier_or_source_id"`
	CompanyCode        string              `json:"company_code"`
	OrderDate          string              `json:"order_date"`
	DocumentType       string              `json:"document_type"`
	Items              []PurchaseOrderItem `json:"item"`
}

// 8. Material Movement
type MaterialMovement struct {
	MaterialDocumentID   string  `json:"material_document_id"`
	MaterialDocumentYear string  `json:"material_document_year"`
	MovementType         string  `json:"movement_type"`
	MaterialID           string  `json:"material_id"`
	BatchID              string  `json:"batch_id"`
	StorageLocation      string  `json:"storage_location"`
	Quantity             float64 `json:"quantity"`
	UOM                  string  `json:"uom"`
	PostingDate          string  `json:"posting_date"`
	DocumentDate         string  `json:"document_date"`
	ReferenceDocumentID  string  `json:"reference_document_id"`
	PurchaseOrderID      string  `json:"purchase_order_id"`
	ProcessOrderID       string  `json:"process_order_id"`
	ReservationID        string  `json:"reservation_id"`
	PlantID              string  `json:"plant_id"`
}

// 9. Inventory/Stock
type InventoryStock struct {
	MaterialID        string  `json:"material_id"`
	PlantID           string  `json:"plant_id"`
	StorageLocation   string  `json:"storage_location"`
	UOM               string  `json:"uom"`
	StockStatus       string  `json:"stock_status"`
	BatchID           string  `json:"batch_id"`
	StockQuantity     float64 `json:"stock_quantity"`
	Unrestricted      float64 `json:"unrestricted"`
	QualityInspection float64 `json:"quality_inspection"`
	Blocked           float64 `json:"blocked"`
	Restricted        float64 `json:"restricted"`
	ReturnQuantity    float64 `json:"return"`
	InTransfer        float64 `json:"in_transfer"`
}

// 10. Reservation
type Reservation struct {
	ReservationID       string  `json:"reservation_id"`
	ItemID              string  `json:"item_id"`
	MaterialID          string  `json:"material_id"`
	PlantID             string  `json:"plant_id"`
	StorageLocation     string  `json:"storage_location"`
	ReservationQuantity float64 `json:"reservation_quantity"`
	UOM                 string  `json:"uom"`
	RequirementDate     string  `json:"requirement_date"`
	MovementType        string  `json:"movement_type"`
	ProcessOrderID      string  `json:"process_order_id"`
	BatchID             string  `json:"batch_id"`
	CostCentre          string  `json:"cost_centre"`
}

// 11. Process Order
type ProcessOrder struct {
	ProcessOrderID      string  `json:"process_order_id"`
	OrderType           string  `json:"order_type"`
	MaterialID          string  `json:"material_id"`
	PlantID             string  `json:"plant_id"`
	PlannedID           string  `json:"planned_id"`
	PlannedQuantity     float64 `json:"planned_quantity"`
	UOM                 string  `json:"uom"`
	BasicStartDate      string  `json:"basic_start_date"`
	BasicFinishDate     string  `json:"basic_finish_date"`
	ActualStartDate     string  `json:"actual_start_date"`
	ActualFinishDate    string  `json:"actual_finish_date"`
	Status              string  `json:"status"`
	ProductionVersionID string  `json:"production_version_id"`
	BatchID             string  `json:"batch_id"`
	Date                string  `json:"date"`
	ReservationID       string  `json:"reservation_id"`
}

// 12. BOM Component
type BOMComponent struct {
	ComponentMaterialID     string  `json:"component_material_id"`
	ComponentQuantity       float64 `json:"component_quantity"`
	ComponentUOM            string  `json:"component_uom"`
	ComponentItemNumber     string  `json:"component_item_number"`
	BOMCategory             string  `json:"bom_category"`
	ComponentScrapQuantity float64 `json:"component_scrap_quantity"`
}

// 12. BOM
type BOM struct {
	BOMID          string         `json:"bom_id"`
	MaterialID     string         `json:"material_id"`
	PlantID        string         `json:"plant_id"`
	BOMUsage       string         `json:"bom_usage"`
	BOMStatus      string         `json:"bom_status"`
	AlternativeBOM string         `json:"alternative_bom"`
	BaseQuantity   float64        `json:"base_quantity"`
	BaseUOM        string         `json:"base_uom"`
	Components     []BOMComponent `json:"components"`
}

// 13. Recipe Operation
type RecipeOperation struct {
	OperationID          string  `json:"operation_id"`
	OperationNumber      string  `json:"operation_number"`
	OperationDescription string  `json:"operation_description"`
	WorkCenterID         string  `json:"work_center_id"`
	ControlKey           string  `json:"control_key"`
	OperationQuantity    float64 `json:"operation_quantity"`
	UOM                  string  `json:"uom"`
	OperationSequence    string  `json:"operation_sequence"`
}

// 13. Recipe
type Recipe struct {
	RecipeID     string            `json:"recipe_id"`
	MaterialID   string            `json:"material_id"`
	PlantID      string            `json:"plant_id"`
	RecipeType   string            `json:"recipe_type"`
	RecipeGroup  string            `json:"recipe_group"`
	RecipeStatus string            `json:"recipe_status"`
	Operations   []RecipeOperation `json:"operations"`
}

// 14. Production Version
type ProductionVersion struct {
	ProductionVersionID     string `json:"production_version_id"`
	MaterialID              string `json:"material_id"`
	ProductionVersionStatus string `json:"production_version_status"`
	BOMID                   string `json:"bom_id"`
	RecipeID                string `json:"recipe_id"`
	ValidFrom               string `json:"valid_from"`
	ValidTo                 string `json:"valid_to"`
	PlantID                 string `json:"plant_id"`
	BOMAlternativeID        string `json:"bom_alternative_id"`
	RecipeIDType            string `json:"recipe_id_type"`
}

// 15. Batch Determination
type BatchDetermination struct {
	DeterminationID   string  `json:"determination_id"`
	MaterialID        string  `json:"material_id"`
	BatchID           string  `json:"batch_id"`
	ProcessOrderID    string  `json:"process_order_id"`
	Quantity          float64 `json:"quantity"`
	UOM               string  `json:"uom"`
	Status            string  `json:"status"`
	PlantID           string  `json:"plant_id"`
	StorageLocationID string  `json:"storage_location_id"`
	ReservationID     string  `json:"reservation_id"`
	ReservationItemID string  `json:"reservation_item_id"`
}

// 16. Material Consumption
type MaterialConsumption struct {
	MaterialDocumentID   string  `json:"material_document_id"`
	MaterialDocumentYear string  `json:"material_document_year"`
	ProcessOrderID       string  `json:"process_order_id"`
	BatchID              string  `json:"batch_id"`
	PlantID              string  `json:"plant_id"`
	StorageLocationID    string  `json:"storage_location_id"`
	ConsumedQuantity     float64 `json:"consumed_quantity"`
	UOM                  string  `json:"uom"`
	PostingDate          string  `json:"posting_date"`
	MovementType         string  `json:"movement_type"` // 261
	Status               string  `json:"status"`
	ReservationID        string  `json:"reservation_id"`
	ReservationItemID    string  `json:"reservation_item_id"`
	CostCentre           string  `json:"cost_centre"`
}

// 17. Production Confirmation
type ProductionConfirmation struct {
	ConfirmationID   string  `json:"confirmation_id"`
	ProcessOrderID   string  `json:"process_order_id"`
	OperationID      string  `json:"operation_id"`
	WorkCenterID     string  `json:"work_center_id"`
	ConfirmedQuantity float64 `json:"confirmed_quantity"`
	UOM              string  `json:"uom"`
	ConfirmationDate string  `json:"confirmation_date"`
	ConfirmationTime string  `json:"confirmation_time"`
	Status           string  `json:"status"`
	OperationNumber  string  `json:"operation_number"`
	ActualStartDate  string  `json:"actual_start_date"`
	ActualFinishDate string  `json:"actual_finish_date"`
	YieldQuantity    float64 `json:"yield_quantity"`
	ScrapQuantity    float64 `json:"scrap_quantity"`
}

// 18. Batch Transformation
type BatchTransformation struct {
	TransformationID   string  `json:"transformation_id"`
	ProcessOrderID     string  `json:"process_order_id"`
	InputBatchID       string  `json:"input_batch_id"`
	OutputBatchID      string  `json:"output_batch_id"`
	MaterialID         string  `json:"material_id"`
	TransformationType string  `json:"transformation_type"`
	Quantity           float64 `json:"quantity"`
	UOM                string  `json:"uom"`
	Status             string  `json:"status"`
	PlantID            string  `json:"plant_id"`
	TransformationDate string  `json:"transformation_date"`
}

// 19. Yield
type Yield struct {
	ProcessOrderID     string  `json:"process_order_id"`
	MasterID           string  `json:"master_id"`
	BatchID            string  `json:"batch_id"`
	MaterialDocumentID string  `json:"material_document_id"`
	YieldQuantity      float64 `json:"yield_quantity"`
	ScrapQuantity      float64 `json:"scrap_quantity"`
	UOM                string  `json:"uom"`
	PostingDate        string  `json:"posting_date"`
	Status             string  `json:"status"`
	YieldType          string  `json:"yield_type"`
	ScrapType          string  `json:"scrap_type"`
}

// 21. Inspection Characteristic
type InspectionCharacteristic struct {
	InspectionCharacteristicID   string  `json:"inspection_characteristic_id"`
	Description                  string  `json:"description"`
	PlantID                      string  `json:"plant_id"`
	UOM                          string  `json:"uom"`
	LowerSpecificationLimit      float64 `json:"lower_specification_limit"`
	UpperSpecificationLimit      float64 `json:"upper_specification_limit"`
	TargetValue                  float64 `json:"target_value"`
	Status                       string  `json:"status"`
	InspectionCharacteristicName string  `json:"inspection_characteristic_name"`
	MaterialID                   string  `json:"material_id"`
	CharacteristicsType          string  `json:"characteristics_type"`
	InspectionMethod             string  `json:"inspection_method"`
}

// 22. Inspection Plan Operation
type InspectionPlanOperation struct {
	OperationID                string `json:"operation_id"`
	OperationNumber            string `json:"operation_number"`
	Description                string `json:"description"`
	Group                      string `json:"group"`
	WorkCenterID               string `json:"work_center_id"`
	InspectionCharacteristicID string `json:"inspection_characteristic_id"`
}

// 22. Inspection Plan
type InspectionPlan struct {
	InspectionPlanID string                    `json:"inspection_plan_id"`
	MaterialID       string                    `json:"material_id"`
	PlantID          string                    `json:"plant_id"`
	PlanGroup        string                    `json:"plan_group"`
	PlanUsage        string                    `json:"plan_usage"`
	Status           string                    `json:"status"`
	Operations       []InspectionPlanOperation `json:"operations"`
}

// 23. Inspection Parameter
type InspectionParameter struct {
	ParameterID                string `json:"parameter_id"`
	MaterialID                 string `json:"material_id"`
	PlantID                    string `json:"plant_id"`
	InspectionType             string `json:"inspection_type"`
	InspectionParameter        string `json:"inspection_parameter"`
	ParameterValue             string `json:"parameter_value"`
	UOM                        string `json:"uom"`
	Status                     string `json:"status"`
	InspectionCharacteristicID string `json:"inspection_characteristic_id"`
	InspectionMethod           string `json:"inspection_method"`
	SamplingProcedure          string `json:"sampling_procedure"`
}

// 24. Quality Inspection Lot
type QualityInspectionLot struct {
	InspectionLotID          string  `json:"inspection_lot_id"`
	MaterialID               string  `json:"material_id"`
	BatchID                  string  `json:"batch_id"`
	PlantID                  string  `json:"plant_id"`
	InspectionOrigin         string  `json:"inspection_origin"`
	Quantity                 float64 `json:"quantity"`
	CreationDate             string  `json:"creation_date"`
	InspectionStartDate      string  `json:"inspection_start_date"`
	InspectionCompletionDate string  `json:"inspection_completion_date"`
	Status                   string  `json:"status"`
	InspectionType           string  `json:"inspection_type"`
	InspectionQuantity       float64 `json:"inspection_quantity"`
	PurchaseOrderID          string  `json:"purchase_order_id"`
	PurchaseOrderItemID      string  `json:"purchase_order_item_id"`
	UOM                      string  `json:"uom"`
	SupplierID               string  `json:"supplier_id"`
	ProcessOrder             string  `json:"process_order"`
	MaterialDocumentID       string  `json:"material_document_id"`
	MaterialDocumentYear     string  `json:"material_document_year"`
	InspectionPlanID         string  `json:"inspection_plan_id"`
	ProductionVersionID      string  `json:"production_version_id"`
	SampleQuantity           float64 `json:"sample_quantity"`
}

// 25. Sampling
type Sampling struct {
	SampleID       string  `json:"sample_id"`
	InspectionLotID string  `json:"inspection_lot_id"`
	MaterialID     string  `json:"material_id"`
	BatchID        string  `json:"batch_id"`
	SampleQuantity float64 `json:"sample_quantity"`
	SampleUOM      string  `json:"sample_uom"`
	SampleDate     string  `json:"sample_date"`
	Status         string  `json:"status"`
}

// 26. Inspection Result
type InspectionResult struct {
	InspectionResultID         string  `json:"inspection_result_id"`
	InspectionLotID            string  `json:"inspection_lot_id"`
	SampleID                   string  `json:"sample_id"`
	MaterialID                 string  `json:"material_id"`
	BatchID                    string  `json:"batch_id"`
	InspectionCharacteristicID string  `json:"inspection_characteristic_id"`
	ResultValue                string  `json:"result_value"`
	UOM                        string  `json:"uom"`
	ResultStatus               string  `json:"result_status"`
	RecordDate                 string  `json:"record_date"`
}

// 27. Usage Decision
type UsageDecision struct {
	UsageDecisionID string `json:"usage_decision_id"`
	InspectionLotID string `json:"inspection_lot_id"`
	MaterialID      string `json:"material_id"`
	BatchID         string `json:"batch_id"`
	PlantID         string `json:"plant_id"`
	DecisionCode    string `json:"decision_code"`
	DecisionStatus  string `json:"decision_status"`
	DecisionDate    string `json:"decision_date"`
}

// 28. Customer or CFA
type CustomerOrCFA struct {
	CustomerID    string `json:"customer_id"`
	CustomerName  string `json:"customer_name"`
	CustomerType  string `json:"customer_type"`
	CustomerGroup string `json:"customer_group"`
	Country       string `json:"country"`
	Region        string `json:"region"`
	PostalCode    string `json:"postal_code"`
	AddressID     string `json:"address_id"`
	Email         string `json:"email"`
	Status        string `json:"status"`
	CompanyCode   string `json:"company_code"`
}

// 29. Sales Order
type SalesOrder struct {
	SalesOrderID        string `json:"sales_order_id"`
	OrderType           string `json:"order_type"`
	CustomerID          string `json:"customer_id"`
	CompanyCode         string `json:"company_code"`
	OrderDate           string `json:"order_date"`
	RequestDeliveryDate string `json:"request_delivery_date"`
	Currency            string `json:"currency"`
	Status              string `json:"status"`
}

// 30. Sales Order Item
type SalesOrderItem struct {
	SalesOrderID          string  `json:"sales_order_id"`
	ItemID                string  `json:"item_id"`
	MaterialID            string  `json:"material_id"`
	OrderedQuantity       float64 `json:"ordered_quantity"`
	UOM                   string  `json:"uom"`
	RequestedDeliveryDate string  `json:"requested_delivery_date"`
	ConfirmedQuantity     float64 `json:"confirmed_quantity"`
	ConfirmedDeliveryDate string  `json:"confirmed_delivery_date"`
	Status                string  `json:"status"`
}

// 31. Sales Batch Allocation
type SalesBatchAllocation struct {
	SalesOrderID     string `json:"sales_order_id"`
	SalesOrderItemID string `json:"sales_order_item_id"`
	DeliveryID       string `json:"delivery_id"`
	DeliveryItemID   string `json:"delivery_item_id"`
	MaterialID       string `json:"material_id"`
	BatchID          string `json:"batch_id"`
	AllocatedStatus  string `json:"allocated_status"`
}

// 32. Outbound Delivery
type OutboundDelivery struct {
	DeliveryID           string `json:"delivery_id"`
	SalesOrderID         string `json:"sales_order_id"`
	CustomerID           string `json:"customer_id"`
	DeliveryType         string `json:"delivery_type"`
	DeliveryDate         string `json:"delivery_date"`
	PlannedGoodsIssueDate string `json:"planned_goods_issue_date"`
	ActualGoodsIssueDate string `json:"actual_goods_issue_date"`
	Status               string `json:"status"`
}

// 33. Delivery Item
type DeliveryItem struct {
	DeliveryID       string  `json:"delivery_id"`
	ItemID           string  `json:"item_id"`
	SalesOrderID     string  `json:"sales_order_id"`
	SalesOrderItemID string  `json:"sales_order_item_id"`
	MaterialID       string  `json:"material_id"`
	BatchID          string  `json:"batch_id"`
	DeliveryQuantity float64 `json:"delivery_quantity"`
	UOM              string  `json:"uom"`
	PlantID          string  `json:"plant_id"`
	StorageLocationID string  `json:"storage_location_id"`
	Status           string  `json:"status"`
}

// 34. Billing Document
type BillingDocument struct {
	BillingDocumentID string  `json:"billing_document_id"`
	BillingType       string  `json:"billing_type"`
	CustomerID        string  `json:"customer_id"`
	SalesOrderID      string  `json:"sales_order_id"`
	DeliveryID        string  `json:"delivery_id"`
	BillingDate       string  `json:"billing_date"`
	Currency          string  `json:"currency"`
	NetValue          float64 `json:"net_value"`
	TaxValue          float64 `json:"tax_value"`
	GrossValue        float64 `json:"gross_value"`
	Status            string  `json:"status"`
}

// 35. Sales Return
type SalesReturn struct {
	ReturnID          string  `json:"return_id"`
	SalesOrderID      string  `json:"sales_order_id"`
	SalesOrderItemID  string  `json:"sales_order_item_id"`
	DeliveryID        string  `json:"delivery_id"`
	DeliveryItemID    string  `json:"delivery_item_id"`
	BillingDocumentID string  `json:"billing_document_id"`
	CustomerID        string  `json:"customer_id"`
	MaterialID        string  `json:"material_id"`
	BatchID           string  `json:"batch_id"`
	ReturnQuantity    float64 `json:"return_quantity"`
	UOM               string  `json:"uom"`
	ReturnDate        string  `json:"return_date"`
}

// 36. Work Centre
type WorkCentre struct {
	WorkCentreID       string `json:"work_centre_id"`
	WorkCentreName     string `json:"work_centre_name"`
	PlantID            string `json:"plant_id"`
	WorkCentreCategory string `json:"work_centre_category"`
	ValidFrom          string `json:"valid_from"`
	ValidTo            string `json:"valid_to"`
	CapacityID         string `json:"capacity_id"`
	CostCentre         string `json:"cost_centre"`
	Location           string `json:"location"`
}

// GRN (GoodsReceipt) - Exact JSON schema requested by user
type GoodsReceipt struct {
	GRNID               string  `json:"grn_id"`
	GRNYear             int     `json:"grn_year"`
	GRNItemID           string  `json:"grn_item_id"`
	MaterialID          string  `json:"material_id"`
	PlantID             string  `json:"plant_id"`
	StorageLocationID   string  `json:"storage_location_id"`
	BatchID             string  `json:"batch_id"`
	ReceivedQuantity    float64 `json:"received_quantity"`
	UnitOfMeasure       string  `json:"unit_of_measure"`
	MovementType        string  `json:"movement_type"`
	PurchaseOrderID     string  `json:"purchase_order_id"`
	PurchaseOrderItemID string  `json:"purchase_order_item_id"`
	SupplierID          string  `json:"supplier_id"`
	PostingDate         string  `json:"posting_date"`
	DocumentDate        string  `json:"document_date"`
	StockType           string  `json:"stock_type"`
	DeliveryCompleted   bool    `json:"delivery_completed"`
}
