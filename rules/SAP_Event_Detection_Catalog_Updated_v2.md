# SAP Event Detection Catalog — Updated v2

**Relationship Resolver / Event Resolver — field-level reference for the current canonical schema**

## Scope and alignment

- **36 canonical business objects** across Planning, MM, Production, QM, and Sales.
- **51 enrichment tables** from the current enrichment reference are incorporated as event-payload/context enrichment.
- Enrichment tables **do not automatically create new business objects or new lifecycle events**; they enrich the applicable event payloads unless explicitly designated as an event source.
- `MATDOC` remains the primary transaction source; `MKPF` is not treated as an independent transaction source.
- Batch uses `MCHA/MCH1` and explicit `MATNR + WERKS + CHARG` resolution where plant-specific.
- Production uses **Process Order** (`AUFK/AFKO/AFPO`), not Production Order.
- Sales scope continues through **Delivery → Goods Issue → Billing**; billing is the terminal scope.
- **No VTTK/VTTP / Transportation business object** is included.
- Contextual objects remain supported: Batch context uses `ROH/HALB/FERT/VERP`; enrichment joins are resolved only after the applicable context is known.

## What changed from the previous catalog

1. Material events now expose the new material-master enrichment layer (`MARM`, `MEAN`, `T023/T023T`, `T134/T134T`, `T179/T179T`, `MLAN`, `MBEWH`).
2. Supplier Source and Purchase Order events now carry purchasing-info and purchasing-document-type enrichment (`EINA/EINE`, `T024/T024E`, `T161/T161T`).
3. Customer and Sales events now include customer-material, sales-area, geographic, pricing and rejection-reason enrichment (`KNMT`, `T077X`, `TVKO/TVKOT`, `TVTW/TVTWT`, `TSPAT`, `T005/T005T/T005S/T005U`, `T685/T685T`, `T683/T683T`, `TVAG/TVAGT`).
4. Batch events now support classification enrichment (`INOB`, `KSSK`, `AUSP`, `CABN`, `CABNT`, `CAWN`, `CAWNT`, `KLAH`).
5. Production/Work Center events now support operation, sequence, description and capacity enrichment (`AFVV`, `AFFL`, `CRTX`, `CRCA`, `KAKO`).
6. Inventory/warehouse events now support conditional warehouse enrichment (`T320`, `LAGP`, `LQUA`, `LTAK`, `LTAP`).
7. Critical event rules are kept explicit so `BWART = 101` is distinguished between procurement GRN and production yield using `EBELN/EBELP` vs `AUFNR`.

## 1. Event Detection Mapping — 36 Business Objects

Columns: **Event | SAP Table / Source | SAP Field | Operator / Condition | Required Join | Enrichment Tables | Result**.

### 1. Planning Requirement

| Event | SAP Table / Source | SAP Field | Operator / Condition | Required Join | Enrichment Tables | Result |
|---|---|---|---|---|---|---|
| PlanningRequirementCreated | PBIM/PBED | PBIM.BDZEI + PBED.* | New PBIM/PBED requirement record | INNER: PBIM.BDZEI = PBED.BDZEI | — | Planning requirement created |
| PlanningRequirementUpdated | PBIM/PBED | Relevant requirement fields | Tracked requirement field changed | INNER: PBIM.BDZEI = PBED.BDZEI | — | Planning requirement updated |
| PlanningRequirementCancelled | PBIM/PBED | Cancellation/status field | Cancellation/status indicates cancelled | INNER: PBIM.BDZEI = PBED.BDZEI | — | Planning requirement cancelled |

### 2. Planned Order

| Event | SAP Table / Source | SAP Field | Operator / Condition | Required Join | Enrichment Tables | Result |
|---|---|---|---|---|---|---|
| PlannedOrderCreated | PLAF | PLAF.PLNUM | New record | — | Material enrichment: MARM, MEAN, T023/T023T, T134/T134T, T179/T179T; planning context | Planned order created |
| PlannedOrderUpdated | PLAF | Relevant order fields | Value changed | — | Material/master enrichment as applicable | Planned order updated |
| PlannedOrderReleased | PLAF | Release/status field | Released | — | — | Planned order released |
| PlannedOrderConverted | PLAF/AFKO/AFPO | PLAF.AUFNR / AFPO.PLNUM | Valid Process Order relationship exists | LEFT: PLAF.PLNUM = AFPO.PLNUM → AFPO.AUFNR; or PLAF.AUFNR = AFPO.AUFNR | — | Planned order converted to Process Order |
| PlannedOrderCancelled | PLAF | Cancellation/status field | Cancelled | — | — | Planned order cancelled |

### 3. Material

| Event | SAP Table / Source | SAP Field | Operator / Condition | Required Join | Enrichment Tables | Result |
|---|---|---|---|---|---|---|
| MaterialCreated | MARA | MARA.MATNR | New material record | — | MARM, MEAN, T023/T023T, T134/T134T, T179/T179T, MLAN, MBEWH | Material created |
| MaterialUpdated | MARA/MARC/MVKE/MBEW + enrichment | MARA/MARC/MVKE/MBEW relevant fields | Core or configured enrichment field changed | MATNR-based joins; see enrichment map | MARM, MEAN, T023/T023T, T134/T134T, T179/T179T, MLAN, MBEWH | Material updated |
| MaterialBlocked | MARA/MARC | Material status field | Blocked | MATNR-based joins | Material enrichment as applicable | Material blocked |
| MaterialUnblocked | MARA/MARC | Material status field | Unblocked | MATNR-based joins | Material enrichment as applicable | Material unblocked |

### 4. Supplier Source

| Event | SAP Table / Source | SAP Field | Operator / Condition | Required Join | Enrichment Tables | Result |
|---|---|---|---|---|---|---|
| SupplierSourceCreated | EORD | EORD.MATNR + EORD.WERKS + EORD.LIFNR | New source record | LEFT: EORD.MATNR = EINA.MATNR AND EORD.LIFNR = EINA.LIFNR where info record exists | EINA, EINE | Supplier source created |
| SupplierSourceUpdated | EORD | Source fields | Value changed | LEFT: EORD.MATNR = EINA.MATNR AND EORD.LIFNR = EINA.LIFNR; EINA.INFNR = EINE.INFNR with org/plant context | EINA, EINE | Supplier source updated |
| SupplierSourceBlocked | EORD | Source/status field | Blocked | Supplier-source joins | EINA, EINE | Supplier source blocked |

