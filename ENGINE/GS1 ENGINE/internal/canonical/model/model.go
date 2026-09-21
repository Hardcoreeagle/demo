// Package model defines the Go representation of the Canonical Model output
// produced by the upstream canonical model builder. The GS1 Engine consumes
// this data as-is; it never reconstructs SAP extraction or joins.
package model

import (
	"encoding/json"
	"time"
)

// SourceFile records which canonical file an event came from.
type SourceFile string

const (
	// SourceBusinessEvents marks events loaded from the primary event stream.
	SourceBusinessEvents SourceFile = "business_events.json"
	// SourceGenealogyContext marks events loaded from the contextual genealogy file.
	SourceGenealogyContext SourceFile = "finished_batch_genealogy.json"
)

// CanonicalEvent is one normalized business event from business_events.json.
// Pointer fields are used where the canonical JSON omits the field entirely.
type CanonicalEvent struct {
	EventID        string
	EventName      string
	BusinessObject string
	EntityKey      string

	BatchID        *string
	ProcessOrderID *string
	MaterialID     *string
	PlantID        *string

	Timestamp    time.Time // zero Time when the canonical event has no timestamp
	TimestampSet bool
	Status       string
	MovementType *string
	Description  *string
}

// GenealogyEvent is an event_type entry attached to a canonical business object
// in finished_batch_genealogy.json. These entries describe the lifecycle of the
// object and carry no independent physical detail.
type GenealogyEvent struct {
	EventType string `json:"event_type"`
}

// ConsumedBatch is a per-batch consumption line attached to a process order or
// batch transformation in the canonical genealogy context.
type ConsumedBatch struct {
	BatchID             string   `json:"batch_id"`
	MaterialID          string   `json:"material_id"`
	MaterialDescription string   `json:"material_description"`
	Stage               string   `json:"stage"`
	ConsumedQuantity    *float64 `json:"consumed_quantity"`
	UOM                 string   `json:"uom"`
}

// ProducedProduct is the output product line of a canonical process order or
// batch transformation.
type ProducedProduct struct {
	BatchID             string   `json:"batch_id"`
	MaterialID          string   `json:"material_id"`
	MaterialDescription string   `json:"material_description"`
	Stage               string   `json:"stage"`
	ProducedQuantity    *float64 `json:"produced_quantity"`
	UOM                 string   `json:"uom"`
}

// CanonicalRelationship is a resolved relationship supplied by the Canonical
// Model. The GS1 Engine consumes these instead of reconstructing SAP joins.
type CanonicalRelationship struct {
	From         string   `json:"from"`
	To           string   `json:"to"`
	Relationship string   `json:"relationship"`
	JoinFields   []string `json:"join_fields"`
}

// TransformationStage is one stage of a multi-stage canonical batch
// transformation (e.g. stage 1 raw->core, stage 2 core->finished).
type TransformationStage struct {
	StageNumber      int      `json:"stage_number"`
	StageName        string   `json:"stage_name"`
	ProcessOrderID   string   `json:"process_order_id"`
	InputBatches     []string `json:"input_batches"`
	OutputBatch      string   `json:"output_batch"`
	MaterialID       string   `json:"material_id"`
	MaterialType     string   `json:"material_type"`
	QuantityProduced *float64 `json:"quantity_produced"`
	UOM              string   `json:"uom"`
	Status           string   `json:"status"`
}

// BatchTransformation is the canonical batch transformation object. It is the
// authoritative input/output batch resolution for production TransformationEvents.
type BatchTransformation struct {
	TransformationID     string                `json:"transformation_id"`
	ProcessOrderID       string                `json:"process_order_id"`
	InputBatchID         string                `json:"input_batch_id"`
	OutputBatchID        string                `json:"output_batch_id"`
	MaterialID           string                `json:"Material_id"`
	TransformationType   string                `json:"transformation_type"`
	Quantity             *float64              `json:"quantity"`
	UOM                  string                `json:"UOM"`
	Status               string                `json:"status"`
	InputBatches         []string              `json:"input_batches"`
	OutputBatches        []string              `json:"output_batches"`
	ConsumedBatches      []ConsumedBatch       `json:"consumed_batches"`
	ProducedProduct      *ProducedProduct      `json:"produced_product"`
	TransformationStages []TransformationStage `json:"transformation_stages"`
	Events               []GenealogyEvent      `json:"events"`
}

