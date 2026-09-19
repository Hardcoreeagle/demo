package resolver_test

import (
	"path/filepath"
	"testing"

	"supply-bo-builder/pkg/builder"
	"supply-bo-builder/pkg/loader"
	"supply-bo-builder/pkg/models"
	"supply-bo-builder/pkg/resolver"
)

func TestCatalogCompleteness(t *testing.T) {
	cat := resolver.GetRelationshipCatalog()
	if len(cat) != 106 {
		t.Fatalf("Expected exactly 106 relationships in catalog, got %d", len(cat))
	}

	groups := make(map[int]string)
	for i, r := range cat {
		expectedID := i + 1
		if r.ID != expectedID {
			t.Errorf("Index %d: expected relationship ID %d, got %d", i, expectedID, r.ID)
		}
		if r.SourceEntity == "" {
			t.Errorf("Relationship %d has empty SourceEntity", r.ID)
		}
		if r.TargetEntity == "" {
			t.Errorf("Relationship %d has empty TargetEntity", r.ID)
		}
		if r.JoinType != "INNER JOIN" && r.JoinType != "LEFT JOIN" {
			t.Errorf("Relationship %d has invalid JoinType: %s", r.ID, r.JoinType)
		}
		if r.LogicDescription == "" {
			t.Errorf("Relationship %d has empty LogicDescription", r.ID)
		}
		groups[r.GroupNumber] = r.GroupName
	}

	if len(groups) != 13 {
		t.Fatalf("Expected 13 distinct functional groups, got %d", len(groups))
	}
}

func loadTestContainer(t *testing.T) (*models.BusinessObjectsContainer, *builder.Repository) {
	supplyDir := filepath.Join("..", "..", "supply")

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
	for _, name := range tableNames {
		tbl, err := loader.LoadTable(supplyDir, name+".csv")
		if err == nil {
			loadedTables = append(loadedTables, tbl)
		}
	}

	repo := builder.NewRepository(loadedTables...)
	bo := &models.BusinessObjectsContainer{
		PlanningRequirements:      repo.BuildPlanningRequirements(),
		PlannedOrders:             repo.BuildPlannedOrders(),
		Materials:                 repo.BuildMaterials(),
		Batches:                   repo.BuildBatches(),
		Suppliers:                 repo.BuildSuppliers(),
		PurchaseRequisitions:      repo.BuildPurchaseRequisitions(),
		PurchaseOrders:            repo.BuildPurchaseOrders(),
		MaterialMovements:         repo.BuildMaterialMovements(),
		InventoryStocks:           repo.BuildInventoryStocks(),
		Reservations:              repo.BuildReservations(),
		ProcessOrders:             repo.BuildProcessOrders(),
		BOMs:                      repo.BuildBOMs(),
		Recipes:                   repo.BuildRecipes(),
		ProductionVersions:        repo.BuildProductionVersions(),
		BatchDeterminations:       repo.BuildBatchDeterminations(),
		MaterialConsumptions:      repo.BuildMaterialConsumptions(),
		ProductionConfirmations:   repo.BuildProductionConfirmations(),
		BatchTransformations:      repo.BuildBatchTransformations(),
		Yields:                    repo.BuildYields(),
		InspectionCharacteristics: repo.BuildInspectionCharacteristics(),
		InspectionPlans:           repo.BuildInspectionPlans(),
		InspectionParameters:      repo.BuildInspectionParameters(),
		QualityInspectionLots:     repo.BuildQualityInspectionLots(),
		Samplings:                 repo.BuildSamplings(),
		InspectionResults:         repo.BuildInspectionResults(),
		UsageDecisions:            repo.BuildUsageDecisions(),
		Customers:                 repo.BuildCustomers(),
		SalesOrders:               repo.BuildSalesOrders(),
		SalesOrderItems:           repo.BuildSalesOrderItems(),
		SalesBatchAllocations:     repo.BuildSalesBatchAllocations(),
		OutboundDeliveries:        repo.BuildOutboundDeliveries(),
		DeliveryItems:             repo.BuildDeliveryItems(),
		BillingDocuments:          repo.BuildBillingDocuments(),
		SalesReturns:              repo.BuildSalesReturns(),
		WorkCentres:               repo.BuildWorkCentres(),
		GoodsReceipts:             repo.BuildGoodsReceipts(),
	}

	return bo, repo
}