### 5. Purchase Requisition

| Event | SAP Table / Source | SAP Field | Operator / Condition | Required Join | Enrichment Tables | Result |
|---|---|---|---|---|---|---|
| PurchaseRequisitionCreated | EBAN | EBAN.BANFN + EBAN.BNFPO | New record | LEFT: EBAN.BANFN/BNFPO ↔ EBKN where account assignment exists | — | Purchase requisition created |
| PurchaseRequisitionUpdated | EBAN | Quantity/date/material fields | Value changed | LEFT: EBAN.BANFN/BNFPO ↔ EBKN where applicable | — | Purchase requisition updated |
| PurchaseRequisitionReleased | EBAN | Release indicator | Released | LEFT: EBAN.BANFN/BNFPO ↔ EBKN where applicable | — | Purchase requisition released |

### 6. Purchase Order

| Event | SAP Table / Source | SAP Field | Operator / Condition | Required Join | Enrichment Tables | Result |
|---|---|---|---|---|---|---|
| PurchaseOrderCreated | EKKO/EKPO | EKKO.EBELN + EKPO.EBELP | New PO/item record | INNER: EKKO.EBELN = EKPO.EBELN | EINA, EINE, T024, T024E, T161, T161T | Purchase order created |
| PurchaseOrderUpdated | EKKO/EKPO | Relevant PO/item fields | Value changed | INNER: EKKO.EBELN = EKPO.EBELN | EINA, EINE, T024, T024E, T161, T161T | Purchase order updated |
| PurchaseOrderReleased | EKKO/EKPO | Release indicator/status | Released | INNER: EKKO.EBELN = EKPO.EBELN | T024, T024E, T161, T161T | Purchase order released |

### 7. Material Movement

| Event | SAP Table / Source | SAP Field | Operator / Condition | Required Join | Enrichment Tables | Result |
|---|---|---|---|---|---|---|
| GoodsIssuePosted | MATDOC | MATDOC.BWART | GI movement type | Material-document key as applicable | — | Goods issue posted |
| GoodsReceiptPosted | MATDOC | MATDOC.BWART | BWART = 101 | Material-document key; PO context when EBELN/EBELP populated | — | Goods receipt posted |
| MaterialTransferred | MATDOC | MATDOC.BWART | Configured transfer movement type | Material-document key | T320, LAGP, LQUA, LTAK, LTAP where warehouse-managed context exists | Material transferred |
| MaterialMovementReversed | MATDOC | MATDOC.BWART + reversal/reference fields | Reversal movement/reference detected | Original material document reference | — | Movement reversed |

### 8. Inventory / Stock

| Event | SAP Table / Source | SAP Field | Operator / Condition | Required Join | Enrichment Tables | Result |
|---|---|---|---|---|---|---|
| StockIncreased | MARD/MCHB | Stock quantity | Current > previous | MATNR/WERKS/LGORT/CHARG | T320, LAGP, LQUA where warehouse context exists | Stock increased |
| StockDecreased | MARD/MCHB | Stock quantity | Current < previous | MATNR/WERKS/LGORT/CHARG | T320, LAGP, LQUA where warehouse context exists | Stock decreased |
| StockTransferred | MARD/MCHB + warehouse | Stock/location | Source decreases + target increases | Material + plant/storage/batch; warehouse joins where applicable | T320, LAGP, LQUA, LTAK, LTAP | Stock transferred |
| StockStatusChanged | MARD/MCHB | Stock/status field | Status changed | MATNR/WERKS/LGORT/CHARG | T320, LAGP, LQUA where applicable | Stock status changed |

### 9. Reservation

| Event | SAP Table / Source | SAP Field | Operator / Condition | Required Join | Enrichment Tables | Result |
|---|---|---|---|---|---|---|
| ReservationCreated | RKPF/RESB | RKPF/RESB reservation key | New record | INNER: RKPF ↔ RESB by reservation key | — | Reservation created |
| ReservationUpdated | RESB | Quantity/date/component fields | Value changed | INNER: RKPF ↔ RESB by reservation key | — | Reservation updated |
| ReservationReleased | RKPF/RESB | Release/status field | Released | INNER: RKPF ↔ RESB by reservation key | — | Reservation released |

### 10. Process Order

| Event | SAP Table / Source | SAP Field | Operator / Condition | Required Join | Enrichment Tables | Result |
|---|---|---|---|---|---|---|
| ProcessOrderCreated | AUFK/AFKO/AFPO | AUFK.AUFNR | New order | INNER: AUFK.AUFNR = AFKO.AUFNR = AFPO.AUFNR | AFVV, AFFL, CRTX, CRCA, KAKO where operation/work-center context exists | Process Order created |
| ProcessOrderReleased | JEST | JEST status | Released | Process Order OBJNR ↔ JEST.OBJNR | — | Process Order released |
| ProcessOrderUpdated | AFKO/AFPO | Relevant order fields | Value changed | AUFNR-based joins | AFVV, AFFL and production/work-center enrichment as applicable | Process Order updated |
| ProcessOrderClosed | JEST | JEST status | Closed / technically completed | Process Order OBJNR ↔ JEST.OBJNR | — | Process Order closed |

### 11. BOM

| Event | SAP Table / Source | SAP Field | Operator / Condition | Required Join | Enrichment Tables | Result |
|---|---|---|---|---|---|---|
| BOMCreated | MAST/STKO/STPO | BOM key | New BOM | INNER: MAST ↔ STKO ↔ STPO | — | BOM created |
| BOMUpdated | STKO/STPO | BOM/component fields | Value changed | BOM key joins | — | BOM updated |
| BOMReleased | STKO | STKO status | Released | BOM key joins | — | BOM released |

### 12. Production Recipe / Routing

