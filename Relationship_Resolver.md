## Source-to-Target Table

# Field-Level Relationship Logic

SAP S/4HANA Data Model Reference - Planning, Production, Quality, Procurement, BOM/Routing, Sales & Distribution, Inventory, and Returns

106 documented entity relationships
13 functional groupings, from planning through returns

## Table of Contents

1. Planning & MRP - relationships 1-4
2. Process Order Structure - relationships 5-14
3. Quality Management - relationships 15-20
4. Material Movements & Inventory Postings - relationships 21-25
5. Procurement: Requisition to Purchase Order - relationships 26-39
6. Bill of Materials & Routing - relationships 40-54
7. Sales & Distribution - relationships 55-71
8. Inventory, Batch & Material Master - relationships 72-82
9. Quality Management (Extended Linkages) - relationships 83-85
10. Sales & Delivery Cross-References - relationships 86-88
11. Production Yield, Scrap & Confirmation - relationships 89-92
12. Goods Receipt (GRN) Linkages - relationships 93-96
13. Sales Returns - relationships 97-106

## 1. Planning & MRP

| # | Source Entity | Target Entity | Join Type | Relationship Logic |
| --- | --- | --- | --- | --- |
| 1 | Planning Requirement | Planning Requirement data | INNER JOIN | PBIM.BDZEI = PBED.BDZEI |
| 2 | Planned Order | Process Order | LEFT JOIN | PLAF.PLNUM = AFPO.PLNUM → AFPO.AUFNR |
| 3 | Planned Order | Reservation | LEFT JOIN | PLAF.RSNUM = RESB.RSNUM |
| 4 | Planned Order | Process Order | LEFT JOIN | PLAF.AUFNR = AFPO. AUFNR when PLAF.AUFNR is populated |

## 2. Process Order Structure

| # | Source Entity | Target Entity | Join Type | Relationship Logic |
| --- | --- | --- | --- | --- |
| 5 | Process Order | Process Order Header | INNER JOIN | AFKO.AUFNR = ProcessOrder.AUFNR |
| 6 | Process Order | Process Order Item | INNER JOIN | AFPO.AUFNR = ProcessOrder.AUFNR |
| 7 | Process Order | Reservation | LEFT JOIN | AFKO. RSNUM = RESB. RSNUM AND RESB. AUFNR = AFKO. AUFNR when populated |
| 8 | Reservation | Material Consumption | LEFT JOIN | RESB.RSNUM = MATDOC.RSNUM AND RESB.RSPOS = MATDOC.RSPOS AND MATDOC.BWART = 261 |
| 9 | Process Order | Material Consumption | LEFT JOIN | MATDOC.AUFNR = AFKO.AUFNR AND MATDOC.BWART = 261 |
| 10 | Process Order | Production Confirmation | LEFT JOIN | AFRU.AUFNR = AFKO.AUFNR |
| 11 | Production Confirmation | Process Operation | INNER JOIN | AFRU.AUFPL = AFVC.AUFPL AND AFRU.APLZL = AFVC.APLZL |
| 12 | Process Order | Process Operation | INNER JOIN | AFKO.AUFPL = AFVC.AUFPL |
| 13 | Process Operation | Work Center | INNER JOIN | AFVC.ARBID = CRHD.OBJID |
| 14 | Process Order | Work Center | INNER JOIN | AFKO.AUFPL = AFVC.AUFPL → AFVC.ARBID = CRHD.OBJID |

## 3. Quality Management

| # | Source Entity | Target Entity | Join Type | Relationship Logic |
| --- | --- | --- | --- | --- |
| 15 | Process Order | Quality Inspection Lot | LEFT JOIN | Prefer AFKO.PRUEFLOS = QALS.PRUEFLOS; otherwise AFKO.AUFNR = QALS.AUFNR when populated |
| 16 | Quality Inspection Lot | Material Movement | LEFT JOIN | QALS.MBLNR = MATDOC.MBLNR AND QALS.MJAHR = MATDOC.MJAHR AND QALS.ZEILE = MATDOC.ZEILE |
| 17 | Quality Inspection Lot | Batch | LEFT JOIN | QALS.MATNR = Batch.MATNR AND QALS.WERK = Batch.WERKS AND QALS.CHARG = Batch. CHARG |
| 18 | Quality Inspection Lot | Sampling | LEFT JOIN | QALS.PRUEFLOS = QAMR.PRUEFLOS / QASR.PRUEFLOS |
| 19 | Sampling | Inspection Result | LEFT JOIN | Match PRUEFLOS plus the relevant operation/characteristic keys |
| 20 | Quality Inspection Lot | Usage Decision | LEFT JOIN | QALS.PRUEFLOS = QAVE.PRUEFLOS |

