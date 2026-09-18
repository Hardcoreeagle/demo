---
title: "Process Order — Forward Traceability Flow"
subtitle: "Process Order → Material Movement → Batch → Sales Batch Allocation → Sales Order → Delivery → Billing"
---

# Process Order Forward Traceability Flow

This document traces a **process order** forward through its production
receipt, batch allocation, the sales order and its customer, the outbound
delivery, and the parallel goods-issue / billing paths to the billing
document.

Each object below lists its SAP table mapping and key fields, followed by
the match/condition logic used to step to the next object.

---

## Process Order

**SAP Mapping:** `AUFK`, `AFKO`, `AFPO`, `JEST`

**Key fields:**

| Field | Description |
|---|---|
| `AFKO.AUFNR` | Order number |
| `AFKO.AUFPL` | Routing / order operations number |
| `AFKO.RSNUM` | Reservation number |
| `AFKO.PRUEFLOS` | Inspection lot number |
| `AFPO.AUFNR` | Order number |
| `AFPO.POSNR` | Order item |
| `AFPO.PLNUM` | Planned order number |
| `AFPO.MATNR` | Material number |
| `AFPO.PWERK` | Production plant |
| `AFPO.CHARG` | Batch |

### → Production Receipt

- **Match:** `MATDOC.AUFNR = AFKO.AUFNR`
- **Condition:** `MATDOC.BWART = 101`
- **Validation:**
  - `AFPO.AUFNR = MATDOC.AUFNR`
  - `AFPO.MATNR = MATDOC.MATNR`
  - `AFPO.PWERK = MATDOC.WERKS`
  - `AFPO.CHARG = MATDOC.CHARG` *(when `AFPO.CHARG` is populated)*

---

## Material Movement — Production Receipt

| Field | Description |
|---|---|
| `MATDOC.MBLNR` | Material document number |
| `MATDOC.MJAHR` | Material document year |
| `MATDOC.ZEILE` | Material document item |
| `MATDOC.AUFNR` | Order number |
| `MATDOC.MATNR` | Material number |
| `MATDOC.WERKS` | Plant |
| `MATDOC.LGORT` | Storage location |
| `MATDOC.CHARG` | Batch |
| `MATDOC.BWART` | Movement type = `101` |

### → Batch

- **Match:**
  - `MATDOC.MATNR = MCHA.MATNR`
  - `MATDOC.WERKS = MCHA.WERKS`
  - `MATDOC.CHARG = MCHA.CHARG`
- **Condition:**
  - `MATDOC.BWART = 101`
  - `MATDOC.AUFNR IS NOT NULL`

---

## Batch

**SAP Mapping:** Batch master & batch transaction data

**Plant batch identity:**

| Field | Description |
|---|---|
| `MCHA.MATNR` | Material number |
| `MCHA.WERKS` | Plant |
| `MCHA.CHARG` | Batch |

**Batch key** = `MCHA.MATNR` + `MCHA.WERKS` + `MCHA.CHARG`

### → Sales Batch Allocation

- **Match:**
  - `LIPS.MATNR = MCHA.MATNR`
  - `LIPS.WERKS = MCHA.WERKS`
  - `LIPS.CHARG = MCHA.CHARG`
- **Required:** `LIPS.CHARG IS NOT NULL`

---

## Sales Batch Allocation

**SAP Mapping:** `LIPS`, `MCHB`, `MCHA`, `MCH1`, `MSEG`/`MATDOC`

**Relevant fields:**

| Field | Description |
|---|---|
| `LIPS.MATNR` | Material number |
| `LIPS.WERKS` | Plant |
| `LIPS.CHARG` | Batch |
| `MCHA.MATNR` | Material number |
| `MCHA.WERKS` | Plant |
| `MCHA.CHARG` | Batch |
| `MCHB.MATNR` | Material number |
| `MCHB.WERKS` | Plant |
| `MCHB.LGORT` | Storage location |
| `MCHB.CHARG` | Batch |

### → Sales Order Item

- **Match:**
  - `VBAP.MATNR = MCHA.MATNR`
  - `VBAP.CHARG = MCHA.CHARG`

---

## Sales Order Item

**SAP Mapping:** `VBAP`, `VBUP`, `VBFA`

**Key fields:**

