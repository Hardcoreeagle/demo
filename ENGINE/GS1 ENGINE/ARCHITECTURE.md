# GS1 Engine — Architecture

```text
Canonical Input
      ↓
Normalization
      ↓
Classification
      ↓
Relationship Resolution
      ↓
GS1 Resolution
      ↓
CBV Mapping
      ↓
EPCIS Mapping
      ↓
Validation
      ↓
Domain Output
```

**Logistics is not implemented. Transportation/VTTK/VTTP are outside scope.**

## Stage map to code

| Stage | Package | Responsibility |
| --- | --- | --- |
| Canonical Input | `internal/canonical/model`, `internal/canonical/source` | Typed loading of `business_events.json` (primary event stream) and `finished_batch_genealogy.json` (context + relationships). Pointer fields for optional canonical values; `""`/`null` treated as absent. JSON key order preserved for deterministic traversal. |
| Normalization | `internal/normalization` | Timestamp normalization (`YYYY-MM-DD` → time), identifier trimming, empty→absent handling, quantity/UOM extraction from canonical descriptions (enrichment only). |
| Classification | `internal/classifier` | Every normalized record → `MASTER_DATA`, `BUSINESS_CONTEXT`, `VISIBILITY_EVENT`, `GENEALOGY_CONTEXT`, or `UNSUPPORTED_EVENT`. Only visibility events become EPCIS candidates; unknown names are never silently mapped. |
| Relationship Resolution | `internal/relationship` | Consumes the canonical genealogy: `batch_transformation`, `process_order`, `semifinished_stage`, raw-material flows. Resolves input/output batches, per-batch plant/material, quality→batch→plant, and transformation completion evidence. **No SAP joins.** Absent links → `RELATIONSHIP_NOT_FOUND`. |
| GS1 Resolution | `internal/gs1/identifier` | Explicit-only resolvers: GTIN (material), GLN (plant), SSCC, LGTIN/EPC (batch). Canonical IDs are never assumed to be GS1 keys; without an explicit map the engine emits namespaced internal URNs (`urn:internal:...`). Errors: `GS1_IDENTIFIER_NOT_RESOLVED`, `GS1_GTIN_NOT_FOUND`, `GS1_GLN_NOT_FOUND`. |
| CBV Mapping | `internal/gs1/vocabulary/cbv` | Explicit Go maps for `bizStep`, `disposition`, transaction types. Unmapped values → `CBV_MAPPING_NOT_FOUND`; no passthrough of internal canonical values. |
| EPCIS Mapping | `internal/mapping`, `internal/epcis/event` | Domain mappers construct EPCIS events (WHAT/WHEN/WHERE/WHY dimensions). Production transformations are built from the canonical genealogy (see below). Deterministic physical-occurrence identity drives deduplication (`DUPLICATE_EVENT`). |
| Validation | `internal/epcis/document` | EPCIS 2.0.1 semantic checks (document shape, per-type required fields, actions, timezone, dates). Invalid documents are not written (`EPCIS_VALIDATION_FAILED`). |
| Domain Output | `internal/pipeline`, `cmd/gs1-engine` | Partitioning into `planning | procurement | production | quality | sales | returns` (no logistics), deterministic JSON writing, run summary. |

## Data flow decisions

### Primary vs. context input
`business_events.json` is the only source of EPCIS *candidates*. The genealogy
file contributes *structure* (genealogy, quantities, plants, relationships),
never independent events. Lifecycle entries (`events: [...]`) attached to
canonical business objects are context only.

### Physical-event identity and deduplication
Identity = `physicalKind | entityKey | movementType | batch | material | plant`,
where `physicalKind` collapses canonical event names that describe the same
occurrence:

- `GRNPosted` / `BatchReceived` / `GoodsReceiptPosted` → `GOODS_RECEIPT:<material doc>:<mvtype>`
- `GoodsIssuePosted` / `DeliveryShipped` → `GOODS_ISSUE:<material doc>:<mvtype>`

Thus movement `101` with PO reference restating a goods receipt never produces a
second EPCIS event, and duplicate physical representations are prevented while
the canonical model's normalized representation is preserved.

### Production transformation (first end-to-end path)
The canonical event stream carries `BatchTransformationCreated` (context); the
physical transformations are the canonical `batch_transformation` objects with
`status: COMPLETED`. The engine therefore builds TransformationEvents from the
canonical genealogy:

1. Top-level finished transformation (`TRANS-PF05043`: core + API + coating
   batches → `PF05043`, quantities/UOM from `consumed_batches` /
   `produced_product`).
2. Semi-finished transformation (`TRANS-SFG-001`: API → core).
3. Raw-material-flow transformations only when their output batch is not
   already covered (a flow restating the same output is a partial view of the
   same physical transformation).

Completion time is taken from canonical evidence only (process-order
actual/basic dates, confirmation or posting dates). `YieldRecorded` events for
an output batch already represented by a canonical transformation are absorbed
(spec §17); remaining yields map to their own ObjectEvents. Movement-261
consumption events remain dedicated input-context events.

### Determinism
- No reliance on Go map iteration order: canonical key order is extracted from
  raw JSON; all traversals are ordered by canonical role, process order, or
  transformation ID; outputs are sorted by (`eventTime`, `type`, `eventID`).
- Struct-based JSON with fixed field order; fixed default `creationDate`
  (overridable via CLI) so repeated runs are byte-identical.

## Error taxonomy

`CANONICAL_INPUT_INVALID`, `CANONICAL_NORMALIZATION_FAILED`,
`RELATIONSHIP_NOT_FOUND`, `GS1_IDENTIFIER_NOT_RESOLVED`, `GS1_GTIN_NOT_FOUND`,
`GS1_GLN_NOT_FOUND`, `CBV_MAPPING_NOT_FOUND`, `EPCIS_MAPPING_FAILED`,
`EPCIS_VALIDATION_FAILED`, `DUPLICATE_EVENT`, `UNSUPPORTED_EVENT` —
defined in `internal/errors` with event IDs and context for debugging.

## Explicit non-goals

- SAP extraction, SQL joins, event detection, change detection
- Canonical object/relationship reconstruction
- ERP/MES ingestion
- Transportation integration (VTTK/VTTP), logistics domain
- SHA-256, Merkle trees/proofs, blockchain, smart contracts, blockchain adapters
- Traceability engine, counterfeit detection, AI/ML

The GS1 Engine ends at validated, domain-partitioned EPCIS JSON — exactly the
input those downstream systems would later require.
