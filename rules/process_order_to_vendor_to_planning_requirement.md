---
title: "Process Order to Vendor to Planning Requirement Flow"
subtitle: "Process Order → Material Consumption → Batch → (Internal Production | External Procurement) → Vendor / Planned Order → Planning Requirement"
---

# Process Order to Vendor to Planning Requirement Flow

This document traces a **process order** backward through material
consumption and batch origin to a decision point: was the consumed batch
produced **internally** (another process order) or procured **externally**
(a purchase order)? Both branches are followed through to their common
origin — a **planned order** and its **planning requirement**, with the
external branch also resolving to the **vendor**.

Each object below lists its SAP table mapping and key fields, followed by
the match/condition logic used to step to the next object.

---

## Process Order

**SAP Tables:** `AUFK`, `AFKO`, `AFPO`, `JEST`

| Field | Description |
|---|---|
| `AFKO.AUFNR` | Order number |
| `AFKO.RSNUM` | Reservation number |
| `AFPO.AUFNR` | Order number |
| `AFPO.PLNUM` | Planned order number |
| `AFPO.MATNR` | Material number |
| `AFPO.PWERK` | Production plant |
| `AFPO.CHARG` | Batch |

### → Find Material Consumption

- `MATDOC.AUFNR = AFKO.AUFNR`
- `MATDOC.BWART = 261`

---

## Material Consumption

**SAP Tables:** `MATDOC` / `MSEG`

| Field | Description |
|---|---|
| `MATDOC.MBLNR + MATDOC.MJAHR + MATDOC.ZEILE` | Material document key |
| `MATDOC.AUFNR` | Order number |
| `MATDOC.RSNUM` | Reservation number |
| `MATDOC.RSPOS` | Reservation item |
| `MATDOC.MATNR` | Material number |
| `MATDOC.WERKS` | Plant |
| `MATDOC.CHARG` | Batch |
| `MATDOC.EBELN` | Purchase order number |
| `MATDOC.EBELP` | Purchase order item |

**Condition:** `MATDOC.BWART = 261`

### → Identify Consumed Batch

- `MATDOC.MATNR = MCHA.MATNR`
- `MATDOC.WERKS = MCHA.WERKS`
- `MATDOC.CHARG = MCHA.CHARG`

---

## Batch

**SAP Tables:** `MCHA`, `MCH1`, `MCHB`

**Plant batch identity:** `MCHA.MATNR + MCHA.WERKS + MCHA.CHARG`

### → Search Batch Origin

- `MATDOC.MATNR = MCHA.MATNR`
- `MATDOC.WERKS = MCHA.WERKS`
- `MATDOC.CHARG = MCHA.CHARG`
- `MATDOC.BWART = 101`
- `MATDOC.AUFNR IS NOT NULL`

---

## Decision — Qualifying Production 101 Found for Batch?

The search determines which branch the trace follows.

- **YES** → the batch was produced internally → continue to **Material
  Movement (Production Receipt)**
- **NO** → the batch was not produced internally → continue to **Check
  External Procurement**

---

# Branch A — Internal Production (YES)

## Material Movement — Production Receipt

| Field | Description |
|---|---|
| `MATDOC.BWART` | `= 101` |
| `MATDOC.AUFNR` | `IS NOT NULL` |
| `MATDOC.AUFNR` | `= AFKO.AUFNR` |

### → Previous Process Order

---

## Previous Process Order

**SAP Tables:** `AUFK`, `AFKO`, `AFPO`

| Field | Description |
|---|---|
| `AFKO.AUFNR` | Order number |
| `AFPO.AUFNR` | Order number |
| `AFPO.PLNUM` | Planned order number |

### → Direct Production Planning Link

- `AFPO.PLNUM = PLAF.PLNUM`

---

## Planned Order

**SAP Table:** `PLAF`

| Field | Description |
|---|---|
| `PLAF.PLNUM` | Planned order number |
| `PLAF.RSNUM` | Reservation number |
| `PLAF.AUFNR` | Order number |
| `PLAF.PBDNR` | Planning requirement number |
| `PLAF.MATNR` | Material number |
| `PLAF.GSMNG` | Planned quantity |

### → Planned Order to Planning Requirement

- `PLAF.PBDNR = PBIM.PBDNR`

---

# Branch B — External Procurement (NO)

## Check External Procurement

From the `261` consumption row:

| Field | Description |
|---|---|
| `MATDOC.EBELN` | Purchase order number |
| `MATDOC.EBELP` | Purchase order item |

### → GRN

---

## GRN

**SAP Tables:** `MATDOC`, `MSEG`, `MKPF`

| Field | Description |
|---|---|
| `MATDOC.MBLNR` | Material document number |
| `MATDOC.MJAHR` | Material document year |
| `MATDOC.ZEILE` | Material document item |

