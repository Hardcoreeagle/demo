import { ethers } from 'hardhat';
import type { HardhatRuntimeEnvironment } from 'hardhat/types';
import type { Signer } from 'ethers';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { hashEpcisEvent } from '../src/integrity/IntegrityEngine';
import {
  VeChainThorEventAnchorClient,
  EpcisEventTypeName,
} from '../src/vechain/EventIntegrityAnchorClient';

/**
 * "Enter a transaction address, see the event."
 *
 * Given a transaction hash, decode the on-chain EventAnchored (or
 * BatchRootAnchored) commitment, then resolve the full EPCIS event JSON from
 * the off-chain tx->event map produced by scripts/anchor-events.ts and verify
 * that its recomputed SHA-256 hash matches the anchored commitment.
 *
 * Required env:
 *   TX_ID                    the transaction hash to inspect
 *   EVENT_CONTRACT_ADDRESS   or deployments/<network>-events.json
 * Optional env:
 *   EPCIS_FILE               EPCIS doc used to show + verify the event body
 *   BATCH_ID                 restrict the map lookup to one batch
 */
async function main(hre: HardhatRuntimeEnvironment): Promise<void> {
  const txId = process.env.TX_ID;
  if (!txId) throw new Error('Set TX_ID to the transaction hash to inspect');

  const contractAddress =
    process.env.EVENT_CONTRACT_ADDRESS ??
    loadDeploymentAddress(hre.network.name);
  if (!contractAddress || !ethers.isAddress(contractAddress)) {
    throw new Error(
      `No EventIntegrityAnchor address for network ${hre.network.name}. Set EVENT_CONTRACT_ADDRESS.`
    );
  }

  const signer = (await ethers.getSigners())[0];
  const client = new VeChainThorEventAnchorClient({
    rpcUrl: (hre.network.config as { url?: string }).url ?? '',
    contractAddress,
    signer: signer as unknown as Signer,
  });

  // 1. Decode the transaction's on-chain commitment.
  const eventCommit = await client.getEventByTx(txId);
  if (eventCommit) {
    console.log('== EventAnchored (single EPCIS event) ==');
    console.log(
      JSON.stringify(
        {
          transactionId: txId,
          batchKey: eventCommit.batchKey,
          eventHash: eventCommit.eventHash,
          eventId: eventCommit.eventId,
          eventType: eventCommit.eventType,
          eventTypeName:
            EpcisEventTypeName[eventCommit.eventType] ?? 'Unspecified',
          sequence: eventCommit.sequence.toString(),
          timestamp: eventCommit.timestamp.toString(),
          anchoredBy: eventCommit.anchoredBy,
        },
        null,
        2
      )
    );

    // 2. Resolve the full event body off-chain and verify the hash.
    const mapped = lookupTxInMaps(txId);
    if (mapped) {
      console.log('');
      console.log('== Off-chain mapping ==');
      console.log(JSON.stringify(mapped, null, 2));
    }

    const epcisFile = process.env.EPCIS_FILE;
    if (epcisFile && existsSync(epcisFile)) {
      const body = findEventByHash(epcisFile, eventCommit.eventHash);
      if (body) {
        console.log('');
        console.log('== EPCIS event body (off-chain source) ==');
        console.log(JSON.stringify(body, null, 2));
        const recomputed = hashEpcisEvent(body);
        const ok = recomputed.toLowerCase() === eventCommit.eventHash.toLowerCase();
        console.log('');
        console.log(`Integrity: ${ok ? 'VALID' : 'MISMATCH'} (recomputed=${recomputed})`);
        if (!ok) process.exitCode = 1;
      } else {
        console.error(
          'Note: no matching event found in EPCIS_FILE for this hash.'
        );
      }
    }
    return;
  }

  // 3. Not an event tx - maybe the batch-root linking transaction.
  const rootCommit = await client.getBatchRootByTx(txId);
  if (rootCommit) {
    console.log('== BatchRootAnchored (batch linking commitment) ==');
    console.log(
      JSON.stringify(
        {
          transactionId: txId,
          batchKey: rootCommit.batchKey,
          merkleRoot: rootCommit.merkleRoot,
          datasetHash: rootCommit.datasetHash,
          eventCount: rootCommit.eventCount.toString(),
          timestamp: rootCommit.timestamp.toString(),
          anchoredBy: rootCommit.anchoredBy,
        },
        null,
        2
      )
    );

    // Show every event linked to this batch.
    const hashes = await client.getBatchEventHashes(rootCommit.batchKey);
    console.log('');
    console.log(`== ${hashes.length} event hashes linked to this batch ==`);
    hashes.forEach((h, i) => console.log(`  ${i + 1}. ${h}`));
    return;
  }

  console.error(
    `No EventAnchored or BatchRootAnchored log found in transaction ${txId}.`
  );
  process.exitCode = 1;
}

function loadDeploymentAddress(network: string): string | undefined {
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

/** Look up a tx hash across all persisted event-tx-map files. */
function lookupTxInMaps(txId: string): unknown | null {
  const mapDir = join('deployments', 'event-tx-map');
  if (!existsSync(mapDir)) return null;
  const batchId = process.env.BATCH_ID;
  const files = batchId
    ? [join(mapDir, `${batchId}.json`)]
    : readdirSync(mapDir)
        .filter((f) => f.endsWith('.json'))
        .map((f) => join(mapDir, f));
  const key = txId.toLowerCase();
  for (const f of files) {
    if (!existsSync(f)) continue;
    const map = JSON.parse(readFileSync(f, 'utf8')) as Record<string, unknown>;
    if (map[key]) return map[key];
  }
  return null;
}

/** Find the raw EPCIS event whose canonical hash equals eventHash. */
function findEventByHash(epcisFile: string, eventHash: string): unknown | null {
  const doc = JSON.parse(readFileSync(epcisFile, 'utf8')) as {
    epcisBody?: { eventList?: unknown[] };
  };
  const list = Array.isArray(doc)
    ? (doc as unknown[])
    : doc.epcisBody?.eventList ?? [];
  const target = eventHash.toLowerCase();
  for (const ev of list) {
    if (hashEpcisEvent(ev).toLowerCase() === target) return ev;
  }
  return null;
}

export default main;

// Execute when run via `npx hardhat run scripts/view-event.ts`.
if (require.main === module) {
  main(require('hardhat') as unknown as HardhatRuntimeEnvironment).catch(
    (err) => {
      console.error(err);
      process.exitCode = 1;
    }
  );
}
