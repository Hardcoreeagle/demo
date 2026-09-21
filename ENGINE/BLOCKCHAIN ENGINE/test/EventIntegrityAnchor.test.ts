import { expect } from 'chai';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import type { EventIntegrityAnchor } from '../typechain-types';

/**
 * Unit tests for EventIntegrityAnchor: per-event anchoring (one tx per event),
 * batch-root linking, duplicate protection, count-match enforcement, access
 * control, pause, queries, events.
 */
describe('EventIntegrityAnchor - unit', () => {
  const BATCH_A = ethers.id('PF05043');
  const EVENT_1 = ethers.id('event-1');
  const EVENT_2 = ethers.id('event-2');
  const EVENT_3 = ethers.id('event-3');
  const EVENT_ID_1 = ethers.id('urn:event:1');
  const ROOT_A = ethers.id('root-A');
  const DATASET_A = ethers.id('dataset-A');
  const OBJECT_EVENT = 1;

  async function deployFixture() {
    const [admin, anchorService, other, deployer] = await ethers.getSigners();
    const factory = await ethers.getContractFactory(
      'EventIntegrityAnchor',
      deployer
    );
    const contract = (await factory.deploy(
      admin.address
    )) as unknown as EventIntegrityAnchor;
    await contract.waitForDeployment();
    return { contract, admin, anchorService, other, deployer };
  }

  async function withRoleFixture() {
    const base = await deployFixture();
    const role = await base.contract.ANCHOR_ROLE();
    await base.contract
      .connect(base.admin)
      .grantRole(role, base.anchorService.address);
    return base;
  }

  describe('deployment', () => {
    it('grants DEFAULT_ADMIN_ROLE to the explicit admin', async () => {
      const { contract, admin } = await loadFixture(deployFixture);
      const adminRole = await contract.DEFAULT_ADMIN_ROLE();
      expect(await contract.hasRole(adminRole, admin.address)).to.equal(true);
    });

    it('does NOT grant ANCHOR_ROLE at deployment', async () => {
      const { contract, admin, deployer } = await loadFixture(deployFixture);
      const role = await contract.ANCHOR_ROLE();
      expect(await contract.hasRole(role, admin.address)).to.equal(false);
      expect(await contract.hasRole(role, deployer.address)).to.equal(false);
    });

    it('rejects the zero address as admin', async () => {
      const factory = await ethers.getContractFactory('EventIntegrityAnchor');
      await expect(
        factory.deploy(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(factory, 'InvalidAdmin');
    });

    it('starts with empty batch state', async () => {
      const { contract } = await loadFixture(deployFixture);
      expect(await contract.getBatchEventCount(BATCH_A)).to.equal(0n);
      expect(await contract.isBatchRootAnchored(BATCH_A)).to.equal(false);
    });
  });

  describe('access control', () => {
    it('admin without ANCHOR_ROLE cannot anchor events', async () => {
      const { contract, admin } = await loadFixture(deployFixture);
      await expect(
        contract.connect(admin).anchorEvent(BATCH_A, EVENT_1, EVENT_ID_1, OBJECT_EVENT)
      ).to.be.revertedWithCustomError(contract, 'AccessControlUnauthorizedAccount');
    });

    it('non-anchor cannot anchor a batch root', async () => {
      const { contract, other } = await loadFixture(withRoleFixture);
      await expect(
        contract.connect(other).anchorBatchRoot(BATCH_A, ROOT_A, DATASET_A, 1)
      ).to.be.revertedWithCustomError(contract, 'AccessControlUnauthorizedAccount');
    });
  });

  describe('per-event anchoring', () => {
    it('anchors a single event with correct fields and sequence', async () => {
      const { contract, anchorService } = await loadFixture(withRoleFixture);

      await contract
        .connect(anchorService)
        .anchorEvent(BATCH_A, EVENT_1, EVENT_ID_1, OBJECT_EVENT);

      const rec = await contract.getEventRecord(EVENT_1);
      expect(rec.batchKey).to.equal(BATCH_A);
      expect(rec.eventHash).to.equal(EVENT_1);
      expect(rec.eventId).to.equal(EVENT_ID_1);
      expect(rec.eventType).to.equal(BigInt(OBJECT_EVENT));
      expect(rec.sequence).to.equal(1n);
      expect(rec.anchoredBy).to.equal(anchorService.address);
      expect(rec.timestamp).to.be.greaterThan(0n);
    });

    it('assigns 1-based sequence per event and lists them in order', async () => {
      const { contract, anchorService } = await loadFixture(withRoleFixture);

      await contract.connect(anchorService).anchorEvent(BATCH_A, EVENT_1, ethers.ZeroHash, 1);
      await contract.connect(anchorService).anchorEvent(BATCH_A, EVENT_2, ethers.ZeroHash, 2);
      await contract.connect(anchorService).anchorEvent(BATCH_A, EVENT_3, ethers.ZeroHash, 3);

      expect(await contract.getBatchEventCount(BATCH_A)).to.equal(3n);
      const hashes = await contract.getBatchEventHashes(BATCH_A);
      expect(hashes).to.deep.equal([EVENT_1, EVENT_2, EVENT_3]);
      expect(await contract.getBatchEventHashAt(BATCH_A, 2n)).to.equal(EVENT_2);
    });

    it('emits EventAnchored with all fields', async () => {
      const { contract, anchorService } = await loadFixture(withRoleFixture);
      const tx = await contract
        .connect(anchorService)
        .anchorEvent(BATCH_A, EVENT_1, EVENT_ID_1, OBJECT_EVENT);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt!.blockNumber);

      await expect(tx)
        .to.emit(contract, 'EventAnchored')
        .withArgs(
          BATCH_A,
          EVENT_1,
          EVENT_ID_1,
          OBJECT_EVENT,
          1n,
          block!.timestamp,
          anchorService.address
        );
    });

    it('allows a zero eventId (no stable EPCIS id)', async () => {
      const { contract, anchorService } = await loadFixture(withRoleFixture);
      await contract
        .connect(anchorService)
        .anchorEvent(BATCH_A, EVENT_1, ethers.ZeroHash, 0);
      expect(await contract.isEventAnchored(EVENT_1)).to.equal(true);
    });

    it('rejects zero batchKey and zero eventHash', async () => {
      const { contract, anchorService } = await loadFixture(withRoleFixture);
      await expect(
        contract.connect(anchorService).anchorEvent(ethers.ZeroHash, EVENT_1, EVENT_ID_1, 1)
      ).to.be.revertedWithCustomError(contract, 'InvalidBatchKey');
      await expect(
        contract.connect(anchorService).anchorEvent(BATCH_A, ethers.ZeroHash, EVENT_ID_1, 1)
      ).to.be.revertedWithCustomError(contract, 'InvalidEventHash');
    });
  });

  describe('duplicate protection', () => {
    it('rejects anchoring the same eventHash twice', async () => {
      const { contract, anchorService } = await loadFixture(withRoleFixture);
      await contract.connect(anchorService).anchorEvent(BATCH_A, EVENT_1, EVENT_ID_1, 1);
      await expect(
        contract.connect(anchorService).anchorEvent(BATCH_A, EVENT_1, EVENT_ID_1, 1)
      ).to.be.revertedWithCustomError(contract, 'EventAlreadyAnchored');
    });

    it('reverts EventNotFound for an unknown event', async () => {
      const { contract } = await loadFixture(deployFixture);
      await expect(
        contract.getEventRecord(EVENT_1)
      ).to.be.revertedWithCustomError(contract, 'EventNotFound');
    });
  });

  describe('batch-root linking', () => {
    it('links events under a root when the count matches', async () => {
      const { contract, anchorService } = await loadFixture(withRoleFixture);
      await contract.connect(anchorService).anchorEvent(BATCH_A, EVENT_1, ethers.ZeroHash, 1);
      await contract.connect(anchorService).anchorEvent(BATCH_A, EVENT_2, ethers.ZeroHash, 1);

      await expect(
        contract.connect(anchorService).anchorBatchRoot(BATCH_A, ROOT_A, DATASET_A, 2)
      ).to.emit(contract, 'BatchRootAnchored');

      const root = await contract.getBatchRoot(BATCH_A);
      expect(root.merkleRoot).to.equal(ROOT_A);
      expect(root.datasetHash).to.equal(DATASET_A);
      expect(root.eventCount).to.equal(2n);
    });

    it('rejects a root whose count differs from anchored events', async () => {
      const { contract, anchorService } = await loadFixture(withRoleFixture);
      await contract.connect(anchorService).anchorEvent(BATCH_A, EVENT_1, ethers.ZeroHash, 1);
      await expect(
        contract.connect(anchorService).anchorBatchRoot(BATCH_A, ROOT_A, DATASET_A, 2)
      ).to.be.revertedWithCustomError(contract, 'EventCountMismatch');
    });

    it('rejects anchoring the batch root twice', async () => {
      const { contract, anchorService } = await loadFixture(withRoleFixture);
      await contract.connect(anchorService).anchorEvent(BATCH_A, EVENT_1, ethers.ZeroHash, 1);
      await contract.connect(anchorService).anchorBatchRoot(BATCH_A, ROOT_A, DATASET_A, 1);
      await expect(
        contract.connect(anchorService).anchorBatchRoot(BATCH_A, ROOT_A, DATASET_A, 1)
      ).to.be.revertedWithCustomError(contract, 'BatchRootAlreadyAnchored');
    });

    it('rejects invalid root inputs', async () => {
      const { contract, anchorService } = await loadFixture(withRoleFixture);
      await contract.connect(anchorService).anchorEvent(BATCH_A, EVENT_1, ethers.ZeroHash, 1);
      await expect(
        contract.connect(anchorService).anchorBatchRoot(BATCH_A, ethers.ZeroHash, DATASET_A, 1)
      ).to.be.revertedWithCustomError(contract, 'InvalidMerkleRoot');
      await expect(
        contract.connect(anchorService).anchorBatchRoot(BATCH_A, ROOT_A, ethers.ZeroHash, 1)
      ).to.be.revertedWithCustomError(contract, 'InvalidDatasetHash');
      await expect(
        contract.connect(anchorService).anchorBatchRoot(BATCH_A, ROOT_A, DATASET_A, 0)
      ).to.be.revertedWithCustomError(contract, 'InvalidEventCount');
    });

    it('reverts BatchRootNotFound before the root is anchored', async () => {
      const { contract } = await loadFixture(deployFixture);
      await expect(
        contract.getBatchRoot(BATCH_A)
      ).to.be.revertedWithCustomError(contract, 'BatchRootNotFound');
    });
  });

  describe('pause', () => {
    it('blocks anchoring while paused and resumes after unpause', async () => {
      const { contract, admin, anchorService } = await loadFixture(withRoleFixture);
      await contract.connect(admin).pause();
      await expect(
        contract.connect(anchorService).anchorEvent(BATCH_A, EVENT_1, EVENT_ID_1, 1)
      ).to.be.revertedWithCustomError(contract, 'EnforcedPause');
      await contract.connect(admin).unpause();
      await contract.connect(anchorService).anchorEvent(BATCH_A, EVENT_1, EVENT_ID_1, 1);
      expect(await contract.getBatchEventCount(BATCH_A)).to.equal(1n);
    });

    it('keeps queries available while paused', async () => {
      const { contract, admin, anchorService } = await loadFixture(withRoleFixture);
      await contract.connect(anchorService).anchorEvent(BATCH_A, EVENT_1, EVENT_ID_1, 1);
      await contract.connect(admin).pause();
      const rec = await contract.getEventRecord(EVENT_1);
      expect(rec.sequence).to.equal(1n);
      expect(await contract.isEventAnchored(EVENT_1)).to.equal(true);
    });
  });
});