**Receipt:**

- `MATDOC.BWART = 101`
- `MATDOC.EBELN IS NOT NULL`
- `MATDOC.EBELP IS NOT NULL`

### → PO Item Match

- `MATDOC.EBELN = EKPO.EBELN`
- `MATDOC.EBELP = EKPO.EBELP`

---

## Purchase Order

**SAP Tables:** `EKKO`, `EKPO`

| Field | Description |
|---|---|
| `EKKO.EBELN` | Purchase order number |
| `EKKO.LIFNR` | Vendor number |
| `EKPO.EBELN` | Purchase order number |
| `EKPO.EBELP` | Purchase order item |
| `EKPO.BANFN` | Purchase requisition number |
| `EKPO.BNFPO` | Purchase requisition item |
| `EKPO.MATNR` | Material number |
| `EKPO.WERKS` | Plant |

The purchase order branches two ways: vendor and purchase requisition.

### → Supplier Source / Vendor (Branch)

- `EKKO.LIFNR = LFA1.LIFNR`

---

## Supplier Source / Vendor

**SAP Table:** `LFA1`

| Field | Description |
|---|---|
| `LFA1.LIFNR` | Vendor number |

---

## Purchase Order → Purchase Requisition

- `EKPO.BANFN = EBAN.BANFN`
- `EKPO.BNFPO = EBAN.BNFPO`

---

## Purchase Requisition

**SAP Table:** `EBAN`

| Field | Description |
|---|---|
| `EBAN.BANFN` | Purchase requisition number |
| `EBAN.BNFPO` | Purchase requisition item |
| `EBAN.MATNR` | Material number |
| `EBAN.WERKS` | Plant |

### → PR to Reservation

- `EBAN.BANFN = RESB.BANFN`
- `EBAN.BNFPO = RESB.BNFPO`

---

## Reservation

**SAP Table:** `RESB`

| Field | Description |
|---|---|
| `RESB.RSNUM` | Reservation number |
| `RESB.RSPOS` | Reservation item |
| `RESB.BANFN` | Purchase requisition number |
| `RESB.BNFPO` | Purchase requisition item |
| `RESB.AUFNR` | Order number |

### → Reservation to Planned Order

- `PLAF.RSNUM = RESB.RSNUM`

---

## Planned Order (from Reservation)

**SAP Table:** `PLAF`

| Field | Description |
|---|---|
| `PLAF.PLNUM` | Planned order number |
| `PLAF.RSNUM` | Reservation number |
| `PLAF.AUFNR` | Order number |
| `PLAF.PBDNR` | Planning requirement number |
| `PLAF.MATNR` | Material number |
| `PLAF.GSMNG` | Planned quantity |

### → Planned Order to Planning Requirement

- `PLAF.PBDNR = PBIM.PBDNR`

---

# Common Endpoint — Planning Requirement

Both branches converge on the same object.

## Planning Requirement

**SAP Tables:** `PBIM`, `PBED`

| Field | Description |
|---|---|
| `PBIM.PBDNR` | Planning requirement number |
| `PBIM.BDZEI` | Requirement date/time key |
| `PBED.BDZEI` | Requirement date/time key |

**Match:** `PBIM.BDZEI = PBED.BDZEI`

---

## Full Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              PROCESS ORDER                                   │
│                                                                              │
│ SAP Tables: AUFK, AFKO, AFPO, JEST                                            │
│                                                                              │
│ AFKO.AUFNR                                                                   │
│ AFKO.RSNUM                                                                   │
│ AFPO.AUFNR                                                                   │
│ AFPO.PLNUM                                                                   │
│ AFPO.MATNR                                                                   │
│ AFPO.PWERK                                                                   │
│ AFPO.CHARG                                                                   │
└───────────────────────────────────┬──────────────────────────────────────────┘
                                    │
                                    │ FIND MATERIAL CONSUMPTION
                                    │
                                    │ MATDOC.AUFNR = AFKO.AUFNR
                                    │ MATDOC.BWART = 261
                                    ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                          MATERIAL CONSUMPTION                                │
│                                                                              │
│ SAP Tables: MATDOC / MSEG                                                    │
│                                                                              │
│ MATDOC.MBLNR + MATDOC.MJAHR + MATDOC.ZEILE                                   │
│ MATDOC.AUFNR                                                                │
│ MATDOC.RSNUM                                                                │
│ MATDOC.RSPOS                                                                │
│ MATDOC.MATNR                                                                │
│ MATDOC.WERKS                                                                │
│ MATDOC.CHARG                                                                │
│ MATDOC.EBELN                                                                │
│ MATDOC.EBELP                                                                │
│                                                                              │
│ Condition: MATDOC.BWART = 261                                                │
└───────────────────────────────────┬──────────────────────────────────────────┘
                                    │
                                    │ IDENTIFY CONSUMED BATCH
                                    │
                                    │ MATDOC.MATNR = MCHA.MATNR
                                    │ MATDOC.WERKS = MCHA.WERKS
                                    │ MATDOC.CHARG = MCHA.CHARG
                                    ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                                  BATCH                                       │