func TestResolveAll106Relationships(t *testing.T) {
	bo, repo := loadTestContainer(t)
	resEngine := resolver.NewRelationshipResolver(bo, repo)

	result := resEngine.ResolveAll()

	if result.TotalRelationshipsDefined != 106 {
		t.Fatalf("Expected 106 defined relationships, got %d", result.TotalRelationshipsDefined)
	}

	if len(result.Summaries) != 106 {
		t.Fatalf("Expected 106 summaries, got %d", len(result.Summaries))
	}

	if result.TotalLinksResolved == 0 {
		t.Fatalf("Expected > 0 resolved links, got 0")
	}

	t.Logf("Total links resolved across 106 relationships: %d", result.TotalLinksResolved)

	// Verify all 13 groups have resolved links
	for groupNum := 1; groupNum <= 13; groupNum++ {
		found := false
		for groupName, count := range result.GroupCounts {
			if count > 0 && len(groupName) > 0 && int(groupName[0]-'0') == groupNum {
				found = true
				break
			}
			// For two digit groups 10, 11, 12, 13
			if groupNum >= 10 && len(groupName) >= 2 {
				if int((groupName[0]-'0')*10+(groupName[1]-'0')) == groupNum && count > 0 {
					found = true
					break
				}
			}
		}
		if !found {
			t.Errorf("Group %d has 0 resolved links", groupNum)
		}
	}
}

func TestBatchGenealogyResolution(t *testing.T) {
	bo, repo := loadTestContainer(t)
	resEngine := resolver.NewRelationshipResolver(bo, repo)

	// Test specific output batch PF05043 produced by Process Order 400000014001
	g := resEngine.ResolveBatchGenealogy("PF05043")
	if g == nil {
		t.Fatalf("Expected non-nil genealogy for batch PF05043")
	}

	if g.BatchID != "PF05043" {
		t.Errorf("Expected BatchID PF05043, got %s", g.BatchID)
	}
	if len(g.ProcessOrders) == 0 {
		t.Errorf("Expected at least 1 process order linked to PF05043, got 0")
	} else if g.ProcessOrders[0].ProcessOrderID != "400000014001" {
		t.Errorf("Expected Process Order 400000014001, got %s", g.ProcessOrders[0].ProcessOrderID)
	}

	if len(g.PlannedOrders) == 0 {
		t.Errorf("Expected planned orders linked to PF05043, got 0")
	}

	if len(g.Yields) == 0 {
		t.Errorf("Expected yields linked to PF05043, got 0")
	}

	if len(g.TransformationsAsOutput) == 0 {
		t.Errorf("Expected transformations as output for PF05043, got 0")
	}

	// Test ResolveProcessOrderLineage
	poG := resEngine.ResolveProcessOrderLineage("400000014001")
	if poG == nil {
		t.Fatalf("Expected non-nil lineage for process order 400000014001")
	}
	if poG.BatchID != "PF05043" {
		t.Errorf("Expected BatchID PF05043 on process order lineage, got %s", poG.BatchID)
	}

	// Test ResolveAllBatchGenealogies
	allG := resEngine.ResolveAllBatchGenealogies()
	if len(allG) == 0 {
		t.Fatalf("Expected > 0 batch genealogies, got 0")
	}
	t.Logf("Successfully resolved %d batch genealogies", len(allG))
}

func TestBusinessEventsDetection(t *testing.T) {
	bo, repo := loadTestContainer(t)
	resEngine := resolver.NewRelationshipResolver(bo, repo)

	events := resEngine.DetectBusinessEvents()
	if len(events) == 0 {
		t.Fatalf("Expected > 0 business events, got 0")
	}
	t.Logf("Successfully detected %d business events", len(events))

	eventMap := make(map[string]int)
	for _, ev := range events {
		eventMap[ev.EventName]++
	}

	criticalEvents := []string{
		"PlannedOrderConverted",
		"YieldRecorded",
		"MaterialConsumptionPosted",
		"BatchAssigned",
		"GRNPosted",
		"ProductionBatchCreated",
		"BatchTransformationCreated",
		"ProcessOrderCreated",
		"GoodsIssuePosted",
		"DeliveryShipped",
	}

	for _, ce := range criticalEvents {
		if count := eventMap[ce]; count == 0 {
			t.Errorf("Expected critical business event %s to be detected, got count 0", ce)
		} else {
			t.Logf("Event %s: %d detected", ce, count)
		}
	}

	// Test Batch-specific and Process-Order-specific event filtering
	batchEvents := resEngine.DetectBatchEvents("PF05043")
	if len(batchEvents) == 0 {
		t.Errorf("Expected events for batch PF05043, got 0")
	}

	poEvents := resEngine.DetectProcessOrderEvents("400000014001")
	if len(poEvents) == 0 {
		t.Errorf("Expected events for Process Order 400000014001, got 0")
	}
}

