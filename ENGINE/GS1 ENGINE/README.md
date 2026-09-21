# GS1 Engine

**New laptop / full platform setup:** see [`../NEW_LAPTOP_SETUP.md`](../NEW_LAPTOP_SETUP.md)  
**New agent prompts:** see [`../AGENT_PROMPT.md`](../AGENT_PROMPT.md)

The GS1 Engine is a downstream consumer of an already-built **Canonical Model**.
It consumes the final canonical output and produces validated, domain-partitioned
**GS1 EPCIS 2.0.1 JSON**.

```text
Canonical Model  ->  GS1 Identifiers  ->  CBV  ->  EPCIS 2.0.1  ->  Validated EPCIS JSON
```

It does **not** reconstruct the Canonical Model, SAP joins, event detection, or
relationships. It consumes them as given. It also does **not** implement any
downstream system (no blockchain, Merkle trees, traceability engine, counterfeit
detection, or AI/ML).

## Purpose

Given the canonical model output, answer: *what happened, when, where, why —
in GS1 EPCIS 2.0.1 form — for each physical supply-chain occurrence*, without
duplicating physical events and without inventing identifiers or vocabulary.

## Input files

```text
input/canonical/business_events.json            # primary event stream
input/canonical/finished_batch_genealogy.json   # business-object context + relationships
```

- `business_events.json` is the **primary event stream**.
- `finished_batch_genealogy.json` is **contextual/relationship information**.
- The two files are never treated as independent event streams; no duplicate
  EPCIS events are generated merely because information exists in both.

## CLI

```bash
go run ./cmd/gs1-engine \
  --events input/canonical/business_events.json \
  --genealogy input/canonical/finished_batch_genealogy.json \
  --output output/epcis
```

Optional flags:

| Flag | Meaning |
| --- | --- |
| `--identifiers <file.json>` | Explicit GS1 identifier map (`gtin`, `gln`, `sscc`, `batch_lgtin`). Without it, canonical IDs stay internal references. |
| `--creation-date <RFC3339>` | EPCIS `creationDate`. Default: fixed deterministic value. |

The CLI loads, normalizes, classifies, resolves relationships, resolves GS1
identifiers and CBV vocabulary, constructs EPCIS events, deduplicates,
validates, partitions by domain, writes deterministic JSON files, and prints a
summary (canonical events, EPCIS events generated, duplicates removed,
validation failures, and per-domain counts — planning, procurement, production,
quality, sales, returns). **No logistics count is reported.**

## Output structure

```text
output/epcis/
├── planning/
│   └── epcis-planning.json        # only when valid planning events exist
├── procurement/
│   └── epcis-procurement.json
├── production/
│   └── epcis-production.json
├── quality/
│   └── epcis-quality.json
├── sales/
│   └── epcis-sales.json
└── returns/
    └── epcis-returns.json        # only when valid return events exist
```

There is intentionally **no `logistics/` partition**. Transportation, VTTK,
VTTP, and shipment-transportation modeling are outside GS1 Engine scope.

Domain files are created **only** when valid EPCIS events exist — no empty or
fake events.

## Supported domains

| Domain | Typical EPCIS events | Source |
| --- | --- | --- |
| Planning | none by design | planning records are business context (spec §21) |
| Procurement | ObjectEvents for goods receipt postings (GRN / movement 101) | primary event stream |
| Production | TransformationEvents built from the canonical batch transformation genealogy; consumption/yield ObjectEvents | event stream + genealogy context |
| Quality | ObjectEvents for inspection lot / result / usage-decision visibility | primary event stream (plant via canonical quality→batch relationship) |
| Sales | ObjectEvents for goods issue / delivery shipping | primary event stream |
| Returns | ObjectEvents for sales-return receiving | primary event stream |

Sales orders, invoices, purchase orders, planned orders, master-data lifecycles
and stock balances are business context or master data — they never become
physical EPCIS events.

## EPCIS generation

- Event types used strictly by semantics: `ObjectEvent`,
  `TransformationEvent` (and the engine can construct
  `AggregationEvent`/`TransactionEvent`/`AssociationEvent` structures with
  validation when context supports them).
- **Deduplication:** deterministic physical-event identity
  (`type class | entity key | movement type | batch | material | plant`).
  `GRNPosted` + `BatchReceived` on the same material document are one
  occurrence; `GoodsIssuePosted` + `DeliveryShipped` likewise. Movement 101
  with PO reference restates the goods receipt and does not double-emit.
- **Batch transformation:** `BatchTransformationCompleted` context resolves
  input batches → transformation → output batch from the canonical
  `batch_transformation` object (with per-input quantities/UOM), preserving
  `RM → SFG → FG` genealogy exactly as the canonical model provides it.
  Per-flow transformation views that restate the same output batch are
  collapsed; `YieldRecorded` enriches/absorbs into the same physical
  transformation instead of duplicating it.
- **GS1 identifiers:** material ≠ GTIN, plant ≠ GLN, batch ≠ GTIN. GTIN/GLN/
  SSCC/LGTIN resolution happens **only** through the explicit identifier map
  (`--identifiers`). Without a mapping, EPC/location references are emitted as
  clearly namespaced internal URNs (`urn:internal:...`) — never fabricated GS1
  keys.
- **CBV:** `bizStep`/`disposition` values come from explicit Go maps
  (`internal/gs1/vocabulary/cbv`). Unmapped values produce
  `CBV_MAPPING_NOT_FOUND`; internal canonical values such as
  `COATING_AND_PACKAGING` are never passed through as CBV.

## Validation

Every generated document is validated against EPCIS 2.0.1 semantics before
writing: document shape (`@context`, `type`, `schemaVersion`, RFC3339 dates),
per-event required fields per event type, action values, timezone offset
format, and presence of WHAT (EPC/quantity lists) / WHEN / WHERE dimensions.
Failing documents are not written; failures are reported as
`EPCIS_VALIDATION_FAILED`.

## Testing

```bash
go test ./tests/       # full suite
go test ./...          # includes package-level checks
```

Coverage follows spec §30: input parsing (valid/invalid/missing), timestamp and
quantity normalization, classification (context/master-data/visibility/genealogy
/unsupported), relationship and genealogy resolution, GS1 identifier resolution
including "never fabricated" cases, CBV valid/invalid mappings, all EPCIS event
types plus document validation, deduplication of `GoodsReceipt + movement 101`,
byte-level determinism of repeated runs, and the full CLI pipeline.

## Scope boundary

Implemented: Canonical input → normalization → classification → relationship
consumption → GS1 identifier resolution → CBV mapping → EPCIS 2.0.1
construction → validation → domain output.

Not implemented (downstream or out of scope): SAP extraction/joins, event
detection, canonical model construction, transportation/VTTK/VTTP, logistics
domain, SHA-256/Merkle/blockchain, smart contracts, blockchain adapters,
traceability engine, counterfeit detection, AI/ML.
