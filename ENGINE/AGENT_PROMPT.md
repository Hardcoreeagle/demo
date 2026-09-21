# Agent & Prompt Guide — Pharma Trace ENGINE

Use this when starting a **new Cursor agent session** on this repo, or when writing prompts for another engineer/agent.

Also read: [`NEW_LAPTOP_SETUP.md`](./NEW_LAPTOP_SETUP.md)

---

## 1. Project map (do not invent paths)

```text
ENGINE/
├── NEW_LAPTOP_SETUP.md          ← human setup
├── AGENT_PROMPT.md              ← this file
├── GS1 ENGINE/                  ← Go: Canonical → EPCIS (no blockchain)
└── BLOCKCHAIN ENGINE/           ← Node/Hardhat: EPCIS → SHA-256/Merkle → VeChain
```

**Data flow (file-based, not process coupling):**

```text
GS1 ENGINE/output/epcis_pf05043/*.json
        ↓  (Blockchain loads files)
IntegrityEngine (SHA-256 + Merkle)
        ↓
VeChainThorAnchorClient
        ↓
BatchIntegrityAnchor @ vechain_testnet (https://testnet.vechain.org)
```

---

## 2. Hard boundaries (never violate)

### GS1 ENGINE

- Consume Canonical only. Do **not** redesign Canonical, SAP extraction, or joins.
- Do **not** add blockchain, Merkle, VeChain, or Solidity into GS1.
- No logistics domain (no shipping-as-sales inventing logistics partition).
- Output: domain EPCIS JSON under `output/…`.

### BLOCKCHAIN ENGINE

- Do **not** generate or rewrite EPCIS business content.
- Do **not** put EPCIS JSON / PII / genealogy on-chain.
- On-chain: opaque `batchKey`, `merkleRoot`, `datasetHash`, `eventCount` only.
- Hashing is **SHA-256 off-chain**. Do **not** replace with Keccak for integrity roots.
- Solidity **0.8.20**, `shanghai`, Hardhat + `@vechain/sdk-hardhat-plugin`.
- No Foundry / Truffle / old VeChain plugins unless explicitly requested.
- No upgradeability. Append-only versioning. `ANCHOR_ROLE` ≠ admin.
- Prefer **VeChain Testnet**. Do **not** require Docker / Solo for the primary path.
- Never print, commit, or log `VECHAIN_MNEMONIC` / `VECHAIN_PRIVATE_KEY`.

---

## 3. How to prompt a new agent

### Good prompt template

Copy and fill:

```text
Work in: <ENGINE_ROOT> — the folder containing both "GS1 ENGINE" and
"BLOCKCHAIN ENGINE". Discover it dynamically (do not hardcode an absolute path);
run `. .\setup-env.ps1` to set $ENGINE_ROOT / $GS1_ENGINE / $BLOCKCHAIN_ENGINE.

Context:
- Read NEW_LAPTOP_SETUP.md and AGENT_PROMPT.md first.
- GS1 ENGINE = Go EPCIS producer (files only).
- BLOCKCHAIN ENGINE = VeChain integrity anchor (reads GS1 output).
- Primary network: vechain_testnet (https://testnet.vechain.org).
- Credentials are already in BLOCKCHAIN ENGINE/.env (do not ask me to paste them).

Task:
<one clear goal, e.g. "Fix Testnet deploy failure" or "Add verification script">

Constraints:
- Do not change GS1 hashing/EPCIS mapping unless the task is GS1-specific.
- Do not change BatchIntegrityAnchor business logic unless required.
- Do not mock Testnet success.
- Do not use Docker/Solo unless I explicitly ask.
- Never expose .env secrets in chat or commits.

Acceptance:
<e.g. npm run deploy:testnet succeeds; npm run test:e2e:testnet → 2 passing>
```

### Bad prompts (avoid)

| Bad | Why |
|---|---|
| “Fix blockchain” | Too vague; which layer? |
| “Add my mnemonic here: …” | Secrets in chat |
| “Use Solo / Docker to prove Testnet” | Wrong target |
| “Put EPCIS JSON on-chain” | Violates design |
| “Rewrite GS1 and Blockchain together” | Crosses boundaries; prefer one engine per task |

