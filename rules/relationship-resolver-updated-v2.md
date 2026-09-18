# Relationship Resolver — Updated v2

**SAP S/4HANA field-level relationship specification for the current canonical schema**

## Scope and alignment

- **36 canonical business objects** across Planning, MM, Production, QM, and Sales.
- **51 enrichment tables** from the current enrichment reference (SAP table IDs 100–150).
- **157 documented relationships:** the original 106 resolver relationships plus 51 enrichment linkages.
- **Batch genealogy anchor:** physical batch fields from `MCHA` / `MCH1`; do not use abstract `Batch.*` placeholders.
- **Movement source:** `MATDOC` is the primary transaction source; `MKPF` is used only for material-document header enrichment.
- **Production object:** Process Order, using `AUFK / AFKO / AFPO` and related production tables.
- **Sales scope:** continues through Delivery → Goods Issue → Billing; billing is the terminal sales-completion stage for the POC.
- **Transportation:** no Transportation business object; `VTTK` and `VTTP` are excluded because they are not part of the Emcure flow.

## Resolver principles

1. Prefer direct physical SAP field joins over canonical-name placeholders.
2. Use `INNER JOIN` where the target is structurally required to identify the source object; use `LEFT JOIN` for optional/enrichment relationships.
3. Keep business-document flow through `VBFA` where the relationship is document-derived rather than a direct foreign-key-like field.
4. For batch joins, use material + plant + batch where the target is plant-specific.
5. Qualify `MATDOC-BWART = 101` by reference context: PO references identify GRN, while `AUFNR` identifies production yield; `BWART = 261` identifies process-order consumption.
6. New enrichment joins are field-based mappings derived from the required fields in the enrichment reference. Where the canonical schema does not define a direct join key, the resolver marks the relationship as context-dependent and it must be validated against the actual SAP extract before production use.

## Important schema cleanup carried into this resolver

- `VTTK` / `VTTP` are not included.
- Sales customer resolution uses `VBAK-KUNNR → KNA1-KUNNR` rather than a `VBPA` dependency.
- Batch references use `MCHA` / `MCH1` fields explicitly.
- `MSEG` is not treated as an independent transaction source; `MATDOC` is used for movement/GRN/yield/consumption relationships.

## Relationship table

### 1. Planning & MRP

| # | Source Entity | Target Entity | Join Type | Relationship Logic |
|---:|---|---|---|---|
| 1 | Planning Requirement | Planning Requirement data | INNER JOIN | PBIM.BDZEI = PBED.BDZEI |
| 2 | Planned Order | Process Order | LEFT JOIN | PLAF.PLNUM = AFPO.PLNUM → AFPO.AUFNR |
| 3 | Planned Order | Reservation | LEFT JOIN | PLAF.RSNUM = RESB.RSNUM |
| 4 | Planned Order | Process Order | LEFT JOIN | PLAF.AUFNR = AFPO.AUFNR when PLAF.AUFNR is populated |

### 2. Process Order Structure

| # | Source Entity | Target Entity | Join Type | Relationship Logic |
|---:|---|---|---|---|
| 5 | Process Order | Process Order Header | INNER JOIN | AFKO.AUFNR = AUFK.AUFNR |
| 6 | Process Order | Process Order Item | INNER JOIN | AFPO.AUFNR = AUFK.AUFNR |
| 7 | Process Order | Reservation | LEFT JOIN | AFKO.RSNUM = RESB.RSNUM AND RESB.AUFNR = AFKO.AUFNR when populated |
| 8 | Reservation | Material Consumption | LEFT JOIN | RESB.RSNUM = MATDOC.RSNUM AND RESB.RSPOS = MATDOC.RSPOS AND MATDOC.BWART = 261 |
| 9 | Process Order | Material Consumption | LEFT JOIN | MATDOC.AUFNR = AFKO.AUFNR AND MATDOC.BWART = 261 |
| 10 | Process Order | Production Confirmation | LEFT JOIN | AFRU.AUFNR = AFKO.AUFNR |
| 11 | Production Confirmation | Process Operation | INNER JOIN | AFRU.AUFPL = AFVC.AUFPL AND AFRU.APLZL = AFVC.APLZL |
| 12 | Process Order | Process Operation | INNER JOIN | AFKO.AUFPL = AFVC.AUFPL |
| 13 | Process Operation | Work Center | INNER JOIN | AFVC.ARBID = CRHD.OBJID |
| 14 | Process Order | Work Center | INNER JOIN | AFKO.AUFPL = AFVC.AUFPL → AFVC.ARBID = CRHD.OBJID |

