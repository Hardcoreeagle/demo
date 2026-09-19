package builder_test

import (
	"path/filepath"
	"testing"

	"supply-bo-builder/pkg/builder"
	"supply-bo-builder/pkg/loader"
)

func TestAllBuilders(t *testing.T) {
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

	tests := []struct {
		name     string
		countFn  func() int
		minCount int
	}{
		{"1. Planning Requirement", func() int { return len(repo.BuildPlanningRequirements()) }, 1},
		{"2. Planned Order", func() int { return len(repo.BuildPlannedOrders()) }, 1},
		{"3. Material", func() int { return len(repo.BuildMaterials()) }, 1},
		{"4. Batch", func() int { return len(repo.BuildBatches()) }, 1},
		{"5. Supplier or Source", func() int { return len(repo.BuildSuppliers()) }, 1},
		{"6. Purchase Requisition", func() int { return len(repo.BuildPurchaseRequisitions()) }, 1},
		{"7. Purchase Order", func() int { return len(repo.BuildPurchaseOrders()) }, 1},
		{"8. Material Movement", func() int { return len(repo.BuildMaterialMovements()) }, 1},
		{"9. Inventory/Stock", func() int { return len(repo.BuildInventoryStocks()) }, 1},
		{"10. Reservation", func() int { return len(repo.BuildReservations()) }, 1},
		{"11. Process Order", func() int { return len(repo.BuildProcessOrders()) }, 1},
		{"12. BOM", func() int { return len(repo.BuildBOMs()) }, 1},
		{"13. Recipe", func() int { return len(repo.BuildRecipes()) }, 1},
		{"14. Production Version", func() int { return len(repo.BuildProductionVersions()) }, 1},
		{"15. Batch Determination", func() int { return len(repo.BuildBatchDeterminations()) }, 1},
		{"16. Material Consumption", func() int { return len(repo.BuildMaterialConsumptions()) }, 1},
		{"17. Production Confirmation", func() int { return len(repo.BuildProductionConfirmations()) }, 1},
		{"18. Batch Transformation", func() int { return len(repo.BuildBatchTransformations()) }, 1},
		{"19. Yield", func() int { return len(repo.BuildYields()) }, 1},
		{"21. Inspection Characteristic", func() int { return len(repo.BuildInspectionCharacteristics()) }, 1},
		{"22. Inspection Plan", func() int { return len(repo.BuildInspectionPlans()) }, 1},
		{"23. Inspection Parameter", func() int { return len(repo.BuildInspectionParameters()) }, 1},
		{"24. Quality Inspection Lot", func() int { return len(repo.BuildQualityInspectionLots()) }, 1},
		{"25. Sampling", func() int { return len(repo.BuildSamplings()) }, 1},
		{"26. Inspection Result", func() int { return len(repo.BuildInspectionResults()) }, 1},
		{"27. Usage Decision", func() int { return len(repo.BuildUsageDecisions()) }, 1},
		{"28. Customer or CFA", func() int { return len(repo.BuildCustomers()) }, 1},
		{"29. Sales Order", func() int { return len(repo.BuildSalesOrders()) }, 1},
		{"30. Sales Order Item", func() int { return len(repo.BuildSalesOrderItems()) }, 1},
		{"31. Sales Batch Allocation", func() int { return len(repo.BuildSalesBatchAllocations()) }, 1},
		{"32. Outbound Delivery", func() int { return len(repo.BuildOutboundDeliveries()) }, 1},
		{"33. Delivery Item", func() int { return len(repo.BuildDeliveryItems()) }, 1},
		{"34. Billing Document", func() int { return len(repo.BuildBillingDocuments()) }, 1},
		{"35. Sales Return", func() int { return len(repo.BuildSalesReturns()) }, 1},
		{"36. Work Centre", func() int { return len(repo.BuildWorkCentres()) }, 1},
		{"GRN GoodsReceipt", func() int { return len(repo.BuildGoodsReceipts()) }, 1},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			count := tt.countFn()
			if count < tt.minCount {
				t.Errorf("%s returned %d records, want at least %d", tt.name, count, tt.minCount)
			}
		})
	}
}