// ProcessOrderFull is the canonical process order object, including the
// resolved input/output batch lists and consumption lines.
type ProcessOrderFull struct {
	ProcessOrderID   string           `json:"process_order_id"`
	OrderType        string           `json:"order_type"`
	MaterialID       string           `json:"Material_id"`
	PlantID          string           `json:"Plant_id"`
	PlannedID        string           `json:"planned_id"`
	PlannedQuantity  *float64         `json:"planned_quantity"`
	UOM              string           `json:"UOM"`
	Status           string           `json:"status"`
	BasicStartDate   string           `json:"basic_start_date"`
	BasicFinishDate  string           `json:"basic_finish_date"`
	ActualStartDate  string           `json:"actual_start_date"`
	ActualFinishDate string           `json:"actual_finish_date"`
	InputBatches     []string         `json:"input_batches"`
	OutputBatches    []string         `json:"output_batches"`
	ConsumedBatches  []ConsumedBatch  `json:"consumed_batches"`
	ProducedProduct  *ProducedProduct `json:"produced_product"`
	Events           []GenealogyEvent `json:"events"`
}

// MaterialConsumptionFull is the canonical material consumption object
// (movement type 261 consumption against a process order).
type MaterialConsumptionFull struct {
	MaterialDocumentID   string           `json:"Material_document_id"`
	MaterialDocumentYear string           `json:"material_document_year"`
	ProcessOrderID       string           `json:"process_order_id"`
	BatchID              string           `json:"Batch_id"`
	PlantID              string           `json:"Plant_id"`
	StorageLocation      string           `json:"storage_location_id"`
	ConsumedQuantity     *float64         `json:"consumed_quantity"`
	UOM                  string           `json:"UOM"`
	PostingDate          string           `json:"posting_date"`
	MovementType         string           `json:"movement_type"`
	Status               string           `json:"status"`
	Events               []GenealogyEvent `json:"events"`
}

// YieldFull is the canonical production yield object.
type YieldFull struct {
	ProcessOrderID     string           `json:"Process_order_id"`
	MaterialID         string           `json:"master_id"`
	BatchID            string           `json:"Batch_id"`
	MaterialDocumentID string           `json:"material_document_id"`
	YieldQuantity      *float64         `json:"yield_quantity"`
	ScrapQuantity      *float64         `json:"scrap_quantity"`
	UOM                string           `json:"UOM"`
	PostingDate        string           `json:"posting_date"`
	Status             string           `json:"status"`
	Events             []GenealogyEvent `json:"events"`
}

// InspectionLotFull is the canonical quality inspection lot.
type InspectionLotFull struct {
	InspectionLotID  string           `json:"inspection_lot_id"`
	MaterialID       string           `json:"Material_id"`
	BatchID          string           `json:"Batch_id"`
	PlantID          string           `json:"Plant_id"`
	InspectionOrigin string           `json:"inspection_origin"`
	Quantity         *float64         `json:"quantity"`
	CreationDate     string           `json:"Creation_date"`
	InspectionStart  string           `json:"inspection_start_date"`
	InspectionEnd    string           `json:"inspection_completion_date"`
	Status           string           `json:"status"`
	Events           []GenealogyEvent `json:"events"`
}

// UsageDecisionFull is the canonical quality usage decision.
type UsageDecisionFull struct {
	UsageDecisionID string           `json:"usage_decision_id"`
	InspectionLotID string           `json:"inspection_lot_id"`
	MaterialID      string           `json:"Material_id"`
	BatchID         string           `json:"Batch_id"`
	PlantID         string           `json:"Plant_id"`
	DecisionCode    string           `json:"decision_code"`
	DecisionStatus  string           `json:"desion_status"`
	DecisionDate    string           `json:"decison_date"`
	Events          []GenealogyEvent `json:"events"`
}

// SalesReturnFull is the canonical sales return object.
type SalesReturnFull struct {
	ReturnID          string           `json:"return_id"`
	SalesOrderID      string           `json:"sales_order_id"`
	SalesOrderItemID  string           `json:"sales_order_item_id"`
	DeliveryID        string           `json:"delivery_id"`
	DeliveryItemID    string           `json:"delivery_item_id"`
	BillingDocumentID string           `json:"billing_document_id"`
	CustomerID        string           `json:"customer_id"`
	MaterialID        string           `json:"Material_id"`
	BatchID           string           `json:"batch_id"`
	ReturnQuantity    *float64         `json:"return_quantity"`
	UOM               string           `json:"UOM"`
	ReturnDate        string           `json:"return_date"`
	Status            string           `json:"status"`
	Events            []GenealogyEvent `json:"events"`
}

