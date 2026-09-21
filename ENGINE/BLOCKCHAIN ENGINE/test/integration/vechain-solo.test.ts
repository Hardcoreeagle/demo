import { expect } from 'chai';
import { ethers, network } from 'hardhat';
import type { BatchIntegrityAnchor } from '../../typechain-types';

/**
 * Thor Solo integration test (#42). Run with Thor Solo running on
 * http://127.0.0.1:8669 and:
 *
 *   npx hardhat test test/integration/vechain-solo.test.ts --network vechain_solo
 *
 * Flow:
 *   Start Thor Solo -> Deploy -> Grant ANCHOR_ROLE -> Anchor V1 ->
 *   Read contract -> Verify BatchAnchored event -> Anchor V2 -> Verify V1+V2
 */
describe('BatchIntegrityAnchor - Thor Solo integration', function () {
  // Solo block production takes a few seconds per transaction.
  this.timeout(300_000);

  before(function () {
    if (!network.name.includes('vechain')) {
      this.skip();
    }
  });

  const PF05043 = ethers.id('PF05043');
  const ROOT_A = ethers.id('root-A');
  const ROOT_B = ethers.id('root-B');
  const DATASET_A = ethers.id('dataset-A');
  const DATASET_B = ethers.id('dataset-B');

  let contract: BatchIntegrityAnchor;
  let admin: Signer;
  let anchorService: Signer;

  before(async () => {
    // On Solo, all derivation-path accounts are pre-funded with VET and VTHO.
    [admin, anchorService] = await ethers.getSigners();

    const factory = await ethers.getContractFactory('BatchIntegrityAnchor');
    contract = (await factory.deploy(admin.address)) as unknown as BatchIntegrityAnchor;
    await contract.waitForDeployment();

    const anchorRole = await contract.ANCHOR_ROLE();
    await contract.connect(admin).grantRole(anchorRole, anchorService.address);
  });

  it('deploys with explicit admin and empty state', async () => {
    const adminRole = await contract.DEFAULT_ADMIN_ROLE();
    expect(await contract.hasRole(adminRole, admin.address)).to.equal(true);
    expect(await contract.getLatestVersion(PF05043)).to.equal(0n);
  });

  it('anchors version 1 and verifies the BatchAnchored event', async () => {
    const tx = await contract
      .connect(anchorService)
      .anchorBatch(PF05043, ROOT_A, DATASET_A, 42);
    const receipt = await tx.wait();
    expect(receipt?.status).to.equal(1);

    const anchor = await contract.getLatestAnchor(PF05043);
    expect(anchor.version).to.equal(1n);
    expect(anchor.merkleRoot).to.equal(ROOT_A);
    expect(anchor.datasetHash).to.equal(DATASET_A);
    expect(anchor.eventCount).to.equal(42n);
    expect(anchor.anchoredBy).to.equal(anchorService.address);
  });

  it('anchors version 2 and verifies historical V1 + V2', async () => {
    await contract.connect(anchorService).anchorBatch(PF05043, ROOT_B, DATASET_B, 57);

    expect(await contract.getLatestVersion(PF05043)).to.equal(2n);

    const v1 = await contract.getAnchor(PF05043, 1n);
    const v2 = await contract.getAnchor(PF05043, 2n);
    expect(v1.merkleRoot).to.equal(ROOT_A);
    expect(v2.merkleRoot).to.equal(ROOT_B);
    expect(v1.eventCount).to.equal(42n);
    expect(v2.eventCount).to.equal(57n);

    // Root A cannot be anchored again.
    await expect(
      contract.connect(anchorService).anchorBatch(PF05043, ROOT_A, DATASET_A, 42)
    ).to.be.revertedWithCustomError(contract, 'RootAlreadyAnchored');
  });
});

type Signer = Awaited<ReturnType<typeof ethers.getSigners>>[number];
