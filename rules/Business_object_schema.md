# SAP Business Object Schema Reference

**Canonical Contextual Schema Specification — Planning, Materials Management (MM), Production, Quality Management (QM), and Sales**

---

## Document Overview

This document consolidates the full set of canonical business object schemas defined for the integration/data model, spanning five functional domains:

| Domain | Objects Covered | Count |
|---|---|---|
| Planning | Planning Requirement, Planned Order | 2 |
| Materials Management (MM) | Material → Reservation | 8 |
| Production | Process Order → Production Yield/Scrap | 11 |
| Quality Management (QM) | Master Inspection Characteristic → Quality Usage Decision | 7 |
| Sales | Customer → Sales Return | 8 |
| **Total** | | **36** |

Each schema below preserves the original field-level SAP table/field mappings (e.g., `MARA-MATNR`), structured into consistent sections:

- **identity** — primary keys / natural identifiers
- **business_attributes** — core operational data
- **enriched_attributes** — human-readable / lookup-table enrichment
- **functional_attributes** — logical groupings of the object's data by function
- **context** *(where applicable)* — material-type or origin-based conditional field visibility
- **relationships** *(where applicable)* — links to related business objects
- **events** *(where applicable)* — lifecycle/event triggers and their SAP source

> **Note:** No content has been removed, summarized, or altered from the source material. All schemas are reproduced in full, verbatim JSON.

### Notation Conventions

- **`TABLE-FIELD`** — a direct SAP field mapping (e.g. `MARA-MATNR`), confirmed to exist in the source extract.
- **`TABLE: NAME (description)`** — a table-level relationship or enrichment reference (e.g. `TABLE: VBFA (document flow — table-level relationship, not a single field)`), used where the canonical model points to an entire table (document flow, movement history, shipment data, etc.) rather than one specific field. These are intentionally distinct from `TABLE-FIELD` mappings and should be resolved via joins in the relationship specification, not treated as scalar attributes.
- **Composite IDs** — standardized as `TABLE-FIELD + TABLE-FIELD [+ TABLE-FIELD ...]` (e.g. `LIPS-VBELN + LIPS-POSNR`), rather than concatenated strings, so each component field is unambiguous to a parser or relationship resolver.
- **Derived attributes** — where a canonical field referenced in earlier drafts does not exist in the source extract, the attribute is retained (never deleted) and its value is written as `Derived from <FIELD>` or `Derived canonical attribute (no direct source field in extract)`, explicitly flagging it for resolution against a controller-master, description, or enrichment source when one becomes available.

---

## Table of Contents