func TestFinishedBatchGenealogy(t *testing.T) {
	bo, repo := loadTestContainer(t)
	resEngine := resolver.NewRelationshipResolver(bo, repo)

	fg := resEngine.BuildFinishedBatchGenealogy("PF05043")
	if fg == nil {
		t.Fatalf("Expected non-nil FinishedBatchGenealogyRoot")
	}

	bg := fg.BatchGenealogy
	if bg.RootBatchID != "PF05043" {
		t.Errorf("Expected RootBatchID PF05043, got %s", bg.RootBatchID)
	}

	// Verify all 34 primary business objects are populated
	objs := bg.BusinessObjects
	if objs.PlanningRequirement == nil {
		t.Errorf("PlanningRequirement is nil")
	}
	if objs.PlannedOrder == nil {
		t.Errorf("PlannedOrder is nil")
	}
	if objs.Material == nil {
		t.Errorf("Material is nil")
	}
	if objs.Batch == nil {
		t.Errorf("Batch is nil")
	}
	if objs.SupplierOrSource == nil {
		t.Errorf("SupplierOrSource is nil")
	}
	if objs.PurchaseRequisition == nil {
		t.Errorf("PurchaseRequisition is nil")
	}
	if objs.PurchaseOrder == nil {
		t.Errorf("PurchaseOrder is nil")
	}
	if objs.MaterialMovement == nil {
		t.Errorf("MaterialMovement is nil")
	}
	if objs.InventoryStock == nil {
		t.Errorf("InventoryStock is nil")
	}
	if objs.Reservation == nil {
		t.Errorf("Reservation is nil")
	}
	if objs.ProcessOrder == nil {
		t.Errorf("ProcessOrder is nil")
	}
	if objs.BOM == nil {
		t.Errorf("BOM is nil")
	}
	if objs.Recipe == nil {
		t.Errorf("Recipe is nil")
	}
	if objs.ProductionVersion == nil {
		t.Errorf("ProductionVersion is nil")
	}
	if objs.BatchDetermination == nil {
		t.Errorf("BatchDetermination is nil")
	}
	if objs.MaterialConsumption == nil {
		t.Errorf("MaterialConsumption is nil")
	}
	if objs.ProductionConfirmation == nil {
		t.Errorf("ProductionConfirmation is nil")
	}
	if objs.BatchTransformation == nil {
		t.Errorf("BatchTransformation is nil")
	}
	if objs.Yield == nil {
		t.Errorf("Yield is nil")
	}
	if objs.MasterInspectionCharacteristic == nil {
		t.Errorf("MasterInspectionCharacteristic is nil")
	}
	if objs.InspectionPlan == nil {
		t.Errorf("InspectionPlan is nil")
	}
	if objs.InspectionParameter == nil {
		t.Errorf("InspectionParameter is nil")
	}
	if objs.QualityInspectionLot == nil {
		t.Errorf("QualityInspectionLot is nil")
	}
	if objs.Sampling == nil {
		t.Errorf("Sampling is nil")
	}
	if objs.InspectionResult == nil {
		t.Errorf("InspectionResult is nil")
	}
	if objs.UsageDecision == nil {
		t.Errorf("UsageDecision is nil")
	}
	if objs.CustomerOrCFA == nil {
		t.Errorf("CustomerOrCFA is nil")
	}
	if objs.SalesOrder == nil {
		t.Errorf("SalesOrder is nil")
	}
	if objs.SalesOrderItem == nil {
		t.Errorf("SalesOrderItem is nil")
	}
	if objs.SalesBatchAllocation == nil {
		t.Errorf("SalesBatchAllocation is nil")
	}
	if objs.OutboundDelivery == nil {
		t.Errorf("OutboundDelivery is nil")
	}
	if objs.DeliveryItem == nil {
		t.Errorf("DeliveryItem is nil")
	}
	if objs.BillingDocument == nil {
		t.Errorf("BillingDocument is nil")
	}
	if objs.SalesReturn == nil {
		t.Errorf("SalesReturn is nil")
	}

	// Verify Process Order input_batches and output_batches
	if len(objs.ProcessOrder.InputBatches) == 0 {
		t.Errorf("Expected ProcessOrder.InputBatches to contain input batches, got 0")
	}
	if len(objs.ProcessOrder.OutputBatches) == 0 {
		t.Errorf("Expected ProcessOrder.OutputBatches to contain output batches, got 0")
	}

	// Verify Batch Transformation stages (Raw Material -> Semi-Finished -> Finished)
	if len(objs.BatchTransformation.TransformationStages) < 2 {
		t.Errorf("Expected at least 2 transformation stages (ROH -> SFG -> FG), got %d", len(objs.BatchTransformation.TransformationStages))
	}
	if len(objs.BatchTransformation.ConsumedBatches) == 0 {
		t.Errorf("Expected BatchTransformation.ConsumedBatches to be populated, got 0")
	}
	if objs.BatchTransformation.ProducedProduct == nil {
		t.Errorf("Expected BatchTransformation.ProducedProduct to be populated")
	}

	// Verify Semi-Finished Stage
	if objs.SemiFinishedStage == nil {
		t.Errorf("Expected SemiFinishedStage to be populated")
	} else {
		if objs.SemiFinishedStage.BatchID != "PF05043-CORE" {
			t.Errorf("Expected SemiFinishedStage.BatchID PF05043-CORE, got %s", objs.SemiFinishedStage.BatchID)
		}
		if len(objs.SemiFinishedStage.InputBatches) == 0 {
			t.Errorf("Expected SemiFinishedStage.InputBatches to be populated, got 0")
		}
	}

	// Verify relationships
	if len(bg.Relationships) == 0 {
		t.Errorf("Expected non-empty relationships list, got 0")
	}
	t.Logf("FinishedBatchGenealogy validated with %d relationships and multi-tier transformations", len(bg.Relationships))
}

