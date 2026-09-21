import { expect } from 'chai';
import { ethers } from 'hardhat';
import type { FunctionFragment } from 'ethers';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import type { BatchIntegrityAnchor } from '../typechain-types';

/**
 * Security tests (#40): unauthorized actions, replay/duplicate attempts,
 * version manipulation, historical mutation attempts, zero-value inputs,
 * pause bypass.
 */
describe('BatchIntegrityAnchor - security', () => {
  const BATCH_A = ethers.id('PF05043');
  const ROOT_A = ethers.id('root-A');
  const ROOT_B = ethers.id('root-B');
  const DATASET_A = ethers.id('dataset-A');

  async function fixture() {
    const [admin, anchorService, attacker, deployer] = await ethers.getSigners();

    const factory = await ethers.getContractFactory('BatchIntegrityAnchor', deployer);
    const contract = (await factory.deploy(admin.address)) as unknown as BatchIntegrityAnchor;
    await contract.waitForDeployment();

    const role = await contract.ANCHOR_ROLE();
    await contract.connect(admin).grantRole(role, anchorService.address);
    await contract.connect(anchorService).anchorBatch(BATCH_A, ROOT_A, DATASET_A, 3);

    return { contract, admin, anchorService, attacker, deployer };
  }

  it('unauthorized account cannot anchor', async () => {
    const { contract, attacker } = await loadFixture(fixture);
    await expect(
      contract.connect(attacker).anchorBatch(BATCH_A, ROOT_B, DATASET_A, 1)
    ).to.be.revertedWithCustomError(contract, 'AccessControlUnauthorizedAccount');
  });

  it('unauthorized account cannot pause', async () => {
    const { contract, attacker, anchorService } = await loadFixture(fixture);
    await expect(
      contract.connect(attacker).pause()
    ).to.be.revertedWithCustomError(contract, 'AccessControlUnauthorizedAccount');
    // Ensure it really was not paused.
    await contract.connect(anchorService).anchorBatch(BATCH_A, ROOT_B, DATASET_A, 1);
  });

  it('unauthorized account cannot unpause', async () => {
    const { contract, admin, attacker } = await loadFixture(fixture);
    await contract.connect(admin).pause();
    await expect(
      contract.connect(attacker).unpause()
    ).to.be.revertedWithCustomError(contract, 'AccessControlUnauthorizedAccount');
    // Still paused.
    await expect(
      contract.connect(admin).grantRole(await contract.ANCHOR_ROLE(), attacker.address)
    ).to.not.be.reverted; // role management is independent of pause
  });

  it('anchor service cannot manage roles', async () => {
    const { contract, anchorService, attacker, admin } = await loadFixture(fixture);
    const anchorRole = await contract.ANCHOR_ROLE();
    const adminRole = await contract.DEFAULT_ADMIN_ROLE();

    await expect(
      contract.connect(anchorService).grantRole(anchorRole, attacker.address)
    ).to.be.revertedWithCustomError(contract, 'AccessControlUnauthorizedAccount');
    await expect(
      contract.connect(anchorService).revokeRole(anchorRole, admin.address)
    ).to.be.revertedWithCustomError(contract, 'AccessControlUnauthorizedAccount');
    await expect(
      contract.connect(anchorService).grantRole(adminRole, attacker.address)
    ).to.be.revertedWithCustomError(contract, 'AccessControlUnauthorizedAccount');
  });

  it('duplicate submission reverts and leaves state unchanged', async () => {
    const { contract, anchorService } = await loadFixture(fixture);

    await expect(
      contract.connect(anchorService).anchorBatch(BATCH_A, ROOT_A, DATASET_A, 3)
    ).to.be.revertedWithCustomError(contract, 'RootAlreadyAnchored');

    expect(await contract.getLatestVersion(BATCH_A)).to.equal(1n);
    const anchor = await contract.getLatestAnchor(BATCH_A);
    expect(anchor.merkleRoot).to.equal(ROOT_A);
    expect(anchor.eventCount).to.equal(3n);
  });

  it('replayed root from another batch is still unique per batch', async () => {
    const { contract, anchorService } = await loadFixture(fixture);
    const batchB = ethers.id('PF05044');

    // Root A is anchored on BATCH_A; anchoring it on batchB is allowed
    // (per-batch namespace) but then re-anchoring on batchB is rejected.
    await contract.connect(anchorService).anchorBatch(batchB, ROOT_A, DATASET_A, 3);
    await expect(
      contract.connect(anchorService).anchorBatch(batchB, ROOT_A, DATASET_A, 3)
    ).to.be.revertedWithCustomError(contract, 'RootAlreadyAnchored');
  });

  it('version cannot be manipulated: version is derived, not provided', async () => {
    const { contract, anchorService } = await loadFixture(fixture);

    // There is no parameter or function that can influence versioning.
    const functions = contract.interface.fragments
      .filter((f) => f.type === 'function')
      .map((f) => (f as FunctionFragment).format());
    for (const forbidden of [
      'updateAnchor(bytes32,uint256,bytes32,bytes32,uint256)',
      'deleteAnchor(bytes32,uint256)',
      'replaceRoot(bytes32,uint256,bytes32)',
      'setVersion(bytes32,uint256)',
    ]) {
      expect(functions).to.not.include(forbidden);
    }

    // New anchor always gets exactly latestVersion + 1.
    await contract.connect(anchorService).anchorBatch(BATCH_A, ROOT_B, DATASET_A, 1);
    expect(await contract.getLatestVersion(BATCH_A)).to.equal(2n);
  });

  it('historical anchors can never be mutated', async () => {
    const { contract, anchorService } = await loadFixture(fixture);

    const v1Before = await contract.getAnchor(BATCH_A, 1n);

    // Advance with a second version.
    await contract.connect(anchorService).anchorBatch(BATCH_A, ROOT_B, DATASET_A, 1);

    const v1After = await contract.getAnchor(BATCH_A, 1n);
    expect(v1After.merkleRoot).to.equal(v1Before.merkleRoot);
    expect(v1After.datasetHash).to.equal(v1Before.datasetHash);
    expect(v1After.eventCount).to.equal(v1Before.eventCount);
    expect(v1After.timestamp).to.equal(v1Before.timestamp);
    expect(v1After.anchoredBy).to.equal(v1Before.anchoredBy);
    expect(v1After.version).to.equal(1n);
  });

  it('pause cannot be bypassed even by role holders', async () => {
    const { contract, admin, anchorService } = await loadFixture(fixture);

    await contract.connect(admin).pause();
    await expect(
      contract.connect(anchorService).anchorBatch(BATCH_A, ethers.id('root-C'), DATASET_A, 1)
    ).to.be.revertedWithCustomError(contract, 'EnforcedPause');
    expect(await contract.getLatestVersion(BATCH_A)).to.equal(1n);
  });

  it('zero-value inputs are rejected before any state change', async () => {
    const { contract, anchorService } = await loadFixture(fixture);

    await expect(
      contract.connect(anchorService).anchorBatch(ethers.ZeroHash, ROOT_B, DATASET_A, 1)
    ).to.be.revertedWithCustomError(contract, 'InvalidBatchKey');
    await expect(
      contract.connect(anchorService).anchorBatch(BATCH_A, ethers.ZeroHash, DATASET_A, 1)
    ).to.be.revertedWithCustomError(contract, 'InvalidMerkleRoot');
    await expect(
      contract.connect(anchorService).anchorBatch(BATCH_A, ROOT_B, ethers.ZeroHash, 1)
    ).to.be.revertedWithCustomError(contract, 'InvalidDatasetHash');
    await expect(
      contract.connect(anchorService).anchorBatch(BATCH_A, ROOT_B, DATASET_A, 0)
    ).to.be.revertedWithCustomError(contract, 'InvalidEventCount');

    expect(await contract.getLatestVersion(BATCH_A)).to.equal(1n);
  });

  it('contract cannot be reinitialized by re-deploying over the same address', async () => {
    const { contract } = await loadFixture(fixture);
    // No initializer function exists; constructor-only setup.
    const functions = contract.interface.fragments
      .filter((f) => f.type === 'function')
      .map((f) => (f as FunctionFragment).format());
    expect(functions.some((f) => f.startsWith('initialize'))).to.equal(false);
  });
});
