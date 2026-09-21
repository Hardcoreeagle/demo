/**
 * Indexer service (#46): persists BatchAnchored events into PostgreSQL.
 *
 * - Idempotent: re-processing the same log never duplicates rows
 *   (ON CONFLICT DO NOTHING mirrors the on-chain uniqueness guarantees).
 * - Non-authoritative: this index is for operational queries only. Any
 *   integrity decision must be re-verified against VeChainThor state via
 *   scripts/verify-anchor.ts or the adapter's query methods.
 * - Contract-agnostic queries: getLatestAnchor / getVersionHistory /
 *   findByMerkleRoot for verification services.
 */

import { Pool, PoolClient } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';
import type {
  BatchAnchoredEvent,
} from '../vechain/BatchIntegrityAnchorClient';

export interface IndexerConfig {
  connectionString: string;
  /** 0x-prefixed lowercase contract address this indexer instance follows. */
  contractAddress: string;
  network: string;
  chainId: string;
  /** Block to start scanning from (deployment block). */
  startBlock?: bigint;
}

export interface IndexedAnchor {
  id: bigint;
  batchKey: string;
  version: bigint;
  merkleRoot: string;
  datasetHash: string;
  eventCount: bigint;
  anchoredBy: string;
  txId: string;
  blockNumber: bigint;
  blockTimestamp: Date;
  network: string;
  status?: 'CONFIRMED' | 'FINALIZED';
}

/** One indexed EPCIS event (EventIntegrityAnchor). */
export interface IndexedEvent {
  id: bigint;
  contractAddress: string;
  batchKey: string;
  eventHash: string;
  eventId: string;
  eventType: number;
  sequence: bigint;
  anchoredBy: string;
  txId: string;
  blockNumber: bigint;
  blockTimestamp: Date;
  network: string;
}

/** One indexed batch-root linking commitment (EventIntegrityAnchor). */
export interface IndexedBatchRoot {
  id: bigint;
  contractAddress: string;
  batchKey: string;
  merkleRoot: string;
  datasetHash: string;
  eventCount: bigint;
  anchoredBy: string;
  txId: string;
  blockNumber: bigint;
  blockTimestamp: Date;
  network: string;
}

export class IndexerService {
  private pool: Pool;
  readonly contractAddress: string;

  constructor(private readonly config: IndexerConfig) {
    if (!/^0x[0-9a-fA-F]{40}$/.test(config.contractAddress)) {
      throw new Error(`Invalid contract address: ${config.contractAddress}`);
    }
    this.contractAddress = config.contractAddress.toLowerCase();
    this.pool = new Pool({ connectionString: config.connectionString });
  }

  /** Apply schema.sql (idempotent, safe on every start). */
  async migrate(): Promise<void> {
    const sql = readFileSync(
      join(__dirname, 'schema.sql'),
      'utf8'
    );
    await this.pool.query(sql);
    await this.pool.query(
      `INSERT INTO contract_deployments (contract_address, network, chain_id, start_block)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (contract_address) DO NOTHING`,
      [
        this.contractAddress,
        this.config.network,
        this.config.chainId,
        this.config.startBlock?.toString() ?? '0',
      ]
    );
  }

