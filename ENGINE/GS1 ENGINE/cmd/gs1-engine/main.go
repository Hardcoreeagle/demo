// Command gs1-engine consumes the Canonical Model output and produces
// domain-partitioned, validated GS1 EPCIS 2.0.1 JSON.
package main

import (
	"flag"
	"fmt"
	"os"
	"path/filepath"

	"gs1-engine/internal/pipeline"
)

// defaultCanonicalDir discovers the GS1 ENGINE "input/canonical" directory in a
// portable, machine-independent way. It never hardcodes an absolute or
// user-specific path. Resolution order:
//  1. Walk up from the current working directory looking for a directory that
//     contains "input/canonical" (works when run from anywhere inside the
//     GS1 ENGINE tree, e.g. `go run ./cmd/gs1-engine`).
//  2. Walk up from the executable's own directory as a fallback.
//
// If discovery fails, an empty string is returned and the caller falls back to
// the conventional relative path, which the pipeline resolves against the
// current working directory.
func defaultCanonicalDir() string {
	candidates := []string{}
	if cwd, err := os.Getwd(); err == nil {
		candidates = append(candidates, cwd)
	}
	if exe, err := os.Executable(); err == nil {
		candidates = append(candidates, filepath.Dir(exe))
	}
	for _, start := range candidates {
		if dir := findUpward(start, filepath.Join("input", "canonical")); dir != "" {
			return dir
		}
	}
	return ""
}

// findUpward walks from start toward the filesystem root, returning the first
// resolved <dir>/<rel> that exists, or "" if none is found.
func findUpward(start, rel string) string {
	dir := start
	for {
		candidate := filepath.Join(dir, rel)
		if info, err := os.Stat(candidate); err == nil && info.IsDir() {
			return candidate
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return ""
		}
		dir = parent
	}
}

func main() {
	// Portable defaults derived at runtime from the discovered GS1 ENGINE
	// input directory. No absolute or user-specific paths are embedded.
	canonicalDir := defaultCanonicalDir()
	defaultEvents := filepath.Join("input", "canonical", "business_events.json")
	defaultGenealogy := filepath.Join("input", "canonical", "finished_batch_genealogy.json")
	if canonicalDir != "" {
		defaultEvents = filepath.Join(canonicalDir, "business_events.json")
		defaultGenealogy = filepath.Join(canonicalDir, "finished_batch_genealogy.json")
	}

	var (
		events       = flag.String("events", defaultEvents, "path to canonical business_events.json")
		genealogy    = flag.String("genealogy", defaultGenealogy, "path to canonical finished_batch_genealogy.json")
		output       = flag.String("output", filepath.Join("output", "epcis"), "output directory for domain EPCIS files")
		idMap        = flag.String("identifiers", "", "optional explicit identifier map JSON (gtin/gln/sscc/batch_lgtin)")
		creationDate = flag.String("creation-date", "", "EPCIS creationDate (RFC3339); default deterministic fixed value")
	)
	flag.Parse()

	sum, err := pipeline.Run(pipeline.Options{
		EventsPath:    *events,
		GenealogyPath: *genealogy,
		OutputDir:     *output,
		IdentifierMap: *idMap,
		CreationDate:  *creationDate,
		Stdout:        os.Stdout,
	})
	if err != nil {
		fmt.Fprintf(os.Stderr, "gs1-engine: %v\n", err)
		os.Exit(1)
	}
	_ = sum
}
