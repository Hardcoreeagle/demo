# SAP Business Objects: 106 Entity Relationships Specification & Resolver Architecture

This specification documents the **106 Field-Level Entity Relationships** spanning **13 functional domains** connecting the 37 SAP Business Objects in modern SAP S/4HANA & ECC systems.

---

## Architectural Principles

1. **Independent Business Objects**:
   - Each of the 37 Business Objects is constructed independently with its own typed schema.
   - The Relationship Resolver operates on these independent objects through in-memory hash indexes, preserving the isolation, single-responsibility, and modularity of each object.
2. **Pure Go Implementation**:
   - Built entirely with standard Go (`go1.23.1`) with zero third-party dependencies and no Python.
3. **Consolidated Universal Journal (`MATDOC`)**:
   - In accordance with modern S/4HANA design, `MATDOC` is used exclusively for all material documents, movements, consumptions, and GRN linkages, replacing legacy `MSEG` (items) and `MKPF` (header).
4. **Delivery & Transportation Policy**:
   - `LIKP` (Delivery Header) and `LIPS` (Delivery Item) are actively utilized for outbound deliveries, delivery items, goods issue links, and sales document flow cross-references.
   - Transportation / shipment tables (`VTTK`, `VTTP`, `VTTS`, `VTSP`, `VEKP`, `VEPO`) are strictly excluded.
5. **High-Performance In-Memory Graph**:
   - The resolver constructs multi-indexed hash tables over primary, foreign, and composite keys, enabling sub-millisecond evaluation across all 106 relationships.

---

## Summary Matrix across 13 Functional Groupings

| Group # | Functional Domain | Total Relationships | Sample Links Resolved | Primary Source Entity | Primary Target Entity |
|---|---|---|---|---|---|
| **1** | Planning & MRP | 4 | 30 | Planning Requirement, Planned Order | Process Order, Reservation |
| **2** | Process Order Structure | 10 | 100 | Process Order, Reservation | Consumption, Confirmation, Work Center |
| **3** | Quality Management | 6 | 60 | Process Order, Inspection Lot | Movement, Batch, Sampling, Results, UD |
| **4** | Material Movements & Inventory | 5 | 50 | Material Movement, Batch | Material, Plant Material, Batch Stock |
| **5** | Procurement (PR to PO & GRN) | 14 | 90 | PR, Supplier, PO, PO Item, Reservation | PO Item, Schedule Line, History, GRN |
| **6** | BOM & Routing | 15 | 110 | BOM Assignment, Header, PV, Recipe | Material, Component, Work Center |
| **7** | Sales & Distribution | 17 | 140 | Sales Order, Item, Delivery, Billing | Delivery Item, Material, Goods Issue |
| **8** | Inventory, Batch & Master Data | 11 | 90 | Material, Movement, Batch | Inventory Stock, Reservation, PO, SO Item |
| **9** | QM Extended Linkages | 3 | 20 | Quality Inspection Lot | Material Doc, Operation, Process Order |
| **10** | Sales & Delivery Cross-Refs | 3 | 30 | Delivery Item, Billing Item | Sales Order Item, Reservation |
| **11** | Production Yield & Confirmation | 4 | 40 | Process Order, Confirmation | Yield, Scrap, Operation, Process Order |
| **12** | Goods Receipt (GRN) Linkages | 4 | 40 | Goods Receipt (GRN) | PO Item, Material, Inventory, Batch |
| **13** | Sales Returns | 10 | 100 | Sales Return | Doc Flow, Order, Delivery, Billing, Batch |
| **TOTAL** | **13 Domains** | **106** | **900** | — | — |

---

## Detailed Field-Level Relationship Catalog

### 1. Planning & MRP
- **Rel 1**: `Planning Requirement` -> `Planning Requirement data` (INNER JOIN: `PBIM.BDZEI = PBED.BDZEI`)
- **Rel 2**: `Planned Order` -> `Process Order` (LEFT JOIN: `PLAF.PLNUM = AFPO.PLNUM -> AFPO.AUFNR`)
- **Rel 3**: `Planned Order` -> `Reservation` (LEFT JOIN: `PLAF.RSNUM = RESB.RSNUM`)
- **Rel 4**: `Planned Order` -> `Process Order` (LEFT JOIN: `PLAF.AUFNR = AFPO.AUFNR` when populated)

