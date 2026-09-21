import { expect } from 'chai';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import type { BatchIntegrityAnchor } from '../typechain-types';

/**
 * Unit tests (#39): deployment, access control, anchoring, versioning,
 * duplicate protection, invalid inputs, pause/unpause, queries, events.
 */
describe('BatchIntegrityAnchor - unit', () => {
  const BATCH_A = ethers.id('PF05043');
  const ROOT_A = ethers.id('root-A');
  const ROOT_B = ethers.id('root-B');
  const DATASET_A = ethers.id('dataset-A');
  const DATASET_B = ethers.id('dataset-B');

  async function deployFixture() {
    const [admin, anchorService, other, deployer] =
      await ethers.getSigners();

    // The deployer is NOT implicitly privileged: admin is explicit.
    const factory = await ethers.getContractFactory(
      'BatchIntegrityAnchor',
      deployer
    );
    const contract = (await factory.deploy(admin.address)) as unknown as BatchIntegrityAnchor;
    await contract.waitForDeployment();

    return { contract, admin, anchorService, other, deployer };
  }

  async function deployedWithRoleFixture() {
    const base = await deployFixture();
    const role = await base.contract.ANCHOR_ROLE();
    await base.contract
      .connect(base.admin)
      .grantRole(role, base.anchorService.address);
    return base;
  }

  // -------------------------------------------------------------------
  // Deployment
  // -------------------------------------------------------------------

  describe('deployment', () => {
    it('grants DEFAULT_ADMIN_ROLE to the explicit admin', async () => {
      const { contract, admin } = await loadFixture(deployFixture);
      const adminRole = await contract.DEFAULT_ADMIN_ROLE();
      expect(await contract.hasRole(adminRole, admin.address)).to.equal(true);
    });

    it('does NOT grant ANCHOR_ROLE at deployment', async () => {
      const { contract, admin, deployer } = await loadFixture(deployFixture);
      const anchorRole = await contract.ANCHOR_ROLE();
      expect(await contract.hasRole(anchorRole, admin.address)).to.equal(false);
      expect(await contract.hasRole(anchorRole, deployer.address)).to.equal(false);
    });

    it('rejects the zero address as admin', async () => {
      const factory = await ethers.getContractFactory('BatchIntegrityAnchor');
      await expect(factory.deploy(ethers.ZeroAddress)).to.be.revertedWithCustomError(
        factory,
        'InvalidAdmin'
      );
    });

    it('starts with empty state', async () => {
      const { contract } = await loadFixture(deployFixture);
      expect(await contract.getLatestVersion(BATCH_A)).to.equal(0n);
    });
  });

  // -------------------------------------------------------------------
  // Access control
  // -------------------------------------------------------------------

  describe('access control', () => {
    it('admin can grant ANCHOR_ROLE', async () => {
      const { contract, admin, anchorService } = await loadFixture(deployFixture);
      const role = await contract.ANCHOR_ROLE();
      await expect(contract.connect(admin).grantRole(role, anchorService.address))
        .to.emit(contract, 'RoleGranted');
      expect(await contract.hasRole(role, anchorService.address)).to.equal(true);
    });

    it('admin can revoke ANCHOR_ROLE', async () => {
      const { contract, admin, anchorService } = await loadFixture(deployedWithRoleFixture);
      const role = await contract.ANCHOR_ROLE();
      await expect(contract.connect(admin).revokeRole(role, anchorService.address))
        .to.emit(contract, 'RoleRevoked');
      expect(await contract.hasRole(role, anchorService.address)).to.equal(false);
    });

    it('anchor service cannot grant roles', async () => {
      const { contract, anchorService, other } = await loadFixture(deployedWithRoleFixture);
      const role = await contract.ANCHOR_ROLE();
      await expect(
        contract.connect(anchorService).grantRole(role, other.address)
      ).to.be.revertedWithCustomError(contract, 'AccessControlUnauthorizedAccount');
    });

    it('anchor service cannot pause or unpause', async () => {
      const { contract, anchorService } = await loadFixture(deployedWithRoleFixture);
      await expect(
        contract.connect(anchorService).pause()
      ).to.be.revertedWithCustomError(contract, 'AccessControlUnauthorizedAccount');
      await expect(
        contract.connect(anchorService).unpause()
      ).to.be.revertedWithCustomError(contract, 'AccessControlUnauthorizedAccount');
    });

    it('admin without ANCHOR_ROLE cannot anchor', async () => {
      const { contract, admin } = await loadFixture(deployFixture);
      await expect(
        contract.connect(admin).anchorBatch(BATCH_A, ROOT_A, DATASET_A, 3)
      ).to.be.revertedWithCustomError(contract, 'AccessControlUnauthorizedAccount');
    });
  });

  // -------------------------------------------------------------------
  // Anchoring & versioning
  // -------------------------------------------------------------------

  describe('anchoring and versioning', () => {
    it('anchors version 1 with correct fields', async () => {
      const { contract, anchorService } = await loadFixture(deployedWithRoleFixture);

      await contract.connect(anchorService).anchorBatch(BATCH_A, ROOT_A, DATASET_A, 3);

      const anchor = await contract.getLatestAnchor(BATCH_A);
      expect(anchor.version).to.equal(1n);
      expect(anchor.merkleRoot).to.equal(ROOT_A);
      expect(anchor.datasetHash).to.equal(DATASET_A);
      expect(anchor.eventCount).to.equal(3n);
      expect(anchor.anchoredBy).to.equal(anchorService.address);
      expect(anchor.timestamp).to.be.greaterThan(0n);
    });

    it('anchors version 2 and version 3 (append-only)', async () => {
      const { contract, anchorService } = await loadFixture(deployedWithRoleFixture);

      await contract.connect(anchorService).anchorBatch(BATCH_A, ROOT_A, DATASET_A, 3);
      await contract.connect(anchorService).anchorBatch(BATCH_A, ROOT_B, DATASET_B, 5);
      const v3Root = ethers.id('root-C');
      await contract.connect(anchorService).anchorBatch(BATCH_A, v3Root, DATASET_B, 7);

      expect(await contract.getLatestVersion(BATCH_A)).to.equal(3n);
      const latest = await contract.getLatestAnchor(BATCH_A);
      expect(latest.version).to.equal(3n);
      expect(latest.merkleRoot).to.equal(v3Root);
    });

    it('keeps version history intact', async () => {
      const { contract, anchorService } = await loadFixture(deployedWithRoleFixture);

      await contract.connect(anchorService).anchorBatch(BATCH_A, ROOT_A, DATASET_A, 3);
      await contract.connect(anchorService).anchorBatch(BATCH_A, ROOT_B, DATASET_B, 5);

      const v1 = await contract.getAnchor(BATCH_A, 1n);
      const v2 = await contract.getAnchor(BATCH_A, 2n);
      expect(v1.merkleRoot).to.equal(ROOT_A);
      expect(v2.merkleRoot).to.equal(ROOT_B);
      expect(v1.eventCount).to.equal(3n);
      expect(v2.eventCount).to.equal(5n);
    });

    it('isolates versions across different batches', async () => {
      const { contract, anchorService } = await loadFixture(deployedWithRoleFixture);
      const batchB = ethers.id('PF05044');

      await contract.connect(anchorService).anchorBatch(BATCH_A, ROOT_A, DATASET_A, 3);
      await contract.connect(anchorService).anchorBatch(batchB, ROOT_B, DATASET_B, 5);

      expect(await contract.getLatestVersion(BATCH_A)).to.equal(1n);
      expect(await contract.getLatestVersion(batchB)).to.equal(1n);
    });

    it('emits BatchAnchored with all fields', async () => {
      const { contract, anchorService } = await loadFixture(deployedWithRoleFixture);

      const tx = await contract
        .connect(anchorService)
        .anchorBatch(BATCH_A, ROOT_A, DATASET_A, 3);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt!.blockNumber);

      await expect(tx)
        .to.emit(contract, 'BatchAnchored')
        .withArgs(
          BATCH_A,
          1n,
          ROOT_A,
          DATASET_A,
          3n,
          block!.timestamp,
          anchorService.address
        );
    });
  });

  // -------------------------------------------------------------------
  // Duplicate protection
  // -------------------------------------------------------------------

  describe('duplicate protection', () => {
    it('rejects anchoring the same root twice for the same batch', async () => {
      const { contract, anchorService } = await loadFixture(deployedWithRoleFixture);

      await contract.connect(anchorService).anchorBatch(BATCH_A, ROOT_A, DATASET_A, 3);
      await expect(
        contract.connect(anchorService).anchorBatch(BATCH_A, ROOT_A, DATASET_A, 3)
      ).to.be.revertedWithCustomError(contract, 'RootAlreadyAnchored');
    });

    it('reports isRootAnchored correctly', async () => {
      const { contract, anchorService } = await loadFixture(deployedWithRoleFixture);

      expect(await contract.isRootAnchored(BATCH_A, ROOT_A)).to.equal(false);
      await contract.connect(anchorService).anchorBatch(BATCH_A, ROOT_A, DATASET_A, 3);
      expect(await contract.isRootAnchored(BATCH_A, ROOT_A)).to.equal(true);
      // Same root on a different batch is allowed.
      expect(await contract.isRootAnchored(ethers.id('PF05044'), ROOT_A)).to.equal(false);
    });

    it('allows the same root for a different batch', async () => {
      const { contract, anchorService } = await loadFixture(deployedWithRoleFixture);
      const batchB = ethers.id('PF05044');

      await contract.connect(anchorService).anchorBatch(BATCH_A, ROOT_A, DATASET_A, 3);
      await contract.connect(anchorService).anchorBatch(batchB, ROOT_A, DATASET_A, 3);

      expect(await contract.getLatestVersion(batchB)).to.equal(1n);
    });
  });

  // -------------------------------------------------------------------
  // Invalid inputs
  // -------------------------------------------------------------------

  describe('invalid inputs', () => {
    let ctx: Awaited<ReturnType<typeof deployedWithRoleFixture>>;

    beforeEach(async () => {
      ctx = await loadFixture(deployedWithRoleFixture);
    });

    it('rejects zero batchKey', async () => {
      const { contract, anchorService } = ctx;
      await expect(
        contract.connect(anchorService).anchorBatch(ethers.ZeroHash, ROOT_A, DATASET_A, 3)
      ).to.be.revertedWithCustomError(contract, 'InvalidBatchKey');
    });

    it('rejects zero merkleRoot', async () => {
      const { contract, anchorService } = ctx;
      await expect(
        contract.connect(anchorService).anchorBatch(BATCH_A, ethers.ZeroHash, DATASET_A, 3)
      ).to.be.revertedWithCustomError(contract, 'InvalidMerkleRoot');
    });

    it('rejects zero datasetHash', async () => {
      const { contract, anchorService } = ctx;
      await expect(
        contract.connect(anchorService).anchorBatch(BATCH_A, ROOT_A, ethers.ZeroHash, 3)
      ).to.be.revertedWithCustomError(contract, 'InvalidDatasetHash');
    });

    it('rejects zero eventCount', async () => {
      const { contract, anchorService } = ctx;
      await expect(
        contract.connect(anchorService).anchorBatch(BATCH_A, ROOT_A, DATASET_A, 0)
      ).to.be.revertedWithCustomError(contract, 'InvalidEventCount');
    });
  });

  // -------------------------------------------------------------------
  // Pause
  // -------------------------------------------------------------------

  describe('pause', () => {
    it('admin can pause and unpause', async () => {
      const { contract, admin } = await loadFixture(deployFixture);
      await expect(contract.connect(admin).pause())
        .to.emit(contract, 'Paused').withArgs(admin.address);
      await expect(contract.connect(admin).unpause())
        .to.emit(contract, 'Unpaused').withArgs(admin.address);
    });

    it('anchorBatch fails while paused and works after unpause', async () => {
      const { contract, admin, anchorService } = await loadFixture(deployedWithRoleFixture);

      await contract.connect(admin).pause();
      await expect(
        contract.connect(anchorService).anchorBatch(BATCH_A, ROOT_A, DATASET_A, 3)
      ).to.be.revertedWithCustomError(contract, 'EnforcedPause');

      // Version 1 was never consumed by the failed tx.
      expect(await contract.getLatestVersion(BATCH_A)).to.equal(0n);

      await contract.connect(admin).unpause();
      await contract.connect(anchorService).anchorBatch(BATCH_A, ROOT_A, DATASET_A, 3);
      expect(await contract.getLatestVersion(BATCH_A)).to.equal(1n);
    });

    it('query functions remain available while paused', async () => {
      const { contract, admin, anchorService } = await loadFixture(deployedWithRoleFixture);

      await contract.connect(anchorService).anchorBatch(BATCH_A, ROOT_A, DATASET_A, 3);
      await contract.connect(admin).pause();

      const anchor = await contract.getLatestAnchor(BATCH_A);
      expect(anchor.version).to.equal(1n);
      expect(await contract.getAnchor(BATCH_A, 1n)).to.exist;
      expect(await contract.getLatestVersion(BATCH_A)).to.equal(1n);
      expect(await contract.isRootAnchored(BATCH_A, ROOT_A)).to.equal(true);
    });
  });

  // -------------------------------------------------------------------
  // Queries & errors
  // -------------------------------------------------------------------

  describe('queries', () => {
    it('reverts AnchorNotFound for unknown batch (latest)', async () => {
      const { contract } = await loadFixture(deployFixture);
      await expect(
        contract.getLatestAnchor(BATCH_A)
      ).to.be.revertedWithCustomError(contract, 'AnchorNotFound');
    });

    it('reverts AnchorNotFound for version 0 and out-of-range versions', async () => {
      const { contract, anchorService } = await loadFixture(deployedWithRoleFixture);

      await contract.connect(anchorService).anchorBatch(BATCH_A, ROOT_A, DATASET_A, 3);

      await expect(contract.getAnchor(BATCH_A, 0n))
        .to.be.revertedWithCustomError(contract, 'AnchorNotFound');
      await expect(contract.getAnchor(BATCH_A, 2n))
        .to.be.revertedWithCustomError(contract, 'AnchorNotFound');
    });
  });
});
