package tests

import (
	"encoding/json"
	"os"
	"testing"

	"gs1-engine/internal/canonical/model"
	"gs1-engine/internal/canonical/source"
)

func writeFile(path, content string) error {
	return os.WriteFile(path, []byte(content), 0o644)
}

func marshalEvents(t *testing.T, events []map[string]interface{}) string {
	t.Helper()
	data, err := json.Marshal(events)
	if err != nil {
		t.Fatal(err)
	}
	return string(data)
}

func sourceLoad(eventsPath string) (*source.LoadResult, error) {
	// Genealogy is required by Load; reuse the real one for event-only tests.
	return source.Load(eventsPath, "../input/canonical/finished_batch_genealogy.json")
}

// decodeEventForTest bridges the unexported source.decodeEvent by loading a
// single-event temp file. Tests use normalize() (dedup_test.go) which relies
// on this indirection.
func decodeEventForTest(raw map[string]interface{}) model.CanonicalEvent {
	dir, err := os.MkdirTemp("", "gs1test")
	if err != nil {
		panic(err)
	}
	path := dir + "/one.json"
	if err := writeFile(path, marshalEvents(&testing.T{}, []map[string]interface{}{raw})); err != nil {
		panic(err)
	}
	res, err := sourceLoad(path)
	if err != nil {
		panic(err)
	}
	return res.Events[0]
}