### 3. Quality Management

| # | Source Entity | Target Entity | Join Type | Relationship Logic |
|---:|---|---|---|---|
| 15 | Process Order | Quality Inspection Lot | LEFT JOIN | Prefer AFKO.PRUEFLOS = QALS.PRUEFLOS; otherwise AFKO.AUFNR = QALS.AUFNR when populated |
| 16 | Quality Inspection Lot | Material Movement | LEFT JOIN | QALS.MBLNR = MATDOC.MBLNR AND QALS.MJAHR = MATDOC.MJAHR AND QALS.ZEILE = MATDOC.ZEILE |
| 17 | Quality Inspection Lot | Batch | LEFT JOIN | QALS.MATNR = MCHA.MATNR AND QALS.WERK = MCHA.WERKS AND QALS.CHARG = MCHA.CHARG |
| 18 | Quality Inspection Lot | Sampling | LEFT JOIN | QALS.PRUEFLOS = QAMR.PRUEFLOS / QASR.PRUEFLOS |
| 19 | Sampling | Inspection Result | LEFT JOIN | Match PRUEFLOS plus the relevant operation/characteristic keys |
| 20 | Quality Inspection Lot | Usage Decision | LEFT JOIN | QALS.PRUEFLOS = QAVE.PRUEFLOS |

### 4. Material Movements & Inventory Postings

| # | Source Entity | Target Entity | Join Type | Relationship Logic |
|---:|---|---|---|---|
| 21 | Material Movement | Material | INNER JOIN | MATDOC.MATNR = MARA.MATNR |
| 22 | Material Movement | Plant Material | INNER JOIN | MATDOC.MATNR = MARC.MATNR AND MATDOC.WERKS = MARC.WERKS |
| 23 | Material Movement | Batch | LEFT JOIN | MATDOC.MATNR = MCHA.MATNR AND MATDOC.WERKS = MCHA.WERKS AND MATDOC.CHARG = MCHA.CHARG |
| 24 | Batch | Batch Stock | LEFT JOIN | MCHB.MATNR = MCHA.MATNR AND MCHB.WERKS = MCHA.WERKS AND MCHB.CHARG = MCHA.CHARG |
| 25 | Material Movement | Material Document Header | INNER JOIN | MATDOC.MBLNR = MKPF.MBLNR AND MATDOC.MJAHR = MKPF.MJAHR |

### 5. Procurement: Requisition to Purchase Order

| # | Source Entity | Target Entity | Join Type | Relationship Logic |
|---:|---|---|---|---|
| 26 | Purchase Requisition | PO Item | LEFT JOIN | EBAN.BANFN = EKPO.BANFN AND EBAN.BNFPO = EKPO.BNFPO |
| 27 | Purchase Requisition | PR Account Assignment | LEFT JOIN | EBAN.BANFN = EBKN.BANFN AND EBAN.BNFPO = EBKN.BNFPO |
| 28 | Supplier | Purchase Order | LEFT JOIN | LFA1.LIFNR = EKKO.LIFNR |
| 29 | Supplier | Supplier Purchasing Data | LEFT JOIN | LFA1.LIFNR = LFM1.LIFNR |
| 30 | Supplier | Supplier Company Data | LEFT JOIN | LFA1.LIFNR = LFB1.LIFNR |
| 31 | Purchase Order | PO Item | INNER JOIN | EKKO.EBELN = EKPO.EBELN |
| 32 | PO Item | Schedule Line | LEFT JOIN | EKPO.EBELN = EKET.EBELN AND EKPO.EBELP = EKET.EBELP |
| 33 | PO Item | PO History | LEFT JOIN | EKPO.EBELN = EKBE.EBELN AND EKPO.EBELP = EKBE.EBELP |
| 34 | PO Item | PO Confirmation | LEFT JOIN | EKPO.EBELN = EKES.EBELN AND EKPO.EBELP = EKES.EBELP |
| 35 | PO Item | GRN | LEFT JOIN | EKPO.EBELN = MATDOC.EBELN AND EKPO.EBELP = MATDOC.EBELP AND MATDOC.BWART is a goods-receipt movement |
| 36 | GRN | Material Movement | INNER JOIN | GRN references MATDOC.MBLNR + MATDOC.MJAHR + MATDOC.ZEILE |
| 37 | GRN | Batch | LEFT JOIN | MATDOC.MATNR = MCHA.MATNR AND MATDOC.WERKS = MCHA.WERKS AND MATDOC.CHARG = MCHA.CHARG |
| 38 | Reservation | Purchase Requisition | LEFT JOIN | RESB.BANFN = EBAN.BANFN AND RESB.BNFPO = EBAN.BNFPO |
| 39 | Reservation | Purchase Order | LEFT JOIN | RESB.EBELN = EKPO.EBELN AND RESB.EBELP = EKPO.EBELP |

