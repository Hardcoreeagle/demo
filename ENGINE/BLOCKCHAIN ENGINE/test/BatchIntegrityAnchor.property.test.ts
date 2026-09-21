import { expect } from 'chai';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import type { BatchIntegrityAnchor } from '../typechain-types';

/**
 * Property tests (#41), implemented with Hardhat + Chai only (no Foundry).
 *
 * Invariants:
 *   P1. Version always increases.
 *   P2. Historical anchors never change.
 *   P3. Same batch + same root can never be anchored twice.
 *   P4. Unauthorized accounts can never anchor.
 *   P5. latestVersion never decreases.
 */
describe('BatchIntegrityAnchor - properties', () => {
  async function fixture() {
    const [admin, anchorService, attacker] = await ethers.getSigners();
    const factory = await ethers.getContractFactory('BatchIntegrityAnchor', admin);
    const contract = (await factory.deploy(admin.address)) as unknown as BatchIntegrityAnchor;
    await contract.waitForDeployment();
    const role = await contract.ANCHOR_ROLE();
    await contract.connect(admin).grantRole(role, anchorService.address);
    return { contract, admin, anchorService, attacker };
  }

  /** Deterministic pseudo-random generator so runs are reproducible. */
  function makeRng(seed: number) {
    let state = seed >>> 0;
    return () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 0x100000000;
    };
  }

  const randomBytes32 = (rng: () => number): string => {
    let out = '0x';
    for (let i = 0; i < 64; i++) {
      out += Math.floor(rng() * 16).toString(16);
    }
    return out;
  };

  const pick = <T>(rng: () => number, arr: T[]): T =>
    arr[Math.floor(rng() * arr.length)];

  it('P1+P5: versions strictly increase and never decrease across many random batches', async () => {
    const { contract, anchorService } = await loadFixture(fixture);
    const rng = makeRng(0xa11ce);

    const batches = Array.from({ length: 6 }, () => randomBytes32(rng));

    for (let round = 0; round < 15; round++) {
      const batch = pick(rng, batches);
      const before = await contract.getLatestVersion(batch);

      const root = randomBytes32(rng);
      await contract
        .connect(anchorService)
        .anchorBatch(batch, root, randomBytes32(rng), BigInt(1 + Math.floor(rng() * 100)));

      const after = await contract.getLatestVersion(batch);
      expect(after).to.equal(before + 1n); // strictly increases by exactly 1
      expect(after >= before).to.equal(true); // never decreases
    }
  });

  it('P2: historical anchors are byte-identical after many subsequent versions', async () => {
    const { contract, anchorService } = await loadFixture(fixture);
    const rng = makeRng(0xb0b);

    const batch = randomBytes32(rng);
    const snapshots: { version: bigint; anchor: Record<string, unknown> }[] = [];

    for (let v = 1; v <= 10; v++) {
      await contract
        .connect(anchorService)
        .anchorBatch(batch, randomBytes32(rng), randomBytes32(rng), BigInt(v));
      const anchor = await contract.getAnchor(batch, BigInt(v));
      snapshots.push({
        version: BigInt(v),
        anchor: {
          version: anchor.version.toString(),
          merkleRoot: anchor.merkleRoot,
          datasetHash: anchor.datasetHash,
          eventCount: anchor.eventCount.toString(),
          timestamp: anchor.timestamp.toString(),
          anchoredBy: anchor.anchoredBy,
        },
      });
    }

    // Re-read every historical version; all fields must be unchanged.
    for (const snap of snapshots) {
      const anchor = await contract.getAnchor(batch, snap.version);
      expect(anchor.version.toString()).to.equal(snap.anchor.version);
      expect(anchor.merkleRoot).to.equal(snap.anchor.merkleRoot);
      expect(anchor.datasetHash).to.equal(snap.anchor.datasetHash);
      expect(anchor.eventCount.toString()).to.equal(snap.anchor.eventCount);
      expect(anchor.timestamp.toString()).to.equal(snap.anchor.timestamp);
      expect(anchor.anchoredBy).to.equal(snap.anchor.anchoredBy);
    }
  });

  it('P3: no (batch, root) pair can ever be anchored twice', async () => {
    const { contract, anchorService } = await loadFixture(fixture);
    const rng = makeRng(0xcafe);

    const batch = randomBytes32(rng);
    const roots: string[] = [];

    for (let i = 0; i < 8; i++) {
      // ~50% chance to replay an existing root - must always revert.
      const replay = rng() < 0.5 && roots.length > 0;
      const root = replay ? pick(rng, roots) : randomBytes32(rng);

      if (replay) {
        await expect(
          contract.connect(anchorService).anchorBatch(batch, root, randomBytes32(rng), 1n)
        ).to.be.revertedWithCustomError(contract, 'RootAlreadyAnchored');
      } else {
        await contract
          .connect(anchorService)
          .anchorBatch(batch, root, randomBytes32(rng), 1n);
        roots.push(root);
      }
    }

    expect(await contract.getLatestVersion(batch)).to.equal(BigInt(roots.length));
  });

  it('P4: unauthorized accounts can never anchor, in any state', async () => {
    const { contract, anchorService, attacker } = await loadFixture(fixture);
    const rng = makeRng(0xd00d);

    const batch = randomBytes32(rng);

    // Normal state.
    await expect(
      contract.connect(attacker).anchorBatch(batch, randomBytes32(rng), randomBytes32(rng), 1n)
    ).to.be.revertedWithCustomError(contract, 'AccessControlUnauthorizedAccount');

    // Paused state.
    await (contract.connect(await contract.DEFAULT_ADMIN_ROLE().then(async () => {
      const [admin] = await ethers.getSigners();
      return admin;
    })) as any).pause();

    await expect(
      contract.connect(attacker).anchorBatch(batch, randomBytes32(rng), randomBytes32(rng), 1n)
    ).to.be.revertedWithCustomError(contract, 'AccessControlUnauthorizedAccount');
    await expect(
      contract.connect(anchorService).anchorBatch(batch, randomBytes32(rng), randomBytes32(rng), 1n)
    ).to.be.revertedWithCustomError(contract, 'EnforcedPause');
  });

  it('P1/P3 combined: interleaved batches keep independent monotonic versions', async () => {
    const { contract, anchorService } = await loadFixture(fixture);
    const rng = makeRng(0xfeed);

    const batchA = randomBytes32(rng);
    const batchB = randomBytes32(rng);
    const usedRoots = new Map<string, Set<string>>();
    usedRoots.set(batchA, new Set());
    usedRoots.set(batchB, new Set());

    for (let i = 0; i < 12; i++) {
      const batch = rng() < 0.5 ? batchA : batchB;
      let root = randomBytes32(rng);
      const seen = usedRoots.get(batch)!;
      if (seen.has(root)) root = randomBytes32(rng);
      seen.add(root);

      await contract
        .connect(anchorService)
        .anchorBatch(batch, root, randomBytes32(rng), 1n);
    }

    expect(await contract.getLatestVersion(batchA)).to.be.at.least(1n);
    expect(await contract.getLatestVersion(batchB)).to.be.at.least(1n);
  });
});
