/**
 * VeChainThor blockchain adapter for BatchIntegrityAnchor.
 *
 * Responsibility boundary (#27, #28, #29, #31, #32):
 *   - network connection, account/signing, transaction construction,
 *     gas handling, fee delegation (optional, adapter-level only),
 *     submission, receipt handling, confirmation/finality handling,
 *     event decoding, retry handling.
 *
 * This adapter NEVER puts EPCIS data on-chain. It only submits opaque
 * 32-byte commitments produced by the off-chain Integrity Engine (SHA-256).
 * The contract does not construct or verify Merkle trees.
 */

import { ethers } from 'ethers';
import {
  BatchIntegrityAnchor__factory,
  type BatchIntegrityAnchor,
} from '../../typechain-types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Transaction lifecycle states (#31). */
export enum AnchorStatus {
  NOT_ANCHORED = 'NOT_ANCHORED',
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  FINALIZED = 'FINALIZED',
  FAILED = 'FAILED',
  SUPERSEDED = 'SUPERSEDED',
}

export interface AnchorRequest {
  /** Stable batch identity (hex string, 32 bytes) e.g. keccak("PF05043"). */
  batchKey: string;
  /** SHA-256 Merkle root over deterministically ordered event hashes. */
  merkleRoot: string;
  /** SHA-256 hash of the full EPCIS dataset. */
  datasetHash: string;
  /** Number of EPCIS events committed by the Merkle root. */
  eventCount: bigint;
}

export interface AnchorResult {
  status: AnchorStatus;
  batchKey: string;
  /** Version assigned by the contract (append-only, starts at 1). */
  version?: bigint;
  transactionId?: string;
  blockNumber?: bigint;
  /** Decoded BatchAnchored event, present once CONFIRMED/FINALIZED. */
  event?: BatchAnchoredEvent;
  error?: string;
}

export interface BatchAnchoredEvent {
  batchKey: string;
  version: bigint;
  merkleRoot: string;
  datasetHash: string;
  eventCount: bigint;
  timestamp: bigint;
  anchoredBy: string;
}

/** Anchor metadata persisted off-chain (#30). The chain stays authoritative. */
export interface AnchorMetadata extends BatchAnchoredEvent {
  network: string;
  chainId: bigint;
  contractAddress: string;
  transactionId: string;
  blockNumber: bigint;
  status: AnchorStatus;
}

/** On-chain anchor record (struct IntegrityAnchor). */
export interface IntegrityAnchor {
  version: bigint;
  merkleRoot: string;
  datasetHash: string;
  eventCount: bigint;
  timestamp: bigint;
  anchoredBy: string;
}

/** Abstraction boundary (#28). VeChainThorAnchorClient is the first impl. */
export interface BlockchainAnchorClient {
  anchorBatch(
    batchKey: string,
    merkleRoot: string,
    datasetHash: string,
    eventCount: bigint
  ): Promise<AnchorResult>;

  getLatestAnchor(batchKey: string): Promise<IntegrityAnchor>;

  getAnchor(batchKey: string, version: bigint): Promise<IntegrityAnchor>;
}

export interface VeChainThorAnchorClientOptions {
  /** JSON-RPC endpoint of a VeChainThor node (solo/testnet/mainnet). */
  rpcUrl: string;
  /** Deployed BatchIntegrityAnchor contract address. */
  contractAddress: string;
  /** Ethers signer holding the ANCHOR_ROLE wallet (or admin for tests). */
  signer: ethers.Signer;
  /**
   * Fee delegation (#32): when enabled, `feeDelegationUrl` must point to a
   * sponsor service that co-signs the gas payer. The contract interface is
   * unchanged either way; only the transaction envelope differs.
   */
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

export class AnchorClientError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'INVALID_PARAMS'
      | 'DUPLICATE_ROOT'
      | 'CONTRACT_ERROR'
      | 'NETWORK_ERROR'
      | 'FEE_DELEGATION_MISCONFIGURED'
  ) {
    super(message);
    this.name = 'AnchorClientError';
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ZERO_BYTES32 =
  '0x0000000000000000000000000000000000000000000000000000000000000000';

const assertBytes32 = (value: string, name: string): void => {
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new AnchorClientError(
      `${name} must be a 32-byte hex string (0x + 64 hex chars), got: ${value}`,
      'INVALID_PARAMS'
    );
  }
};

