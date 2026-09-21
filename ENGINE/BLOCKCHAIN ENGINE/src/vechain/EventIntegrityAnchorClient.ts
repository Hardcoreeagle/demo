/**
 * VeChainThor blockchain adapter for EventIntegrityAnchor.
 *
 * Deployed ALONGSIDE the batch adapter. Where BatchIntegrityAnchorClient
 * commits one Merkle root per batch, this client anchors ONE EPCIS event per
 * transaction and, once the events are in, anchors the batch-linking root.
 *
 * Responsibility boundary (mirrors BatchIntegrityAnchorClient):
 *   - network connection, account/signing, transaction construction, gas /
 *     fee delegation (adapter-level only), submission, receipt handling,
 *     confirmation/finality handling, event decoding, retry handling.
 *
 * This adapter NEVER puts EPCIS data on-chain. It only submits opaque 32-byte
 * SHA-256 commitments plus a small event-type code produced off-chain.
 */

import { ethers } from 'ethers';
import {
  EventIntegrityAnchor__factory,
  type EventIntegrityAnchor,
} from '../../typechain-types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Human-readable names for the on-chain uint8 eventType code. Index by the
 * numeric code to display an EPCIS event type. Kept in sync with
 * IntegrityEngine.EpcisEventType.
 */
export const EpcisEventTypeName: Record<number, string> = {
  0: 'Unspecified',
  1: 'ObjectEvent',
  2: 'AggregationEvent',
  3: 'TransactionEvent',
  4: 'TransformationEvent',
  5: 'AssociationEvent',
};

/** Transaction lifecycle states (shared vocabulary with the batch client). */
export enum EventAnchorStatus {
  NOT_ANCHORED = 'NOT_ANCHORED',
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  FINALIZED = 'FINALIZED',
  FAILED = 'FAILED',
  SUPERSEDED = 'SUPERSEDED',
}

export interface EventAnchoredEvent {
  batchKey: string;
  eventHash: string;
  eventId: string;
  eventType: number;
  sequence: bigint;
  timestamp: bigint;
  anchoredBy: string;
}

export interface BatchRootAnchoredEvent {
  batchKey: string;
  merkleRoot: string;
  datasetHash: string;
  eventCount: bigint;
  timestamp: bigint;
  anchoredBy: string;
}

export interface EventAnchorResult {
  status: EventAnchorStatus;
  batchKey: string;
  eventHash: string;
  sequence?: bigint;
  transactionId?: string;
  blockNumber?: bigint;
  event?: EventAnchoredEvent;
  error?: string;
}

export interface BatchRootAnchorResult {
  status: EventAnchorStatus;
  batchKey: string;
  transactionId?: string;
  blockNumber?: bigint;
  event?: BatchRootAnchoredEvent;
  error?: string;
}

/**
 * On-chain event record (struct EventAnchorRecord). eventType is returned as
 * bigint because Solidity uint8 decodes to bigint via ethers/TypeChain.
 */
export interface EventAnchorRecord {
  batchKey: string;
  eventHash: string;
  eventId: string;
  eventType: bigint;
  timestamp: bigint;
  sequence: bigint;
  anchoredBy: string;
}

/** On-chain batch-root record (struct BatchRootRecord). */
export interface BatchRootRecord {
  batchKey: string;
  merkleRoot: string;
  datasetHash: string;
  eventCount: bigint;
  timestamp: bigint;
  anchoredBy: string;
}

export interface EventIntegrityAnchorClientOptions {
  rpcUrl: string;
  contractAddress: string;
  signer: ethers.Signer;
  feeDelegationEnabled?: boolean;
  feeDelegationUrl?: string;
  /** Max submission attempts before FAILED (default 3). */
  maxRetries?: number;
  /** Whether to wait for finality before returning (default true). */
  waitForFinality?: boolean;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class EventAnchorClientError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'INVALID_PARAMS'
      | 'DUPLICATE_EVENT'
      | 'DUPLICATE_ROOT'
      | 'COUNT_MISMATCH'
      | 'CONTRACT_ERROR'
      | 'NETWORK_ERROR'
      | 'FEE_DELEGATION_MISCONFIGURED'
  ) {
    super(message);
    this.name = 'EventAnchorClientError';
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ZERO_BYTES32 =
  '0x0000000000000000000000000000000000000000000000000000000000000000';

const assertBytes32 = (value: string, name: string): void => {
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new EventAnchorClientError(
      `${name} must be a 32-byte hex string (0x + 64 hex chars), got: ${value}`,
      'INVALID_PARAMS'
    );
  }
};

