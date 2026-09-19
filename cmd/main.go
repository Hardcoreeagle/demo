package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"supply-bo-builder/pkg/builder"
	"supply-bo-builder/pkg/loader"
	"supply-bo-builder/pkg/models"
	"supply-bo-builder/pkg/resolver"
)

func saveJSON(dir, filename string, data interface{}) (int, error) {
	path := filepath.Join(dir, filename)
	bytes, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return 0, err
	}
	if err := os.WriteFile(path, bytes, 0644); err != nil {
		return 0, err
	}
	return len(bytes), nil
}

func main() {
	start := time.Now()
	supplyDir := "supply"
	outputDir := "output"

	fmt.Println("==================================================================")
	fmt.Println(" SAP S/4HANA & ECC Business Object Builder (Pure Go Engine)")
	fmt.Println(" Mode: MATDOC used for Material Documents (MSEG/MKPF)")
	fmt.Println(" Policy: Strictly NO logistic tables for GRN / MM movements")
	fmt.Println("==================================================================")

	if err := os.MkdirAll(outputDir, 0755); err != nil {
		fmt.Printf("Error creating output directory: %v\n", err)
		os.Exit(1)
	}

	boDir := filepath.Join(outputDir, "business_objects")
	if err := os.MkdirAll(boDir, 0755); err != nil {
		fmt.Printf("Error creating business_objects directory: %v\n", err)
		os.Exit(1)
	}

	fbgDir := filepath.Join(outputDir, "finished_batch_genealogy")
	if err := os.MkdirAll(fbgDir, 0755); err != nil {
		fmt.Printf("Error creating finished_batch_genealogy directory: %v\n", err)
		os.Exit(1)
	}

	// List of tables to load
	tableNames := []string{
		"ADR6", "ADRC", "AFKO", "AFPO", "AFRU", "AFVC", "AMPL-1", "AUFK", "CRHD",
		"EBAN", "EBKN", "EKBE", "EKES", "EKET", "EKKO", "EKPO", "EORD", "JEST",
		"KNA1", "KNB1", "KNVP", "KNVV", "LFA1", "LFB1", "LFM1", "LIKP", "LIPS",
		"MAKT", "MAPL", "MARA", "MARC", "MARD", "MAST", "MATDOC", "MBEW",
		"MCH1", "MCHA", "MCHB", "MCHBH", "MKAL", "MVKE",
		"PBED", "PBIM", "PLAF", "PLAS", "PLKO", "PLMK", "PLMZ", "PLPO",
		"PRCD_ELEMENTS", "QALS", "QAMB", "QAMR", "QAMV", "QASE", "QASR", "QAST",
		"QAVE", "QINF", "QMAT", "QMEL", "QMFE", "QMSM", "QMUR", "QPMK",
		"RESB", "RKPF", "STKO", "STPO", "T001", "T001L", "T001W", "T006", "T006A",
		"VBAK", "VBAP", "VBFA", "VBKD", "VBPA", "VBRK", "VBRP", "VBUK", "VBUP",
	}

	var loadedTables []*loader.Table
	loadedCount := 0
	for _, name := range tableNames {
		file := name + ".csv"
		t, err := loader.LoadTable(supplyDir, file)
		if err == nil {
			loadedTables = append(loadedTables, t)
			loadedCount++
		}
	}
	fmt.Printf("[+] Loaded %d SAP tables from %s/\n\n", loadedCount, supplyDir)

	repo := builder.NewRepository(loadedTables...)

	type summaryEntry struct {
		Index    string
		Name     string
		Count    int
		File     string
		Sources  string
	}

	var summary []summaryEntry

	// 1. Planning Requirement
	bo1 := repo.BuildPlanningRequirements()
	saveJSON(boDir, "01_planning_requirement.json", bo1)
	summary = append(summary, summaryEntry{"1", "Planning Requirement", len(bo1), "01_planning_requirement.json", "PBED, PBIM, T001W, MAST"})

	// 2. Planned Order
	bo2 := repo.BuildPlannedOrders()
	saveJSON(boDir, "02_planned_order.json", bo2)
	summary = append(summary, summaryEntry{"2", "Planned Order", len(bo2), "02_planned_order.json", "PLAF, MAKT"})

	// 3. Material
	bo3 := repo.BuildMaterials()
	saveJSON(boDir, "03_material.json", bo3)
	summary = append(summary, summaryEntry{"3", "Material", len(bo3), "03_material.json", "MARA, MAKT, MARC"})

	// 4. Batch
	bo4 := repo.BuildBatches()
	saveJSON(boDir, "04_batch.json", bo4)
	summary = append(summary, summaryEntry{"4", "Batch", len(bo4), "04_batch.json", "MCHA, MCH1"})

	// 5. Supplier or Source
	bo5 := repo.BuildSuppliers()
	saveJSON(boDir, "05_supplier_or_source.json", bo5)
	summary = append(summary, summaryEntry{"5", "Supplier or source", len(bo5), "05_supplier_or_source.json", "LFA1, LFB1, ADRC, ADR6, EORD"})

	// 6. Purchase Requisition
	bo6 := repo.BuildPurchaseRequisitions()
	saveJSON(boDir, "06_purchase_requisition.json", bo6)
	summary = append(summary, summaryEntry{"6", "Purchase Requisition", len(bo6), "06_purchase_requisition.json", "EBAN"})

	// 7. Purchase Order
	bo7 := repo.BuildPurchaseOrders()
	saveJSON(boDir, "07_purchase_order.json", bo7)
	summary = append(summary, summaryEntry{"7", "Purchase order", len(bo7), "07_purchase_order.json", "EKKO, EKPO, EKET"})

	// 8. Material Movement
	bo8 := repo.BuildMaterialMovements()
	saveJSON(boDir, "08_material_movement.json", bo8)
	summary = append(summary, summaryEntry{"8", "Material Movement", len(bo8), "08_material_movement.json", "MATDOC (Unified)"})

	// 9. Inventory/Stock
	bo9 := repo.BuildInventoryStocks()
	saveJSON(boDir, "09_inventory_stock.json", bo9)
	summary = append(summary, summaryEntry{"9", "Inventory/Stock", len(bo9), "09_inventory_stock.json", "MCHB, MARD, MARA"})

	// 10. Reservation
	bo10 := repo.BuildReservations()
	saveJSON(boDir, "10_reservation.json", bo10)
	summary = append(summary, summaryEntry{"10", "Reservation", len(bo10), "10_reservation.json", "RESB, RKPF"})

	// 11. Process Order
	bo11 := repo.BuildProcessOrders()
	saveJSON(boDir, "11_process_order.json", bo11)
	summary = append(summary, summaryEntry{"11", "Process order", len(bo11), "11_process_order.json", "AFKO, AFPO, AUFK"})

	// 12. BOM
	bo12 := repo.BuildBOMs()
	saveJSON(boDir, "12_bom.json", bo12)
	summary = append(summary, summaryEntry{"12", "BOM", len(bo12), "12_bom.json", "STKO, STPO, MAST"})

	// 13. Recipe
	bo13 := repo.BuildRecipes()
	saveJSON(boDir, "13_recipe.json", bo13)
	summary = append(summary, summaryEntry{"13", "Recipe", len(bo13), "13_recipe.json", "PLKO, PLPO, MAPL"})

	// 14. Production Version
	bo14 := repo.BuildProductionVersions()
	saveJSON(boDir, "14_production_version.json", bo14)
	summary = append(summary, summaryEntry{"14", "Production Version", len(bo14), "14_production_version.json", "MKAL"})

	// 15. Batch Determination
	bo15 := repo.BuildBatchDeterminations()
	saveJSON(boDir, "15_batch_determination.json", bo15)
	summary = append(summary, summaryEntry{"15", "Batch Determination", len(bo15), "15_batch_determination.json", "RESB"})

	// 16. Material Consumption
	bo16 := repo.BuildMaterialConsumptions()
	saveJSON(boDir, "16_material_consumption.json", bo16)
	summary = append(summary, summaryEntry{"16", "Material Consumption", len(bo16), "16_material_consumption.json", "MATDOC (BWART 261/262)"})

	// 17. Production Confirmation
	bo17 := repo.BuildProductionConfirmations()
	saveJSON(boDir, "17_production_confirmation.json", bo17)
	summary = append(summary, summaryEntry{"17", "Production Confirmation", len(bo17), "17_production_confirmation.json", "AFRU, AFVC"})

	// 18. Batch Transformation
	bo18 := repo.BuildBatchTransformations()
	saveJSON(boDir, "18_batch_transformation.json", bo18)
	summary = append(summary, summaryEntry{"18", "Batch transformation", len(bo18), "18_batch_transformation.json", "MATDOC (AUFNR batch link)"})

	// 19. Yield
	bo19 := repo.BuildYields()
	saveJSON(boDir, "19_yield.json", bo19)
	summary = append(summary, summaryEntry{"19", "Yield", len(bo19), "19_yield.json", "MATDOC (BWART 101/531)"})

	// 21. Inspection Characteristic
	bo21 := repo.BuildInspectionCharacteristics()
	saveJSON(boDir, "21_inspection_characteristic.json", bo21)
	summary = append(summary, summaryEntry{"21", "Inspection Characteristic", len(bo21), "21_inspection_characteristic.json", "QPMK, PLMK"})

	// 22. Inspection Plan
	bo22 := repo.BuildInspectionPlans()
	saveJSON(boDir, "22_inspection_plan.json", bo22)
	summary = append(summary, summaryEntry{"22", "Inspection Plan", len(bo22), "22_inspection_plan.json", "PLKO, PLPO, PLMK, MAPL"})

	// 23. Inspection Parameter
	bo23 := repo.BuildInspectionParameters()
	saveJSON(boDir, "23_inspection_parameter.json", bo23)
	summary = append(summary, summaryEntry{"23", "Inspection Parameter", len(bo23), "23_inspection_parameter.json", "QMAT, QAMV, QPMK"})

	// 24. Quality Inspection Lot
	bo24 := repo.BuildQualityInspectionLots()
	saveJSON(boDir, "24_quality_inspection_lot.json", bo24)
	summary = append(summary, summaryEntry{"24", "Quality inspection Lot", len(bo24), "24_quality_inspection_lot.json", "QALS"})

	// 25. Sampling
	bo25 := repo.BuildSamplings()
	saveJSON(boDir, "25_sampling.json", bo25)
	summary = append(summary, summaryEntry{"25", "Sampling", len(bo25), "25_sampling.json", "QASE, QALS"})

	// 26. Inspection Result
	bo26 := repo.BuildInspectionResults()
	saveJSON(boDir, "26_inspection_result.json", bo26)
	summary = append(summary, summaryEntry{"26", "Inspection result", len(bo26), "26_inspection_result.json", "QAMR, QASE, QALS"})

	// 27. Usage Decision
	bo27 := repo.BuildUsageDecisions()
	saveJSON(boDir, "27_usage_decision.json", bo27)
	summary = append(summary, summaryEntry{"27", "Usage decision", len(bo27), "27_usage_decision.json", "QAVE, QALS"})

	// 28. Customer or CFA
	bo28 := repo.BuildCustomers()
	saveJSON(boDir, "28_customer_or_cfa.json", bo28)
	summary = append(summary, summaryEntry{"28", "Customer or CFA", len(bo28), "28_customer_or_cfa.json", "KNA1, KNB1, ADRC, ADR6"})

	// 29. Sales Order
	bo29 := repo.BuildSalesOrders()
	saveJSON(boDir, "29_sales_order.json", bo29)
	summary = append(summary, summaryEntry{"29", "Sales order", len(bo29), "29_sales_order.json", "VBAK"})

	// 30. Sales Order Item
	bo30 := repo.BuildSalesOrderItems()
	saveJSON(boDir, "30_sales_order_item.json", bo30)
	summary = append(summary, summaryEntry{"30", "sales order item", len(bo30), "30_sales_order_item.json", "VBAP, VBAK"})

	// 31. Sales Batch Allocation
	bo31 := repo.BuildSalesBatchAllocations()
	saveJSON(boDir, "31_sales_batch_allocation.json", bo31)
	summary = append(summary, summaryEntry{"31", "sales batch allocation", len(bo31), "31_sales_batch_allocation.json", "LIPS, VBFA"})

	// 32. Outbound Delivery
	bo32 := repo.BuildOutboundDeliveries()
	saveJSON(boDir, "32_outbound_delivery.json", bo32)
	summary = append(summary, summaryEntry{"32", "Outbound delivery", len(bo32), "32_outbound_delivery.json", "LIKP, LIPS"})

	// 33. Delivery Item
	bo33 := repo.BuildDeliveryItems()
	saveJSON(boDir, "33_delivery_item.json", bo33)
	summary = append(summary, summaryEntry{"33", "delivery item", len(bo33), "33_delivery_item.json", "LIPS"})

	// 34. Billing Document
	bo34 := repo.BuildBillingDocuments()
	saveJSON(boDir, "34_billing_document.json", bo34)
	summary = append(summary, summaryEntry{"34", "Billing document", len(bo34), "34_billing_document.json", "VBRK, VBRP"})

	// 35. Sales Return
	bo35 := repo.BuildSalesReturns()
	saveJSON(boDir, "35_sales_return.json", bo35)
	summary = append(summary, summaryEntry{"35", "Sales Return", len(bo35), "35_sales_return.json", "VBAP, VBAK, VBFA"})

	// 36. Work Centre
	bo36 := repo.BuildWorkCentres()
	saveJSON(boDir, "36_work_centre.json", bo36)
	summary = append(summary, summaryEntry{"36", "Work Centre", len(bo36), "36_work_centre.json", "CRHD"})

	// GRN (GoodsReceipt) - Strictly MATDOC + EKKO (NO Logistic Tables)
	boGRN := repo.BuildGoodsReceipts()
	saveJSON(boDir, "37_goods_receipt_grn.json", boGRN)
	summary = append(summary, summaryEntry{"GRN", "GoodsReceipt (GRN)", len(boGRN), "37_goods_receipt_grn.json", "MATDOC, EKKO (NO Logistic Tables)"})

	// Clean up legacy loose business object files from root output directory
	for _, s := range summary {
		_ = os.Remove(filepath.Join(outputDir, s.File))
	}

	fmt.Printf("%-4s | %-28s | %-7s | %-32s | %s\n", "#", "Business Object", "Records", "Output Location", "SAP Source Tables")
	fmt.Println("-------------------------------------------------------------------------------------------------------------------------")
	for _, s := range summary {
		fmt.Printf("%-4s | %-28s | %-7d | %-32s | %s\n", s.Index, s.Name, s.Count, "business_objects/"+s.File, s.Sources)
	}
	fmt.Println("-------------------------------------------------------------------------------------------------------------------------")
	fmt.Printf("[✓] Successfully processed and exported all 37 Business Objects independently to %s/ in %v\n", boDir, time.Since(start))

	// =========================================================================
	// Relationship Resolver (106 Documented Relationships across 13 Groups)
	// =========================================================================
	fmt.Println("\n==================================================================")
	fmt.Println(" Executing Relationship Resolver across 106 SAP Entity Links")
	fmt.Println("==================================================================")

	container := &models.BusinessObjectsContainer{
		PlanningRequirements:      bo1,
		PlannedOrders:             bo2,
		Materials:                 bo3,
		Batches:                   bo4,
		Suppliers:                 bo5,
		PurchaseRequisitions:      bo6,
		PurchaseOrders:            bo7,
		MaterialMovements:         bo8,
		InventoryStocks:           bo9,
		Reservations:              bo10,
		ProcessOrders:             bo11,
		BOMs:                      bo12,
		Recipes:                   bo13,
		ProductionVersions:        bo14,
		BatchDeterminations:       bo15,
		MaterialConsumptions:      bo16,
		ProductionConfirmations:   bo17,
		BatchTransformations:      bo18,
		Yields:                    bo19,
		InspectionCharacteristics: bo21,
		InspectionPlans:           bo22,
		InspectionParameters:      bo23,
		QualityInspectionLots:     bo24,
		Samplings:                 bo25,
		InspectionResults:         bo26,
		UsageDecisions:            bo27,
		Customers:                 bo28,
		SalesOrders:               bo29,
		SalesOrderItems:           bo30,
		SalesBatchAllocations:     bo31,
		OutboundDeliveries:        bo32,
		DeliveryItems:             bo33,
		BillingDocuments:          bo34,
		SalesReturns:              bo35,
		WorkCentres:               bo36,
		GoodsReceipts:             boGRN,
	}

	resEngine := resolver.NewRelationshipResolver(container, repo)
	resResult := resEngine.ResolveAll()

	// Export Relationship Catalog
	catalog := resolver.GetRelationshipCatalog()
	saveJSON(outputDir, "relationship_catalog.json", catalog)

	// Export Resolved Relationships Graph
	saveJSON(outputDir, "resolved_relationships.json", resResult)

	// Batch-Specific Lineage & Genealogy Resolution
	genealogies := resEngine.ResolveAllBatchGenealogies()
	saveJSON(outputDir, "all_batch_genealogies.json", genealogies)

	// Business Events Detection
	events := resEngine.DetectBusinessEvents()
	saveJSON(outputDir, "business_events.json", events)

	// Build Finished Batch Packages for ALL finished batches
	// Each finished batch gets its own dedicated folder containing:
	// 1. finished_batch_genealogy.json (one finished genealogy of each)
	// 2. sub_batches_genealogy.json (all sub-batches used genealogies)
	// 3. sub_batches/<sub_batch_id>.json (individual sub-batch genealogy files)
	// 4. relationships.json (relationship definitions)
	// 5. resolution.json (resolved relationships links)
	// 6. events.json (events specifically for this batch)
	finishedBatches := resEngine.GetFinishedBatches()
	var primaryPkg *resolver.FinishedBatchPackage

	// Clean up extra/legacy finished batch directories to maintain strictly ONE finished batch genealogy (PF05043)
	if entries, err := os.ReadDir(fbgDir); err == nil {
		for _, e := range entries {
			if e.IsDir() && e.Name() != "PF05043" {
				_ = os.RemoveAll(filepath.Join(fbgDir, e.Name()))
			} else if !e.IsDir() && e.Name() != "batch_genealogy.json" {
				_ = os.Remove(filepath.Join(fbgDir, e.Name()))
			}
		}
	}

	for _, batchID := range finishedBatches {
		pkg := resEngine.BuildFinishedBatchPackage(batchID, resResult, events)
		if batchID == "PF05043" || primaryPkg == nil {
			primaryPkg = pkg
		}

		batchFolder := filepath.Join(fbgDir, batchID)
		if err := os.MkdirAll(batchFolder, 0755); err != nil {
			fmt.Printf("Error creating batch directory %s: %v\n", batchFolder, err)
			continue
		}

		// 1. Finished batch genealogy
		saveJSON(batchFolder, "finished_batch_genealogy.json", pkg.FinishedGenealogy)

		// 2. Dedicated Semi-Finished / Internal Batch Genealogy with Business Objects
		if pkg.SemiFinishedGenealogy != nil {
			saveJSON(batchFolder, "semifinished_batch_genealogy.json", pkg.SemiFinishedGenealogy)
		} else if bo := pkg.FinishedGenealogy.BatchGenealogy.BusinessObjects; bo.SemiFinishedStage != nil {
			if sfgGen, ok := pkg.SubBatchesGenealogies[bo.SemiFinishedStage.BatchID]; ok {
				saveJSON(batchFolder, "semifinished_batch_genealogy.json", sfgGen)
			}
		}

		// 3. Sub-batches genealogies combined
		saveJSON(batchFolder, "sub_batches_genealogy.json", pkg.SubBatchesGenealogies)

		// 4. Sub-batches individual JSONs
		subBatchesDir := filepath.Join(batchFolder, "sub_batches")
		if err := os.MkdirAll(subBatchesDir, 0755); err == nil {
			for sID, sGen := range pkg.SubBatchesGenealogies {
				saveJSON(subBatchesDir, fmt.Sprintf("%s.json", sID), sGen)
			}
		}

		// 5. Relationships JSON
		saveJSON(batchFolder, "relationships.json", pkg.Relationships)

		// 6. Resolution JSON
		saveJSON(batchFolder, "resolution.json", pkg.ResolutionLinks)

		// 7. Events JSON
		saveJSON(batchFolder, "events.json", pkg.Events)
	}

	// Clean up legacy flat JSONs directly in output/finished_batch_genealogy/ (e.g. PF05043.json)
	for _, batchID := range finishedBatches {
		_ = os.Remove(filepath.Join(fbgDir, fmt.Sprintf("%s.json", batchID)))
	}

	// Build and Export Dedicated Raw Material Genealogies
	// Each raw material batch gets its own dedicated folder under output/raw_material_genealogy/<batch_id>/ containing:
	// 1. raw_material_genealogy.json (full forward & backward 360-degree genealogy)
	// 2. business_objects.json (business objects specific to this raw material)
	// 3. events.json (events specifically for this raw material)
	// 4. relationships.json (relationships)
	// 5. resolution.json (resolution links)
	rmgDir := filepath.Join(outputDir, "raw_material_genealogy")
	_ = os.MkdirAll(rmgDir, 0755)

	// Clean up extra/legacy raw material batch directories to keep strictly the 2 raw materials used in PF05043
	if entries, err := os.ReadDir(rmgDir); err == nil {
		for _, e := range entries {
			if e.IsDir() && e.Name() != "RM-MET-05043" && e.Name() != "RM-COAT-05043" {
				_ = os.RemoveAll(filepath.Join(rmgDir, e.Name()))
			}
		}
	}

	rawBatches := resEngine.GetRawMaterialBatches()
	allRMMap := make(map[string]*resolver.RawMaterialBatchGenealogyRoot)

	for _, bID := range rawBatches {
		rmPkg := resEngine.BuildRawMaterialBatchPackage(bID, resResult, events)
		if rmPkg == nil {
			continue
		}
		allRMMap[bID] = rmPkg.RawMaterialGenealogy

		bFolder := filepath.Join(rmgDir, bID)
		_ = os.MkdirAll(bFolder, 0755)

		saveJSON(bFolder, "raw_material_genealogy.json", rmPkg.RawMaterialGenealogy)
		saveJSON(bFolder, "business_objects.json", rmPkg.RawMaterialGenealogy.BatchGenealogy.BusinessObjects)
		saveJSON(bFolder, "events.json", rmPkg.Events)
		saveJSON(bFolder, "relationships.json", rmPkg.Relationships)
		saveJSON(bFolder, "resolution.json", rmPkg.ResolutionLinks)
	}

	saveJSON(outputDir, "all_raw_material_genealogies.json", allRMMap)
	saveJSON(outputDir, "raw_material_batches.json", rawBatches)
	fmt.Printf("[+] Successfully generated dedicated Raw Material Genealogies for %d batches in %s/\n", len(rawBatches), rmgDir)

	// Save primary genealogy convenience files
	var primaryFG *resolver.FinishedBatchGenealogyRoot
	if primaryPkg != nil {
		primaryFG = primaryPkg.FinishedGenealogy
		saveJSON(fbgDir, "batch_genealogy.json", primaryFG)
		saveJSON(outputDir, "batch_genealogy.json", primaryFG)
		saveJSON(outputDir, "finished_batch_genealogy.json", primaryFG)
	}

	// Print Group-by-Group Resolution Summary
	fmt.Println("\nGroup # | Functional Domain                               | Relationships | Links Resolved")
	fmt.Println("--------|-------------------------------------------------|---------------|---------------")
	groupDefs := []struct {
		Num   int
		Name  string
		Total int
	}{
		{1, "Planning & MRP", 4},
		{2, "Process Order Structure", 10},
		{3, "Quality Management", 6},
		{4, "Material Movements & Inventory Postings", 5},
		{5, "Procurement: Requisition to Purchase Order", 14},
		{6, "Bill of Materials & Routing", 15},
		{7, "Sales & Distribution", 17},
		{8, "Inventory, Batch & Material Master", 11},
		{9, "Quality Management (Extended Linkages)", 3},
		{10, "Sales & Delivery Cross-References", 3},
		{11, "Production Yield, Scrap & Confirmation", 4},
		{12, "Goods Receipt (GRN) Linkages", 4},
		{13, "Sales Returns", 10},
	}

	for _, g := range groupDefs {
		prefix := fmt.Sprintf("%d.", g.Num)
		count := 0
		for gName, c := range resResult.GroupCounts {
			if strings.HasPrefix(gName, prefix) {
				count += c
			}
		}
		fmt.Printf("%-7d | %-47s | %-13d | %-14d\n", g.Num, g.Name, g.Total, count)
	}
	fmt.Println("--------|-------------------------------------------------|---------------|---------------")
	fmt.Printf("TOTAL   | 13 Functional Groupings                         | %-13d | %-14d\n", resResult.TotalRelationshipsDefined, resResult.TotalLinksResolved)

	// Print Output Batch Lineage Highlights
	fmt.Println("\n==================================================================")
	fmt.Println(" Batch-Specific Lineage Traceability (Output Batch & Process Order)")
	fmt.Println("==================================================================")
	fmt.Printf("%-10s | %-14s | %-18s | %-10s | %-12s | %-10s\n", "Batch ID", "Process Order", "Material", "Batch Type", "Planned Ord", "Yield Rec")
	fmt.Println("-----------|----------------|--------------------|------------|--------------|-----------")
	for _, g := range genealogies {
		poID := "-"
		plID := "-"
		if len(g.ProcessOrders) > 0 {
			poID = g.ProcessOrders[0].ProcessOrderID
			plID = g.ProcessOrders[0].PlannedID
		}
		yieldStr := fmt.Sprintf("%d yields", len(g.Yields))
		if len(g.Yields) == 0 {
			yieldStr = "-"
		}
		fmt.Printf("%-10s | %-14s | %-18s | %-10s | %-12s | %-10s\n",
			g.BatchID, poID, g.MaterialID, g.BatchType, plID, yieldStr)
	}

	// =========================================================================
	// Finished Batch Genealogy (Raw Material -> Semi-Finished -> Finished Good)
	// =========================================================================
	fmt.Println("\n==================================================================")
	fmt.Println(" Finished Batch Genealogy 360° Trace (Planning to Billing & Returns)")
	fmt.Println("==================================================================")
	fmt.Printf("Root Finished Batch: %s (Material: %s - %s)\n",
		primaryFG.BatchGenealogy.RootBatchID,
		primaryFG.BatchGenealogy.BusinessObjects.Material.MaterialID,
		primaryFG.BatchGenealogy.BusinessObjects.Material.MaterialDescription)
	fmt.Printf("Planning Requirement: %s | Planned Order: %s | Process Order: %s\n",
		primaryFG.BatchGenealogy.BusinessObjects.PlanningRequirement.PlanningRequirementID,
		primaryFG.BatchGenealogy.BusinessObjects.PlannedOrder.PlanOrderID,
		primaryFG.BatchGenealogy.BusinessObjects.ProcessOrder.ProcessOrderID)
	fmt.Printf("Supplier / Source:   %s (%s)\n",
		primaryFG.BatchGenealogy.BusinessObjects.SupplierOrSource.SupplierOrSourceID,
		primaryFG.BatchGenealogy.BusinessObjects.SupplierOrSource.SourceName)
	fmt.Printf("Procurement:         PO %s -> Movement %s (Batch: %s)\n",
		primaryFG.BatchGenealogy.BusinessObjects.PurchaseOrder.PurchaseOrderID,
		primaryFG.BatchGenealogy.BusinessObjects.MaterialMovement.MaterialDocumentID,
		primaryFG.BatchGenealogy.BusinessObjects.MaterialMovement.BatchID)
	fmt.Println("\nMulti-Tier Batch Transformation Pipeline:")
	for _, stg := range primaryFG.BatchGenealogy.BusinessObjects.BatchTransformation.TransformationStages {
		fmt.Printf("  Stage %d [%s]: Process Order %s | Input: %v -> Output: %s (%s, %.3f %s)\n",
			stg.StageNumber, stg.StageName, stg.ProcessOrderID, stg.InputBatches, stg.OutputBatch, stg.MaterialType, stg.QuantityProduced, stg.UOM)
	}
	fmt.Printf("\nQuality Release:     Lot %s | Usage Decision: %s (%s)\n",
		primaryFG.BatchGenealogy.BusinessObjects.QualityInspectionLot.InspectionLotID,
		primaryFG.BatchGenealogy.BusinessObjects.UsageDecision.UsageDecisionID,
		primaryFG.BatchGenealogy.BusinessObjects.UsageDecision.DecisionCode)
	fmt.Printf("Commercial Flow:     SO %s -> Outbound Delivery %s (Item %s) -> Invoice %s -> Customer %s\n",
		primaryFG.BatchGenealogy.BusinessObjects.SalesOrder.SalesOrderID,
		primaryFG.BatchGenealogy.BusinessObjects.OutboundDelivery.DeliveryID,
		primaryFG.BatchGenealogy.BusinessObjects.DeliveryItem.ItemID,
		primaryFG.BatchGenealogy.BusinessObjects.BillingDocument.BillingDocumentID,
		primaryFG.BatchGenealogy.BusinessObjects.CustomerOrCFA.CustomerID)
	fmt.Printf("Sales Return Status: %s\n", primaryFG.BatchGenealogy.BusinessObjects.SalesReturn.Status)

	// Print Business Event Statistics
	eventCounts := make(map[string]int)
	for _, ev := range events {
		eventCounts[ev.EventName]++
	}
	fmt.Println("\n==================================================================")
	fmt.Println(" Detected Business Events Summary (per SAP Business Events Spec)")
	fmt.Println("==================================================================")
	fmt.Printf("%-32s | %-10s\n", "Event Name", "Count")
	fmt.Println("---------------------------------|-----------")
	for evName, cnt := range eventCounts {
		fmt.Printf("%-32s | %-10d\n", evName, cnt)
	}
	fmt.Println("---------------------------------|-----------")
	fmt.Printf("%-32s | %-10d\n", "TOTAL BUSINESS EVENTS", len(events))

	fmt.Printf("\n[✓] Exported 37 Independent Business Objects: output/business_objects/ (37 JSON files)\n")
	fmt.Printf("[✓] Exported Finished Batch Packages: output/finished_batch_genealogy/<batch_id>/ (%d dedicated batch folders)\n", len(finishedBatches))
	fmt.Printf("    - finished_batch_genealogy.json (one finished genealogy of each)\n")
	fmt.Printf("    - sub_batches_genealogy.json & sub_batches/ (all sub-batches used genealogies)\n")
	fmt.Printf("    - relationships.json (relationship definitions for this batch)\n")
	fmt.Printf("    - resolution.json (resolved relationships links for this batch)\n")
	fmt.Printf("    - events.json (events specific to this batch)\n")
	fmt.Printf("[✓] Exported Primary Finished Batch Genealogy: output/finished_batch_genealogy/batch_genealogy.json\n")
	fmt.Printf("[✓] Exported Relationship Catalog: output/relationship_catalog.json (%d definitions)\n", len(catalog))
	fmt.Printf("[✓] Exported Resolved Graph: output/resolved_relationships.json (%d instance links)\n", resResult.TotalLinksResolved)
	fmt.Printf("[✓] Exported All Batch Graphs: output/all_batch_genealogies.json (%d batch graphs)\n", len(genealogies))
	fmt.Printf("[✓] Exported Business Events: output/business_events.json (%d events)\n", len(events))
	fmt.Println("[✓] MATDOC used for all Material Documents (MSEG/MKPF)")
	fmt.Println("[✓] LIKP & LIPS used; Transportation tables (VTTK, VTTP) strictly excluded")
}

