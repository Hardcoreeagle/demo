package tests

import (
	"testing"

	"gs1-engine/internal/canonical/model"
	"gs1-engine/internal/mapping"
	"gs1-engine/internal/normalization"
)

// Deduplication tests (spec §30): GoodsReceipt + MaterialMovement 101 with PO
// reference describing the same physical occurrence must not produce two
// EPCIS events. Also: GRNPosted + BatchReceived on the same material document.
func TestGRNAndBatchReceivedAreSameOccurrence(t *testing.T) {
	mk := func(name, status string) *normalization.NormalizedEvent {
		ev, err := normalize(map[string]interface{}{
			"event_id": "EVT-D1", "event_name": name, "business_object": "Goods Receipt (GRN)",
			"entity_key": "5000962919", "batch_id": "16A12002", "material_id": "000000000424440068",
			"plant_id": "EMHA", "movement_type": "101", "timestamp": "2013-08-26",
			"status": status,
		})
		if err != nil {
			t.Fatal(err)
		}
		return ev
	}
	id1 := mapping.Identity(mk("GRNPosted", "Posted"))
	id2 := mapping.Identity(mk("BatchReceived", "Received"))
	if id1 != id2 {
		t.Fatalf("GRNPosted and BatchReceived of the same material document describe one physical occurrence; identities differ:\n%s\n%s", id1, id2)
	}
}

func TestGoodsIssueAndDeliveryShippedAreSameOccurrence(t *testing.T) {
	mk := func(name string) *normalization.NormalizedEvent {
		ev, err := normalize(map[string]interface{}{
			"event_id": "EVT-D2", "event_name": name, "business_object": "Material Movement",
			"entity_key": "4901710523", "batch_id": "EDA07017", "material_id": "000000000421110027",
			"plant_id": "ERA1", "movement_type": "601", "timestamp": "2008-04-29",
		})
		if err != nil {
			t.Fatal(err)
		}
		return ev
	}
	if mapping.Identity(mk("GoodsIssuePosted")) != mapping.Identity(mk("DeliveryShipped")) {
		t.Fatal("GoodsIssuePosted and DeliveryShipped of the same material document must share one identity")
	}
}

func TestDifferentDocumentsAreDistinct(t *testing.T) {
	mk := func(entityKey string) *normalization.NormalizedEvent {
		ev, err := normalize(map[string]interface{}{
			"event_id": "EVT-D3", "event_name": "GRNPosted", "business_object": "Goods Receipt (GRN)",
			"entity_key": entityKey, "batch_id": "16A12002", "material_id": "000000000424440068",
			"plant_id": "EMHA", "movement_type": "101", "timestamp": "2013-08-26",
		})
		if err != nil {
			t.Fatal(err)
		}
		return ev
	}
	if mapping.Identity(mk("5000962919")) == mapping.Identity(mk("5000857046")) {
		t.Fatal("different goods receipt documents are distinct physical occurrences")
	}
}

func TestDeduplicatorCollapsesDuplicates(t *testing.T) {
	d := mapping.NewDeduplicator()
	if !d.Add("X") {
		t.Fatal("first identity must be new")
	}
	if d.Add("X") {
		t.Fatal("repeated identity must be flagged as duplicate")
	}
}

// normalize is provided by the loader-bridging helper in helpers_test.go.
func normalize(raw map[string]interface{}) (*normalization.NormalizedEvent, error) {
	ev := decodeEventForTest(raw)
	events, errs := normalization.Load([]model.CanonicalEvent{ev}, model.SourceBusinessEvents)
	if len(errs) > 0 {
		return nil, errs[0]
	}
	return events[0], nil
}