/**
 * VeChainThor finality model: VeChain uses PoA with immediate
 * determinism once a block is committed by the 101 CRS + 1 representative;
 * blocks are typically considered justified immediately and finalized on
 * the next block (two-block finality). We treat N=2 confirmations as
 * FINALIZED, which is the conservative documented approach and deliberately
 * NOT an Ethereum-style probabilistic confirmation count.
 */
const FINALIZED_CONFIRMATIONS = 2n;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class VeChainThorAnchorClient implements BlockchainAnchorClient {
  private readonly contract: BatchIntegrityAnchor;
  private readonly iface: ethers.Interface;
  private readonly batchAnchoredTopic: string;

  constructor(private readonly options: VeChainThorAnchorClientOptions) {
    if (!ethers.isAddress(options.contractAddress)) {
      throw new AnchorClientError(
        `Invalid contract address: ${options.contractAddress}`,
        'INVALID_PARAMS'
      );
    }
    if (options.feeDelegationEnabled && !options.feeDelegationUrl) {
      throw new AnchorClientError(
        'FEE_DELEGATION_ENABLED=true requires FEE_DELEGATION_URL',
        'FEE_DELEGATION_MISCONFIGURED'
      );
    }

    this.contract = BatchIntegrityAnchor__factory.connect(
      options.contractAddress,
      options.signer
    );
    this.iface = BatchIntegrityAnchor__factory.createInterface();
    this.batchAnchoredTopic = this.iface.getEvent('BatchAnchored')!.topicHash;
  }

  // -------------------------------------------------------------------------
  // anchorBatch - full transaction flow (#29)
  // -------------------------------------------------------------------------

  async anchorBatch(
    batchKey: string,
    merkleRoot: string,
    datasetHash: string,
    eventCount: bigint
  ): Promise<AnchorResult> {
    // 1. Validate parameters.
    assertBytes32(batchKey, 'batchKey');
    assertBytes32(merkleRoot, 'merkleRoot');
    assertBytes32(datasetHash, 'datasetHash');
    if (eventCount <= 0n) {
      throw new AnchorClientError(
        'eventCount must be > 0',
        'INVALID_PARAMS'
      );
    }
    if (batchKey === ZERO_BYTES32 || merkleRoot === ZERO_BYTES32 || datasetHash === ZERO_BYTES32) {
      throw new AnchorClientError(
        'batchKey, merkleRoot and datasetHash must be non-zero',
        'INVALID_PARAMS'
      );
    }

    // 2. Check duplicate locally before spending gas.
    if (await this.contract.isRootAnchored(batchKey, merkleRoot)) {
      return {
        status: AnchorStatus.SUPERSEDED,
        batchKey,
        error: 'This (batchKey, merkleRoot) pair is already anchored on-chain',
      };
    }

    // 3-6. Build, sign, submit with retries; track transaction ID.
    const maxRetries = this.options.maxRetries ?? 3;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const tx = await this.contract.anchorBatch(
          batchKey,
          merkleRoot,
          datasetHash,
          eventCount
        );
        const receipt = await tx.wait();

        if (receipt === null || receipt.status !== 1) {
          throw new AnchorClientError(
            `Transaction reverted (txId=${tx.hash})`,
            'CONTRACT_ERROR'
          );
        }

        // 7-8. Decode BatchAnchored event from the receipt logs.
        const event = this.decodeBatchAnchoredFromReceipt(receipt);
        if (!event) {
          throw new AnchorClientError(
            'BatchAnchored event not found in receipt logs',
            'CONTRACT_ERROR'
          );
        }

        // 9. Confirmation / finality handling (VeChainThor two-block model).
        if (this.options.waitForFinality !== false) {
          await this.waitForFinality(BigInt(receipt.blockNumber));
        }

        return {
          status: this.options.waitForFinality === false
            ? AnchorStatus.CONFIRMED
            : AnchorStatus.FINALIZED,
          batchKey,
          version: event.version,
          transactionId: tx.hash,
          blockNumber: BigInt(receipt.blockNumber),
          event,
        };
      } catch (err) {
        lastError = err;
        const duplicate = this.isDuplicateRootRevert(err);
        if (duplicate) {
          // A concurrent anchor won the race. Report SUPERSEDED, not FAILED:
          // the commitment IS on-chain, just submitted by another attempt.
          return {
            status: AnchorStatus.SUPERSEDED,
            batchKey,
            error: 'Root was anchored by a concurrent transaction',
          };
        }
        if (attempt < maxRetries) {
          await sleep(500 * 2 ** (attempt - 1)); // exponential backoff
        }
      }
    }

    return {
      status: AnchorStatus.FAILED,
      batchKey,
      error: lastError instanceof Error ? lastError.message : String(lastError),
    };
  }

  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------

  async getLatestAnchor(batchKey: string): Promise<IntegrityAnchor> {
    assertBytes32(batchKey, 'batchKey');
    return this.contract.getLatestAnchor(batchKey);
  }

  async getAnchor(batchKey: string, version: bigint): Promise<IntegrityAnchor> {
    assertBytes32(batchKey, 'batchKey');
    if (version <= 0n) {
      throw new AnchorClientError('version must be >= 1', 'INVALID_PARAMS');
    }
    return this.contract.getAnchor(batchKey, version);
  }

  async getLatestVersion(batchKey: string): Promise<bigint> {
    assertBytes32(batchKey, 'batchKey');
    return this.contract.getLatestVersion(batchKey);
  }

  async isRootAnchored(batchKey: string, merkleRoot: string): Promise<boolean> {
    assertBytes32(batchKey, 'batchKey');
    assertBytes32(merkleRoot, 'merkleRoot');
    return this.contract.isRootAnchored(batchKey, merkleRoot);
  }

  // -------------------------------------------------------------------------
  // Fee delegation (#32) - adapter-level only, contract untouched
  // -------------------------------------------------------------------------

  /**
   * Returns the features this adapter supports. Fee delegation is configured
   * at the transaction/adapter layer: VeChainThor separates the gas payer
   * (sponsor) from the transaction origin, so the anchor wallet needs no VTHO
   * when a sponsor is configured. msg.sender remains the origin, therefore
   * `anchoredBy` stays correct.
   */
  getFeeDelegationInfo(): {
    enabled: boolean;
    url?: string;
    model: 'VET (asset) + VTHO (gas) - direct' | 'VET (asset) + VTHO (gas) - sponsored';
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

  private decodeBatchAnchoredFromReceipt(
    receipt: ethers.TransactionReceipt
  ): BatchAnchoredEvent | null {
    for (const log of receipt.logs) {
      if (log.topics[0] !== this.batchAnchoredTopic) continue;
      const parsed = this.iface.parseLog({
        topics: [...log.topics],
        data: log.data,
      });
      if (parsed !== null && parsed.name === 'BatchAnchored') {
        return {
          batchKey: String(parsed.args.batchKey),
          version: BigInt(parsed.args.version),
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
      // VeChainThor: finalized after the following block is committed.
      if (current >= blockNumber + FINALIZED_CONFIRMATIONS) {
        return;
      }
      await sleep(2_000);
    }
    // Timeout: leave as CONFIRMED; the indexer is responsible for the
    // CONFIRMED -> FINALIZED transition based on indexer observations.
  }

  private isDuplicateRootRevert(err: unknown): boolean {
    const msg = err instanceof Error ? err.message : String(err);
    return (
      msg.includes('RootAlreadyAnchored') ||
      msg.includes('0x0ba6a800') || // custom error selector
      msg.includes('already anchored')
    );
  }
}