### 6. Bill of Materials & Routing

| # | Source Entity | Target Entity | Join Type | Relationship Logic |
|---:|---|---|---|---|
| 40 | BOM Assignment | Material | INNER JOIN | MAST.MATNR = MARA.MATNR |
| 41 | BOM Assignment | Plant Material | INNER JOIN | MAST.MATNR = MARC.MATNR AND MAST.WERKS = MARC.WERKS |
| 42 | BOM Assignment | BOM Header | INNER JOIN | MAST.STLNR = STKO.STLNR AND MAST.STLAL = STKO.STLAL |
| 43 | BOM Header | BOM Component | LEFT JOIN | STKO.STLNR = STPO.STLNR |
| 44 | BOM Component | Material | INNER JOIN | STPO.IDNRK = MARA.MATNR |
| 45 | Material | Routing Assignment | LEFT JOIN | MAPL.MATNR = MARA.MATNR AND MAPL.WERKS = MARC.WERKS |
| 46 | Routing Assignment | Routing Header | INNER JOIN | MAPL.PLNNR = PLKO.PLNNR AND MAPL.PLNAL = PLKO.PLNAL |
| 47 | Routing Header | Routing Operation | LEFT JOIN | PLKO.PLNNR = PLPO.PLNNR |
| 48 | Routing Operation | Work Center | INNER JOIN | PLPO.ARBID = CRHD.OBJID |
| 49 | Production Version | Material | INNER JOIN | MKAL.MATNR = MARA.MATNR |
| 50 | Production Version | Plant Material | INNER JOIN | MKAL.MATNR = MARC.MATNR AND MKAL.WERKS = MARC.WERKS |
| 51 | Production Version | BOM | LEFT JOIN | MKAL.MATNR = MAST.MATNR AND MKAL.WERKS = MAST.WERKS AND MKAL.STLAL = MAST.STLAL |
| 52 | Production Version | Routing | LEFT JOIN | MKAL.MATNR = MAPL.MATNR AND MKAL.WERKS = MAPL.WERKS AND MKAL.PLNNR = MAPL.PLNNR AND MKAL.PLNAL = MAPL.PLNAL |
| 53 | Process Order | Production Version | LEFT JOIN | AFKO.PLNNR = MKAL.PLNNR AND AFKO.PLNAL = MKAL.PLNAL where applicable |
| 54 | Process Order | Routing | LEFT JOIN | AFKO.PLNNR = PLKO.PLNNR AND AFKO.PLNAL = PLKO.PLNAL |

### 7. Sales & Distribution

| # | Source Entity | Target Entity | Join Type | Relationship Logic |
|---:|---|---|---|---|
| 55 | Sales Order | Sales Order Item | INNER JOIN | VBAK.VBELN = VBAP.VBELN |
| 56 | Sales Order Item | Material | INNER JOIN | VBAP.MATNR = MARA.MATNR |
| 57 | Sales Order Item | Batch | LEFT JOIN | VBAP.MATNR = MCHA.MATNR AND VBAP.WERKS = MCHA.WERKS AND VBAP.CHARG = MCHA.CHARG when populated |
| 58 | Sales Order | Customer | LEFT JOIN | VBAK.KUNNR = KNA1.KUNNR |
| 59 | Sales Order | Delivery | LEFT JOIN | VBFA.VBELV = VBAK.VBELN AND VBFA.VBELN = LIKP.VBELN |
| 60 | Sales Order Item | Delivery Item | LEFT JOIN | VBFA.VBELV = VBAP.VBELN AND VBFA.POSNV = VBAP.POSNR AND VBFA.VBELN = LIPS.VBELN AND VBFA.POSNN = LIPS.POSNR |
| 61 | Delivery | Delivery Item | INNER JOIN | LIKP.VBELN = LIPS.VBELN |
| 62 | Delivery Item | Material | INNER JOIN | LIPS.MATNR = MARA.MATNR |
| 63 | Delivery Item | Batch | LEFT JOIN | LIPS.MATNR = MCHA.MATNR AND LIPS.WERKS = MCHA.WERKS AND LIPS.CHARG = MCHA.CHARG |
| 64 | Delivery Item | Process Order | LEFT JOIN | LIPS.AUFNR = AFKO.AUFNR when populated |
| 65 | Delivery Item | Goods Issue | LEFT JOIN | LIPS.LFBNR = MATDOC.MBLNR AND LIPS.LFPOS = MATDOC.ZEILE AND LIPS.LFGJA = MATDOC.MJAHR |
| 66 | Delivery Item | Material Movement | LEFT JOIN | Validate LIPS.MATNR = MATDOC.MATNR AND LIPS.WERKS = MATDOC.WERKS |
| 67 | Billing | Billing Item | INNER JOIN | VBRK.VBELN = VBRP.VBELN |
| 68 | Billing Item | Delivery Item | LEFT JOIN | VBRP.VGBEL = LIPS.VBELN AND VBRP.VGPOS = LIPS.POSNR |
| 69 | Billing Item | Sales Order Item | LEFT JOIN | VBRP.AUBEL = VBAP.VBELN AND VBRP.AUPOS = VBAP.POSNR |
| 70 | Billing | Delivery | LEFT JOIN | Use VBFA: billing document VBELN ↔ preceding delivery VBELV |
| 71 | Sales Document Flow | Sales Documents | INNER JOIN | VBFA.VBELV + VBFA.POSNV = preceding document/item; VBFA.VBELN + VBFA.POSNN = subsequent document/item |