│                                                                              │
│ SAP Tables: MCHA, MCH1, MCHB                                                 │
│                                                                              │
│ Plant Batch Identity:                                                        │
│   MCHA.MATNR + MCHA.WERKS + MCHA.CHARG                                       │
└───────────────────────────────────┬──────────────────────────────────────────┘
                                    │
                                    │ SEARCH BATCH ORIGIN
                                    │
                                    │ MATDOC.MATNR = MCHA.MATNR
                                    │ MATDOC.WERKS = MCHA.WERKS
                                    │ MATDOC.CHARG = MCHA.CHARG
                                    │ MATDOC.BWART = 101
                                    │ MATDOC.AUFNR IS NOT NULL
                                    ▼
                         ┌─────────────────────────┐
                         │ QUALIFYING PRODUCTION   │
                         │ 101 FOUND FOR BATCH?     │
                         └────────────┬────────────┘
                                      │
                    ┌─────────────────┴──────────────────┐
                    │                                    │
                   YES                                   NO
                    │                                    │
                    ▼                                    ▼
┌──────────────────────────────────────┐   ┌──────────────────────────────────┐
│ MATERIAL MOVEMENT                    │   │ CHECK EXTERNAL PROCUREMENT       │
│    PRODUCTION RECEIPT                │   │                                  │
│                                      │   │ From the 261 consumption row:    │
│ MATDOC.BWART = 101                   │   │                                  │
│ MATDOC.AUFNR IS NOT NULL             │   │ MATDOC.EBELN                     │
│                                      │   │ MATDOC.EBELP                     │
│ MATDOC.AUFNR = AFKO.AUFNR            │   │                                  │
└──────────────────┬───────────────────┘   └───────────────┬──────────────────┘
                   │                                       │
                   ▼                                       │
┌──────────────────────────────────────┐                    │
│ PREVIOUS PROCESS ORDER               │                    │
│                                      │                    │
│ SAP Tables: AUFK, AFKO, AFPO         │                    │
│                                      │                    │
│ AFKO.AUFNR                           │                    │
│ AFPO.AUFNR                           │                    │
│ AFPO.PLNUM                           │                    │
└──────────────────┬───────────────────┘                    │
                   │                                        │
                   │ DIRECT PRODUCTION PLANNING LINK        │
                   │                                        │
                   │ AFPO.PLNUM = PLAF.PLNUM                 │
                   │                                        │
                   ▼                                        ▼