### 2. Process Order Structure
- **Rel 5**: `Process Order` -> `Process Order Header` (INNER JOIN: `AFKO.AUFNR = ProcessOrder.AUFNR`)
- **Rel 6**: `Process Order` -> `Process Order Item` (INNER JOIN: `AFPO.AUFNR = ProcessOrder.AUFNR`)
- **Rel 7**: `Process Order` -> `Reservation` (LEFT JOIN: `AFKO.RSNUM = RESB.RSNUM AND RESB.AUFNR = AFKO.AUFNR`)
- **Rel 8**: `Reservation` -> `Material Consumption` (LEFT JOIN: `RESB.RSNUM = MATDOC.RSNUM AND RESB.RSPOS = MATDOC.RSPOS AND MATDOC.BWART = 261`)
- **Rel 9**: `Process Order` -> `Material Consumption` (LEFT JOIN: `MATDOC.AUFNR = AFKO.AUFNR AND MATDOC.BWART = 261`)
- **Rel 10**: `Process Order` -> `Production Confirmation` (LEFT JOIN: `AFRU.AUFNR = AFKO.AUFNR`)
- **Rel 11**: `Production Confirmation` -> `Process Operation` (INNER JOIN: `AFRU.AUFPL = AFVC.AUFPL AND AFRU.APLZL = AFVC.APLZL`)
- **Rel 12**: `Process Order` -> `Process Operation` (INNER JOIN: `AFKO.AUFPL = AFVC.AUFPL`)
- **Rel 13**: `Process Operation` -> `Work Center` (INNER JOIN: `AFVC.ARBID = CRHD.OBJID`)
- **Rel 14**: `Process Order` -> `Work Center` (INNER JOIN: `AFKO.AUFPL = AFVC.AUFPL -> AFVC.ARBID = CRHD.OBJID`)

### 3. Quality Management
- **Rel 15**: `Process Order` -> `Quality Inspection Lot` (LEFT JOIN: `Prefer AFKO.PRUEFLOS = QALS.PRUEFLOS; otherwise AFKO.AUFNR = QALS.AUFNR`)
- **Rel 16**: `Quality Inspection Lot` -> `Material Movement` (LEFT JOIN: `QALS.MBLNR = MATDOC.MBLNR AND QALS.MJAHR = MATDOC.MJAHR AND QALS.ZEILE = MATDOC.ZEILE`)
- **Rel 17**: `Quality Inspection Lot` -> `Batch` (LEFT JOIN: `QALS.MATNR = Batch.MATNR AND QALS.WERK = Batch.WERKS AND QALS.CHARG = Batch.CHARG`)
- **Rel 18**: `Quality Inspection Lot` -> `Sampling` (LEFT JOIN: `QALS.PRUEFLOS = QAMR.PRUEFLOS / QASR.PRUEFLOS`)
- **Rel 19**: `Sampling` -> `Inspection Result` (LEFT JOIN: `Match PRUEFLOS plus relevant operation/characteristic keys`)
- **Rel 20**: `Quality Inspection Lot` -> `Usage Decision` (LEFT JOIN: `QALS.PRUEFLOS = QAVE.PRUEFLOS`)

### 4. Material Movements & Inventory Postings
- **Rel 21**: `Material Movement` -> `Material` (INNER JOIN: `MATDOC.MATNR = MARA.MATNR`)
- **Rel 22**: `Material Movement` -> `Plant Material` (INNER JOIN: `MATDOC.MATNR = MARC.MATNR AND MATDOC.WERKS = MARC.WERKS`)
- **Rel 23**: `Material Movement` -> `Batch` (LEFT JOIN: `MATDOC.MATNR = Batch.MATNR AND MATDOC.WERKS = Batch.WERKS AND MATDOC.CHARG = Batch.CHARG`)
- **Rel 24**: `Batch` -> `Batch Stock` (LEFT JOIN: `MCHB.MATNR = Batch.MATNR AND MCHB.WERKS = Batch.WERKS AND MCHB.CHARG = Batch.CHARG`)
- **Rel 25**: `Material Movement` -> `Material Document` (INNER JOIN: `MATDOC.MBLNR = MKPF.MBLNR AND MATDOC.MJAHR = MKPF.MJAHR`)