1. [Planning](#1-planning)
   - 1.1 [Planning Requirement](#11-planning-requirement)
   - 1.2 [Planned Order](#12-planned-order)
2. [Materials Management (MM)](#2-materials-management-mm)
   - 2.1 [Material](#21-material)
   - 2.2 [Supplier Source](#22-supplier-source)
   - 2.3 [Purchase Requisition](#23-purchase-requisition)
   - 2.4 [Purchase Order](#24-purchase-order)
   - 2.5 [Goods Receipt / GRN](#25-goods-receipt--grn)
   - 2.6 [Material Movement](#26-material-movement)
   - 2.7 [Inventory / Stock](#27-inventory--stock)
   - 2.8 [Reservation](#28-reservation)
3. [Production](#3-production)
   - 3.1 [Process Order](#31-process-order-10)
   - 3.2 [BOM — Bill of Material](#32-bom--bill-of-material-11)
   - 3.3 [Production Recipe / Routing](#33-production-recipe--routing-12)
   - 3.4 [Production Version](#34-production-version-13)
   - 3.5 [Work Center / Production Resource](#35-work-center--production-resource-14)
   - 3.6 [Batch Determination](#36-batch-determination-15)
   - 3.7 [Material Consumption](#37-material-consumption-16)
   - 3.8 [Production Confirmation](#38-production-confirmation-17)
   - 3.9 [Batch](#39-batch-18)
   - 3.10 [Batch Transformation](#310-batch-transformation-19)
   - 3.11 [Production Yield / Scrap](#311-production-yield--scrap-20)
4. [Quality Management (QM)](#4-quality-management-qm)
   - 4.1 [Master Inspection Characteristic](#41-master-inspection-characteristic-21)
   - 4.2 [Inspection Plan](#42-inspection-plan-22)
   - 4.3 [Quality Inspection Parameters](#43-quality-inspection-parameters-23)
   - 4.4 [Quality Inspection Lot](#44-quality-inspection-lot-24)
   - 4.5 [Sampling](#45-sampling-25)
   - 4.6 [Quality Inspection Result](#46-quality-inspection-result-26)
   - 4.7 [Quality Usage Decision](#47-quality-usage-decision-27)
5. [Sales](#5-sales)
   - 5.1 [Customer](#51-customer-28)
   - 5.2 [Sales Order](#52-sales-order-29)
   - 5.3 [Sales Order Item](#53-sales-order-item-30)
   - 5.4 [Sales Batch Allocation](#54-sales-batch-allocation-31)
   - 5.5 [Outbound Delivery](#55-outbound-delivery-32)
   - 5.6 [Delivery Item](#56-delivery-item-33)
   - 5.7 [Billing Document](#57-billing-document-34)
   - 5.8 [Sales Return](#58-sales-return-35)

---

## 1. Planning

### 1.1 Planning Requirement

```json
{
  "planning_requirement_id": "PBIM-BDZEI",

  "identity": {
    "requirements_plan_id": "PBIM-PBDNR",
    "requirement_pointer": "PBIM-BDZEI"
  },

  "requirement": {
    "type": "PBIM-BEDAE",
    "version": "PBIM-VERSB",
    "quantity": "PBED-PLNMG",
    "uom": "PBED-MEINS",
    "uom_name": "T006A-MSEHL",
    "requirement_date": "PBED-PDATU",
    "requested_date": "PBED-WDATU",
    "last_changed_date": "PBED-LAEDA",
    "changed_by": "PBED-AENAM",
    "consumption_indicator": "PBIM-ZUVKZ",
    "status": "Derived from PBIM/PBED-LOEVR"
  },

  "material": {
    "material_id": "PBIM-MATNR",
    "material_name": "MAKT-MAKTX",
    "material_description": "MAKT-MAKTX",
    "material_type": "MARA-MTART",
    "material_type_name": "T134T-MTBEZ",
    "material_group": "MARA-MATKL",
    "material_group_name": "T023T-WGBEZ",
    "base_uom": "MARA-MEINS",
    "base_uom_name": "T006A-MSEHL",
    "product_hierarchy": "MARA-PRDHA",
    "product_hierarchy_name": "T179T-VTEXT",
    "gtin": "MEAN-EAN11"
  },

  "plant": {
    "plant_id": "PBIM-WERKS",
    "plant_name": "T001W-NAME1",
    "country": "T005T-LANDX",
    "region": "T005U-BEZEI"
  },

  "enriched_attributes": {
    "mrp_controller": "MARC-DISPO",
    "mrp_controller_name": "Derived from MARC-DISPO"
  },

  "relationships": {
    "bom": {
      "bom_id": "MAST-STLNR",
      "alternative": "MAST-STLAL",
      "usage": "MAST-STLAN"
    },
    "planned_orders": []
  }
}
```

### 1.2 Planned Order

```json
{
  "planned_order_id": "PLAF-PLNUM",

  "order": {
    "order_type": "PLAF-PAART",
    "planned_quantity": "PLAF-GSMNG",
    "partial_lot_quantity": "PLAF-TLMNG",
    "planned_scrap_quantity": "PLAF-AVMNG",
    "requirement_quantity": "PLAF-BDMNG",
    "uom": "PLAF-MEINS",
    "firmed": "PLAF-AUFFX",
    "bom_fixed": "PLAF-STLFX"
  },

  "material": {
    "material_id": "PLAF-MATNR",
    "material_name": "MAKT-MAKTX",
    "material_description": "MAKT-MAKTX",
    "material_type": "MARA-MTART",
    "material_type_name": "T134T-MTBEZ",
    "material_group": "MARA-MATKL",
    "material_group_name": "T023T-WGBEZ",
    "base_uom": "MARA-MEINS",
    "base_uom_name": "T006A-MSEHL",
    "product_hierarchy": "MARA-PRDHA",
    "product_hierarchy_name": "T179T-VTEXT",
    "gtin": "MEAN-EAN11"
  },

  "planning": {
    "planning_plant": {
      "plant_id": "PLAF-PLWRK",
      "plant_name": "T001W-NAME1"
    },
    "mrp_controller": "PLAF-DISPO",
    "mrp_controller_name": "Derived from PLAF-DISPO"
  },

  "production": {
    "production_plant": {
      "plant_id": "PLAF-PWWRK",
      "plant_name": "T001W-NAME1"
    },
    "production_version_id": "PLAF-VERID",

    "bom": {
      "bom_id": "MAST-STLNR",
      "bom_usage": "PLAF-STLAN",
      "bom_alternative": "PLAF-STALT",
      "bom_status": "PLAF-STSTA",
      "resolution_note": "PLAF-STLAN / PLAF-STALT are the planned-order-level BOM selection parameters, not interchangeable with the BOM object's own MAST-STLAN / MAST-STLAL. They form a resolution relationship: Planned Order (PLAF-STLAN/STALT) → BOM resolution → BOM object (MAST-STLAN/STLAL → STKO/STPO, Section 3.2)."
    }
  },

  "scheduling": {
    "planned_start_date": "PLAF-PSTTR",
    "planned_finish_date": "PLAF-PEDTR",
    "opening_date": "PLAF-PERTR",
    "production_start_date": "PLAF-TERST",
    "production_finish_date": "PLAF-TERED",
    "goods_receipt_processing_days": "PLAF-WEBAZ",
    "scheduling_type": "PLAF-TRART",
    "scheduling_status": "PLAF-TRMER"
  },

  "procurement": {
    "procurement_type": "PLAF-BESKZ",
    "special_procurement_type": "PLAF-SOBES",

    "supplier": {
      "supplier_id": "PLAF-FLIEF → LFA1-LIFNR",
      "supplier_name": "LFA1-NAME1"
    },

    "purchasing_organization_id": "PLAF-EKORG",
    "purchase_agreement_id": "PLAF-KONNR",
    "purchase_agreement_item": "PLAF-KTPNR"
  },

  "storage": {
    "storage_location_id": "PLAF-LGORT",
    "storage_location_name": "T001L-LGOBE"
  },

  "relationships": {
    "planning_requirement": {
      "requirements_plan_id": "PLAF-PBDNR"
    },

    "process_order": {
      "process_order_id": "PLAF-AUFNR"
    },

    "reservation": {
      "reservation_id": "PLAF-RSNUM"
    },

    "purchase_requisition": {
      "purchase_requisition_id": "Derived relationship: PLAF → EBAN"
    }
  }
}
```

> **Relationship note:** `purchase_requisition_id` is expressed as a derived relationship (`PLAF → EBAN`) rather than a placeholder or a direct field reference — there is no single PLAF field that stores the linked purchase requisition number directly. The actual join logic (matching Planned Order to its generated Purchase Requisition) should live in the relationship specification / Relationship Resolver, not in this field-mapping schema.

---

## 2. Materials Management (MM)

The MM module contains **7 canonical objects** (Material, Supplier Source, Purchase Requisition, Purchase Order, Material Movement, Inventory/Stock, and Reservation), plus **Goods Receipt/GRN** documented alongside them below — 8 schemas in total. The procurement-before-production boundary is applied as agreed: procurement-facing objects (Supplier Source, Purchase Requisition, Purchase Order, Goods Receipt) are scoped to **ROH + VERP** contexts only, while objects that span the broader material lifecycle (Material, Material Movement, Inventory/Stock, Reservation) extend to additional material types as noted per object.

### 2.1 Material

```json
{
  "material_id": "MARA-MATNR",

  "context": {
    "context_source": "MARA-MTART",

    "material_context": {
      "ROH": "Raw Material",
      "HALB": "Semi-Finished Product",
      "FERT": "Finished Product",
      "VERP": "Packaging Material"
    },

    "context_selection": {
      "ROH": {
        "show": [
          "material_identity",
          "material_classification",
          "units",
          "batch_id",
          "plant"
        ]
      },
      "HALB": {
        "show": [
          "material_identity",
          "material_classification",
          "units",
          "batch_id",
          "plant"
        ]
      },
      "FERT": {
        "show": [
          "material_identity",
          "material_classification",
          "units",
          "batch_id",
          "plant"
        ]
      },
      "VERP": {
        "show": [
          "material_identity",
          "material_classification",
          "units",
          "batch_id",
          "plant"
        ]
      }
    }
  },

  "identity": {
    "material_id": "MARA-MATNR",
    "material_type": "MARA-MTART",
    "material_group": "MARA-MATKL",
    "material_description": "MAKT-MAKTX",
    "base_unit": "MARA-MEINS"
  },

  "business_attributes": {
    "product_hierarchy": "MARA-PRDHA",
    "batch_id": "MCHA-CHARG / MCH1-CHARG",
    "plant": "MARC-WERKS"
  },

  "enriched_attributes": {
    "material_type_name": "T134T-MTBEZ",
    "material_group_name": "T023T-WGBEZ",
    "product_hierarchy_name": "T179T-VTEXT",
    "gtin_ean": "MEAN-EAN11",

    "alternative_units": {
      "unit": "MARM-MEINH",
      "conversion_numerator": "Derived (no direct numerator field in source; MARM-MEINH is the alternative unit basis)",
      "conversion_denominator": "Derived (no direct denominator field in source; MARM-MEINH is the alternative unit basis)"
    },

    "classification": {
      "class_assignment": "KSSK",
      "characteristic_value": "AUSP",
      "characteristic_definition": "CABN"
    }
  },

  "functional_attributes": {
    "material_identity": {
      "applicable_context": ["ROH", "HALB", "FERT", "VERP"],
      "material_id": "MARA-MATNR",
      "material_type": "MARA-MTART",
      "material_description": "MAKT-MAKTX",
      "base_unit": "MARA-MEINS"
    },

    "material_classification": {
      "applicable_context": ["ROH", "HALB", "FERT", "VERP"],
      "material_group": "MARA-MATKL",
      "product_hierarchy": "MARA-PRDHA",
      "material_type": "MARA-MTART"
    },

    "units": {
      "applicable_context": ["ROH", "HALB", "FERT", "VERP"],
      "base_unit": "MARA-MEINS",
      "alternative_unit": "MARM-MEINH",
      "conversion_numerator": "Derived (no direct numerator field in source; MARM-MEINH is the alternative unit basis)",
      "conversion_denominator": "Derived (no direct denominator field in source; MARM-MEINH is the alternative unit basis)",
      "gtin_ean": "MEAN-EAN11"
    },

    "batch_id": {
      "applicable_context": ["ROH", "HALB", "FERT", "VERP"],
      "batch_id": "MCHA-CHARG / MCH1-CHARG"
    },

    "plant": {
      "applicable_context": ["ROH", "HALB", "FERT", "VERP"],
      "plant": "MARC-WERKS"
    }
  }
}
```

### 2.2 Supplier Source

*Context: ROH + VERP only*

```json
{
  "supplier_source_id": "LFA1-LIFNR",

  "context": {
    "context_source": "Material type resolved through EORD-MATNR -> MARA-MTART",

    "supplier_source_context": {
      "ROH": "Raw Material Supplier Source",
      "VERP": "Packaging Material Supplier Source"
    },

    "context_selection": {
      "ROH": {
        "show": [
          "supplier_identity",
          "supplier_contact",
          "supplier_organization",
          "material_source"
        ]
      },
      "VERP": {
        "show": [
          "supplier_identity",
          "supplier_contact",
          "supplier_organization",
          "material_source"
        ]
      }
    }
  },

  "identity": {
    "supplier_id": "LFA1-LIFNR",
    "supplier_name": "LFA1-NAME1",
    "supplier_account_group": "LFA1-KTOKK"
  },

  "business_attributes": {
    "purchasing_organization": "LFM1-EKORG",
    "company_code": "LFB1-BUKRS",
    "plant": "EORD-WERKS",
    "material_id": "EORD-MATNR",
    "source_of_supply_valid_from": "EORD-VDATU",
    "source_of_supply_valid_to": "EORD-BDATU"
  },

  "enriched_attributes": {
    "supplier_email": "ADR6-SMTP_ADDR",
    "purchasing_group": "EINE-EKGRP",
    "supplier_material_id": "EINA-IDNLF",
    "info_record": "EINA-INFNR",
    "supplier_material_price": "EINE-NETPR",
    "price_unit": "EINE-PEINH",
    "planned_delivery_time": "EINE-APLFZ"
  },

  "functional_attributes": {
    "supplier_identity": {
      "applicable_context": ["ROH", "VERP"],
      "supplier_id": "LFA1-LIFNR",
      "supplier_name": "LFA1-NAME1",
      "supplier_account_group": "LFA1-KTOKK"
    },

    "supplier_contact": {
      "applicable_context": ["ROH", "VERP"],
      "supplier_email": "ADR6-SMTP_ADDR"
    },

    "supplier_organization": {
      "applicable_context": ["ROH", "VERP"],
      "purchasing_organization": "LFM1-EKORG",
      "company_code": "LFB1-BUKRS",
      "purchasing_group": "EINE-EKGRP"
    },

    "material_source": {
      "applicable_context": ["ROH", "VERP"],
      "material_id": "EORD-MATNR",
      "plant": "EORD-WERKS",
      "supplier_material_id": "EINA-IDNLF",
      "info_record": "EINA-INFNR",
      "source_of_supply_valid_from": "EORD-VDATU",
      "source_of_supply_valid_to": "EORD-BDATU"
    }
  }
}
```

> The enrichment reference specifically supports EINA/EINE for material-supplier purchasing information and T024 for purchasing-group enrichment.

### 2.3 Purchase Requisition

*Context: ROH + VERP only*

```json
{
  "purchase_requisition_id": "EBAN-BANFN",

  "context": {
    "context_source": "EBAN-MATNR -> MARA-MTART",

    "purchase_requisition_context": {
      "ROH": "Raw Material Procurement Requirement",
      "VERP": "Packaging Material Procurement Requirement"
    },

    "context_selection": {
      "ROH": {
        "show": [
          "requisition_identity",
          "material_requirement",
          "quantity_requirement",
          "delivery_requirement",
          "procurement_assignment"
        ]
      },
      "VERP": {
        "show": [
          "requisition_identity",
          "material_requirement",
          "quantity_requirement",
          "delivery_requirement",
          "procurement_assignment"
        ]
      }
    }
  },

  "identity": {
    "purchase_requisition_id": "EBAN-BANFN",
    "item_id": "EBAN-BNFPO",
    "document_type": "EBAN-BSART"
  },

  "business_attributes": {
    "material_id": "EBAN-MATNR",
    "material_type": "MARA-MTART",
    "plant": "EBAN-WERKS",
    "quantity": "EBAN-MENGE",
    "unit": "EBAN-MEINS",
    "delivery_date": "EBAN-LFDAT",
    "purchasing_group": "EBAN-EKGRP",
    "account_assignment": "EBKN-KOSTL / EBKN-AUFNR"
  },

  "enriched_attributes": {
    "purchasing_group_name": "T024-EKNAM",
    "document_type_name": "T161T-BATXT"
  },

  "functional_attributes": {
    "requisition_identity": {
      "applicable_context": ["ROH", "VERP"],
      "purchase_requisition_id": "EBAN-BANFN",
      "item_id": "EBAN-BNFPO",
      "document_type": "EBAN-BSART"
    },

    "material_requirement": {
      "applicable_context": ["ROH", "VERP"],
      "material_id": "EBAN-MATNR",
      "material_type": "MARA-MTART",
      "plant": "EBAN-WERKS"
    },

    "quantity_requirement": {
      "applicable_context": ["ROH", "VERP"],
      "quantity": "EBAN-MENGE",
      "unit": "EBAN-MEINS"
    },

    "delivery_requirement": {
      "applicable_context": ["ROH", "VERP"],
      "delivery_date": "EBAN-LFDAT"
    },

    "procurement_assignment": {
      "applicable_context": ["ROH", "VERP"],
      "purchasing_group": "EBAN-EKGRP",
      "account_assignment": "EBKN-KOSTL / EBKN-AUFNR"
    }
  }
}
```

### 2.4 Purchase Order

*Context: ROH + VERP only*

```json
{
  "purchase_order_id": "EKKO-EBELN",

  "context": {
    "context_source": "EKPO-MATNR -> MARA-MTART",

    "purchase_order_context": {
      "ROH": "Raw Material Purchase Order",
      "VERP": "Packaging Material Purchase Order"
    },

    "context_selection": {
      "ROH": {
        "show": [
          "purchase_order_identity",
          "supplier",
          "material",
          "quantity",
          "delivery_schedule",
          "purchase_history"
        ]
      },
      "VERP": {
        "show": [
          "purchase_order_identity",
          "supplier",
          "material",
          "quantity",
          "delivery_schedule",
          "purchase_history"
        ]
      }
    }
  },

  "identity": {
    "purchase_order_id": "EKKO-EBELN",
    "item_id": "EKPO-EBELP",
    "document_type": "EKKO-BSART"
  },

  "business_attributes": {
    "supplier_id": "EKKO-LIFNR",
    "material_id": "EKPO-MATNR",
    "material_type": "MARA-MTART (resolved via EKPO-MATNR → MARA-MATNR)",
    "plant": "EKPO-WERKS",
    "storage_location": "EKPO-LGORT",
    "ordered_quantity": "EKPO-MENGE",
    "order_unit": "EKPO-MEINS",
    "net_price": "EKPO-NETPR",
    "currency": "EKKO-WAERS"
  },

  "enriched_attributes": {
    "supplier_material_id": "EINA-IDNLF",
    "purchasing_group_name": "T024-EKNAM",
    "document_type_name": "T161T-BATXT",
    "planned_delivery_time": "EINE-APLFZ"
  },

  "functional_attributes": {
    "purchase_order_identity": {
      "applicable_context": ["ROH", "VERP"],
      "purchase_order_id": "EKKO-EBELN",
      "item_id": "EKPO-EBELP",
      "document_type": "EKKO-BSART"
    },

    "supplier": {
      "applicable_context": ["ROH", "VERP"],
      "supplier_id": "EKKO-LIFNR",
      "supplier_material_id": "EINA-IDNLF"
    },

    "material": {
      "applicable_context": ["ROH", "VERP"],
      "material_id": "EKPO-MATNR",
      "material_type": "MARA-MTART (resolved via EKPO-MATNR → MARA-MATNR)",
      "plant": "EKPO-WERKS",
      "storage_location": "EKPO-LGORT"
    },

    "quantity": {
      "applicable_context": ["ROH", "VERP"],
      "ordered_quantity": "EKPO-MENGE",
      "order_unit": "EKPO-MEINS",
      "net_price": "EKPO-NETPR",
      "currency": "EKKO-WAERS"
    },

    "delivery_schedule": {
      "applicable_context": ["ROH", "VERP"],
      "planned_delivery_time": "EINE-APLFZ"
    },

    "purchase_history": {
      "applicable_context": ["ROH", "VERP"],
      "purchase_history": "TABLE: EKBE (purchase order history — table-level relationship, not a single field)"
    }
  }
}
```

> The canonical specification maps Purchase Order to EKKO, EKPO, EKET, EKBE and EKES.
>
> **Consistency note:** `material_type` is resolved via `EKPO-MATNR → MARA-MATNR → MARA-MTART` rather than treated as a direct PO attribute, for consistency with the Purchase Requisition model (Section 2.3). `EKPO-MTART` does exist in the source extract and would also be technically valid, but the resolved path keeps material typing sourced from a single authority (the Material master) across all MM procurement objects.

### 2.5 Goods Receipt / GRN

*Context: ROH + VERP only*

```json
{
  "goods_receipt_id": "MATDOC-MBLNR",

  "context": {
    "context_source": "MATDOC-MATNR -> MARA-MTART",

    "goods_receipt_context": {
      "ROH": "Raw Material Goods Receipt",
      "VERP": "Packaging Material Goods Receipt"
    },

    "context_selection": {
      "ROH": {
        "show": [
          "receipt_identity",
          "material",
          "batch",
          "quantity",
          "location",
          "reference_document"
        ]
      },
      "VERP": {
        "show": [
          "receipt_identity",
          "material",
          "batch",
          "quantity",
          "location",
          "reference_document"
        ]
      }
    }
  },

  "identity": {
    "goods_receipt_id": "MATDOC-MBLNR",
    "item_id": "MATDOC-ZEILE",
    "document_year": "MATDOC-MJAHR"
  },

  "business_attributes": {
    "movement_type": "MATDOC-BWART",
    "material_id": "MATDOC-MATNR",
    "batch_id": "MATDOC-CHARG",
    "plant": "MATDOC-WERKS",
    "storage_location": "MATDOC-LGORT",
    "quantity": "MATDOC-MENGE",
    "unit": "MATDOC-MEINS",
    "posting_date": "MATDOC-BUDAT",
    "document_date": "MATDOC-BLDAT"
  },

  "enriched_attributes": {
    "movement_type_description": "Derived from MATDOC-BWART",
    "material_document_header": "TABLE: MKPF (material document header — table-level relationship, not a single field)",
    "purchase_order_id": "MATDOC-EBELN",
    "purchase_order_item": "MATDOC-EBELP",
    "supplier_id": "LFA1-LIFNR"
  },

  "functional_attributes": {
    "receipt_identity": {
      "applicable_context": ["ROH", "VERP"],
      "goods_receipt_id": "MATDOC-MBLNR",
      "item_id": "MATDOC-ZEILE",
      "document_year": "MATDOC-MJAHR",
      "movement_type": "MATDOC-BWART"
    },

    "material": {
      "applicable_context": ["ROH", "VERP"],
      "material_id": "MATDOC-MATNR"
    },

    "batch": {
      "applicable_context": ["ROH", "VERP"],
      "batch_id": "MATDOC-CHARG"
    },

    "quantity": {
      "applicable_context": ["ROH", "VERP"],
      "quantity": "MATDOC-MENGE",
      "unit": "MATDOC-MEINS"
    },

    "location": {
      "applicable_context": ["ROH", "VERP"],
      "plant": "MATDOC-WERKS",
      "storage_location": "MATDOC-LGORT"
    },

    "reference_document": {
      "applicable_context": ["ROH", "VERP"],
      "purchase_order_id": "MATDOC-EBELN",
      "purchase_order_item": "MATDOC-EBELP",
      "supplier_id": "LFA1-LIFNR"
    }
  },

  "events": {
    "GoodsReceiptPosted": {
      "condition": "MATDOC-BWART = 101"
    }
  }
}
```

### 2.6 Material Movement

*Context: ROH + HALB + VERP only*

This is the MM object that can represent movement/transfer between plants, so it is not restricted to a single plant. The canonical source is MSEG/MATDOC/MKPF and includes `MaterialTransferred`.

```json
{
  "material_movement_id": "MATDOC-MBLNR",

  "context": {
    "context_source": "MATDOC-MATNR -> MARA-MTART",

    "material_movement_context": {
      "ROH": "Raw Material Movement",
      "HALB": "Semi-Finished Product Movement",
      "VERP": "Packaging Material Movement"
    },

    "context_selection": {
      "ROH": {
        "show": [
          "movement_identity",
          "material",
          "batch",
          "quantity",
          "source_location",
          "destination_location",
          "movement_type"
        ]
      },
      "HALB": {
        "show": [
          "movement_identity",
          "material",
          "batch",
          "quantity",
          "source_location",
          "destination_location",
          "movement_type"
        ]
      },
      "VERP": {
        "show": [
          "movement_identity",
          "material",
          "batch",
          "quantity",
          "source_location",
          "destination_location",
          "movement_type"
        ]
      }
    }
  },

  "identity": {
    "material_movement_id": "MATDOC-MBLNR",
    "item_id": "MATDOC-ZEILE",
    "document_year": "MATDOC-MJAHR"
  },

  "business_attributes": {
    "movement_type": "MATDOC-BWART",
    "material_id": "MATDOC-MATNR",
    "batch_id": "MATDOC-CHARG",
    "quantity": "MATDOC-MENGE",
    "unit": "MATDOC-MEINS",
    "posting_date": "MATDOC-BUDAT"
  },

  "enriched_attributes": {
    "movement_type_description": "Derived from MATDOC-BWART",
    "material_document_header": "TABLE: MKPF (material document header — table-level relationship, not a single field)"
  },

  "functional_attributes": {
    "movement_identity": {
      "applicable_context": ["ROH", "HALB", "VERP"],
      "material_movement_id": "MATDOC-MBLNR",
      "item_id": "MATDOC-ZEILE",
      "document_year": "MATDOC-MJAHR",
      "movement_type": "MATDOC-BWART"
    },

    "material": {
      "applicable_context": ["ROH", "HALB", "VERP"],
      "material_id": "MATDOC-MATNR"
    },

    "batch": {
      "applicable_context": ["ROH", "HALB", "VERP"],
      "batch_id": "MATDOC-CHARG"
    },

    "quantity": {
      "applicable_context": ["ROH", "HALB", "VERP"],
      "quantity": "MATDOC-MENGE",
      "unit": "MATDOC-MEINS"
    },

    "source_location": {
      "applicable_context": ["ROH", "HALB", "VERP"],
      "source_plant": "MATDOC-WERKS",
      "source_storage_location": "MATDOC-LGORT"
    },

    "destination_location": {
      "applicable_context": ["ROH", "HALB", "VERP"],
      "destination_plant": "MATDOC-UMWRK",
      "destination_storage_location": "MATDOC-UMLGO"
    },

    "movement_type": {
      "applicable_context": ["ROH", "HALB", "VERP"],
      "movement_type": "MATDOC-BWART",
      "movement_type_description": "Derived from MATDOC-BWART"
    }
  },

  "events": {
    "GoodsIssuePosted": {
      "condition": "Goods issue movement type"
    },

    "GoodsReceiptPosted": {
      "condition": "MATDOC-BWART = 101"
    },

    "MaterialTransferred": {
      "condition": "MATDOC-UMWRK or MATDOC-UMLGO is populated OR MATDOC-BWART represents a transfer movement"
    },

    "MaterialMovementReversed": {
      "condition": "Reversal movement is detected"
    }
  }
}
```

> **Important:** the source/destination plant/location fields above should be treated as MATDOC-based transfer fields only if they exist in the actual extracted MATDOC schema. The enrichment reference independently confirms that classic WM can provide source/destination bins through LTAP (VLPLA, NLPLA), but that WM layer is conditional.

### 2.7 Inventory / Stock

*Context: ROH + HALB + FERT + VERP*

```json
{
  "inventory_stock_id": "MARD-MATNR + MARD-WERKS + MARD-LGORT",

  "context": {
    "context_source": "MARD-MATNR -> MARA-MTART",

    "inventory_stock_context": {
      "ROH": "Raw Material Stock",
      "HALB": "Semi-Finished Product Stock",
      "FERT": "Finished Product Stock",
      "VERP": "Packaging Material Stock"
    },

    "context_selection": {
      "ROH": {
        "show": [
          "material_stock",
          "batch_stock",
          "plant",
          "storage_location"
        ]
      },
      "HALB": {
        "show": [
          "material_stock",
          "batch_stock",
          "plant",
          "storage_location"
        ]
      },
      "FERT": {
        "show": [
          "material_stock",
          "batch_stock",
          "plant",
          "storage_location"
        ]
      },
      "VERP": {
        "show": [
          "material_stock",
          "batch_stock",
          "plant",
          "storage_location"
        ]
      }
    }
  },

  "identity": {
    "material_id": "MARD-MATNR",
    "plant": "MARD-WERKS",
    "storage_location": "MARD-LGORT"
  },

  "business_attributes": {
    "unrestricted_stock": "MARD-LABST",
    "quality_stock": "MARD-INSME",
    "blocked_stock": "MARD-SPEME",
    "batch_id": "MCHB-CHARG",
    "batch_unrestricted_stock": "MCHB-CLABS",
    "batch_quality_stock": "MCHB-CINSM",
    "batch_blocked_stock": "MCHB-CSPEM"
  },

  "enriched_attributes": {
    "plant_name": "T001W-NAME1",
    "storage_location_name": "T001L-LGOBE"
  },

  "functional_attributes": {
    "material_stock": {
      "applicable_context": ["ROH", "HALB", "FERT", "VERP"],
      "material_id": "MARD-MATNR",
      "unrestricted_stock": "MARD-LABST",
      "quality_stock": "MARD-INSME",
      "blocked_stock": "MARD-SPEME"
    },

    "batch_stock": {
      "applicable_context": ["ROH", "HALB", "FERT", "VERP"],
      "batch_id": "MCHB-CHARG",
      "batch_unrestricted_stock": "MCHB-CLABS",
      "batch_quality_stock": "MCHB-CINSM",
      "batch_blocked_stock": "MCHB-CSPEM"
    },

    "plant": {
      "applicable_context": ["ROH", "HALB", "FERT", "VERP"],
      "plant": "MARD-WERKS",
      "plant_name": "T001W-NAME1"
    },

    "storage_location": {
      "applicable_context": ["ROH", "HALB", "FERT", "VERP"],
      "storage_location": "MARD-LGORT",
      "storage_location_name": "T001L-LGOBE"
    }
  }
}
```

### 2.8 Reservation

*Context: ROH + HALB + VERP only*

```json
{
  "reservation_id": "RKPF-RSNUM",

  "context": {
    "context_source": "RESB-MATNR -> MARA-MTART",

    "reservation_context": {
      "ROH": "Raw Material Reservation",
      "HALB": "Semi-Finished Product Reservation",
      "VERP": "Packaging Material Reservation"
    },

    "context_selection": {
      "ROH": {
        "show": [
          "reservation_identity",
          "material_requirement",
          "quantity",
          "batch",
          "requirement_date"
        ]
      },
      "HALB": {
        "show": [
          "reservation_identity",
          "material_requirement",
          "quantity",
          "batch",
          "requirement_date"
        ]
      },
      "VERP": {
        "show": [
          "reservation_identity",
          "material_requirement",
          "quantity",
          "batch",
          "requirement_date"
        ]
      }
    }
  },

  "identity": {
    "reservation_id": "RKPF-RSNUM",
    "item_id": "RESB-RSPOS"
  },

  "business_attributes": {
    "material_id": "RESB-MATNR",
    "batch_id": "RESB-CHARG",
    "plant": "RESB-WERKS",
    "storage_location": "RESB-LGORT",
    "required_quantity": "RESB-BDMNG",
    "unit": "RESB-MEINS",
    "requirement_date": "RESB-BDTER",
    "movement_type": "RESB-BWART"
  },

  "enriched_attributes": {
    "reservation_header": "TABLE: RKPF (reservation header — table-level relationship, not a single field)",
    "movement_type_description": "Derived from MATDOC-BWART"
  },

  "functional_attributes": {
    "reservation_identity": {
      "applicable_context": ["ROH", "HALB", "VERP"],
      "reservation_id": "RKPF-RSNUM",
      "item_id": "RESB-RSPOS"
    },

    "material_requirement": {
      "applicable_context": ["ROH", "HALB", "VERP"],
      "material_id": "RESB-MATNR",
      "plant": "RESB-WERKS",
      "storage_location": "RESB-LGORT"
    },

    "quantity": {
      "applicable_context": ["ROH", "HALB", "VERP"],
      "required_quantity": "RESB-BDMNG",
      "unit": "RESB-MEINS"
    },

    "batch": {
      "applicable_context": ["ROH", "HALB", "VERP"],
      "batch_id": "RESB-CHARG"
    },

    "requirement_date": {
      "applicable_context": ["ROH", "HALB", "VERP"],
      "requirement_date": "RESB-BDTER"
    }
  }
}
```

---

## 3. Production

The Production module contains **11 canonical business objects**: Process Order, BOM, Production Recipe/Routing, Production Version, Work Center/Production Resource, Batch Determination, Material Consumption, Production Confirmation, Batch, Batch Transformation, and Production Yield/Scrap. Object numbering (10–20) is preserved from the canonical source.

### 3.1 Process Order (10)

```json
{
  "process_order_id": "AUFK-AUFNR",

  "identity": {
    "process_order_id": "AUFK-AUFNR",
    "order_type": "AUFK-AUART",
    "order_category": "AUFK-AUTYP",
    "order_description": "AUFK-KTEXT"
  },

  "business_attributes": {
    "material_id": "AFPO-MATNR",
    "plant": "AFPO-PWERK",
    "planned_quantity": "AFPO-PSMNG",
    "unit": "AFPO-MEINS",
    "production_start_date": "AFKO-GSTRP",
    "production_finish_date": "AFKO-GLTRP",
    "basic_start_date": "AFKO-GSTRS",
    "basic_finish_date": "AFKO-GLTRS",
    "routing_number": "AFKO-AUFPL"
  },

  "enriched_attributes": {
    "order_status": {
      "status_code": "JEST-STAT",
      "inactive_status": "JEST-INACT"
    },
    "plant_name": "T001W-NAME1",
    "material_description": "MAKT-MAKTX"
  },

  "functional_attributes": {
    "order_identity": {
      "process_order_id": "AUFK-AUFNR",
      "order_type": "AUFK-AUART",
      "order_description": "AUFK-KTEXT"
    },

    "production_target": {
      "material_id": "AFPO-MATNR",
      "plant": "AFPO-PWERK",
      "planned_quantity": "AFPO-PSMNG",
      "unit": "AFPO-MEINS"
    },

    "production_schedule": {
      "production_start_date": "AFKO-GSTRP",
      "production_finish_date": "AFKO-GLTRP",
      "basic_start_date": "AFKO-GSTRS",
      "basic_finish_date": "AFKO-GLTRS"
    },

    "order_status": {
      "status_code": "JEST-STAT",
      "inactive_status": "JEST-INACT"
    }
  },

  "events": {
    "ProcessOrderCreated": "AUFK-AUFNR",
    "ProcessOrderReleased": "JEST-STAT",
    "ProcessOrderUpdated": "AUFK / AFKO / AFPO",
    "ProcessOrderClosed": "JEST-STAT"
  }
}
```

### 3.2 BOM — Bill of Material (11)

```json
{
  "bom_id": "STKO-STLNR",

  "identity": {
    "bom_number": "STKO-STLNR",
    "bom_usage": "MAST-STLAN",
    "alternative_bom": "STKO-STLAL",
    "material_id": "MAST-MATNR",
    "plant": "MAST-WERKS"
  },

  "business_attributes": {
    "bom_item": "STPO-STPOZ",
    "component_material_id": "STPO-IDNRK",
    "component_quantity": "STPO-MENGE",
    "component_unit": "STPO-MEINS",
    "component_scrap": "STPO-AUSCH"
  },

  "enriched_attributes": {
    "material_description": "MAKT-MAKTX",
    "component_material_description": "STPO-IDNRK → MAKT-MAKTX"
  },

  "functional_attributes": {
    "bom_identity": {
      "bom_number": "STKO-STLNR",
      "bom_usage": "MAST-STLAN",
      "alternative_bom": "STKO-STLAL"
    },

    "produced_material": {
      "material_id": "MAST-MATNR",
      "plant": "MAST-WERKS"
    },

    "bom_component": {
      "component_material_id": "STPO-IDNRK",
      "component_quantity": "STPO-MENGE",
      "component_unit": "STPO-MEINS",
      "component_scrap": "STPO-AUSCH"
    }
  },

  "events": {
    "BOMCreated": "STKO-STLNR",
    "BOMUpdated": "STKO / STPO",
    "BOMReleased": "STKO"
  }
}
```

> The canonical source defines BOM against MAST, STKO, STPO, and MARA.

### 3.3 Production Recipe / Routing (12)

```json
{
  "recipe_routing_id": "PLKO-PLNNR",

  "identity": {
    "recipe_routing_number": "PLKO-PLNNR",
    "task_list_type": "PLKO-PLNTY",
    "group_counter": "PLKO-PLNAL"
  },

  "business_attributes": {
    "material_id": "MAPL-MATNR",
    "plant": "MAPL-WERKS",
    "operation_number": "PLPO-VORNR",
    "operation_description": "PLPO-LTXA1",
    "work_center_id": "PLPO-ARBID",
    "control_key": "PLPO-STEUS",
    "operation_sequence": "PLPO-VPLFL"
  },

  "enriched_attributes": {
    "work_center_code": "CRHD-ARBPL",
    "work_center_description": "CRTX-KTEXT",
    "operation_planned_values": {
      "standard_value_1": "Derived from available AFVV operation data",
      "standard_value_2": "Derived from available AFVV operation data",
      "standard_value_3": "Derived from available AFVV operation data"
    }
  },

  "functional_attributes": {
    "recipe_identity": {
      "recipe_routing_number": "PLKO-PLNNR",
      "task_list_type": "PLKO-PLNTY",
      "group_counter": "PLKO-PLNAL"
    },

    "material_assignment": {
      "material_id": "MAPL-MATNR",
      "plant": "MAPL-WERKS"
    },

    "operation": {
      "operation_number": "PLPO-VORNR",
      "operation_description": "PLPO-LTXA1",
      "work_center_id": "PLPO-ARBID",
      "control_key": "PLPO-STEUS",
      "operation_sequence": "PLPO-VPLFL"
    }
  },

  "events": {
    "RecipeCreated": "PLKO-PLNNR",
    "RecipeUpdated": "PLKO / PLPO",
    "RecipeReleased": "PLKO"
  }
}
```

> The canonical mapping is MAPL, PLKO, PLPO, PLMK, AFVC. The enrichment reference additionally supports operation quantities/planned and actual activity information through AFVV, and operation sequence information through AFFL.

### 3.4 Production Version (13)

```json
{
  "production_version_id": "MKAL-VERID",

  "identity": {
    "production_version_id": "MKAL-VERID",
    "material_id": "MKAL-MATNR",
    "plant": "MKAL-WERKS"
  },

  "business_attributes": {
    "valid_from": "MKAL-ADATU",
    "valid_to": "MKAL-BDATU",
    "bom_usage": "MKAL-STLAN",
    "bom_alternative": "MKAL-STLAL",
    "routing_group": "MKAL-PLNNR",
    "routing_group_counter": "MKAL-ALNAL"
  },

  "enriched_attributes": {
    "material_description": "MAKT-MAKTX"
  },

  "functional_attributes": {
    "version_identity": {
      "production_version_id": "MKAL-VERID",
      "material_id": "MKAL-MATNR",
      "plant": "MKAL-WERKS"
    },

    "validity": {
      "valid_from": "MKAL-ADATU",
      "valid_to": "MKAL-BDATU"
    },

    "production_definition": {
      "bom_usage": "MKAL-STLAN",
      "bom_alternative": "MKAL-STLAL",
      "routing_group": "MKAL-PLNNR",
      "routing_group_counter": "MKAL-ALNAL"
    }
  },

  "events": {
    "ProductionVersionCreated": "MKAL-VERID",
    "ProductionVersionUpdated": "MKAL",
    "ProductionVersionReleased": "MKAL"
  }
}
```

### 3.5 Work Center / Production Resource (14)

```json
{
  "work_center_id": "CRHD-OBJID",

  "identity": {
    "work_center_id": "CRHD-OBJID",
    "work_center_code": "CRHD-ARBPL",
    "plant": "CRHD-WERKS"
  },

  "business_attributes": {
    "work_center_category": "CRHD-VERWE",
    "responsible_person": "CRHD-VERAN"
  },

  "enriched_attributes": {
    "work_center_description": "CRTX-KTEXT",
    "capacity_id": "CRCA-KAPID",
    "capacity_category": "KAKO-KAPAR",
    "capacity": "KAKO-KAPIE"
  },

  "functional_attributes": {
    "work_center_identity": {
      "work_center_id": "CRHD-OBJID",
      "work_center_code": "CRHD-ARBPL",
      "plant": "CRHD-WERKS"
    },

    "resource": {
      "work_center_category": "CRHD-VERWE",
      "responsible_person": "CRHD-VERAN"
    },

    "capacity": {
      "capacity_id": "CRCA-KAPID",
      "capacity_category": "KAKO-KAPAR",
      "capacity": "KAKO-KAPIE"
    }
  },

  "events": {
    "WorkCenterAssigned": "CRHD-OBJID",
    "WorkCenterChanged": "CRHD"
  }
}
```

> The canonical model maps Work Center / Production Resource to CRHD; the enrichment specification adds CRTX, CRCA, and KAKO for description and capacity information.

### 3.6 Batch Determination (15)

```json
{
  "batch_determination_id": "RESB-RSNUM",

  "identity": {
    "reservation_number": "RESB-RSNUM",
    "reservation_item": "RESB-RSPOS"
  },

  "business_attributes": {
    "process_order_id": "RESB-AUFNR",
    "material_id": "RESB-MATNR",
    "required_quantity": "RESB-BDMNG",
    "unit": "RESB-MEINS",
    "plant": "RESB-WERKS",
    "storage_location": "RESB-LGORT",
    "batch_id": "RESB-CHARG"
  },

  "enriched_attributes": {
    "material_description": "MAKT-MAKTX",
    "plant_name": "T001W-NAME1",
    "storage_location_name": "T001L-LGOBE"
  },

  "functional_attributes": {
    "determination": {
      "reservation_number": "RESB-RSNUM",
      "reservation_item": "RESB-RSPOS",
      "process_order_id": "RESB-AUFNR"
    },

    "component": {
      "material_id": "RESB-MATNR",
      "batch_id": "RESB-CHARG",
      "required_quantity": "RESB-BDMNG",
      "unit": "RESB-MEINS"
    },

    "location": {
      "plant": "RESB-WERKS",
      "storage_location": "RESB-LGORT"
    }
  },

  "events": {
    "BatchDetermined": "RESB-CHARG",
    "BatchAssigned": "RESB-CHARG"
  }
}
```

> The canonical model explicitly maps Batch Determination to RESB and defines `BatchDetermined` and `BatchAssigned` events.

### 3.7 Material Consumption (16)

```json
{
  "material_consumption_id": "MATDOC-MBLNR + MATDOC-ZEILE + MATDOC-MJAHR",

  "identity": {
    "material_document": "MATDOC-MBLNR",
    "material_document_item": "MATDOC-ZEILE",
    "document_year": "MATDOC-MJAHR"
  },

  "business_attributes": {
    "process_order_id": "MATDOC-AUFNR",
    "material_id": "MATDOC-MATNR",
    "batch_id": "MATDOC-CHARG",
    "plant": "MATDOC-WERKS",
    "storage_location": "MATDOC-LGORT",
    "consumed_quantity": "MATDOC-MENGE",
    "unit": "MATDOC-MEINS",
    "movement_type": "MATDOC-BWART",
    "posting_date": "MATDOC-BUDAT"
  },

  "enriched_attributes": {
    "movement_type_description": "Derived from MATDOC-BWART"
  },

  "functional_attributes": {
    "consumption_identity": {
      "material_document": "MATDOC-MBLNR",
      "material_document_item": "MATDOC-ZEILE",
      "document_year": "MATDOC-MJAHR"
    },

    "consumed_material": {
      "material_id": "MATDOC-MATNR",
      "batch_id": "MATDOC-CHARG",
      "consumed_quantity": "MATDOC-MENGE",
      "unit": "MATDOC-MEINS"
    },

    "production_reference": {
      "process_order_id": "MATDOC-AUFNR"
    },

    "movement": {
      "movement_type": "MATDOC-BWART",
      "plant": "MATDOC-WERKS",
      "storage_location": "MATDOC-LGORT",
      "posting_date": "MATDOC-BUDAT"
    }
  },

  "events": {
    "MaterialConsumptionPosted": "MATDOC-BWART = 261",
    "MaterialConsumptionAdjusted": "MATDOC-BWART = 261 with quantity adjustment",
    "MaterialConsumptionReversed": "MATDOC-BWART = 262"
  }
}
```

> The canonical specification defines Material Consumption as MSEG — Movement Type 261 with posted, adjusted, and reversed consumption events.

### 3.8 Production Confirmation (17)

```json
{
  "production_confirmation_id": "AFRU-RUECK + AFRU-RMZHL",

  "identity": {
    "confirmation_number": "AFRU-RUECK",
    "confirmation_counter": "AFRU-RMZHL",
    "operation_number": "AFVC-VORNR"
  },

  "business_attributes": {
    "process_order_id": "AFRU-AUFNR",
    "operation_number": "AFVC-VORNR",
    "confirmed_quantity": "AFRU-LMNGA",
    "confirmation_unit": "AFRU-ISM01",
    "confirmation_date": "AFRU-BUDAT",
    "work_center_id": "AFVC-ARBID"
  },

  "enriched_attributes": {
    "work_center_code": "CRHD-ARBPL",
    "work_center_description": "CRTX-KTEXT"
  },

  "functional_attributes": {
    "confirmation_identity": {
      "confirmation_number": "AFRU-RUECK",
      "confirmation_counter": "AFRU-RMZHL"
    },

    "production_reference": {
      "process_order_id": "AFRU-AUFNR",
      "operation_number": "AFVC-VORNR"
    },

    "confirmation": {
      "confirmed_quantity": "AFRU-LMNGA",
      "confirmation_date": "AFRU-BUDAT"
    },

    "production_resource": {
      "work_center_id": "AFVC-ARBID"
    }
  },

  "events": {
    "ProductionConfirmationRecorded": "AFRU-RUECK",
    "ProductionConfirmationUpdated": "AFRU-RUECK",
    "OperationCompleted": "AFVC-VORNR"
  }
}
```

> The canonical mapping is AFRU, AFVC with the three confirmation/operation events shown above.

### 3.9 Batch (18)

```json
{
  "batch_id": "MCHA-CHARG / MCH1-CHARG",

  "context": {
    "context_source": "MARA-MTART",

    "batch_context": {
      "ROH": "Raw Material Batch",
      "HALB": "Semi-Finished Batch",
      "FERT": "Finished Product Batch",
      "VERP": "Packaging Material Batch"
    },

    "context_selection": {
      "ROH": {
        "show": [
          "batch_identity",
          "batch_master",
          "batch_lifecycle",
          "classification"
        ]
      },

      "HALB": {
        "show": [
          "batch_identity",
          "batch_master",
          "batch_lifecycle",
          "classification"
        ]
      },

      "FERT": {
        "show": [
          "batch_identity",
          "batch_master",
          "batch_lifecycle",
          "classification"
        ]
      },

      "VERP": {
        "show": [
          "batch_identity",
          "batch_master",
          "batch_lifecycle",
          "classification"
        ]
      }
    }
  },

  "identity": {
    "batch_id": "MCHA-CHARG / MCH1-CHARG",
    "material_id": "MCHA-MATNR",
    "plant": "MCHA-WERKS"
  },

  "business_attributes": {
    "batch_creation_date": "MCHA-ERSDA",
    "batch_status": "MCHA-ZUSTD",
    "batch_external_id": "MCHA-LICHA",
    "production_date": "MCHA-HSDAT",
    "expiration_date": "MCHA-VFDAT"
  },

  "enriched_attributes": {
    "material_description": "MAKT-MAKTX",

    "classification": {
      "class_assignment": "KSSK",
      "characteristic_value": "AUSP",
      "characteristic_definition": "CABN",
      "characteristic_description": "CABNT"
    }
  },

  "functional_attributes": {
    "batch_identity": {
      "applicable_context": ["ROH", "HALB", "FERT", "VERP"],
      "batch_id": "MCHA-CHARG / MCH1-CHARG",
      "material_id": "MCHA-MATNR",
      "plant": "MCHA-WERKS"
    },

    "batch_master": {
      "applicable_context": ["ROH", "HALB", "FERT", "VERP"],
      "batch_external_id": "MCHA-LICHA",
      "batch_creation_date": "MCHA-ERSDA"
    },

    "batch_lifecycle": {
      "applicable_context": ["ROH", "HALB", "FERT", "VERP"],
      "batch_status": "MCHA-ZUSTD",
      "production_date": "MCHA-HSDAT",
      "expiration_date": "MCHA-VFDAT"
    },

    "classification": {
      "applicable_context": ["ROH", "HALB", "FERT", "VERP"],
      "class_assignment": "KSSK",
      "characteristic_value": "AUSP",
      "characteristic_definition": "CABN",
      "characteristic_description": "CABNT"
    }
  },

  "events": {
    "ProductionBatchCreated": "MCHA-CHARG",
    "ProductionBatchUpdated": "MCHA",
    "ProductionBatchCompleted": "Batch lifecycle completion"
  }
}
```

> The canonical specification treats Batch as batch master and transaction data and defines the three production-batch lifecycle events. The enrichment specification supports batch classification through INOB, KSSK, AUSP, CABN, CABNT, and CAWN.

### 3.10 Batch Transformation (19)

Here the context is transformation type, not material type, as specified.

```json
{
  "batch_transformation_id": "AUFK-AUFNR",

  "context": {
    "context_source": "Transformation pattern derived from AUFK, AFKO, AFPO and batch genealogy",

    "batch_transformation_context": {
      "PRODUCTION": "Simple Process Order Batch Production",
      "MERGE": "Multiple Input Batches Merged into One Output Batch",
      "SPLIT": "One Input Batch Split into Multiple Output Batches",
      "REWORK": "Existing Batch Reprocessed through a Rework Process Order"
    },

    "context_selection": {
      "PRODUCTION": {
        "show": [
          "transformation_identity",
          "input_batches",
          "output_batches",
          "process_order",
          "transformation_type"
        ]
      },

      "MERGE": {
        "show": [
          "transformation_identity",
          "input_batches",
          "output_batches",
          "process_order",
          "transformation_type"
        ]
      },

      "SPLIT": {
        "show": [
          "transformation_identity",
          "input_batches",
          "output_batches",
          "process_order",
          "transformation_type"
        ]
      },

      "REWORK": {
        "show": [
          "transformation_identity",
          "input_batches",
          "output_batches",
          "process_order",
          "transformation_type"
        ]
      }
    }
  },

  "identity": {
    "batch_transformation_id": "AUFK-AUFNR",
    "process_order_id": "AUFK-AUFNR"
  },

  "business_attributes": {
    "output_material_id": "AFPO-MATNR",
    "output_batch_id": "AFPO-CHARG",
    "plant": "AFPO-PWERK",
    "planned_quantity": "AFPO-PSMNG",
    "unit": "AFPO-MEINS",
    "production_start_date": "AFKO-GSTRP",
    "production_finish_date": "AFKO-GLTRP"
  },

  "enriched_attributes": {
    "output_material_description": "MAKT-MAKTX",
    "process_order_description": "AUFK-KTEXT"
  },

  "functional_attributes": {
    "transformation_identity": {
      "batch_transformation_id": "AUFK-AUFNR",
      "process_order_id": "AUFK-AUFNR"
    },

    "input_batches": {
      "input_batch_id": "RESB-CHARG",
      "input_material_id": "RESB-MATNR",
      "consumed_quantity": "RESB-BDMNG"
    },

    "output_batches": {
      "output_batch_id": "AFPO-CHARG",
      "output_material_id": "AFPO-MATNR",
      "planned_quantity": "AFPO-PSMNG"
    },

    "transformation_type": {
      "PRODUCTION": "Simple Process Order Batch Production",
      "MERGE": "Multiple input batches → one output batch",
      "SPLIT": "One input batch → multiple output batches",
      "REWORK": "Existing batch → rework process order → resulting batch"
    },

    "process_order": {
      "process_order_id": "AUFK-AUFNR",
      "production_start_date": "AFKO-GSTRP",
      "production_finish_date": "AFKO-GLTRP"
    }
  },

  "events": {
    "BatchTransformationCreated": "AUFK-AUFNR",
    "BatchMerged": "Multiple input batches → one output batch",
    "BatchSplit": "One input batch → multiple output batches",
    "BatchReworked": "Existing batch → rework process order → resulting batch",
    "BatchTransformationCompleted": "Process order completion"
  }
}
```

> The source explicitly defines Batch Transformation against AUFK, AFKO, AFPO and includes `BatchTransformationCreated`, `BatchMerged`, `BatchSplit`, `BatchReworked`, and `BatchTransformationCompleted`.

### 3.11 Production Yield / Scrap (20)

```json
{
  "production_yield_scrap_id": "MATDOC-MBLNR + MATDOC-ZEILE + MATDOC-MJAHR",

  "identity": {
    "material_document": "MATDOC-MBLNR",
    "material_document_item": "MATDOC-ZEILE",
    "document_year": "MATDOC-MJAHR"
  },

  "business_attributes": {
    "process_order_id": "MATDOC-AUFNR",
    "material_id": "MATDOC-MATNR",
    "batch_id": "MATDOC-CHARG",
    "plant": "MATDOC-WERKS",
    "quantity": "MATDOC-MENGE",
    "unit": "MATDOC-MEINS",
    "movement_type": "MATDOC-BWART",
    "posting_date": "MATDOC-BUDAT"
  },

  "enriched_attributes": {
    "movement_type_description": "Derived from MATDOC-BWART"
  },

  "functional_attributes": {
    "yield_identity": {
      "material_document": "MATDOC-MBLNR",
      "material_document_item": "MATDOC-ZEILE",
      "document_year": "MATDOC-MJAHR"
    },

    "production_reference": {
      "process_order_id": "MATDOC-AUFNR"
    },

    "output": {
      "material_id": "MATDOC-MATNR",
      "batch_id": "MATDOC-CHARG",
      "quantity": "MATDOC-MENGE",
      "unit": "MATDOC-MEINS"
    },

    "production_location": {
      "plant": "MATDOC-WERKS"
    },

    "movement": {
      "movement_type": "MATDOC-BWART",
      "posting_date": "MATDOC-BUDAT"
    }
  },

  "events": {
    "YieldRecorded": "MATDOC-BWART = 101",
    "YieldAdjusted": "Production output quantity adjusted"
  }
}
```

---

## 4. Quality Management (QM)

The QM module contains **7 canonical business objects**: Master Inspection Characteristic, Inspection Plan, Quality Inspection Parameters, Quality Inspection Lot, Sampling, Quality Inspection Result, and Quality Usage Decision. Object numbering (21–27) is preserved from the canonical source.

As agreed, **only Quality Inspection Lot has context**. The context represents the inspection origin: `GOODS_RECEIPT | PRODUCTION | STOCK_TRANSFER | OTHER`. No `relationships` block is included in this module.

### 4.1 Master Inspection Characteristic (21)

```json
{
  "inspection_characteristic_id": "QPMK-MKMNR",

  "identity": {
    "inspection_characteristic_id": "QPMK-MKMNR",
    "characteristic_number": "QPMK-MKMNR",
    "characteristic_version": "QPMK-VERSION"
  },

  "business_attributes": {
    "characteristic_name": "QPMK-CHARACT_ID1",
    "characteristic_type": "Derived canonical attribute (no direct source field in extract)",
    "unit_of_measure": "QPMK-MASSEINHSW",
    "target_value": "QPMK-SOLLWERT",
    "lower_tolerance": "QPMK-TOLERANZUN",
    "upper_tolerance": "QPMK-TOLERANZOB",
    "quantitative_indicator": "QPMK-CHARACT_ID1",
    "qualitative_indicator": "Derived canonical attribute (no direct source field in extract)"
  },

  "enriched_attributes": {
    "unit_description": "T006A-MSEHL",
    "allowed_values": {
      "value": "CAWN-ATWRT",
      "value_description": "CAWNT-ATWTB"
    }
  },

  "functional_attributes": {
    "characteristic_definition": {
      "characteristic_number": "QPMK-MKMNR",
      "characteristic_name": "QPMK-CHARACT_ID1",
      "characteristic_type": "Derived canonical attribute (no direct source field in extract)"
    },

    "measurement_definition": {
      "unit_of_measure": "QPMK-MASSEINHSW",
      "target_value": "QPMK-SOLLWERT",
      "lower_tolerance": "QPMK-TOLERANZUN",
      "upper_tolerance": "QPMK-TOLERANZOB"
    },

    "evaluation_definition": {
      "quantitative_indicator": "QPMK-CHARACT_ID1",
      "qualitative_indicator": "Derived canonical attribute (no direct source field in extract)"
    }
  },

  "events": {
    "InspectionCharacteristicCreated": "QPMK",
    "InspectionCharacteristicChanged": "QPMK"
  }
}
```

> The canonical source maps this object to QPMK and defines the two characteristic lifecycle events.

### 4.2 Inspection Plan (22)

```json
{
  "inspection_plan_id": "PLKO-PLNNR",

  "identity": {
    "inspection_plan_id": "PLKO-PLNNR",
    "task_list_type": "PLKO-PLNTY",
    "group_counter": "PLKO-PLNAL"
  },

  "business_attributes": {
    "material_id": "MAPL-MATNR",
    "plant": "MAPL-WERKS",
    "operation_number": "PLPO-VORNR",
    "operation_description": "PLPO-LTXA1",
    "work_center_id": "PLPO-ARBID",
    "control_key": "PLPO-STEUS",
    "inspection_characteristic_number": "PLMK-MERKNR"
  },

  "enriched_attributes": {
    "material_description": "MAKT-MAKTX",
    "work_center_code": "CRHD-ARBPL",
    "work_center_description": "CRTX-KTEXT"
  },

  "functional_attributes": {
    "plan_identity": {
      "inspection_plan_id": "PLKO-PLNNR",
      "task_list_type": "PLKO-PLNTY",
      "group_counter": "PLKO-PLNAL"
    },

    "material_assignment": {
      "material_id": "MAPL-MATNR",
      "plant": "MAPL-WERKS"
    },

    "inspection_operation": {
      "operation_number": "PLPO-VORNR",
      "operation_description": "PLPO-LTXA1",
      "work_center_id": "PLPO-ARBID",
      "control_key": "PLPO-STEUS"
    },

    "inspection_characteristic": {
      "characteristic_number": "PLMK-MERKNR"
    }
  },

  "events": {
    "InspectionPlanCreated": "PLKO-PLNNR",
    "InspectionPlanChanged": "PLKO / PLPO / PLMK / MAPL"
  }
}
```

> The canonical mapping is PLKO, PLPO, PLMK, MAPL.

### 4.3 Quality Inspection Parameters (23)

```json
{
  "inspection_parameter_id": "QMAT-MATNR + QMAT-WERKS + QMAT-ART",

  "identity": {
    "inspection_parameter_id": "QMAT-MATNR + QMAT-WERKS + QMAT-ART",
    "material_id": "QMAT-MATNR"
  },

  "business_attributes": {
    "material_id": "QMAT-MATNR",
    "plant": "QMAT-WERKS",
    "inspection_type": "QMAT-ART",
    "inspection_setup_status": "QMAT-AKTIV",
    "inspection_parameter": "TABLE: QINF (quality info record — table-level relationship, not a single field)"
  },

  "enriched_attributes": {
    "material_description": "MAKT-MAKTX",
    "plant_name": "T001W-NAME1",
    "inspection_type_description": "Inspection type configuration"
  },

  "functional_attributes": {
    "parameter_identity": {
      "material_id": "QMAT-MATNR",
      "plant": "QMAT-WERKS",
      "inspection_type": "QMAT-ART"
    },

    "inspection_setup": {
      "inspection_setup_status": "QMAT-AKTIV"
    },

    "quality_information": {
      "quality_information_record": "TABLE: QINF (quality info record — table-level relationship, not a single field)"
    }
  },

  "events": {
    "InspectionParameterAssigned": "QMAT / QINF",
    "InspectionParameterChanged": "QMAT / QINF"
  }
}
```

> The canonical model maps Quality Inspection Parameters to QMAT and QINF, with assignment/change events.

### 4.4 Quality Inspection Lot (24)

*This is the only QM object with context.*

The context identifies why the inspection lot exists.

```json
{
  "inspection_lot_id": "QALS-PRUEFLOS",

  "context": {
    "context_source": "QALS inspection lot origin",

    "inspection_lot_origin": {
      "GOODS_RECEIPT": "Inspection triggered by Goods Receipt",
      "PRODUCTION": "Inspection triggered by Production",
      "STOCK_TRANSFER": "Inspection triggered by Stock Transfer",
      "OTHER": "Other inspection origin"
    },

    "context_selection": {
      "GOODS_RECEIPT": {
        "show": [
          "inspection_lot_identity",
          "material",
          "batch",
          "inspection_origin",
          "inspection_quantity",
          "inspection_status"
        ]
      },

      "PRODUCTION": {
        "show": [
          "inspection_lot_identity",
          "material",
          "batch",
          "inspection_origin",
          "process_order",
          "inspection_quantity",
          "inspection_status"
        ]
      },

      "STOCK_TRANSFER": {
        "show": [
          "inspection_lot_identity",
          "material",
          "batch",
          "inspection_origin",
          "plant",
          "inspection_quantity",
          "inspection_status"
        ]
      },

      "OTHER": {
        "show": [
          "inspection_lot_identity",
          "material",
          "batch",
          "inspection_origin",
          "inspection_quantity",
          "inspection_status"
        ]
      }
    }
  },

  "identity": {
    "inspection_lot_id": "QALS-PRUEFLOS",
    "inspection_type": "QALS-ART",
    "inspection_origin": "QALS-HERKUNFT"
  },

  "business_attributes": {
    "material_id": "QALS-MATNR",
    "plant": "QALS-WERK",
    "batch_id": "QALS-CHARG",
    "inspection_quantity": "QALS-LOSMENGE",
    "unit": "QALS-MENGENEINH",
    "inspection_start_date": "QALS-PASTRTERM",
    "inspection_end_date": "QALS-PAENDTERM",
    "process_order_id": "QALS-AUFNR",
    "purchase_order_id": "QALS-EBELN",
    "purchase_order_item": "QALS-EBELP",
    "supplier_id": "QALS-LIFNR"
  },

  "enriched_attributes": {
    "material_description": "MAKT-MAKTX",
    "plant_name": "T001W-NAME1",
    "inspection_type_description": "Inspection type master/configuration",
    "batch_description": "MCHA / MCH1",
    "inspection_status": "QAST"
  },

  "functional_attributes": {
    "inspection_lot_identity": {
      "inspection_lot_id": "QALS-PRUEFLOS",
      "inspection_type": "QALS-ART",
      "inspection_origin": "QALS-HERKUNFT"
    },

    "material": {
      "material_id": "QALS-MATNR",
      "batch_id": "QALS-CHARG",
      "plant": "QALS-WERK"
    },

    "inspection_quantity": {
      "quantity": "QALS-LOSMENGE",
      "unit": "QALS-MENGENEINH"
    },

    "inspection_period": {
      "inspection_start_date": "QALS-PASTRTERM",
      "inspection_end_date": "QALS-PAENDTERM"
    },

    "source_document": {
      "process_order_id": "QALS-AUFNR",
      "purchase_order_id": "QALS-EBELN",
      "purchase_order_item": "QALS-EBELP",
      "supplier_id": "QALS-LIFNR"
    },

    "inspection_status": {
      "status": "QAST"
    }
  },

  "events": {
    "InspectionLotCreated": "QALS-PRUEFLOS",
    "InspectionStarted": "QALS-PASTRTERM",
    "InspectionCompleted": "QALS-PAENDTERM",
    "InspectionLotStatusChanged": "QAST"
  }
}
```

> The canonical specification explicitly maps the Inspection Lot to QALS, QAMB, QAST and defines its four lifecycle events.
>
> **Optional timestamp enrichment:** for exact start/end timestamps (not just calendar dates), the canonical inspection period can additionally be composed as `QALS-PASTRTERM + QALS-PASTRZEIT` (start date + time) and `QALS-PAENDTERM + QALS-PAENDZEIT` (end date + time).

**Context interpretation**

```
Quality Inspection Lot
│
├── GOODS_RECEIPT
│     └── Material received → Inspection Lot
│
├── PRODUCTION
│     └── Process Order / Production → Inspection Lot
│
├── STOCK_TRANSFER
│     └── Plant/stock transfer → Inspection Lot
│
└── OTHER
      └── Other SAP inspection origin
```

The context therefore does not duplicate Goods Receipt, Process Order, or Material Movement. It simply tells the Context Resolver which business origin caused the Quality Inspection Lot.

### 4.5 Sampling (25)

```json
{
  "sampling_id": "QALS-PRUEFLOS + QASE-PROBENR",

  "identity": {
    "sampling_id": "QALS-PRUEFLOS + QASE-PROBENR",
    "inspection_lot_id": "QALS-PRUEFLOS"
  },

  "business_attributes": {
    "inspection_lot_id": "QALS-PRUEFLOS",
    "sample_number": "QASE-PROBENR",
    "sample_item_number": "QASE-STUECKNR",
    "sample_quantity": "To be validated against QASE/QASR extract (no explicit quantity field confirmed)",
    "sample_unit": "To be validated against QASE/QASR extract (no explicit unit field confirmed)",
    "sample_status": "To be validated against QASE/QASR extract (no explicit status field confirmed)",
    "measured_value": "QASE-MESSWERT"
  },

  "enriched_attributes": {
    "material_id": "QALS-MATNR",
    "batch_id": "QALS-CHARG",
    "material_description": "MAKT-MAKTX",
    "plant_name": "T001W-NAME1"
  },

  "functional_attributes": {
    "sampling_identity": {
      "inspection_lot_id": "QALS-PRUEFLOS",
      "sample_number": "QASE-PROBENR",
      "sample_item_number": "QASE-STUECKNR"
    },

    "sample": {
      "sample_quantity": "To be validated against QASE/QASR extract (no explicit quantity field confirmed)",
      "sample_unit": "To be validated against QASE/QASR extract (no explicit unit field confirmed)",
      "measured_value": "QASE-MESSWERT"
    },

    "sample_lifecycle": {
      "sample_status": "To be validated against QASE/QASR extract (no explicit status field confirmed)"
    }
  },

  "events": {
    "SampleCreated": "QALS / QAMR / QASR",
    "SampleCollected": "QAMR / QASR",
    "SampleUpdated": "QAMR / QASR",
    "SampleCompleted": "QAMR / QASR"
  }
}
```

> The canonical source for Sampling is QALS, QAMR, QASR, with four sampling events. Sample-level identity and measured-value fields (`QASE-PROBENR`, `QASE-STUECKNR`, `QASE-ESTUECKNR`, `QASE-MESSWERT`) are drawn from the QASE extract; quantity, unit, and status fields require validation against the actual QASE/QASR extract before production use.

### 4.6 Quality Inspection Result (26)

```json
{
  "inspection_result_id": {
    "QAMR": "QAMR-PRUEFLOS + QAMR-MERKNR + QAMR-VORGLFNR",
    "QAMV": "QAMV-PRUEFLOS + QAMV-MERKNR + QAMV-VORGLFNR",
    "QASE": "QASE-PRUEFLOS + QASE-PROBENR + QASE-VORGLFNR"
  },

  "identity": {
    "inspection_result_id": {
      "QAMR": "QAMR-PRUEFLOS + QAMR-MERKNR + QAMR-VORGLFNR",
      "QAMV": "QAMV-PRUEFLOS + QAMV-MERKNR + QAMV-VORGLFNR",
      "QASE": "QASE-PRUEFLOS + QASE-PROBENR + QASE-VORGLFNR"
    },
    "inspection_lot_id": "QAMR-PRUEFLOS",
    "inspection_characteristic_number": "QAMR-MERKNR"
  },

  "business_attributes": {
    "inspection_lot_id": "QAMR-PRUEFLOS",
    "characteristic_number": "QAMR-MERKNR",
    "sample_number": "QASE-PROBENR",
    "measured_value": "QASE-MESSWERT",
    "measured_unit": "QAMV-MASSEINHSW",
    "target_value": "QAMV-SOLLWERT",
    "lower_limit": "QAMV-TOLERANZUN",
    "upper_limit": "QAMV-TOLERANZOB",
    "result_status": "QASE (sample-level pass/fail result — exact field to be validated against extract)",
    "result_code": "QAMR (summarized/statistical evaluation — exact field to be validated against extract)"
  },

  "enriched_attributes": {
    "material_id": "QALS-MATNR",
    "batch_id": "QALS-CHARG",
    "material_description": "MAKT-MAKTX",
    "characteristic_description": "QPMK-CHARACT_ID1"
  },

  "functional_attributes": {
    "result_identity": {
      "inspection_lot_id": "QAMR-PRUEFLOS",
      "characteristic_number": "QAMR-MERKNR",
      "sample_number": "QASE-PROBENR"
    },

    "measurement": {
      "measured_value": "QASE-MESSWERT",
      "measured_unit": "QAMV-MASSEINHSW"
    },

    "acceptance_criteria": {
      "target_value": "QAMV-SOLLWERT",
      "lower_limit": "QAMV-TOLERANZUN",
      "upper_limit": "QAMV-TOLERANZOB"
    },

    "evaluation": {
      "result_status": "QASE (sample-level pass/fail result — exact field to be validated against extract)",
      "result_code": "QAMR (summarized/statistical evaluation — exact field to be validated against extract)"
    }
  },

  "events": {
    "InspectionResultRecorded": "QAMR / QAMV / QASE / QASR",
    "InspectionResultChanged": "QAMR / QAMV / QASE / QASR"
  }
}
```

> The canonical mapping is QAMR, QAMV, QASE, QASR, with `InspectionResultRecorded` and `InspectionResultChanged`.
>
> **Revised result model** (aligned to the actual extract):
> ```
> QAMV
>  ├── characteristic specification
>  ├── target value
>  ├── unit
>  └── tolerance limits
>
> QASE
>  ├── sample number
>  ├── measured value
>  └── sample-level result
>
> QAMR
>  ├── summarized/statistical result
>  ├── minimum
>  ├── maximum
>  ├── mean
>  ├── variance
>  └── evaluation
> ```
> This distinguishes the characteristic specification (QAMV), the individual sample measurement (QASE), and the aggregated statistical result (QAMR) — a more accurate reflection of the quality genealogy than the prior flat mapping.

### 4.7 Quality Usage Decision (27)

```json
{
  "quality_usage_decision_id": "QAVE-PRUEFLOS",

  "identity": {
    "quality_usage_decision_id": "QAVE-PRUEFLOS",
    "inspection_lot_id": "QAVE-PRUEFLOS"
  },

  "business_attributes": {
    "inspection_lot_id": "QAVE-PRUEFLOS",
    "usage_decision_code": "QAVE-VCODE",
    "usage_decision_group": "QAVE-VCODEGRP",
    "decision_date": "QAVE-VDATUM",
    "decision_time": "QAVE-VEZEITAEN",
    "decision_by": "QAVE-VNAME",
    "decision_text": "Derived from QAVE-VCODE / QAVE-VCODEGRP"
  },

  "enriched_attributes": {
    "inspection_lot_status": "QALS / QAST",
    "material_id": "QALS-MATNR",
    "batch_id": "QALS-CHARG",
    "material_description": "MAKT-MAKTX"
  },

  "functional_attributes": {
    "decision_identity": {
      "quality_usage_decision_id": "QAVE-PRUEFLOS",
      "inspection_lot_id": "QAVE-PRUEFLOS"
    },

    "decision": {
      "usage_decision_code": "QAVE-VCODE",
      "usage_decision_group": "QAVE-VCODEGRP",
      "decision_text": "Derived from QAVE-VCODE / QAVE-VCODEGRP"
    },

    "decision_audit": {
      "decision_date": "QAVE-VDATUM",
      "decision_time": "QAVE-VEZEITAEN",
      "decision_by": "QAVE-VNAME"
    }
  },

  "events": {
    "QualityDecisionRecorded": "QAVE",
    "QualityDecisionChanged": "QAVE"
  }
}
```

---

## 5. Sales

The Sales module defines **8 canonical objects** — Customer, Sales Order, Sales Order Item, Sales Batch Allocation, Outbound Delivery, Delivery Item, Billing Document, and Sales Return. Object numbering (28–35) is preserved from the canonical source.

Structure conventions for this module:
- User-oriented field names
- Every canonical ID has an explicit SAP table + field reference
- `business_attributes` = operational business data
- `enriched_attributes` = human-readable / contextual enrichment
- `functional_attributes` = what the object actually does
- `events` = event trigger/reference
- No `relationships` block
- No unnecessary `context` block for Sales objects

> **Note:** The canonical source establishes the object/table/event mappings, while the enrichment reference only explicitly documents some Sales enrichment tables such as KNMT, T077X, TVKO, TVKOT, TVTW, TVTWT, TSPAT, T685, T685T, T683, and T683T. Enrichment mappings not explicitly documented in the enrichment reference should be validated against the actual SAP extract before production implementation.

### 5.1 Customer (28)

```json
{
  "customer_id": "KNA1-KUNNR",

  "identity": {
    "customer_id": "KNA1-KUNNR",
    "customer_account_group": "KNA1-KTOKD",
    "customer_name": "KNA1-NAME1"
  },

  "business_attributes": {
    "customer_name": "KNA1-NAME1",
    "customer_name_2": "KNA1-NAME2",
    "country": "KNA1-LAND1",
    "region": "KNA1-REGIO",
    "city": "KNA1-ORT01",
    "postal_code": "KNA1-PSTLZ",
    "address_id": "KNA1-ADRNR",
    "sales_organization": "KNVV-VKORG",
    "distribution_channel": "KNVV-VTWEG",
    "division": "KNVV-SPART",
    "customer_group": "KNVV-KDGRP"
  },

  "enriched_attributes": {
    "customer_account_group_name": "T077X-TXT30",
    "sales_organization_name": "TVKOT-VTEXT",
    "distribution_channel_name": "TVTWT-VTEXT",
    "division_name": "TSPAT-VTEXT",
    "email": "ADR6-SMTP_ADDR"
  },

  "functional_attributes": {
    "customer_identity": {
      "customer_id": "KNA1-KUNNR",
      "customer_name": "KNA1-NAME1",
      "customer_account_group": "KNA1-KTOKD"
    },

    "customer_address": {
      "country": "KNA1-LAND1",
      "region": "KNA1-REGIO",
      "city": "KNA1-ORT01",
      "postal_code": "KNA1-PSTLZ",
      "address_id": "KNA1-ADRNR"
    },

    "sales_area": {
      "sales_organization": "KNVV-VKORG",
      "distribution_channel": "KNVV-VTWEG",
      "division": "KNVV-SPART"
    },

    "customer_classification": {
      "customer_group": "KNVV-KDGRP"
    },

    "customer_contact": {
      "email": "ADR6-SMTP_ADDR"
    }
  },

  "events": {
    "CustomerCreated": "KNA1-KUNNR",
    "CustomerUpdated": "KNA1 / KNVV / KNVP / ADR6",
    "CustomerBlocked": "KNA1 / KNVV customer block status",
    "CustomerUnblocked": "KNA1 / KNVV customer block status"
  }
}
```

> The enrichment reference specifically supports customer account-group, sales-organization, distribution-channel, division, and customer-material enrichment.

### 5.2 Sales Order (29)

```json
{
  "sales_order_id": "VBAK-VBELN",

  "identity": {
    "sales_order_id": "VBAK-VBELN",
    "sales_document_type": "VBAK-AUART",
    "sales_organization": "VBAK-VKORG",
    "distribution_channel": "VBAK-VTWEG",
    "division": "VBAK-SPART"
  },

  "business_attributes": {
    "customer_id": "VBAK-KUNNR",
    "order_date": "VBAK-AUDAT",
    "requested_delivery_date": "VBAK-VDATU",
    "sales_organization": "VBAK-VKORG",
    "distribution_channel": "VBAK-VTWEG",
    "division": "VBAK-SPART",
    "customer_reference": "VBAK-BSTNK",
    "currency": "VBAK-WAERK",
    "overall_status": "VBUK-GBSTK"
  },

  "enriched_attributes": {
    "sales_organization_name": "TVKOT-VTEXT",
    "distribution_channel_name": "TVTWT-VTEXT",
    "division_name": "TSPAT-VTEXT",
    "sales_document_flow": "TABLE: VBFA (document flow — table-level relationship, not a single field)",
    "pricing_procedure": "VBAK-KALSM"
  },

  "functional_attributes": {
    "order_identity": {
      "sales_order_id": "VBAK-VBELN",
      "sales_document_type": "VBAK-AUART"
    },

    "customer_reference": {
      "customer_id": "VBAK-KUNNR",
      "customer_reference": "VBAK-BSTNK"
    },

    "sales_area": {
      "sales_organization": "VBAK-VKORG",
      "distribution_channel": "VBAK-VTWEG",
      "division": "VBAK-SPART"
    },

    "order_dates": {
      "order_date": "VBAK-AUDAT",
      "requested_delivery_date": "VBAK-VDATU"
    },

    "order_status": {
      "overall_status": "VBUK-GBSTK"
    },

    "document_flow": {
      "document_relationship": "TABLE: VBFA (document flow — table-level relationship, not a single field)"
    }
  },

  "events": {
    "SalesOrderCreated": "VBAK-VBELN",
    "SalesOrderChanged": "VBAK",
    "SalesOrderConfirmed": "VBUK",
    "SalesOrderCancelled": "VBUK / VBFA",
    "SalesOrderCompleted": "VBUK-GBSTK"
  }
}
```

### 5.3 Sales Order Item (30)

```json
{
  "sales_order_item_id": "VBAP-VBELN + VBAP-POSNR",

  "identity": {
    "sales_order_id": "VBAP-VBELN",
    "sales_order_item_id": "VBAP-VBELN + VBAP-POSNR",
    "item_number": "VBAP-POSNR"
  },

  "business_attributes": {
    "material_id": "VBAP-MATNR",
    "ordered_quantity": "VBAP-KWMENG",
    "sales_unit": "VBAP-VRKME",
    "plant": "VBAP-WERKS",
    "storage_location": "VBAP-LGORT",
    "requested_delivery_date": "VBAP-VDATU_ANA",
    "item_category": "VBAP-PSTYV",
    "customer_id": "VBAK-KUNNR",
    "net_value": "VBAP-NETWR",
    "currency": "VBAK-WAERK",
    "item_status": "VBUP-GBSTA"
  },

  "enriched_attributes": {
    "material_description": "MAKT-MAKTX",
    "customer_material_id": "KNMT-KDMAT",
    "sales_organization_name": "TVKOT-VTEXT",
    "distribution_channel_name": "TVTWT-VTEXT",
    "division_name": "TSPAT-VTEXT",
    "document_flow": "TABLE: VBFA (document flow — table-level relationship, not a single field)"
  },

  "functional_attributes": {
    "item_identity": {
      "sales_order_id": "VBAP-VBELN",
      "item_number": "VBAP-POSNR"
    },

    "material": {
      "material_id": "VBAP-MATNR",
      "material_description": "MAKT-MAKTX"
    },

    "order_quantity": {
      "ordered_quantity": "VBAP-KWMENG",
      "sales_unit": "VBAP-VRKME"
    },

    "delivery": {
      "plant": "VBAP-WERKS",
      "storage_location": "VBAP-LGORT",
      "requested_delivery_date": "VBAP-VDATU_ANA"
    },

    "item_status": {
      "item_status": "VBUP-GBSTA"
    },

    "customer_material": {
      "customer_material_id": "KNMT-KDMAT"
    }
  },

  "events": {
    "SalesOrderItemAdded": "VBAP-VBELN + VBAP-POSNR",
    "QuantityChanged": "VBAP-KWMENG",
    "DeliveryDateChanged": "VBAP-VDATU_ANA",
    "ItemConfirmed": "VBUP-GBSTA",
    "ItemCancelled": "VBAP / VBUP"
  }
}
```

> The KNMT enrichment is particularly useful here because the enrichment specification explicitly identifies it as the customer-material information record mapping SAP material to the customer's material number.

### 5.4 Sales Batch Allocation (31)

```json
{
  "sales_batch_allocation_id": "LIPS-VBELN + LIPS-POSNR + MATDOC-MBLNR + MATDOC-ZEILE + MATDOC-MJAHR",

  "identity": {
    "sales_batch_allocation_id": "LIPS-VBELN + LIPS-POSNR + MATDOC-MBLNR + MATDOC-ZEILE + MATDOC-MJAHR",
    "delivery_id": "LIPS-VBELN",
    "delivery_item_id": "LIPS-VBELN + LIPS-POSNR",
    "batch_id": "LIPS-CHARG"
  },

  "business_attributes": {
    "material_id": "LIPS-MATNR",
    "batch_id": "LIPS-CHARG",
    "delivery_id": "LIPS-VBELN",
    "delivery_item": "LIPS-POSNR",
    "allocated_quantity": "LIPS-LFIMG",
    "delivery_unit": "LIPS-VRKME",
    "plant": "LIPS-WERKS",
    "storage_location": "LIPS-LGORT"
  },

  "enriched_attributes": {
    "batch_creation_date": "MCHA-ERSDA",
    "batch_production_date": "MCHA-HSDAT",
    "batch_expiration_date": "MCHA-VFDAT",
    "batch_external_id": "MCHA-LICHA",
    "batch_stock": "TABLE: MCHB (batch stock quantities — table-level relationship, not a single field)",
    "material_description": "MAKT-MAKTX",
    "material_document": "TABLE: MSEG / MATDOC (material movement document — table-level relationship, not a single field)"
  },

  "functional_attributes": {
    "allocation_identity": {
      "delivery_id": "LIPS-VBELN",
      "delivery_item_id": "LIPS-VBELN + LIPS-POSNR",
      "batch_id": "LIPS-CHARG"
    },

    "material": {
      "material_id": "LIPS-MATNR",
      "batch_id": "LIPS-CHARG"
    },

    "allocation": {
      "allocated_quantity": "LIPS-LFIMG",
      "delivery_unit": "LIPS-VRKME"
    },

    "inventory_reference": {
      "plant": "LIPS-WERKS",
      "storage_location": "LIPS-LGORT",
      "batch_stock": "TABLE: MCHB (batch stock quantities — table-level relationship, not a single field)"
    },

    "batch_information": {
      "batch_creation_date": "MCHA-ERSDA",
      "batch_production_date": "MCHA-HSDAT",
      "batch_expiration_date": "MCHA-VFDAT"
    }
  },

  "events": {
    "BatchAllocated": "LIPS-CHARG",
    "BatchAllocationChanged": "LIPS-CHARG / LIPS-LFIMG",
    "BatchDeallocated": "LIPS-CHARG cleared or allocation reversed",
    "BatchAllocationConfirmed": "LIPS-CHARG + delivery processing status"
  }
}
```

> This is the object that connects the finished batch genealogy to the downstream sales fulfillment chain.

### 5.5 Outbound Delivery (32)

```json
{
  "outbound_delivery_id": "LIKP-VBELN",

  "identity": {
    "outbound_delivery_id": "LIKP-VBELN",
    "delivery_type": "LIKP-LFART",
    "shipping_point": "LIKP-VSTEL"
  },

  "business_attributes": {
    "customer_id": "LIKP-KUNNR",
    "delivery_date": "LIKP-LFDAT",
    "planned_goods_issue_date": "LIKP-WADAT",
    "actual_goods_issue_date": "LIKP-WADAT_IST",
    "shipping_point": "LIKP-VSTEL",
    "route": "LIKP-ROUTE",
    "delivery_status": "LIKP-GBSTK",
    "overall_picking_status": "LIKP-KOSTK",
    "overall_goods_movement_status": "LIKP-WBSTK"
  },

  "enriched_attributes": {
    "sales_order_reference": "TABLE: VBFA (document flow — table-level relationship, not a single field)",
    "shipping_point_description": "Derived from LIKP-VSTEL",
    "shipment_id": "VTTK-TKNUM",
    "shipment_status": "TABLE: VTTK (shipment header — table-level relationship, not a single field)",
    "shipment_stage": "TABLE: VTTP (shipment stage — table-level relationship, not a single field)"
  },

  "functional_attributes": {
    "delivery_identity": {
      "outbound_delivery_id": "LIKP-VBELN",
      "delivery_type": "LIKP-LFART"
    },

    "customer": {
      "customer_id": "LIKP-KUNNR"
    },

    "delivery_schedule": {
      "delivery_date": "LIKP-LFDAT",
      "planned_goods_issue_date": "LIKP-WADAT",
      "actual_goods_issue_date": "LIKP-WADAT_IST"
    },

    "shipping": {
      "shipping_point": "LIKP-VSTEL",
      "route": "LIKP-ROUTE"
    },

    "execution_status": {
      "delivery_status": "LIKP-GBSTK",
      "picking_status": "LIKP-KOSTK",
      "goods_movement_status": "LIKP-WBSTK"
    },

    "transport": {
      "shipment_id": "VTTK-TKNUM",
      "shipment_stage": "TABLE: VTTP (shipment stage — table-level relationship, not a single field)"
    }
  },

  "events": {
    "DeliveryCreated": "LIKP-VBELN",
    "DeliveryChanged": "LIKP",
    "DeliveryReleased": "Delivery processing status",
    "DeliveryPicked": "LIKP-KOSTK",
    "DeliveryShipped": "LIKP-WBSTK / goods issue",
    "DeliveryCompleted": "LIKP-GBSTK",
    "DeliveryCancelled": "LIKP / delivery cancellation status"
  }
}
```

### 5.6 Delivery Item (33)

```json
{
  "delivery_item_id": "LIPS-VBELN + LIPS-POSNR",

  "identity": {
    "delivery_id": "LIPS-VBELN",
    "delivery_item_id": "LIPS-VBELN + LIPS-POSNR",
    "item_number": "LIPS-POSNR"
  },

  "business_attributes": {
    "material_id": "LIPS-MATNR",
    "batch_id": "LIPS-CHARG",
    "delivery_quantity": "LIPS-LFIMG",
    "delivery_unit": "LIPS-VRKME",
    "plant": "LIPS-WERKS",
    "storage_location": "LIPS-LGORT",
    "item_category": "LIPS-PSTYV",
    "reference_sales_order": "LIPS-VGBEL",
    "reference_sales_order_item": "LIPS-VGPOS"
  },

  "enriched_attributes": {
    "material_description": "MAKT-MAKTX",
    "batch_creation_date": "MCHA-ERSDA",
    "batch_production_date": "MCHA-HSDAT",
    "batch_expiration_date": "MCHA-VFDAT",
    "handling_unit": "VEKP-VENUM",
    "handling_unit_item": "VEPO-VEPOS",
    "material_document": "TABLE: MSEG / MATDOC (material movement document — table-level relationship, not a single field)",
    "document_flow": "TABLE: VBFA (document flow — table-level relationship, not a single field)"
  },

  "functional_attributes": {
    "item_identity": {
      "delivery_id": "LIPS-VBELN",
      "item_number": "LIPS-POSNR"
    },

    "material": {
      "material_id": "LIPS-MATNR",
      "batch_id": "LIPS-CHARG"
    },

    "delivery_quantity": {
      "delivery_quantity": "LIPS-LFIMG",
      "delivery_unit": "LIPS-VRKME"
    },

    "location": {
      "plant": "LIPS-WERKS",
      "storage_location": "LIPS-LGORT"
    },

    "sales_reference": {
      "sales_order_id": "LIPS-VGBEL",
      "sales_order_item": "LIPS-VGPOS"
    },

    "packaging": {
      "handling_unit": "VEKP-VENUM",
      "handling_unit_item": "VEPO-VEPOS"
    },

    "batch_execution": {
      "batch_id": "LIPS-CHARG",
      "material_document": "TABLE: MSEG / MATDOC (material movement document — table-level relationship, not a single field)"
    }
  },

  "events": {
    "DeliveryItemCreated": "LIPS-VBELN + LIPS-POSNR",
    "QuantityChanged": "LIPS-LFIMG",
    "BatchAssigned": "LIPS-CHARG",
    "ItemPicked": "Delivery item picking status",
    "ItemShipped": "MSEG / MATDOC goods issue",
    "ItemDelivered": "Delivery completion status"
  }
}
```

### 5.7 Billing Document (34)

```json
{
  "billing_document_id": "VBRK-VBELN",

  "identity": {
    "billing_document_id": "VBRK-VBELN",
    "billing_type": "VBRK-FKART",
    "billing_category": "VBRK-FKTYP"
  },

  "business_attributes": {
    "billing_date": "VBRK-FKDAT",
    "customer_id": "VBRK-KUNRG",
    "payer_id": "VBRK-KUNRG",
    "currency": "VBRK-WAERK",
    "net_value": "VBRK-NETWR",
    "company_code": "VBRK-BUKRS",
    "sales_organization": "VBRK-VKORG",
    "document_status": "VBRK-RFBSK"
  },

  "enriched_attributes": {
    "billing_item_count": "VBRP",
    "material_id": "VBRP-MATNR",
    "billed_quantity": "VBRP-FKIMG",
    "delivery_reference": "VBRP-VGBEL",
    "delivery_item_reference": "VBRP-VGPOS",
    "document_flow": "TABLE: VBFA (document flow — table-level relationship, not a single field)"
  },

  "functional_attributes": {
    "billing_identity": {
      "billing_document_id": "VBRK-VBELN",
      "billing_type": "VBRK-FKART"
    },

    "customer": {
      "customer_id": "VBRK-KUNRG"
    },

    "billing": {
      "billing_date": "VBRK-FKDAT",
      "net_value": "VBRK-NETWR",
      "currency": "VBRK-WAERK"
    },

    "organizational": {
      "company_code": "VBRK-BUKRS",
      "sales_organization": "VBRK-VKORG"
    },

    "delivery_reference": {
      "delivery_id": "VBRP-VGBEL",
      "delivery_item": "VBRP-VGPOS"
    },

    "billing_item": {
      "material_id": "VBRP-MATNR",
      "billed_quantity": "VBRP-FKIMG"
    },

    "document_status": {
      "document_status": "VBRK-RFBSK"
    }
  },

  "events": {
    "InvoiceCreated": "VBRK-VBELN",
    "InvoicePosted": "VBRK-RFBSK",
    "InvoiceCancelled": "VBRK-FKART / cancellation document flow",
    "InvoiceAdjusted": "VBRK / VBRP changed billing values"
  }
}
```

### 5.8 Sales Return (35)

```json
{
  "sales_return_id": "VBFA-VBELV + VBFA-POSNV + VBFA-VBELN + VBFA-POSNN",

  "identity": {
    "sales_return_id": "VBFA-VBELV + VBFA-POSNV + VBFA-VBELN + VBFA-POSNN",
    "return_document_id": "VBAK-VBELN",
    "return_document_type": "VBAK-AUART"
  },

  "business_attributes": {
    "customer_id": "VBAK-KUNNR",
    "return_order_date": "VBAK-AUDAT",
    "material_id": "VBAP-MATNR",
    "return_quantity": "VBAP-KWMENG",
    "sales_unit": "VBAP-VRKME",
    "batch_id": "LIPS-CHARG",
    "return_delivery_id": "LIKP-VBELN",
    "return_delivery_item": "LIPS-POSNR",
    "billing_document_id": "VBRK-VBELN",
    "billing_item": "VBRP-POSNR"
  },

  "enriched_attributes": {
    "material_description": "MAKT-MAKTX",
    "original_sales_order": "TABLE: VBFA (document flow — table-level relationship, not a single field)",
    "original_delivery": "TABLE: VBFA (document flow — table-level relationship, not a single field)",
    "original_billing_document": "TABLE: VBFA (document flow — table-level relationship, not a single field)",
    "batch_creation_date": "MCHA-ERSDA",
    "batch_production_date": "MCHA-HSDAT",
    "batch_expiration_date": "MCHA-VFDAT"
  },

  "functional_attributes": {
    "return_identity": {
      "sales_return_id": "VBFA-VBELV + VBFA-POSNV + VBFA-VBELN + VBFA-POSNN",
      "return_document_id": "VBAK-VBELN",
      "return_document_type": "VBAK-AUART"
    },

    "customer": {
      "customer_id": "VBAK-KUNNR"
    },

    "returned_material": {
      "material_id": "VBAP-MATNR",
      "batch_id": "LIPS-CHARG",
      "return_quantity": "VBAP-KWMENG",
      "sales_unit": "VBAP-VRKME"
    },

    "return_delivery": {
      "return_delivery_id": "LIKP-VBELN",
      "return_delivery_item": "LIPS-POSNR"
    },

    "original_transaction": {
      "original_document_flow": "TABLE: VBFA (document flow — table-level relationship, not a single field)"
    },

    "billing_reference": {
      "billing_document_id": "VBRK-VBELN",
      "billing_item": "VBRP-POSNR"
    }
  },

  "events": {
    "ReturnRequested": "VBAK-VBELN",
    "ReturnCreated": "VBAK / VBAP",
    "ReturnReceived": "LIKP / LIPS",
    "ReturnInspected": "Return inspection processing",
    "ReturnAccepted": "Return acceptance status",
    "ReturnRejected": "Return rejection status",
    "ReturnCompleted": "Return document completion"
  }
}
```

---

## Appendix: Object Index by Domain

| # | Object | Module | Primary Table |
|---|---|---|---|
| — | Planning Requirement | Planning | PBIM / PBED |
| — | Planned Order | Planning | PLAF |
| — | Material | MM | MARA |
| — | Supplier Source | MM | LFA1 / EORD |
| — | Purchase Requisition | MM | EBAN |
| — | Purchase Order | MM | EKKO / EKPO |
| — | Goods Receipt / GRN | MM | MATDOC |
| — | Material Movement | MM | MATDOC / MSEG / MKPF |
| — | Inventory / Stock | MM | MARD |
| — | Reservation | MM | RKPF / RESB |
| 10 | Process Order | Production | AUFK / AFKO / AFPO |
| 11 | BOM | Production | STKO / STPO / MAST |
| 12 | Production Recipe / Routing | Production | PLKO / PLPO |
| 13 | Production Version | Production | MKAL |
| 14 | Work Center / Production Resource | Production | CRHD |
| 15 | Batch Determination | Production | RESB |
| 16 | Material Consumption | Production | MATDOC (MSEG, mvt 261) |
| 17 | Production Confirmation | Production | AFRU / AFVC |
| 18 | Batch | Production | MCHA / MCH1 |
| 19 | Batch Transformation | Production | AUFK / AFKO / AFPO |
| 20 | Production Yield / Scrap | Production | MATDOC (MSEG, mvt 101) |
| 21 | Master Inspection Characteristic | QM | QPMK |
| 22 | Inspection Plan | QM | PLKO / PLPO / PLMK |
| 23 | Quality Inspection Parameters | QM | QMAT / QINF |
| 24 | Quality Inspection Lot | QM | QALS / QAMB / QAST |
| 25 | Sampling | QM | QALS / QAMR / QASR |
| 26 | Quality Inspection Result | QM | QAMR / QAMV / QASE / QASR |
| 27 | Quality Usage Decision | QM | QAVE |
| 28 | Customer | Sales | KNA1 / KNVV |
| 29 | Sales Order | Sales | VBAK |
| 30 | Sales Order Item | Sales | VBAP |
| 31 | Sales Batch Allocation | Sales | LIPS / MATDOC |
| 32 | Outbound Delivery | Sales | LIKP |
| 33 | Delivery Item | Sales | LIPS |
| 34 | Billing Document | Sales | VBRK / VBRP |
| 35 | Sales Return | Sales | VBFA / VBAK / VBAP |

---

*End of document. All schemas reproduced in full per source content; nothing removed.*
