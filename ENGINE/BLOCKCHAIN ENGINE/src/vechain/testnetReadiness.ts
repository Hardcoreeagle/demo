/**
 * Testnet wallet readiness — public address and balances only.
 * Never logs mnemonic, private key, or .env contents.
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { ethers } from 'ethers';

export const VECHAIN_TESTNET_RPC = 'https://testnet.vechain.org';
export const VECHAIN_TESTNET_CHAIN_ID = 100010n;
/** VIP-180 energy token (VTHO) on VeChainThor. */
export const VTHO_ADDRESS = '0x0000000000000000000000000000456e65726779';

const VTHO_ABI = ['function balanceOf(address account) view returns (uint256)'];

export class TestnetConfigError extends Error {
  constructor(
    public readonly code:
      | 'MISSING_TESTNET_CREDENTIALS'
      | 'INVALID_TESTNET_CREDENTIALS'
      | 'TESTNET_RPC_UNAVAILABLE'
      | 'WRONG_NETWORK'
      | 'INSUFFICIENT_TESTNET_FUNDS',
    message: string
  ) {
    super(`${code}: ${message}`);
    this.name = 'TestnetConfigError';
  }
}

export function hasUserTestnetCredentials(): boolean {
  const mnemonic = Boolean(process.env.VECHAIN_MNEMONIC?.trim());
  const privateKey = Boolean(process.env.VECHAIN_PRIVATE_KEY?.trim());
  return mnemonic !== privateKey;
}

export function assertUserTestnetCredentials(): 'mnemonic' | 'privateKey' {
  const mnemonic = Boolean(process.env.VECHAIN_MNEMONIC?.trim());
  const privateKey = Boolean(process.env.VECHAIN_PRIVATE_KEY?.trim());
  if (mnemonic && privateKey) {
    throw new TestnetConfigError(
      'INVALID_TESTNET_CREDENTIALS',
      'Set exactly one of VECHAIN_MNEMONIC or VECHAIN_PRIVATE_KEY, not both.'
    );
  }
  if (!mnemonic && !privateKey) {
    throw new TestnetConfigError(
      'MISSING_TESTNET_CREDENTIALS',
      [
        'Missing Testnet wallet credentials.',
        '',
        'Set exactly one of:',
        'VECHAIN_MNEMONIC',
        'VECHAIN_PRIVATE_KEY',
      ].join('\n')
    );
  }
  return privateKey ? 'privateKey' : 'mnemonic';
}

export function assertTestnetRpc(url: string): void {
  const normalized = url.replace(/\/$/, '');
  if (/127\.0\.0\.1|localhost|:8669/.test(normalized)) {
    throw new TestnetConfigError(
      'WRONG_NETWORK',
      `Testnet RPC must be ${VECHAIN_TESTNET_RPC}, not Solo/localhost. Got: ${url}`
    );
  }
  if (normalized !== VECHAIN_TESTNET_RPC && !process.env.VECHAIN_TESTNET_RPC_URL) {
    throw new TestnetConfigError(
      'WRONG_NETWORK',
      `Expected ${VECHAIN_TESTNET_RPC}. Got: ${url}`
    );
  }
}

export async function readVetVtho(
  provider: ethers.Provider,
  address: string
): Promise<{ vet: bigint; vtho: bigint; vetFormatted: string; vthoFormatted: string }> {
  const vet = await provider.getBalance(address);
  const vthoContract = new ethers.Contract(VTHO_ADDRESS, VTHO_ABI, provider);
  const vtho = (await vthoContract.balanceOf(address)) as bigint;
  return {
    vet,
    vtho,
    vetFormatted: ethers.formatEther(vet),
    vthoFormatted: ethers.formatEther(vtho),
  };
}

export function assertFunded(vtho: bigint, vet: bigint): void {
  if (vtho === 0n && vet === 0n) {
    throw new TestnetConfigError(
      'INSUFFICIENT_TESTNET_FUNDS',
      [
        'INSUFFICIENT_TESTNET_FUNDS',
        'The Testnet account has 0 VET and 0 VTHO.',
        'Fund it at https://faucet.vecha.in then re-run.',
      ].join('\n')
    );
  }
  if (vtho === 0n) {
    throw new TestnetConfigError(
      'INSUFFICIENT_TESTNET_FUNDS',
      [
        'INSUFFICIENT_TESTNET_FUNDS',
        'The Testnet account has 0 VTHO (gas). VET alone cannot pay Thor gas.',
        'Fund VTHO at https://faucet.vecha.in then re-run.',
      ].join('\n')
    );
  }
}

/** Write a single address into .env without dumping the file. */
export function upsertEnvContractAddress(address: string): void {
  if (!ethers.isAddress(address)) {
    throw new Error(`Cannot write invalid contract address`);
  }
  const envPath = '.env';
  let text = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';
  text = upsertLine(text, 'BATCH_INTEGRITY_ANCHOR_ADDRESS', address);
  text = upsertLine(text, 'ANCHOR_CONTRACT_ADDRESS', address);
  writeFileSync(envPath, text, 'utf8');
}

function upsertLine(text: string, key: string, value: string): string {
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, 'm');
  if (re.test(text)) {
    return text.replace(re, line);
  }
  const prefix = text.length === 0 || text.endsWith('\n') ? '' : '\n';
  return `${text}${prefix}${line}\n`;
}