### 5. Procurement: Requisition to Purchase Order
- **Rel 26**: `Purchase Requisition` -> `PO Item` (LEFT JOIN: `EBAN.BANFN = EKPO.BANFN AND EBAN.BNFPO = EKPO.BNFPO`)
- **Rel 27**: `Purchase Requisition` -> `PR Account Assignment` (LEFT JOIN: `EBAN.BANFN = EBKN.BANFN AND EBAN.BNFPO = EBKN.BNFPO`)
- **Rel 28**: `Supplier` -> `Purchase Order` (LEFT JOIN: `LFA1.LIFNR = EKKO.LIFNR`)
- **Rel 29**: `Supplier` -> `Supplier Purchasing Data` (LEFT JOIN: `LFA1.LIFNR = LFM1.LIFNR`)
- **Rel 30**: `Supplier` -> `Supplier Company Data` (LEFT JOIN: `LFA1.LIFNR = LFB1.LIFNR`)
- **Rel 31**: `Purchase Order` -> `PO Item` (INNER JOIN: `EKKO.EBELN = EKPO.EBELN`)
- **Rel 32**: `PO Item` -> `Schedule Line` (LEFT JOIN: `EKPO.EBELN = EKET.EBELN AND EKPO.EBELP = EKET.EBELP`)
- **Rel 33**: `PO Item` -> `PO History` (LEFT JOIN: `EKPO.EBELN = EKBE.EBELN AND EKPO.EBELP = EKBE.EBELP`)
- **Rel 34**: `PO Item` -> `PO Confirmation` (LEFT JOIN: `EKPO.EBELN = EKES.EBELN AND EKPO.EBELP = EKES.EBELP`)
- **Rel 35**: `PO Item` -> `GRN` (LEFT JOIN: `EKPO.EBELN = MATDOC.EBELN AND EKPO.EBELP = MATDOC.EBELP AND MATDOC.BWART is a goods-receipt movement`)
- **Rel 36**: `GRN` -> `Material Movement` (INNER JOIN: `GRN references MATDOC.MBLNR + MATDOC.MJAHR + MATDOC.ZEILE`)
- **Rel 37**: `GRN` -> `Batch` (LEFT JOIN: `MATDOC.MATNR = Batch.MATNR AND MATDOC.WERKS = Batch.WERKS AND MATDOC.CHARG = Batch.CHARG`)
- **Rel 38**: `Reservation` -> `Purchase Requisition` (LEFT JOIN: `RESB.BANFN = EBAN.BANFN AND RESB.BNFPO = EBAN.BNFPO`)
- **Rel 39**: `Reservation` -> `Purchase Order` (LEFT JOIN: `RESB.EBELN = EKPO.EBELN AND RESB.EBELP = EKPO.EBELP`)

