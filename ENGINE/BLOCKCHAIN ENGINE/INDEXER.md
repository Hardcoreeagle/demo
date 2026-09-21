# INDEXER (OPTIONAL — not used by default)

> **Default Pharma Trace path stores off-chain metadata as local JSON under
> `deployments/`.** You do **not** need PostgreSQL for GS1 → Testnet anchoring.
>
> Use this indexer only if you later want DB queries. Skip it for new-laptop
> setup and for `check:gs1-flow` / `anchor-batch` / `test:e2e:testnet`.

Operational index of `BatchAnchored` events (#46). **Not the source of truth** —
VeChainThor state is authoritative; this database serves queries and audits.

```
BatchIntegrityAnchor.sol
        |  BatchAnchored event
        v
BatchAnchoredEventWatcher   (Thorest POST /logs/event polling)
        v
IndexerService              (idempotent upserts)
        v
PostgreSQL                  (anchored_batches, status history)
```

## Components

| File | Role |
|---|---|
| `src/indexer/EventWatcher.ts` | polls Thorest `POST /logs/event` with topic0 filter; decodes events; checkpointed |
| `src/indexer/IndexerService.ts` | idempotent persistence + query API (`getLatestAnchor`, `getVersionHistory`, `findByMerkleRoot`) |
| `src/indexer/schema.sql` | idempotent schema (safe to re-apply on every start) |
| `scripts/run-indexer.ts` | long-running CLI with persisted checkpoint |
| `scripts/dev-postgres.ts` | user-space PostgreSQL for local dev (no admin rights needed) |

## Schema

- `contract_deployments` — one row per followed contract.
- `anchored_batches` — one row per `(contract, batchKey, version)`; unique
  constraints mirror the on-chain guarantees (`uq_anchor_batch_version`,
  `uq_anchor_batch_root`), making redelivery harmless.
- `anchor_status_history` — CONFIRMED/FINALIZED transitions
  (VeChainThor two-block finality).

## Running locally (Thor Solo)

```bash
# 1. Start the node and a database
"$TEMP/thor-solo/thor-windows-amd64.exe" solo --api-addr 127.0.0.1:8669 --api-cors '*'
node scripts/dev-postgres.ts start          # port 5433, user/pass anchors/anchors
node -e "const {Client}=require('pg');const c=new Client({connectionString:'postgres://anchors:anchors@127.0.0.1:5433/postgres'});c.connect().then(()=>c.query('CREATE DATABASE anchors')).then(()=>c.end())"

# 2. Deploy + grant roles + anchor a batch (see DEPLOYMENT.md)

# 3. Run the indexer
INDEXER_DATABASE_URL="postgres://anchors:anchors@127.0.0.1:5433/anchors" \
  npx ts-node scripts/run-indexer.ts
```

The indexer applies the schema on startup, resumes from its checkpoint
(`deployments/indexer-checkpoint-<network>.json`), and logs every row it
writes. Restarting is always safe: persistence is idempotent.

## Why Thorest instead of eth_getLogs

VeChainThor nodes serve the Thorest REST API natively; `POST /logs/event`
accepts `criteriaSet[].topic0` as a flat string, returns `meta.blockTimestamp`
and `meta.txOrigin` per event (no per-log block fetches), and works identically
on Solo, testnet, and mainnet gateways. The watcher caps its range per poll
(900 blocks) to respect node page limits.

## Guarantees and limits

- **Idempotent**: re-processing any log is a no-op (unique constraints + `ON CONFLICT`).
- **At-least-once delivery** between checkpoint saves; combined with idempotency
  this yields effectively-once rows.
- **Finality**: rows land as CONFIRMED; mark FINALIZED after the two-block
  window (`IndexerService.markFinalized`).
- **Never trusted for integrity**: verification always recomputes roots
  off-chain and compares with on-chain state (`scripts/verify-anchor.ts`).