  /** Persist one decoded BatchAnchored event. Returns the row id (or existing id on duplicate). */
  async persistAnchoredEvent(
    event: BatchAnchoredEvent,
    meta: {
      txId: string;
      blockNumber: bigint;
      blockTimestamp: Date;
      status?: 'CONFIRMED' | 'FINALIZED';
    }
  ): Promise<bigint> {
    const client: PoolClient = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const upsert = await client.query(
        `INSERT INTO anchored_batches
           (contract_address, batch_key, version, merkle_root, dataset_hash,
            event_count, anchored_by, tx_id, block_number, block_timestamp, network)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (contract_address, batch_key, version) DO NOTHING
         RETURNING id`,
        [
          this.contractAddress,
          String(event.batchKey).toLowerCase(),
          event.version.toString(),
          String(event.merkleRoot).toLowerCase(),
          String(event.datasetHash).toLowerCase(),
          event.eventCount.toString(),
          String(event.anchoredBy).toLowerCase(),
          meta.txId,
          meta.blockNumber.toString(),
          meta.blockTimestamp,
          this.config.network,
        ]
      );

      let id: bigint;
      if (upsert.rows.length > 0) {
        id = BigInt(upsert.rows[0].id);
      } else {
        // Duplicate: fetch the existing row's id (idempotent redelivery).
        const existing = await client.query(
          `SELECT id FROM anchored_batches
           WHERE contract_address = $1 AND batch_key = $2 AND version = $3`,
          [
            this.contractAddress,
            String(event.batchKey).toLowerCase(),
            event.version.toString(),
          ]
        );
        id = BigInt(existing.rows[0].id);
      }

      if (meta.status) {
        await client.query(
          `INSERT INTO anchor_status_history (anchored_batch_id, status)
           VALUES ($1, $2)`,
          [id, meta.status]
        );
      }

      await client.query('COMMIT');
      return id;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /** Mark an anchor FINALIZED after the two-block finality window. */
  async markFinalized(id: bigint): Promise<void> {
    await this.pool.query(
      `INSERT INTO anchor_status_history (anchored_batch_id, status)
       VALUES ($1, 'FINALIZED')`,
      [id.toString()]
    );
  }

  // -------------------------------------------------------------------------
  // Query API (operational only; verify against chain for integrity decisions)
  // -------------------------------------------------------------------------

  async getLatestAnchor(batchKey: string): Promise<IndexedAnchor | null> {
    const res = await this.pool.query(
      `SELECT * FROM anchored_batches
       WHERE contract_address = $1 AND batch_key = $2
       ORDER BY version DESC LIMIT 1`,
      [this.contractAddress, batchKey.toLowerCase()]
    );
    return res.rows[0] ? mapRow(res.rows[0]) : null;
  }

  async getVersionHistory(batchKey: string): Promise<IndexedAnchor[]> {
    const res = await this.pool.query(
      `SELECT * FROM anchored_batches
       WHERE contract_address = $1 AND batch_key = $2
       ORDER BY version ASC`,
      [this.contractAddress, batchKey.toLowerCase()]
    );
    return res.rows.map(mapRow);
  }

  async findByMerkleRoot(merkleRoot: string): Promise<IndexedAnchor | null> {
    const res = await this.pool.query(
      `SELECT * FROM anchored_batches
       WHERE contract_address = $1 AND merkle_root = $2`,
      [this.contractAddress, merkleRoot.toLowerCase()]
    );
    return res.rows[0] ? mapRow(res.rows[0]) : null;
  }

  // -------------------------------------------------------------------------
  // Per-event index (EventIntegrityAnchor) - one row per EPCIS event
  // -------------------------------------------------------------------------

  /**
   * Persist one decoded EventAnchored event. Idempotent: re-processing the
   * same (contract, event_hash) never duplicates rows. Returns the row id.
   *
   * @param eventContractAddress the EventIntegrityAnchor address (may differ
   *        from this.contractAddress, which tracks the batch anchor).
   */
  async persistAnchoredEpcisEvent(
    event: {
      batchKey: string;
      eventHash: string;
      eventId: string;
      eventType: number | bigint;
      sequence: bigint;
      anchoredBy: string;
    },
    meta: {
      eventContractAddress: string;
      txId: string;
      blockNumber: bigint;
      blockTimestamp: Date;
    }
  ): Promise<bigint> {
    const contract = meta.eventContractAddress.toLowerCase();
    const upsert = await this.pool.query(
      `INSERT INTO anchored_events
         (contract_address, batch_key, event_hash, event_id, event_type,
          sequence, anchored_by, tx_id, block_number, block_timestamp, network)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (contract_address, event_hash) DO NOTHING
       RETURNING id`,
      [
        contract,
        String(event.batchKey).toLowerCase(),
        String(event.eventHash).toLowerCase(),
        String(event.eventId).toLowerCase(),
        Number(event.eventType),
        event.sequence.toString(),
        String(event.anchoredBy).toLowerCase(),
        meta.txId,
        meta.blockNumber.toString(),
        meta.blockTimestamp,
        this.config.network,
      ]
    );
    if (upsert.rows.length > 0) return BigInt(upsert.rows[0].id);
    const existing = await this.pool.query(
      `SELECT id FROM anchored_events
       WHERE contract_address = $1 AND event_hash = $2`,
      [contract, String(event.eventHash).toLowerCase()]
    );
    return BigInt(existing.rows[0].id);
  }

  /** Persist one decoded BatchRootAnchored event (the linking commitment). */
  async persistBatchRoot(
    event: {
      batchKey: string;
      merkleRoot: string;
      datasetHash: string;
      eventCount: bigint;
      anchoredBy: string;
    },
    meta: {
      eventContractAddress: string;
      txId: string;
      blockNumber: bigint;
      blockTimestamp: Date;
    }
  ): Promise<bigint> {
    const contract = meta.eventContractAddress.toLowerCase();
    const upsert = await this.pool.query(
      `INSERT INTO batch_roots
         (contract_address, batch_key, merkle_root, dataset_hash, event_count,
          anchored_by, tx_id, block_number, block_timestamp, network)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (contract_address, batch_key) DO NOTHING
       RETURNING id`,
      [
        contract,
        String(event.batchKey).toLowerCase(),
        String(event.merkleRoot).toLowerCase(),
        String(event.datasetHash).toLowerCase(),
        event.eventCount.toString(),
        String(event.anchoredBy).toLowerCase(),
        meta.txId,
        meta.blockNumber.toString(),
        meta.blockTimestamp,
        this.config.network,
      ]
    );
    if (upsert.rows.length > 0) return BigInt(upsert.rows[0].id);
    const existing = await this.pool.query(
      `SELECT id FROM batch_roots
       WHERE contract_address = $1 AND batch_key = $2`,
      [contract, String(event.batchKey).toLowerCase()]
    );
    return BigInt(existing.rows[0].id);
  }

  /** Resolve a transaction hash to its anchored EPCIS event ("paste tx, see event"). */
  async getEventByTx(txId: string): Promise<IndexedEvent | null> {
    const res = await this.pool.query(
      `SELECT * FROM anchored_events WHERE tx_id = $1 LIMIT 1`,
      [txId]
    );
    return res.rows[0] ? mapEventRow(res.rows[0]) : null;
  }

  /** Resolve an event hash to its anchored record. */
  async getEventByHash(eventHash: string): Promise<IndexedEvent | null> {
    const res = await this.pool.query(
      `SELECT * FROM anchored_events WHERE event_hash = $1 LIMIT 1`,
      [eventHash.toLowerCase()]
    );
    return res.rows[0] ? mapEventRow(res.rows[0]) : null;
  }

  /** List every anchored event of a batch, in anchoring order. */
  async getEventsByBatch(batchKey: string): Promise<IndexedEvent[]> {
    const res = await this.pool.query(
      `SELECT * FROM anchored_events
       WHERE batch_key = $1
       ORDER BY sequence ASC`,
      [batchKey.toLowerCase()]
    );
    return res.rows.map(mapEventRow);
  }

  /** Fetch the batch-root linking commitment for a batch. */
  async getBatchRoot(batchKey: string): Promise<IndexedBatchRoot | null> {
    const res = await this.pool.query(
      `SELECT * FROM batch_roots WHERE batch_key = $1 LIMIT 1`,
      [batchKey.toLowerCase()]
    );
    return res.rows[0] ? mapBatchRootRow(res.rows[0]) : null;
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

function mapRow(r: any): IndexedAnchor {
  return {
    id: BigInt(r.id),
    batchKey: r.batch_key,
    version: BigInt(r.version),
    merkleRoot: r.merkle_root,
    datasetHash: r.dataset_hash,
    eventCount: BigInt(r.event_count),
    anchoredBy: r.anchored_by,
    txId: r.tx_id,
    blockNumber: BigInt(r.block_number),
    blockTimestamp: new Date(r.block_timestamp),
    network: r.network,
  };
}

function mapEventRow(r: any): IndexedEvent {
  return {
    id: BigInt(r.id),
    contractAddress: r.contract_address,
    batchKey: r.batch_key,
    eventHash: r.event_hash,
    eventId: r.event_id,
    eventType: Number(r.event_type),
    sequence: BigInt(r.sequence),
    anchoredBy: r.anchored_by,
    txId: r.tx_id,
    blockNumber: BigInt(r.block_number),
    blockTimestamp: new Date(r.block_timestamp),
    network: r.network,
  };
}

function mapBatchRootRow(r: any): IndexedBatchRoot {
  return {
    id: BigInt(r.id),
    contractAddress: r.contract_address,
    batchKey: r.batch_key,
    merkleRoot: r.merkle_root,
    datasetHash: r.dataset_hash,
    eventCount: BigInt(r.event_count),
    anchoredBy: r.anchored_by,
    txId: r.tx_id,
    blockNumber: BigInt(r.block_number),
    blockTimestamp: new Date(r.block_timestamp),
    network: r.network,
  };
}
