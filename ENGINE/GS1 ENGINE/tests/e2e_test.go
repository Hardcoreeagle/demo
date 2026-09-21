package tests

import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"gs1-engine/internal/pipeline"
)

// End-to-end pipeline test over the actual canonical inputs (spec §30 CLI).
func TestEndToEndPipeline(t *testing.T) {
	outDir := t.TempDir()
	var buf bytes.Buffer
	sum, err := pipeline.Run(pipeline.Options{
		EventsPath:    "../input/canonical/business_events.json",
		GenealogyPath: "../input/canonical/finished_batch_genealogy.json",
		OutputDir:     outDir,
		Stdout:        &buf,
	})
	if err != nil {
		t.Fatalf("pipeline: %v", err)
	}
	if sum.CanonicalEvents != 650 {
		t.Fatalf("expected 650 canonical events, got %d", sum.CanonicalEvents)
	}
	if sum.EPCISEvents == 0 {
		t.Fatal("pipeline produced no EPCIS events")
	}
	if sum.DuplicatesRemoved == 0 {
		t.Fatalf("expected duplicate physical occurrences to be collapsed (GRN/101, GI/601), got %d", sum.DuplicatesRemoved)
	}
	if sum.ValidationFails != 0 {
		t.Fatalf("validation failures: %d", sum.ValidationFails)
	}

	// No logistics domain file may ever exist (spec §23/§24).
	if _, err := os.Stat(filepath.Join(outDir, "logistics")); !os.IsNotExist(err) {
		t.Fatal("logistics domain must not exist")
	}
	if _, err := os.Stat(filepath.Join(outDir, "planning")); !os.IsNotExist(err) {
		t.Fatal("planning domain file must not exist when no planning visibility events exist")
	}

	// Production output must contain TransformationEvents preserving the
	// canonical genealogy (3 inputs -> PF05043) and no duplicate outputs.
	prod, err := os.ReadFile(filepath.Join(outDir, "production", "epcis-production.json"))
	if err != nil {
		t.Fatalf("production document missing: %v", err)
	}
	var doc struct {
		EPCISBody struct {
			EventList []struct {
				Type               string `json:"type"`
				TransformationID   string `json:"transformationID"`
				InputQuantityList  []struct{ EPCClass string } `json:"inputQuantityList"`
				OutputQuantityList []struct{ EPCClass string } `json:"outputQuantityList"`
			} `json:"eventList"`
		} `json:"epcisBody"`
	}
	if err := json.Unmarshal(prod, &doc); err != nil {
		t.Fatalf("production document is not valid JSON: %v", err)
	}
	transformations := 0
	seenTID := map[string]bool{}
	for _, ev := range doc.EPCISBody.EventList {
		if ev.Type != "TransformationEvent" {
			continue
		}
		transformations++
		if seenTID[ev.TransformationID] {
			t.Fatalf("duplicate transformation emitted: %s", ev.TransformationID)
		}
		seenTID[ev.TransformationID] = true
	}
	if transformations != 2 {
		t.Fatalf("expected 2 transformation events (SFG + finished), got %d", transformations)
	}
}

// Determinism test (spec §26/§30): the same input must always generate the
// same output. Runs the pipeline twice into two directories and compares bytes.
func TestDeterministicOutput(t *testing.T) {
	out1 := t.TempDir()
	out2 := t.TempDir()
	for _, outDir := range []string{out1, out2} {
		if _, err := pipeline.Run(pipeline.Options{
			EventsPath:    "../input/canonical/business_events.json",
			GenealogyPath: "../input/canonical/finished_batch_genealogy.json",
			OutputDir:     outDir,
			Stdout:        nil,
		}); err != nil {
			t.Fatalf("pipeline: %v", err)
		}
	}
	compareTrees(t, out1, out2)
}

func compareTrees(t *testing.T, dir1, dir2 string) {
	t.Helper()
	err := filepath.Walk(dir1, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() {
			return nil
		}
		rel, _ := filepath.Rel(dir1, path)
		other := filepath.Join(dir2, rel)
		b1, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		b2, err := os.ReadFile(other)
		if err != nil {
			return err
		}
		if !bytes.Equal(b1, b2) {
			t.Errorf("non-deterministic output: %s differs between runs", rel)
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
}
