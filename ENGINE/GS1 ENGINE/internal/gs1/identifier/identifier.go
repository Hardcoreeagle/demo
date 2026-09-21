// Package identifier implements explicit GS1 identifier resolution. Canonical
// IDs (material, plant, batch) are NOT GS1 identifiers; they only become GS1
// identifiers through the explicit mapping configured here or supplied via the
// identifier map file. Nothing is ever fabricated.
package identifier

import (
	"encoding/json"
	"fmt"
	"os"
	"sort"
	"strings"

	"gs1-engine/internal/errors"
)

// Code is a GS1 identification key carried by EPCIS (GTIN, GLN, SSCC, LGTIN...).
type Code string

const (
	CodeGTIN  Code = "GTIN"
	CodeGLN   Code = "GLN"
	CodeSSCC  Code = "SSCC"
	CodeLGTIN Code = "LGTIN"
)

// CanonicalKey identifies a canonical entity (material, plant, batch).
type CanonicalKey struct {
	Type string // "material" | "plant" | "batch"
	ID   string
}

// Mapping is the explicit canonical -> GS1 identifier map. It may be loaded
// from a JSON file so production data can supply real GS1 keys.
type Mapping struct {
	GTIN  map[string]string `json:"gtin"`        // material_id -> GTIN
	GLN   map[string]string `json:"gln"`         // plant_id -> GLN
	SSCC  map[string]string `json:"sscc"`        // e.g. delivery id -> SSCC
	Batch map[string]string `json:"batch_lgtin"` // batch_id -> LGTIN (optional)
}

// Resolver resolves canonical identifiers to GS1 identification keys.
type Resolver struct {
	mapping Mapping
}

// LoadMappingFile reads the optional explicit identifier map. A missing file
// is not an error (empty mapping is valid); a malformed file is.
func LoadMappingFile(path string) (*Mapping, error) {
	if path == "" {
		return &Mapping{GTIN: map[string]string{}, GLN: map[string]string{}, SSCC: map[string]string{}, Batch: map[string]string{}}, nil
	}
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return &Mapping{GTIN: map[string]string{}, GLN: map[string]string{}, SSCC: map[string]string{}, Batch: map[string]string{}}, nil
		}
		return nil, fmt.Errorf("read identifier map: %w", err)
	}
	var m Mapping
	if err := json.Unmarshal(data, &m); err != nil {
		return nil, fmt.Errorf("parse identifier map: %w", err)
	}
	if m.GTIN == nil {
		m.GTIN = map[string]string{}
	}
	if m.GLN == nil {
		m.GLN = map[string]string{}
	}
	if m.SSCC == nil {
		m.SSCC = map[string]string{}
	}
	if m.Batch == nil {
		m.Batch = map[string]string{}
	}
	return &m, nil
}

// New builds a resolver with the given explicit mapping.
func New(m *Mapping) *Resolver {
	if m == nil {
		m = &Mapping{}
	}
	return &Resolver{mapping: *m}
}

// GTIN resolves the GTIN for a canonical material id.
func (r *Resolver) GTIN(materialID, eventID string) (string, error) {
	if materialID == "" {
		return "", errors.New(errors.CodeGS1GTINNotFound, eventID, "material id empty; GTIN not resolvable")
	}
	if g, ok := r.mapping.GTIN[materialID]; ok {
		return g, nil
	}
	return "", errors.New(errors.CodeGS1GTINNotFound, eventID,
		"no explicit GTIN mapping for material %q (material id is not a GTIN)", materialID)
}

// GLN resolves the GLN for a canonical plant id.
func (r *Resolver) GLN(plantID, eventID string) (string, error) {
	if plantID == "" {
		return "", errors.New(errors.CodeGS1GLNNotFound, eventID, "plant id empty; GLN not resolvable")
	}
	if g, ok := r.mapping.GLN[plantID]; ok {
		return g, nil
	}
	return "", errors.New(errors.CodeGS1GLNNotFound, eventID,
		"no explicit GLN mapping for plant %q (plant id is not a GLN)", plantID)
}

// SSCC resolves the SSCC for a logistics unit key (e.g. delivery).
func (r *Resolver) SSCC(key, eventID string) (string, error) {
	if key == "" {
		return "", errors.New(errors.CodeGS1SSCCNotFound, eventID, "key empty; SSCC not resolvable")
	}
	if s, ok := r.mapping.SSCC[key]; ok {
		return s, nil
	}
	return "", errors.New(errors.CodeGS1IdentifierNotResolved, eventID,
		"no explicit SSCC mapping for %q", key)
}

// BatchLGTIN resolves an explicit LGTIN mapping for a batch, if configured.
// A batch id itself is never treated as a GS1 key.
func (r *Resolver) BatchLGTIN(batchID string) (string, bool) {
	if batchID == "" {
		return "", false
	}
	l, ok := r.mapping.Batch[batchID]
	return l, ok
}

// EPC builds the EPC URN for a material+batch pair when GTIN resolution and
// batch mapping are possible; otherwise it reports a typed error.
func (r *Resolver) EPC(materialID, batchID, eventID string) (string, error) {
	gtin, err := r.GTIN(materialID, eventID)
	if err != nil {
		return "", err
	}
	if lgtin, ok := r.BatchLGTIN(batchID); ok && lgtin != "" {
		return fmt.Sprintf("urn:epc:class:lgtin:%s.%s", gtin, lgtin), nil
	}
	// Without an explicit batch serial/lot mapping the EPC cannot be built.
	return "", errors.New(errors.CodeGS1IdentifierNotResolved, eventID,
		"no explicit LGTIN lot mapping for batch %q", batchID)
}

// ResolutionStats summarizes mapping coverage for the run summary.
type ResolutionStats struct {
	GTINEntries  int
	GLNEntries   int
	SSCCEntries  int
	LGTINEntries int
}

// Stats returns mapping coverage.
func (r *Resolver) Stats() ResolutionStats {
	return ResolutionStats{
		GTINEntries:  len(r.mapping.GTIN),
		GLNEntries:   len(r.mapping.GLN),
		SSCCEntries:  len(r.mapping.SSCC),
		LGTINEntries: len(r.mapping.Batch),
	}
}

// SortedKeys is a helper for deterministic iteration in tests.
func SortedKeys(m map[string]string) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}

// NormalizeID trims and upper-cases an identifier for stable comparisons.
func NormalizeID(id string) string {
	return strings.ToUpper(strings.TrimSpace(id))
}
