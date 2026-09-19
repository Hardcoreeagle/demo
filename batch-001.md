{
  "batch_genealogy": {
    "root_batch_id": "BATCH-0002",
    "business_objects": {
      "planning_requirement": {
        "planning_requirement_id": "PRQ-21U000100232-01",
        "material_id": "21U000100232",
        "plant_id": "EP04",
        "requirement_quantity": 888.8,
        "requirement_date": "2019-08-29",
        "events": [
          {
            "event_type": "PlanningRequirementCreated"
          },
          {
            "event_type": "PlanningRequirementUpdated"
          }
        ]
      },
      "planned_order": {
        "plan_order_id": "PLN-550010011265",
        "material_id": "21U000100232",
        "plant_id": "EP04",
        "order_quantity": 880,
        "start_date": "2019-08-29",
        "finish_date": "2019-08-29",
        "order_type": "EOBK",
        "events": [
          {
            "event_type": "PlannedOrderCreated"
          },
          {
            "event_type": "PlannedOrderReleased"
          },
          {
            "event_type": "PlannedOrderConverted"
          }
        ]
      },
      "material": {
        "material_id": "21U000100232",
        "material_description": "METFORMIN HCL TABLETS USP 500MG (FILM COATED)",
        "material_type": "FINISHED_PRODUCT",
        "plant_id": "EP04",
        "UOM": "KG",
        "status": "ACTIVE",
        "events": [
          {
            "event_type": "MaterialCreated"
          },
          {
            "event_type": "MaterialUpdated"
          },
          {
            "event_type": "MaterialUnblocked"
          }
        ]
      },
      "batch": {
        "batch_id": "BATCH-0002",
        "material_id": "21U000100232",
        "batch_type": "FINISHED_PRODUCT",
        "Plant_id": "EP04",
        "Manufacturing_date": "2010-02-02",
        "expiery_date": "2012-01-31",
        "status": "RELEASED",
        "events": [
          {
            "event_type": "ProductionBatchCreated"
          },
          {
            "event_type": "ProductionBatchUpdated"
          },
          {
            "event_type": "ProductionBatchCompleted"
          }
        ]
      },
      "supplier_or_source": {
        "Supplier_or_Source_id": "0000400860",
        "Source_Name": "Aarti Drugs Limited - Active Pharma Ingredients",
        "Source_type": "APPROVED_VENDOR",
        "Country": "India",
        "region": "Maharashtra",
        "postal_code": "400001",
        "address_id": "ADDR-1004",
        "email": "orders@aartidrugs.com",
        "status": "ACTIVE",
        "Company_code": "1000",
        "valid": true,
        "events": [
          {
            "event_type": "SupplierSourceCreated"
          },
          {
            "event_type": "SupplierSourceUpdated"
          }
        ]
      },
      "purchase_requisition": {
        "purchase_requisition_id": "1000037529",
        "item_id": "0010",
        "Material_id": "000000000110000711",
        "material_description": "METFORMIN HYDROCHLORIDE IP/USP (API RAW MATERIAL)",
        "Plant_id": "EP04",
        "requested_quantity": 110,
        "UOM": "KG",
        "requested_delivery_date": "2010-01-12",
        "events": [
          {
            "event_type": "PurchaseRequisitionCreated"
          },
          {
            "event_type": "PurchaseRequisitionUpdated"
          },
          {
            "event_type": "PurchaseRequisitionReleased"
          }
        ]
      },
      "purchase_order": {
        "purchase_order_id": "4500012345",
        "Supplier_or_Source_id": "0000400860",
        "Company_code": "1000",
        "order_date": "2010-01-05",
        "document_type": "STANDARD_PO",
        "item": {
          "item_id": "0010",
          "material_id": "000000000110000711",
          "description": "METFORMIN HYDROCHLORIDE IP/USP (API RAW MATERIAL)",
          "order_quantity": 110,
          "plant_id": "EP04",
          "storage_location_id": "RMS",
          "delevery_date": "2010-01-15",
          "UOM": "KG"
        },
        "events": [
          {
            "event_type": "PurchaseOrderCreated"
          },
          {
            "event_type": "PurchaseOrderUpdated"
          },
          {
            "event_type": "PurchaseOrderReleased"
          }
        ]
      },
      "material_movement": {
        "material_document_id": "5000012345",
        "material_document_year": "2010",
        "movement_type": "101",
        "Material_id": "000000000110000711",
        "Batch_id": "RM-BATCH-0002",
        "stroage_location": "RMS",
        "quantity": 110,
        "UOM": "KG",
        "posting_date": "2010-01-16",
        "document_date": "2010-01-16",
        "reference_document_id": "4500012345",
        "purchase_order_id": "4500012345",
        "process_order_id": null,
        "events": [
          {
            "event_type": "GoodsReceiptPosted"
          },
          {
            "event_type": "BatchReceived"
          }
        ]
      },
      "inventory_stock": {
        "Material_id": "21U000100232",
        "Plant_id": "EP04",
        "stroage_location": "SFS",
        "UOM": "KG",
        "stock_status": "AVAILABLE",
        "events": [
          {
            "event_type": "StockIncreased"
          },
          {
            "event_type": "StockDecreased"
          },
          {
            "event_type": "StockTransferred"
          },
          {
            "event_type": "StockStatusChanged"
          }
        ]
      },
      "reservation": {
        "reservation_id": "1000037529",
        "item_id": "0002",
        "Material_id": "000000000210250095",
        "Plant_id": "EP04",
        "storage_location": "SFS",
        "reservation_quantity": 104.5,
        "UOM": "KG",
        "requirement_date": "2010-02-02",
        "movement_type": "261",
        "process_order_id": "550010011265",
        "events": [
          {
            "event_type": "ReservationCreated"
          },
          {
            "event_type": "ReservationReleased"
          }
        ]
      },
      "process_order": {
        "process_order_id": "550010011265",
        "order_type": "EOBK",
        "Material_id": "21U000100232",
        "Plant_id": "EP04",
        "planned_id": "PLN-550010011265",
        "planned_quantity": 880,
        "UOM": "KG",
        "basic_start_date": "2019-08-29",
        "basic_finish_date": "2019-08-29",
        "actual_start_date": "2019-08-29",
        "actual_finish_date": "2019-08-29",
        "status": "Created/Released",
        "production_version_id": "01",
        "input_batches": [
          "BATCH-0002-CORE"
        ],
        "output_batches": [
          "BATCH-0002"
        ],
        "consumed_batches": [
          {
            "batch_id": "BATCH-0002-CORE",
            "material_id": "000000000210250095",
            "material_description": "METFORMIN HCL TABLETS 500MG (UNCOATED CORE)",
            "stage": "SEMI_FINISHED_CORE",
            "consumed_quantity": 888.8,
            "uom": "KG"
          }
        ],
        "produced_product": {
          "batch_id": "BATCH-0002",
          "material_id": "21U000100232",
          "material_description": "METFORMIN HCL TABLETS USP 500MG (FILM COATED)",
          "stage": "FINISHED_PRODUCT",
          "produced_quantity": 880,
          "uom": "KG"
        },
        "events": [
          {
            "event_type": "ProcessOrderCreated"
          },
          {
            "event_type": "ProcessOrderReleased"
          },
          {
            "event_type": "ProcessOrderUpdated"
          },
          {
            "event_type": "ProcessOrderClosed"
          }
        ]
      },
      "bom": {
        "bom_id": "BOM-21U000100232-01",
        "Material_id": "21U000100232",
        "Plant_id": "EP04",
        "bom_usage": "PRODUCTION",
        "bom_status": "ACTIVE",
        "alternative_bom": "01",
        "base_quantity": 880,
        "base_UOM": "KG",
        "Components": [
          {
            "Component_material_id": "000000000210250095",
            "Component_quantity": 888.8,
            "Component_UOM": "KG",
            "Component_item_number": "0010"
          },
          {
            "Component_material_id": "000000000110000714",
            "Component_quantity": 0.534,
            "Component_UOM": "KG",
            "Component_item_number": "0020"
          }
        ],
        "events": [
          {
            "event_type": "BOMCreated"
          },
          {
            "event_type": "BOMUpdated"
          },
          {
            "event_type": "BOMReleased"
          }
        ]
      },
      "recipe": {
        "Recipe_id": "REC-21U000100232-01",
        "Material_id": "21U000100232",
        "Plant_id": "EP04",
        "recipe_type": "PRODUCTION_RECIPE",
        "recipe_group": "RG-MET-01",
        "recipe_status": "ACTIVE",
        "operations": [
          {
            "Opreration_id": "OP-0010",
            "Operation_number": "0010",
            "Operation_description": "Film Coating of Metformin Core Tablets",
            "work_center_id": "WC-COAT-01",
            "Control_key": "PP01"
          },
          {
            "Opreration_id": "OP-0020",
            "Operation_number": "0020",
            "Operation_description": "Primary Blister Packaging 10x10",
            "work_center_id": "WC-PACK-01",
            "Control_key": "PP01"
          }
        ],
        "events": [
          {
            "event_type": "RecipeCreated"
          },
          {
            "event_type": "RecipeUpdated"
          },
          {
            "event_type": "RecipeReleased"
          }
        ]
      },
      "production_version": {
        "production_version_id": "PV-21U000100232-01",
        "Material_id": "21U000100232",
        "production_version_status": "ACTIVE",
        "bom_id": "BOM-21U000100232-01",
        "Recipe_id": "REC-21U000100232-01",
        "valid_from": "2010-01-01",
        "valid_to": "2025-12-31",
        "events": [
          {
            "event_type": "ProductionVersionCreated"
          },
          {
            "event_type": "ProductionVersionUpdated"
          },
          {
            "event_type": "ProductionVersionReleased"
          }
        ]
      },
      "batch_determination": {
        "determination_id": "BD-550010011265-01",
        "Material_id": "000000000210250095",
        "Batch_id": "BATCH-0002-CORE",
        "process_order_id": "550010011265",
        "quantity": 888.8,
        "UOM": "KG",
        "status": "ALLOCATED",
        "events": [
          {
            "event_type": "BatchDetermined"
          },
          {
            "event_type": "BatchAssigned"
          }
        ]
      },
      "material_consumption": {
        "Material_document_id": "MATDOC-261-550010011265",
        "material_document_year": "2010",
        "process_order_id": "550010011265",
        "Batch_id": "BATCH-0002-CORE",
        "Plant_id": "EP04",
        "storage_location_id": "SFS",
        "consumed_quantity": 888.8,
        "UOM": "KG",
        "posting_date": "2019-08-29",
        "movement_type": "261",
        "status": "POSTED",
        "events": [
          {
            "event_type": "MaterialConsumptionPosted"
          },
          {
            "event_type": "MaterialConsumptionAdjusted"
          },
          {
            "event_type": "MaterialConsumptionReversed"
          }
        ]
      },
      "production_confirmation": {
        "confermation_id": "CONF-550010011265-01",
        "process_order_id": "550010011265",
        "operation_id": "OP-0010",
        "work_center_id": "WC-COAT-01",
        "confirmed_quantity": 880,
        "UOM": "KG",
        "Confirmation_date": "2019-08-29",
        "confirmation_time": "14:30:00",
        "status": "CONFIRMED",
        "events": [
          {
            "event_type": "ProductionConfirmationRecorded"
          },
          {
            "event_type": "ProductionConfirmationUpdated"
          },
          {
            "event_type": "OperationCompleted"
          }
        ]
      },
      "batch_transformation": {
        "transformation_id": "TRANS-BATCH-0002",
        "process_order_id": "550010011265",
        "input_batch_id": "BATCH-0002-CORE",
        "output_batch_id": "BATCH-0002",
        "Material_id": "21U000100232",
        "transformation_type": "COATING_AND_PACKAGING",
        "quantity": 880,
        "UOM": "KG",
        "status": "COMPLETED",
        "input_batches": [
          "BATCH-0002-CORE"
        ],
        "output_batches": [
          "BATCH-0002"
        ],
        "consumed_batches": [
          {
            "batch_id": "BATCH-0002-CORE",
            "material_id": "000000000210250095",
            "material_description": "METFORMIN HCL TABLETS 500MG (UNCOATED CORE)",
            "stage": "SEMI_FINISHED_CORE",
            "consumed_quantity": 888.8,
            "uom": "KG"
          }
        ],
        "produced_product": {
          "batch_id": "BATCH-0002",
          "material_id": "21U000100232",
          "material_description": "METFORMIN HCL TABLETS USP 500MG (FILM COATED)",
          "stage": "FINISHED_PRODUCT",
          "produced_quantity": 880,
          "uom": "KG"
        },
        "transformation_stages": [
          {
            "stage_number": 1,
            "stage_name": "Raw Material to Semi-Finished (Granulation \u0026 Core Compression)",
            "process_order_id": "400000000846",
            "input_batches": [
              "RM-BATCH-0002"
            ],
            "output_batch": "BATCH-0002-CORE",
            "material_id": "000000000210250095",
            "material_type": "SEMI_FINISHED",
            "quantity_produced": 888.8,
            "uom": "KG",
            "status": "COMPLETED"
          },
          {
            "stage_number": 2,
            "stage_name": "Semi-Finished to Finished Product (Film Coating \u0026 Packing)",
            "process_order_id": "550010011265",
            "input_batches": [
              "BATCH-0002-CORE"
            ],
            "output_batch": "BATCH-0002",
            "material_id": "21U000100232",
            "material_type": "FINISHED_PRODUCT",
            "quantity_produced": 880,
            "uom": "KG",
            "status": "COMPLETED"
          }
        ],
        "events": [
          {
            "event_type": "BatchTransformationCreated"
          },
          {
            "event_type": "BatchTransformationCompleted"
          }
        ]
      },
      "yield": {
        "Process_order_id": "550010011265",
        "master_id": "21U000100232",
        "Batch_id": "BATCH-0002",
        "material_document_id": "YLD-550010011265",
        "yield_quantity": 880,
        "scrap_quantity": 0,
        "UOM": "KG",
        "posting_date": "2019-08-29",
        "status": "POSTED",
        "events": [
          {
            "event_type": "YieldRecorded"
          },
          {
            "event_type": "YieldAdjusted"
          }
        ]
      },
      "master_inspection_characteristic": {
        "inspection_characteristic_id": "MIC-ASSAY-01",
        "description": "Assay of Metformin Hydrochloride",
        "Plant_id": "EP04",
        "UOM": "%",
        "Lower_specification_limit": 95,
        "upper_specification_limit": 105,
        "target_value": 100,
        "status": "ACTIVE",
        "events": [
          {
            "event_type": "InspectionCharacteristicCreated"
          },
          {
            "event_type": "InspectionCharacteristicChanged"
          }
        ]
      },
      "inspection_plan": {
        "inspection_plan_id": "IP-21U000100232-01",
        "Material_id": "21U000100232",
        "Plant_id": "EP04",
        "plan_group": "IPG-QC-01",
        "plan_usage": "FINAL_RELEASE",
        "status": "ACTIVE",
        "operations": [
          {
            "operation_id": "QOP-0010",
            "operation_number": "0010",
            "description": "Finished Product Chemical \u0026 Physical Release Analysis"
          }
        ],
        "events": [
          {
            "event_type": "InspectionPlanCreated"
          },
          {
            "event_type": "InspectionPlanChanged"
          }
        ]
      },
      "inspection_parameter": {
        "parameter_id": "PARAM-ASSAY-01",
        "Material_id": "21U000100232",
        "Plant_id": "EP04",
        "inspection_type": "FINAL_RELEASE",
        "inspection_parameter": "Metformin HCl Content by HPLC",
        "parameter_value": "99.8",
        "UOM": "%",
        "status": "ACTIVE",
        "events": [
          {
            "event_type": "InspectionParameterAssigned"
          },
          {
            "event_type": "InspectionParameterChanged"
          }
        ]
      },
      "quality_inspection_lot": {
        "inspection_lot_id": "080000392763",
        "Material_id": "21U000100232",
        "Batch_id": "BATCH-0002",
        "Plant_id": "EP04",
        "inspection_origin": "08_PRODUCTION_RELEASE",
        "quantity": 880,
        "Creation_date": "2019-08-29",
        "inspection_start_date": "2019-08-29",
        "inspection_completion_date": "2019-08-29",
        "status": "COMPLETED",
        "events": [
          {
            "event_type": "InspectionLotCreated"
          },
          {
            "event_type": "InspectionStarted"
          },
          {
            "event_type": "InspectionCompleted"
          },
          {
            "event_type": "InspectionLotStatusChanged"
          }
        ]
      },
      "sampling": {
        "Sample_id": "SMP-080000392763-01",
        "inspection_lot_id": "080000392763",
        "Material_id": "21U000100232",
        "Batch_id": "BATCH-0002",
        "sample_quantity": 0.5,
        "sample_UOM": "KG",
        "sample_date": "2019-08-29",
        "status": "COMPLETED",
        "events": [
          {
            "event_type": "SampleCreated"
          },
          {
            "event_type": "SampleCollected"
          },
          {
            "event_type": "SampleUpdated"
          },
          {
            "event_type": "SampleCompleted"
          }
        ]
      },
      "inspection_result": {
        "inspection_result_id": "RES-080000392763-01",
        "inspection_lot_id": "080000392763",
        "sample_id": "SMP-080000392763-01",
        "Material_id": "21U000100232",
        "batch_id": "BATCH-0002",
        "inspection_characteristic_id": "MIC-ASSAY-01",
        "result_value": 99.8,
        "UOM": "%",
        "result_status": "PASSED",
        "record_date": "2019-08-29",
        "events": [
          {
            "event_type": "InspectionResultRecorded"
          },
          {
            "event_type": "InspectionResultChanged"
          }
        ]
      },
      "usage_decision": {
        "usage_decision_id": "UD-080000392763",
        "inspection_lot_id": "080000392763",
        "Material_id": "21U000100232",
        "Batch_id": "BATCH-0002",
        "Plant_id": "EP04",
        "decision_code": "ACCEPT",
        "desion_status": "APPROVED",
        "decison_date": "2019-08-29",
        "events": [
          {
            "event_type": "QualityDecisionRecorded"
          },
          {
            "event_type": "QualityDecisionChanged"
          }
        ]
      },
      "customer_or_cfa": {
        "Customer_id": "0000400860",
        "customer_name": "Central Healthcare Distribution Services",
        "customer_type": "INSTITUTIONAL_CUSTOMER",
        "customer_group": "DISTRIBUTOR",
        "country": "India",
        "region": "Maharashtra",
        "postal_code": "400012",
        "address_id": "ADDR-CUST-01",
        "email": "procurement@centralhealth.org",
        "status": "ACTIVE",
        "company_code": "1000",
        "events": [
          {
            "event_type": "CustomerCreated"
          },
          {
            "event_type": "CustomerUpdated"
          }
        ]
      },
      "sales_order": {
        "sales_order_id": "1100809985",
        "order_type": "STANDARD_SALES_ORDER",
        "Customer_id": "0000400860",
        "company_code": "1000",
        "order_date": "2010-05-17",
        "request_delivery_date": "2010-05-19",
        "currency": "INR",
        "status": "COMPLETED",
        "events": [
          {
            "event_type": "SalesOrderCreated"
          },
          {
            "event_type": "SalesOrderChanged"
          },
          {
            "event_type": "SalesOrderConfirmed"
          },
          {
            "event_type": "SalesOrderCompleted"
          }
        ]
      },
      "sales_order_item": {
        "sales_order_id": "1100809985",
        "item_id": "000010",
        "Material_id": "21U000100232",
        "ordered_quantity": 100,
        "UOM": "KG",
        "requested_delevery_date": "2010-05-19",
        "confirmed_quantity": 100,
        "confirmed_delevery_date": "2010-05-19",
        "status": "CONFIRMED",
        "events": [
          {
            "event_type": "SalesOrderItemAdded"
          },
          {
            "event_type": "QuantityChanged"
          },
          {
            "event_type": "ItemConfirmed"
          }
        ]
      },
      "sales_batch_allocation": {
        "sales_order_id": "1100809985",
        "sales_order_item_id": "000010",
        "delivery_id": "2100084439",
        "delivery_item_id": "900055",
        "Material_id": "21U000100232",
        "Batch_id": "BATCH-0002",
        "allocated_status": "CONFIRMED",
        "events": [
          {
            "event_type": "BatchAllocated"
          },
          {
            "event_type": "BatchAllocationChanged"
          },
          {
            "event_type": "BatchAllocationConfirmed"
          }
        ]
      },
      "outbound_delivery": {
        "delivery_id": "2100084439",
        "sales_order_id": "1100809985",
        "customer_id": "0000400860",
        "delivery_type": "STANDARD_OUTBOUND",
        "delivery_date": "2010-05-19",
        "planned_goods_issue_date": "2010-05-19",
        "actual_goods_issue_date": "2010-05-19",
        "status": "COMPLETED",
        "events": [
          {
            "event_type": "DeliveryCreated"
          },
          {
            "event_type": "DeliveryReleased"
          },
          {
            "event_type": "DeliveryPicked"
          },
          {
            "event_type": "DeliveryShipped"
          },
          {
            "event_type": "DeliveryCompleted"
          }
        ]
      },
      "delivery_item": {
        "delivery_id": "2100084439",
        "item_id": "900055",
        "sales_order_id": "1100809985",
        "sales_order_item_id": "000010",
        "Material_id": "21U000100232",
        "Batch_id": "BATCH-0002",
        "delivery_quantity": 880,
        "UOM": "KG",
        "plant_id": "EP04",
        "storage_location_id": "SFS",
        "status": "DELIVERED",
        "events": [
          {
            "event_type": "DeliveryItemCreated"
          },
          {
            "event_type": "BatchAssigned"
          },
          {
            "event_type": "ItemPicked"
          },
          {
            "event_type": "ItemShipped"
          },
          {
            "event_type": "ItemDelivered"
          }
        ]
      },
      "billing_document": {
        "billing_document_id": "5402100863",
        "billing_type": "INVOICE",
        "coustomer_id": "0000400860",
        "sales_order_id": "1100809985",
        "delivery_id": "2100084439",
        "billing_date": "2010-05-19",
        "currency": "INR",
        "net_value": 100000,
        "tax_value": 18000,
        "gross_value": 118000,
        "status": "POSTED",
        "events": [
          {
            "event_type": "InvoiceCreated"
          },
          {
            "event_type": "InvoicePosted"
          }
        ]
      },
      "sales_return": {
        "return_id": null,
        "sales_order_id": "1100809985",
        "sales_order_item_id": "000010",
        "delivery_id": "2100084439",
        "delivery_item_id": "900055",
        "billing_document_id": "5402100863",
        "customer_id": "0000400860",
        "Material_id": "21U000100232",
        "batch_id": "BATCH-0002",
        "return_quantity": null,
        "UOM": "KG",
        "return_date": null,
        "status": "NO_RETURN",
        "events": []
      },
      "semifinished_stage": {
        "process_order_id": "400000000846",
        "order_type": "EOBK",
        "material_id": "000000000210250095",
        "material_description": "METFORMIN HCL TABLETS 500MG (UNCOATED CORE)",
        "batch_id": "BATCH-0002-CORE",
        "batch_type": "SEMI_FINISHED_BATCH",
        "plant_id": "EP04",
        "status": "CLOSED",
        "planned_quantity": 888.8,
        "uom": "KG",
        "input_batches": [
          "RM-BATCH-0002"
        ],
        "output_batches": [
          "BATCH-0002-CORE"
        ],
        "batch_transformation": {
          "transformation_id": "TRANS-SFG-001",
          "process_order_id": "400000000846",
          "input_batch_id": "RM-BATCH-0002",
          "output_batch_id": "BATCH-0002-CORE",
          "Material_id": "000000000210250095",
          "transformation_type": "GRANULATION_AND_COMPRESSION",
          "quantity": 888.8,
          "UOM": "KG",
          "status": "COMPLETED",
          "input_batches": [
            "RM-BATCH-0002"
          ],
          "output_batches": [
            "BATCH-0002-CORE"
          ],
          "consumed_batches": [
            {
              "batch_id": "RM-BATCH-0002",
              "material_id": "000000000110000711",
              "material_description": "METFORMIN HYDROCHLORIDE IP/USP (API RAW MATERIAL)",
              "stage": "RAW_MATERIAL_API",
              "consumed_quantity": 888.8,
              "uom": "KG"
            }
          ],
          "produced_product": {
            "batch_id": "BATCH-0002-CORE",
            "material_id": "000000000210250095",
            "material_description": "METFORMIN HCL TABLETS 500MG (UNCOATED CORE)",
            "stage": "SEMI_FINISHED_CORE",
            "produced_quantity": 888.8,
            "uom": "KG"
          },
          "events": [
            {
              "event_type": "BatchTransformationCreated"
            },
            {
              "event_type": "BatchTransformationCompleted"
            }
          ]
        },
        "material_consumption": {
          "Material_document_id": "MATDOC-261-001",
          "material_document_year": "2010",
          "process_order_id": "400000000846",
          "Batch_id": "RM-BATCH-0002",
          "Plant_id": "EP04",
          "storage_location_id": "RMS",
          "consumed_quantity": 888.8,
          "UOM": "KG",
          "posting_date": "2010-01-22",
          "movement_type": "261",
          "status": "POSTED",
          "events": [
            {
              "event_type": "MaterialConsumptionPosted"
            }
          ]
        },
        "production_confirmation": {
          "confermation_id": "CONF-400000000846-01",
          "process_order_id": "400000000846",
          "operation_id": "OP-0010",
          "work_center_id": "WC-GRAN-01",
          "confirmed_quantity": 888.8,
          "UOM": "KG",
          "Confirmation_date": "2010-02-01",
          "confirmation_time": "16:00:00",
          "status": "CONFIRMED",
          "events": [
            {
              "event_type": "ProductionConfirmationRecorded"
            },
            {
              "event_type": "OperationCompleted"
            }
          ]
        },
        "yield": {
          "Process_order_id": "400000000846",
          "master_id": "000000000210250095",
          "Batch_id": "BATCH-0002-CORE",
          "material_document_id": "YLD-400000000846",
          "yield_quantity": 104.5,
          "scrap_quantity": 0.5,
          "UOM": "KG",
          "posting_date": "2010-02-01",
          "status": "POSTED",
          "events": [
            {
              "event_type": "YieldRecorded"
            }
          ]
        }
      }
    },
    "relationships": [
      {
        "from": "Planning Requirement",
        "to": "Planned Order",
        "relationship": "PLANS_FOR",
        "join_fields": [
          "material_id",
          "plant_id"
        ]
      },
      {
        "from": "Planned Order",
        "to": "Purchase Requisition",
        "relationship": "CREATES_PROCUREMENT_REQUIREMENT",
        "join_fields": [
          "material_id",
          "plant_id"
        ]
      },
      {
        "from": "Purchase Requisition",
        "to": "Purchase Order",
        "relationship": "CONVERTED_TO",
        "join_fields": [
          "material_id",
          "plant_id"
        ]
      },
      {
        "from": "Purchase Order",
        "to": "Material Movement",
        "relationship": "RECEIVED_BY",
        "join_fields": [
          "purchase_order_id",
          "reference_document_id"
        ]
      },
      {
        "from": "Material Movement",
        "to": "Input Batch",
        "relationship": "CREATES_OR_RECEIVES",
        "join_fields": [
          "material_id",
          "batch_id"
        ]
      },
      {
        "from": "Input Batch",
        "to": "Inventory / Stock",
        "relationship": "STORED_IN",
        "join_fields": [
          "material_id",
          "plant_id",
          "storage_location"
        ]
      },
      {
        "from": "Reservation",
        "to": "Process Order",
        "relationship": "RESERVED_FOR",
        "join_fields": [
          "process_order_id"
        ]
      },
      {
        "from": "Process Order",
        "to": "BOM",
        "relationship": "USES",
        "join_fields": [
          "material_id",
          "plant_id"
        ]
      },
      {
        "from": "Process Order",
        "to": "Recipe",
        "relationship": "USES",
        "join_fields": [
          "material_id",
          "plant_id"
        ]
      },
      {
        "from": "Process Order",
        "to": "Production Version",
        "relationship": "USES",
        "join_fields": [
          "production_version_id"
        ]
      },
      {
        "from": "Batch Determination",
        "to": "Material Consumption",
        "relationship": "DETERMINES_BATCH_FOR_CONSUMPTION",
        "join_fields": [
          "batch_id",
          "process_order_id"
        ]
      },
      {
        "from": "Material Consumption",
        "to": "Process Order",
        "relationship": "CONSUMED_IN",
        "join_fields": [
          "process_order_id"
        ]
      },
      {
        "from": "Material Consumption",
        "to": "Input Batch",
        "relationship": "CONSUMES",
        "join_fields": [
          "batch_id"
        ]
      },
      {
        "from": "Process Order",
        "to": "Production Confirmation",
        "relationship": "CONFIRMED_BY",
        "join_fields": [
          "process_order_id"
        ]
      },
      {
        "from": "Process Order",
        "to": "Yield",
        "relationship": "PRODUCES_YIELD",
        "join_fields": [
          "process_order_id"
        ]
      },
      {
        "from": "Input Batch",
        "to": "Batch Transformation",
        "relationship": "INPUT_BATCH",
        "join_fields": [
          "batch_id"
        ]
      },
      {
        "from": "Batch Transformation",
        "to": "Batch",
        "relationship": "PRODUCES",
        "join_fields": [
          "output_batch_id",
          "batch_id"
        ]
      },
      {
        "from": "Raw Material Batch",
        "to": "Batch Transformation (Semi-Finished)",
        "relationship": "TRANSFORMS_TO_SEMIFINISHED",
        "join_fields": [
          "batch_id"
        ]
      },
      {
        "from": "Batch Transformation (Semi-Finished)",
        "to": "Semi-Finished Batch",
        "relationship": "PRODUCES_SEMIFINISHED_BATCH",
        "join_fields": [
          "output_batch_id",
          "batch_id"
        ]
      },
      {
        "from": "Semi-Finished Batch",
        "to": "Batch Transformation (Finished)",
        "relationship": "TRANSFORMS_TO_FINISHED_PRODUCT",
        "join_fields": [
          "batch_id"
        ]
      },
      {
        "from": "Batch",
        "to": "Quality Inspection Lot",
        "relationship": "INSPECTED_BY",
        "join_fields": [
          "batch_id",
          "material_id",
          "plant_id"
        ]
      },
      {
        "from": "Quality Inspection Lot",
        "to": "Sampling",
        "relationship": "SAMPLED_BY",
        "join_fields": [
          "inspection_lot_id",
          "batch_id"
        ]
      },
      {
        "from": "Sampling",
        "to": "Inspection Result",
        "relationship": "PRODUCES_RESULT",
        "join_fields": [
          "sample_id",
          "inspection_lot_id"
        ]
      },
      {
        "from": "Inspection Result",
        "to": "Usage Decision",
        "relationship": "SUPPORTS",
        "join_fields": [
          "inspection_lot_id",
          "batch_id"
        ]
      },
      {
        "from": "Batch",
        "to": "Sales Batch Allocation",
        "relationship": "ALLOCATED_TO",
        "join_fields": [
          "batch_id",
          "material_id"
        ]
      },
      {
        "from": "Sales Batch Allocation",
        "to": "Delivery Item",
        "relationship": "ALLOCATED_FOR",
        "join_fields": [
          "delivery_id",
          "delivery_item_id",
          "batch_id"
        ]
      },
      {
        "from": "Delivery Item",
        "to": "Outbound Delivery",
        "relationship": "PART_OF",
        "join_fields": [
          "delivery_id"
        ]
      },
      {
        "from": "Delivery Item",
        "to": "Material Movement",
        "relationship": "GOODS_ISSUE",
        "join_fields": [
          "batch_id",
          "material_id"
        ]
      },
      {
        "from": "Outbound Delivery",
        "to": "Billing Document",
        "relationship": "BILLED_BY",
        "join_fields": [
          "delivery_id"
        ]
      },
      {
        "from": "Billing Document",
        "to": "Customer or CFA",
        "relationship": "BILLED_TO",
        "join_fields": [
          "coustomer_id"
        ]
      },
      {
        "from": "Customer or CFA",
        "to": "Sales Return",
        "relationship": "RETURNS",
        "join_fields": [
          "customer_id"
        ]
      },
      {
        "from": "Sales Return",
        "to": "Batch",
        "relationship": "RETURNS_BATCH",
        "join_fields": [
          "batch_id"
        ]
      }
    ]
  }
}