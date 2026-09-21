import { expect } from 'chai';
import { ethers, network } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { BatchIntegrityAnchor } from '../../typechain-types';
import {
  deriveBatchCommitment,
  buildMerkleProof,
  verifyMerkleProof,
} from '../../src/integrity/IntegrityEngine';
import {
  loadPf05043Epcis,
  mergeEpcisDocuments,
  sha256BatchKey,
} from '../../src/integrity/gs1Epcis';
import { VeChainThorAnchorClient } from '../../src/vechain/BatchIntegrityAnchorClient';
import { verifyIntegrity } from '../../src/verify/verifyIntegrity';
import {
  VECHAIN_TESTNET_CHAIN_ID,
  assertFunded,
  assertTestnetRpc,
  assertUserTestnetCredentials,
  readVetVtho,
  upsertEnvContractAddress,
} from '../../src/vechain/testnetReadiness';

/**
 * E2E suite: real GS1 EPCIS JSON → Integrity Engine (SHA-256 + Merkle)
 * → VeChain adapter → BatchIntegrityAnchor → receipt → read → verify.
 *
 *   npm run test:e2e           in-memory Hardhat
 *   npm run test:e2e:solo      Thor Solo (optional)
 *   npm run test:e2e:testnet   public VeChain Testnet (requires .env + VTHO)
 */
