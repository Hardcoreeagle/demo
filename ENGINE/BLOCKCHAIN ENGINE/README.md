# BLOCKCHAIN ENGINE — VeChainThor Batch Integrity Anchor

Immutable, append-only anchoring of pharmaceutical batch integrity commitments
(GS1 EPCIS 2.0.1 datasets) on **VeChainThor**.

**New laptop / full platform setup:** see [`../NEW_LAPTOP_SETUP.md`](../NEW_LAPTOP_SETUP.md)  
**New agent prompts:** see [`../AGENT_PROMPT.md`](../AGENT_PROMPT.md)

This project sits **after** the completed GS1 Engine. It receives only opaque
commitments from the off-chain Integrity Engine:

```
batchKey (bytes32)      stable batch identity from the Canonical/GS1 pipeline
merkleRoot (bytes32)    SHA-256 Merkle root over deterministically ordered event hashes
datasetHash (bytes32)   SHA-256 of the full EPCIS dataset
eventCount (uint256)    number of events committed by the root
```

It stores **no** EPCIS JSON, no PII, no documents, no genealogy, no AI output.

---

## Install

```bash
npm install
```

## Compile

```bash
npx hardhat compile
```

Solidity **0.8.20**, EVM target **shanghai**, optimizer 200 runs.

## Tests (two suites)

A Solidity test alone cannot prove SHA-256/Merkle output, the TypeScript adapter,
receipt handling, the VeChain contract, and verification all agree. Run both suites.

**1. Unit / security — contract + adapter**

```bash
npm run test:unit
```

Covers `BatchIntegrityAnchor` (unit, security, property), Integrity Engine hashing,
and `VeChainThorAnchorClient` parameter/fee-delegation checks. No GS1 files, no Thor node.

**2. E2E — real GS1 EPCIS → Integrity → adapter → chain → verify**

```bash
npm run test:e2e
```

Loads `GS1 ENGINE/output/epcis_pf05043` (falls back to `output/epcis`), derives SHA-256
event hashes and Merkle root, anchors via the adapter, reads the receipt, then
compares `calculatedMerkleRoot` to `anchoredMerkleRoot` (V1 and V2). Default network
is in-memory Hardhat (same ABI and transaction flow).

Against public VeChain Testnet (no Docker, no Solo):

```bash
cp .env.example .env   # set VECHAIN_MNEMONIC or VECHAIN_PRIVATE_KEY (testnet only)
npm run check:testnet
npm run deploy:testnet
npm run test:e2e:testnet
```

Testnet E2E reuses `BATCH_INTEGRITY_ANCHOR_ADDRESS` / `ANCHOR_CONTRACT_ADDRESS`
or `deployments/vechain_testnet.json` when present.

Optional local Thor Solo:

```bash
npm run test:e2e:solo
```

`npm test` runs suite 1 then in-memory suite 2.

Gas report (optional):

```bash
GAS_REPORT=true npx hardhat test
```

## Thor Solo

Start a local Solo node:

```bash
docker run -d --name thor-solo -p 8669:8669 \
  vechain/thor:latest solo --api-addr 0.0.0.0:8669 --api-cors '*'
```

Deploy + integration-test against Solo:

```bash
npm run deploy:solo
npx hardhat test test/integration/vechain-solo.test.ts --network vechain_solo
```

Solo accounts derive from the well-known dev mnemonic and are pre-funded with
VET and VTHO.

## Testnet

```bash
cp .env.example .env       # set VECHAIN_MNEMONIC or VECHAIN_PRIVATE_KEY (testnet funds only!)
npm run deploy:testnet
```

Get testnet VET/VTHO from the VeChain faucet. Never use production credentials.

## Mainnet

Configured (`vechain_mainnet`, chain ID 100009) but **never** deployed
automatically. Requires `DEPLOYMENT_ADMIN_ADDRESS` **and**
`VECHAIN_MAINNET_CONFIRM=YES`, plus a dedicated production wallet.
See `DEPLOYMENT.md`.

## Roles

Two-role separation (mandatory):

| Wallet | Role | Powers |
|---|---|---|
| Admin wallet | `DEFAULT_ADMIN_ROLE` | grant/revoke roles, pause/unpause |
| Anchor service | `ANCHOR_ROLE` | `anchorBatch()` only |

The deployer gets **nothing**; ANCHOR_ROLE is granted deliberately afterwards:

```bash
ROLE_OPERATION=grant ANCHOR_WALLET_ADDRESS=0x... \
  npx hardhat run scripts/configure-roles.ts --network vechain_testnet
ROLE_OPERATION=check ...
ROLE_OPERATION=revoke ...
```

## Anchor a batch

The adapter (`src/vechain/BatchIntegrityAnchorClient.ts`) is the supported path:

```typescript
const client = new VeChainThorAnchorClient({
  rpcUrl: 'https://testnet.vechain.org',
  contractAddress: '0x...',
  signer,                       // ethers signer holding ANCHOR_ROLE
  feeDelegationEnabled: false,  // optional, adapter-level only
});

const result = await client.anchorBatch(batchKey, merkleRoot, datasetHash, eventCount);
// result.status: PENDING -> CONFIRMED -> FINALIZED | FAILED | SUPERSEDED
```

Verify a recalculated root against the chain:

```bash
BATCH_KEY=0x... CALCULATED_ROOT=0x... \
  npx hardhat run scripts/verify-anchor.ts --network vechain_testnet
```

## Networks

| Network | RPC | Chain ID |
|---|---|---|
| `vechain_solo` | `http://127.0.0.1:8669` | 24652929101810 |
| `vechain_testnet` | `https://testnet.vechain.org` | 100010 |
| `vechain_mainnet` | `https://mainnet.vechain.org` | 100009 |

Network names contain `vechain` as required by `@vechain/sdk-hardhat-plugin`.

## Token model

- **VET** — account/network asset.
- **VTHO** — pays transaction gas. The anchor wallet must hold VTHO (or be
  sponsored via fee delegation, configured at the adapter layer only).

## Integrity Engine & local JSON storage

- `src/integrity/IntegrityEngine.ts` — canonical JSON (RFC 8785 subset),
  SHA-256 event hashes, deterministic Merkle tree + inclusion proofs,
  dataset hash, and `deriveBatchCommitment()` feeding the adapter.

**Default off-chain storage is local JSON (no PostgreSQL):**

| Path | Written by |
|---|---|
| `deployments/integrity-reports/` | `npm run check:gs1-flow` |
| `deployments/anchor-records/` | `anchor-batch` after a successful Testnet tx |
| `deployments/vechain_testnet.json` | `npm run deploy:testnet` |

```powershell
npm run check:gs1-flow

$env:EPCIS_FILE = "..\GS1 ENGINE\output\epcis_pf05043\production\epcis-production.json"
$env:BATCH_ID = "PF05043"
$env:ANCHOR_SIGNER_INDEX = "0"
npx hardhat run scripts/anchor-batch.ts --network vechain_testnet
```

On-chain truth remains `BatchIntegrityAnchor` on VeChain. Local JSON is an audit copy only.

PostgreSQL indexer code exists but is **optional / not used** by the default Testnet path. See `INDEXER.md` only if you explicitly want a DB later.

## Further reading

- `ARCHITECTURE.md` — system context and data flow
- `SECURITY.md` — threat model, key management, SHA-256 vs Keccak note
- `DEPLOYMENT.md` — Solo/Testnet/Mainnet procedures and production checklist
- `INDEXER.md` — optional PostgreSQL indexer (not required)