### 6. Bill of Materials & Routing
- **Rel 40**: `BOM Assignment` -> `Material` (INNER JOIN: `MAST.MATNR = MARA.MATNR`)
- **Rel 41**: `BOM Assignment` -> `Plant Material` (INNER JOIN: `MAST.MATNR = MARC.MATNR AND MAST.WERKS = MARC.WERKS`)
- **Rel 42**: `BOM Assignment` -> `BOM Header` (INNER JOIN: `MAST.STLNR = STKO.STLNR AND MAST.STLAL = STKO.STLAL`)
- **Rel 43**: `BOM Header` -> `BOM Component` (LEFT JOIN: `STKO.STLNR = STPO.STLNR`)
- **Rel 44**: `BOM Component` -> `Material` (INNER JOIN: `STPO.IDNRK = MARA.MATNR`)
- **Rel 45**: `Material` -> `Routing Assignment` (LEFT JOIN: `MAPL.MATNR = MARA.MATNR AND MAPL.WERKS = MARC.WERKS`)
- **Rel 46**: `Routing Assignment` -> `Routing Header` (INNER JOIN: `MAPL.PLNNR = PLKO.PLNNR AND MAPL.PLNAL = PLKO.PLNAL`)
- **Rel 47**: `Routing Header` -> `Routing Operation` (LEFT JOIN: `PLKO.PLNNR = PLPO.PLNNR`)
- **Rel 48**: `Routing Operation` -> `Work Center` (INNER JOIN: `PLPO.ARBID = CRHD.OBJID`)
- **Rel 49**: `Production Version` -> `Material` (INNER JOIN: `MKAL.MATNR = MARA.MATNR`)
- **Rel 50**: `Production Version` -> `Plant Material` (INNER JOIN: `MKAL.MATNR = MARC.MATNR AND MKAL.WERKS = MARC.WERKS`)
- **Rel 51**: `Production Version` -> `BOM` (LEFT JOIN: `MKAL.MATNR = MAST.MATNR AND MKAL.WERKS = MAST.WERKS AND MKAL.STLAL = MAST.STLAL`)
- **Rel 52**: `Production Version` -> `Routing` (LEFT JOIN: `MKAL.MATNR = MAPL.MATNR AND MKAL.WERKS = MAPL.WERKS AND MKAL.PLNNR = MAPL.PLNNR AND MKAL.PLNAL = MAPL.PLNAL`)
- **Rel 53**: `Process Order` -> `Production Version` (LEFT JOIN: `AFKO.PLNNR = MKAL.PLNNR AND AFKO.PLNAL = MKAL.PLNAL`)
- **Rel 54**: `Process Order` -> `Routing` (LEFT JOIN: `AFKO.PLNNR = PLKO.PLNNR AND AFKO.PLNAL = PLKO.PLNAL`)

### 7. Sales & Distribution
- **Rel 55**: `Sales Order` -> `Sales Order Item` (INNER JOIN: `VBAK.VBELN = VBAP.VBELN`)
- **Rel 56**: `Sales Order Item` -> `Material` (INNER JOIN: `VBAP.MATNR = MARA.MATNR`)
- **Rel 57**: `Sales Order Item` -> `Batch` (LEFT JOIN: `VBAP.MATNR = Batch.MATNR AND VBAP.CHARG = Batch.CHARG`)
- **Rel 58**: `Sales Order` -> `Customer` (LEFT JOIN: `VBAK.VBELN = VBPA.VBELN AND relevant partner function`)
- **Rel 59**: `Sales Order` -> `Delivery` (LEFT JOIN: `VBFA.VBELV = VBAK.VBELN AND VBFA.VBELN = LIKP.VBELN`)
- **Rel 60**: `Sales Order Item` -> `Delivery Item` (LEFT JOIN: `VBFA.VBELV = VBAP.VBELN AND VBFA.POSNV = VBAP.POSNR AND VBFA.VBELN = LIPS.VBELN AND VBFA.POSNN = LIPS.POSNR`)
- **Rel 61**: `Delivery` -> `Delivery Item` (INNER JOIN: `LIKP.VBELN = LIPS.VBELN`)
- **Rel 62**: `Delivery Item` -> `Material` (INNER JOIN: `LIPS.MATNR = MARA.MATNR`)
- **Rel 63**: `Delivery Item` -> `Batch` (LEFT JOIN: `LIPS.MATNR = Batch.MATNR AND LIPS.WERKS = Batch.WERKS AND LIPS.CHARG = Batch.CHARG`)
- **Rel 64**: `Delivery Item` -> `Process Order` (LEFT JOIN: `LIPS.AUFNR = AFKO.AUFNR`)
- **Rel 65**: `Delivery Item` -> `Goods Issue` (LEFT JOIN: `LIPS.LFBNR = MATDOC.MBLNR AND LIPS.LFPOS = MATDOC.ZEILE AND LIPS.LFGJA = MATDOC.MJAHR`)
- **Rel 66**: `Delivery Item` -> `Material Movement` (LEFT JOIN: `Validate LIPS.MATNR = MATDOC.MATNR AND LIPS.WERKS = MATDOC.WERKS`)
- **Rel 67**: `Billing` -> `Billing Item` (INNER JOIN: `VBRK.VBELN = VBRP.VBELN`)
- **Rel 68**: `Billing Item` -> `Delivery Item` (LEFT JOIN: `VBRP.VGBEL = LIPS.VBELN AND VBRP.VGPOS = LIPS.POSNR`)
- **Rel 69**: `Billing Item` -> `Sales Order Item` (LEFT JOIN: `VBRP.AUBEL = VBAP.VBELN AND VBRP.AUPOS = VBAP.POSNR`)
- **Rel 70**: `Billing` -> `Delivery` (LEFT JOIN: `Use VBFA: billing document VBELN <-> preceding delivery VBELV`)
- **Rel 71**: `Sales Document Flow` -> `Sales Documents` (INNER JOIN: `VBFA.VBELV + VBFA.POSNV = preceding; VBFA.VBELN + VBFA.POSNN = subsequent`)

