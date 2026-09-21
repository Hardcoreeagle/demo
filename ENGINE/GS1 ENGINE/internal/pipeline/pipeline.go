// Package pipeline orchestrates the GS1 Engine stages:
//
//	Canonical Input -> Normalization -> Classification -> Relationship/Genealogy
//	-> GS1 Identifier Resolution -> CBV Mapping -> EPCIS Construction ->
//	Deduplication -> Validation -> Domain Partitioning -> JSON Output
package pipeline

import (
	"fmt"
	"io"

	"gs1-engine/internal/canonical/model"
	"gs1-engine/internal/canonical/source"
	"gs1-engine/internal/classifier"
	"gs1-engine/internal/epcis/document"
	"gs1-engine/internal/epcis/event"
	"gs1-engine/internal/errors"
	"gs1-engine/internal/gs1/identifier"
	"gs1-engine/internal/mapping"
	"gs1-engine/internal/normalization"
	"gs1-engine/internal/relationship"
)

// Options configures one pipeline run.
type Options struct {
	EventsPath     string
	GenealogyPath  string
	OutputDir      string
	IdentifierMap  string
	CreationDate   string // RFC3339; empty = fixed deterministic default
	CreationDateFn func() string
	Stdout         io.Writer
}

// Summary reports the execution counts (no logistics count: the domain does
// not exist in this engine).
type Summary struct {
	CanonicalEvents   int
	NormalizedEvents  int
	NormalizedErrors  int
	Classified        map[string]int
	EPCISEvents       int
	DuplicatesRemoved int
	Unsupported       int
	MappingErrors     int
	ValidationFails   int
	PerDomain         map[string]int
	FilesWritten      []string
	IDStats           identifier.ResolutionStats
}