### 8. Inventory, Batch & Material Master

| # | Source Entity | Target Entity | Join Type | Relationship Logic |
|---:|---|---|---|---|
| 72 | Material | Inventory | LEFT JOIN | MARA.MATNR = MARD.MATNR |
| 73 | Plant Material | Inventory | LEFT JOIN | MARC.MATNR = MARD.MATNR AND MARC.WERKS = MARD.WERKS |
| 74 | Inventory | Batch Stock | LEFT JOIN | MARD.MATNR = MCHB.MATNR AND MARD.WERKS = MCHB.WERKS AND MARD.LGORT = MCHB.LGORT |
| 75 | Material Movement | Inventory | LEFT JOIN | MATDOC.MATNR = MARD.MATNR AND MATDOC.WERKS = MARD.WERKS AND MATDOC.LGORT = MARD.LGORT |
| 76 | Material Movement | Reservation | LEFT JOIN | MATDOC.RSNUM = RESB.RSNUM AND MATDOC.RSPOS = RESB.RSPOS |
| 77 | Material Movement | Purchase Order | LEFT JOIN | MATDOC.EBELN = EKPO.EBELN AND MATDOC.EBELP = EKPO.EBELP |
| 78 | Material Movement | Process Order | LEFT JOIN | MATDOC.AUFNR = AFKO.AUFNR |
| 79 | Material Movement | Sales Order Item | LEFT JOIN | MATDOC.KDAUF = VBAP.VBELN AND MATDOC.KDPOS = VBAP.POSNR |
| 80 | Batch | Material | INNER JOIN | MCHA.MATNR = MARA.MATNR |
| 81 | Batch | Plant Material | INNER JOIN | MCHA.MATNR = MARC.MATNR AND MCHA.WERKS = MARC.WERKS |
| 82 | Batch | Batch Master | INNER JOIN | MCHA.MATNR = MCH1.MATNR AND MCHA.CHARG = MCH1.CHARG |

### 9. Quality Management — Extended Linkages

| # | Source Entity | Target Entity | Join Type | Relationship Logic |
|---:|---|---|---|---|
| 83 | Quality Inspection Lot | Material Document | LEFT JOIN | QALS.MBLNR = MATDOC.MBLNR AND QALS.MJAHR = MATDOC.MJAHR AND QALS.ZEILE = MATDOC.ZEILE |
| 84 | Quality Inspection Lot | Process Operation | LEFT JOIN | QALS.AUFPL = AFVC.AUFPL when populated |
| 85 | Quality Inspection Lot | Process Order | LEFT JOIN | QALS.AUFNR = AFKO.AUFNR when populated |

### 10. Sales & Delivery Cross-References

| # | Source Entity | Target Entity | Join Type | Relationship Logic |
|---:|---|---|---|---|
| 86 | Delivery Item | Sales Order Item | LEFT JOIN | LIPS.VGBEL = VBAP.VBELN AND LIPS.VGPOS = VBAP.POSNR |
| 87 | Billing Item | Sales Order Item | LEFT JOIN | VBRP.AUBEL = VBAP.VBELN AND VBRP.AUPOS = VBAP.POSNR |
| 88 | Delivery Item | Reservation | LEFT JOIN | LIPS.RSNUM = RESB.RSNUM AND LIPS.RSPOS = RESB.RSPOS when populated |