### 8. Inventory, Batch & Material Master
- **Rel 72**: `Material` -> `Inventory` (LEFT JOIN: `MARA.MATNR = MARD.MATNR`)
- **Rel 73**: `Plant Material` -> `Inventory` (LEFT JOIN: `MARC.MATNR = MARD.MATNR AND MARC.WERKS = MARD.WERKS`)
- **Rel 74**: `Inventory` -> `Batch Stock` (LEFT JOIN: `MARD.MATNR = MCHB.MATNR AND MARD.WERKS = MCHB.WERKS AND MARD.LGORT = MCHB.LGORT`)
- **Rel 75**: `Material Movement` -> `Inventory` (LEFT JOIN: `MATDOC.MATNR = MARD.MATNR AND MATDOC.WERKS = MARD.WERKS AND MATDOC.LGORT = MARD.LGORT`)
- **Rel 76**: `Material Movement` -> `Reservation` (LEFT JOIN: `MATDOC.RSNUM = RESB.RSNUM AND MATDOC.RSPOS = RESB.RSPOS`)
- **Rel 77**: `Material Movement` -> `Purchase Order` (LEFT JOIN: `MATDOC.EBELN = EKPO.EBELN AND MATDOC.EBELP = EKPO.EBELP`)
- **Rel 78**: `Material Movement` -> `Process Order` (LEFT JOIN: `MATDOC.AUFNR = AFKO.AUFNR`)
- **Rel 79**: `Material Movement` -> `Sales Order Item` (LEFT JOIN: `MATDOC.KDAUF = VBAP.VBELN AND MATDOC.KDPOS = VBAP.POSNR`)
- **Rel 80**: `Batch` -> `Material` (INNER JOIN: `MCHA.MATNR = MARA.MATNR`)
- **Rel 81**: `Batch` -> `Plant Material` (INNER JOIN: `MCHA.MATNR = MARC.MATNR AND MCHA.WERKS = MARC.WERKS`)
- **Rel 82**: `Batch` -> `Batch Master` (INNER JOIN: `MCHA.MATNR = MCH1.MATNR AND MCHA.CHARG = MCH1.CHARG`)

### 9. Quality Management (Extended Linkages)
- **Rel 83**: `Quality Inspection Lot` -> `Material Document` (LEFT JOIN: `QALS.MBLNR = MATDOC.MBLNR AND QALS.MJAHR = MATDOC.MJAHR AND QALS.ZEILE = MATDOC.ZEILE`)
- **Rel 84**: `Quality Inspection Lot` -> `Process Operation` (LEFT JOIN: `QALS.AUFPL = AFVC.AUFPL`)
- **Rel 85**: `Quality Inspection Lot` -> `Process Order` (LEFT JOIN: `QALS.AUFNR = AFKO.AUFNR`)

### 10. Sales & Delivery Cross-References
- **Rel 86**: `Delivery Item` -> `Sales Order Item` (LEFT JOIN: `LIPS.VGBEL = VBAP.VBELN AND LIPS.VGPOS = VBAP.POSNR`)
- **Rel 87**: `Billing Item` -> `Sales Order Item` (LEFT JOIN: `VBRP.AUBEL = VBAP.VBELN AND VBRP.AUPOS = VBAP.POSNR`)
- **Rel 88**: `Delivery Item` -> `Reservation` (LEFT JOIN: `LIPS.RSNUM = RESB.RSNUM AND LIPS.RSPOS = RESB.RSPOS`)