func TestBuildAllFinishedBatchGenealogies(t *testing.T) {
	bo, repo := loadTestContainer(t)
	resEngine := resolver.NewRelationshipResolver(bo, repo)

	fbList := resEngine.GetFinishedBatches()
	if len(fbList) == 0 {
		t.Fatalf("Expected finished batches list > 0, got 0")
	}
	t.Logf("Found %d finished batches: %v", len(fbList), fbList)

	allFG := resEngine.BuildAllFinishedBatchGenealogies()
	if len(allFG) != len(fbList) {
		t.Errorf("Expected %d genealogies, got %d", len(fbList), len(allFG))
	}

	for bID, root := range allFG {
		if root == nil {
			t.Errorf("Batch %s has nil genealogy", bID)
			continue
		}
		if root.BatchGenealogy.RootBatchID != bID {
			t.Errorf("Expected root batch %s, got %s", bID, root.BatchGenealogy.RootBatchID)
		}
		if root.BatchGenealogy.BusinessObjects.ProcessOrder == nil {
			t.Errorf("Batch %s has nil ProcessOrder", bID)
		}
		if len(root.BatchGenealogy.BusinessObjects.ProcessOrder.InputBatches) == 0 {
			t.Errorf("Batch %s has 0 InputBatches in ProcessOrder", bID)
		}
		if len(root.BatchGenealogy.BusinessObjects.ProcessOrder.OutputBatches) == 0 {
			t.Errorf("Batch %s has 0 OutputBatches in ProcessOrder", bID)
		}
	}
}

