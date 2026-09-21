# Pharma Trace ENGINE

Monorepo-style workspace for pharmaceutical batch integrity:

| Folder | Purpose |
|---|---|
| [`GS1 ENGINE`](./GS1%20ENGINE/) | Canonical → GS1 EPCIS 2.0.1 JSON (Go) |
| [`BLOCKCHAIN ENGINE`](./BLOCKCHAIN%20ENGINE/) | EPCIS → SHA-256/Merkle → VeChain `BatchIntegrityAnchor` |

## Start here

| Audience | Doc |
|---|---|
| **New laptop / human setup** | [`NEW_LAPTOP_SETUP.md`](./NEW_LAPTOP_SETUP.md) |
| **New Cursor agent / prompts** | [`AGENT_PROMPT.md`](./AGENT_PROMPT.md) |
| GS1 details | [`GS1 ENGINE/README.md`](./GS1%20ENGINE/README.md) |
| Blockchain details | [`BLOCKCHAIN ENGINE/README.md`](./BLOCKCHAIN%20ENGINE/README.md) |

## Quick path (already set up)

```powershell
# 1) GS1
cd ".\GS1 ENGINE"
go run ./cmd/gs1-engine --events input\canonical\business_events.json --genealogy input\canonical\finished_batch_genealogy.json --output output\epcis_pf05043

# 2) Blockchain Testnet
cd "..\BLOCKCHAIN ENGINE"
npm run check:testnet
npm run test:e2e:testnet
```
