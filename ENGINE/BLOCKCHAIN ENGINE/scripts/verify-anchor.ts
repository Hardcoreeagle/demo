import { ethers } from 'hardhat';
import type { HardhatRuntimeEnvironment } from 'hardhat/types';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * Verification helper (#45): given an anchored batch and a recalculated
 * Merkle root from the off-chain Integrity Engine, compare against the
 * on-chain commitment.
 *
 * Inputs (env):
 *   BATCH_KEY          - 0x-prefixed 32-byte batch identity
 *   CALCULATED_ROOT    - 0x-prefixed 32-byte Merkle root recomputed off-chain
 *   (optional) VERSION - compare against a specific version instead of latest
 */
async function main(hre: HardhatRuntimeEnvironment): Promise<void> {
  const batchKey = requireEnv('BATCH_KEY');
  const calculatedRoot = requireEnv('CALCULATED_ROOT');
  const version = process.env.VERSION ? BigInt(process.env.VERSION) : undefined;

  const contractAddress =
    process.env.ANCHOR_CONTRACT_ADDRESS ??
    loadDeploymentAddress(hre.network.name);

  const contract = await ethers.getContractAt(
    'BatchIntegrityAnchor',
    contractAddress!
  );

  const anchored = version
    ? await contract.getAnchor(batchKey, version)
    : await contract.getLatestAnchor(batchKey);

  const integrityValid =
    anchored.merkleRoot.toLowerCase() === calculatedRoot.toLowerCase();

  const result = {
    batchKey,
    version: version ? version.toString() : anchored.version.toString(),
    calculatedMerkleRoot: calculatedRoot,
    anchoredMerkleRoot: anchored.merkleRoot,
    anchoredDatasetHash: anchored.datasetHash,
    anchoredEventCount: anchored.eventCount.toString(),
    anchoredAt: new Date(Number(anchored.timestamp) * 1000).toISOString(),
    anchoredBy: anchored.anchoredBy,
    integrityValid,
    network: hre.network.name,
    contractAddress,
  };

  console.log(JSON.stringify(result, null, 2));

  if (!integrityValid) {
    console.error(
      '\nINTEGRITY CHECK FAILED: calculated root does not match the anchored commitment.'
    );
    process.exitCode = 1;
  } else {
    console.log('\nIntegrity check PASSED: roots match.');
  }
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  if (!/^0x[0-9a-fA-F]{64}$/.test(v)) {
    throw new Error(`${name} must be a 0x-prefixed 32-byte hex string`);
  }
  return v;
}

function loadDeploymentAddress(network: string): string | undefined {
  const file = join('deployments', `${network}.json`);
  if (!existsSync(file)) return undefined;
  const json = JSON.parse(readFileSync(file, 'utf8')) as {
    contractAddress?: string;
  };
  return json.contractAddress;
}

export default main;

// Execute when run via `npx hardhat run scripts/verify-anchor.ts`.
if (require.main === module) {
  main(require('hardhat') as unknown as HardhatRuntimeEnvironment).catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
