import { ethers } from 'hardhat';
import type { HardhatRuntimeEnvironment } from 'hardhat/types';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import {
  VECHAIN_TESTNET_CHAIN_ID,
  assertFunded,
  assertTestnetRpc,
  assertUserTestnetCredentials,
  readVetVtho,
  upsertEnvContractAddress,
} from '../src/vechain/testnetReadiness';

const DEPLOYMENTS_DIR = 'deployments';

function asHexAddress(value: string, label: string): string {
  const trimmed = value.trim();
  if (!ethers.isAddress(trimmed)) {
    throw new Error(
      `${label} must be a 0x hexadecimal address (ENS/name resolution is not supported on VeChain).`
    );
  }
  return ethers.getAddress(trimmed);
}

function isInsufficientFunds(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /insufficient|energy|vtho|not enough|INSUFFICIENT_TESTNET_FUNDS/i.test(msg);
}

async function main(hre: HardhatRuntimeEnvironment): Promise<void> {
  const networkName = hre.network.name;

  if (networkName === 'vechain_mainnet') {
    if (
      !process.env.DEPLOYMENT_ADMIN_ADDRESS ||
      process.env.VECHAIN_MAINNET_CONFIRM !== 'YES'
    ) {
      throw new Error(
        'Mainnet deployment requires DEPLOYMENT_ADMIN_ADDRESS and ' +
          'VECHAIN_MAINNET_CONFIRM=YES. Refusing to continue.'
      );
    }
  }

  if (networkName === 'vechain_testnet') {
    assertUserTestnetCredentials();
    const url = (hre.network.config as { url?: string }).url ?? '';
    assertTestnetRpc(url);
  } else if (networkName === 'vechain_mainnet') {
    if (!process.env.VECHAIN_MNEMONIC?.trim() && !process.env.VECHAIN_PRIVATE_KEY?.trim()) {
      throw new Error(
        'Missing credentials for vechain_mainnet. Set VECHAIN_MNEMONIC or VECHAIN_PRIVATE_KEY in .env'
      );
    }
  }

  const [deployer] = await hre.ethers.getSigners();
  const deployerAddress = asHexAddress(await deployer.getAddress(), 'Deployer');
  const adminFromEnv = process.env.DEPLOYMENT_ADMIN_ADDRESS?.trim();
  const adminAddress = asHexAddress(
    adminFromEnv || deployerAddress,
    'Admin'
  );
  const anchorWallet = asHexAddress(
    process.env.ANCHOR_WALLET_ADDRESS?.trim() || deployerAddress,
    'Anchor wallet'
  );

  const net = await hre.ethers.provider.getNetwork();
  if (networkName === 'vechain_testnet' && net.chainId !== VECHAIN_TESTNET_CHAIN_ID) {
    throw new Error(
      `WRONG_NETWORK: expected chain ${VECHAIN_TESTNET_CHAIN_ID.toString()}, got ${net.chainId.toString()}`
    );
  }

  const networkLabel =
    networkName === 'vechain_testnet'
      ? 'VeChain Testnet'
      : networkName === 'vechain_mainnet'
        ? 'VeChain Mainnet'
        : networkName;

  console.log(`Network: ${networkLabel}`);
  console.log(`Chain ID: ${net.chainId.toString()}`);
  console.log('Contract: BatchIntegrityAnchor');
  console.log(`Deployer: ${deployerAddress}`);
  console.log(`Admin: ${adminAddress}`);
  console.log(`Anchor Wallet: ${anchorWallet}`);

  if (networkName === 'vechain_testnet') {
    const balances = await readVetVtho(hre.ethers.provider, deployerAddress);
    console.log('');
    console.log('VET Balance:');
    console.log(balances.vetFormatted);
    console.log('VTHO Balance:');
    console.log(balances.vthoFormatted);
    assertFunded(balances.vtho, balances.vet);
  }

  console.log('');
  console.log('Deploying BatchIntegrityAnchor...');

  const factory = await hre.ethers.getContractFactory('BatchIntegrityAnchor');
  let contract;
  try {
    // Pass a checksummed 0x address only. An empty DEPLOYMENT_ADMIN_ADDRESS
    // from .env is "" which ethers treats as an ENS name and calls
    // resolveName() — not implemented on the VeChain provider.
    contract = await factory.deploy(adminAddress);
    await contract.waitForDeployment();
  } catch (err) {
    if (networkName === 'vechain_testnet' && isInsufficientFunds(err)) {
      throw new Error(
        'INSUFFICIENT_TESTNET_FUNDS: deployer has insufficient VET/VTHO on VeChain Testnet.'
      );
    }
    throw new Error(
      `CONTRACT_DEPLOYMENT_FAILED: ${err instanceof Error ? err.message : String(err)}`
    );
  }
  const address = await contract.getAddress();
  const tx = contract.deploymentTransaction();
  const receipt = tx ? await tx.wait() : null;
  if (receipt && receipt.status !== 1) {
    throw new Error('CONTRACT_DEPLOYMENT_FAILED: deployment transaction reverted');
  }

  const deployment = {
    contractAddress: address,
    network: networkName,
    chainId: net.chainId.toString(),
    transactionId: tx?.hash ?? 'unknown',
    admin: adminAddress,
    anchoredByRoleGranted: false,
    deployedAt: new Date().toISOString(),
  };

  const onChain = await contract.hasRole(
    await contract.DEFAULT_ADMIN_ROLE(),
    adminAddress
  );
  if (!onChain) {
    throw new Error('CONTRACT_VERIFICATION_FAILED: admin role missing');
  }
  const latestVersion = await contract.getLatestVersion(ethers.ZeroHash);
  if (latestVersion !== 0n) {
    throw new Error('CONTRACT_VERIFICATION_FAILED: non-empty fresh contract');
  }

  const code = await hre.ethers.provider.getCode(address);
  if (!code || code === '0x') {
    throw new Error(`CONTRACT_VERIFICATION_FAILED: no contract code at ${address}`);
  }

  if (networkName === 'vechain_testnet') {
    const anchorRole = await contract.ANCHOR_ROLE();
    if (!(await contract.hasRole(anchorRole, anchorWallet))) {
      const grantTx = await contract.grantRole(anchorRole, anchorWallet);
      await grantTx.wait();
    }
    deployment.anchoredByRoleGranted = true;
  }

  mkdirSync(DEPLOYMENTS_DIR, { recursive: true });
  const file = join(DEPLOYMENTS_DIR, `${networkName}.json`);
  writeFileSync(file, JSON.stringify(deployment, null, 2));

  if (networkName === 'vechain_testnet') {
    upsertEnvContractAddress(address);
  }

  console.log('');
  console.log('Contract Address:');
  console.log(address);
  console.log('');
  console.log('Transaction Hash:');
  console.log(deployment.transactionId);
  console.log('');
  console.log('Deployment Status:');
  console.log('CONFIRMED');
  console.log(`Deployment record: ${file}`);

  // -------------------------------------------------------------------------
  // EventIntegrityAnchor (per-event anchoring), deployed ALONGSIDE the batch
  // anchor. Same admin, same anchor wallet, same role model.
  // -------------------------------------------------------------------------
  console.log('');
  console.log('Deploying EventIntegrityAnchor...');

  const eventFactory = await hre.ethers.getContractFactory('EventIntegrityAnchor');
  let eventContract;
  try {
    eventContract = await eventFactory.deploy(adminAddress);
    await eventContract.waitForDeployment();
  } catch (err) {
    if (networkName === 'vechain_testnet' && isInsufficientFunds(err)) {
      throw new Error(
        'INSUFFICIENT_TESTNET_FUNDS: deployer has insufficient VET/VTHO for EventIntegrityAnchor.'
      );
    }
    throw new Error(
      `CONTRACT_DEPLOYMENT_FAILED (EventIntegrityAnchor): ${err instanceof Error ? err.message : String(err)}`
    );
  }
  const eventAddress = await eventContract.getAddress();
  const eventTx = eventContract.deploymentTransaction();
  const eventReceipt = eventTx ? await eventTx.wait() : null;
  if (eventReceipt && eventReceipt.status !== 1) {
    throw new Error('CONTRACT_DEPLOYMENT_FAILED: EventIntegrityAnchor tx reverted');
  }

  const eventCode = await hre.ethers.provider.getCode(eventAddress);
  if (!eventCode || eventCode === '0x') {
    throw new Error(
      `CONTRACT_VERIFICATION_FAILED: no contract code at ${eventAddress}`
    );
  }

  let eventAnchorRoleGranted = false;
  if (networkName === 'vechain_testnet') {
    const anchorRole = await eventContract.ANCHOR_ROLE();
    if (!(await eventContract.hasRole(anchorRole, anchorWallet))) {
      const grantTx = await eventContract.grantRole(anchorRole, anchorWallet);
      await grantTx.wait();
    }
    eventAnchorRoleGranted = true;
  }

  const eventDeployment = {
    contractAddress: eventAddress,
    network: networkName,
    chainId: net.chainId.toString(),
    transactionId: eventTx?.hash ?? 'unknown',
    admin: adminAddress,
    anchoredByRoleGranted: eventAnchorRoleGranted,
    deployedAt: new Date().toISOString(),
  };
  const eventFile = join(DEPLOYMENTS_DIR, `${networkName}-events.json`);
  writeFileSync(eventFile, JSON.stringify(eventDeployment, null, 2));

  console.log('');
  console.log('EventIntegrityAnchor Address:');
  console.log(eventAddress);
  console.log('');
  console.log('EventIntegrityAnchor Transaction Hash:');
  console.log(eventDeployment.transactionId);
  console.log(`EventIntegrityAnchor deployment record: ${eventFile}`);
}

export default main;

if (require.main === module) {
  main(require('hardhat') as unknown as HardhatRuntimeEnvironment).catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
