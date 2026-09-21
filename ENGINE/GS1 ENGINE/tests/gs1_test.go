package tests

import (
	"testing"

	"gs1-engine/internal/gs1/identifier"
	cbv "gs1-engine/internal/gs1/vocabulary/cbv"
)

// GS1 resolution tests (spec §30: GTIN/GLN/SSCC/EPC resolution, invalid and
// missing identifiers). Canonical ids are NOT GS1 keys without explicit maps.
func TestGTINRequiresExplicitMapping(t *testing.T) {
	r := identifier.New(&identifier.Mapping{GTIN: map[string]string{
		"000000000210250096": "0628643012345",
	}})
	g, err := r.GTIN("000000000210250096", "E1")
	if err != nil || g != "0628643012345" {
		t.Fatalf("explicit GTIN mapping should resolve: %q %v", g, err)
	}
	if _, err := r.GTIN("000000000210250095", "E1"); err == nil {
		t.Fatal("unmapped material must NOT resolve to a GTIN (material id != GTIN)")
	}
}

func TestGLNRequiresExplicitMapping(t *testing.T) {
	r := identifier.New(&identifier.Mapping{GLN: map[string]string{"EP04": "5412345000013"}})
	g, err := r.GLN("EP04", "E1")
	if err != nil || g != "5412345000013" {
		t.Fatalf("explicit GLN mapping should resolve: %q %v", g, err)
	}
	if _, err := r.GLN("EMHA", "E1"); err == nil {
		t.Fatal("unmapped plant must NOT resolve to a GLN (plant id != GLN)")
	}
}

func TestSSCCRequiresExplicitMapping(t *testing.T) {
	r := identifier.New(&identifier.Mapping{SSCC: map[string]string{"2100084439": "354123450000000010"}})
	if s, err := r.SSCC("2100084439", "E1"); err != nil || s == "" {
		t.Fatalf("explicit SSCC should resolve: %q %v", s, err)
	}
	if _, err := r.SSCC("unknown", "E1"); err == nil {
		t.Fatal("unmapped key must not resolve to SSCC")
	}
}

func TestBatchIDIsNeverGTIN(t *testing.T) {
	r := identifier.New(&identifier.Mapping{})
	if _, err := r.EPC("000000000210250096", "PF05043", "E1"); err == nil {
		t.Fatal("EPC must not be fabricated from a batch id without explicit LGTIN mapping")
	}
}

func TestEPCWithExplicitLGTIN(t *testing.T) {
	r := identifier.New(&identifier.Mapping{
		GTIN:  map[string]string{"000000000210250096": "0628643012345"},
		Batch: map[string]string{"PF05043": "L5043"},
	})
	epc, err := r.EPC("000000000210250096", "PF05043", "E1")
	if err != nil {
		t.Fatalf("EPC should resolve: %v", err)
	}
	want := "urn:epc:class:lgtin:0628643012345.L5043"
	if epc != want {
		t.Fatalf("EPC mismatch: got %q want %q", epc, want)
	}
}

func TestCBVBusinessStepValidAndInvalid(t *testing.T) {
	if step, err := cbv.BusinessStep("GRNPosted", "E1"); err != nil || step == "" {
		t.Fatalf("GRNPosted should map: %q %v", step, err)
	}
	if step, err := cbv.BusinessStep("GoodsReceiptPosted", "E1"); err != nil || step == "" {
		t.Fatalf("GoodsReceiptPosted should map: %q %v", step, err)
	}
	if step, err := cbv.BusinessStep("OperationCompleted", "E1"); err != nil || step == "" {
		t.Fatalf("OperationCompleted should map: %q %v", step, err)
	}
	if _, err := cbv.BusinessStep("COATING_AND_PACKAGING", "E1"); err == nil {
		t.Fatal("internal canonical type must NOT pass through as CBV without mapping")
	}
}

func TestCBVDisposition(t *testing.T) {
	if d, err := cbv.Disposition("ACCEPT", "E1"); err != nil || d == "" {
		t.Fatalf("ACCEPT should map: %q %v", d, err)
	}
	if _, err := cbv.Disposition("A5", "E1"); err == nil {
		t.Fatal("unmapped decision code must produce CBV_MAPPING_NOT_FOUND, not passthrough")
	}
}

func TestCBVTransactionType(t *testing.T) {
	if tt, err := cbv.TransactionType("purchase_order", "E1"); err != nil || tt == "" {
		t.Fatalf("purchase_order should map: %q %v", tt, err)
	}
	if _, err := cbv.TransactionType("unknown_role", "E1"); err == nil {
		t.Fatal("unknown transaction role must be an error")
	}
}
