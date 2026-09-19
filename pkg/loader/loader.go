package loader

import (
	"encoding/csv"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

type Table struct {
	Name    string
	Headers []string
	ColMap  map[string]int
	Rows    [][]string
}

func (t *Table) Get(row []string, col string) string {
	idx, ok := t.ColMap[col]
	if !ok || idx >= len(row) {
		return ""
	}
	return Clean(row[idx])
}

func (t *Table) GetFloat(row []string, col string) float64 {
	val := t.Get(row, col)
	if val == "" {
		return 0
	}
	f, _ := strconv.ParseFloat(val, 64)
	return f
}

func (t *Table) GetInt(row []string, col string) int {
	val := t.Get(row, col)
	if val == "" {
		return 0
	}
	i, _ := strconv.Atoi(val)
	return i
}

func (t *Table) IndexBy(col string) map[string][][]string {
	idxMap := make(map[string][][]string)
	for _, r := range t.Rows {
		key := t.Get(r, col)
		if key != "" {
			idxMap[key] = append(idxMap[key], r)
		}
	}
	return idxMap
}

func (t *Table) IndexUniqueBy(col string) map[string][]string {
	idxMap := make(map[string][]string)
	for _, r := range t.Rows {
		key := t.Get(r, col)
		if key != "" {
			if _, exists := idxMap[key]; !exists {
				idxMap[key] = r
			}
		}
	}
	return idxMap
}

func (t *Table) IndexComposite(cols ...string) map[string][][]string {
	idxMap := make(map[string][][]string)
	for _, r := range t.Rows {
		var parts []string
		for _, col := range cols {
			parts = append(parts, t.Get(r, col))
		}
		key := strings.Join(parts, "|")
		idxMap[key] = append(idxMap[key], r)
	}
	return idxMap
}

func Clean(s string) string {
	s = strings.TrimSpace(s)
	s = strings.Trim(s, "\"")
	return strings.TrimSpace(s)
}

// CleanID strips leading zeros for display, or leaves intact if alphanumeric
func CleanID(s string) string {
	s = Clean(s)
	trimmed := strings.TrimLeft(s, "0")
	if trimmed == "" && s != "" {
		return "0"
	}
	if trimmed != "" {
		return trimmed
	}
	return s
}

func LoadTable(dir, filename string) (*Table, error) {
	path := filepath.Join(dir, filename)
	file, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("could not open %s: %w", filename, err)
	}
	defer file.Close()

	r := csv.NewReader(file)
	r.LazyQuotes = true
	r.FieldsPerRecord = -1 // flexible fields

	headers, err := r.Read()
	if err != nil {
		return nil, fmt.Errorf("could not read header for %s: %w", filename, err)
	}

	colMap := make(map[string]int)
	for i, h := range headers {
		colMap[Clean(h)] = i
	}

	var rows [][]string
	for {
		record, err := r.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			// Skip or tolerate malformed lines
			continue
		}
		rows = append(rows, record)
	}

	baseName := strings.TrimSuffix(filepath.Base(filename), filepath.Ext(filename))
	return &Table{
		Name:    baseName,
		Headers: headers,
		ColMap:  colMap,
		Rows:    rows,
	}, nil
}