| Field | Description |
|---|---|
| `VBAP.VBELN` | Sales document number |
| `VBAP.POSNR` | Sales document item |
| `VBAP.MATNR` | Material number |
| `VBAP.WERKS` | Plant |
| `VBAP.CHARG` | Batch |

### → Sales Order

- **Match:** `VBAK.VBELN = VBAP.VBELN`

---

## Sales Order

**SAP Mapping:** `VBAK`, `VBUK`, `VBPA`, `VBFA`

**Key fields:**

| Field | Description |
|---|---|
| `VBAK.VBELN` | Sales document number |
| `VBAK.KUNNR` | Sold-to customer |

### → Customer (Branch)

- **Match:**
  - `VBPA.VBELN = VBAK.VBELN`
  - `VBPA.KUNNR = KNA1.KUNNR`

**Customer:**

| Field | Description |
|---|---|
| `KNA1.KUNNR` | Customer number |
| `KNVV` | Customer sales area data |
| `KNVP` | Customer partner functions |
| `ADR6` | Customer email address |

### → Document Flow

- **Match:**
  - `VBFA.VBELV = VBAP.VBELN`
  - `VBFA.POSNV = VBAP.POSNR`
- **Result:**
  - `VBFA.VBELN` = subsequent document
  - `VBFA.POSNN` = subsequent item

---

## Document Flow — VBFA

| Field | Description |
|---|---|
| `VBFA.VBELV` | Preceding document |
| `VBFA.POSNV` | Preceding item |
| `VBFA.VBELN` | Subsequent document |
| `VBFA.POSNN` | Subsequent item |
| `VBFA.VBTYP_N` | Subsequent document category |

### → Outbound Delivery

- **Match:** `VBFA.VBELN = LIKP.VBELN`

---

## Outbound Delivery

**SAP Mapping:** `LIKP`, `LIPS`, `VBFA`, `VTTK`, `VTTP`

**Header:**

| Field | Description |
|---|---|
| `LIKP.VBELN` | Delivery number |

**Delivery flow:**

| Field | Description |
|---|---|
| `VBFA.VBELN` | Delivery document |
| `VBFA.VBELV` | Preceding document |

### → Delivery Item

- **Match:** `LIPS.VBELN = LIKP.VBELN`

---

## Delivery Item

**SAP Mapping:** `LIPS`, `VEKP`, `VEPO`, `MSEG`/`MATDOC`

**Key fields:**

| Field | Description |
|---|---|
| `LIPS.VBELN` | Delivery number |
| `LIPS.POSNR` | Delivery item |
| `LIPS.MATNR` | Material number |
| `LIPS.WERKS` | Plant |
| `LIPS.LGORT` | Storage location |
| `LIPS.CHARG` | Batch |

**Reference fields:**

| Field | Description |
|---|---|
| `LIPS.VGBEL` | Preceding sales document |
| `LIPS.VGPOS` | Preceding sales document item |

**Material-document reference:**

| Field | Description |
|---|---|
| `LIPS.LFBNR` | Reference material document number |
| `LIPS.LFPOS` | Reference material document item |
| `LIPS.LFGJA` | Reference material document year |

The delivery item branches into **two parallel paths**: goods issue and
billing.

### → Goods Issue

- **Match:**
  - `LIPS.LFBNR = MATDOC.MBLNR`
  - `LIPS.LFPOS = MATDOC.ZEILE`
  - `LIPS.LFGJA = MATDOC.MJAHR`
- **Condition:** `MATDOC.BWART = 601`

### → Billing Item

- **Match:**
  - `VBRP.VGBEL = LIPS.VBELN`
  - `VBRP.VGPOS = LIPS.POSNR`

---

## Material Movement — Goods Issue

| Field | Description |
|---|---|
| `MATDOC.MBLNR` | Material document number |
| `MATDOC.MJAHR` | Material document year |
| `MATDOC.ZEILE` | Material document item |
| `MATDOC.MATNR` | Material number |
| `MATDOC.WERKS` | Plant |
| `MATDOC.CHARG` | Batch |
| `MATDOC.BWART` | Movement type = `601` |

---

## Billing Document (Item)

**VBRP:**

