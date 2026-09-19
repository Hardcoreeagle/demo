1. Planning Requirement
Event	SAP Table	SAP Field	Operator / Condition	Required Join	Result
PlanningRequirementCreated	PBIM/PBED	Planning requirement key	New record	PBIM ↔ PBED	Planning requirement created
PlanningRequirementUpdated	PBIM/PBED	Relevant requirement fields	Value changed	PBIM ↔ PBED	Planning requirement updated
PlanningRequirementCancelled	PBIM/PBED	Cancellation/status field	Cancellation/status indicates cancelled	PBIM ↔ PBED	Planning requirement cancelled
2. Planned Order
Event	SAP Table	SAP Field	Operator / Condition	Required Join	Result
PlannedOrderCreated	PLAF	PLNUM	New record	—	Planned order created
PlannedOrderUpdated	PLAF	Relevant order fields	Value changed	—	Planned order updated
PlannedOrderReleased	PLAF	Release/status field	Released	—	Planned order released
PlannedOrderConverted	PLAF / AFKO	Planned-order reference	Matching Process Order exists	PLAF ↔ AFKO	Planned order converted to Process Order
PlannedOrderCancelled	PLAF	Cancellation/status field	Cancelled	—	Planned order cancelled
3. Material
Event	SAP Table	SAP Field	Operator / Condition	Required Join	Result
MaterialCreated	MARA	MATNR	New record	—	Material created
MaterialUpdated	MARA/MARC/MVKE/MBEW	Relevant material fields	Value changed	MATNR-based joins	Material updated
MaterialBlocked	MARA/MARC	Material status field	Blocked	MATNR-based joins	Material blocked
MaterialUnblocked	MARA/MARC	Material status field	Unblocked	MATNR-based joins	Material unblocked
4. Supplier Source
Event	SAP Table	SAP Field	Operator / Condition	Required Join	Result
SupplierSourceCreated	EORD	MATNR/WERKS/LIFNR	New source record	EORD ↔ supplier master	Supplier source created
SupplierSourceUpdated	EORD	Source fields	Value changed	EORD ↔ supplier master	Supplier source updated
SupplierSourceBlocked	EORD	Source/status field	Blocked	EORD ↔ supplier master	Supplier source blocked
5. Purchase Requisition
Event	SAP Table	SAP Field	Operator / Condition	Required Join	Result
PurchaseRequisitionCreated	EBAN	BANFN/BNFPO	New record	EBAN ↔ EBKN	PR created
PurchaseRequisitionUpdated	EBAN	Quantity/date/material fields	Value changed	EBAN ↔ EBKN	PR updated
PurchaseRequisitionReleased	EBAN	Release indicator	Released	EBAN ↔ EBKN	PR released
6. Purchase Order
Event	SAP Table	SAP Field	Operator / Condition	Required Join	Result
PurchaseOrderCreated	EKKO/EKPO	EBELN/EBELP	New record	EKKO.EBELN = EKPO.EBELN	PO created
PurchaseOrderUpdated	EKKO/EKPO	Relevant PO fields	Value changed	EKKO.EBELN = EKPO.EBELN	PO updated
PurchaseOrderReleased	EKKO/EKPO	Release indicator/status	Released	EKKO.EBELN = EKPO.EBELN	PO released
7. Material Movement
Event	SAP Table	SAP Field	Operator / Condition	Required Join	Result
GoodsIssuePosted	MATDOC	BWART	GI movement type	Material/document key as applicable	Goods issue posted
GoodsReceiptPosted	MATDOC	BWART	= 101	Material/document key as applicable	Goods receipt posted
MaterialTransferred	MATDOC	BWART	Transfer movement type	Material/document key	Material transferred
MaterialMovementReversed	MATDOC	BWART/reference	Reversal movement/reference	Original material document	Movement reversed
8. Inventory / Stock
Event	SAP Table	SAP Field	Operator / Condition	Required Join	Result
StockIncreased	MARD/MCHB	Stock quantity	Current > previous	MATNR/WERKS/LGORT/CHARG	Stock increased
StockDecreased	MARD/MCHB	Stock quantity	Current < previous	MATNR/WERKS/LGORT/CHARG	Stock decreased
StockTransferred	MARD/MCHB	Stock/location	Source decreases + target increases	Material + plant/storage/batch	Stock transferred
StockStatusChanged	MARD/MCHB	Stock/status field	Status changed	MATNR/WERKS/LGORT/CHARG	Stock status changed
9. Reservation
Event	SAP Table	SAP Field	Operator / Condition	Required Join	Result
ReservationCreated	RKPF/RESB	Reservation key	New record	RKPF ↔ RESB	Reservation created
ReservationUpdated	RESB	Quantity/date/component fields	Value changed	RKPF ↔ RESB	Reservation updated
ReservationReleased	RKPF/RESB	Release/status field	Released	RKPF ↔ RESB	Reservation released
10. Process Order
Event	SAP Table	SAP Field	Operator / Condition	Required Join	Result
ProcessOrderCreated	AUFK/AFKO/AFPO	AUFNR	New order	AUFK.AUFNR = AFKO.AUFNR = AFPO.AUFNR	Process Order created
ProcessOrderReleased	JEST	Status	Released	JEST.OBJNR ↔ Process Order	Process Order released
ProcessOrderUpdated	AFKO/AFPO	Relevant order fields	Value changed	AUFNR	Process Order updated
ProcessOrderClosed	JEST	Status	Closed/technically completed	JEST.OBJNR ↔ Process Order	Process Order closed
11. BOM
Event	SAP Table	SAP Field	Operator / Condition	Required Join	Result
BOMCreated	MAST/STKO/STPO	BOM key	New BOM	MAST ↔ STKO ↔ STPO	BOM created
BOMUpdated	STKO/STPO	BOM/component fields	Value changed	BOM key	BOM updated
BOMReleased	STKO	Status	Released	BOM key	BOM released
12. Production Recipe / Routing
Event	SAP Table	SAP Field	Operator / Condition	Required Join	Result
RecipeCreated	MAPL/PLKO/PLPO	Routing/recipe key	New record	MAPL ↔ PLKO ↔ PLPO	Recipe created
RecipeUpdated	PLKO/PLPO/PLMK/AFVC	Operation/recipe fields	Value changed	Routing key	Recipe updated
RecipeReleased	PLKO	Status	Released	Routing key	Recipe released
13. Production Version
Event	SAP Table	SAP Field	Operator / Condition	Required Join	Result
ProductionVersionCreated	MKAL	Production version key	New record	—	Production version created
ProductionVersionUpdated	MKAL	Version fields	Value changed	—	Production version updated
ProductionVersionReleased	MKAL	Status	Released	—	Production version released
14. Work Center / Production Resource
Event	SAP Table	SAP Field	Operator / Condition	Required Join	Result
WorkCenterAssigned	CRHD/AFVC	Work center	Assigned	Operation ↔ Process Order	Work center assigned
WorkCenterChanged	CRHD/AFVC	Work center	Previous ≠ current	Operation ↔ Process Order	Work center changed
15. Batch Determination
Event	SAP Table	SAP Field	Operator / Condition	Required Join	Result
BatchDetermined	RESB	Batch field	Batch determined	RESB ↔ Process Order	Batch determined
BatchAssigned	RESB	Batch field	Batch populated/assigned	RESB ↔ Process Order	Batch assigned
16. Material Consumption
Event	SAP Table	SAP Field	Operator / Condition	Required Join	Result
MaterialConsumptionPosted	MATDOC	BWART	= 261 AND AUFNR IS NOT NULL	MATDOC.AUFNR = AFKO.AUFNR	Material consumed
MaterialConsumptionAdjusted	MATDOC	MENGE	Consumption quantity adjusted	Material document ↔ Process Order	Consumption adjusted
MaterialConsumptionReversed	MATDOC	BWART/reference	Reversal of 261	Original MATDOC document	Consumption reversed
17. Production Confirmation
Event	SAP Table	SAP Field	Operator / Condition	Required Join	Result
ProductionConfirmationRecorded	AFRU	Confirmation key	New confirmation	AFRU ↔ AFVC	Confirmation recorded
ProductionConfirmationUpdated	AFRU	Confirmation fields	Value changed	AFRU ↔ AFVC	Confirmation updated
OperationCompleted	AFRU/AFVC	Operation status	Completed	AFVC ↔ Process Order	Operation completed
18. Batch
Event	SAP Table	SAP Field	Operator / Condition	Required Join	Result
ProductionBatchCreated	Batch master / MATDOC	CHARG	New production batch	CHARG + MATNR + WERKS	Batch created
ProductionBatchUpdated	Batch master	Batch fields	Value changed	MATNR + CHARG + WERKS	Batch updated
ProductionBatchCompleted	MATDOC/Process Order	Batch/order status	Production completed	Batch ↔ Process Order	Batch completed
19. Batch Transformation
Event	SAP Table	SAP Field	Operator / Condition	Required Join	Result
BatchTransformationCreated	AUFK/AFKO/AFPO + MATDOC	AUFNR/CHARG	Input-output batch relationship created	Process Order ↔ MATDOC batches	Transformation created
BatchMerged	MATDOC	CHARG/AUFNR	Multiple input batches → one output batch	Process Order + batch relationships	Batches merged
BatchSplit	MATDOC	CHARG/AUFNR	One input batch → multiple output batches	Process Order + batch relationships	Batch split
BatchReworked	AUFK/AFKO/AFPO	AUFNR + CHARG	Existing batch processed again	Process Order ↔ batch	Batch reworked
BatchTransformationCompleted	AUFK/AFKO/AFPO	Order status	Transformation Process Order completed	Process Order ↔ batches	Transformation completed
20. Production Yield / Scrap
Event	SAP Table	SAP Field	Operator / Condition	Required Join	Result
YieldRecorded	MATDOC	BWART	= 101 AND AUFNR IS NOT NULL	MATDOC.AUFNR = AFKO.AUFNR	Production yield recorded
YieldAdjusted	MATDOC	MENGE	Yield quantity adjusted	MATDOC ↔ Process Order	Yield adjusted
21. Master Inspection Characteristic
Event	SAP Table	SAP Field	Operator / Condition	Required Join	Result
InspectionCharacteristicCreated	QPMK	Characteristic key	New record	—	Characteristic created
InspectionCharacteristicChanged	QPMK	Characteristic fields	Value changed	—	Characteristic changed
22. Inspection Plan
Event	SAP Table	SAP Field	Operator / Condition	Required Join	Result
InspectionPlanCreated	PLKO/PLPO/PLMK/MAPL	Plan key	New plan	Plan-key joins	Inspection plan created
InspectionPlanChanged	PLKO/PLPO/PLMK/MAPL	Plan/operation fields	Value changed	Plan-key joins	Inspection plan changed
23. Quality Inspection Parameters
Event	SAP Table	SAP Field	Operator / Condition	Required Join	Result
InspectionParameterAssigned	QMAT/QINF	Material/inspection assignment	Assignment exists	Material ↔ inspection parameter	Parameter assigned
InspectionParameterChanged	QMAT/QINF	Parameter fields	Value changed	Material ↔ inspection parameter	Parameter changed
24. Quality Inspection Lot
Event	SAP Table	SAP Field	Operator / Condition	Required Join	Result
InspectionLotCreated	QALS	PRUEFLOS	New inspection lot	Material/batch context	Inspection lot created
InspectionStarted	QALS	Lot status	Inspection started	QALS ↔ quality records	Inspection started
InspectionCompleted	QALS	Lot status	Inspection completed	QALS ↔ quality records	Inspection completed
InspectionLotStatusChanged	QALS/QAST	Status	Previous ≠ current	QALS ↔ QAST	Lot status changed
25. Sampling
Event	SAP Table	SAP Field	Operator / Condition	Required Join	Result
SampleCreated	QALS/QAMR/QASR	Sample key	New sample	Inspection lot ↔ sample	Sample created
SampleCollected	QAMR/QASR	Sample status/date	Collected	Inspection lot ↔ sample	Sample collected
SampleUpdated	QAMR/QASR	Sample fields	Value changed	Inspection lot ↔ sample	Sample updated
SampleCompleted	QAMR/QASR	Sample status	Completed	Inspection lot ↔ sample	Sample completed
26. Quality Inspection Result
Event	SAP Table	SAP Field	Operator / Condition	Required Join	Result
InspectionResultRecorded	QAMR/QAMV/QASE/QASR	Result/value field	New result	Inspection lot + characteristic joins	Result recorded
InspectionResultChanged	QAMR/QAMV/QASE/QASR	Result/value field	Previous ≠ current	Inspection lot + characteristic joins	Result changed
27. Quality Usage Decision
Event	SAP Table	SAP Field	Operator / Condition	Required Join	Result
QualityDecisionRecorded	QAVE	Usage decision	New decision	QAVE ↔ QALS	Quality decision recorded
QualityDecisionChanged	QAVE	Usage decision	Previous ≠ current	QAVE ↔ QALS	Quality decision changed
28. Customer
Event	SAP Table	SAP Field	Operator / Condition	Required Join	Result
CustomerCreated	KNA1	KUNNR	New record	—	Customer created
CustomerUpdated	KNA1/KNVV/KNVP/ADR6	Customer fields	Value changed	KUNNR-based joins	Customer updated
CustomerBlocked	KNA1/KNVV	Status/block field	Blocked	KUNNR-based joins	Customer blocked
CustomerUnblocked	KNA1/KNVV	Status/block field	Unblocked	KUNNR-based joins	Customer unblocked
29. Sales Order
Event	SAP Table	SAP Field	Operator / Condition	Required Join	Result
SalesOrderCreated	VBAK	VBELN	New record	—	Sales order created
SalesOrderChanged	VBAK/VBUK/VBPA	Relevant fields	Value changed	VBELN	Sales order changed
SalesOrderConfirmed	VBUK/VBAP	Confirmation/status	Confirmed	VBAK.VBELN = VBAP.VBELN	Sales order confirmed
SalesOrderCancelled	VBAK/VBUK	Status	Cancelled	VBELN	Sales order cancelled
SalesOrderCompleted	VBUK	Completion status	Completed	VBELN	Sales order completed
30. Sales Order Item
Event	SAP Table	SAP Field	Operator / Condition	Required Join	Result
SalesOrderItemAdded	VBAP	VBELN/POSNR	New item	VBAP.VBELN = VBAK.VBELN	Item added
QuantityChanged	VBAP	Ordered quantity	Previous ≠ current	VBELN/POSNR	Quantity changed
DeliveryDateChanged	VBAP	Delivery date	Previous ≠ current	VBELN/POSNR	Delivery date changed
ItemConfirmed	VBUP/VBAP	Item status	Confirmed	VBAP ↔ VBUP	Item confirmed
ItemCancelled	VBUP/VBAP	Item status	Cancelled/rejected	VBAP ↔ VBUP	Item cancelled
31. Sales Batch Allocation
Event	SAP Table	SAP Field	Operator / Condition	Required Join	Result
BatchAllocated	LIPS	CHARG	Batch populated	LIPS.VBELN/POSNR ↔ delivery	Batch allocated
BatchAllocationChanged	LIPS	CHARG	Previous ≠ current	Delivery item	Batch allocation changed
BatchDeallocated	LIPS	CHARG	Previously populated → NULL	Delivery item	Batch deallocated
BatchAllocationConfirmed	LIPS	CHARG/status	Allocation confirmed	Delivery item + batch	Batch allocation confirmed
32. Outbound Delivery
Event	SAP Table	SAP Field	Operator / Condition	Required Join	Result
DeliveryCreated	LIKP	VBELN	New delivery	—	Delivery created
DeliveryChanged	LIKP/LIPS	Delivery fields	Value changed	LIKP.VBELN = LIPS.VBELN	Delivery changed
DeliveryReleased	LIKP	Release/status field	Released	—	Delivery released
DeliveryPicked	LIPS	Picking status	Picked	LIKP.VBELN = LIPS.VBELN	Delivery picked
DeliveryShipped	MATDOC	BWART	GI posted for delivery	MATDOC delivery reference ↔ LIPS/LIKP	Delivery shipped
DeliveryCompleted	LIKP	Completion/status	Completed	—	Delivery completed
DeliveryCancelled	LIKP	Cancellation/status	Cancelled	—	Delivery cancelled
33. Delivery Item
Event	SAP Table	SAP Field	Operator / Condition	Required Join	Result
DeliveryItemCreated	LIPS	VBELN/POSNR	New item	LIPS.VBELN = LIKP.VBELN	Delivery item created
QuantityChanged	LIPS	LFIMG	Previous ≠ current	VBELN/POSNR	Quantity changed
BatchAssigned	LIPS	CHARG	IS NOT NULL	Delivery item ↔ batch	Batch assigned
ItemPicked	LIPS	Picking status	Picked	Delivery item	Item picked
ItemShipped	MATDOC/LIPS	GI reference/status	GI posted	MATDOC ↔ delivery item	Item shipped
ItemDelivered	LIPS/LIKP	Delivery status	Completed	Delivery item ↔ delivery	Item delivered
34. Billing Document
Event	SAP Table	SAP Field	Operator / Condition	Required Join	Result
InvoiceCreated	VBRK/VBRP	VBELN/POSNR	New billing document	VBRK.VBELN = VBRP.VBELN	Invoice created
InvoicePosted	VBRK	Posting/accounting status	Posted	VBRK ↔ VBRP	Invoice posted
InvoiceCancelled	VBRK/VBRP	Cancellation/reference	Cancellation exists	VBRK ↔ VBFA	Invoice cancelled
InvoiceAdjusted	VBRK/VBRP	Adjustment/reference	Adjustment document exists	VBRK ↔ VBFA	Invoice adjusted
35. Sales Return
Event	SAP Table	SAP Field	Operator / Condition	Required Join	Result
ReturnRequested	VBAK/VBFA	Document/category	Return request created	VBFA document flow	Return requested
ReturnCreated	VBAK/LIKP	VBELN	Return document created	VBFA	Return created
ReturnReceived	MATDOC	BWART	Receipt movement for return	MATDOC ↔ return delivery	Return received
ReturnInspected	QALS	PRUEFLOS/status	Inspection lot exists for return	QALS ↔ return batch/material	Return inspected
ReturnAccepted	Return status	Acceptance field	Accepted	Return document flow	Return accepted
ReturnRejected	Return status	Rejection field	Rejected	Return document flow	Return rejected
ReturnCompleted	Return status	Completion field	Completed	Return document flow	Return completed
36. GRN