## 4. Material Movements & Inventory Postings

| # | Source Entity | Target Entity | Join Type | Relationship Logic |
| --- | --- | --- | --- | --- |
| 21 | Material Movement | Material | INNER JOIN | MATDOC.MATNR = MARA.MATNR |
| 22 | Material Movement | Plant Material | INNER JOIN | MATDOC.MATNR = MARC.MATNR AND MATDOC.WERKS = MARC.WERKS |
| 23 | Material Movement | Batch | LEFT JOIN | MATDOC.MATNR = Batch.MATNR AND MATDOC.WERKS = Batch.WERKS AND MATDOC.CHARG = Batch. CHARG |
| 24 | Batch | Batch Stock | LEFT JOIN | MCHB.MATNR = Batch.MATNR AND MCHB.WERKS = Batch.WERKS AND MCHB.CHARG = Batch.CHARG |
| 25 | Material Movement | Material Document | INNER JOIN | MATDOC.MBLNR = MKPF.MBLNR AND MATDOC.MJAHR = MKPF.MJAHR |

## 5. Procurement: Requisition to Purchase Order

| # | Source Entity | Target Entity | Join Type | Relationship Logic |
| --- | --- | --- | --- | --- |
| 26 | Purchase Requisition | PO Item | LEFT JOIN | EBAN.BANFN = EKPO.BANFN AND EBAN.BNFPO = EKPO.BNFPO |
| 27 | Purchase Requisition | PR Account Assignment | LEFT JOIN | EBAN.BANFN = EBKN.BANFN AND EBAN.BNFPO = EBKN.BNFPO |

| # | Source Entity | Target Entity | Join Type | Relationship Logic |
| --- | --- | --- | --- | --- |
| 28 | Supplier | Purchase Order | LEFT JOIN | LFA1.LIFNR = EKKO.LIFNR |
| 29 | Supplier | Supplier Purchasing Data | LEFT JOIN | LFA1.LIFNR = LFM1.LIFNR |
| 30 | Supplier | Supplier Company Data | LEFT JOIN | LFA1.LIFNR = LFB1.LIFNR |
| 31 | Purchase Order | PO Item | INNER JOIN | EKKO.EBELN = EKPO.EBELN |
| 32 | PO Item | Schedule Line | LEFT JOIN | EKPO.EBELN = EKET.EBELN AND EKPO.EBELP = EKET.EBELP |
| 33 | PO Item | PO History | LEFT JOIN | EKPO.EBELN = EKBE.EBELN AND EKPO.EBELP = EKBE.EBELP |
| 34 | PO Item | PO Confirmation | LEFT JOIN | EKPO.EBELN = EKES.EBELN AND EKPO.EBELP = EKES.EBELP |
| 35 | PO Item | GRN | LEFT JOIN | EKPO.EBELN = MATDOC.EBELN AND EKPO.EBELP = MATDOC.EBELP AND MATDOC.BWART is a goods-receipt movement |
| 36 | GRN | Material Movement | INNER JOIN | GRN references MATDOC.MBLNR + MATDOC.MJAHR + MATDOC.ZEILE |
| 37 | GRN | Batch | LEFT JOIN | MATDOC.MATNR = Batch.MATNR AND MATDOC.WERKS = Batch.WERKS AND MATDOC.CHARG = Batch.CHARG |
| 38 | Reservation | Purchase Requisition | LEFT JOIN | RESB.BANFN = EBAN.BANFN AND RESB.BNFPO = EBAN.BNFPO |
| 39 | Reservation | Purchase Order | LEFT JOIN | RESB.EBELN = EKPO.EBELN AND RESB.EBELP = EKPO.EBELP |

## 6. Bill of Materials & Routing

