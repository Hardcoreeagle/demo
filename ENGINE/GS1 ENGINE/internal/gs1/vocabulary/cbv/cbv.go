// Package cbv implements explicit GS1 Core Business Vocabulary (CBV) mapping.
// Internal canonical values (e.g. COATING_AND_PACKAGING) are NOT CBV values;
// they are only emitted after an explicit mapping exists. Unknown values
// produce CBV_MAPPING_NOT_FOUND — vocabulary is never invented.
package cbv

import "gs1-engine/internal/errors"

// CBV 1.2 standard values used by this engine (subset relevant to the
// supported canonical events).
var (
	// CBVBusinessSteps maps canonical event semantics to CBV bizStep URIs
	// (https://ref.gs1.org/cbv/BizStep-1.2 style values used by EPCIS 2.0).
	CBVBusinessSteps = map[string]string{
		"GRNPosted":                      "urn:epcglobal:cbv:bizstep:receiving",
		"BatchReceived":                  "urn:epcglobal:cbv:bizstep:receiving",
		"GoodsReceiptPosted":             "urn:epcglobal:cbv:bizstep:receiving",
		"GoodsIssuePosted":               "urn:epcglobal:cbv:bizstep:shipping",
		"DeliveryShipped":                "urn:epcglobal:cbv:bizstep:shipping",
		"MaterialConsumptionPosted":      "urn:epcglobal:cbv:bizstep:commissioning", // consumption context of a commissioning transformation
		"BatchTransformationCompleted":   "urn:epcglobal:cbv:bizstep:commissioning",
		"YieldRecorded":                  "urn:epcglobal:cbv:bizstep:commissioning",
		"ProductionConfirmationRecorded": "urn:epcglobal:cbv:bizstep:commissioning",
		"OperationCompleted":             "urn:epcglobal:cbv:bizstep:commissioning",
		"InspectionLotCreated":           "urn:epcglobal:cbv:bizstep:quality_testing",
		"InspectionStarted":              "urn:epcglobal:cbv:bizstep:quality_testing",
		"SampleCreated":                  "urn:epcglobal:cbv:bizstep:quality_testing",
		"InspectionResultRecorded":       "urn:epcglobal:cbv:bizstep:quality_testing",
		"QualityDecisionRecorded":        "urn:epcglobal:cbv:bizstep:quality_testing",
		"ReturnCreated":                  "urn:epcglobal:cbv:bizstep:receiving", // customer return receiving
	}

	// CBVDispositions maps canonical quality/status outcomes to CBV
	// disposition URIs.
	CBVDispositions = map[string]string{
		"ACCEPT":    "urn:epcglobal:cbv:disp:sellable_accessible",
		"A":         "urn:epcglobal:cbv:disp:sellable_accessible",
		"ACCEPTED":  "urn:epcglobal:cbv:disp:sellable_accessible",
		"ACTIVE":    "urn:epcglobal:cbv:disp:active",
		"PASSED":    "urn:epcglobal:cbv:disp:active",
		"REJECTED":  "urn:epcglobal:cbv:disp:unsellable",
		"BLOCKED":   "urn:epcglobal:cbv:disp:unsellable_not_accessible",
		"COMPLETED": "urn:epcglobal:cbv:disp:active",
	}

	// CBVTransactionTypes maps canonical transaction object names to CBV
	// bizTransaction type URIs.
	CBVTransactionTypes = map[string]string{
		"purchase_order": "urn:epcglobal:cbv:biztransaction:po",
		"sales_order":    "urn:epcglobal:cbv:biztransaction:po",
		"invoice":        "urn:epcglobal:cbv:biztransaction:asn",
	}
)

// BusinessStep resolves the CBV bizStep for a canonical event name.
func BusinessStep(eventName, eventID string) (string, error) {
	if uri, ok := CBVBusinessSteps[eventName]; ok {
		return uri, nil
	}
	return "", errors.New(errors.CodeCBVMappingNotFound, eventID,
		"no CBV bizStep mapping for canonical event %q", eventName)
}

// Disposition resolves the CBV disposition for a canonical status value.
func Disposition(status, eventID string) (string, error) {
	if uri, ok := CBVDispositions[status]; ok {
		return uri, nil
	}
	return "", errors.New(errors.CodeCBVMappingNotFound, eventID,
		"no CBV disposition mapping for status %q", status)
}

// TransactionType resolves the CBV bizTransaction type for a canonical
// transaction object role.
func TransactionType(role, eventID string) (string, error) {
	if uri, ok := CBVTransactionTypes[role]; ok {
		return uri, nil
	}
	return "", errors.New(errors.CodeCBVMappingNotFound, eventID,
		"no CBV bizTransaction type mapping for role %q", role)
}