| Event | SAP Table / Source | SAP Field | Operator / Condition | Required Join | Enrichment Tables | Result |
|---|---|---|---|---|---|---|
| RecipeCreated | MAPL/PLKO/PLPO | Routing/recipe key | New record | INNER: MAPL ↔ PLKO ↔ PLPO | AFVV, AFFL, CRTX, CRCA, KAKO where operation/work-center enrichment is applicable | Recipe created |
| RecipeUpdated | PLKO/PLPO/PLMK/AFVC | Operation/recipe fields | Value changed | Routing key joins | AFVV, AFFL, CRTX, CRCA, KAKO | Recipe updated |
| RecipeReleased | PLKO | PLKO status | Released | Routing key joins | — | Recipe released |

### 13. Production Version

| Event | SAP Table / Source | SAP Field | Operator / Condition | Required Join | Enrichment Tables | Result |
|---|---|---|---|---|---|---|
| ProductionVersionCreated | MKAL | MKAL.VERID | New record | — | — | Production version created |
| ProductionVersionUpdated | MKAL | Version fields | Value changed | — | — | Production version updated |
| ProductionVersionReleased | MKAL | MKAL status | Released | — | — | Production version released |

### 14. Work Center / Production Resource

| Event | SAP Table / Source | SAP Field | Operator / Condition | Required Join | Enrichment Tables | Result |
|---|---|---|---|---|---|---|
| WorkCenterAssigned | CRHD/AFVC | CRHD.OBJID / AFVC.ARBID | Assigned to operation | INNER: PLPO/AFVC operation ↔ CRHD.OBJID | CRTX, CRCA, KAKO, AFVV, AFFL | Work center assigned |
| WorkCenterChanged | CRHD/AFVC | Work center field | Previous ≠ current | Operation ↔ Process Order / CRHD.OBJID | CRTX, CRCA, KAKO, AFVV, AFFL | Work center changed |

### 15. Batch Determination

| Event | SAP Table / Source | SAP Field | Operator / Condition | Required Join | Enrichment Tables | Result |
|---|---|---|---|---|---|---|
| BatchDetermined | RESB | RESB.CHARG | Batch determined | RESB ↔ Process Order via reservation/order context | INOB, KSSK, AUSP, CABN, CABNT, CAWN, CAWNT, KLAH for selected batch enrichment | Batch determined |
| BatchAssigned | RESB | RESB.CHARG | Batch populated/assigned | RESB ↔ Process Order via reservation/order context | Batch classification enrichment where applicable | Batch assigned |

### 16. Material Consumption

| Event | SAP Table / Source | SAP Field | Operator / Condition | Required Join | Enrichment Tables | Result |
|---|---|---|---|---|---|---|
| MaterialConsumptionPosted | MATDOC | MATDOC.BWART + MATDOC.AUFNR | BWART = 261 AND AUFNR IS NOT NULL | INNER: MATDOC.AUFNR = AFKO.AUFNR | Batch/material enrichment as applicable | Material consumed |
| MaterialConsumptionAdjusted | MATDOC | MATDOC.MENGE | Consumption quantity adjusted | Material document ↔ Process Order | — | Consumption adjusted |
| MaterialConsumptionReversed | MATDOC | MATDOC.BWART + reversal/reference | Reversal of 261 | Original MATDOC document | — | Consumption reversed |

### 17. Production Confirmation

| Event | SAP Table / Source | SAP Field | Operator / Condition | Required Join | Enrichment Tables | Result |
|---|---|---|---|---|---|---|
| ProductionConfirmationRecorded | AFRU | AFRU confirmation key | New confirmation | INNER: AFRU.AUFPL = AFVC.AUFPL AND AFRU.APLZL = AFVC.APLZL | AFVV, AFFL | Confirmation recorded |
| ProductionConfirmationUpdated | AFRU | Confirmation fields | Value changed | INNER: AFRU ↔ AFVC | AFVV, AFFL | Confirmation updated |
| OperationCompleted | AFRU/AFVC | Operation status | Completed | AFVC ↔ Process Order operation | AFVV, AFFL, CRTX, CRCA, KAKO | Operation completed |

### 18. Batch

| Event | SAP Table / Source | SAP Field | Operator / Condition | Required Join | Enrichment Tables | Result |
|---|---|---|---|---|---|---|
| ProductionBatchCreated | MCHA/MCH1 + MATDOC | MCHA/MCH1.CHARG | New production batch | MCHA/MCH1 + MATDOC batch context; material + plant + batch | INOB, KSSK, AUSP, CABN, CABNT, CAWN, CAWNT, KLAH | Batch created |
| ProductionBatchUpdated | MCHA/MCH1 + classification | Batch/classification fields | Value changed | MATNR + CHARG + WERKS; classification joins where applicable | INOB, KSSK, AUSP, CABN, CABNT, CAWN, CAWNT, KLAH | Batch updated |
| ProductionBatchCompleted | MATDOC/Process Order | Batch/order status | Production completed | Batch ↔ Process Order | Classification enrichment where applicable | Batch completed |

### 19. Batch Transformation

| Event | SAP Table / Source | SAP Field | Operator / Condition | Required Join | Enrichment Tables | Result |
|---|---|---|---|---|---|---|
| BatchTransformationCreated | AUFK/AFKO/AFPO + MATDOC | AUFNR + CHARG | Input-output batch relationship created | Process Order ↔ MATDOC batches | INOB, KSSK, AUSP, CABN, CABNT, CAWN, CAWNT, KLAH for involved batches | Transformation created |
| BatchMerged | MATDOC | CHARG + AUFNR | Multiple input batches → one output batch | Process Order + batch relationships | Batch classification enrichment for involved batches | Batches merged |
| BatchSplit | MATDOC | CHARG + AUFNR | One input batch → multiple output batches | Process Order + batch relationships | Batch classification enrichment for involved batches | Batch split |
| BatchReworked | AUFK/AFKO/AFPO | AUFNR + CHARG | Existing batch processed again | Process Order ↔ batch | Batch classification enrichment where applicable | Batch reworked |
| BatchTransformationCompleted | AUFK/AFKO/AFPO | Order status | Transformation Process Order completed | Process Order ↔ batches | — | Transformation completed |

