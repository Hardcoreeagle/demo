package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

type BatchPackage struct {
	BatchID                string      `json:"batch_id"`
	FinishedGenealogy      interface{} `json:"finished_genealogy"`
	SemiFinishedGenealogy  interface{} `json:"semifinished_genealogy"`
	DirectRawMaterialFlow  interface{} `json:"direct_raw_material_flow,omitempty"`
	CoatingRawMaterialFlow interface{} `json:"coating_raw_material_flow,omitempty"`
	SubBatchesGenealogy    interface{} `json:"sub_batches_genealogy"`
	Events                 interface{} `json:"events"`
	Relationships          interface{} `json:"relationships"`
	Resolution             interface{} `json:"resolution"`
}

type RawBatchPackage struct {
	BatchID              string      `json:"batch_id"`
	RawMaterialGenealogy interface{} `json:"raw_material_genealogy"`
	BusinessObjects      interface{} `json:"business_objects"`
	Events               interface{} `json:"events"`
	Relationships        interface{} `json:"relationships"`
	Resolution           interface{} `json:"resolution"`
}

type Bundle struct {
	FinishedBatches     map[string]*BatchPackage    `json:"finished_batches"`
	RawBatches          map[string]*RawBatchPackage `json:"raw_batches"`
	RelationshipCatalog interface{}                 `json:"relationship_catalog"`
	BusinessEvents      interface{}                 `json:"business_events"`
	AllBatchGenealogies interface{}                 `json:"all_batch_genealogies"`
	BusinessObjectsList []BOMeta                    `json:"business_objects_list"`
}

type BOMeta struct {
	Index       string `json:"index"`
	Name        string `json:"name"`
	Filename    string `json:"filename"`
	SourceTable string `json:"source_tables"`
	RecordCount int    `json:"record_count"`
}

func readJSON(path string, target interface{}) error {
	b, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	return json.Unmarshal(b, target)
}

func main() {
	outputDir := "output"
	webDir := "web"
	jsDir := filepath.Join(webDir, "js")
	_ = os.MkdirAll(jsDir, 0755)

	bundle := &Bundle{
		FinishedBatches: make(map[string]*BatchPackage),
		RawBatches:      make(map[string]*RawBatchPackage),
	}

	// 1. Load Batches (Single Golden Finished Batch Genealogy)
	fbgDir := filepath.Join(outputDir, "finished_batch_genealogy")
	batches := []string{"PF05043"}

	for _, bID := range batches {
		bDir := filepath.Join(fbgDir, bID)
		pkg := &BatchPackage{BatchID: bID}

		var fg map[string]interface{}
		if err := readJSON(filepath.Join(bDir, "finished_batch_genealogy.json"), &fg); err == nil {
			pkg.FinishedGenealogy = fg
			if bg, ok := fg["batch_genealogy"].(map[string]interface{}); ok {
				if bo, ok := bg["business_objects"].(map[string]interface{}); ok {
					pkg.DirectRawMaterialFlow = bo["direct_raw_material_flow"]
					pkg.CoatingRawMaterialFlow = bo["coating_raw_material_flow"]
				}
			}
		}

		var sfg interface{}
		if err := readJSON(filepath.Join(bDir, "semifinished_batch_genealogy.json"), &sfg); err == nil {
			pkg.SemiFinishedGenealogy = sfg
		}

		var sbg interface{}
		if err := readJSON(filepath.Join(bDir, "sub_batches_genealogy.json"), &sbg); err == nil {
			pkg.SubBatchesGenealogy = sbg
		}

		var evts interface{}
		if err := readJSON(filepath.Join(bDir, "events.json"), &evts); err == nil {
			pkg.Events = evts
		}

		var rels interface{}
		if err := readJSON(filepath.Join(bDir, "relationships.json"), &rels); err == nil {
			pkg.Relationships = rels
		}

		var res interface{}
		if err := readJSON(filepath.Join(bDir, "resolution.json"), &res); err == nil {
			pkg.Resolution = res
		}

		bundle.FinishedBatches[bID] = pkg
	}

	// 1b. Load Raw Material Batches
	rmgDir := filepath.Join(outputDir, "raw_material_genealogy")
	if rmEntries, err := os.ReadDir(rmgDir); err == nil {
		for _, e := range rmEntries {
			if !e.IsDir() {
				continue
			}
			rmID := e.Name()
			rmDir := filepath.Join(rmgDir, rmID)
			rmPkg := &RawBatchPackage{BatchID: rmID}

			var rmGen interface{}
			if err := readJSON(filepath.Join(rmDir, "raw_material_genealogy.json"), &rmGen); err == nil {
				rmPkg.RawMaterialGenealogy = rmGen
			}

			var bo interface{}
			if err := readJSON(filepath.Join(rmDir, "business_objects.json"), &bo); err == nil {
				rmPkg.BusinessObjects = bo
			}

			var evts interface{}
			if err := readJSON(filepath.Join(rmDir, "events.json"), &evts); err == nil {
				rmPkg.Events = evts
			}

			var rels interface{}
			if err := readJSON(filepath.Join(rmDir, "relationships.json"), &rels); err == nil {
				rmPkg.Relationships = rels
			}

			var res interface{}
			if err := readJSON(filepath.Join(rmDir, "resolution.json"), &res); err == nil {
				rmPkg.Resolution = res
			}

			bundle.RawBatches[rmID] = rmPkg
		}
	}

	// 2. Load Relationship Catalog
	var catalog interface{}
	if err := readJSON(filepath.Join(outputDir, "relationship_catalog.json"), &catalog); err == nil {
		bundle.RelationshipCatalog = catalog
	}

	// 3. Load Business Events
	var events interface{}
	if err := readJSON(filepath.Join(outputDir, "business_events.json"), &events); err == nil {
		bundle.BusinessEvents = events
	}

	// 4. Load All Batch Genealogies
	var allBatches interface{}
	if err := readJSON(filepath.Join(outputDir, "all_batch_genealogies.json"), &allBatches); err == nil {
		bundle.AllBatchGenealogies = allBatches
	}

	// 5. Build Business Objects Manifest
	boDir := filepath.Join(outputDir, "business_objects")
	boFiles, _ := os.ReadDir(boDir)
	for _, f := range boFiles {
		if filepath.Ext(f.Name()) == ".json" {
			var records []interface{}
			_ = readJSON(filepath.Join(boDir, f.Name()), &records)
			bundle.BusinessObjectsList = append(bundle.BusinessObjectsList, BOMeta{
				Index:       f.Name()[:2],
				Name:        f.Name(),
				Filename:    f.Name(),
				RecordCount: len(records),
			})
		}
	}

	bundleBytes, err := json.Marshal(bundle)
	if err != nil {
		fmt.Printf("Error bundling: %v\n", err)
		return
	}

	jsContent := fmt.Sprintf("// Auto-generated SAP S/4HANA & ECC Traceability Data Bundle\nwindow.BUNDLE_DATA = %s;\n", string(bundleBytes))

	targetPath := filepath.Join(jsDir, "data-bundle.js")
	if err := os.WriteFile(targetPath, []byte(jsContent), 0644); err != nil {
		fmt.Printf("Error writing bundle: %v\n", err)
		return
	}

	fmt.Printf("[✓] Generated standalone bundle in %s (%d KB)\n", targetPath, len(jsContent)/1024)
}
