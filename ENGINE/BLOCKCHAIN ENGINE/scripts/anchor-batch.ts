import { ethers } from 'hardhat';
import type { HardhatRuntimeEnvironment } from 'hardhat/types';
import type { Signer } from 'ethers';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import { deriveBatchCommitment } from '../src/integrity/IntegrityEngine';
import {
  VeChainThorAnchorClient,
  AnchorStatus,
} from '../src/vechain/BatchIntegrityAnchorClient';

/**
 * Anchor one batch's EPCIS dataset on VeChainThor (#29 full flow).
 *
 * Required env:
 *   EPCIS_FILE          path to the GS1 Engine EPCIS 2.0.1 JSON document
 *   BATCH_ID            business batch id (e.g. PF05043)
 *   BATCH_KEY_SEED      optional; seed string for batchKey derivation
 *                       (default: BATCH_ID). MUST match the upstream
 *                       Canonical/GS1 pipeline's derivation rule.
 *   ANCHOR_CONTRACT_ADDRESS  or deployments/<network>.json
 *
 * Output: JSON anchor result with version, txId, blockNumber, status.
 */
async function main(hre: HardhatRuntimeEnvironment): Promise<void> {
  const epcisFile = process.env.EPCIS_FILE;
  const batchId = process.env.BATCH_ID;
  if (!epcisFile || !batchId) {
    throw new Error('Set EPCIS_FILE and BATCH_ID');
  }
  const doc = JSON.parse(readFileSync(epcisFile, 'utf8'));

  // Batch identity: this derivation must match the upstream pipeline.
  const seed = process.env.BATCH_KEY_SEED ?? batchId;
  const batchKey = '0x' + createHash('sha256').update(seed).digest('hex');

  // 1-2. Integrity Engine: canonicalize, hash events, build Merkle tree.
  const commitment = deriveBatchCommitment(doc, batchKey);
  console.error(
    `[integrity] events=${commitment.eventCount} merkleRoot=${commitment.merkleRoot}`
  );

  // 3. Contract address from env or deployment record.
  const contractAddress =
    process.env.ANCHOR_CONTRACT_ADDRESS ?? loadDeploymentAddress(hre.network.name);
  if (!contractAddress || !ethers.isAddress(contractAddress)) {
    throw new Error(
      `No contract address for network ${hre.network.name}. Deploy first or set ANCHOR_CONTRACT_ADDRESS.`
    );
  }

  // 4. Adapter: validate, duplicate-check, sign, submit, wait, decode.
  // The ANCHOR_ROLE holder is typically NOT signer #0 (that is the admin).
  const signerIndex = Number(process.env.ANCHOR_SIGNER_INDEX ?? '0');
  const signer = (await ethers.getSigners())[signerIndex];
  const client = new VeChainThorAnchorClient({
    rpcUrl: (hre.network.config as { url?: string }).url ?? '',
    contractAddress,
    signer: signer as unknown as Signer,
  });

  const result = await client.anchorBatch(
    commitment.batchKey,
    commitment.merkleRoot,
    commitment.datasetHash,
    commitment.eventCount
  );

  // 5. Persist anchor metadata off-chain (#30) - operational record only.
  const record = {
    batchId,
    batchKey: commitment.batchKey,
    merkleRoot: commitment.merkleRoot,
    datasetHash: commitment.datasetHash,
    eventCount: commitment.eventCount.toString(),
    status: result.status,
    anchoredBy: await signer.getAddress(),
    error: result.error,
    version: result.version?.toString(),
    transactionId: result.transactionId,
    blockNumber: result.blockNumber?.toString(),
    network: hre.network.name,
    contractAddress,
    anchoredAt: new Date().toISOString(),
  };
  console.log(JSON.stringify(record, null, 2));

  // Off-chain operational metadata (not the chain source of truth).
  const metaDir = join('deployments', 'anchor-records');
  mkdirSync(metaDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const metaFile = join(metaDir, `${batchId}-${stamp}.json`);
  writeFileSync(metaFile, JSON.stringify(record, null, 2));
  console.error(`Saved anchor metadata: ${metaFile}`);

  if (result.status !== AnchorStatus.FINALIZED && result.status !== AnchorStatus.CONFIRMED) {
    if (result.status === AnchorStatus.SUPERSEDED) {
      console.error('Root already anchored - nothing to do.');
      return;
    }
    process.exitCode = 1;
  }
}

function loadDeploymentAddress(network: string): string | undefined {
  const file = join('deployments', `${network}.json`);
  if (!existsSync(file)) return undefined;
  const json = JSON.parse(readFileSync(file, 'utf8')) as {
    contractAddress?: string;
  };
  return json.contractAddress;
}

export default main;

// Execute when run via `npx hardhat run scripts/anchor-batch.ts`.
if (require.main === module) {
  main(require('hardhat') as unknown as HardhatRuntimeEnvironment).catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
