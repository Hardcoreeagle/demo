# Pharma Trace ENGINE — New Laptop Setup

Complete guide to install and run **GS1 Engine** + **Blockchain Engine** on a new machine, then deploy/verify on **VeChain Testnet**.

For AI agents starting a fresh session, also read:

- [`AGENT_PROMPT.md`](./AGENT_PROMPT.md) — how to prompt and what not to change

---

## Architecture (read once)

```text
Canonical Model inputs
        ↓
   GS1 ENGINE (Go)
        ↓  EPCIS 2.0.1 JSON files on disk
BLOCKCHAIN ENGINE (Node / Hardhat)
        ↓  SHA-256 event hashes → Merkle root
BatchIntegrityAnchor on VeChain Testnet
```

| Engine | Tech | Role |
|---|---|---|
| GS1 ENGINE | Go | Canonical → EPCIS JSON. **No blockchain.** |
| BLOCKCHAIN ENGINE | Node 20+, Hardhat, Solidity 0.8.20 | Hash EPCIS → anchor on VeChain. **Does not generate EPCIS.** |

They are **siblings** under `ENGINE/`. Data moves as **files**, not as a live API.

```text
ENGINE/
├── GS1 ENGINE/
│   └── output/epcis_pf05043/production/epcis-production.json
└── BLOCKCHAIN ENGINE/
    ├── .env                          # secrets — never commit
    └── deployments/vechain_testnet.json
```

Blockchain prefers:

`GS1 ENGINE/output/epcis_pf05043`

Fallback:

`GS1 ENGINE/output/epcis`

---

## 1. Install tools

| Tool | Version | Purpose |
|---|---|---|
| Git | recent | copy/clone repo |
| Go | 1.21+ | GS1 Engine |
| Node.js | **≥ 20** LTS | Blockchain Engine |
| npm | with Node | packages |
| VeWorld (optional) | latest | Testnet wallet |

```powershell
go version
node -v
npm -v
```

**Not required** for Testnet: Docker, Thor Solo, Foundry, Truffle.

---

## 2. Get the project

Copy or clone the full `ENGINE` tree so both folders stay siblings. It can live
anywhere — the workflow discovers its own location. **Do not hardcode a path.**

```text
ENGINE_ROOT/          ← any location, any Windows username
├── GS1 ENGINE/
└── BLOCKCHAIN ENGINE/
```

### Bootstrap the shell (portable — run once per terminal)

From anywhere inside the tree, dot-source the bootstrap. It discovers
`ENGINE_ROOT` by locating the folder that contains **both** engines, exports
`$ENGINE_ROOT`, `$GS1_ENGINE`, `$BLOCKCHAIN_ENGINE`, and — only if needed behind
a TLS-inspecting proxy — sets `NODE_EXTRA_CA_CERTS` dynamically.

```powershell
# cd into the ENGINE folder (the parent of both engines), then:
. .\setup-env.ps1
```

After this, use the `$GS1_ENGINE` and `$BLOCKCHAIN_ENGINE` variables everywhere
instead of typing absolute paths.

---

## 3. Run GS1 Engine first

```powershell
Set-Location $GS1_ENGINE

go mod download

# Defaults are discovered from GS1 ENGINE\input\canonical automatically,
# so the flags below are optional. Pass them to override.
go run ./cmd/gs1-engine `
  --events "input\canonical\business_events.json" `
  --genealogy "input\canonical\finished_batch_genealogy.json" `
  --output "output\epcis_pf05043"
```

If Canonical output lives elsewhere, point `--events` / `--genealogy` there instead.

**Success:** this file exists:

```text
GS1 ENGINE\output\epcis_pf05043\production\epcis-production.json
```

Optional tests:

```powershell
go test ./...
```

---

## 4. Set up Blockchain Engine

```powershell
Set-Location $BLOCKCHAIN_ENGINE

npm install
npm run compile
```

### Create `.env` (never commit)

```powershell
copy .env.example .env
```

Edit `.env`:

```env
VECHAIN_NETWORK=vechain_testnet
VECHAIN_TESTNET_RPC_URL=https://testnet.vechain.org
VECHAIN_CHAIN_ID=100010

# Exactly ONE of these — leave the other blank:
VECHAIN_MNEMONIC=
VECHAIN_PRIVATE_KEY=

# Leave empty so admin = deployer (avoids resolveName errors):
DEPLOYMENT_ADMIN_ADDRESS=

# Filled automatically after deploy (or paste existing Testnet address):
BATCH_INTEGRITY_ANCHOR_ADDRESS=
ANCHOR_CONTRACT_ADDRESS=
```

**Rules**

1. Use a **Testnet-only** wallet (not Mainnet).
2. Set **either** `VECHAIN_MNEMONIC` **or** `VECHAIN_PRIVATE_KEY`, never both.
3. Derivation path is VeChain: `m/44'/818'/0'/0` (account index 0).
4. Never paste mnemonic/private key into chat, docs, or git.

### Fund Testnet

1. VeWorld → switch to **Testnet** → copy address.  
2. Faucet: https://faucet.vecha.in  
3. Need **VTHO** for gas (VET alone is not enough).

### Check connectivity

```powershell
npm run check:testnet
```

Expect:

