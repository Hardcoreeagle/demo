# SAP Business Objects Mapping Specification & Architecture

This document provides the complete, authoritative mapping from SAP ERP / S/4HANA source tables and fields located in the `supply/` directory to the target **37 Business Objects** (Objects #1 to #36 + GRN).

## Key Architectural Directives
1. **Language & Execution Engine**: Built entirely in pure **Go (Golang)** with zero external dependencies.
2. **Unified Universal Journal (MATDOC)**: In accordance with modern S/4HANA principles and user instruction, `MATDOC` is utilized directly in place of separate legacy `MSEG` (items) and `MKPF` (header) tables for material movements, consumption, yield, and goods receipt.

## S/4HANA MATDOC Architecture: Replacing MSEG and MKPF

In SAP S/4HANA, the legacy material document header table (`MKPF`) and material document item table (`MSEG`) are consolidated into a single Universal Material Document table: **`MATDOC`**.

### Field Mapping Comparison: Legacy (MKPF / MSEG) vs S/4HANA (MATDOC)

| Information Category | Legacy ECC Header (`MKPF`) | Legacy ECC Item (`MSEG`) | S/4HANA Consolidated Table (`MATDOC`) | Used in Business Object |
|---|---|---|---|---|
| Material Document Number | `MKPF-MBLNR` | `MSEG-MBLNR` | `MATDOC-MBLNR` | #8 Material Movement, #16 Consumption, #19 Yield, #37 GRN |
| Document Year | `MKPF-MJAHR` | `MSEG-MJAHR` | `MATDOC-MJAHR` | #8 Material Movement, #16 Consumption, #37 GRN |
| Document Item Number | — | `MSEG-ZEILE` | `MATDOC-ZEILE` | #8 Material Movement, #37 GRN |
| Movement Type | — | `MSEG-BWART` | `MATDOC-BWART` | #8 Movement, #16 Consumption, #18 Batch Trf, #19 Yield, #37 GRN |
| Posting Date | `MKPF-BUDAT` | — | `MATDOC-BUDAT` | #8 Material Movement, #16 Consumption, #19 Yield, #37 GRN |
| Document Date | `MKPF-BLDAT` | — | `MATDOC-BLDAT` | #8 Material Movement, #37 GRN |
| Material Number | — | `MSEG-MATNR` | `MATDOC-MATNR` | #8 Movement, #9 Inventory, #18 Batch Trf, #19 Yield, #37 GRN |
| Plant | — | `MSEG-WERKS` | `MATDOC-WERKS` | #8 Material Movement, #16 Consumption, #37 GRN |
| Storage Location | — | `MSEG-LGORT` | `MATDOC-LGORT` | #8 Material Movement, #16 Consumption, #37 GRN |
| Batch Number | — | `MSEG-CHARG` | `MATDOC-CHARG` | #8 Movement, #16 Consumption, #18 Batch Trf, #19 Yield, #37 GRN |
| Quantity | — | `MSEG-MENGE` | `MATDOC-MENGE` | #8 Material Movement, #16 Consumption, #19 Yield, #37 GRN |
| Unit of Measure | — | `MSEG-MEINS` | `MATDOC-MEINS` | #8 Movement, #9 Inventory, #16 Consumption, #19 Yield, #37 GRN |
| Reference Document (BOL) | `MKPF-XBLNR` | — | `MATDOC-XBLNR` | #8 Material Movement |
| Purchase Order Number | — | `MSEG-EBELN` | `MATDOC-EBELN` | #8 Material Movement, #37 GRN |
| Purchase Order Item | — | `MSEG-EBELP` | `MATDOC-EBELP` | #37 GRN |
| Manufacturing Order | — | `MSEG-AUFNR` | `MATDOC-AUFNR` | #8 Material Movement, #16 Consumption, #18 Batch Trf, #19 Yield |
| Reservation Number | — | `MSEG-RSNUM` | `MATDOC-RSNUM` | #8 Material Movement, #16 Consumption |
| Reservation Item | — | `MSEG-RSPOS` | `MATDOC-RSPOS` | #16 Material Consumption |
| Stock Type | — | `MSEG-INSMK` | `MATDOC-INSMK` | #37 GRN |
| Delivery Completed | — | `MSEG-ELIKZ` | `MATDOC-ELIKZ` | #37 GRN |
| Cost Centre | — | `MSEG-KOSTL` | `MATDOC-KOSTL` | #16 Material Consumption |
| Vendor / Supplier | — | `MSEG-LIFNR` | `MATDOC-LIFNR` | #37 GRN |
| Customer Number | — | `MSEG-KUNNR` | `MATDOC-KUNNR` | #8 Material Movement |

### Implementation in Codebase
1. **Zero Legacy MKPF/MSEG Loading**: In [cmd/main.go](file:///c:/Users/Lenovo/OneDrive/Desktop/build/cmd/main.go) and [pkg/builder/builder_test.go](file:///c:/Users/Lenovo/OneDrive/Desktop/build/pkg/builder/builder_test.go), neither `MKPF.csv` nor `MSEG.csv` are loaded into memory.
2. **Unified Querying via MATDOC**: All inventory movements, goods receipts, production consumption, batch transformation links, and yields are read directly from `MATDOC`.
3. **No Logistic Tables Policy**: Goods Receipt (GRN) utilizes `MATDOC` directly without touching Logistics Execution tables (`LIKP`, `LIPS`, `VTTK`, `VTTP`, `VEKP`, `VEPO`, `EKES`).

---

## Business Objects Summary Table

| # | Business Object | Primary SAP Tables | Key Join Fields / Criteria | Output JSON File |
|---|---|---|---|---|
| 1 | **Planning Requirement** | `PBED`, `PBIM`, `T001W`, `MAST` | `PBED.BDZEI = PBIM.BDZEI`, `PBIM.WERKS = T001W.WERKS` | `01_planning_requirement.json` |
| 2 | **Planned Order** | `PLAF`, `MAKT` | `PLAF.MATNR = MAKT.MATNR` | `02_planned_order.json` |
| 3 | **Material** | `MARA`, `MAKT`, `MARC` | `MARA.MATNR = MAKT.MATNR = MARC.MATNR` | `03_material.json` |
| 4 | **Batch** | `MCHA`, `MCH1` | Batch master keys `MATNR + WERKS + CHARG` | `04_batch.json` |
| 5 | **Supplier or source** | `LFA1`, `LFB1`, `ADRC`, `ADR6`, `EORD` | `LFA1.LIFNR = LFB1.LIFNR = EORD.LIFNR`, `ADRC.ADDRNUMBER = LFA1.ADRNR` | `05_supplier_or_source.json` |
| 6 | **Purchase Requisition** | `EBAN` | Purchase requisition items `BANFN + BNFPO` | `06_purchase_requisition.json` |
| 7 | **Purchase order** | `EKKO`, `EKPO`, `EKET` | `EKKO.EBELN = EKPO.EBELN = EKET.EBELN` | `07_purchase_order.json` |
| 8 | **Material Movement** | `MATDOC` | S/4HANA Unified Journal (`MBLNR + MJAHR + ZEILE`) | `08_material_movement.json` |
| 9 | **Inventory/Stock** | `MCHB`, `MARD`, `MARA` | Batch & Storage Location Stocks (`LABST, INSME, SPEME, EINME, RETME, UMLME`) | `09_inventory_stock.json` |
| 10 | **Reservation** | `RESB`, `RKPF` | Reservation header & item `RSNUM + RSPOS` | `10_reservation.json` |
| 11 | **Process order** | `AFKO`, `AFPO`, `AUFK` | Manufacturing order header, item & master `AFKO.AUFNR = AFPO.AUFNR = AUFK.AUFNR` | `11_process_order.json` |
| 12 | **BOM** | `STKO`, `STPO`, `MAST` | Bill of Material header & items `STKO.STLNR = STPO.STLNR`, `MAST.STLNR = STKO.STLNR` | `12_bom.json` |
| 13 | **Recipe** | `PLKO`, `PLPO`, `MAPL` | Routing/Recipe header & operations `PLKO.PLNNR = PLPO.PLNNR`, `MAPL.PLNNR = PLKO.PLNNR` | `13_recipe.json` |
| 14 | **Production Version** | `MKAL` | Material production versions `MATNR + WERKS + VERID` | `14_production_version.json` |
| 15 | **Batch Determination** | `RESB`, `MCHB`, `AFPO` | Allocation of batch `CHARG` to reservation `RSNUM + RSPOS` | `15_batch_determination.json` |
| 16 | **Material Consumption** | `MATDOC` (or `RESB`) | Order consumption movement `BWART = 261 / 262` | `16_material_consumption.json` |
| 17 | **Production Confirmation**| `AFRU`, `AFVC`, `CRHD` | Order operation confirmation `AFRU.AUFNR + VORNR`, work center `CRHD.ARBID` | `17_production_confirmation.json` |
| 18 | **Batch transformation** | `AFPO`, `RESB`, `MATDOC` | Link between input consumed components (`261`) and output produced batch (`101` / `AFPO`) | `18_batch_transformation.json` |
| 19 | **Yield** | `AFRU`, `AFPO`, `MATDOC` | Confirmed yield (`GMNGA`) & scrap (`XMNGA`) from confirmations / receipts | `19_yield.json` |
| 21 | **Inspection Characteristic** | `QPMK`, `PLMK` | Master Inspection Characteristics (`MKMNR`) & inspection plan allocation | `21_inspection_characteristic.json` |
| 22 | **Inspection Plan** | `PLKO`, `PLPO`, `PLMK`, `MAPL` | QM Inspection Plans (`PLNTY = 'Q'`) with operations and characteristic specs | `22_inspection_plan.json` |
| 23 | **Inspection Parameter** | `QMAT`, `QAMV`, `QPMK` | Material QM inspection type activation & characteristic inspection specifications | `23_inspection_parameter.json` |
| 24 | **Quality inspection Lot** | `QALS` | Inspection lot master (`PRUEFLOS`) with PO, order, and material document links | `24_quality_inspection_lot.json` |
| 25 | **Sampling** | `QASE`, `QALS` | Sample records (`PRUEFLOS + PROBENR`) drawn from inspection lot | `25_sampling.json` |
| 26 | **Inspection result** | `QAMR`, `QASE`, `QALS` | Recorded sample & characteristic inspection results (`MITTELWERT` / `ORIGINAL_INPUT`) | `26_inspection_result.json` |
| 27 | **Usage decision** | `QAVE`, `QALS` | Quality Usage Decision code (`VCODE`) and valuation (`VBEWERTUNG`) | `27_usage_decision.json` |
| 28 | **Customer or CFA** | `KNA1`, `KNB1`, `ADRC`, `ADR6` | Customer master, company code data, address, and email | `28_customer_or_cfa.json` |
| 29 | **Sales order** | `VBAK`, `VBUK` | Sales order header (`VBELN`, `AUART`, `KUNNR`, `AUDAT`) | `29_sales_order.json` |
| 30 | **Sales order item** | `VBAP`, `VBAK` | Sales order line items (`POSNR`, `MATNR`, `KWMENG`, confirmed schedule line) | `30_sales_order_item.json` |
| 31 | **Sales batch allocation**| `LIPS`, `VBAP`, `VBFA` | Allocation of batch (`CHARG`) to sales order item / delivery line | `31_sales_batch_allocation.json` |
| 32 | **Outbound delivery** | `LIKP`, `LIPS` | Outbound delivery header (`VBELN`, `LFART`, `KUNNR`, `LFDAT`, `WADAT_IST`) | `32_outbound_delivery.json` |
| 33 | **Delivery item** | `LIPS` | Outbound delivery line items (`POSNR`, `LFIMG`, `VRKME`, `WERKS`, `LGORT`, statuses) | `33_delivery_item.json` |
| 34 | **Billing document** | `VBRK`, `VBRP` | Billing document header & items (`VBELN`, `FKART`, `NETWR`, `MWSBK`, gross) | `34_billing_document.json` |
| 35 | **Sales Return** | `VBRK`, `VBRP`, `VBAP`, `VBFA` | Returns credit/invoice reference (`FKART_RL = 'LR'`) linked to order & delivery | `35_sales_return.json` |
| 36 | **Work Centre** | `CRHD` | Work center master (`OBJID`, `ARBPL`, `WERKS`, `VERWE`, `KAPID`, `KOSTL`, `STAND`) | `36_work_centre.json` |
| **GRN** | **GoodsReceipt** | `MATDOC`, `EKKO`, `QALS` | **Strictly MM tables (NO Logistic Tables)**: `MBLNR, MJAHR, ZEILE, BWART=101, EBELN, EBELP, LIFNR` | `37_goods_receipt_grn.json` |

---

## Detailed Field-by-Field Mappings

### 1. Planning Requirement
- **Target Schema**:
  - `planning_requirement_id`: `PBED.BDZEI`
  - `material_id`: `PBIM.MATNR`
  - `plant_id`: `PBIM.WERKS`
  - `requirement_quantity`: `PBED.PLNMG` (Planned quantity) or `PBED.ENTMG`
  - `requirement_date`: `PBED.PDATU` (Planned date)
  - `plant_name`: `T001W.NAME1` (Joined via `PBIM.WERKS = T001W.WERKS`)
  - `uom`: `PBED.MEINS`
  - `bom_related_information`: `MAST.STLNR` / `MAST.STLAL` or `PBED.VERID`

### 2. Planned Order
- **Target Schema**:
  - `plan_order_id`: `PLAF.PLNUM`
  - `material_id`: `PLAF.MATNR`
  - `plant_id`: `PLAF.PLWRK`
  - `order_quantity`: `PLAF.GSMNG`
  - `start_date`: `PLAF.PSTTR`
  - `finish_date`: `PLAF.PEDTR`
  - `order_type`: `PLAF.PAART`
  - `material_name`: `MAKT.MAKTX` (Joined via `PLAF.MATNR = MAKT.MATNR`)
  - `procurement_type`: `PLAF.BESKZ`
  - `process_order_id`: `PLAF.AUFNR`
  - `storage_location`: `PLAF.LGORT`

### 3. Material
- **Target Schema**:
  - `material_id`: `MARA.MATNR`
  - `material_description`: `MAKT.MAKTX` (Joined via `MARA.MATNR = MAKT.MATNR`)
  - `material_type`: `MARA.MTART`
  - `plant_id`: `MARC.WERKS` (Joined via `MARA.MATNR = MARC.MATNR`)
  - `uom`: `MARA.MEINS`
  - `status`: `MARC.MMSTA` or `MARA.MSTAE`
  - `material_name`: `MAKT.MAKTX`

### 4. Batch
- **Target Schema**:
  - `batch_id`: `MCHA.CHARG` (or `MCH1.CHARG`)
  - `material_id`: `MCHA.MATNR`
  - `batch_type`: `MCHA.BWTAR`
  - `plant_id`: `MCHA.WERKS`
  - `manufacturing_date`: `MCHA.HSDAT`
  - `expiry_date`: `MCHA.VFDAT`
  - `status`: `MCHA.ZUSTD` (Batch status: Restricted / Released)

### 5. Supplier or source
- **Target Schema**:
  - `supplier_id`: `LFA1.LIFNR`
  - `source_name`: `LFA1.NAME1` / `ADRC.NAME1`
  - `source_type`: Constant `"Vendor"`
  - `country`: `ADRC.COUNTRY` or `LFA1.LAND1`
  - `region`: `ADRC.REGION` or `LFA1.REGIO`
  - `postal_code`: `ADRC.POST_CODE1` or `LFA1.PSTLZ`
  - `address_id`: `LFA1.ADRNR`
  - `email`: `ADR6.SMTP_ADDR` (Joined via `LFA1.ADRNR = ADR6.ADDRNUMBER`)
  - `status`: `LFA1.SPERR` / `LFA1.LOEVM`
  - `company_code`: `LFB1.BUKRS` (Joined via `LFA1.LIFNR = LFB1.LIFNR`)
  - `valid`: `EORD.VDATU` to `EORD.BDATU`
  - `approved_or_not`: `EORD.NOTKZ` (`"Approved"` if empty, `"Blocked"` if `'X'`)
  - `material_id`: `EORD.MATNR`

### 6. Purchase Requisition
- **Target Schema**:
  - `purchase_requisition_id`: `EBAN.BANFN`
  - `item_id`: `EBAN.BNFPO`
  - `material_id`: `EBAN.MATNR`
  - `material_description`: `EBAN.TXZ01`
  - `plant_id`: `EBAN.WERKS`
  - `requested_quantity`: `EBAN.MENGE`
  - `uom`: `EBAN.MEINS`
  - `requested_delivery_date`: `EBAN.LFDAT`
  - `requisitioner`: `EBAN.AFNAM`

### 7. Purchase order
- **Target Schema**:
  - `purchase_order_id`: `EKKO.EBELN`
  - `supplier_or_source_id`: `EKKO.LIFNR`
  - `company_code`: `EKKO.BUKRS`
  - `order_date`: `EKKO.BEDAT`
  - `document_type`: `EKKO.BSART`
  - `item`: Array of nested Purchase Order Items:
    - `item_id`: `EKPO.EBELP`
    - `material_id`: `EKPO.MATNR`
    - `description`: `EKPO.TXZ01`
    - `order_quantity`: `EKPO.MENGE`
    - `plant_id`: `EKPO.WERKS`
    - `storage_location_id`: `EKPO.LGORT`
    - `delivery_date`: `EKET.EINDT`
    - `uom`: `EKPO.MEINS`
    - `price`: `EKPO.NETPR`
    - `currency`: `EKKO.WAERS`

### 8. Material Movement (Unified via MATDOC)
- **Target Schema**:
  - `material_document_id`: `MATDOC.MBLNR`
  - `material_document_year`: `MATDOC.MJAHR`
  - `movement_type`: `MATDOC.BWART`
  - `material_id`: `MATDOC.MATNR`
  - `batch_id`: `MATDOC.CHARG`
  - `storage_location`: `MATDOC.LGORT`
  - `quantity`: `MATDOC.MENGE`
  - `uom`: `MATDOC.MEINS`
  - `posting_date`: `MATDOC.BUDAT`
  - `document_date`: `MATDOC.BLDAT`
  - `reference_document_id`: `MATDOC.XBLNR` (or `LFBNR`)
  - `purchase_order_id`: `MATDOC.EBELN`
  - `process_order_id`: `MATDOC.AUFNR`
  - `reservation_id`: `MATDOC.RSNUM`
  - `plant_id`: `MATDOC.WERKS`

### 9. Inventory/Stock
- **Target Schema**:
  - `material_id`: `MCHB.MATNR` / `MARD.MATNR`
  - `plant_id`: `MCHB.WERKS` / `MARD.WERKS`
  - `storage_location`: `MCHB.LGORT` / `MARD.LGORT`
  - `uom`: `MARA.MEINS` / `MATDOC.MEINS`
  - `stock_status`: Evaluation based on stock category
  - `batch_id`: `MCHB.CHARG`
  - `stock_quantity`: Total sum of all categories
  - `unrestricted`: `MCHB.CLABS` (or `MARD.LABST`)
  - `quality_inspection`: `MCHB.CINSM` (or `MARD.INSME`)
  - `blocked`: `MCHB.CSPEM` (or `MARD.SPEME`)
  - `restricted`: `MCHB.CEINM` (or `MARD.EINME`)
  - `return`: `MCHB.CRETM` (or `MARD.RETME`)
  - `in_transfer`: `MCHB.CUMLM` (or `MARD.UMLME`)

### 10. Reservation
- **Target Schema**:
  - `reservation_id`: `RESB.RSNUM`
  - `item_id`: `RESB.RSPOS`
  - `material_id`: `RESB.MATNR`
  - `plant_id`: `RESB.WERKS`
  - `storage_location`: `RESB.LGORT`
  - `reservation_quantity`: `RESB.BDMNG` (or `NOMNG`)
  - `uom`: `RESB.MEINS`
  - `requirement_date`: `RESB.BDTER`
  - `movement_type`: `RESB.BWART`
  - `process_order_id`: `RESB.AUFNR`
  - `batch_id`: `RESB.CHARG`
  - `cost_centre`: `RESB.KOSTL`

### 11. Process order
- **Target Schema**:
  - `process_order_id`: `AFKO.AUFNR`
  - `order_type`: `AUFK.AUART`
  - `material_id`: `AFPO.MATNR` (or `AFKO.PLNBEZ`)
  - `plant_id`: `AFPO.DWERK` (or `AFPO.PWERK`, `AUFK.WERKS`)
  - `planned_id`: `AFPO.PLNUM`
  - `planned_quantity`: `AFKO.GAMNG`
  - `uom`: `AFKO.GMEIN`
  - `basic_start_date`: `AFKO.GSTRP`
  - `basic_finish_date`: `AFKO.GLTRP`
  - `actual_start_date`: `AFKO.GSTRI`
  - `actual_finish_date`: `AFKO.GETRI`
  - `status`: Order lifecycle status
  - `production_version_id`: `AFKO.VERID`
  - `batch_id`: `AFPO.CHARG`
  - `date`: `AUFK.ERDAT` (or `AFKO.FTRMS`)
  - `reservation_id`: `AFKO.RSNUM`

### 12. BOM
- **Target Schema**:
  - `bom_id`: `STKO.STLNR`
  - `material_id`: `MAST.MATNR`
  - `plant_id`: `MAST.WERKS`
  - `bom_usage`: `STKO.STLAN`
  - `bom_status`: `STKO.STLST`
  - `alternative_bom`: `STKO.STLAL`
  - `base_quantity`: `STKO.BMENG`
  - `base_uom`: `STKO.BMEIN`
  - `components`: Nested array:
    - `component_material_id`: `STPO.IDNRK`
    - `component_quantity`: `STPO.MENGE`
    - `component_uom`: `STPO.MEINS`
    - `component_item_number`: `STPO.POSNR`
    - `bom_category`: `STPO.POSTP`
    - `component_scrap_quantity`: `STPO.AUSCH`

### 13. Recipe
- **Target Schema**:
  - `recipe_id`: `PLKO.PLNNR`
  - `material_id`: `MAPL.MATNR`
  - `plant_id`: `PLKO.WERKS`
  - `recipe_type`: `PLKO.PLNTY`
  - `recipe_group`: `PLKO.PLNAL`
  - `recipe_status`: `PLKO.STATU`
  - `operations`: Nested array:
    - `operation_id`: `PLPO.PLNKN`
    - `operation_number`: `PLPO.VORNR`
    - `operation_description`: `PLPO.LTXA1`
    - `work_center_id`: `PLPO.ARBID`
    - `control_key`: `PLPO.STEUS`
    - `operation_quantity`: `PLPO.BMSCH`
    - `uom`: `PLPO.MEINH`
    - `operation_sequence`: `PLPO.VORNR`

### 14. Production Version
- **Target Schema**:
  - `production_version_id`: `MKAL.VERID`
  - `material_id`: `MKAL.MATNR`
  - `production_version_status`: `MKAL.TEXT1`
  - `bom_id`: `MKAL.STLNR`
  - `recipe_id`: `MKAL.PLNNR`
  - `valid_from`: `MKAL.ADATU`
  - `valid_to`: `MKAL.BDATU`
  - `plant_id`: `MKAL.WERKS`
  - `bom_alternative_id`: `MKAL.STLAL`
  - `recipe_id_type`: `MKAL.PLNTY`

### 15. Batch Determination
- **Target Schema**:
  - `determination_id`: Formed from `RESB.RSNUM-RESB.RSPOS`
  - `material_id`: `RESB.MATNR`
  - `batch_id`: `RESB.CHARG` (or determined allocation from `MCHB`/`AFPO`)
  - `process_order_id`: `RESB.AUFNR`
  - `quantity`: `RESB.BDMNG` (or `NOMNG`)
  - `uom`: `RESB.MEINS`
  - `status`: `"Determined/Allocated"`
  - `plant_id`: `RESB.WERKS`
  - `storage_location_id`: `RESB.LGORT`
  - `reservation_id`: `RESB.RSNUM`
  - `reservation_item_id`: `RESB.RSPOS`

### 16. Material Consumption (MATDOC BWART = 261)
- **Target Schema**:
  - `material_document_id`: `MATDOC.MBLNR`
  - `material_document_year`: `MATDOC.MJAHR`
  - `process_order_id`: `MATDOC.AUFNR` / `RESB.AUFNR`
  - `batch_id`: `MATDOC.CHARG` / `RESB.CHARG`
  - `plant_id`: `MATDOC.WERKS`
  - `storage_location_id`: `MATDOC.LGORT`
  - `consumed_quantity`: `MATDOC.MENGE` / `RESB.BDMNG`
  - `uom`: `MATDOC.MEINS`
  - `posting_date`: `MATDOC.BUDAT`
  - `movement_type`: `"261"` (Goods issue for order)
  - `status`: `"Posted"` / `"Issued"`
  - `reservation_id`: `MATDOC.RSNUM`
  - `reservation_item_id`: `MATDOC.RSPOS`
  - `cost_centre`: `MATDOC.KOSTL`

### 17. Production Confirmation
- **Target Schema**:
  - `confirmation_id`: `AFRU.RUECK`
  - `process_order_id`: `AFRU.AUFNR`
  - `operation_id`: `AFRU.RMZHL`
  - `work_center_id`: `AFRU.ARBID`
  - `confirmed_quantity`: `AFRU.GMNGA`
  - `uom`: `AFRU.GMEIN`
  - `confirmation_date`: `AFRU.BUDAT`
  - `confirmation_time`: `AFRU.ISDD`
  - `status`: `"Confirmed"` (or `"Reversed"` if `AFRU.STOKZ` set)
  - `operation_number`: `AFRU.VORNR`
  - `actual_start_date`: `AFRU.ISDD`
  - `actual_finish_date`: `AFRU.IEDD`
  - `yield_quantity`: `AFRU.LMNGA`
  - `scrap_quantity`: `AFRU.XMNGA`

### 18. Batch Transformation
- **Target Schema**:
  - `transformation_id`: Unique transformation key `TRF-<AUFNR>-<POSNR>`
  - `process_order_id`: `AFPO.AUFNR`
  - `input_batch_id`: Component batches consumed via `RESB` / `MATDOC` (261)
  - `output_batch_id`: Produced finished batch `AFPO.CHARG` (101)
  - `material_id`: Produced finished material `AFPO.MATNR`
  - `transformation_type`: `"Process Order Manufacturing"`
  - `quantity`: Output batch quantity `AFPO.PSMNG`
  - `uom`: `AFPO.MEINS`
  - `status`: `"Transformed"`
  - `plant_id`: `AFPO.DWERK`
  - `transformation_date`: `AFPO.LTRMI`

### 19. Yield
- **Target Schema**:
  - `process_order_id`: `AFRU.AUFNR` / `AFPO.AUFNR`
  - `master_id`: `AFPO.MATNR`
  - `batch_id`: `AFPO.CHARG`
  - `material_document_id`: `CONF-<RUECK>` / `MATDOC.MBLNR`
  - `yield_quantity`: `AFRU.GMNGA` / `AFRU.LMNGA` (or `MATDOC.MENGE` 101)
  - `scrap_quantity`: `AFRU.XMNGA`
  - `uom`: `AFRU.GMEIN` / `AFPO.MEINS`
  - `posting_date`: `AFRU.BUDAT`
  - `status`: `"Yield Confirmed"`
  - `yield_type`: `"Operation Yield"` / `"Finished Good Yield"`
  - `scrap_type`: `"Production Scrap"`

### 21. Inspection Characteristic
- **Target Schema**:
  - `inspection_characteristic_id`: `QPMK.MKMNR`
  - `description`: `QPMK.SORTFELD`
  - `plant_id`: `QPMK.WERKS`
  - `uom`: `QPMK.MASSEINHSW`
  - `lower_specification_limit`: `QPMK.TOLERANZUN`
  - `upper_specification_limit`: `QPMK.TOLERANZOB`
  - `target_value`: `QPMK.SOLLWERT`
  - `status`: Active / Locked
  - `inspection_characteristic_name`: `QPMK.SORTFELD`
  - `material_id`: `PLMK.PLNNR`
  - `characteristics_type`: `QPMK.STEUERKZ`
  - `inspection_method`: `QPMK.PMETH`

### 22. Inspection Plan
- **Target Schema**:
  - `inspection_plan_id`: `PLKO.PLNNR`
  - `material_id`: `MAPL.MATNR`
  - `plant_id`: `PLKO.WERKS`
  - `plan_group`: `PLKO.PLNAL`
  - `plan_usage`: `PLKO.VERWE`
  - `status`: `PLKO.STATU`
  - `operations`: Nested array:
    - `operation_id`: `PLPO.PLNKN`
    - `operation_number`: `PLPO.VORNR`
    - `description`: `PLPO.LTXA1`
    - `group`: `PLKO.PLNAL`
    - `work_center_id`: `PLPO.ARBID`
    - `inspection_characteristic_id`: `PLMK.MERKNR`

### 23. Inspection Parameter
- **Target Schema**:
  - `parameter_id`: Parameter unique key
  - `material_id`: `QMAT.MATNR`
  - `plant_id`: `QMAT.WERKS`
  - `inspection_type`: `QMAT.ART`
  - `inspection_parameter`: Parameter description
  - `parameter_value`: `QMAT.AKTIV` / `QPMK.SOLLWERT`
  - `uom`: `QPMK.MASSEINHSW`
  - `status`: `"Active"`
  - `inspection_characteristic_id`: Characteristic reference
  - `inspection_method`: `QPMK.PMETH`
  - `sampling_procedure`: Sampling rule

### 24. Quality inspection Lot
- **Target Schema**:
  - `inspection_lot_id`: `QALS.PRUEFLOS`
  - `material_id`: `QALS.MATNR`
  - `batch_id`: `QALS.CHARG`
  - `plant_id`: `QALS.WERK`
  - `inspection_origin`: `QALS.HERKUNFT`
  - `quantity`: `QALS.LOSMENGE`
  - `creation_date`: `QALS.ENSTEHDAT`
  - `inspection_start_date`: `QALS.PASTRTERM`
  - `inspection_completion_date`: `QALS.PAENDTERM`
  - `status`: `QALS.STAT35`
  - `inspection_type`: `QALS.ART`
  - `inspection_quantity`: `QALS.LOSMENGE`
  - `purchase_order_id`: `QALS.EBELN`
  - `purchase_order_item_id`: `QALS.EBELP`
  - `uom`: `QALS.MENGENEINH`
  - `supplier_id`: `QALS.LIFNR`
  - `process_order`: `QALS.AUFNR`
  - `material_document_id`: `QALS.MBLNR`
  - `material_document_year`: `QALS.MJAHR`
  - `inspection_plan_id`: `QALS.PLNNR`
  - `production_version_id`: `QALS.VERID`
  - `sample_quantity`: `QALS.GESSTICHPR`

### 25. Sampling
- **Target Schema**:
  - `sample_id`: `SMP-<PRUEFLOS>-<PROBENR>`
  - `inspection_lot_id`: `QASE.PRUEFLOS`
  - `material_id`: `QASE.MATNR` / `QALS.MATNR`
  - `batch_id`: `QASE.CHARG` / `QALS.CHARG`
  - `sample_quantity`: `QASE.MENGE`
  - `sample_uom`: `QASE.MEINS`
  - `sample_date`: `QASE.ERSTELDAT`
  - `status`: `QASE.STATUS`

### 26. Inspection Result
- **Target Schema**:
  - `inspection_result_id`: `RES-<PRUEFLOS>-<MERKNR>`
  - `inspection_lot_id`: `QAMR.PRUEFLOS`
  - `sample_id`: `QAMR.VORGLFNR`
  - `material_id`: `QALS.MATNR`
  - `batch_id`: `QALS.CHARG`
  - `inspection_characteristic_id`: `QAMR.MERKNR`
  - `result_value`: `QAMR.MITTELWERT` (or `QAMR.ORIGINAL_INPUT`)
  - `uom`: `QAMR.MASSEINHS`
  - `result_status`: `QAMR.MBEWERTG` (Accepted / Rejected)
  - `record_date`: `QAMR.PRSTDAT`

### 27. Usage Decision
- **Target Schema**:
  - `usage_decision_id`: `UD-<PRUEFLOS>`
  - `inspection_lot_id`: `QAVE.PRUEFLOS`
  - `material_id`: `QALS.MATNR`
  - `batch_id`: `QALS.CHARG`
  - `plant_id`: `QAVE.VWERKS` / `QALS.WERK`
  - `decision_code`: `QAVE.VCODE` (e.g. A1, A5)
  - `decision_status`: `QAVE.VBEWERTUNG` (A = Accepted, R = Rejected)
  - `decision_date`: `QAVE.VDATUM`

### 28. Customer or CFA
- **Target Schema**:
  - `customer_id`: `KNA1.KUNNR`
  - `customer_name`: `ADRC.NAME1` or `KNA1.NAME1`
  - `customer_type`: `KNA1.KTOKD`
  - `customer_group`: `KNA1.KDGRP`
  - `country`: `ADRC.COUNTRY` or `KNA1.LAND1`
  - `region`: `ADRC.REGION` or `KNA1.REGIO`
  - `postal_code`: `ADRC.POST_CODE1` or `KNA1.PSTLZ`
  - `address_id`: `KNA1.ADRNR`
  - `email`: `ADR6.SMTP_ADDR`
  - `status`: `KNA1.SPERR` / `KNA1.LOEVM`
  - `company_code`: `KNB1.BUKRS`

### 29. Sales Order
- **Target Schema**:
  - `sales_order_id`: `VBAK.VBELN`
  - `order_type`: `VBAK.AUART`
  - `customer_id`: `VBAK.KUNNR`
  - `company_code`: `VBAK.BUKRS_VF`
  - `order_date`: `VBAK.AUDAT`
  - `request_delivery_date`: `VBAK.VDATU`
  - `currency`: `VBAK.WAERK`
  - `status`: `VBAK.GBSTK`

### 30. Sales Order Item
- **Target Schema**:
  - `sales_order_id`: `VBAP.VBELN`
  - `item_id`: `VBAP.POSNR`
  - `material_id`: `VBAP.MATNR`
  - `ordered_quantity`: `VBAP.KWMENG`
  - `uom`: `VBAP.VRKME`
  - `requested_delivery_date`: `VBAK.VDATU` (Header requested date)
  - `confirmed_quantity`: `VBAP.KBMENG` / `VBAP.LSMENG`
  - `confirmed_delivery_date`: `VBAP.CMTD_DELIV_DATE` / `VBAP.ZZSCH_DATE`
  - `status`: `VBAP.GBSTA`

### 31. Sales Batch Allocation
- **Target Schema**:
  - `sales_order_id`: `LIPS.VGBEL` (or via document flow `VBFA.VBELV`)
  - `sales_order_item_id`: `LIPS.VGPOS` (or `VBFA.POSNV`)
  - `delivery_id`: `LIPS.VBELN`
  - `delivery_item_id`: `LIPS.POSNR`
  - `material_id`: `LIPS.MATNR`
  - `batch_id`: `LIPS.CHARG`
  - `allocated_status`: `"Allocated"`

### 32. Outbound Delivery
- **Target Schema**:
  - `delivery_id`: `LIKP.VBELN`
  - `sales_order_id`: `LIPS.VGBEL`
  - `customer_id`: `LIKP.KUNNR`
  - `delivery_type`: `LIKP.LFART`
  - `delivery_date`: `LIKP.LFDAT`
  - `planned_goods_issue_date`: `LIKP.WADAT`
  - `actual_goods_issue_date`: `LIKP.WADAT_IST`
  - `status`: `LIKP.GBSTK`

### 33. Delivery Item
- **Target Schema**:
  - `delivery_id`: `LIPS.VBELN`
  - `item_id`: `LIPS.POSNR`
  - `sales_order_id`: `LIPS.VGBEL`
  - `sales_order_item_id`: `LIPS.VGPOS`
  - `material_id`: `LIPS.MATNR`
  - `batch_id`: `LIPS.CHARG`
  - `delivery_quantity`: `LIPS.LFIMG`
  - `uom`: `LIPS.VRKME`
  - `plant_id`: `LIPS.WERKS`
  - `storage_location_id`: `LIPS.LGORT`
  - `status`: Formatted `"Overall:GBSTA/GI:WBSTA/Billing:FKSTA"`

### 34. Billing Document
- **Target Schema**:
  - `billing_document_id`: `VBRK.VBELN`
  - `billing_type`: `VBRK.FKART`
  - `customer_id`: `VBRK.KUNAG`
  - `sales_order_id`: `VBRP.AUBEL`
  - `delivery_id`: `VBRP.VGBEL`
  - `billing_date`: `VBRK.FKDAT`
  - `currency`: `VBRK.WAERK`
  - `net_value`: `VBRK.NETWR`
  - `tax_value`: `VBRK.MWSBK`
  - `gross_value`: `VBRK.NETWR + VBRK.MWSBK`
  - `status`: `VBRK.FKSTK`

### 35. Sales Return
- **Target Schema**:
  - `return_id`: `RET-<VBELN>`
  - `sales_order_id`: `VBRP.AUBEL` (or `VBFA.VBELV`)
  - `sales_order_item_id`: `VBRP.AUPOS`
  - `delivery_id`: `VBRP.VGBEL`
  - `delivery_item_id`: `VBRP.VGPOS`
  - `billing_document_id`: `VBRK.VBELN`
  - `customer_id`: `VBRK.KUNAG`
  - `material_id`: `VBRP.MATNR`
  - `batch_id`: `VBRP.CHARG`
  - `return_quantity`: `VBRP.FKIMG`
  - `uom`: `VBRP.VRKME`
  - `return_date`: `VBRK.FKDAT`

### 36. Work Centre
- **Target Schema**:
  - `work_centre_id`: `CRHD.OBJID`
  - `work_centre_name`: `CRHD.ARBPL`
  - `plant_id`: `CRHD.WERKS`
  - `work_centre_category`: `CRHD.VERWE`
  - `valid_from`: `CRHD.BEGDA`
  - `valid_to`: `CRHD.ENDDA`
  - `capacity_id`: `CRHD.KAPID`
  - `cost_centre`: `CRHD.KOSTL`
  - `location`: `CRHD.STAND`

---

### GRN (GoodsReceipt)
```json
{
  "business_object": "GoodsReceipt",
  "schema": {
    "grn_id": "string",
    "grn_year": "integer",
    "grn_item_id": "string",
    "material_id": "string",
    "plant_id": "string",
    "storage_location_id": "string",
    "batch_id": "string",
    "received_quantity": "decimal",
    "unit_of_measure": "string",
    "movement_type": "string",
    "purchase_order_id": "string",
    "purchase_order_item_id": "string",
    "supplier_id": "string",
    "posting_date": "date",
    "document_date": "date",
    "stock_type": "string",
    "delivery_completed": "boolean"
  }
}
```
- **Strictly Non-Logistic Table Mapping**:
  - `grn_id`: `MATDOC.MBLNR` (or `QALS.MBLNR` generated on PO Goods Receipt)
  - `grn_year`: `MATDOC.MJAHR` (or `QALS.MJAHR`)
  - `grn_item_id`: `MATDOC.ZEILE` (or `QALS.ZEILE`)
  - `material_id`: `MATDOC.MATNR` (or `QALS.MATNR`)
  - `plant_id`: `MATDOC.WERKS` (or `QALS.WERK`)
  - `storage_location_id`: `MATDOC.LGORT` (or `QALS.LAGORTCHRG`)
  - `batch_id`: `MATDOC.CHARG` (or `QALS.CHARG`)
  - `received_quantity`: `MATDOC.MENGE` (or `QALS.LOSMENGE`)
  - `unit_of_measure`: `MATDOC.MEINS` (or `QALS.MENGENEINH`)
  - `movement_type`: `MATDOC.BWART` (`101` - Goods receipt for purchase order)
  - `purchase_order_id`: `MATDOC.EBELN` (or `QALS.EBELN`)
  - `purchase_order_item_id`: `MATDOC.EBELP` (or `QALS.EBELP`)
  - `supplier_id`: `MATDOC.LIFNR` / `EKKO.LIFNR` / `EORD.LIFNR` / `LFA1.LIFNR`
  - `posting_date`: `MATDOC.BUDAT` (or `QALS.BUDAT`)
  - `document_date`: `MATDOC.BLDAT` (or `QALS.ENSTEHDAT`)
  - `stock_type`: Derived from `MATDOC.INSMK` (`"Unrestricted"`, `"Quality Inspection"`, `"Blocked"`)
  - `delivery_completed`: `MATDOC.ELIKZ == 'X'`
  - **Compliance Note**: Strictly avoids `LIKP`, `LIPS`, `VTTK`, `VTTP`, `VEKP`, `VEPO`, `EKES`.
