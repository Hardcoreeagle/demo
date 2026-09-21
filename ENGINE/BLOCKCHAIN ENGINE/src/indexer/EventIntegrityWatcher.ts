/**
 * Event watcher for EventIntegrityAnchor. Polls VeChainThor's native Thorest
 * `POST /logs/event` endpoint for EventAnchored and BatchRootAnchored logs and
 * feeds decoded records into sinks (IndexerService in production).
 *
 * Mirrors BatchAnchoredEventWatcher (same Thorest paging/checkpoint model) but
 * follows the per-event contract: it queries two topics in one poll so a
 * single loop indexes both the individual events and the batch-linking root.
 */

import { ethers } from 'ethers';
import { EventIntegrityAnchor__factory } from '../../typechain-types';
import type {
  EventAnchoredEvent,
  BatchRootAnchoredEvent,
} from '../vechain/EventIntegrityAnchorClient';

export interface EventWatcherOptions {
  /** Base URL of the node, e.g. http://127.0.0.1:8669 (Thorest paths appended). */
  rpcUrl: string;
  contractAddress: string;
  /** Block to start scanning AFTER (exclusive lower bound). */
  startBlock?: bigint;
  pollIntervalMs?: number;
  maxRangeBlocks?: number;
}

export interface WatchedLogMeta {
  txId: string;
  blockNumber: bigint;
  blockTimestamp: Date;
  txOrigin: string;
  blockId: string;
}

type EventSink = (event: EventAnchoredEvent, meta: WatchedLogMeta) => Promise<void>;
type RootSink = (event: BatchRootAnchoredEvent, meta: WatchedLogMeta) => Promise<void>;

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

export class EventIntegrityWatcher {
  private readonly base: string;
  private readonly contractAddress: string;
  private readonly iface: ethers.Interface;
  private readonly eventTopic: string;
  private readonly rootTopic: string;
  private lastBlock: bigint;
  private running = false;

  constructor(private readonly options: EventWatcherOptions) {
    this.base = options.rpcUrl.replace(/\/thor\/?$/, '').replace(/\/$/, '');
    this.contractAddress = options.contractAddress.toLowerCase();
    this.iface = EventIntegrityAnchor__factory.createInterface();
    this.eventTopic = this.iface.getEvent('EventAnchored')!.topicHash;
    this.rootTopic = this.iface.getEvent('BatchRootAnchored')!.topicHash;
    this.lastBlock = options.startBlock ?? 0n;
  }

  start(
    sinks: { onEvent: EventSink; onBatchRoot?: RootSink },
    onError?: (err: Error) => void
  ): void {
    if (this.running) return;
    this.running = true;
    void (async () => {
      while (this.running) {
        try {
          await this.pollOnce(sinks);
        } catch (err) {
          onError?.(err instanceof Error ? err : new Error(String(err)));
        }
        await new Promise((r) =>
          setTimeout(r, this.options.pollIntervalMs ?? 2000)
        );
      }
    })();
  }

  stop(): void {
    this.running = false;
  }

  get checkpoint(): bigint {
    return this.lastBlock;
  }

  /**
   * One poll: query EventAnchored + BatchRootAnchored logs in (checkpoint,
   * best] (capped), decode, deliver, then advance the checkpoint.
   * @returns number of logs delivered (events + roots).
   */
  async pollOnce(sinks: {
    onEvent: EventSink;
    onBatchRoot?: RootSink;
  }): Promise<number> {
    const best = await this.fetchBestBlockNumber();
    if (best <= this.lastBlock) return 0;

    const cap = BigInt(this.options.maxRangeBlocks ?? 900);
    const to = best - this.lastBlock > cap ? this.lastBlock + cap : best;
    const from = this.lastBlock + 1n;

    const logs = await this.fetchLogs(from, to);

    let delivered = 0;
    for (const log of logs) {
      if (log.address.toLowerCase() !== this.contractAddress) continue;
      const meta: WatchedLogMeta = {
        txId: log.meta.txID,
        blockNumber: BigInt(log.meta.blockNumber),
        blockTimestamp: new Date(log.meta.blockTimestamp * 1000),
        txOrigin: log.meta.txOrigin,
        blockId: log.meta.blockID,
      };

      if (log.topics[0] === this.eventTopic) {
        const parsed = this.iface.parseLog({
          topics: [...log.topics],
          data: log.data,
        });
        if (!parsed || parsed.name !== 'EventAnchored') continue;
        const event: EventAnchoredEvent = {
          batchKey: String(parsed.args.batchKey),
          eventHash: String(parsed.args.eventHash),
          eventId: String(parsed.args.eventId),
          eventType: Number(parsed.args.eventType),
          sequence: BigInt(parsed.args.sequence),
          timestamp: BigInt(parsed.args.timestamp),
          anchoredBy: String(parsed.args.anchoredBy),
        };
        await sinks.onEvent(event, meta);
        delivered++;
      } else if (log.topics[0] === this.rootTopic) {
        const parsed = this.iface.parseLog({
          topics: [...log.topics],
          data: log.data,
        });
        if (!parsed || parsed.name !== 'BatchRootAnchored') continue;
        const root: BatchRootAnchoredEvent = {
          batchKey: String(parsed.args.batchKey),
          merkleRoot: String(parsed.args.merkleRoot),
          datasetHash: String(parsed.args.datasetHash),
          eventCount: BigInt(parsed.args.eventCount),
          timestamp: BigInt(parsed.args.timestamp),
          anchoredBy: String(parsed.args.anchoredBy),
        };
        if (sinks.onBatchRoot) {
          await sinks.onBatchRoot(root, meta);
          delivered++;
        }
      }
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
      // Two criteria (OR) so one poll returns both event and root logs.
      criteriaSet: [
        { address: this.contractAddress, topic0: this.eventTopic },
        { address: this.contractAddress, topic0: this.rootTopic },
      ],
      order: 'asc',
    };
    const res = await fetch(`${this.base}/logs/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(
        `logs/event failed: HTTP ${res.status} ${await res.text()}`
      );
    }
    return (await res.json()) as ThorestEventLog[];
  }
}
