// Package source loads and parses the canonical input files into typed model
// structures. Parsing is schema-tolerant: optional fields may be absent, and
// the canonical producer uses "" or null for missing identifiers.
package source

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"sort"
	"strings"
	"time"

	"gs1-engine/internal/canonical/model"
)

// LoadResult holds both canonical inputs in typed form.
type LoadResult struct {
	Events    []model.CanonicalEvent
	Genealogy *model.BatchGenealogy
	Warnings  []string
}

// Load reads both canonical inputs and produces typed structures. Events come
// from the primary event stream (business_events.json); the genealogy file is
// consumed as business-object context and relationships only.
func Load(eventsPath, genealogyPath string) (*LoadResult, error) {
	res := &LoadResult{Genealogy: &model.BatchGenealogy{}}

	rawEvents, err := ParseEvents(eventsPath)
	if err != nil {
		return nil, err
	}
	for i, raw := range rawEvents {
		ev, err := decodeEvent(raw)
		if err != nil {
			return nil, fmt.Errorf("event #%d: %w", i+1, err)
		}
		res.Events = append(res.Events, ev)
	}

	data, err := os.ReadFile(genealogyPath)
	if err != nil {
		return nil, fmt.Errorf("read %s: %w", genealogyPath, err)
	}
	if err := decodeGenealogy(data, res); err != nil {
		return nil, err
	}
	return res, nil
}

type rawGenealogy struct {
	BatchGenealogy struct {
		RootBatchID     string          `json:"root_batch_id"`
		BusinessObjects json.RawMessage `json:"business_objects"`
		Relationships   json.RawMessage `json:"relationships"`
	} `json:"batch_genealogy"`
}

func decodeGenealogy(data []byte, res *LoadResult) error {
	var raw rawGenealogy
	if err := json.Unmarshal(data, &raw); err != nil {
		return fmt.Errorf("parse genealogy: %w", err)
	}
	g := res.Genealogy
	g.RootBatchID = raw.BatchGenealogy.RootBatchID
	objects := map[string]json.RawMessage{}
	if len(raw.BatchGenealogy.BusinessObjects) > 0 {
		if err := json.Unmarshal(raw.BatchGenealogy.BusinessObjects, &objects); err != nil {
			return fmt.Errorf("parse business_objects: %w", err)
		}
	}

	// Preserve the canonical JSON key order for deterministic traversal by
	// scanning the raw business_objects object.
	order, err := jsonObjectKeyOrder(raw.BatchGenealogy.BusinessObjects)
	if err != nil {
		return err
	}
	g.RoleOrder = order

	// Typed decoding of the known top-level roles; unknown roles are kept as
	// raw JSON (warnings surface them for transparency).
	decode := func(key string, target interface{}) bool {
		r, ok := objects[key]
		if !ok {
			return false
		}
		if err := json.Unmarshal(r, target); err != nil {
			res.Warnings = append(res.Warnings, fmt.Sprintf("genealogy object %q: %v", key, err))
			return false
		}
		return true
	}

	_ = decode("material", &g.Material)
	_ = decode("batch", &g.Batch)
	_ = decode("supplier_or_source", &g.Supplier)
	_ = decode("purchase_order", &g.PurchaseOrder)
	_ = decode("material_movement", &g.MaterialMovement)
	_ = decode("process_order", &g.ProcessOrder)
	_ = decode("batch_transformation", &g.BatchTransformation)
	_ = decode("material_consumption", &g.MaterialConsumption)
	_ = decode("production_confirmation", &g.ProductionConfirmation)
	_ = decode("yield", &g.Yield)
	_ = decode("quality_inspection_lot", &g.QualityInspectionLot)
	_ = decode("usage_decision", &g.UsageDecision)
	_ = decode("customer_or_cfa", &g.Customer)
	_ = decode("sales_order", &g.SalesOrder)
	_ = decode("sales_order_item", &g.SalesOrderItem)
	_ = decode("sales_batch_allocation", &g.SalesBatchAllocation)
	_ = decode("outbound_delivery", &g.OutboundDelivery)
	_ = decode("delivery_item", &g.DeliveryItem)
	_ = decode("billing_document", &g.BillingDocument)
	_ = decode("sales_return", &g.SalesReturn)
	_ = decode("semifinished_stage", &g.SemiFinishedStage)

	// Nested raw material flows keep their JSON order.
	for _, role := range order {
		if !strings.Contains(role, "raw_material_flow") {
			continue
		}
		var flow model.RawMaterialFlow
		if decode(role, &flow) {
			g.RawMaterialFlows = append(g.RawMaterialFlows, &flow)
		}
	}

	// Relationships may be a JSON array or an object keyed by index.
	g.Relationships = decodeRelationships(raw.BatchGenealogy.Relationships)
	return nil
}

func decodeRelationships(raw json.RawMessage) []model.CanonicalRelationship {
	if len(raw) == 0 {
		return nil
	}
	var list []model.CanonicalRelationship
	if err := json.Unmarshal(raw, &list); err == nil {
		sort.SliceStable(list, func(i, j int) bool { return list[i].Relationship < list[j].Relationship })
		return list
	}
	var keyed map[string]model.CanonicalRelationship
	if err := json.Unmarshal(raw, &keyed); err == nil {
		idxs := make([]int, 0, len(keyed))
		for k := range keyed {
			var i int
			if _, err := fmt.Sscanf(k, "%d", &i); err == nil {
				idxs = append(idxs, i)
			}
		}
		sort.Ints(idxs)
		out := make([]model.CanonicalRelationship, 0, len(idxs))
		for _, i := range idxs {
			out = append(out, keyed[fmt.Sprint(i)])
		}
		return out
	}
	return nil
}