### 11. Production Yield, Scrap & Confirmation

| # | Source Entity | Target Entity | Join Type | Relationship Logic |
|---:|---|---|---|---|
| 89 | Process Order | Production Yield | LEFT JOIN | MATDOC.AUFNR = AFKO.AUFNR AND MATDOC.BWART = 101 |
| 90 | Process Order | Production Scrap | LEFT JOIN | MATDOC.AUFNR = AFKO.AUFNR AND MATDOC.BWART corresponds to the configured scrap movement |
| 91 | Production Confirmation | Process Operation | INNER JOIN | AFRU.AUFPL = AFVC.AUFPL AND AFRU.APLZL = AFVC.APLZL |
| 92 | Production Confirmation | Process Order | INNER JOIN | AFRU.AUFNR = AFKO.AUFNR |

### 12. Goods Receipt (GRN) Linkages

| # | Source Entity | Target Entity | Join Type | Relationship Logic |
|---:|---|---|---|---|
| 93 | GRN | Purchase Order Item | INNER JOIN | MATDOC.MBLNR + MJAHR + ZEILE identifies GRN movement AND MATDOC.EBELN = EKPO.EBELN AND MATDOC.EBELP = EKPO.EBELP |
| 94 | GRN | Material | INNER JOIN | MATDOC.MATNR = MARA.MATNR |
| 95 | GRN | Inventory | LEFT JOIN | MATDOC.MATNR = MARD.MATNR AND MATDOC.WERKS = MARD.WERKS AND MATDOC.LGORT = MARD.LGORT |
| 96 | GRN | Batch | LEFT JOIN | MATDOC.MATNR = MCHA.MATNR AND MATDOC.WERKS = MCHA.WERKS AND MATDOC.CHARG = MCHA.CHARG |

### 13. Sales Returns

| # | Source Entity | Target Entity | Join Type | Relationship Logic |
|---:|---|---|---|---|
| 97 | Sales Return | Sales Document Flow | INNER JOIN | VBFA.VBELV + VBFA.POSNV = preceding sales/delivery/billing document/item AND VBFA.VBELN + VBFA.POSNN = return document/item |
| 98 | Sales Return | Sales Order | LEFT JOIN | VBFA.VBELV = VBAK.VBELN / relevant return-document flow relationship |
| 99 | Sales Return | Sales Order Item | LEFT JOIN | VBFA.VBELV = VBAP.VBELN AND VBFA.POSNV = VBAP.POSNR / relevant return-document flow relationship |
| 100 | Sales Return | Delivery | LEFT JOIN | VBFA.VBELV = LIKP.VBELN / relevant return-delivery document flow relationship |
| 101 | Sales Return | Delivery Item | LEFT JOIN | VBFA.VBELV = LIPS.VBELN AND VBFA.POSNV = LIPS.POSNR / relevant return-delivery flow relationship |
| 102 | Sales Return | Billing Document | LEFT JOIN | VBFA.VBELV = VBRK.VBELN / relevant return-billing document flow relationship |
| 103 | Sales Return | Billing Item | LEFT JOIN | VBFA.VBELV = VBRP.VBELN AND VBFA.POSNV = VBRP.POSNR / relevant return-billing flow relationship |
| 104 | Sales Return | Material Movement | LEFT JOIN | Where the return is posted through inventory: identify the return material document in MATDOC and link it through the applicable sales/delivery reference; validate MATDOC.MATNR = LIPS.MATNR and MATDOC.WERKS = LIPS.WERKS |
| 105 | Sales Return | Batch | LEFT JOIN | For a batch-specific return, LIPS.MATNR = MCHA.MATNR AND LIPS.WERKS = MCHA.WERKS AND LIPS.CHARG = MCHA.CHARG |
| 106 | Sales Return | Customer | LEFT JOIN | Resolve customer from the related return sales document: VBAK.KUNNR = KNA1.KUNNR |

### 14. Additional Material Master Enrichment