// SalesBatchAllocationFull is the canonical batch allocation for a sales item.
type SalesBatchAllocationFull struct {
	SalesOrderID     string           `json:"sales_order_id"`
	SalesOrderItemID string           `json:"sales_order_item_id"`
	DeliveryID       string           `json:"delivery_id"`
	DeliveryItemID   string           `json:"delivery_item_id"`
	MaterialID       string           `json:"Material_id"`
	BatchID          string           `json:"Batch_id"`
	AllocatedStatus  string           `json:"allocated_status"`
	Events           []GenealogyEvent `json:"events"`
}

// DeliveryItemFull is the canonical delivery item with batch reference.
type DeliveryItemFull struct {
	DeliveryID       string           `json:"delivery_id"`
	ItemID           string           `json:"item_id"`
	SalesOrderID     string           `json:"sales_order_id"`
	SalesOrderItemID string           `json:"sales_order_item_id"`
	MaterialID       string           `json:"Material_id"`
	BatchID          string           `json:"Batch_id"`
	DeliveryQuantity *float64         `json:"delivery_quantity"`
	UOM              string           `json:"UOM"`
	PlantID          string           `json:"plant_id"`
	StorageLocation  string           `json:"storage_location_id"`
	Status           string           `json:"status"`
	Events           []GenealogyEvent `json:"events"`
}

// OutboundDeliveryFull is the canonical outbound delivery header.
type OutboundDeliveryFull struct {
	DeliveryID        string           `json:"delivery_id"`
	SalesOrderID      string           `json:"sales_order_id"`
	CustomerID        string           `json:"customer_id"`
	DeliveryType      string           `json:"delivery_type"`
	DeliveryDate      string           `json:"delivery_date"`
	PlannedGoodsIssue string           `json:"planned_goods_issue_date"`
	ActualGoodsIssue  string           `json:"actual_goods_issue_date"`
	Status            string           `json:"status"`
	Events            []GenealogyEvent `json:"events"`
}

// SalesOrderFull is the canonical sales order header.
type SalesOrderFull struct {
	SalesOrderID        string           `json:"sales_order_id"`
	OrderType           string           `json:"order_type"`
	CustomerID          string           `json:"Customer_id"`
	CompanyCode         string           `json:"company_code"`
	OrderDate           string           `json:"order_date"`
	RequestDeliveryDate string           `json:"request_delivery_date"`
	Currency            string           `json:"currency"`
	Status              string           `json:"status"`
	Events              []GenealogyEvent `json:"events"`
}

// SalesOrderItemFull is the canonical sales order item.
type SalesOrderItemFull struct {
	SalesOrderID      string           `json:"sales_order_id"`
	ItemID            string           `json:"item_id"`
	MaterialID        string           `json:"Material_id"`
	OrderedQuantity   *float64         `json:"ordered_quantity"`
	UOM               string           `json:"UOM"`
	RequestedDelivery string           `json:"requested_delevery_date"`
	ConfirmedQuantity *float64         `json:"confirmed_quantity"`
	ConfirmedDelivery string           `json:"confirmed_delevery_date"`
	Status            string           `json:"status"`
	Events            []GenealogyEvent `json:"events"`
}

// BillingDocumentFull is the canonical billing document.
type BillingDocumentFull struct {
	BillingDocumentID string           `json:"billing_document_id"`
	BillingType       string           `json:"billing_type"`
	CustomerID        string           `json:"coustomer_id"`
	SalesOrderID      string           `json:"sales_order_id"`
	DeliveryID        string           `json:"delivery_id"`
	BillingDate       string           `json:"billing_date"`
	Currency          string           `json:"currency"`
	NetValue          *float64         `json:"net_value"`
	Status            string           `json:"status"`
	Events            []GenealogyEvent `json:"events"`
}

// BatchFull is the canonical batch master object.
type BatchFull struct {
	BatchID           string           `json:"batch_id"`
	MaterialID        string           `json:"material_id"`
	BatchType         string           `json:"batch_type"`
	PlantID           string           `json:"Plant_id"`
	ManufacturingDate string           `json:"Manufacturing_date"`
	ExpiryDate        string           `json:"expiery_date"`
	Status            string           `json:"status"`
	Events            []GenealogyEvent `json:"events"`
}