### 20. Production Yield / Scrap

| Event | SAP Table / Source | SAP Field | Operator / Condition | Required Join | Enrichment Tables | Result |
|---|---|---|---|---|---|---|
| YieldRecorded | MATDOC | MATDOC.BWART + MATDOC.AUFNR | BWART = 101 AND AUFNR IS NOT NULL | INNER: MATDOC.AUFNR = AFKO.AUFNR | — | Production yield recorded |
| YieldAdjusted | MATDOC | MATDOC.MENGE | Yield quantity adjusted | Material document ↔ Process Order | — | Yield adjusted |

### 21. Master Inspection Characteristic

| Event | SAP Table / Source | SAP Field | Operator / Condition | Required Join | Enrichment Tables | Result |
|---|---|---|---|---|---|---|
| InspectionCharacteristicCreated | QPMK | QPMK.MKMNR | New record | — | CAWN, CAWNT where characteristic values are configured | Characteristic created |
| InspectionCharacteristicChanged | QPMK | Characteristic fields | Value changed | — | CAWN, CAWNT | Characteristic changed |

### 22. Inspection Plan

| Event | SAP Table / Source | SAP Field | Operator / Condition | Required Join | Enrichment Tables | Result |
|---|---|---|---|---|---|---|
| InspectionPlanCreated | PLKO/PLPO/PLMK/MAPL | Plan key | New plan | Plan-key joins | — | Inspection plan created |
| InspectionPlanChanged | PLKO/PLPO/PLMK/MAPL | Plan/operation fields | Value changed | Plan-key joins | — | Inspection plan changed |

### 23. Quality Inspection Parameters

| Event | SAP Table / Source | SAP Field | Operator / Condition | Required Join | Enrichment Tables | Result |
|---|---|---|---|---|---|---|
| InspectionParameterAssigned | QMAT/QINF | Material/inspection assignment | Assignment exists | Material ↔ inspection parameter | — | Parameter assigned |
| InspectionParameterChanged | QMAT/QINF | Parameter fields | Value changed | Material ↔ inspection parameter | — | Parameter changed |

### 24. Quality Inspection Lot

| Event | SAP Table / Source | SAP Field | Operator / Condition | Required Join | Enrichment Tables | Result |
|---|---|---|---|---|---|---|
| InspectionLotCreated | QALS | QALS.PRUEFLOS | New inspection lot | Material/batch context; quality-record joins as applicable | — | Inspection lot created |
| InspectionStarted | QALS | Lot status | Inspection started | QALS ↔ quality records | — | Inspection started |
| InspectionCompleted | QALS | Lot status | Inspection completed | QALS ↔ quality records | — | Inspection completed |
| InspectionLotStatusChanged | QALS/QAST | Status | Previous ≠ current | QALS ↔ QAST | — | Lot status changed |

### 25. Sampling

| Event | SAP Table / Source | SAP Field | Operator / Condition | Required Join | Enrichment Tables | Result |
|---|---|---|---|---|---|---|
| SampleCreated | QALS/QAMR/QASR | QASE.PROBENR / sample key | New sample | Inspection lot ↔ sample records | — | Sample created |
| SampleCollected | QAMR/QASR | Sample status/date | Collected | Inspection lot ↔ sample records | — | Sample collected |
| SampleUpdated | QAMR/QASR | Sample fields | Value changed | Inspection lot ↔ sample records | — | Sample updated |
| SampleCompleted | QAMR/QASR | Sample status | Completed | Inspection lot ↔ sample records | — | Sample completed |

### 26. Quality Inspection Result

| Event | SAP Table / Source | SAP Field | Operator / Condition | Required Join | Enrichment Tables | Result |
|---|---|---|---|---|---|---|
| InspectionResultRecorded | QAMR/QAMV/QASE/QASR | Result/value fields | New result | Inspection lot + characteristic joins | — | Result recorded |
| InspectionResultChanged | QAMR/QAMV/QASE/QASR | Result/value fields | Previous ≠ current | Inspection lot + characteristic joins | — | Result changed |

### 27. Quality Usage Decision

| Event | SAP Table / Source | SAP Field | Operator / Condition | Required Join | Enrichment Tables | Result |
|---|---|---|---|---|---|---|
| QualityDecisionRecorded | QAVE | QAVE usage decision | New decision | INNER: QAVE ↔ QALS | — | Quality decision recorded |
| QualityDecisionChanged | QAVE | QAVE usage decision | Previous ≠ current | INNER: QAVE ↔ QALS | — | Quality decision changed |

### 28. Customer

| Event | SAP Table / Source | SAP Field | Operator / Condition | Required Join | Enrichment Tables | Result |
|---|---|---|---|---|---|---|
| CustomerCreated | KNA1 | KNA1.KUNNR | New record | — | T077X, T005/T005T/T005S/T005U where geography/account-group enrichment applies | Customer created |
| CustomerUpdated | KNA1/KNVV/KNVP/ADR6 + enrichment | Customer fields | Value changed | KUNNR-based joins; KNMT and sales-area joins as applicable | KNMT, T077X, TVKO/TVKOT, TVTW/TVTWT, TSPAT, T005/T005T/T005S/T005U | Customer updated |
| CustomerBlocked | KNA1/KNVV | Status/block field | Blocked | KUNNR-based joins | — | Customer blocked |
| CustomerUnblocked | KNA1/KNVV | Status/block field | Unblocked | KUNNR-based joins | — | Customer unblocked |

### 29. Sales Order