| # | Source Entity | Target Entity | Join Type | Relationship Logic |
| --- | --- | --- | --- | --- |
| 40 | BOM Assignment | Material | INNER JOIN | MAST.MATNR = MARA.MATNR |
| 41 | BOM Assignment | Plant Material | INNER JOIN | MAST.MATNR = MARC.MATNR AND MAST.WERKS = MARC.WERKS |
| 42 | BOM Assignment | BOM Header | INNER JOIN | MAST.STLNR = STKO.STLNR AND MAST.STLAL = STKO.STLAL |
| 43 | BOM Header | BOM Component | LEFT JOIN | STKO.STLNR = STPO.STLNR |
| 44 | BOM Component | Material | INNER JOIN | STPO.IDNRK = MARA.MATNR |
| 45 | Material | Routing Assignment | LEFT JOIN | MAPL.MATNR = MARA.MATNR AND MAPL.WERKS = MARC.WERKS |
| 46 | Routing Assignment | Routing Header | INNER JOIN | MAPL.PLNNR = PLKO.PLNNR AND MAPL.PLNAL = PLKO.PLNAL |

| # | Source Entity | Target Entity | Join Type | Relationship Logic |
| --- | --- | --- | --- | --- |
| 47 | Routing Header | Routing Operation | LEFT JOIN | PLKO.PLNNR = PLPO.PLNNR |
| 48 | Routing Operation | Work Center | INNER JOIN | PLPO.ARBID = CRHD.OBJID |
| 49 | Production Version | Material | INNER JOIN | MKAL.MATNR = MARA.MATNR |
| 50 | Production Version | Plant Material | INNER JOIN | MKAL.MATNR = MARC.MATNR AND MKAL.WERKS = MARC.WERKS |
| 51 | Production Version | BOM | LEFT JOIN | MKAL.MATNR = MAST.MATNR AND MKAL.WERKS = MAST.WERKS AND MKAL.STLAL = MAST.STLAL |
| 52 | Production Version | Routing | LEFT JOIN | MKAL.MATNR = MAPL.MATNR AND MKAL.WERKS = MAPL.WERKS AND MKAL.PLNNR = MAPL.PLNNR AND MKAL.PLNAL = MAPL.PLNAL |
| 53 | Process Order | Production Version | LEFT JOIN | AFKO.PLNNR = MKAL.PLNNR AND AFKO.PLNAL = MKAL.PLNAL where applicable |
| 54 | Process Order | Routing | LEFT JOIN | AFKO.PLNNR = PLKO.PLNNR AND AFKO.PLNAL = PLKO.PLNAL |

## 7. Sales & Distribution

| # | Source Entity | Target Entity | Join Type | Relationship Logic |
| --- | --- | --- | --- | --- |
| 55 | Sales Order | Sales Order Item | INNER JOIN | VBAK.VBELN = VBAP.VBELN |
| 56 | Sales Order Item | Material | INNER JOIN | VBAP.MATNR = MARA.MATNR |
| 57 | Sales Order Item | Batch | LEFT JOIN | VBAP.MATNR = Batch.MATNR AND VBAP.CHARG = Batch.CHARG when populated |
| 58 | Sales Order | Customer | LEFT JOIN | VBAK.VBELN = VBPA. VBELN AND relevant customer partner function |
| 59 | Sales Order | Delivery | LEFT JOIN | VBFA.VBELV = VBAK.VBELN AND VBFA.VBELN = LIKP.VBELN |
| 60 | Sales Order Item | Delivery Item | LEFT JOIN | VBFA.VBELV = VBAP.VBELN AND VBFA.POSNV = VBAP.POSNR AND VBFA.VBELN = LIPS.VBELN AND VBFA.POSNN = LIPS.POSNR |
| 61 | Delivery | Delivery Item | INNER JOIN | LIKP.VBELN = LIPS.VBELN |
| 62 | Delivery Item | Material | INNER JOIN | LIPS.MATNR = MARA.MATNR |
| 63 | Delivery Item | Batch | LEFT JOIN | LIPS.MATNR = Batch.MATNR AND LIPS.WERKS = Batch.WERKS AND LIPS.CHARG = Batch.CHARG |
| 64 | Delivery Item | Process Order | LEFT JOIN | LIPS.AUFNR = AFKO.AUFNR when populated |