- `RPC: https://testnet.vechain.org`
- `Chain ID: 100010`
- `Status: READY`
- Deployment account matches VeWorld

This plugin line is **normal** (not an error):

```text
networkConfig { ethGetTransactionCountMustReturn0: false }
```

---

## 5. Deploy BatchIntegrityAnchor (Testnet)

```powershell
npm run deploy:testnet
```

Expect:

- Contract address `0x...`
- Transaction hash `0x...`
- `Deployment Status: CONFIRMED`

Address is written to:

- `.env` → `BATCH_INTEGRITY_ANCHOR_ADDRESS` / `ANCHOR_CONTRACT_ADDRESS`
- `deployments/vechain_testnet.json`

**Reuse:** if `.env` already has a deployed address with bytecode, skip redeploy and go to step 6.

---

## 6. Verify GS1 → Blockchain

Always run from **BLOCKCHAIN ENGINE** (not GS1):

```powershell
Set-Location $BLOCKCHAIN_ENGINE

npx ts-node scripts/check-gs1-flow.ts
npm run test:e2e:testnet
```

Expect:

- Flow script shows GS1 file path, event IDs, Merkle roots, `testnetHasCode: true`
- Report auto-saved under `deployments/integrity-reports/` (local JSON, no PostgreSQL)
- E2E: **2 passing** (V1 anchor + V2/immutability/tamper)

Local (no Testnet):

```powershell
npm test
```

---

## 7. Daily workflow

```powershell
# Once per terminal: discover ENGINE_ROOT and set portable variables
. .\setup-env.ps1

# Refresh EPCIS when Canonical/GS1 inputs change
Set-Location $GS1_ENGINE
go run ./cmd/gs1-engine --output output\epcis_pf05043

# Anchor / re-verify on Testnet
Set-Location $BLOCKCHAIN_ENGINE
npm run check:testnet
npm run test:e2e:testnet
```

Optional single-batch anchor (paths derived from `$GS1_ENGINE`, no hardcoding):

```powershell
$env:EPCIS_FILE = Join-Path $GS1_ENGINE "output\epcis_pf05043\production\epcis-production.json"
$env:BATCH_ID = "PF05043"
npx hardhat run scripts/anchor-batch.ts --network vechain_testnet
```

Use `npx hardhat ... --network vechain_testnet`. Do **not** use `npm run … -- --network` (npm may strip `--network`).

---

## 8. Command cheat sheet

| Goal | Folder | Command |
|---|---|---|
| Generate EPCIS | GS1 ENGINE | `go run ./cmd/gs1-engine ...` |
| Install deps | BLOCKCHAIN ENGINE | `npm install` |
| Compile contracts | BLOCKCHAIN ENGINE | `npm run compile` |
| Unit + in-memory E2E | BLOCKCHAIN ENGINE | `npm test` |
| Check Testnet wallet | BLOCKCHAIN ENGINE | `npm run check:testnet` |
| Deploy contract | BLOCKCHAIN ENGINE | `npm run deploy:testnet` |
| Real GS1 Testnet E2E | BLOCKCHAIN ENGINE | `npm run test:e2e:testnet` |
| Hash / flow check (saves JSON) | BLOCKCHAIN ENGINE | `npm run check:gs1-flow` |
| Anchor batch (saves JSON) | BLOCKCHAIN ENGINE | set `EPCIS_FILE`+`BATCH_ID`, then `npx hardhat run scripts/anchor-batch.ts --network vechain_testnet` |

---

## 9. Troubleshooting

| Symptom | Fix |
|---|---|
| `Cannot find module './check-gs1-flow.ts'` | `cd` into **BLOCKCHAIN ENGINE** first |
| `Configure exactly one signing strategy` | Keep only mnemonic **or** only private key |
| `MISSING_TESTNET_CREDENTIALS` | Fill `.env` |
| `INSUFFICIENT_TESTNET_FUNDS` | Fund VTHO at https://faucet.vecha.in |
| `resolveName is not implemented` | Leave `DEPLOYMENT_ADMIN_ADDRESS` empty, or set a real `0x` address |
| GS1 output not found | Generate `output\epcis_pf05043\production\epcis-production.json` |
| `HH308 Unrecognized positional argument` | Use `npx hardhat ... --network vechain_testnet` |
| Wrong deployer address vs VeWorld | Wrong mnemonic/key or wrong account index; use account 0 on path `m/44'/818'/0'/0` |
| `TESTNET_RPC_UNAVAILABLE` / `unable to get local issuer certificate` | Behind a TLS-inspecting proxy (e.g. Zscaler). Run `. .\setup-env.ps1` to export the corporate root CA and set `NODE_EXTRA_CA_CERTS` dynamically |

---

## 10. Security checklist

- [ ] `.env` exists locally and is **not** committed  
- [ ] `.gitignore` includes `.env` / `.env.*` / `!.env.example`  
- [ ] Testnet wallet only (no Mainnet keys)  
- [ ] Secrets never pasted into chat, tickets, or screenshots  

---

## 11. What “done” looks like

```text
GS1:     epcis_pf05043 production JSON exists
Compile: PASS
Unit:    PASS
Testnet: READY (RPC + funded wallet)
Deploy:  CONFIRMED (address in .env + deployments/)
E2E:     npm run test:e2e:testnet → 2 passing
```
