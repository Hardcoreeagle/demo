package tests

import (
	"testing"
	"time"

	"gs1-engine/internal/canonical/model"
	"gs1-engine/internal/normalization"
)

// Normalization tests (spec §30: timestamp normalization, empty value
// handling, quantity/UOM handling, identifier normalization).

func decodeOne(t *testing.T, raw map[string]interface{}) model.CanonicalEvent {
	t.Helper()
	// decodeEvent is unexported; exercise it through a minimal file load.
	dir := t.TempDir()
	path := dir + "/events.json"
	if err := writeFile(path, marshalEvents(t, []map[string]interface{}{raw})); err != nil {
		t.Fatal(err)
	}
	res, err := sourceLoad(path)
	if err != nil {
		t.Fatal(err)
	}
	if len(res.Events) != 1 {
		t.Fatalf("expected 1 event, got %d", len(res.Events))
	}
	return res.Events[0]
}

func TestNormalizationTimestamps(t *testing.T) {
	ev := decodeOne(t, map[string]interface{}{
		"event_id": "EVT-X1", "event_name": "GRNPosted", "entity_key": "5000012345",
		"timestamp": "2010-01-16",
	})
	events, errs := normalization.Load([]model.CanonicalEvent{ev}, model.SourceBusinessEvents)
	if len(errs) != 0 {
		t.Fatalf("unexpected normalization errors: %v", errs)
	}
	if !events[0].TimestampSet {
		t.Fatal("timestamp should be set")
	}
	if got := events[0].Timestamp.Format(time.DateOnly); got != "2010-01-16" {
		t.Fatalf("timestamp mismatch: %s", got)
	}
}

func TestNormalizationEmptyValues(t *testing.T) {
	ev := decodeOne(t, map[string]interface{}{
		"event_id": "EVT-X2", "event_name": "GRNPosted", "entity_key": "5000012345",
		"material_id": "", "batch_id": nil, "timestamp": "2010-01-16",
	})
	events, _ := normalization.Load([]model.CanonicalEvent{ev}, model.SourceBusinessEvents)
	if events[0].MaterialID != nil {
		t.Fatalf("empty material_id should normalize to nil, got %q", *events[0].MaterialID)
	}
	if events[0].BatchID != nil {
		t.Fatalf("null batch_id should normalize to nil")
	}
}

func TestNormalizationQuantityFromDescription(t *testing.T) {
	ev := decodeOne(t, map[string]interface{}{
		"event_id": "EVT-X3", "event_name": "YieldRecorded", "entity_key": "YLD-1",
		"timestamp":   "2010-02-02",
		"description": "Production yield of 104.03 KG recorded for batch PF05043",
	})
	events, _ := normalization.Load([]model.CanonicalEvent{ev}, model.SourceBusinessEvents)
	if !events[0].Quantity.Set {
		t.Fatal("quantity should be parsed from description")
	}
	if events[0].Quantity.Value != 104.03 || events[0].Quantity.UOM != "KG" {
		t.Fatalf("quantity mismatch: %+v", events[0].Quantity)
	}
}

func TestNormalizationIdentifierTrim(t *testing.T) {
	ev := decodeOne(t, map[string]interface{}{
		"event_id": "EVT-X4", "event_name": "GRNPosted", "entity_key": "5000012345",
		"batch_id": "  RM-MET-05043  ", "timestamp": "2010-01-16",
	})
	events, _ := normalization.Load([]model.CanonicalEvent{ev}, model.SourceBusinessEvents)
	if *events[0].BatchID != "RM-MET-05043" {
		t.Fatalf("identifier should be trimmed, got %q", *events[0].BatchID)
	}
}

func TestNormalizationMissingRequiredFields(t *testing.T) {
	// Constructed directly: canonical loading itself would reject an event
	// without event_id before normalization runs.
	ev := model.CanonicalEvent{EventID: "EVT-X9", EntityKey: "K"}
	_, errs := normalization.Load([]model.CanonicalEvent{ev}, model.SourceBusinessEvents)
	if len(errs) == 0 {
		t.Fatal("expected normalization error for missing event_name")
	}
}