| # | Source Entity | Target Entity | Join Type | Relationship Logic |
|---:|---|---|---|---|
| 107 | Material | Alternative Units of Measure (MARM) | LEFT JOIN | MARA.MATNR = MARM.MATNR; use MARM.MEINH for the alternative UOM and MARM.UMREZ/MARM.UMREN for conversion where present |
| 108 | Material | Material GTIN/EAN (MEAN) | LEFT JOIN | MARA.MATNR = MEAN.MATNR; resolve the applicable EAN from MEAN.EAN11/HPEAN |
| 109 | Material | Material Group (T023) | LEFT JOIN | MARA.MATKL = T023.MATKL |
| 110 | Material Group | Material Group Description (T023T) | LEFT JOIN | T023.MATKL = T023T.MATKL AND language context = T023T.SPRAS |
| 111 | Material | Material Type (T134) | LEFT JOIN | MARA.MTART = T134.MTART |
| 112 | Material Type | Material Type Description (T134T) | LEFT JOIN | T134.MTART = T134T.MTART AND language context = T134T.SPRAS |
| 113 | Material | Product Hierarchy (T179) | LEFT JOIN | MARA.PRDHA = T179.PRODH |
| 114 | Product Hierarchy | Product Hierarchy Description (T179T) | LEFT JOIN | T179.PRODH = T179T.PRODH AND language context = T179T.SPRAS |
| 115 | Material | Material Tax Classification (MLAN) | LEFT JOIN | MARA.MATNR = MLAN.MATNR AND country context = MLAN.ALAND |
| 116 | Material | Historical Material Valuation (MBEWH) | LEFT JOIN | MARA.MATNR = MBEWH.MATNR AND valuation-area context = MBEWH.BWKEY; include valuation type where applicable |

### 15. Supplier & Procurement Enrichment

| # | Source Entity | Target Entity | Join Type | Relationship Logic |
|---:|---|---|---|---|
| 117 | Supplier Source | Purchasing Info Record (EINA) | LEFT JOIN | EORD.MATNR = EINA.MATNR AND EORD.LIFNR = EINA.LIFNR; use EINA.INFNR/IDNLF where applicable |
| 118 | Purchasing Info Record | Purchasing Info by Organization/Plant (EINE) | LEFT JOIN | EINA.INFNR = EINE.INFNR AND purchasing organization/plant context matches EINE.EKORG/WERKS |
| 119 | Purchase Order | Purchasing Group (T024) | LEFT JOIN | EKKO.EKGRP = T024.EKGRP |
| 120 | Purchase Order | Purchasing Organization Assignment (T024E) | LEFT JOIN | EKKO.EKORG = T024E.EKORG |
| 121 | Purchase Order | Purchasing Document Type (T161) | LEFT JOIN | EKKO.BSTYP = T161.BSTYP AND EKKO.BSART = T161.BSART |
| 122 | Purchasing Document Type | Purchasing Document Type Description (T161T) | LEFT JOIN | T161.BSART = T161T.BSART AND language context = T161T.SPRAS |

### 16. Customer & Customer-Material Enrichment

| # | Source Entity | Target Entity | Join Type | Relationship Logic |
|---:|---|---|---|---|
| 123 | Customer / Sales Order Item | Customer-Material Information (KNMT) | LEFT JOIN | Customer/material/sales-area key: KNA1.KUNNR = KNMT.KUNNR AND VBAP.MATNR = KNMT.MATNR AND sales area context = KNMT.VKORG/VTWEG |
| 124 | Customer | Customer Account Group Description (T077X) | LEFT JOIN | KNA1.KTOKD = T077X.KTOKD AND language context = T077X.SPRAS |
| 125 | Customer / Sales Area | Sales Organization Master (TVKO) | LEFT JOIN | KNVV.VKORG = TVKO.VKORG |
| 126 | Sales Organization Master | Sales Organization Description (TVKOT) | LEFT JOIN | TVKO.VKORG = TVKOT.VKORG AND language context = TVKOT.SPRAS |
| 127 | Customer / Sales Area | Distribution Channel Master (TVTW) | LEFT JOIN | KNVV.VTWEG = TVTW.VTWEG |
| 128 | Distribution Channel Master | Distribution Channel Description (TVTWT) | LEFT JOIN | TVTW.VTWEG = TVTWT.VTWEG AND language context = TVTWT.SPRAS |
| 129 | Customer / Sales Area | Division Description (TSPAT) | LEFT JOIN | KNVV.SPART = TSPAT.SPART AND language context = TSPAT.SPRAS |

### 17. Geographic Master Data

| # | Source Entity | Target Entity | Join Type | Relationship Logic |
|---:|---|---|---|---|
| 130 | Customer / Plant | Country Master (T005) | LEFT JOIN | Country code = T005.LAND1 |
| 131 | Country Master | Country Description (T005T) | LEFT JOIN | T005.LAND1 = T005T.LAND1 AND language context = T005T.SPRAS |
| 132 | Plant / Address Geography | Region Master (T005S) | LEFT JOIN | Country + region context = T005S.LAND1 + T005S.BLAND |
| 133 | Region Master | Region Description (T005U) | LEFT JOIN | T005S.LAND1 = T005U.LAND1 AND T005S.BLAND = T005U.BLAND AND language context = T005U.SPRAS |