func TestBuildFinishedBatchPackage(t *testing.T) {
	bo, repo := loadTestContainer(t)
	resEngine := resolver.NewRelationshipResolver(bo, repo)
	resResult := resEngine.ResolveAll()
	events := resEngine.DetectBusinessEvents()

	pkg := resEngine.BuildFinishedBatchPackage("PF05043", resResult, events)
	if pkg == nil {
		t.Fatalf("Expected non-nil FinishedBatchPackage for PF05043")
	}

	if pkg.RootBatchID != "PF05043" {
		t.Errorf("Expected root batch PF05043, got %s", pkg.RootBatchID)
	}
	if pkg.FinishedGenealogy == nil {
		t.Errorf("Expected non-nil FinishedGenealogy")
	}
	if len(pkg.SubBatchesGenealogies) == 0 {
		t.Errorf("Expected sub-batches genealogies > 0, got 0")
	}
	if len(pkg.Relationships) == 0 {
		t.Errorf("Expected relationships > 0, got 0")
	}
	if len(pkg.ResolutionLinks) == 0 {
		t.Errorf("Expected resolution links > 0, got 0")
	}
	if len(pkg.Events) == 0 {
		t.Errorf("Expected events > 0, got 0")
	}

	t.Logf("Validated FinishedBatchPackage PF05043: %d sub-batches, %d relationships, %d resolution links, %d events",
		len(pkg.SubBatchesGenealogies), len(pkg.Relationships), len(pkg.ResolutionLinks), len(pkg.Events))
}

func TestRawMaterialGenealogy(t *testing.T) {
	bo, repo := loadTestContainer(t)
	resEngine := resolver.NewRelationshipResolver(bo, repo)
	resResult := resEngine.ResolveAll()
	events := resEngine.DetectBusinessEvents()

	rawBatches := resEngine.GetRawMaterialBatches()
	if len(rawBatches) == 0 {
		t.Fatalf("Expected raw material batches > 0, got 0")
	}

	testBatch := "RM-MET-05043"
	rmGen := resEngine.BuildRawMaterialGenealogy(testBatch)
	if rmGen == nil {
		t.Fatalf("Expected non-nil RawMaterialGenealogy for %s", testBatch)
	}

	bg := rmGen.BatchGenealogy
	if bg.RootBatchID != testBatch {
		t.Errorf("Expected root batch %s, got %s", testBatch, bg.RootBatchID)
	}
	if bg.BusinessObjects.Material == nil {
		t.Errorf("Expected Material to be populated")
	}
	if bg.BusinessObjects.PurchaseOrder == nil {
		t.Errorf("Expected PurchaseOrder to be populated")
	}
	if bg.BusinessObjects.MaterialMovement == nil {
		t.Errorf("Expected MaterialMovement (GRN) to be populated")
	}
	if bg.BusinessObjects.InventoryStock == nil {
		t.Errorf("Expected InventoryStock to be populated")
	}
	if bg.BusinessObjects.QualityInspectionLot == nil {
		t.Errorf("Expected QualityInspectionLot to be populated")
	}
	if bg.BusinessObjects.UsageDecision == nil {
		t.Errorf("Expected UsageDecision to be populated")
	}
	if bg.BusinessObjects.Reservation == nil {
		t.Errorf("Expected Reservation to be populated")
	}
	if bg.BusinessObjects.MaterialConsumption == nil {
		t.Errorf("Expected MaterialConsumption to be populated")
	}
	if bg.BusinessObjects.ProcessOrder == nil {
		t.Errorf("Expected ProcessOrder to be populated")
	}
	if bg.BusinessObjects.BatchTransformation == nil {
		t.Errorf("Expected BatchTransformation to be populated")
	}
	if bg.BusinessObjects.CustomerOrCFA == nil {
		t.Errorf("Expected CustomerOrCFA to be populated")
	}

	rmPkg := resEngine.BuildRawMaterialBatchPackage(testBatch, resResult, events)
	if rmPkg == nil {
		t.Fatalf("Expected non-nil RawMaterialBatchPackage for %s", testBatch)
	}
	if len(rmPkg.Events) == 0 {
		t.Errorf("Expected raw material events > 0")
	}
	if len(rmPkg.Relationships) == 0 {
		t.Errorf("Expected raw material relationships > 0")
	}

	t.Logf("Validated RawMaterialBatchPackage %s: %d relationships, %d resolution links, %d events",
		testBatch, len(rmPkg.Relationships), len(rmPkg.ResolutionLinks), len(rmPkg.Events))
}