### 11. Production Yield, Scrap & Confirmation
- **Rel 89**: `Process Order` -> `Production Yield` (LEFT JOIN: `MATDOC.AUFNR = AFKO.AUFNR AND MATDOC.BWART = 101`)
- **Rel 90**: `Process Order` -> `Production Scrap` (LEFT JOIN: `MATDOC.AUFNR = AFKO.AUFNR AND scrap movement`)
- **Rel 91**: `Production Confirmation` -> `Process Operation` (INNER JOIN: `AFRU.AUFPL = AFVC.AUFPL AND AFRU.APLZL = AFVC.APLZL`)
- **Rel 92**: `Production Confirmation` -> `Process Order` (INNER JOIN: `AFRU.AUFNR = AFKO.AUFNR`)

### 12. Goods Receipt (GRN) Linkages
- **Rel 93**: `GRN` -> `Purchase Order Item` (INNER JOIN: `MATDOC.MBLNR+MJAHR+ZEILE identifies GRN AND MATDOC.EBELN = EKPO.EBELN AND MATDOC.EBELP = EKPO.EBELP`)
- **Rel 94**: `GRN` -> `Material` (INNER JOIN: `MATDOC.MATNR = MARA.MATNR`)
- **Rel 95**: `GRN` -> `Inventory` (LEFT JOIN: `MATDOC.MATNR = MARD.MATNR AND MATDOC.WERKS = MARD.WERKS AND MATDOC.LGORT = MARD.LGORT`)
- **Rel 96**: `GRN` -> `Batch` (LEFT JOIN: `MATDOC.MATNR = Batch.MATNR AND MATDOC.WERKS = Batch.WERKS AND MATDOC.CHARG = Batch.CHARG`)

### 13. Sales Returns
- **Rel 97**: `Sales Return` -> `Sales Document Flow` (INNER JOIN: `VBFA.VBELV + VBFA.POSNV = preceding; VBFA.VBELN + VBFA.POSNN = return`)
- **Rel 98**: `Sales Return` -> `Sales Order` (LEFT JOIN: `VBFA.VBELV = VBAK.VBELN / return flow`)
- **Rel 99**: `Sales Return` -> `Sales Order Item` (LEFT JOIN: `VBFA.VBELV = VBAP.VBELN AND VBFA.POSNV = VBAP.POSNR`)
- **Rel 100**: `Sales Return` -> `Delivery` (LEFT JOIN: `VBFA.VBELV = LIKP.VBELN`)
- **Rel 101**: `Sales Return` -> `Delivery Item` (LEFT JOIN: `VBFA.VBELV = LIPS.VBELN AND VBFA.POSNV = LIPS.POSNR`)
- **Rel 102**: `Sales Return` -> `Billing Document` (LEFT JOIN: `VBFA.VBELV = VBRK.VBELN`)
- **Rel 103**: `Sales Return` -> `Billing Item` (LEFT JOIN: `VBFA.VBELV = VBRP.VBELN AND VBFA.POSNV = VBRP.POSNR`)
- **Rel 104**: `Sales Return` -> `Material Movement` (LEFT JOIN: `MATDOC return movement; validate MATDOC.MATNR = LIPS.MATNR and MATDOC.WERKS = LIPS.WERKS`)
- **Rel 105**: `Sales Return` -> `Batch` (LEFT JOIN: `LIPS.MATNR = Batch.MATNR AND LIPS.WERKS = Batch.WERKS AND LIPS.CHARG = Batch.CHARG`)
- **Rel 106**: `Sales Return` -> `Customer` (LEFT JOIN: `VBPA.VBELN = related sales doc VBELN AND relevant customer partner function`)

---

## Output Artifacts

- [output/relationship_catalog.json](file:///c:/Users/Lenovo/OneDrive/Desktop/build/output/relationship_catalog.json): 106 complete relationship definitions with metadata and join criteria.
- [output/resolved_relationships.json](file:///c:/Users/Lenovo/OneDrive/Desktop/build/output/resolved_relationships.json): 900 instance-level resolved links.