---

## 4. Agent startup checklist

Before editing code, the agent should:

1. Confirm workspace is `ENGINE` (both engines present).
2. Read `NEW_LAPTOP_SETUP.md` + this file.
3. Inspect relevant files only (do not rewrite unrelated trees).
4. Check whether GS1 output exists if the task needs E2E.
5. For Testnet: verify `.env` exists locally; **never** dump its contents.
6. Prefer existing scripts: `check:testnet`, `deploy:testnet`, `test:e2e:testnet`.

---

## 5. Task playbooks (prompt starters)

### A. New laptop / greenfield run

```text
Follow NEW_LAPTOP_SETUP.md end-to-end.
Install deps, run GS1 to output/epcis_pf05043, configure Blockchain .env
(without asking me to paste secrets), check:testnet, deploy if needed,
run test:e2e:testnet. Report PASS/FAIL with contract address and tx hash only.
```

### B. GS1-only change

```text
Work only under GS1 ENGINE.
Do not touch BLOCKCHAIN ENGINE.
Preserve Canonical-consumer architecture and no-logistics rule.
Run go test ./... and regenerate output/epcis_pf05043 if mapping changes.
```

### C. Blockchain / Testnet change

```text
Work only under BLOCKCHAIN ENGINE.
Do not modify GS1 ENGINE source.
Keep SHA-256/Merkle and BatchIntegrityAnchor semantics.
Target vechain_testnet only unless I ask otherwise.
Prove with npm run test:e2e:testnet (real chain, no mocks).
```

### D. Data-flow verification

```text
Verify GS1 → Blockchain file handoff using existing scripts
(check-gs1-flow.ts and/or test:e2e:testnet).
Do not invent a new coupling (HTTP/queue) unless I request it.
Report which GS1 file was loaded, event counts, Merkle roots, and on-chain match.
```

### E. Deploy / resolveName / wallet issues

```text
Do not ask for mnemonic/private key in chat.
Use .env. Exactly one of VECHAIN_MNEMONIC or VECHAIN_PRIVATE_KEY.
Empty DEPLOYMENT_ADMIN_ADDRESS must fall back to deployer hex address
(never pass "" into factory.deploy — triggers resolveName).
No Solo/Docker fallback for Testnet tasks.
```

---

## 6. Commands agents should use

| Intent | Command |
|---|---|
| GS1 generate | `go run ./cmd/gs1-engine ... --output output/epcis_pf05043` |
| Compile | `npm run compile` (BLOCKCHAIN ENGINE) |
| Unit + local E2E | `npm test` |
| Testnet ready? | `npm run check:testnet` |
| Deploy | `npm run deploy:testnet` |
| Real GS1 E2E | `npm run test:e2e:testnet` |
| Flow dump | `npx ts-node scripts/check-gs1-flow.ts` |

Always `cd` into the correct engine folder first.

---

## 7. Reporting format for agents

When finishing a Testnet-related task, report:

```text
Compilation: PASS/FAIL
Unit/local E2E: PASS/FAIL
Testnet connectivity: PASS/FAIL
Deployment: PASS/FAIL | N/A
Contract address: 0x... (if any)
Transaction hash: 0x... (if any)
GS1 Testnet E2E: PASS/FAIL | N/A
Files changed: <list>
Secrets exposed: NO
```

If blocked, use an explicit code:

```text
MISSING_TESTNET_CREDENTIALS
INSUFFICIENT_TESTNET_FUNDS
TESTNET_RPC_UNAVAILABLE
WRONG_NETWORK
CONTRACT_DEPLOYMENT_FAILED
GS1_E2E_FAILED
```

Do not fake success.

---

## 8. One-liner to start a new agent

Paste this as the first message:

```text
You are working in ENGINE (GS1 ENGINE + BLOCKCHAIN ENGINE).
Read NEW_LAPTOP_SETUP.md and AGENT_PROMPT.md first.
Respect engine boundaries. Prefer VeChain Testnet. Never expose .env secrets.
Then: <YOUR TASK HERE>
```