### 18. Batch Classification Enrichment

| # | Source Entity | Target Entity | Join Type | Relationship Logic |
|---:|---|---|---|---|
| 134 | Batch | Batch Classification Object (INOB) | LEFT JOIN | Resolve batch classification object key from MCHA/MCH1; match INOB.OBJEK and INOB.KLART for the batch classification object |
| 135 | Batch Classification Object | Batch Class Assignment (KSSK) | LEFT JOIN | INOB.OBJEK = KSSK.OBJEK AND INOB.KLART = KSSK.KLART |
| 136 | Batch Class Assignment | Characteristic Value (AUSP) | LEFT JOIN | KSSK.OBJEK = AUSP.OBJEK AND KSSK.KLART = AUSP.KLART |
| 137 | Characteristic Value | Characteristic Definition (CABN) | LEFT JOIN | AUSP.ATINN = CABN.ATINN |
| 138 | Characteristic Definition | Characteristic Description (CABNT) | LEFT JOIN | CABN.ATINN = CABNT.ATINN AND language context = CABNT.SPRAS |
| 139 | Characteristic Definition | Allowed Characteristic Values (CAWN) | LEFT JOIN | CABN.ATINN = CAWN.ATINN |
| 140 | Allowed Characteristic Values | Allowed Value Description (CAWNT) | LEFT JOIN | CAWN.ATINN = CAWNT.ATINN AND CAWN.ATZHL = CAWNT.ATZHL AND language context = CAWNT.SPRAS |
| 141 | Batch Class Assignment | Class Master (KLAH) | LEFT JOIN | KSSK.CLINT = KLAH.CLINT AND KSSK.KLART = KLAH.KLART |

### 19. Production & Work-Center Enrichment

| # | Source Entity | Target Entity | Join Type | Relationship Logic |
|---:|---|---|---|---|
| 142 | Process Operation | Operation Values (AFVV) | LEFT JOIN | AFVC.AUFPL = AFVV.AUFPL AND AFVC.APLZL = AFVV.APLZL |
| 143 | Process Operation | Operation Sequence (AFFL) | LEFT JOIN | AFVC.AUFPL = AFFL.AUFPL AND applicable operation-sequence relationship is satisfied |
| 144 | Work Center | Work Center Description (CRTX) | LEFT JOIN | CRHD.OBJTY = CRTX.OBJTY AND CRHD.OBJID = CRTX.OBJID AND language context = CRTX.SPRAS |
| 145 | Work Center | Capacity Assignment (CRCA) | LEFT JOIN | CRHD.OBJTY = CRCA.OBJTY AND CRHD.OBJID = CRCA.OBJID AND validity date falls within CRCA.BEGDA/ENDDA |
| 146 | Capacity Assignment | Capacity Master (KAKO) | LEFT JOIN | CRCA.KAPID = KAKO.KAPID |

### 20. Warehouse Enrichment — Conditional

| # | Source Entity | Target Entity | Join Type | Relationship Logic |
|---:|---|---|---|---|
| 147 | Inventory / Stock | Warehouse Number Assignment (T320) | LEFT JOIN | MARD.WERKS = T320.WERKS AND MARD.LGORT = T320.LGORT |
| 148 | Warehouse Number | Storage Bin (LAGP) | LEFT JOIN | T320.LGNUM = LAGP.LGNUM |
| 149 | Storage Bin | Warehouse Stock Quant (LQUA) | LEFT JOIN | LAGP.LGNUM = LQUA.LGNUM AND LAGP.LGTYP = LQUA.LGTYP AND LAGP.LGPLA = LQUA.LGPLA |
| 150 | Warehouse Stock / Warehouse Number | Transfer Order Header (LTAK) | LEFT JOIN | LQUA.LGNUM = LTAK.LGNUM; link to transfer order using the applicable warehouse transfer reference |
| 151 | Transfer Order Header | Transfer Order Item (LTAP) | LEFT JOIN | LTAK.TANUM = LTAP.TANUM |

### 21. Sales Pricing & Rejection Reason Enrichment