| # | Source Entity | Target Entity | Join Type | Relationship Logic |
| --- | --- | --- | --- | --- |
| 65 | Delivery Item | Goods Issue | LEFT JOIN | LIPS.LFBNR = MATDOC.MBLNR AND LIPS.LFPOS = MATDOC.ZEILE AND LIPS.LFGJA = MATDOC.MJAHR |
| 66 | Delivery Item | Material Movement | LEFT JOIN | Validate LIPS.MATNR = MATDOC.MATNRAND LIPS.WERKS = MATDOC.WERKS |
| 67 | Billing | Billing Item | INNER JOIN | VBRK.VBELN = VBRP.VBELN |
| 68 | Billing Item | Delivery Item | LEFT JOIN | VBRP.VGBEL = LIPS.VBELN AND VBRP.VGPOS = LIPS.POSNR |
| 69 | Billing Item | Sales Order Item | LEFT JOIN | VBRP.AUBEL = VBAP.VBELN AND VBRP.AUPOS = VBAP.POSNR |
| 70 | Billing | Delivery | LEFT JOIN | Use VBFA: billing document VBELN ↔︎ preceding delivery VBELV |
| 71 | Sales Document Flow | Sales Documents | INNER JOIN | VBFA. VBELV + VBFA. POSNV = preceding document/item; VBFA. VBELN + VBFA. POSNN = subsequent document/item |

## 8. Inventory, Batch & Material Master

| # | Source Entity | Target Entity | Join Type | Relationship Logic |
| --- | --- | --- | --- | --- |
| 72 | Material | Inventory | LEFT JOIN | MARA.MATNR = MARD.MATNR |
| 73 | Plant Material | Inventory | LEFT JOIN | MARC.MATNR = MARD.MATNR AND MARC.WERKS = MARD.WERKS |
| 74 | Inventory | Batch Stock | LEFT JOIN | MARD.MATNR = MCHB. MATNR AND MARD.WERKS = MCHB.WERKS AND MARD.LGORT = MCHB.LGORT |
| 75 | Material Movement | Inventory | LEFT JOIN | MATDOC.MATNR = MARD.MATNR AND MATDOC.WERKS = MARD.WERKS AND MATDOC.LGORT = MARD.LGORT |
| 76 | Material Movement | Reservation | LEFT JOIN | MATDOC.RSNUM = RESB.RSNUM AND MATDOC.RSPOS = RESB.RSPOS |
| 77 | Material Movement | Purchase Order | LEFT JOIN | MATDOC.EBELN = EKPO.EBELN AND MATDOC.EBELP = EKPO.EBELP |
| 78 | Material Movement | Process Order | LEFT JOIN | MATDOC.AUFNR = AFKO.AUFNR |
| 79 | Material Movement | Sales Order Item | LEFT JOIN | MATDOC.KDAUF = VBAP.VBELN AND MATDOC.KDPOS = VBAP.POSNR |
| 80 | Batch | Material | INNER JOIN | MCHA.MATNR = MARA.MATNR |
| 81 | Batch | Plant Material | INNER JOIN | MCHA.MATNR = MARC.MATNR AND MCHA.WERKS = MARC.WERKS |
| 82 | Batch | Batch Master | INNER JOIN | MCHA.MATNR = MCH1.MATNR AND MCHA.CHARG = MCH1.CHARG |
1. Quality Management (Extended Linkages)
| # | Source Entity | Target Entity | Join Type | Relationship Logic |
| :— | :— | :— | :— | :— |
| 83 | Quality Inspection Lot | Material Document | LEFT JOIN | QALS.MBLNR = MATDOC.MBLNR AND QALS.MJAHR = MATDOC.MJAHR AND QALS.ZEILE = MATDOC.ZEILE |
| 84 | Quality Inspection Lot | Process Operation | LEFT JOIN | QALS.AUFPL = AFVC.AUFPL when populated |
| 85 | Quality Inspection Lot | Process Order | LEFT JOIN | QALS.AUFNR = AFKO.AUFNR when populated |
2. Sales & Delivery Cross-References
| # | Source Entity | Target Entity | Join Type | Relationship Logic |
| :— | :— | :— | :— | :— |
| 86 | Delivery Item | Sales Order Item | LEFT JOIN | LIPS.VGBEL = VBAP.VBELN AND LIPS.VGPOS = VBAP.POSNR |
| 87 | Billing Item | Sales Order Item | LEFT JOIN | VBRP.AUBEL = VBAP.VBELN AND VBRP.AUPOS = VBAP.POSNR |
| 88 | Delivery Item | Reservation | LEFT JOIN | LIPS.RSNUM = RESB.RSNUM AND LIPS.RSPOS = RESB.RSPOS when populated |
3. Production Yield, Scrap & Confirmation
| # | Source Entity | Target Entity | Join Type | Relationship Logic |
| :— | :— | :— | :— | :— |
| 89 | Process Order | Production Yield | LEFT JOIN | MATDOC.AUFNR = AFKO.AUFNR AND MATDOC.BWART = 101 |
| 90 | Process Order | Production Scrap | LEFT JOIN | MATDOC.AUFNR = AFKO.AUFNR AND MATDOC.BWART corresponds to the configured scrap movement |
| 91 | Production Confirmation | Process Operation | INNER JOIN | AFRU.AUFPL = AFVC.AUFPL AND AFRU.APLZL = AFVC.APLZL |
| 92 | Production Confirmation | Process Order | INNER JOIN | AFRU.AUFNR = AFKO.AUFNR |

