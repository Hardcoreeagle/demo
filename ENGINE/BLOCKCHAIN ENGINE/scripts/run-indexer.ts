import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { BatchAnchoredEventWatcher, type WatchedEventMeta } from '../src/indexer/EventWatcher';
import { IndexerService } from '../src/indexer/IndexerService';
import type { BatchAnchoredEvent } from '../src/vechain/BatchIntegrityAnchorClient';

/**
 * Indexer runner: watches BatchAnchored events on a VeChainThor node and
 * persists them to PostgreSQL (#46). Checkpoint is persisted locally so a
 * restart resumes without re-processing (persistence itself is idempotent).
 *
 * Env:
 *   INDEXER_DATABASE_URL      postgres://... (required)
 *   ANCHOR_CONTRACT_ADDRESS   or deployments/<VECHAIN_NETWORK>.json
 *   VECHAIN_NETWORK           network name (default vechain_solo)
 *   VECHAIN_RPC_URL           node base URL (default http://127.0.0.1:8669)
 *   INDEXER_START_BLOCK       resume checkpoint (default 0)
 *   INDEXER_POLL_MS           poll interval (default 2000)
 */
async function main(): Promise<void> {
  const network = process.env.VECHAIN_NETWORK ?? 'vechain_solo';
  const rpcUrl = process.env.VECHAIN_RPC_URL ?? 'http://127.0.0.1:8669';
  const dbUrl = process.env.INDEXER_DATABASE_URL;
  if (!dbUrl) throw new Error('INDEXER_DATABASE_URL is required');

  const contractAddress =
    process.env.ANCHOR_CONTRACT_ADDRESS ?? loadDeploymentAddress(network);
  if (!contractAddress) {
    throw new Error(`No contract address for ${network}. Deploy first or set ANCHOR_CONTRACT_ADDRESS.`);
  }

  const indexer = new IndexerService({
    connectionString: dbUrl,
    contractAddress,
    network,
    chainId: process.env.VECHAIN_CHAIN_ID ?? '0',
    startBlock: process.env.INDEXER_START_BLOCK
      ? BigInt(process.env.INDEXER_START_BLOCK)
      : 0n,
  });
  await indexer.migrate();
  console.log(`[indexer] schema ready (${dbUrl.split('@').pop()})`);

  const checkpointFile = join('deployments', `indexer-checkpoint-${network}.json`);
  const startBlock = process.env.INDEXER_START_BLOCK
    ? BigInt(process.env.INDEXER_START_BLOCK)
    : loadCheckpoint(checkpointFile) ?? 0n;

  const watcher = new BatchAnchoredEventWatcher({
    rpcUrl,
    contractAddress,
    startBlock,
    pollIntervalMs: Number(process.env.INDEXER_POLL_MS ?? 2000),
  });

  const persist = async (event: BatchAnchoredEvent, meta: WatchedEventMeta) => {
    const id = await indexer.persistAnchoredEvent(event, {
      txId: meta.txId,
      blockNumber: meta.blockNumber,
      blockTimestamp: meta.blockTimestamp,
      status: 'CONFIRMED',
    });
    console.log(
      `[indexer] anchored_batches#${id} batch=${event.batchKey.slice(0, 10)}... ` +
        `v${event.version} root=${event.merkleRoot.slice(0, 10)}... block=${meta.blockNumber}`
    );
  };

  watcher.start(persist, (err) =>
    console.error(`[indexer] poll error: ${err.message}`)
  );
  console.log(`[indexer] watching ${contractAddress} on ${network} from block ${startBlock}`);

  const save = () => {
    try {
      writeCheckpoint(checkpointFile, watcher.checkpoint);
    } catch {
      /* best-effort */
    }
  };
  process.on('SIGINT', () => {
    watcher.stop();
    save();
    indexer.close().then(() => process.exit(0));
  });
  setInterval(save, 30_000).unref();
}

function loadDeploymentAddress(network: string): string | undefined {
  const file = join('deployments', `${network}.json`);
  if (!existsSync(file)) return undefined;
  return (JSON.parse(readFileSync(file, 'utf8')) as { contractAddress?: string })
    .contractAddress;
}

function loadCheckpoint(file: string): bigint | undefined {
  if (!existsSync(file)) return undefined;
  const json = JSON.parse(readFileSync(file, 'utf8')) as { lastBlock?: string };
  return json.lastBlock ? BigInt(json.lastBlock) : undefined;
}

function writeCheckpoint(file: string, lastBlock: bigint): void {
  mkdirSync('deployments', { recursive: true });
  writeFileSync(file, JSON.stringify({ lastBlock: lastBlock.toString() }, null, 2));
}

// Execute when run directly.
if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}

export default main;