| Field | Description |
|---|---|
| `VBRP.VBELN` | Billing document number |
| `VBRP.POSNR` | Billing item |
| `VBRP.VBELV` | Preceding document |
| `VBRP.POSNV` | Preceding item |
| `VBRP.VGBEL` | Reference delivery |
| `VBRP.VGPOS` | Reference delivery item |
| `VBRP.AUBEL` | Reference sales order |
| `VBRP.AUPOS` | Reference sales order item |

### → Billing Header

- **Match:** `VBRK.VBELN = VBRP.VBELN`

---

## Billing Document (Header)

**VBRK:**

| Field | Description |
|---|---|
| `VBRK.VBELN` | Billing document number |
| `VBRK.KNUMV` | Condition record (pricing) number |

**VBRP:**

| Field | Description |
|---|---|
| `VBRP.VBELN` | Billing document number |
| `VBRP.POSNR` | Billing item |

---

## Full Flow Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                       PROCESS ORDER                          │
│                                                                │
│ SAP Mapping: AUFK, AFKO, AFPO, JEST                           │
│                                                                │
│ Key fields:                                                   │
│   AFKO.AUFNR                                                  │
│   AFKO.AUFPL                                                  │
│   AFKO.RSNUM                                                  │
│   AFKO.PRUEFLOS                                                │
│   AFPO.AUFNR                                                  │
│   AFPO.POSNR                                                  │
│   AFPO.PLNUM                                                  │
│   AFPO.MATNR                                                  │
│   AFPO.PWERK                                                  │
│   AFPO.CHARG                                                  │
└──────────────────────────────────────────────────────────────┘
                           │
                           │ PROCESS ORDER
                           │       ↓
                           │ PRODUCTION RECEIPT
                           │
                           │ MATCH:
                           │   MATDOC.AUFNR = AFKO.AUFNR
                           │
                           │ CONDITION:
                           │   MATDOC.BWART = 101
                           │
                           │ VALIDATION:
                           │   AFPO.AUFNR = MATDOC.AUFNR
                           │   AFPO.MATNR = MATDOC.MATNR
                           │   AFPO.PWERK = MATDOC.WERKS
                           │   AFPO.CHARG = MATDOC.CHARG
                           │   when AFPO.CHARG is populated
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                     MATERIAL MOVEMENT                         │
│                                                                │
│ Production Receipt                                            │
│                                                                │
│ MATDOC.MBLNR                                                  │
│ MATDOC.MJAHR                                                  │
│ MATDOC.ZEILE                                                  │
│ MATDOC.AUFNR                                                  │
│ MATDOC.MATNR                                                  │
│ MATDOC.WERKS                                                  │
│ MATDOC.LGORT                                                  │
│ MATDOC.CHARG                                                  │
│ MATDOC.BWART = 101                                             │
└──────────────────────────────────────────────────────────────┘
                           │
                           │ MATERIAL MOVEMENT
                           │       ↓
                           │ BATCH
                           │
                           │ MATCH:
                           │   MATDOC.MATNR = MCHA.MATNR
                           │   MATDOC.WERKS = MCHA.WERKS
                           │   MATDOC.CHARG = MCHA.CHARG
                           │
                           │ CONDITION:
                           │   MATDOC.BWART = 101
                           │   MATDOC.AUFNR IS NOT NULL
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                            BATCH                              │
│                                                                │
│ SAP Mapping: Batch master & batch transaction data             │
│                                                                │
│ Plant Batch Identity:                                          │
│   MCHA.MATNR                                                  │
│   MCHA.WERKS                                                  │
│   MCHA.CHARG                                                  │
│                                                                │
│ Batch Key =                                                    │
│   MCHA.MATNR + MCHA.WERKS + MCHA.CHARG                          │
└──────────────────────────────────────────────────────────────┘
                           │
                           │ BATCH
                           │       ↓
                           │ SALES BATCH ALLOCATION
                           │
                           │ MATCH:
                           │   LIPS.MATNR = MCHA.MATNR
                           │   LIPS.WERKS = MCHA.WERKS
                           │   LIPS.CHARG = MCHA.CHARG
                           │
                           │ REQUIRED:
                           │   LIPS.CHARG IS NOT NULL
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                  SALES BATCH ALLOCATION                       │
│                                                                │
│ SAP Mapping: LIPS, MCHB, MCHA, MCH1, MSEG/MATDOC                │
│                                                                │
│ Relevant fields:                                                │
│   LIPS.MATNR                                                   │
│   LIPS.WERKS                                                   │
│   LIPS.CHARG                                                   │
│   MCHA.MATNR                                                   │
│   MCHA.WERKS                                                   │
│   MCHA.CHARG                                                   │
│   MCHB.MATNR                                                   │
│   MCHB.WERKS                                                   │
│   MCHB.LGORT                                                   │
│   MCHB.CHARG                                                   │
└──────────────────────────────────────────────────────────────┘
                           │
                           │ SALES BATCH ALLOCATION
                           │       ↓
                           │ SALES ORDER ITEM
                           │
                           │ MATCH:
                           │   VBAP.MATNR = MCHA.MATNR
                           │   VBAP.CHARG = MCHA.CHARG
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                     SALES ORDER ITEM                          │
│                                                                │
│ SAP Mapping: VBAP, VBUP, VBFA                                   │
│                                                                │
│ Key fields:                                                     │
│   VBAP.VBELN                                                   │
│   VBAP.POSNR                                                   │
│   VBAP.MATNR                                                   │
│   VBAP.WERKS                                                   │
│   VBAP.CHARG                                                   │
└──────────────────────────────────────────────────────────────┘
                           │
                           │ SALES ORDER ITEM
                           │       ↓
                           │ SALES ORDER
                           │
                           │ MATCH:
                           │   VBAK.VBELN = VBAP.VBELN
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                        SALES ORDER                            │
│                                                                │
│ SAP Mapping: VBAK, VBUK, VBPA, VBFA                             │
│                                                                │
│ Key fields:                                                     │
│   VBAK.VBELN                                                   │
│   VBAK.KUNNR                                                   │
└──────────────────────────────────────────────────────────────┘
                           │
                           ├────────────────────────────────────┐
                           │                                    │
                           │ SALES ORDER → CUSTOMER              │
                           │                                    │
                           │ MATCH:                             │
                           │   VBPA.VBELN = VBAK.VBELN            │
                           │   VBPA.KUNNR = KNA1.KUNNR            │
                           │                                    ▼
                           │                          ┌───────────────────────┐
                           │                          │      CUSTOMER         │
                           │                          │                       │
                           │                          │ KNA1.KUNNR            │
                           │                          │ KNVV                   │
                           │                          │ KNVP                   │
                           │                          │ ADR6                   │
                           │                          └───────────────────────┘
                           │
                           │ SALES ORDER ITEM
                           │       ↓
                           │ DOCUMENT FLOW
                           │
                           │ MATCH:
                           │   VBFA.VBELV = VBAP.VBELN
                           │   VBFA.POSNV = VBAP.POSNR
                           │
                           │ RESULT:
                           │   VBFA.VBELN = subsequent document
                           │   VBFA.POSNN = subsequent item
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                    DOCUMENT FLOW — VBFA                       │
│                                                                │
│ VBFA.VBELV                                                    │
│   = preceding document                                        │
│                                                                │
│ VBFA.POSNV                                                    │
│   = preceding item                                             │
│                                                                │
│ VBFA.VBELN                                                    │
│   = subsequent document                                        │
│                                                                │
│ VBFA.POSNN                                                    │
│   = subsequent item                                            │
│                                                                │
│ VBFA.VBTYP_N                                                  │
│   = subsequent document category                                │
└──────────────────────────────────────────────────────────────┘
                           │
                           │ DOCUMENT FLOW
                           │       ↓
                           │ OUTBOUND DELIVERY
                           │
                           │ MATCH:
                           │   VBFA.VBELN = LIKP.VBELN
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                    OUTBOUND DELIVERY                          │
│                                                                │
│ SAP Mapping: LIKP, LIPS, VBFA, VTTK, VTTP                       │
│                                                                │
│ Header:                                                          │
│   LIKP.VBELN                                                   │
│                                                                │
│ Delivery flow:                                                  │
│   VBFA.VBELN                                                   │
│   VBFA.VBELV                                                   │
└──────────────────────────────────────────────────────────────┘
                           │
                           │ OUTBOUND DELIVERY
                           │       ↓
                           │ DELIVERY ITEM
                           │
                           │ MATCH:
                           │   LIPS.VBELN = LIKP.VBELN
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                      DELIVERY ITEM                            │
│                                                                │
│ SAP Mapping: LIPS, VEKP, VEPO, MSEG/MATDOC                      │
│                                                                │
│ Key fields:                                                     │
│   LIPS.VBELN                                                   │
│   LIPS.POSNR                                                   │
│   LIPS.MATNR                                                   │
│   LIPS.WERKS                                                   │
│   LIPS.LGORT                                                   │
│   LIPS.CHARG                                                   │
│                                                                │
│ Reference fields:                                                │
│   LIPS.VGBEL                                                   │
│   LIPS.VGPOS                                                   │
│                                                                │
│ Material-document reference:                                    │
│   LIPS.LFBNR                                                   │
│   LIPS.LFPOS                                                   │
│   LIPS.LFGJA                                                   │
└──────────────────────────────────────────────────────────────┘
                           │
             ┌─────────────┴────────────────┐
             │                              │
             │ DELIVERY ITEM                │ DELIVERY ITEM
             │       ↓                      │       ↓
             │ GOODS ISSUE                  │ BILLING ITEM
             │                              │
             │ MATCH:                       │ MATCH:
             │ LIPS.LFBNR                   │ VBRP.VGBEL
             │   = MATDOC.MBLNR             │   = LIPS.VBELN
             │                              │
             │ LIPS.LFPOS                   │ VBRP.VGPOS
             │   = MATDOC.ZEILE             │   = LIPS.POSNR
             │                              │
             │ LIPS.LFGJA                   │
             │   = MATDOC.MJAHR             │
             │                              │
             │ CONDITION:                   │
             │ MATDOC.BWART = 601            │
             ▼                              ▼
