// Package errors defines the typed, domain-specific error taxonomy of the
// GS1 Engine. Every failure mode maps to one of the documented error codes so
// callers can branch precisely and the pipeline summary stays debuggable.
package errors

import "fmt"

// Canonical error codes.
const (
	CodeCanonicalInputInvalid        = "CANONICAL_INPUT_INVALID"
	CodeCanonicalNormalizationFailed = "CANONICAL_NORMALIZATION_FAILED"
	CodeRelationshipNotFound         = "RELATIONSHIP_NOT_FOUND"
	CodeGS1IdentifierNotResolved     = "GS1_IDENTIFIER_NOT_RESOLVED"
	CodeGS1GTINNotFound              = "GS1_GTIN_NOT_FOUND"
	CodeGS1GLNNotFound               = "GS1_GLN_NOT_FOUND"
	CodeGS1SSCCNotFound              = "GS1_SSCC_NOT_FOUND"
	CodeCBVMappingNotFound           = "CBV_MAPPING_NOT_FOUND"
	CodeEPCISMappingFailed           = "EPCIS_MAPPING_FAILED"
	CodeEPCISValidationFailed        = "EPCIS_VALIDATION_FAILED"
	CodeDuplicateEvent               = "DUPLICATE_EVENT"
	CodeUnsupportedEvent             = "UNSUPPORTED_EVENT"
)

// Error is a typed GS1 Engine error carrying a stable code plus context.
type Error struct {
	Code    string
	EventID string
	Detail  string
}

func (e *Error) Error() string {
	if e.EventID != "" {
		return fmt.Sprintf("%s [%s]: %s", e.Code, e.EventID, e.Detail)
	}
	return fmt.Sprintf("%s: %s", e.Code, e.Detail)
}

// New builds a typed error.
func New(code, eventID, format string, args ...interface{}) *Error {
	return &Error{Code: code, EventID: eventID, Detail: fmt.Sprintf(format, args...)}
}

// CodeOf returns the canonical code of err, or "" when err is not typed.
func CodeOf(err error) string {
	if te, ok := err.(*Error); ok {
		return te.Code
	}
	return ""
}

// Sentinel errors for package-level checks.
var (
	ErrCanonicalInputInvalid = New(CodeCanonicalInputInvalid, "", "canonical input invalid")
)