// MaterialFull is the canonical material master object.
type MaterialFull struct {
	MaterialID          string           `json:"material_id"`
	MaterialDescription string           `json:"material_description"`
	MaterialType        string           `json:"material_type"`
	PlantID             string           `json:"plant_id"`
	UOM                 string           `json:"UOM"`
	Status              string           `json:"status"`
	Events              []GenealogyEvent `json:"events"`
}

// SupplierFull is the canonical supplier/source object.
type SupplierFull struct {
	SupplierID  string           `json:"Supplier_or_Source_id"`
	Name        string           `json:"Source_Name"`
	SourceType  string           `json:"Source_type"`
	Country     string           `json:"Country"`
	Region      string           `json:"region"`
	PostalCode  string           `json:"postal_code"`
	AddressID   string           `json:"address_id"`
	Email       string           `json:"email"`
	Status      string           `json:"status"`
	CompanyCode string           `json:"Company_code"`
	Events      []GenealogyEvent `json:"events"`
}

// CustomerFull is the canonical customer object.
type CustomerFull struct {
	CustomerID    string           `json:"Customer_id"`
	Name          string           `json:"customer_name"`
	CustomerType  string           `json:"customer_type"`
	CustomerGroup string           `json:"customer_group"`
	Country       string           `json:"country"`
	Region        string           `json:"region"`
	PostalCode    string           `json:"postal_code"`
	AddressID     string           `json:"address_id"`
	Email         string           `json:"email"`
	Status        string           `json:"status"`
	CompanyCode   string           `json:"company_code"`
	Events        []GenealogyEvent `json:"events"`
}

// PurchaseOrderFull is the canonical purchase order with its item.
type PurchaseOrderFull struct {
	PurchaseOrderID string `json:"purchase_order_id"`
	SupplierID      string `json:"Supplier_or_Source_id"`
	CompanyCode     string `json:"Company_code"`
	OrderDate       string `json:"order_date"`
	DocumentType    string `json:"document_type"`
	Item            struct {
		ItemID          string   `json:"item_id"`
		MaterialID      string   `json:"material_id"`
		Description     string   `json:"description"`
		OrderQuantity   *float64 `json:"order_quantity"`
		PlantID         string   `json:"plant_id"`
		StorageLocation string   `json:"storage_location_id"`
		DeliveryDate    string   `json:"delevery_date"`
		UOM             string   `json:"UOM"`
	} `json:"item"`
	Events []GenealogyEvent `json:"events"`
}

// MaterialMovementFull is the canonical goods receipt material movement
// (movement type 101 against a purchase order).
type MaterialMovementFull struct {
	MaterialDocumentID   string           `json:"material_document_id"`
	MaterialDocumentYear string           `json:"material_document_year"`
	MovementType         string           `json:"movement_type"`
	MaterialID           string           `json:"Material_id"`
	BatchID              string           `json:"Batch_id"`
	StorageLocation      string           `json:"stroage_location"`
	Quantity             *float64         `json:"quantity"`
	UOM                  string           `json:"UOM"`
	PostingDate          string           `json:"posting_date"`
	DocumentDate         string           `json:"document_date"`
	ReferenceDocumentID  string           `json:"reference_document_id"`
	PurchaseOrderID      string           `json:"purchase_order_id"`
	ProcessOrderID       *string          `json:"process_order_id"`
	Events               []GenealogyEvent `json:"events"`
}

// ProductionConfirmationFull is the canonical production confirmation.
type ProductionConfirmationFull struct {
	ConfirmationID    string           `json:"confermation_id"`
	ProcessOrderID    string           `json:"process_order_id"`
	OperationID       string           `json:"operation_id"`
	WorkCenterID      string           `json:"work_center_id"`
	ConfirmedQuantity *float64         `json:"confirmed_quantity"`
	UOM               string           `json:"UOM"`
	ConfirmationDate  string           `json:"Confirmation_date"`
	ConfirmationTime  string           `json:"confirmation_time"`
	Status            string           `json:"status"`
	Events            []GenealogyEvent `json:"events"`
}

