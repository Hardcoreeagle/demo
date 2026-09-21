import { ethers } from 'hardhat';
import type { HardhatRuntimeEnvironment } from 'hardhat/types';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * Role configuration (#37).
 *
 *   Admin Wallet  -> DEFAULT_ADMIN_ROLE (manages roles, pause)
 *   Anchor Wallet -> ANCHOR_ROLE (anchorBatch only, no admin power)
 *
 * Supported operations:
 *   grant   - grant ANCHOR_ROLE to ANCHOR_WALLET_ADDRESS
 *   revoke  - revoke ANCHOR_ROLE from ANCHOR_WALLET_ADDRESS
 *   check   - report admin + anchor role holdings (default, read-only)
 */
async function main(hre: HardhatRuntimeEnvironment): Promise<void> {
  const operation = (process.env.ROLE_OPERATION ?? 'check').toLowerCase();
  const anchorWallet = process.env.ANCHOR_WALLET_ADDRESS;
  const contractAddress =
    process.env.ANCHOR_CONTRACT_ADDRESS ?? loadDeploymentAddress(hre.network.name);

  if (!ethers.isAddress(contractAddress)) {
    throw new Error(
      `No contract address. Set ANCHOR_CONTRACT_ADDRESS or deploy first (deployments/${hre.network.name}.json).`
    );
  }

  const contract = await ethers.getContractAt(
    'BatchIntegrityAnchor',
    contractAddress
  );
  const [signer] = await ethers.getSigners();

  const DEFAULT_ADMIN_ROLE = await contract.DEFAULT_ADMIN_ROLE();
  const ANCHOR_ROLE = await contract.ANCHOR_ROLE();

  console.log(`Network:  ${hre.network.name}`);
  console.log(`Contract: ${contractAddress}`);
  console.log(`Signer:   ${await signer.getAddress()}`);
  console.log(`Operation: ${operation}`);
  console.log('');

  switch (operation) {
    case 'grant': {
      if (!anchorWallet) throw new Error('Set ANCHOR_WALLET_ADDRESS');
      assertNotAdmin(contract, anchorWallet);
      const callerIsAdmin = await contract.hasRole(
        DEFAULT_ADMIN_ROLE,
        await signer.getAddress()
      );
      if (!callerIsAdmin) {
        throw new Error('Signer does not hold DEFAULT_ADMIN_ROLE - cannot grant.');
      }
      const tx = await contract.grantRole(ANCHOR_ROLE, anchorWallet);
      await tx.wait();
      console.log(`ANCHOR_ROLE granted to ${anchorWallet} (tx ${tx.hash})`);
      break;
    }
    case 'revoke': {
      if (!anchorWallet) throw new Error('Set ANCHOR_WALLET_ADDRESS');
      const tx = await contract.revokeRole(ANCHOR_ROLE, anchorWallet);
      await tx.wait();
      console.log(`ANCHOR_ROLE revoked from ${anchorWallet} (tx ${tx.hash})`);
      break;
    }
    case 'check': {
      const admin = process.env.CHECK_ADMIN_ADDRESS;
      if (admin) await reportRole(contract, 'admin', DEFAULT_ADMIN_ROLE, admin);
      if (anchorWallet)
        await reportRole(contract, 'anchor', ANCHOR_ROLE, anchorWallet);
      break;
    }
    default:
      throw new Error(`Unknown ROLE_OPERATION: ${operation} (use grant|revoke|check)`);
  }
}

async function assertNotAdmin(
  contract: any,
  wallet: string
): Promise<void> {
  // Defense in depth: warn (not block) if the same key holds both roles.
  const hasAdmin = await contract.hasRole(await contract.DEFAULT_ADMIN_ROLE(), wallet);
  if (hasAdmin) {
    console.warn(
      `WARNING: ${wallet} already holds DEFAULT_ADMIN_ROLE. ` +
        'Admin and anchor roles SHOULD be separate wallets in production.'
    );
  }
}

async function reportRole(
  contract: any,
  label: string,
  role: string,
  wallet: string
): Promise<void> {
  const has = await contract.hasRole(role, wallet);
  console.log(`${label} role for ${wallet}: ${has ? 'GRANTED' : 'NOT granted'}`);
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

// Execute when run via `npx hardhat run scripts/configure-roles.ts`.
if (require.main === module) {
  main(require('hardhat') as unknown as HardhatRuntimeEnvironment).catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
