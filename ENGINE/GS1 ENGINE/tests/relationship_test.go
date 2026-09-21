package tests

import (
	"testing"

	"gs1-engine/internal/canonical/source"
	"gs1-engine/internal/relationship"
)

// Relationship tests (spec §30: batch genealogy, input/output batches,
// process-order relationships, quality and sales relationships).
func loadCanonical(t *testing.T) *source.LoadResult {
	t.Helper()
	res, err := source.Load("../input/canonical/business_events.json", "../input/canonical/finished_batch_genealogy.json")
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	return res
}

func TestTransformationResolution(t *testing.T) {
	res := loadCanonical(t)
	r := relationship.New(res.Genealogy)
	ts := r.Transformations()
	if len(ts) != 2 {
		t.Fatalf("expected 2 physical transformations (SFG + finished), got %d", len(ts))
	}
	if ts[0].TransformationID != "TRANS-SFG-001" || ts[1].TransformationID != "TRANS-PF05043" {
		t.Fatalf("unexpected transformation ids: %v", ts)
	}
	// The finished transformation must preserve the canonical genealogy:
	// 3 input batches (core + API + coating) -> PF05043.
	if len(ts[1].InputBatches) != 3 {
		t.Fatalf("finished transformation must have 3 canonical inputs, got %d", len(ts[1].InputBatches))
	}
	if ts[1].OutputBatch.BatchID != "PF05043" {
		t.Fatalf("unexpected output batch %q", ts[1].OutputBatch.BatchID)
	}
	if ts[1].PlantID != "EP04" {
		t.Fatalf("plant must come from canonical context; got %q", ts[1].PlantID)
	}
}

func TestNoDuplicateOutputTransformations(t *testing.T) {
	res := loadCanonical(t)
	r := relationship.New(res.Genealogy)
	ts := r.Transformations()
	seen := map[string]int{}
	for _, tr := range ts {
		seen[tr.OutputBatch.BatchID]++
	}
	for batch, n := range seen {
		if n > 1 {
			t.Fatalf("output batch %q resolved %d times; the same physical transformation must be emitted once", batch, n)
		}
	}
}

func TestPlantForBatch(t *testing.T) {
	res := loadCanonical(t)
	r := relationship.New(res.Genealogy)
	if p, ok := r.PlantForBatch("PF05043"); !ok || p != "EP04" {
		t.Fatalf("PF05043 plant should resolve to EP04, got %q ok=%v", p, ok)
	}
	if p, ok := r.PlantForBatch("RM-MET-05043"); !ok || p != "EP04" {
		t.Fatalf("RM batch plant should resolve to EP04, got %q ok=%v", p, ok)
	}
	if _, ok := r.PlantForBatch("UNKNOWN-BATCH"); ok {
		t.Fatal("plant must not be invented for unknown batches")
	}
}

func TestQualityPlantFromCanonicalRelationship(t *testing.T) {
	res := loadCanonical(t)
	r := relationship.New(res.Genealogy)
	p, err := r.QualityPlant("PF05043")
	if err != nil || p != "EP04" {
		t.Fatalf("quality plant should resolve through canonical batch relationship: %q %v", p, err)
	}
	if _, err := r.QualityPlant("16A12002"); err == nil {
		t.Fatal("batch absent from canonical context must yield RELATIONSHIP_NOT_FOUND, not an invented plant")
	}
}

func TestTransformationCompletionEvidence(t *testing.T) {
	res := loadCanonical(t)
	r := relationship.New(res.Genealogy)
	for _, tr := range r.Transformations() {
		if tr.CompletionDate == "" {
			t.Fatalf("transformation %s lacks completion evidence in canonical context", tr.TransformationID)
		}
	}
}