// Run executes the full pipeline.
func Run(opts Options) (*Summary, error) {
	sum := &Summary{Classified: map[string]int{}, PerDomain: map[string]int{}}

	// 1-2. Load canonical inputs.
	loaded, err := source.Load(opts.EventsPath, opts.GenealogyPath)
	if err != nil {
		return nil, err
	}
	sum.CanonicalEvents = len(loaded.Events)

	// 3. Normalize.
	normalized, normErrs := normalization.Load(loaded.Events, model.SourceBusinessEvents)
	sum.NormalizedEvents = len(normalized)
	sum.NormalizedErrors = len(normErrs)
	for _, e := range normErrs {
		fmt.Fprintf(opts.Stdout, "normalization: %v\n", e)
	}

	// 4. Classify.
	classified := mapping.ClassifyAll(normalized)
	for _, c := range classified {
		sum.Classified[string(c.Category)]++
	}

	// 5-7. Relationships, GS1 identifiers, CBV (CBV is resolved inside the
	// mappers; identifier mapping is loaded explicitly).
	genealogy := loaded.Genealogy
	if genealogy == nil {
		return nil, errors.New(errors.CodeCanonicalInputInvalid, "", "genealogy context missing")
	}
	resolver := relationship.New(genealogy)
	idMap, err := identifier.LoadMappingFile(opts.IdentifierMap)
	if err != nil {
		return nil, err
	}
	ids := identifier.New(idMap)
	sum.IDStats = ids.Stats()

	// 8-9. EPCIS construction + deduplication. Production transformations are
	// built from the canonical genealogy context first; yields describing a
	// physical occurrence already represented by a canonical transformation
	// are absorbed (spec \u00a717) and excluded from generic mapping.
	m := &mapping.Mapper{Resolver: resolver, IDs: ids}

	var yieldEvents []*normalization.NormalizedEvent
	for _, c := range classified {
		if c.Category == classifier.VISIBILITY_EVENT && c.Event.EventName == "YieldRecorded" {
			yieldEvents = append(yieldEvents, c.Event)
		}
	}
	prod := mapping.BuildProductionEvents(resolver.Transformations(), yieldEvents, m)
	for _, e := range prod.MappingErrors {
		fmt.Fprintf(opts.Stdout, "production mapping: %v\n", e)
	}

	// Generic mapping skips ALL yields; BuildProductionEvents already emitted
	// the transformation events and absorbed the matching yields, so the
	// remaining (non-absorbed) yields are mapped individually here.
	skip := map[string]bool{}
	for _, y := range yieldEvents {
		skip[y.EventID] = true
	}
	result, err := m.Map(classified, skip)
	if err != nil {
		return nil, err
	}
	absorbed := map[string]bool{}
	for _, id := range prod.AbsorbedYields {
		absorbed[id] = true
	}
	for _, c := range classified {
		if c.Category == classifier.VISIBILITY_EVENT && c.Event.EventName == "YieldRecorded" &&
			!absorbed[c.Event.EventID] {
			r2, err := m.Map([]mapping.Classified{c}, nil)
			if err == nil {
				result.Events = append(result.Events, r2.Events...)
				result.Duplicates = append(result.Duplicates, r2.Duplicates...)
				result.MappingErrors = append(result.MappingErrors, r2.MappingErrors...)
			}
		}
	}

	result.Events = append(result.Events, prod.Events...)
	sum.EPCISEvents = len(result.Events)
	sum.DuplicatesRemoved = len(result.Duplicates)
	sum.Unsupported = len(result.Unsupported)
	sum.MappingErrors = len(result.MappingErrors)
	for _, e := range result.MappingErrors {
		if opts.Stdout != nil {
			fmt.Fprintf(opts.Stdout, "mapping: %v\n", e)
		}
	}

	// 10-12. Partition, build, validate, write.
	creationDate := opts.CreationDate
	if creationDate == "" {
		creationDate = "1970-01-01T00:00:00Z" // deterministic default; overridable
	}
	if opts.CreationDateFn != nil {
		creationDate = opts.CreationDateFn()
	}

	domains := mapping.Partition(result.Events)
	domainOrder := []string{"planning", "procurement", "production", "quality", "sales", "returns"}
	for _, dom := range domainOrder {
		events := domains[dom]
		sum.PerDomain[dom] = len(events)
		// Domain files only when valid events exist — no empty/fake documents.
		if len(events) == 0 {
			continue
		}

		docEvents := make([]event.EPCISEvent, len(events))
		copy(docEvents, events)
		doc, err := document.Build(docEvents, creationDate)
		if err != nil {
			return nil, err
		}
		if verrs := document.Validate(doc); len(verrs) > 0 {
			sum.ValidationFails += len(verrs)
			for _, ve := range verrs {
				fmt.Fprintf(opts.Stdout, "validation: %v\n", ve)
			}
			continue
		}
		path := fmt.Sprintf("%s/%s/epcis-%s.json", opts.OutputDir, dom, dom)
		if err := document.WriteJSON(doc, path); err != nil {
			return nil, err
		}
		sum.FilesWritten = append(sum.FilesWritten, path)
	}

	// 13. Summary.
	printSummary(opts.Stdout, sum)
	return sum, nil
}

func printSummary(w io.Writer, s *Summary) {
	if w == nil {
		return
	}
	fmt.Fprintln(w, "GS1 Engine run summary")
	fmt.Fprintf(w, "Canonical events:        %d\n", s.CanonicalEvents)
	fmt.Fprintf(w, "Normalized events:       %d\n", s.NormalizedEvents)
	fmt.Fprintf(w, "EPCIS events generated:  %d\n", s.EPCISEvents)
	fmt.Fprintf(w, "Duplicates removed:      %d\n", s.DuplicatesRemoved)
	fmt.Fprintf(w, "Unsupported events:      %d\n", s.Unsupported)
	fmt.Fprintf(w, "Mapping errors:          %d\n", s.MappingErrors)
	fmt.Fprintf(w, "Validation failures:     %d\n", s.ValidationFails)
	fmt.Fprintf(w, "Planning events:         %d\n", s.PerDomain["planning"])
	fmt.Fprintf(w, "Procurement events:      %d\n", s.PerDomain["procurement"])
	fmt.Fprintf(w, "Production events:       %d\n", s.PerDomain["production"])
	fmt.Fprintf(w, "Quality events:          %d\n", s.PerDomain["quality"])
	fmt.Fprintf(w, "Sales events:            %d\n", s.PerDomain["sales"])
	fmt.Fprintf(w, "Returns events:          %d\n", s.PerDomain["returns"])
	for _, f := range s.FilesWritten {
		fmt.Fprintf(w, "Written: %s\n", f)
	}
}