| Event | SAP Table / Source | SAP Field | Operator / Condition | Required Join | Enrichment Tables | Result |
|---|---|---|---|---|---|---|
| SalesOrderCreated | VBAK | VBAK.VBELN | New record | — | TVKO/TVKOT, TVTW/TVTWT, TSPAT, T685/T685T, T683/T683T | Sales order created |
| SalesOrderChanged | VBAK/VBUK/VBPA + enrichment | Relevant fields | Value changed | VBELN; pricing/sales-area enrichment joins as applicable | TVKO/TVKOT, TVTW/TVTWT, TSPAT, T685/T685T, T683/T683T | Sales order changed |
| SalesOrderConfirmed | VBUK/VBAP | Confirmation/status | Confirmed | INNER: VBAK.VBELN = VBAP.VBELN | Sales-area/pricing enrichment as applicable | Sales order confirmed |
| SalesOrderCancelled | VBUK/VBFA | Status/document flow | Cancelled | VBELN; VBFA when cancellation/reference is document-derived | TVAG/TVAGT where rejection reason is applicable | Sales order cancelled |
| SalesOrderCompleted | VBUK | VBUK.GBSTK | Completed | VBELN | — | Sales order completed |

### 30. Sales Order Item

| Event | SAP Table / Source | SAP Field | Operator / Condition | Required Join | Enrichment Tables | Result |
|---|---|---|---|---|---|---|
| SalesOrderItemAdded | VBAP | VBAP.VBELN + VBAP.POSNR | New item | INNER: VBAP.VBELN = VBAK.VBELN | KNMT, TVKO/TVKOT, TVTW/TVTWT, TSPAT, T685/T685T, TVAG/TVAGT | Item added |
| QuantityChanged | VBAP | VBAP.KWMENG | Previous ≠ current | VBELN + POSNR | KNMT and pricing/rejection enrichment as applicable | Quantity changed |
| DeliveryDateChanged | VBAP | VBAP.VDATU_ANA | Previous ≠ current | VBELN + POSNR | — | Delivery date changed |
| ItemConfirmed | VBUP/VBAP | VBUP.GBSTA | Confirmed | INNER: VBAP ↔ VBUP | — | Item confirmed |
| ItemCancelled | VBUP/VBAP | Item status | Cancelled/rejected | INNER: VBAP ↔ VBUP | TVAG/TVAGT | Item cancelled |

### 31. Sales Batch Allocation

| Event | SAP Table / Source | SAP Field | Operator / Condition | Required Join | Enrichment Tables | Result |
|---|---|---|---|---|---|---|
| BatchAllocated | LIPS | LIPS.CHARG | Batch populated | INNER/LEFT: LIPS.VBELN/POSNR ↔ delivery; batch join to MCHA/MCH1 using MATNR/WERKS/CHARG | INOB, KSSK, AUSP, CABN, CABNT, CAWN, CAWNT, KLAH | Batch allocated |
| BatchAllocationChanged | LIPS | LIPS.CHARG | Previous ≠ current | Delivery item + batch joins | Batch classification enrichment where applicable | Batch allocation changed |
| BatchDeallocated | LIPS | LIPS.CHARG | Previously populated → NULL | Delivery item | — | Batch deallocated |
| BatchAllocationConfirmed | LIPS | CHARG/status | Allocation confirmed | Delivery item + batch | Batch classification enrichment where applicable | Batch allocation confirmed |

### 32. Outbound Delivery

| Event | SAP Table / Source | SAP Field | Operator / Condition | Required Join | Enrichment Tables | Result |
|---|---|---|---|---|---|---|
| DeliveryCreated | LIKP | LIKP.VBELN | New delivery | — | — | Delivery created |
| DeliveryChanged | LIKP/LIPS | Delivery fields | Value changed | INNER: LIKP.VBELN = LIPS.VBELN | TVAG/TVAGT where rejection reason applies | Delivery changed |
| DeliveryReleased | LIKP | Release/status field | Released | — | — | Delivery released |
| DeliveryPicked | LIPS | Picking status | Picked | LIKP.VBELN = LIPS.VBELN | Warehouse enrichment only where warehouse-managed context exists | Delivery picked |
| DeliveryShipped | MATDOC | MATDOC.BWART | GI posted for delivery | MATDOC delivery reference ↔ LIPS/LIKP | — | Delivery shipped / dispatch GI posted |
| DeliveryCompleted | LIKP | Completion/status | Completed | — | — | Delivery completed |
| DeliveryCancelled | LIKP | Cancellation/status | Cancelled | — | — | Delivery cancelled |

### 33. Delivery Item

| Event | SAP Table / Source | SAP Field | Operator / Condition | Required Join | Enrichment Tables | Result |
|---|---|---|---|---|---|---|
| DeliveryItemCreated | LIPS | LIPS.VBELN + LIPS.POSNR | New item | INNER: LIPS.VBELN = LIKP.VBELN | — | Delivery item created |
| QuantityChanged | LIPS | LIPS.LFIMG | Previous ≠ current | VBELN + POSNR | — | Quantity changed |
| BatchAssigned | LIPS | LIPS.CHARG | IS NOT NULL | Delivery item ↔ batch using MATNR/WERKS/CHARG | INOB, KSSK, AUSP, CABN, CABNT, CAWN, CAWNT, KLAH | Batch assigned |
| ItemPicked | LIPS | Picking status | Picked | Delivery item | Warehouse enrichment where applicable | Item picked |
| ItemShipped | MATDOC/LIPS | GI reference/status | GI posted | MATDOC ↔ delivery item | — | Item shipped |
| ItemDelivered | LIPS/LIKP | Delivery status | Completed | Delivery item ↔ delivery | — | Item delivered |

### 34. Billing Document

| Event | SAP Table / Source | SAP Field | Operator / Condition | Required Join | Enrichment Tables | Result |
|---|---|---|---|---|---|---|
| InvoiceCreated | VBRK/VBRP | VBRK.VBELN + VBRP.POSNR | New billing document | INNER: VBRK.VBELN = VBRP.VBELN | — | Invoice created |
| InvoicePosted | VBRK | Posting/accounting status | Posted | INNER: VBRK ↔ VBRP | — | Invoice posted / billing completed |
| InvoiceCancelled | VBRK/VBRP | Cancellation/reference | Cancellation exists | VBFA document flow | — | Invoice cancelled |
| InvoiceAdjusted | VBRK/VBRP | Adjustment/reference | Adjustment document exists | VBFA document flow | — | Invoice adjusted |

### 35. Sales Return