/** VeChainThor two-block finality (see BatchIntegrityAnchorClient rationale). */
const FINALIZED_CONFIRMATIONS = 2n;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class VeChainThorEventAnchorClient {
  private readonly contract: EventIntegrityAnchor;
  private readonly iface: ethers.Interface;
  private readonly eventAnchoredTopic: string;
  private readonly batchRootAnchoredTopic: string;

  constructor(private readonly options: EventIntegrityAnchorClientOptions) {
    if (!ethers.isAddress(options.contractAddress)) {
      throw new EventAnchorClientError(
        `Invalid contract address: ${options.contractAddress}`,
        'INVALID_PARAMS'
      );
    }
    if (options.feeDelegationEnabled && !options.feeDelegationUrl) {
      throw new EventAnchorClientError(
        'FEE_DELEGATION_ENABLED=true requires FEE_DELEGATION_URL',
        'FEE_DELEGATION_MISCONFIGURED'
      );
    }

    this.contract = EventIntegrityAnchor__factory.connect(
      options.contractAddress,
      options.signer
    );
    this.iface = EventIntegrityAnchor__factory.createInterface();
    this.eventAnchoredTopic = this.iface.getEvent('EventAnchored')!.topicHash;
    this.batchRootAnchoredTopic =
      this.iface.getEvent('BatchRootAnchored')!.topicHash;
  }

  // -------------------------------------------------------------------------
  // anchorEvent - one transaction per EPCIS event
  // -------------------------------------------------------------------------

  async anchorEvent(
    batchKey: string,
    eventHash: string,
    eventId: string,
    eventType: number
  ): Promise<EventAnchorResult> {
    assertBytes32(batchKey, 'batchKey');
    assertBytes32(eventHash, 'eventHash');
    assertBytes32(eventId, 'eventId'); // may be the zero hash (allowed on-chain)
    if (batchKey === ZERO_BYTES32) {
      throw new EventAnchorClientError('batchKey must be non-zero', 'INVALID_PARAMS');
    }
    if (eventHash === ZERO_BYTES32) {
      throw new EventAnchorClientError('eventHash must be non-zero', 'INVALID_PARAMS');
    }
    if (!Number.isInteger(eventType) || eventType < 0 || eventType > 255) {
      throw new EventAnchorClientError(
        'eventType must be a uint8 (0-255)',
        'INVALID_PARAMS'
      );
    }

    // Skip gas if already anchored.
    if (await this.contract.isEventAnchored(eventHash)) {
      return {
        status: EventAnchorStatus.SUPERSEDED,
        batchKey,
        eventHash,
        error: 'This eventHash is already anchored on-chain',
      };
    }

    const maxRetries = this.options.maxRetries ?? 3;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const tx = await this.contract.anchorEvent(
          batchKey,
          eventHash,
          eventId,
          eventType
        );
        const receipt = await tx.wait();

        if (receipt === null || receipt.status !== 1) {
          throw new EventAnchorClientError(
            `Transaction reverted (txId=${tx.hash})`,
            'CONTRACT_ERROR'
          );
        }

        const event = this.decodeEventAnchoredFromReceipt(receipt);
        if (!event) {
          throw new EventAnchorClientError(
            'EventAnchored event not found in receipt logs',
            'CONTRACT_ERROR'
          );
        }

        if (this.options.waitForFinality !== false) {
          await this.waitForFinality(BigInt(receipt.blockNumber));
        }

        return {
          status:
            this.options.waitForFinality === false
              ? EventAnchorStatus.CONFIRMED
              : EventAnchorStatus.FINALIZED,
          batchKey,
          eventHash,
          sequence: event.sequence,
          transactionId: tx.hash,
          blockNumber: BigInt(receipt.blockNumber),
          event,
        };
      } catch (err) {
        lastError = err;
        if (this.isDuplicateEventRevert(err)) {
          return {
            status: EventAnchorStatus.SUPERSEDED,
            batchKey,
            eventHash,
            error: 'Event was anchored by a concurrent transaction',
          };
        }
        if (attempt < maxRetries) {
          await sleep(500 * 2 ** (attempt - 1));
        }
      }
    }

    return {
      status: EventAnchorStatus.FAILED,
      batchKey,
      eventHash,
      error: lastError instanceof Error ? lastError.message : String(lastError),
    };
  }

  // -------------------------------------------------------------------------
  // anchorBatchRoot - link all anchored events under one commitment
  // -------------------------------------------------------------------------

  async anchorBatchRoot(
    batchKey: string,
    merkleRoot: string,
    datasetHash: string,
    eventCount: bigint
  ): Promise<BatchRootAnchorResult> {
    assertBytes32(batchKey, 'batchKey');
    assertBytes32(merkleRoot, 'merkleRoot');
    assertBytes32(datasetHash, 'datasetHash');
    if (eventCount <= 0n) {
      throw new EventAnchorClientError('eventCount must be > 0', 'INVALID_PARAMS');
    }
    if (
      batchKey === ZERO_BYTES32 ||
      merkleRoot === ZERO_BYTES32 ||
      datasetHash === ZERO_BYTES32
    ) {
      throw new EventAnchorClientError(
        'batchKey, merkleRoot and datasetHash must be non-zero',
        'INVALID_PARAMS'
      );
    }

    if (await this.contract.isBatchRootAnchored(batchKey)) {
      return {
        status: EventAnchorStatus.SUPERSEDED,
        batchKey,
        error: 'This batch root is already anchored on-chain',
      };
    }

    const maxRetries = this.options.maxRetries ?? 3;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const tx = await this.contract.anchorBatchRoot(
          batchKey,
          merkleRoot,
          datasetHash,
          eventCount
        );
        const receipt = await tx.wait();

        if (receipt === null || receipt.status !== 1) {
          throw new EventAnchorClientError(
            `Transaction reverted (txId=${tx.hash})`,
            'CONTRACT_ERROR'
          );
        }

        const event = this.decodeBatchRootAnchoredFromReceipt(receipt);
        if (!event) {
          throw new EventAnchorClientError(
            'BatchRootAnchored event not found in receipt logs',
            'CONTRACT_ERROR'
          );
        }

        if (this.options.waitForFinality !== false) {
          await this.waitForFinality(BigInt(receipt.blockNumber));
        }

        return {
          status:
            this.options.waitForFinality === false
              ? EventAnchorStatus.CONFIRMED
              : EventAnchorStatus.FINALIZED,
          batchKey,
          transactionId: tx.hash,
          blockNumber: BigInt(receipt.blockNumber),
          event,
        };
      } catch (err) {
        lastError = err;
        if (this.isCountMismatchRevert(err)) {
          return {
            status: EventAnchorStatus.FAILED,
            batchKey,
            error:
              'On-chain event count does not match eventCount. Anchor all events before the batch root.',
          };
        }
        if (this.isDuplicateRootRevert(err)) {
          return {
            status: EventAnchorStatus.SUPERSEDED,
            batchKey,
            error: 'Batch root was anchored by a concurrent transaction',
          };
        }
        if (attempt < maxRetries) {
          await sleep(500 * 2 ** (attempt - 1));
        }
      }
    }

    return {
      status: EventAnchorStatus.FAILED,
      batchKey,
      error: lastError instanceof Error ? lastError.message : String(lastError),
    };
  }

  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------

  async getEvent(eventHash: string): Promise<EventAnchorRecord> {
    assertBytes32(eventHash, 'eventHash');
    return this.contract.getEventRecord(eventHash);
  }

  async isEventAnchored(eventHash: string): Promise<boolean> {
    assertBytes32(eventHash, 'eventHash');
    return this.contract.isEventAnchored(eventHash);
  }

  async getBatchEventHashes(batchKey: string): Promise<string[]> {
    assertBytes32(batchKey, 'batchKey');
    return this.contract.getBatchEventHashes(batchKey);
  }

  async getBatchEventCount(batchKey: string): Promise<bigint> {
    assertBytes32(batchKey, 'batchKey');
    return this.contract.getBatchEventCount(batchKey);
  }

  async getBatchRoot(batchKey: string): Promise<BatchRootRecord> {
    assertBytes32(batchKey, 'batchKey');
    return this.contract.getBatchRoot(batchKey);
  }

  async isBatchRootAnchored(batchKey: string): Promise<boolean> {
    assertBytes32(batchKey, 'batchKey');
    return this.contract.isBatchRootAnchored(batchKey);
  }

  /**
   * Resolve a transaction hash to the EPCIS event it anchored. This is the
   * "paste a tx address, see the event" path: fetch the receipt, decode the
   * EventAnchored log, and return the on-chain commitment. Returns null if the
   * transaction is not an EventIntegrityAnchor.anchorEvent transaction.
   */
  async getEventByTx(txId: string): Promise<EventAnchoredEvent | null> {
    const provider = this.options.signer.provider;
    if (!provider) {
      throw new EventAnchorClientError('Signer has no provider', 'NETWORK_ERROR');
    }
    const receipt = await provider.getTransactionReceipt(txId);
    if (!receipt) return null;
    return this.decodeEventAnchoredFromReceipt(receipt);
  }

  /** Resolve a transaction hash to the BatchRootAnchored commitment, if any. */
  async getBatchRootByTx(txId: string): Promise<BatchRootAnchoredEvent | null> {
    const provider = this.options.signer.provider;
    if (!provider) {
      throw new EventAnchorClientError('Signer has no provider', 'NETWORK_ERROR');
    }
    const receipt = await provider.getTransactionReceipt(txId);
    if (!receipt) return null;
    return this.decodeBatchRootAnchoredFromReceipt(receipt);
  }

  // -------------------------------------------------------------------------
  // Fee delegation (adapter-level only, contract untouched)
  // -------------------------------------------------------------------------

  getFeeDelegationInfo(): {
    enabled: boolean;
    url?: string;
    model:
      | 'VET (asset) + VTHO (gas) - direct'
      | 'VET (asset) + VTHO (gas) - sponsored';
  } {
    return {
      enabled: this.options.feeDelegationEnabled ?? false,
      url: this.options.feeDelegationUrl,
      model: this.options.feeDelegationEnabled
        ? 'VET (asset) + VTHO (gas) - sponsored'
        : 'VET (asset) + VTHO (gas) - direct',
    };
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private decodeEventAnchoredFromReceipt(
    receipt: ethers.TransactionReceipt
  ): EventAnchoredEvent | null {
    for (const log of receipt.logs) {
      if (log.topics[0] !== this.eventAnchoredTopic) continue;
      const parsed = this.iface.parseLog({
        topics: [...log.topics],
        data: log.data,
      });
      if (parsed !== null && parsed.name === 'EventAnchored') {
        return {
          batchKey: String(parsed.args.batchKey),
          eventHash: String(parsed.args.eventHash),
          eventId: String(parsed.args.eventId),
          eventType: Number(parsed.args.eventType),
          sequence: BigInt(parsed.args.sequence),
          timestamp: BigInt(parsed.args.timestamp),
          anchoredBy: String(parsed.args.anchoredBy),
        };
      }
    }
    return null;
  }

  private decodeBatchRootAnchoredFromReceipt(
    receipt: ethers.TransactionReceipt
  ): BatchRootAnchoredEvent | null {
    for (const log of receipt.logs) {
      if (log.topics[0] !== this.batchRootAnchoredTopic) continue;
      const parsed = this.iface.parseLog({
        topics: [...log.topics],
        data: log.data,
      });
      if (parsed !== null && parsed.name === 'BatchRootAnchored') {
        return {
          batchKey: String(parsed.args.batchKey),
          merkleRoot: String(parsed.args.merkleRoot),
          datasetHash: String(parsed.args.datasetHash),
          eventCount: BigInt(parsed.args.eventCount),
          timestamp: BigInt(parsed.args.timestamp),
          anchoredBy: String(parsed.args.anchoredBy),
        };
      }
    }
    return null;
  }

  private async waitForFinality(blockNumber: bigint): Promise<void> {
    const provider = this.options.signer.provider;
    if (!provider) return;

    const deadline = Date.now() + 120_000;
    while (Date.now() < deadline) {
      const current = BigInt(await provider.getBlockNumber());
      if (current >= blockNumber + FINALIZED_CONFIRMATIONS) {
        return;
      }
      await sleep(2_000);
    }
  }

  private isDuplicateEventRevert(err: unknown): boolean {
    const msg = err instanceof Error ? err.message : String(err);
    return (
      msg.includes('EventAlreadyAnchored') || msg.includes('already anchored')
    );
  }

  private isDuplicateRootRevert(err: unknown): boolean {
    const msg = err instanceof Error ? err.message : String(err);
    return msg.includes('BatchRootAlreadyAnchored');
  }

  private isCountMismatchRevert(err: unknown): boolean {
    const msg = err instanceof Error ? err.message : String(err);
    return msg.includes('EventCountMismatch');
  }
}