| # | Source Entity | Target Entity | Join Type | Relationship Logic |
|---:|---|---|---|---|
| 152 | Sales Order / Sales Order Item | Pricing Condition Type (T685) | LEFT JOIN | Resolve pricing condition context to T685.KAPPL + T685.KSCHL; source condition type must match the sales pricing context |
| 153 | Pricing Condition Type | Pricing Condition Type Description (T685T) | LEFT JOIN | T685.KAPPL = T685T.KAPPL AND T685.KSCHL = T685T.KSCHL AND language context = T685T.SPRAS |
| 154 | Sales Order | Pricing Procedure (T683) | LEFT JOIN | VBAK.KALSM = T683.KALSM with applicable KVEWE/KAPPL context |
| 155 | Pricing Procedure | Pricing Procedure Description (T683T) | LEFT JOIN | T683.KALSM = T683T.KALSM AND language context = T683T.SPRAS |
| 156 | Sales Order Item / Delivery Item | Rejection Reason (TVAG) | LEFT JOIN | Relevant sales-document item rejection code ABGRU = TVAG.ABGRU |
| 157 | Rejection Reason | Rejection Reason Description (TVAGT) | LEFT JOIN | TVAG.ABGRU = TVAGT.ABGRU AND language context = TVAGT.SPRAS |

## 51-table enrichment coverage

| # | SAP Table | Enrichment Area | Resolver Relationship |
|---:|---|---|---|
| 100 | MARM | Material Master | 107 |
| 101 | MEAN | Material Master | 108 |
| 102 | T023 | Material Master | 109 |
| 103 | T023T | Material Master | 110 |
| 104 | T134 | Material Master | 111 |
| 105 | T134T | Material Master | 112 |
| 106 | T179 | Material Master | 113 |
| 107 | T179T | Material Master | 114 |
| 108 | MLAN | Material Master | 115 |
| 109 | MBEWH | Material Master | 116 |
| 110 | EINA | Supplier/Procurement | 117 |
| 111 | EINE | Supplier/Procurement | 118 |
| 112 | T024 | Supplier/Procurement | 119 |
| 113 | T024E | Supplier/Procurement | 120 |
| 114 | T161 | Supplier/Procurement | 121 |
| 115 | T161T | Supplier/Procurement | 122 |
| 116 | KNMT | Customer/Customer-Material | 123 |
| 117 | T077X | Customer/Customer-Material | 124 |
| 118 | TVKO | Customer/Customer-Material | 125 |
| 119 | TVKOT | Customer/Customer-Material | 126 |
| 120 | TVTW | Customer/Customer-Material | 127 |
| 121 | TVTWT | Customer/Customer-Material | 128 |
| 122 | TSPAT | Customer/Customer-Material | 129 |
| 123 | T005 | Geographic | 130 |
| 124 | T005T | Geographic | 131 |
| 125 | T005S | Geographic | 132 |
| 126 | T005U | Geographic | 133 |
| 127 | INOB | Batch Classification | 134 |
| 128 | KSSK | Batch Classification | 135 |
| 129 | AUSP | Batch Classification | 136 |
| 130 | CABN | Batch Classification | 137 |
| 131 | CABNT | Batch Classification | 138 |
| 132 | CAWN | Batch Classification | 139 |
| 133 | CAWNT | Batch Classification | 140 |
| 134 | KLAH | Batch Classification | 141 |
| 135 | AFVV | Production/Work Center | 142 |
| 136 | AFFL | Production/Work Center | 143 |
| 137 | CRTX | Production/Work Center | 144 |
| 138 | CRCA | Production/Work Center | 145 |
| 139 | KAKO | Production/Work Center | 146 |
| 140 | T320 | Warehouse Conditional | 147 |
| 141 | LAGP | Warehouse Conditional | 148 |
| 142 | LQUA | Warehouse Conditional | 149 |
| 143 | LTAK | Warehouse Conditional | 150 |
| 144 | LTAP | Warehouse Conditional | 151 |
| 145 | T685 | Sales Pricing | 152 |
| 146 | T685T | Sales Pricing | 153 |
| 147 | T683 | Sales Pricing | 154 |
| 148 | T683T | Sales Pricing | 155 |
| 149 | TVAG | Sales/Delivery Reason | 156 |
| 150 | TVAGT | Sales/Delivery Reason | 157 |

## Source notes

The 106-row baseline resolver is the uploaded field-level relationship reference. The current canonical schema defines 36 business objects and uses physical SAP mappings such as `MATDOC`, `MCHA/MCH1`, `AUFK/AFKO/AFPO`, `VBAK/VBAP`, `LIKP/LIPS`, and `VBRK/VBRP`. The 51 additional enrichment tables are taken from the current `SAP_Data_Model_Enrichment_Reference.csv`; their required fields define the available join keys, while context-dependent joins are explicitly marked for validation.

