import { ethers } from 'hardhat';
import type { HardhatRuntimeEnvironment } from 'hardhat/types';
import type { Signer } from 'ethers';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import {
  deriveEventCommitments,
  EpcisEventType,
} from '../src/integrity/IntegrityEngine';
import {
  VeChainThorEventAnchorClient,
  EventAnchorStatus,
} from '../src/vechain/EventIntegrityAnchorClient';

/**
 * Anchor EVERY EPCIS event of a batch individually (one transaction per
 * event) on the EventIntegrityAnchor contract, then anchor the batch root to
 * link them all together.
 *
 * Required env:
 *   EPCIS_FILE               path to the GS1 Engine EPCIS 2.0.1 JSON document
 *   BATCH_ID                 business batch id (e.g. PF05043)
 *   BATCH_KEY_SEED           optional; seed for batchKey (default: BATCH_ID).
 *                            MUST match the upstream Canonical/GS1 pipeline.
 *   EVENT_CONTRACT_ADDRESS   or deployments/<network>-events.json
 *   ANCHOR_SIGNER_INDEX      optional signer index for the ANCHOR_ROLE wallet
 *   SKIP_BATCH_ROOT=1        optional; anchor only events, not the linking root
 *
 * Output: a JSON record with per-event tx ids and the batch-root tx id, plus
 * an eventHash -> tx mapping file used by scripts/view-event.ts.
 */