// ParseEvents reads business_events.json into a raw generic representation so
// that missing fields are handled explicitly downstream.
func ParseEvents(path string) ([]map[string]interface{}, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read %s: %w", path, err)
	}
	var raw []map[string]interface{}
	if err := json.Unmarshal(data, &raw); err != nil {
		return nil, fmt.Errorf("parse %s: %w", path, err)
	}
	return raw, nil
}

// decodeEvent maps one raw canonical event into the typed model. Missing
// fields stay nil/absent; the empty-string sentinel used by the canonical
// producer for missing material_id is treated as absent.
func decodeEvent(raw map[string]interface{}) (model.CanonicalEvent, error) {
	ev := model.CanonicalEvent{}
	var err error

	if ev.EventID, err = reqStr(raw, "event_id"); err != nil {
		return ev, err
	}
	if ev.EventName, err = reqStr(raw, "event_name"); err != nil {
		return ev, err
	}
	if ev.BusinessObject, err = strOr(raw, "business_object", ""); err != nil {
		return ev, err
	}
	if ev.EntityKey, err = reqStr(raw, "entity_key"); err != nil {
		return ev, err
	}
	if ev.Status, err = strOr(raw, "status", ""); err != nil {
		return ev, err
	}

	if ev.BatchID, err = optStr(raw, "batch_id"); err != nil {
		return ev, err
	}
	if ev.ProcessOrderID, err = optStr(raw, "process_order_id"); err != nil {
		return ev, err
	}
	if ev.MaterialID, err = optStr(raw, "material_id"); err != nil {
		return ev, err
	}
	if ev.PlantID, err = optStr(raw, "plant_id"); err != nil {
		return ev, err
	}
	if ev.MovementType, err = optStr(raw, "movement_type"); err != nil {
		return ev, err
	}
	if ev.Description, err = optStr(raw, "description"); err != nil {
		return ev, err
	}

	s, ok, err := str(raw, "timestamp")
	if err != nil {
		return ev, err
	}
	if ok && s != "" {
		for _, layout := range []string{"2006-01-02T15:04:05Z07:00", "2006-01-02 15:04:05", "2006-01-02"} {
			if t, perr := time.Parse(layout, s); perr == nil {
				ev.Timestamp = t
				ev.TimestampSet = true
				break
			}
		}
		if !ev.TimestampSet {
			return ev, fmt.Errorf("unparseable timestamp %q", s)
		}
	}
	return ev, nil
}

func str(raw map[string]interface{}, key string) (string, bool, error) {
	v, ok := raw[key]
	if !ok || v == nil {
		return "", false, nil
	}
	s, ok := v.(string)
	if !ok {
		return "", false, fmt.Errorf("field %q: expected string", key)
	}
	return s, true, nil
}

func reqStr(raw map[string]interface{}, key string) (string, error) {
	s, ok, err := str(raw, key)
	if err != nil {
		return "", err
	}
	if !ok || strings.TrimSpace(s) == "" {			return "", fmt.Errorf("field %s: required but missing", key)
	}
	return s, nil
}

func strOr(raw map[string]interface{}, key, def string) (string, error) {
	s, ok, err := str(raw, key)
	if err != nil {
		return "", err
	}
	if !ok {
		return def, nil
	}
	return s, nil
}

// optStr returns nil for absent, null or empty values.
func optStr(raw map[string]interface{}, key string) (*string, error) {
	s, ok, err := str(raw, key)
	if err != nil || !ok {
		return nil, err
	}
	if strings.TrimSpace(s) == "" {
		return nil, nil
	}
	return &s, nil
}

// jsonObjectKeyOrder extracts the key order of a raw JSON object via a
// streaming decoder, without third-party dependencies.
func jsonObjectKeyOrder(raw json.RawMessage) ([]string, error) {
	if len(raw) == 0 {
		return nil, nil
	}
	dec := json.NewDecoder(bytes.NewReader(raw))
	return readObjectKeys(dec)
}

func readObjectKeys(dec *json.Decoder) ([]string, error) {
	tok, err := dec.Token()
	if err != nil {
		return nil, err
	}
	if d, ok := tok.(json.Delim); !ok || d != '{' {
		return nil, fmt.Errorf("business_objects is not a JSON object")
	}
	var keys []string
	for dec.More() {
		tok, err := dec.Token()
		if err != nil {
			return nil, err
		}
		key, ok := tok.(string)
		if !ok {
			return nil, fmt.Errorf("expected object key")
		}
		keys = append(keys, key)
		if err := skipValue(dec); err != nil {
			return nil, err
		}
	}
	return keys, nil
}

func skipValue(dec *json.Decoder) error {
	tok, err := dec.Token()
	if err != nil {
		return err
	}
	if t, ok := tok.(json.Delim); ok && (t == '{' || t == '[') {
		depth := 1
		for depth > 0 {
			tok, err := dec.Token()
			if err != nil {
				return err
			}
			if d, ok := tok.(json.Delim); ok {
				if d == '{' || d == '[' {
					depth++
				} else {
					depth--
				}
			}
		}
	}
	return nil
}