| Event | SAP Table / Source | SAP Field | Operator / Condition | Required Join | Enrichment Tables | Result |
|---|---|---|---|---|---|---|
| ReturnRequested | VBAK/VBFA | Document/category | Return request created | VBFA document flow | TVAG/TVAGT where rejection reason applies | Return requested |
| ReturnCreated | VBAK/LIKP | VBELN | Return document created | VBFA document flow | — | Return created |
| ReturnReceived | MATDOC | BWART | Receipt movement for return | MATDOC ↔ return delivery | — | Return received |
| ReturnInspected | QALS | PRUEFLOS/status | Inspection lot exists for return | QALS ↔ return batch/material | — | Return inspected |
| ReturnAccepted | Return status | Acceptance field | Accepted | Return document flow | — | Return accepted |
| ReturnRejected | Return status | Rejection field | Rejected | Return document flow | — | Return rejected |
| ReturnCompleted | Return status | Completion field | Completed | Return document flow | — | Return completed |

### 36. GRN

| Event | SAP Table / Source | SAP Field | Operator / Condition | Required Join | Enrichment Tables | Result |
|---|---|---|---|---|---|---|
| GRNCreated | MATDOC | MATDOC.MBLNR + MATDOC.MJAHR + MATDOC.ZEILE | New material document item | — | — | GRN created |
| GRNPosted | MATDOC | MATDOC.BWART + EBELN + EBELP | BWART = 101 AND EBELN IS NOT NULL AND EBELP IS NOT NULL | INNER: MATDOC.EBELN = EKPO.EBELN AND MATDOC.EBELP = EKPO.EBELP | EINA/EINE and PO-type enrichment only for payload context | Procurement GRN posted |
| GRNReversed | MATDOC | Reversal/reference fields | Reversal of original GRN | Original MATDOC document | — | GRN reversed |
| BatchReceived | MATDOC | MATDOC.CHARG | CHARG IS NOT NULL + GRN condition | MATDOC ↔ EKPO via EBELN/EBELP | Batch classification enrichment where applicable | Batch received |
| QuantityReceived | MATDOC | MATDOC.MENGE | MENGE > 0 + GRN condition | MATDOC ↔ EKPO via EBELN/EBELP | — | Quantity received |

## 2. 51-Table Enrichment Impact Mapping

These rows define how the new enrichment tables participate in event payload resolution. They are **not additional event types**.