async function main(hre: HardhatRuntimeEnvironment): Promise<void> {
  const epcisFile = process.env.EPCIS_FILE;
  const batchId = process.env.BATCH_ID;
  if (!epcisFile || !batchId) {
    throw new Error('Set EPCIS_FILE and BATCH_ID');
  }
  const doc = JSON.parse(readFileSync(epcisFile, 'utf8'));

  // Batch identity: this derivation must match the upstream pipeline and the
  // batch anchor script (scripts/anchor-batch.ts).
  const seed = process.env.BATCH_KEY_SEED ?? batchId;
  const batchKey = '0x' + createHash('sha256').update(seed).digest('hex');

  // 1. Integrity Engine: per-event commitments + linking root.
  const commitment = deriveEventCommitments(doc, batchKey);
  console.error(
    `[integrity] events=${commitment.eventCount} merkleRoot=${commitment.merkleRoot}`
  );

  // 2. Contract address from env or deployment record.
  const contractAddress =
    process.env.EVENT_CONTRACT_ADDRESS ??
    loadDeploymentAddress(hre.network.name);
  if (!contractAddress || !ethers.isAddress(contractAddress)) {
    throw new Error(
      `No EventIntegrityAnchor address for network ${hre.network.name}. Deploy first or set EVENT_CONTRACT_ADDRESS.`
    );
  }

  // 3. Adapter.
  const signerIndex = Number(process.env.ANCHOR_SIGNER_INDEX ?? '0');
  const signer = (await ethers.getSigners())[signerIndex];
  const client = new VeChainThorEventAnchorClient({
    rpcUrl: (hre.network.config as { url?: string }).url ?? '',
    contractAddress,
    signer: signer as unknown as Signer,
  });

  // 4. Anchor each event as its own transaction.
  const eventRecords: Array<{
    sequence: number;
    eventHash: string;
    eventId: string;
    eventType: number;
    eventTypeName: string;
    status: EventAnchorStatus;
    transactionId?: string;
    blockNumber?: string;
    error?: string;
  }> = [];

  let anchored = 0;
  let superseded = 0;
  let failed = 0;

  for (let i = 0; i < commitment.events.length; i++) {
    const ev = commitment.events[i];
    const result = await client.anchorEvent(
      batchKey,
      ev.eventHash,
      ev.eventId,
      ev.eventType
    );
    if (
      result.status === EventAnchorStatus.FINALIZED ||
      result.status === EventAnchorStatus.CONFIRMED
    ) {
      anchored++;
    } else if (result.status === EventAnchorStatus.SUPERSEDED) {
      superseded++;
    } else {
      failed++;
    }
    eventRecords.push({
      sequence: i + 1,
      eventHash: ev.eventHash,
      eventId: ev.eventId,
      eventType: ev.eventType,
      eventTypeName: EpcisEventType[ev.eventType] ?? 'Unspecified',
      status: result.status,
      transactionId: result.transactionId,
      blockNumber: result.blockNumber?.toString(),
      error: result.error,
    });
    console.error(
      `[event ${i + 1}/${commitment.events.length}] ${result.status} ` +
        `hash=${ev.eventHash.slice(0, 18)}... tx=${result.transactionId ?? '-'}`
    );
  }

  // 5. Anchor the batch root to link all events (unless skipped or events failed).
  let batchRoot:
    | {
        status: EventAnchorStatus;
        transactionId?: string;
        blockNumber?: string;
        error?: string;
      }
    | undefined;

  const skipRoot = process.env.SKIP_BATCH_ROOT === '1';
  if (!skipRoot && failed === 0) {
    const rootResult = await client.anchorBatchRoot(
      batchKey,
      commitment.merkleRoot,
      commitment.datasetHash,
      commitment.eventCount
    );
    batchRoot = {
      status: rootResult.status,
      transactionId: rootResult.transactionId,
      blockNumber: rootResult.blockNumber?.toString(),
      error: rootResult.error,
    };
    console.error(
      `[batch-root] ${rootResult.status} tx=${rootResult.transactionId ?? '-'}`
    );
  } else if (failed > 0) {
    console.error(
      `[batch-root] skipped: ${failed} event(s) failed; anchor them before the root.`
    );
  }

  // 6. Persist off-chain records (operational only; chain stays authoritative).
  const record = {
    batchId,
    batchKey,
    merkleRoot: commitment.merkleRoot,
    datasetHash: commitment.datasetHash,
    eventCount: commitment.eventCount.toString(),
    anchoredBy: await signer.getAddress(),
    network: hre.network.name,
    contractAddress,
    anchoredAt: new Date().toISOString(),
    summary: { anchored, superseded, failed, total: commitment.events.length },
    events: eventRecords,
    batchRoot,
  };
  console.log(JSON.stringify(record, null, 2));

  const metaDir = join('deployments', 'event-anchor-records');
  mkdirSync(metaDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const metaFile = join(metaDir, `${batchId}-${stamp}.json`);
  writeFileSync(metaFile, JSON.stringify(record, null, 2));

  // eventHash -> tx mapping, keyed for the viewer (tx hash -> event resolution).
  const mapDir = join('deployments', 'event-tx-map');
  mkdirSync(mapDir, { recursive: true });
  const mapFile = join(mapDir, `${batchId}.json`);
  const existingMap = existsSync(mapFile)
    ? (JSON.parse(readFileSync(mapFile, 'utf8')) as Record<string, unknown>)
    : {};
  for (const er of eventRecords) {
    if (er.transactionId) {
      (existingMap as Record<string, unknown>)[er.transactionId.toLowerCase()] =
        {
          batchId,
          batchKey,
          eventHash: er.eventHash,
          eventId: er.eventId,
          eventType: er.eventType,
          eventTypeName: er.eventTypeName,
          sequence: er.sequence,
        };
    }
  }
  writeFileSync(mapFile, JSON.stringify(existingMap, null, 2));

  console.error(`Saved anchor metadata: ${metaFile}`);
  console.error(`Saved tx->event map:  ${mapFile}`);

  if (failed > 0) process.exitCode = 1;
}

function loadDeploymentAddress(network: string): string | undefined {
  // Prefer the dedicated events deployment file, then fall back to a combined one.
  const eventsFile = join('deployments', `${network}-events.json`);
  if (existsSync(eventsFile)) {
    const json = JSON.parse(readFileSync(eventsFile, 'utf8')) as {
      contractAddress?: string;
    };
    return json.contractAddress;
  }
  const file = join('deployments', `${network}.json`);
  if (!existsSync(file)) return undefined;
  const json = JSON.parse(readFileSync(file, 'utf8')) as {
    eventContractAddress?: string;
  };
  return json.eventContractAddress;
}

export default main;

// Execute when run via `npx hardhat run scripts/anchor-events.ts`.
if (require.main === module) {
  main(require('hardhat') as unknown as HardhatRuntimeEnvironment).catch(
    (err) => {
      console.error(err);
      process.exitCode = 1;
    }
  );
}