This is your additional 36th object.

Event	SAP Table	SAP Field	Operator / Condition	Required Join	Result
GRNCreated	MATDOC	MBLNR/MJAHR/ZEILE	New material document item	—	GRN created
GRNPosted	MATDOC	BWART	= 101 AND EBELN IS NOT NULL AND EBELP IS NOT NULL	MATDOC.EBELN = EKPO.EBELN AND MATDOC.EBELP = EKPO.EBELP	Procurement GRN posted
GRNReversed	MATDOC	Reversal/reference fields	Reversal of original GRN	Original MATDOC document	GRN reversed
BatchReceived	MATDOC	CHARG	IS NOT NULL + GRN condition	MATDOC ↔ EKPO	Batch received
QuantityReceived	MATDOC	MENGE	> 0 + GRN condition	MATDOC ↔ EKPO	Quantity received
The most important field-level rules

For your Relationship Resolver/Event Resolver, these are especially important:

Event	Rule
GRNPosted	MATDOC.BWART = 101 AND EBELN IS NOT NULL AND EBELP IS NOT NULL
YieldRecorded	MATDOC.BWART = 101 AND AUFNR IS NOT NULL
MaterialConsumptionPosted	MATDOC.BWART = 261 AND AUFNR IS NOT NULL
BatchAssigned	Batch field CHARG IS NOT NULL in the relevant delivery/reservation context
PlannedOrderConverted	Planned Order has a valid relationship/reference to a Process Order
Purchase Order → PR	PO must resolve back to its Purchase Requisition through the available SAP reference
GRN → PO	MATDOC.EBELN = EKPO.EBELN + MATDOC.EBELP = EKPO.EBELP
Material Movement	Primarily determined from MATDOC.BWART
Batch Transformation	Derived from Process Order + input/output batch relationships