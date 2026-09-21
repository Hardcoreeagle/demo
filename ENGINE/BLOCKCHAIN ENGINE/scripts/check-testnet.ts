import { ethers, network } from 'hardhat';
import type { HardhatRuntimeEnvironment } from 'hardhat/types';
import {
  VECHAIN_TESTNET_CHAIN_ID,
  VECHAIN_TESTNET_RPC,
  assertFunded,
  assertTestnetRpc,
  assertUserTestnetCredentials,
  readVetVtho,
} from '../src/vechain/testnetReadiness';

/**
 * Testnet RPC + wallet readiness. Prints public address and balances only.
 */
async function main(_hre: HardhatRuntimeEnvironment): Promise<void> {
  if (network.name !== 'vechain_testnet') {
    throw new Error(`WRONG_NETWORK: expected vechain_testnet, got ${network.name}`);
  }

  const mode = assertUserTestnetCredentials();
  const url = (network.config as { url?: string }).url ?? '';
  assertTestnetRpc(url);

  let blockNumber: number;
  try {
    blockNumber = await ethers.provider.getBlockNumber();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`TESTNET_RPC_UNAVAILABLE: ${msg}`);
  }

  const net = await ethers.provider.getNetwork();
  if (net.chainId !== VECHAIN_TESTNET_CHAIN_ID) {
    throw new Error(
      `WRONG_NETWORK: expected chain ${VECHAIN_TESTNET_CHAIN_ID.toString()}, got ${net.chainId.toString()}`
    );
  }

  const [signer] = await ethers.getSigners();
  const address = await signer.getAddress();
  const balances = await readVetVtho(ethers.provider, address);

  console.log('Network: vechain_testnet');
  console.log(`RPC: ${url || VECHAIN_TESTNET_RPC}`);
  console.log(`Chain ID: ${net.chainId.toString()}`);
  console.log(`Block number: ${blockNumber}`);
  console.log('RPC Status: PASS');
  console.log(`Wallet: configured (${mode})`);
  console.log(`Deployment account: ${address}`);
  console.log(`VET Balance: ${balances.vetFormatted}`);
  console.log(`VTHO Balance: ${balances.vthoFormatted}`);

  try {
    assertFunded(balances.vtho, balances.vet);
    console.log('Status: READY');
  } catch (err) {
    console.log('Status: INSUFFICIENT_TESTNET_FUNDS');
    throw err;
  }
}

export default main;

if (require.main === module) {
  main(require('hardhat') as unknown as HardhatRuntimeEnvironment).catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
