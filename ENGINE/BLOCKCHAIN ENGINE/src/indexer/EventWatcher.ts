/**
 * Event watcher (#46): polls VeChainThor's native Thorest `POST /logs/event`
 * endpoint for BatchAnchored events and feeds decoded events into a sink
 * (IndexerService in production).
 *
 * Why Thorest instead of eth_getLogs: VeChainThor nodes (including Solo and
 * the public testnet/mainnet gateways) serve the Thorest REST API natively;
 * the endpoint returns blockTimestamp and txOrigin per event in `meta`,
 * and topic criteria are flat strings (`topic0: "0x..."`).
 *
 * Checkpointing: the watcher resumes from `startBlock` (persist the returned
 * checkpoint in your own store across restarts). Poll range is capped so a
 * cold start against a long chain cannot exceed node page limits.
 */

import { ethers } from 'ethers';
import { BatchIntegrityAnchor__factory } from '../../typechain-types';
import type { BatchAnchoredEvent } from '../vechain/BatchIntegrityAnchorClient';

export interface WatcherOptions {
  /** Base URL of the node, e.g. http://127.0.0.1:8669 (Thorest paths are appended). */
  rpcUrl: string;
  contractAddress: string;
  /** Block to start scanning AFTER (exclusive lower bound). */
  startBlock?: bigint;
  /** Poll interval in ms (default 2000; Solo packs a block ~every 2s). */
  pollIntervalMs?: number;
  /** Max blocks per poll (default 900, safely under typical node caps). */
  maxRangeBlocks?: number;
}

export interface WatchedEventMeta {
  txId: string;
  blockNumber: bigint;
  blockTimestamp: Date;
  /** VeChainThor-specific: transaction origin (== anchoredBy for our events). */
  txOrigin: string;
  blockId: string;
}

type EventSink = (event: BatchAnchoredEvent, meta: WatchedEventMeta) => Promise<void>;

interface ThorestEventLog {
  address: string;
  topics: string[];
  data: string;
  meta: {
    blockID: string;
    blockNumber: number;
    blockTimestamp: number;
    txID: string;
    txOrigin: string;
    clauseIndex: number;
  };
}

export class BatchAnchoredEventWatcher {
  private readonly base: string;
  private readonly contractAddress: string;
  private readonly iface: ethers.Interface;
  private readonly topic: string;
  private lastBlock: bigint;
  private running = false;
  private timer?: NodeJS.Timeout;

  constructor(private readonly options: WatcherOptions) {
    // Accept both http://host:8669 and http://host:8669/thor forms.
    this.base = options.rpcUrl.replace(/\/thor\/?$/, '').replace(/\/$/, '');
    this.contractAddress = options.contractAddress.toLowerCase();
    this.iface = BatchIntegrityAnchor__factory.createInterface();
    this.topic = this.iface.getEvent('BatchAnchored')!.topicHash;
    this.lastBlock = options.startBlock ?? 0n;
  }

  /** Start the polling loop. Returns immediately; errors go to onError. */
  start(sink: EventSink, onError?: (err: Error) => void): void {
    if (this.running) return;
    this.running = true;
    void (async () => {
      while (this.running) {
        try {
          await this.pollOnce(sink);
        } catch (err) {
          onError?.(err instanceof Error ? err : new Error(String(err)));
        }
        await new Promise((r) => setTimeout(r, this.options.pollIntervalMs ?? 2000));
      }
    })();
  }

  stop(): void {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
  }

  get checkpoint(): bigint {
    return this.lastBlock;
  }

  /**
   * One poll: query logs in (checkpoint, best] (capped), decode, deliver,
   * then advance the checkpoint to the highest queried block.
   * @returns number of BatchAnchored events delivered.
   */
  async pollOnce(sink: EventSink): Promise<number> {
    const best = await this.fetchBestBlockNumber();
    if (best <= this.lastBlock) return 0;

    const cap = BigInt(this.options.maxRangeBlocks ?? 900);
    const to = best - this.lastBlock > cap ? this.lastBlock + cap : best;
    const from = this.lastBlock + 1n;

    const logs = await this.fetchLogs(from, to);

    let delivered = 0;
    for (const log of logs) {
      if (log.address.toLowerCase() !== this.contractAddress) continue;
      if (log.topics[0] !== this.topic) continue;

      const parsed = this.iface.parseLog({
        topics: [...log.topics],
        data: log.data,
      });
      if (!parsed || parsed.name !== 'BatchAnchored') continue;

      const event: BatchAnchoredEvent = {
        batchKey: String(parsed.args.batchKey),
        version: BigInt(parsed.args.version),
        merkleRoot: String(parsed.args.merkleRoot),
        datasetHash: String(parsed.args.datasetHash),
        eventCount: BigInt(parsed.args.eventCount),
        timestamp: BigInt(parsed.args.timestamp),
        anchoredBy: String(parsed.args.anchoredBy),
      };

      await sink(event, {
        txId: log.meta.txID,
        blockNumber: BigInt(log.meta.blockNumber),
        blockTimestamp: new Date(log.meta.blockTimestamp * 1000),
        txOrigin: log.meta.txOrigin,
        blockId: log.meta.blockID,
      });
      delivered++;
    }

    this.lastBlock = to;
    return delivered;
  }

  // ---------------------------------------------------------------------------

  private async fetchBestBlockNumber(): Promise<bigint> {
    const res = await fetch(`${this.base}/blocks/best`);
    if (!res.ok) throw new Error(`blocks/best failed: HTTP ${res.status}`);
    const body = (await res.json()) as { number: number };
    return BigInt(body.number);
  }

  private async fetchLogs(from: bigint, to: bigint): Promise<ThorestEventLog[]> {
    const body = {
      range: { unit: 'block', from: Number(from), to: Number(to) },
      options: { offset: 0, limit: 100 },
      criteriaSet: [
        {
          address: this.contractAddress,
          // Thorest expects a flat string for topic0.
          topic0: this.topic,
        },
      ],
      order: 'asc',
    };
    const res = await fetch(`${this.base}/logs/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`logs/event failed: HTTP ${res.status} ${await res.text()}`);
    }
    return (await res.json()) as ThorestEventLog[];
  }
}