| # | SAP Table | Enrichment Area | Required Fields | Impacted Events | Event Trigger Role | Join |
|---:|---|---|---|---|---|---|
| 100 | MARM | Material Master | MATNR, MEINH, UMREZ, UMREN, EAN11 | MaterialCreated; MaterialUpdated; PlannedOrderCreated/Updated; PO payload enrichment | Enrichment only; not an independent event | MARA.MATNR = MARM.MATNR |
| 101 | MEAN | Material Master | MATNR, MEINH, EAN11, HPEAN | MaterialCreated; MaterialUpdated; material references in traceability payloads | Enrichment only; not an independent event | MARA.MATNR = MEAN.MATNR |
| 102 | T023 | Material Master | MATKL | MaterialCreated; MaterialUpdated | Enrichment only | MARA.MATKL = T023.MATKL |
| 103 | T023T | Material Master | MATKL, SPRAS, WGBEZ | MaterialCreated; MaterialUpdated | Enrichment only | T023.MATKL = T023T.MATKL + language = T023T.SPRAS |
| 104 | T134 | Material Master | MTART | MaterialCreated; MaterialUpdated; contextual Material resolution | Enrichment only | MARA.MTART = T134.MTART |
| 105 | T134T | Material Master | MTART, SPRAS, MTBEZ | MaterialCreated; MaterialUpdated; contextual Material resolution | Enrichment only | T134.MTART = T134T.MTART + language = T134T.SPRAS |
| 106 | T179 | Material Master | PRODH, STUFE | MaterialCreated; MaterialUpdated | Enrichment only | MARA.PRDHA = T179.PRODH |
| 107 | T179T | Material Master | PRODH, SPRAS, VTEXT | MaterialCreated; MaterialUpdated | Enrichment only | T179.PRODH = T179T.PRODH + language = T179T.SPRAS |
| 108 | MLAN | Material Master | MATNR, ALAND, TAXM1 | MaterialUpdated | Enrichment only | MARA.MATNR = MLAN.MATNR + country context = MLAN.ALAND |
| 109 | MBEWH | Material Master | MATNR, BWKEY, BWTAR, LFGJA, LFMON, STPRS, VERPR | MaterialUpdated | Enrichment only | MARA.MATNR = MBEWH.MATNR + valuation-area context = MBEWH.BWKEY |
| 110 | EINA | Supplier/Procurement | INFNR, MATNR, LIFNR, IDNLF | SupplierSourceCreated/Updated; PurchaseOrderCreated/Updated | Enrichment only | EORD.MATNR = EINA.MATNR AND EORD.LIFNR = EINA.LIFNR |
| 111 | EINE | Supplier/Procurement | INFNR, EKORG, ESOKZ, WERKS, NETPR, PEINH, APLFZ | SupplierSourceCreated/Updated; PurchaseOrderCreated/Updated | Enrichment only | EINA.INFNR = EINE.INFNR + EKORG/WERKS context |
| 112 | T024 | Supplier/Procurement | EKGRP, EKNAM | PurchaseOrderCreated/Updated/Released | Enrichment only | EKKO.EKGRP = T024.EKGRP |
| 113 | T024E | Supplier/Procurement | EKORG, BUKRS | PurchaseOrderCreated/Updated/Released | Enrichment only | EKKO.EKORG = T024E.EKORG |
| 114 | T161 | Supplier/Procurement | BSTYP, BSART | PurchaseOrderCreated/Updated/Released | Enrichment only | EKKO.BSTYP = T161.BSTYP AND EKKO.BSART = T161.BSART |
| 115 | T161T | Supplier/Procurement | SPRAS, BSART, BATXT | PurchaseOrderCreated/Updated/Released | Enrichment only | T161.BSART = T161T.BSART + language = T161T.SPRAS |
| 116 | KNMT | Customer/Customer-Material | KUNNR, MATNR, VKORG, VTWEG, KDMAT | CustomerUpdated; SalesOrderCreated/Changed; SalesOrderItemAdded/QuantityChanged | Enrichment only | Customer + material + sales-area context; e.g. VBAK.KUNNR/KNA1.KUNNR + VBAP.MATNR + VKORG/VTWEG |
| 117 | T077X | Customer/Customer-Material | KTOKD, SPRAS, TXT30 | CustomerCreated/Updated | Enrichment only | KNA1.KTOKD = T077X.KTOKD + language = T077X.SPRAS |
| 118 | TVKO | Customer/Customer-Material | VKORG, BUKRS, WAERS | CustomerUpdated; SalesOrderCreated/Changed | Enrichment only | KNVV.VKORG = TVKO.VKORG |
| 119 | TVKOT | Customer/Customer-Material | VKORG, SPRAS, VTEXT | CustomerUpdated; SalesOrderCreated/Changed | Enrichment only | TVKO.VKORG = TVKOT.VKORG + language = TVKOT.SPRAS |
| 120 | TVTW | Customer/Customer-Material | VTWEG | CustomerUpdated; SalesOrderCreated/Changed | Enrichment only | KNVV.VTWEG = TVTW.VTWEG |
| 121 | TVTWT | Customer/Customer-Material | VTWEG, SPRAS, VTEXT | CustomerUpdated; SalesOrderCreated/Changed | Enrichment only | TVTW.VTWEG = TVTWT.VTWEG + language = TVTWT.SPRAS |
| 122 | TSPAT | Customer/Customer-Material | SPART, SPRAS, VTEXT | CustomerUpdated; SalesOrderCreated/Changed; SalesOrderItemAdded | Enrichment only | KNVV.SPART = TSPAT.SPART + language = TSPAT.SPRAS |
| 123 | T005 | Geographic | LAND1, NATIO | CustomerCreated/Updated; geographic context | Enrichment only | Country code = T005.LAND1 |
| 124 | T005T | Geographic | LAND1, SPRAS, LANDX | CustomerCreated/Updated | Enrichment only | T005.LAND1 = T005T.LAND1 + language = T005T.SPRAS |
| 125 | T005S | Geographic | LAND1, BLAND | CustomerCreated/Updated; regional context | Enrichment only | Country + region context = T005S.LAND1 + T005S.BLAND |
| 126 | T005U | Geographic | LAND1, BLAND, SPRAS, BEZEI | CustomerCreated/Updated | Enrichment only | T005S.LAND1 = T005U.LAND1 AND T005S.BLAND = T005U.BLAND + language = T005U.SPRAS |
| 127 | INOB | Batch Classification | CUOBJ, OBTAB, KLART, OBJEK | BatchDetermined; BatchAssigned; ProductionBatchUpdated; batch genealogy payload | Enrichment only | Resolve batch classification object from batch; match INOB.OBJEK + INOB.KLART |
| 128 | KSSK | Batch Classification | OBJEK, MAFID, KLART, CLINT | BatchDetermined; BatchAssigned; ProductionBatchUpdated | Enrichment only | INOB.OBJEK = KSSK.OBJEK AND INOB.KLART = KSSK.KLART |
| 129 | AUSP | Batch Classification | OBJEK, ATINN, ATWRT, ATFLV, ATAUT | ProductionBatchUpdated; batch verification payload | Enrichment only | KSSK/INOB classification object = AUSP.OBJEK with KLART context |
| 130 | CABN | Batch Classification | ATINN, ATNAM, ATFOR, ANZST | ProductionBatchUpdated; inspection/characteristic context | Enrichment only | AUSP.ATINN = CABN.ATINN |
| 131 | CABNT | Batch Classification | ATINN, SPRAS, ATBEZ | ProductionBatchUpdated; characteristic display | Enrichment only | CABN.ATINN = CABNT.ATINN + language = CABNT.SPRAS |
| 132 | CAWN | Batch Classification | ATINN, ATZHL, ATWRT, ATAWE | ProductionBatchUpdated; characteristic-value validation | Enrichment only | CABN.ATINN = CAWN.ATINN |
| 133 | CAWNT | Batch Classification | ATINN, ATZHL, SPRAS, ATWTB | ProductionBatchUpdated; characteristic-value display | Enrichment only | CAWN.ATINN = CAWNT.ATINN AND CAWN.ATZHL = CAWNT.ATZHL + language = CAWNT.SPRAS |
| 134 | KLAH | Batch Classification | CLINT, CLASS, KLART, KLNAM | ProductionBatchUpdated; batch class display | Enrichment only | KSSK.CLINT = KLAH.CLINT AND KSSK.KLART = KLAH.KLART |
| 135 | AFVV | Production/Work Center | AUFPL, APLZL, VGW01, VGW02, VGW03, ISM01, ISM02, ISM03 | ProcessOrderUpdated; RecipeUpdated; ProductionConfirmationRecorded/Updated; OperationCompleted; WorkCenterAssigned/Changed | Enrichment only | AFVC.AUFPL = AFVV.AUFPL AND AFVC.APLZL = AFVV.APLZL |
| 136 | AFFL | Production/Work Center | AUFPL, APLZL, PLNFL | ProcessOrderUpdated; RecipeUpdated; ProductionConfirmationRecorded/Updated; OperationCompleted | Enrichment only | AFVC.AUFPL = AFFL.AUFPL + applicable operation-sequence relationship |
| 137 | CRTX | Production/Work Center | OBJTY, OBJID, SPRAS, KTEXT | WorkCenterAssigned/Changed; Recipe/operation payload | Enrichment only | CRHD.OBJTY = CRTX.OBJTY AND CRHD.OBJID = CRTX.OBJID + language = CRTX.SPRAS |
| 138 | CRCA | Production/Work Center | OBJTY, OBJID, KAPID, BEGDA, ENDDA | WorkCenterAssigned/Changed; ProcessOrder/operation payload | Enrichment only | CRHD.OBJTY = CRCA.OBJTY AND CRHD.OBJID = CRCA.OBJID + validity date in BEGDA/ENDDA |
| 139 | KAKO | Production/Work Center | KAPID, KAPAR, KAPAZ | WorkCenterAssigned/Changed; capacity payload | Enrichment only | CRCA.KAPID = KAKO.KAPID |
| 140 | T320 | Warehouse Conditional | WERKS, LGORT, LGNUM | StockTransferred; DeliveryPicked; ItemPicked where warehouse-managed | Conditional enrichment; no independent event | MARD.WERKS = T320.WERKS AND MARD.LGORT = T320.LGORT |
| 141 | LAGP | Warehouse Conditional | LGNUM, LGTYP, LGPLA | StockTransferred; DeliveryPicked; ItemPicked where warehouse-managed | Conditional enrichment; no independent event | T320.LGNUM = LAGP.LGNUM |
| 142 | LQUA | Warehouse Conditional | LGNUM, LGTYP, LGPLA, MATNR, CHARG, VERME | StockTransferred; warehouse stock context | Conditional enrichment; no independent event | LAGP.LGNUM = LQUA.LGNUM AND LAGP.LGTYP = LQUA.LGTYP AND LAGP.LGPLA = LQUA.LGPLA |
| 143 | LTAK | Warehouse Conditional | TANUM, LGNUM, BWLVS, BNAME | StockTransferred; warehouse transfer context | Conditional enrichment; no independent event | LQUA.LGNUM = LTAK.LGNUM + applicable warehouse transfer reference |
| 144 | LTAP | Warehouse Conditional | TANUM, TAPOS, MATNR, CHARG, VLPLA, NLPLA | StockTransferred; warehouse transfer context | Conditional enrichment; no independent event | LTAK.TANUM = LTAP.TANUM |
| 145 | T685 | Sales Pricing | KAPPL, KSCHL, KOAID | SalesOrderCreated/Changed; SalesOrderItemAdded/QuantityChanged | Enrichment only | Resolve pricing condition context to T685.KAPPL + T685.KSCHL |
| 146 | T685T | Sales Pricing | KAPPL, KSCHL, SPRAS, VTEXT | SalesOrderCreated/Changed; SalesOrderItemAdded/QuantityChanged | Enrichment only | T685.KAPPL = T685T.KAPPL AND T685.KSCHL = T685T.KSCHL + language = T685T.SPRAS |
| 147 | T683 | Sales Pricing | KALSM, KVEWE, KAPPL | SalesOrderCreated/Changed | Enrichment only | VBAK.KALSM = T683.KALSM with applicable KVEWE/KAPPL context |
| 148 | T683T | Sales Pricing | KALSM, SPRAS, VTEXT | SalesOrderCreated/Changed | Enrichment only | T683.KALSM = T683T.KALSM + language = T683T.SPRAS |
| 149 | TVAG | Sales/Delivery Reason | ABGRU | SalesOrderCancelled; SalesOrderItemCancelled; DeliveryChanged/return context where applicable | Enrichment only | Relevant item rejection code ABGRU = TVAG.ABGRU |
| 150 | TVAGT | Sales/Delivery Reason | ABGRU, SPRAS, BEZEI | SalesOrderCancelled; SalesOrderItemCancelled; Delivery/return context where applicable | Enrichment only | TVAG.ABGRU = TVAGT.ABGRU + language = TVAGT.SPRAS |

