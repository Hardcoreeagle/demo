import { expect } from 'chai';
import { ethers, network } from 'hardhat';
import { createHash } from 'crypto';
import { randomUUID } from 'crypto';
import type { BatchIntegrityAnchor } from '../../typechain-types';
import { deriveBatchCommitment } from '../../src/integrity/IntegrityEngine';
import { BatchAnchoredEventWatcher } from '../../src/indexer/EventWatcher';
import { IndexerService } from '../../src/indexer/IndexerService';
import { VeChainThorAnchorClient } from '../../src/vechain/BatchIntegrityAnchorClient';

/**
 * Indexer integration (#46). Two sections:
 *  A. Thorest watcher against the live Thor Solo node (skips if not running).
 *  B. IndexerService against real PostgreSQL (skips if no server available).
 */
describe('indexer integration', function () {
  this.timeout(180_000);

  const SOLO_URL = process.env.VECHAIN_RPC_URL ?? 'http://127.0.0.1:8669';

  // ------------------------------------------------------------------
  // Shared chain setup: deploy fresh contract on Solo, anchor 2 versions
  // ------------------------------------------------------------------
  async function deployAndAnchorOnSolo() {
    const [admin, anchorService] = await ethers.getSigners();
    const factory = await ethers.getContractFactory('BatchIntegrityAnchor');
    const contract = (await factory.deploy(admin.address)) as unknown as BatchIntegrityAnchor;
    await contract.waitForDeployment();
    await contract.connect(admin).grantRole(
      await contract.ANCHOR_ROLE(),
      anchorService.address
    );

    const batchKey = '0x' + createHash('sha256').update('PF05043-' + randomUUID()).digest('hex');
    const doc = makeEpcis();
    const client = new VeChainThorAnchorClient({
      rpcUrl: SOLO_URL,
      contractAddress: await contract.getAddress(),
      signer: anchorService as unknown as never,
      waitForFinality: false,
    });
    const c1 = deriveBatchCommitment(doc, batchKey);
    await client.anchorBatch(c1.batchKey, c1.merkleRoot, c1.datasetHash, c1.eventCount);

    const doc2 = makeEpcis(2);
    const c2 = deriveBatchCommitment(doc2, batchKey);
    await client.anchorBatch(c2.batchKey, c2.merkleRoot, c2.datasetHash, c2.eventCount);

    return { contractAddress: await contract.getAddress(), batchKey };
  }

  // ------------------------------------------------------------------
  // A. Thorest watcher on live Solo
  // ------------------------------------------------------------------
  describe('Thorest watcher (live Solo)', () => {
    let soloUp = false;
    before(async function () {
      // These tests MUST run against Solo: npx hardhat test --network vechain_solo
      // Under the default in-memory network there is nothing to watch.
      if (network.name !== 'vechain_solo') this.skip();
      try {
        const res = await fetch(`${SOLO_URL}/blocks/best`);
        soloUp = res.ok;
      } catch {
        soloUp = false;
      }
      if (!soloUp) this.skip();
    });

    it('finds the two anchored versions via /logs/event', async () => {
      const { contractAddress, batchKey } = await deployAndAnchorOnSolo();

      const watcher = new BatchAnchoredEventWatcher({
        rpcUrl: SOLO_URL,
        contractAddress,
        startBlock: 0n,
      });

      const seen: { batchKey: string; version: bigint; blockNumber: bigint }[] = [];
      await watcher.pollOnce(async (event, meta) => {
        seen.push({ batchKey: event.batchKey, version: event.version, blockNumber: meta.blockNumber });
        expect(meta.txId).to.match(/^0x[0-9a-f]{64}$/);
        expect(meta.blockTimestamp.getTime()).to.be.greaterThan(0);
      });

      const mine = seen.filter((e) => e.batchKey === batchKey);
      expect(mine.map((m) => m.version).sort()).to.deep.equal([1n, 2n]);
      // Checkpoint advanced past both events.
      expect(watcher.checkpoint).to.be.greaterThan(0n);
    });

    it('does not redeliver events after the checkpoint advances', async () => {
      const { contractAddress } = await deployAndAnchorOnSolo();
      const watcher = new BatchAnchoredEventWatcher({
        rpcUrl: SOLO_URL,
        contractAddress,
        startBlock: 0n,
      });
      let count = 0;
      await watcher.pollOnce(async () => {
        count++;
      });
      const first = count;
      expect(first).to.be.greaterThan(0);
      // Second poll from advanced checkpoint: nothing new delivered.
      count = 0;
      await watcher.pollOnce(async () => {
        count++;
      });
      expect(count).to.equal(0);
    });
  });

  // ------------------------------------------------------------------
  // B. IndexerService on real PostgreSQL
  // ------------------------------------------------------------------
  describe('IndexerService (real PostgreSQL)', () => {
    let pgUp = false;
    const dbUrl =
      process.env.INDEXER_TEST_DATABASE_URL ??
      'postgres://postgres:postgres@127.0.0.1:5432/postgres';

    before(async function () {
      try {
        const { Client } = await import('pg');
        const c = new Client({ connectionString: dbUrl });
        await c.connect();
        await c.end();
        pgUp = true;
      } catch {
        pgUp = false;
      }
      if (!pgUp) this.skip();
    });

    it('persists, deduplicates, and queries anchors', async () => {
      const indexer = new IndexerService({
        connectionString: dbUrl,
        contractAddress: '0x' + 'ab'.repeat(20), // synthetic address, isolated rows
        network: 'vechain_testnet',
        chainId: '100010',
      });
      await indexer.migrate();

      const mkEvent = (version: bigint): Parameters<IndexerService['persistAnchoredEvent']>[0] => ({
        batchKey: '0x' + '11'.repeat(32),
        version,
        merkleRoot: '0x' + (version === 1n ? 'aa'.repeat(32) : 'bb'.repeat(32)),
        datasetHash: '0x' + 'cc'.repeat(32),
        eventCount: 42n,
        timestamp: 1700000000n,
        anchoredBy: '0x' + '44'.repeat(20),
      });

      const meta = {
        txId: '0x' + '55'.repeat(32),
        blockNumber: 123n,
        blockTimestamp: new Date('2026-01-01T00:00:00Z'),
        status: 'CONFIRMED' as const,
      };

      const id1 = await indexer.persistAnchoredEvent(mkEvent(1n), meta);
      const id1again = await indexer.persistAnchoredEvent(mkEvent(1n), meta); // duplicate delivery
      const id2 = await indexer.persistAnchoredEvent(mkEvent(2n), meta);
      expect(id1).to.equal(id1again); // idempotent
      expect(id2).to.not.equal(id1);

      const latest = await indexer.getLatestAnchor('0x' + '11'.repeat(32));
      expect(latest).to.exist;
      expect(latest!.version).to.equal(2n);
      expect(latest!.eventCount).to.equal(42n);

      const history = await indexer.getVersionHistory('0x' + '11'.repeat(32));
      expect(history.map((h) => h.version)).to.deep.equal([1n, 2n]);

      const byRoot = await indexer.findByMerkleRoot('0x' + 'aa'.repeat(32));
      expect(byRoot).to.exist;
      expect(byRoot!.id).to.equal(id1);

      await indexer.close();
    });
  });
});

/** Minimal realistic EPCIS document; variant adds one extra event. */
function makeEpcis(variant = 1) {
  return {
    '@context': ['https://ref.gs1.org/epcis/epcis-context.jsonld'],
    type: 'EPCISDocument',
    schemaVersion: '2.0',
    epcisBody: {
      eventList: [
        {
          type: 'TransformationEvent',
          eventID: 'urn:uuid:gs1-engine:transformation:TRANS-SFG-001',
          eventTime: '2010-02-01T00:00:00Z',
          inputQuantityList: [{ epcClass: 'urn:internal:batch:x:RM-MET-05043', quantity: 105.07434, uom: 'KG' }],
          outputQuantityList: [{ epcClass: 'urn:internal:batch:x:PF05043-CORE', quantity: 105.07434, uom: 'KG' }],
        },
        ...(variant > 1
          ? [{ type: 'ObjectEvent', eventID: 'urn:uuid:gs1-engine:object:extra-1' }]
          : []),
      ],
    },
  };
}
