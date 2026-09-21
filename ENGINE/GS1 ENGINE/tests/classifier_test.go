package tests

import (
	"testing"

	"gs1-engine/internal/canonical/model"
	"gs1-engine/internal/classifier"
	"gs1-engine/internal/normalization"
)

func classifyOne(t *testing.T, ev model.CanonicalEvent) classifier.Category {
	t.Helper()
	events, errs := normalization.Load([]model.CanonicalEvent{ev}, model.SourceBusinessEvents)
	if len(errs) != 0 {
		t.Fatalf("normalization errors: %v", errs)
	}
	return classifier.Classify(events[0])
}

func TestClassifyBusinessContext(t *testing.T) {
	cases := []string{
		"PlanningRequirementCreated", "PlannedOrderCreated", "SalesOrderCreated",
		"InvoiceCreated", "PurchaseOrderCreated", "ProcessOrderCreated",
	}
	for _, name := range cases {
		cat := classifyOne(t, model.CanonicalEvent{EventID: "E1", EventName: name, EntityKey: "K"})
		if cat != classifier.BUSINESS_CONTEXT {
			t.Errorf("%s should be BUSINESS_CONTEXT, got %s", name, cat)
		}
	}
}

func TestClassifyMasterData(t *testing.T) {
	cases := []string{"MaterialCreated", "SupplierSourceCreated", "CustomerCreated", "BOMCreated", "RecipeCreated"}
	for _, name := range cases {
		cat := classifyOne(t, model.CanonicalEvent{EventID: "E1", EventName: name, EntityKey: "K"})
		if cat != classifier.MASTER_DATA {
			t.Errorf("%s should be MASTER_DATA, got %s", name, cat)
		}
	}
}

func TestClassifyVisibilityEvents(t *testing.T) {
	cases := []string{
		"GRNPosted", "BatchReceived", "GoodsIssuePosted", "MaterialConsumptionPosted",
		"YieldRecorded", "InspectionLotCreated", "QualityDecisionRecorded", "ReturnCreated",
	}
	for _, name := range cases {
		cat := classifyOne(t, model.CanonicalEvent{EventID: "E1", EventName: name, EntityKey: "K"})
		if cat != classifier.VISIBILITY_EVENT {
			t.Errorf("%s should be VISIBILITY_EVENT, got %s", name, cat)
		}
	}
}

func TestClassifyGenealogyContext(t *testing.T) {
	cases := []string{"BatchAssigned", "BatchStatusChanged", "StockIncreased"}
	for _, name := range cases {
		cat := classifyOne(t, model.CanonicalEvent{EventID: "E1", EventName: name, EntityKey: "K"})
		if cat != classifier.GENEALOGY_CONTEXT {
			t.Errorf("%s should be GENEALOGY_CONTEXT, got %s", name, cat)
		}
	}
}

func TestClassifyUnsupported(t *testing.T) {
	cat := classifyOne(t, model.CanonicalEvent{EventID: "E1", EventName: "SomethingUnknown", EntityKey: "K"})
	if cat != "UNSUPPORTED_EVENT" {
		t.Fatalf("unknown events must not be silently classified; got %s", cat)
	}
}