## 12. Goods Receipt (GRN) Linkages

| # | Source Entity | Target Entity | Join Type | Relationship Logic |
| --- | --- | --- | --- | --- |
| 93 | GRN | Purchase Order Item | INNER JOIN | MATDOC.MBLNR + MJAHR + ZEILE identifies GRN movement AND MATDOC.EBELN = EKPO.EBELN AND MATDOC.EBELP = EKPO.EBELP |
| 94 | GRN | Material | INNER JOIN | MATDOC.MATNR = MARA.MATNR |
| 95 | GRN | Inventory | LEFT JOIN | MATDOC.MATNR = MARD.MATNR AND MATDOC.WERKS = MARD.WERKS AND MATDOC.LGORT = MARD.LGORT |
| 96 | GRN | Batch | LEFT JOIN | MATDOC.MATNR = Batch.MATNR AND MATDOC.WERKS = Batch.WERKS AND MATDOC.CHARG = Batch.CHARG |

## 13. Sales Returns

| # | Source Entity | Target Entity | Join Type | Relationship Logic |
| --- | --- | --- | --- | --- |
| 97 | Sales Return | Sales Document Flow | INNER JOIN | VBFA.VBELV + VBFA.POSNV = preceding sales/delivery/billing document/item AND VBFA.VBELN + VBFA. POSNN = return document/item |
| 98 | Sales Return | Sales Order | LEFT JOIN | VBFA.VBELV = VBAK.VBELN / relevant return-document flow relationship |
| 99 | Sales Return | Sales Order Item | LEFT JOIN | VBFA.VBELV = VBAP.VBELN AND VBFA.POSNV = VBAP.POSNR / relevant return-document flow relationship |
| 100 | Sales Return | Delivery | LEFT JOIN | VBFA.VBELV = LIKP.VBELN / relevant return-delivery document flow relationship |
| 101 | Sales Return | Delivery Item | LEFT JOIN | VBFA.VBELV = LIPS.VBELN AND VBFA.POSNV = LIPS.POSNR / relevant return-delivery flow relationship |
| 102 | Sales Return | Billing Document | LEFT JOIN | VBFA.VBELV = VBRK.VBELN / relevant return-billing document flow relationship |
| 103 | Sales Return | Billing Item | LEFT JOIN | VBFA. VBELV = VBRP. VBELN AND VBFA. POSNV = VBRP. POSNR / relevant return-billing flow relationship |
| 104 | Sales Return | Material Movement | LEFT JOIN | Where the return is posted through inventory: identify the return material document in MATDOC and link it through the applicable sales/delivery reference; validate MATDOC.MATNR = LIPS.MATNR and MATDOC.WERKS = LIPS.WERKS |
| 105 | Sales Return | Batch | LEFT JOIN | For a batch-specific return, LIPS.MATNR = Batch.MATNRAND LIPS.WERKS = Batch.WERKS AND LIPS.CHARG = Batch.CHARG |

| # | Source Entity | Target Entity | Join Type | Relationship Logic |
| --- | --- | --- | --- | --- |
| 106 | Sales Return | Customer | LEFT JOIN | Resolve the customer through the related sales document: VBPA. VBELN = related sales document VBELN AND relevant customer partner function |