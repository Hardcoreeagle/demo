package tests

import (
	"testing"

	"gs1-engine/internal/epcis/document"
	"gs1-engine/internal/epcis/event"
)

// EPCIS tests (spec §30): event-type validation and document validation.

func validObjectEvent() event.EPCISEvent {
	return event.EPCISEvent{
		Type: "ObjectEvent", EventID: "urn:uuid:e1",
		EventTime: "2010-02-02T00:00:00Z", EventTimeZoneOffset: "+00:00",
		Action: "ADD", EPCList: []string{"urn:internal:batch:m:b"},
	}
}

func TestValidateObjectEvent(t *testing.T) {
	doc := &event.Document{
		Context: []interface{}{"https://ref.gs1.org/epcis/epcis-context.jsonld"},
		Type:    "EPCISDocument", SchemaVersion: "2.0", CreationDate: "2010-02-02T00:00:00Z",
		EPCISBody: event.EPCISBody{EventList: []event.EPCISEvent{validObjectEvent()}},
	}
	if errs := document.Validate(doc); len(errs) != 0 {
		t.Fatalf("valid ObjectEvent should pass: %v", errs)
	}
}

func TestValidateObjectEventMissingEPCs(t *testing.T) {
	ev := validObjectEvent()
	ev.EPCList = nil
	ev.QuantityElementList = nil
	doc := &event.Document{
		Context: []interface{}{"https://ref.gs1.org/epcis/epcis-context.jsonld"},
		Type:    "EPCISDocument", SchemaVersion: "2.0", CreationDate: "2010-02-02T00:00:00Z",
		EPCISBody: event.EPCISBody{EventList: []event.EPCISEvent{ev}},
	}
	if errs := document.Validate(doc); len(errs) == 0 {
		t.Fatal("ObjectEvent without epcList/quantityList must fail validation")
	}
}

func TestValidateTransformationEvent(t *testing.T) {
	ev := event.EPCISEvent{
		Type: "TransformationEvent", EventID: "urn:uuid:t1",
		EventTime: "2010-02-02T00:00:00Z", EventTimeZoneOffset: "+00:00",
		InputQuantityList:  []event.QuantityElement{{EPCClass: "urn:internal:batch:m:in", Quantity: f64(1), UOM: "KG"}},
		OutputQuantityList: []event.QuantityElement{{EPCClass: "urn:internal:batch:m:out", Quantity: f64(1), UOM: "KG"}},
	}
	doc := &event.Document{
		Context: []interface{}{"https://ref.gs1.org/epcis/epcis-context.jsonld"},
		Type:    "EPCISDocument", SchemaVersion: "2.0", CreationDate: "2010-02-02T00:00:00Z",
		EPCISBody: event.EPCISBody{EventList: []event.EPCISEvent{ev}},
	}
	if errs := document.Validate(doc); len(errs) != 0 {
		t.Fatalf("valid TransformationEvent should pass: %v", errs)
	}
}

func TestValidateAggregationTransactionAssociation(t *testing.T) {
	cases := []event.EPCISEvent{
		{
			Type: "AggregationEvent", EventID: "urn:uuid:a1",
			EventTime: "2010-02-02T00:00:00Z", EventTimeZoneOffset: "+00:00",
			Action: "ADD", ParentID: "urn:internal:sscc:p", ChildEPCs: []string{"urn:internal:batch:m:b"},
		},
		{
			Type: "TransactionEvent", EventID: "urn:uuid:tx1",
			EventTime: "2010-02-02T00:00:00Z", EventTimeZoneOffset: "+00:00",
			Action: "ADD", EPCList: []string{"urn:internal:batch:m:b"},
			BizTransactionList: []event.BizTransaction{{Type: "urn:epcglobal:cbv:biztransaction:po", BizTransaction: "urn:internal:po:4500012345"}},
		},
		{
			Type: "AssociationEvent", EventID: "urn:uuid:as1",
			EventTime: "2010-02-02T00:00:00Z", EventTimeZoneOffset: "+00:00",
			Action: "ADD", ParentID: "urn:internal:sscc:p", ChildEPCs: []string{"urn:internal:sgtin:c"},
		},
	}
	for _, ev := range cases {
		doc := &event.Document{
			Context: []interface{}{"https://ref.gs1.org/epcis/epcis-context.jsonld"},
			Type:    "EPCISDocument", SchemaVersion: "2.0", CreationDate: "2010-02-02T00:00:00Z",
			EPCISBody: event.EPCISBody{EventList: []event.EPCISEvent{ev}},
		}
		if errs := document.Validate(doc); len(errs) != 0 {
			t.Errorf("%s should validate: %v", ev.Type, errs)
		}
	}
}

func TestValidateBadTimeZone(t *testing.T) {
	ev := validObjectEvent()
	ev.EventTimeZoneOffset = "+5"
	doc := &event.Document{
		Context: []interface{}{"https://ref.gs1.org/epcis/epcis-context.jsonld"},
		Type:    "EPCISDocument", SchemaVersion: "2.0", CreationDate: "2010-02-02T00:00:00Z",
		EPCISBody: event.EPCISBody{EventList: []event.EPCISEvent{ev}},
	}
	if errs := document.Validate(doc); len(errs) == 0 {
		t.Fatal("invalid timezone offset must fail validation")
	}
}

func TestDocumentBuildSortsDeterministically(t *testing.T) {
	a := validObjectEvent()
	a.EventID = "urn:uuid:aaa"
	a.EventTime = "2010-02-03T00:00:00Z"
	b := validObjectEvent()
	b.EventID = "urn:uuid:bbb"
	b.EventTime = "2010-02-02T00:00:00Z"
	doc, err := document.Build([]event.EPCISEvent{a, b}, "2010-02-02T00:00:00Z")
	if err != nil {
		t.Fatal(err)
	}
	if doc.EPCISBody.EventList[0].EventID != "urn:uuid:bbb" {
		t.Fatal("events must be ordered by eventTime for deterministic output")
	}
}

func f64(v float64) *float64 { return &v }