## 3. Critical Field-Level Event Rules

| Event | Rule |
|---|---|
| GRNPosted | `MATDOC.BWART = 101 AND MATDOC.EBELN IS NOT NULL AND MATDOC.EBELP IS NOT NULL` |
| YieldRecorded | `MATDOC.BWART = 101 AND MATDOC.AUFNR IS NOT NULL` |
| MaterialConsumptionPosted | `MATDOC.BWART = 261 AND MATDOC.AUFNR IS NOT NULL` |
| BatchAssigned | `CHARG IS NOT NULL` in the applicable reservation/delivery context |
| PlannedOrderConverted | A valid Planned Order → Process Order relationship exists (`PLAF.PLNUM → AFPO.PLNUM/AFPO.AUFNR` or populated `PLAF.AUFNR`) |
| Purchase Order → PR | Resolve the PO back to its Purchase Requisition through the available SAP reference; do not infer the relationship from unrelated enrichment tables |
| GRN → PO | `MATDOC.EBELN = EKPO.EBELN AND MATDOC.EBELP = EKPO.EBELP` |
| Material Movement | Primarily determined from `MATDOC.BWART`; warehouse tables are contextual enrichment only |
| Batch Transformation | Derived from Process Order + input/output batch relationships |
| InvoicePosted | Billing document is posted/accounting status indicates posted; this is the terminal billing event for the current POC scope |

## 4. Contextual Business Object Handling

The event resolver operates after contextual applicability is resolved. For Batch, the canonical context remains `ROH`, `HALB`, `FERT`, or `VERP`. The same canonical Business Object type may occur multiple times in a genealogy with different instance data; the event is attached to the concrete object instance identified by its SAP keys.

Recommended execution order:

`SAP Change / Snapshot → Event Trigger Detection → Canonical Object Resolution → Context Resolution → Core SAP Join Resolution → Enrichment Join Resolution → Event Payload → Relationship Resolver / Genealogy`

## 5. Implementation rule

**Do not fire an event merely because an enrichment row exists.** Detect the lifecycle event from the authoritative event source/field first, then use the enrichment tables to populate the event payload and contextual attributes. Where the business requirement explicitly treats an enrichment-master change as a business-object update, it can be included in the corresponding `*Updated` event after validating the actual SAP extract and change-detection mechanism.

## 6. Emcure-specific exclusions

- No SAP Transportation business object.
- No `VTTK` / `VTTP` dependency.
- No IPFS dependency in the current architecture.
- Batch-level traceability remains the POC granularity.
- Scope terminates at Billing; external shipment tracking is outside this event catalog.

## 7. Source alignment

This document is aligned to the current 36-object canonical schema, the 51-table enrichment reference, and the updated field-level Relationship Resolver. The uploaded event catalog was used as the event baseline; enrichment was added without expanding the canonical business-object count.