┌──────────────────────────────────────┐   ┌──────────────────────────────────┐
│ PLANNED ORDER                        │   │ GRN                              │
│                                      │   │                                  │
│ SAP Table: PLAF                     │   │ SAP Tables: MATDOC, MSEG, MKPF   │
│                                      │   │                                  │
│ PLAF.PLNUM                           │   │ MATDOC.MBLNR                     │
│ PLAF.RSNUM                           │   │ MATDOC.MJAHR                     │
│ PLAF.AUFNR                           │   │ MATDOC.ZEILE                     │
│ PLAF.PBDNR                           │   │                                  │
│ PLAF.MATNR                           │   │ Receipt:                          │
│ PLAF.GSMNG                           │   │ MATDOC.BWART = 101               │
└──────────────────┬───────────────────┘   │ MATDOC.EBELN IS NOT NULL         │
                   │                       │ MATDOC.EBELP IS NOT NULL         │
                   │                       └───────────────┬──────────────────┘
                   │                                       │
                   │                                       │ PO ITEM MATCH
                   │                                       │
                   │                                       │ MATDOC.EBELN = EKPO.EBELN
                   │                                       │ MATDOC.EBELP = EKPO.EBELP
                   │                                       ▼
                   │                       ┌──────────────────────────────────┐
                   │                       │ PURCHASE ORDER                   │
                   │                       │                                  │
                   │                       │ SAP Tables: EKKO, EKPO           │
                   │                       │                                  │
                   │                       │ EKKO.EBELN                       │
                   │                       │ EKKO.LIFNR                       │
                   │                       │                                  │
                   │                       │ EKPO.EBELN                       │
                   │                       │ EKPO.EBELP                       │
                   │                       │ EKPO.BANFN                       │
                   │                       │ EKPO.BNFPO                       │
                   │                       │ EKPO.MATNR                       │
                   │                       │ EKPO.WERKS                       │
                   │                       └───────────────┬──────────────────┘
                   │                                       │
                   │                       ┌───────────────┴──────────────────┐
                   │                       │                                  │
                   │                       │ EKKO.LIFNR = LFA1.LIFNR          │
                   │                       │                                  │
                   │                       ▼                                  │
                   │             ┌──────────────────────────────┐             │
                   │             │ SUPPLIER SOURCE / VENDOR     │             │
                   │             │                              │             │
                   │             │ SAP Table: LFA1               │             │
                   │             │                              │             │
                   │             │ LFA1.LIFNR                    │             │
                   │             └──────────────────────────────┘             │
                   │                                                            │
                   │                       PO ITEM → PR                         │
                   │                                                            │
                   │                       EKPO.BANFN = EBAN.BANFN             │
                   │                       EKPO.BNFPO = EBAN.BNFPO             │
                   │                                                            ▼
                   │                       ┌──────────────────────────────────┐
                   │                       │ PURCHASE REQUISITION             │
                   │                       │                                  │
                   │                       │ SAP Table: EBAN                  │
                   │                       │                                  │
                   │                       │ EBAN.BANFN                       │
                   │                       │ EBAN.BNFPO                       │
                   │                       │ EBAN.MATNR                       │
                   │                       │ EBAN.WERKS                       │
                   │                       └───────────────┬──────────────────┘
                   │                                       │
                   │                                       │ PR → RESERVATION
                   │                                       │
                   │                                       │ EBAN.BANFN = RESB.BANFN
                   │                                       │ EBAN.BNFPO = RESB.BNFPO
                   │                                       ▼
                   │                       ┌──────────────────────────────────┐
                   │                       │ RESERVATION                      │
                   │                       │                                  │
                   │                       │ SAP Table: RESB                  │
                   │                       │                                  │
                   │                       │ RESB.RSNUM                       │
                   │                       │ RESB.RSPOS                       │
                   │                       │ RESB.BANFN                       │
                   │                       │ RESB.BNFPO                       │
                   │                       │ RESB.AUFNR                       │
                   │                       └───────────────┬──────────────────┘
                   │                                       │
                   │                                       │ PLAF.RSNUM = RESB.RSNUM
                   │                                       ▼
                   │                       ┌──────────────────────────────────┐
                   │                       │ PLANNED ORDER                    │
                   │                       │                                  │
                   │                       │ SAP Table: PLAF                  │
                   │                       │                                  │
                   │                       │ PLAF.PLNUM                       │
                   │                       │ PLAF.RSNUM                       │
                   │                       │ PLAF.AUFNR                       │
                   │                       │ PLAF.PBDNR                       │
                   │                       │ PLAF.MATNR                       │
                   │                       │ PLAF.GSMNG                       │
                   │                       └───────────────┬──────────────────┘
                   │                                       │
                   │                                       │ PLAF.PBDNR = PBIM.PBDNR
                   │                                       ▼
                   │                       ┌──────────────────────────────────┐
                   │                       │ PLANNING REQUIREMENT             │
                   │                       │                                  │
                   │                       │ SAP Tables: PBIM, PBED           │
                   │                       │                                  │
                   │                       │ PBIM.PBDNR                       │
                   │                       │ PBIM.BDZEI                       │
                   │                       │ PBED.BDZEI                       │
                   │                       │                                  │
                   │                       │ PBIM.BDZEI = PBED.BDZEI          │
                   │                       └──────────────────────────────────┘
                   │
                   │
                   │ PLANNED ORDER → PLANNING REQUIREMENT
                   │
                   │ PLAF.PBDNR = PBIM.PBDNR
                   ▼
        ┌──────────────────────────────────────┐
        │ PLANNING REQUIREMENT                 │
        │                                      │
        │ PBIM.PBDNR                           │
        │ PBIM.BDZEI                           │
        │ PBED.BDZEI                           │
        │                                      │
        │ PBIM.BDZEI = PBED.BDZEI              │
        └──────────────────────────────────────┘
```

---

## Table Reference Summary

| Table | Role |
|---|---|
| `AUFK` | Order master (general order data) |
| `AFKO` | Process order header |
| `AFPO` | Process order item |
| `JEST` | Object status |
| `MATDOC` / `MSEG` | Material document (consumption 261, production receipt / GRN 101) |
| `MKPF` | Material document header |
| `MCHA` | Batch master |
| `MCH1` | Client-level batch master |
| `MCHB` | Batch stock |
| `EKKO` | Purchase order header |
| `EKPO` | Purchase order item |
| `LFA1` | Supplier / vendor master |
| `EBAN` | Purchase requisition |
| `RESB` | Reservation |
| `PLAF` | Planned order |
| `PBIM` | Planning requirement (material independent requirement header) |
| `PBED` | Planning requirement (schedule line) |
