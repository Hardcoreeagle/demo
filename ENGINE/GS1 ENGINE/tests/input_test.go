package tests

import (
	"testing"

	"gs1-engine/internal/canonical/source"
)

// Input parsing tests (spec §30: business_events.json parsing,
// finished_batch_genealogy.json parsing, invalid input handling).
func TestParseBusinessEvents(t *testing.T) {
	res, err := source.Load("../input/canonical/business_events.json", "../input/canonical/finished_batch_genealogy.json")
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	if len(res.Events) != 650 {
		t.Fatalf("expected 650 canonical events, got %d", len(res.Events))
	}
	if res.Events[0].EventID != "EVT-000001" {
		t.Fatalf("unexpected first event id %q", res.Events[0].EventID)
	}
	if res.Events[0].PlantID == nil || *res.Events[0].PlantID != "EMHA" {
		t.Fatalf("plant_id not decoded for first event")
	}
	if res.Events[0].BatchID != nil {
		t.Fatalf("first event has no batch_id in canonical input; got %q", *res.Events[0].BatchID)
	}
	if len(res.Genealogy.RoleOrder) == 0 {
		t.Fatalf("genealogy role order empty")
	}
	if res.Genealogy.RootBatchID != "PF05043" {
		t.Fatalf("unexpected root batch %q", res.Genealogy.RootBatchID)
	}
}

func TestParseEventsMissingFile(t *testing.T) {
	if _, err := source.Load("does-not-exist.json", "../input/canonical/finished_batch_genealogy.json"); err == nil {
		t.Fatal("expected error for missing events file")
	}
}

func TestParseEventsInvalidJSON(t *testing.T) {
	dir := t.TempDir()
	bad := dir + "/bad.json"
	if err := writeFile(bad, "not json"); err != nil {
		t.Fatal(err)
	}
	if _, err := source.Load(bad, "../input/canonical/finished_batch_genealogy.json"); err == nil {
		t.Fatal("expected error for invalid JSON")
	}
}