// RawMaterialFlow is a nested raw-material flow inside the finished batch
// genealogy (e.g. direct_raw_material_flow, coating_raw_material_flow).
type RawMaterialFlow struct {
	Material              *MaterialFull            `json:"material"`
	Batch                 *BatchFull               `json:"batch"`
	Supplier              *SupplierFull            `json:"supplier_or_source"`
	PurchaseOrder         *PurchaseOrderFull       `json:"purchase_order"`
	MaterialMovement      *MaterialMovementFull    `json:"material_movement"`
	InventoryStock        json.RawMessage          `json:"inventory_stock"`
	QualityInspectionLot  *InspectionLotFull       `json:"quality_inspection_lot"`
	Sampling              json.RawMessage          `json:"sampling"`
	InspectionResult      json.RawMessage          `json:"inspection_result"`
	UsageDecision         *UsageDecisionFull       `json:"usage_decision"`
	Reservation           json.RawMessage          `json:"reservation"`
	BatchDetermination    json.RawMessage          `json:"batch_determination"`
	MaterialConsumption   *MaterialConsumptionFull `json:"material_consumption"`
	ProcessOrder          *ProcessOrderFull        `json:"process_order"`
	BatchTransformation   *BatchTransformation     `json:"batch_transformation"`
	FinishedProductOutput json.RawMessage          `json:"finished_product_output"`
	SalesOrder            json.RawMessage          `json:"sales_order"`
	OutboundDelivery      json.RawMessage          `json:"outbound_delivery"`
	BillingDocument       json.RawMessage          `json:"billing_document"`
	Customer              json.RawMessage          `json:"customer_or_cfa"`
	Plant                 *PlantRef                `json:"plant"`
}

// SemiFinishedStage is the nested semi-finished production stage of the
// finished batch genealogy (granulation & core compression).
type SemiFinishedStage struct {
	ProcessOrderID         string                      `json:"process_order_id"`
	OrderType              string                      `json:"order_type"`
	MaterialID             string                      `json:"material_id"`
	MaterialDescription    string                      `json:"material_description"`
	BatchID                string                      `json:"batch_id"`
	BatchType              string                      `json:"batch_type"`
	PlantID                string                      `json:"plant_id"`
	Status                 string                      `json:"status"`
	PlannedQuantity        *float64                    `json:"planned_quantity"`
	UOM                    string                      `json:"uom"`
	InputBatches           []string                    `json:"input_batches"`
	OutputBatches          []string                    `json:"output_batches"`
	BatchTransformation    *BatchTransformation        `json:"batch_transformation"`
	MaterialConsumption    *MaterialConsumptionFull    `json:"material_consumption"`
	ProductionConfirmation *ProductionConfirmationFull `json:"production_confirmation"`
	Yield                  *YieldFull                  `json:"yield"`
}

// PlantRef identifies a plant in the canonical context.
type PlantRef struct {
	PlantID   string `json:"plant_id"`
	PlantName string `json:"plant_name"`
}

// BatchGenealogy is the typed view of finished_batch_genealogy.json.
type BatchGenealogy struct {
	RootBatchID string

	// Top-level business objects (typed subset; nil when absent).
	PlanningRequirement    json.RawMessage `json:"-"`
	PlannedOrder           json.RawMessage
	Material               *MaterialFull
	Batch                  *BatchFull
	Supplier               *SupplierFull
	PurchaseOrder          *PurchaseOrderFull
	MaterialMovement       *MaterialMovementFull
	ProcessOrder           *ProcessOrderFull
	BatchTransformation    *BatchTransformation
	MaterialConsumption    *MaterialConsumptionFull
	ProductionConfirmation *ProductionConfirmationFull
	Yield                  *YieldFull
	QualityInspectionLot   *InspectionLotFull
	UsageDecision          *UsageDecisionFull
	Customer               *CustomerFull
	SalesOrder             *SalesOrderFull
	SalesOrderItem         *SalesOrderItemFull
	SalesBatchAllocation   *SalesBatchAllocationFull
	OutboundDelivery       *OutboundDeliveryFull
	DeliveryItem           *DeliveryItemFull
	BillingDocument        *BillingDocumentFull
	SalesReturn            *SalesReturnFull
	SemiFinishedStage      *SemiFinishedStage

	// Nested raw material flows, in JSON order.
	RawMaterialFlows []*RawMaterialFlow

	// RoleOrder preserves the JSON key order of business_objects.
	RoleOrder []string

	// Relationships consumed from the canonical model.
	Relationships []CanonicalRelationship
}
