// Package classifier assigns each normalized canonical event to an engine
// category. Classification follows the canonical model semantics: business
// context and master data never become physical EPCIS events; only records
// with physical visibility semantics do.
package classifier

import "gs1-engine/internal/normalization"

// Category classifies a canonical event.
type Category string

const (
	// MASTER_DATA marks master-data lifecycle records (material, supplier,
	// customer, BOM, recipe, ...) — business context only.
	MASTER_DATA Category = "MASTER_DATA"
	// BUSINESS_CONTEXT marks planning/financial/quality-document records that
	// carry no physical visibility semantics.
	BUSINESS_CONTEXT Category = "BUSINESS_CONTEXT"
	// VISIBILITY_EVENT marks records describing a physical occurrence that
	// can legitimately become an EPCIS event.
	VISIBILITY_EVENT Category = "VISIBILITY_EVENT"
	// GENEALOGY_CONTEXT marks records whose meaning is already captured by
	// another physical record (e.g. BatchAssigned restating an output batch).
	GENEALOGY_CONTEXT Category = "GENEALOGY_CONTEXT"
)

// classifyRules maps event_name -> category, following the canonical event
// catalog and the EPCIS visibility semantics of each record type.
var classifyRules = map[string]Category{
	// Master data lifecycle.
	"MaterialCreated":                 MASTER_DATA,
	"MaterialUpdated":                 MASTER_DATA,
	"MaterialUnblocked":               MASTER_DATA,
	"SupplierSourceCreated":           MASTER_DATA,
	"SupplierSourceUpdated":           MASTER_DATA,
	"CustomerCreated":                 MASTER_DATA,
	"CustomerUpdated":                 MASTER_DATA,
	"BOMCreated":                      MASTER_DATA,
	"RecipeCreated":                   MASTER_DATA,
	"ProductionVersionCreated":        MASTER_DATA,
	"InspectionPlanCreated":           MASTER_DATA,
	"InspectionCharacteristicCreated": MASTER_DATA,
	"InspectionParameterAssigned":     MASTER_DATA,

	// Planning / business context.
	"PlanningRequirementCreated": BUSINESS_CONTEXT,
	"PlanningRequirementUpdated": BUSINESS_CONTEXT,
	"PlannedOrderCreated":        BUSINESS_CONTEXT,
	"PlannedOrderReleased":       BUSINESS_CONTEXT,
	"PlannedOrderConverted":      BUSINESS_CONTEXT,
	"ProcessOrderCreated":        BUSINESS_CONTEXT,
	"ProcessOrderReleased":       BUSINESS_CONTEXT,
	"ProcessOrderClosed":         BUSINESS_CONTEXT,
	"ReservationCreated":         BUSINESS_CONTEXT,
	"ReservationReleased":        BUSINESS_CONTEXT,
	"BatchDetermined":            BUSINESS_CONTEXT,
	"BatchAllocated":             BUSINESS_CONTEXT,
	"SalesOrderCreated":          BUSINESS_CONTEXT,
	"SalesOrderItemAdded":        BUSINESS_CONTEXT,
	"DeliveryCreated":            BUSINESS_CONTEXT,
	"DeliveryItemCreated":        BUSINESS_CONTEXT,
	"InvoiceCreated":             BUSINESS_CONTEXT,
	"InvoicePosted":              BUSINESS_CONTEXT,
	"PurchaseRequisitionCreated": BUSINESS_CONTEXT,
	"PurchaseOrderCreated":       BUSINESS_CONTEXT,
	"PurchaseOrderReleased":      BUSINESS_CONTEXT,
	"GRNCreated":                 BUSINESS_CONTEXT,
	"ProductionBatchCreated":     BUSINESS_CONTEXT,

	// Genealogy context: restatements of facts captured by physical records.
	"BatchAssigned":              GENEALOGY_CONTEXT,
	"BatchStatusChanged":         GENEALOGY_CONTEXT,
	"BatchTransformationCreated": GENEALOGY_CONTEXT,
	"StockIncreased":             GENEALOGY_CONTEXT,
	"StockStatusChanged":         GENEALOGY_CONTEXT,
	"BatchDetermination":         GENEALOGY_CONTEXT,

	// Physical visibility events.
	"GRNPosted":                      VISIBILITY_EVENT,
	"BatchReceived":                  VISIBILITY_EVENT,
	"GoodsIssuePosted":               VISIBILITY_EVENT,
	"GoodsReceiptPosted":             VISIBILITY_EVENT,
	"DeliveryShipped":                VISIBILITY_EVENT,
	"MaterialConsumptionPosted":      VISIBILITY_EVENT,
	"BatchTransformationCompleted":   VISIBILITY_EVENT,
	"OperationCompleted":             VISIBILITY_EVENT,
	"YieldRecorded":                  VISIBILITY_EVENT,
	"ProductionConfirmationRecorded": VISIBILITY_EVENT,
	"InspectionLotCreated":           VISIBILITY_EVENT,
	"InspectionStarted":              VISIBILITY_EVENT,
	"InspectionResultRecorded":       VISIBILITY_EVENT,
	"QualityDecisionRecorded":        VISIBILITY_EVENT,
	"SampleCreated":                  VISIBILITY_EVENT,
	"ReturnCreated":                  VISIBILITY_EVENT,
}

// Classify returns the engine category of a normalized event.
func Classify(ev *normalization.NormalizedEvent) Category {
	if cat, ok := classifyRules[ev.EventName]; ok {
		return cat
	}
	// Unknown canonical event names are not silently converted into EPCIS
	// events; the mapping layer reports them as UNSUPPORTED_EVENT.
	return "UNSUPPORTED_EVENT"
}