describe('E2E: GS1 EPCIS → Integrity → adapter → BatchIntegrityAnchor → verify', function () {
  const onVeChain = network.name.includes('vechain');
  const onTestnet = network.name === 'vechain_testnet';
  this.timeout(onVeChain ? 300_000 : 120_000);

  const runId = `${Date.now()}`;
  const batchKeyFor = (label: string) =>
    onTestnet ? sha256BatchKey(`PF05043:${label}:${runId}`) : sha256BatchKey('PF05043');

  type Stack = Awaited<ReturnType<typeof deployStack>>;
  let testnetStack: Stack | undefined;

  before(async function () {
    if (!onVeChain) return;
    const base = rpcUrl().replace(/\/$/, '');

    if (onTestnet) {
      if (/127\.0\.0\.1|localhost|:8669/.test(base)) {
        throw new Error(`WRONG_NETWORK: Testnet E2E refused Solo/localhost RPC: ${base}`);
      }
      assertUserTestnetCredentials();
      assertTestnetRpc(base);
      try {
        const blockNumber = await ethers.provider.getBlockNumber();
        if (Number(blockNumber) < 1) {
          throw new Error(`Unexpected Testnet block number: ${blockNumber}`);
        }
        const net = await ethers.provider.getNetwork();
        if (net.chainId !== VECHAIN_TESTNET_CHAIN_ID) {
          throw new Error(
            `WRONG_NETWORK: expected chain ${VECHAIN_TESTNET_CHAIN_ID.toString()}, got ${net.chainId.toString()}`
          );
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.startsWith('WRONG_NETWORK') || msg.startsWith('MISSING_') || msg.startsWith('INVALID_')) {
          throw err;
        }
        throw new Error(`TESTNET_RPC_UNAVAILABLE: connectivity failed at ${base}: ${msg}`);
      }
      const [deployer] = await ethers.getSigners();
      const balances = await readVetVtho(ethers.provider, deployer.address);
      assertFunded(balances.vtho, balances.vet);
      testnetStack = await attachOrDeployTestnet();
      return;
    }

    try {
      const res = await fetch(`${base}/blocks/best`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch {
      throw new Error(
        `Thor Solo is not running at ${base} (GET /blocks/best failed).\n` +
          `For public Testnet use: npm run test:e2e:testnet\n` +
          `For in-memory E2E use: npm run test:e2e`
      );
    }
  });

  async function testnetSigners() {
    const signers = await ethers.getSigners();
    const admin = signers[0];
    if (!admin) {
      throw new Error('INVALID_TESTNET_CREDENTIALS: no signer derived from .env');
    }
    // One VeWorld Testnet account: admin and ANCHOR_ROLE are the same wallet.
    return { admin, anchorService: admin };
  }

  async function deployStack() {
    const { admin, anchorService } = onTestnet
      ? await testnetSigners()
      : await (async () => {
          const [a, s] = await ethers.getSigners();
          return { admin: a, anchorService: s };
        })();
    const factory = await ethers.getContractFactory('BatchIntegrityAnchor', admin);
    let contract: BatchIntegrityAnchor;
    try {
      contract = (await factory.deploy(ethers.getAddress(admin.address))) as unknown as BatchIntegrityAnchor;
      await contract.waitForDeployment();
    } catch (err) {
      throwIfInsufficientFunds(err, 'deploy BatchIntegrityAnchor');
      throw err;
    }
    try {
      const tx = await contract
        .connect(admin)
        .grantRole(await contract.ANCHOR_ROLE(), anchorService.address);
      await tx.wait();
    } catch (err) {
      throwIfInsufficientFunds(err, 'grant ANCHOR_ROLE');
      throw err;
    }
    if (onTestnet) {
      persistDeployment(await contract.getAddress(), admin.address);
      upsertEnvContractAddress(await contract.getAddress());
    }
    return { contract, admin, anchorService };
  }

  async function attachOrDeployTestnet(): Promise<Stack> {
    const saved = loadConfiguredAddress();
    if (!saved) {
      return deployStack();
    }
    const code = await ethers.provider.getCode(saved);
    if (!code || code === '0x') {
      throw new Error(
        `No contract code at ${saved}. Unset BATCH_INTEGRITY_ANCHOR_ADDRESS / ANCHOR_CONTRACT_ADDRESS and deploy.`
      );
    }
    const { admin, anchorService } = await testnetSigners();
    const contract = (await ethers.getContractAt(
      'BatchIntegrityAnchor',
      saved
    )) as unknown as BatchIntegrityAnchor;
    const role = await contract.ANCHOR_ROLE();
    if (!(await contract.hasRole(role, anchorService.address))) {
      try {
        const tx = await contract.connect(admin).grantRole(role, anchorService.address);
        await tx.wait();
      } catch (err) {
        throwIfInsufficientFunds(err, 'grant ANCHOR_ROLE');
        throw err;
      }
    }
    return { contract, admin, anchorService };
  }

  async function stack() {
    if (onTestnet) {
      if (!testnetStack) throw new Error('Testnet stack was not initialized');
      return testnetStack;
    }
    if (onVeChain) {
      return deployStack();
    }
    return loadFixture(deployStack);
  }

  it('anchors a real GS1 production document and verifies the SHA-256 Merkle root on-chain', async () => {
    const { contract, anchorService } = await stack();
    const { production, outputDir } = loadPf05043Epcis();
    expect(production.type).to.equal('EPCISDocument');
    expect(production.epcisBody.eventList.length).to.be.greaterThan(0);

    const batchKey = batchKeyFor('t1');
    const commitment = deriveBatchCommitment(production, batchKey);
    expect(commitment.eventCount).to.equal(BigInt(production.epcisBody.eventList.length));
    expect(commitment.merkleRoot).to.match(/^0x[0-9a-f]{64}$/i);
    expect(commitment.merkleRoot.toLowerCase()).to.not.equal(ethers.id('PF05043').toLowerCase());

    const client = new VeChainThorAnchorClient({
      rpcUrl: rpcUrl(),
      contractAddress: await contract.getAddress(),
      signer: anchorService as unknown as never,
      waitForFinality: onVeChain,
    });

    const receipt = await client.anchorBatch(
      commitment.batchKey,
      commitment.merkleRoot,
      commitment.datasetHash,
      commitment.eventCount
    );
    throwIfAnchorFailed(receipt.error);

    expect(receipt.status).to.be.oneOf(['CONFIRMED', 'FINALIZED']);
    expect(receipt.version).to.equal(1n);
    expect(receipt.transactionId).to.match(/^0x[0-9a-fA-F]+$/);
    expect(receipt.event?.merkleRoot.toLowerCase()).to.equal(commitment.merkleRoot.toLowerCase());

    const latest = await client.getLatestAnchor(batchKey);
    const check = verifyIntegrity({
      batchKey,
      calculatedMerkleRoot: commitment.merkleRoot,
      calculatedDatasetHash: commitment.datasetHash,
      calculatedEventCount: commitment.eventCount,
      anchored: latest,
    });
    expect(check.integrityValid, `roots mismatch using ${outputDir}`).to.equal(true);
    expect(check.version).to.equal(1n);

    const proof = buildMerkleProof(commitment.eventHashes, commitment.eventHashes[0]);
    expect(verifyMerkleProof(commitment.eventHashes[0], proof, check.anchoredMerkleRoot)).to.equal(
      true
    );
    expect(verifyMerkleProof('0x' + '11'.repeat(32), proof, check.anchoredMerkleRoot)).to.equal(
      false
    );
  });

  it('anchors V2 from combined production+quality EPCIS; V1 stays immutable; tamper fails verify', async () => {
    const { contract, anchorService } = await stack();
    const { production, quality } = loadPf05043Epcis();
    const batchKey = batchKeyFor('t2');

    const client = new VeChainThorAnchorClient({
      rpcUrl: rpcUrl(),
      contractAddress: await contract.getAddress(),
      signer: anchorService as unknown as never,
      waitForFinality: onVeChain,
    });

    const v1 = deriveBatchCommitment(production, batchKey);
    const r1 = await client.anchorBatch(v1.batchKey, v1.merkleRoot, v1.datasetHash, v1.eventCount);
    throwIfAnchorFailed(r1.error);
    expect(r1.version).to.equal(1n);

    const laterDocs = quality ? [production, quality] : [production];
    const v2Doc = quality
      ? mergeEpcisDocuments(laterDocs)
      : (() => {
          const clone = structuredClone(production);
          clone.epcisBody.eventList.push({
            type: 'ObjectEvent',
            eventID: 'urn:uuid:gs1-engine:object:e2e-correction',
            eventTime: '2010-03-01T00:00:00Z',
          });
          return clone;
        })();

    const v2 = deriveBatchCommitment(v2Doc, batchKey);
    expect(v2.merkleRoot.toLowerCase()).to.not.equal(v1.merkleRoot.toLowerCase());

    const r2 = await client.anchorBatch(v2.batchKey, v2.merkleRoot, v2.datasetHash, v2.eventCount);
    throwIfAnchorFailed(r2.error);
    expect(r2.status).to.be.oneOf(['CONFIRMED', 'FINALIZED']);
    expect(r2.version).to.equal(2n);

    const onChainV1 = await client.getAnchor(batchKey, 1n);
    const onChainV2 = await client.getAnchor(batchKey, 2n);
    expect(
      verifyIntegrity({
        batchKey,
        calculatedMerkleRoot: v1.merkleRoot,
        calculatedDatasetHash: v1.datasetHash,
        calculatedEventCount: v1.eventCount,
        anchored: onChainV1,
      }).integrityValid
    ).to.equal(true);
    expect(
      verifyIntegrity({
        batchKey,
        calculatedMerkleRoot: v2.merkleRoot,
        calculatedDatasetHash: v2.datasetHash,
        calculatedEventCount: v2.eventCount,
        anchored: onChainV2,
      }).integrityValid
    ).to.equal(true);

    expect(await client.getLatestVersion(batchKey)).to.equal(2n);

    const dup = await client.anchorBatch(v1.batchKey, v1.merkleRoot, v1.datasetHash, v1.eventCount);
    expect(dup.status).to.equal('SUPERSEDED');

    const tampered = structuredClone(production);
    const first = tampered.epcisBody.eventList[0] as Record<string, unknown>;
    first.eventTime = '2099-01-01T00:00:00Z';
    const tamperedCommitment = deriveBatchCommitment(tampered, batchKey);
    expect(
      verifyIntegrity({
        batchKey,
        calculatedMerkleRoot: tamperedCommitment.merkleRoot,
        calculatedDatasetHash: tamperedCommitment.datasetHash,
        calculatedEventCount: tamperedCommitment.eventCount,
        anchored: onChainV1,
      }).integrityValid
    ).to.equal(false);
  });
});

function rpcUrl(): string {
  return (network.config as { url?: string }).url ?? 'http://in-memory-hardhat';
}

function isInsufficientFunds(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /insufficient|energy|vtho|not enough/i.test(msg);
}

function throwIfInsufficientFunds(err: unknown, action: string): void {
  if (network.name === 'vechain_testnet' && isInsufficientFunds(err)) {
    throw new Error(`INSUFFICIENT_TESTNET_FUNDS: cannot ${action} on VeChain Testnet.`);
  }
}

function throwIfAnchorFailed(error?: string): void {
  if (!error) return;
  if (network.name === 'vechain_testnet' && isInsufficientFunds(error)) {
    throw new Error('INSUFFICIENT_TESTNET_FUNDS: cannot submit Testnet anchor transaction.');
  }
}

function loadConfiguredAddress(): string | undefined {
  const fromEnv =
    process.env.BATCH_INTEGRITY_ANCHOR_ADDRESS?.trim() ||
    process.env.ANCHOR_CONTRACT_ADDRESS?.trim();
  if (fromEnv && ethers.isAddress(fromEnv)) return fromEnv;
  const file = join('deployments', `${network.name}.json`);
  if (!existsSync(file)) return undefined;
  const json = JSON.parse(readFileSync(file, 'utf8')) as { contractAddress?: string };
  return json.contractAddress && ethers.isAddress(json.contractAddress)
    ? json.contractAddress
    : undefined;
}

function persistDeployment(contractAddress: string, admin: string): void {
  mkdirSync('deployments', { recursive: true });
  const file = join('deployments', `${network.name}.json`);
  writeFileSync(
    file,
    JSON.stringify(
      {
        contractAddress,
        network: network.name,
        admin,
        deployedAt: new Date().toISOString(),
        source: 'e2e-testnet',
      },
      null,
      2
    )
  );
}