┌──────────────────────────────┐   ┌──────────────────────────────┐
│      MATERIAL MOVEMENT       │   │      BILLING DOCUMENT        │
│                              │   │                              │
│ GOODS ISSUE                  │   │ VBRP                         │
│                              │   │ ├── VBRP.VBELN               │
│ MATDOC.MBLNR                 │   │ ├── VBRP.POSNR               │
│ MATDOC.MJAHR                 │   │ ├── VBRP.VBELV               │
│ MATDOC.ZEILE                 │   │ ├── VBRP.POSNV               │
│ MATDOC.MATNR                 │   │ ├── VBRP.VGBEL               │
│ MATDOC.WERKS                 │   │ ├── VBRP.VGPOS               │
│ MATDOC.CHARG                 │   │ ├── VBRP.AUBEL               │
│ MATDOC.BWART = 601           │   │ └── VBRP.AUPOS               │
└──────────────────────────────┘   └──────────────────────────────┘
                                           │
                                           │ BILLING ITEM
                                           │       ↓
                                           │ BILLING HEADER
                                           │
                                           │ MATCH:
                                           │   VBRK.VBELN = VBRP.VBELN
                                           ▼
                              ┌─────────────────────────────────┐
                              │       BILLING DOCUMENT          │
                              │                                 │
                              │ VBRK                            │
                              │ ├── VBRK.VBELN                  │
                              │ └── VBRK.KNUMV                  │
                              │                                 │
                              │ VBRP                            │
                              │ ├── VBRP.VBELN                  │
                              │ └── VBRP.POSNR                  │
                              └─────────────────────────────────┘
```

---

## Table Reference Summary

| Table | Role |
|---|---|
| `AUFK` | Order master (general order data) |
| `AFKO` | Process order header |
| `AFPO` | Process order item |
| `JEST` | Object status |
| `MATDOC` | Material document (production receipt 101, goods issue 601) |
| `MCHA` | Batch master |
| `MCHB` | Batch stock |
| `MCH1` | Client-level batch master |
| `LIPS` | Delivery item |
| `VBAP` | Sales order item |
| `VBUP` | Sales document item status |
| `VBAK` | Sales order header |
| `VBUK` | Sales document header status |
| `VBPA` | Sales document partner |
| `KNA1` | Customer master (general data) |
| `KNVV` | Customer master (sales area data) |
| `KNVP` | Customer master (partner functions) |
| `ADR6` | Customer email address |
| `VBFA` | Sales document flow |
| `LIKP` | Delivery header |
| `VEKP` | Handling unit header |
| `VEPO` | Handling unit item |
| `VTTK` | Shipment header |
| `VTTP` | Shipment item |
| `VBRP` | Billing item |
| `VBRK` | Billing document header |
