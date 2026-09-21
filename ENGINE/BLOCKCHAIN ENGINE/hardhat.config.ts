import { HardhatUserConfig } from 'hardhat/config';
import {
  type HttpNetworkConfig,
  type HttpNetworkHDAccountsConfig,
} from 'hardhat/types';
import '@nomicfoundation/hardhat-toolbox';
import '@vechain/sdk-hardhat-plugin';
import { HDKey } from '@vechain/sdk-core';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * VeChainThor derivation path for VET accounts (SLIP-44 coin type 818).
 * Same value as HDKey.VET_DERIVATION_PATH.
 */
const VET_DERIVATION_PATH = HDKey.VET_DERIVATION_PATH;

/** Local Solo only. Never used as a Testnet/Mainnet signing source. */
const SOLO_DEV_MNEMONIC =
  'denial kitchen pet squirrel other broom bar gas better priority spoil cross';

/**
 * Signing strategy: EXACTLY ONE of mnemonic or private key is used.
 * - If VECHAIN_PRIVATE_KEY is set, it wins and no mnemonic may be configured.
 * - Otherwise VECHAIN_MNEMONIC is used.
 */
const getSignerAccounts = (
  kind: 'solo' | 'public'
): HttpNetworkConfig['accounts'] => {
  const privateKey = process.env.VECHAIN_PRIVATE_KEY?.trim();
  const mnemonic = process.env.VECHAIN_MNEMONIC?.trim();

  if (privateKey && mnemonic) {
    throw new Error(
      'Configure exactly one signing strategy: set VECHAIN_PRIVATE_KEY or VECHAIN_MNEMONIC, not both.'
    );
  }

  if (privateKey) {
    const key = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
    return [key];
  }

  if (mnemonic) {
    return hdAccounts(mnemonic);
  }

  if (kind === 'solo') {
    return hdAccounts(SOLO_DEV_MNEMONIC);
  }

  // Public networks require env credentials at runtime (deploy / E2E).
  // A valid accounts shape is still required so Hardhat can load the config
  // for compile and local tests without a .env file.
  return hdAccounts(SOLO_DEV_MNEMONIC);
};

/**
 * Build a fully-typed HD accounts config. `passphrase` is required by
 * HttpNetworkHDAccountsConfig; an empty string means "no passphrase" and
 * matches Hardhat's default BIP-39 behavior.
 */
const hdAccounts = (mnemonic: string): HttpNetworkHDAccountsConfig => ({
  mnemonic,
  path: VET_DERIVATION_PATH,
  count: 10,
  initialIndex: 0,
  passphrase: '',
});

const vechainRpcConfiguration: HttpNetworkConfig['rpcConfiguration'] = {
  ethGetTransactionCountMustReturn0: false,
};

const vechainNetwork = (
  url: string,
  chainId: number,
  kind: 'solo' | 'public'
): HttpNetworkConfig => ({
  url,
  chainId,
  accounts: getSignerAccounts(kind),
  gas: 'auto',
  gasPrice: 'auto',
  gasMultiplier: 1,
  timeout: 120_000,
  httpHeaders: {},
  debug: false,
  enableDelegation: false,
  gasPayer: undefined,
  rpcConfiguration: vechainRpcConfiguration,
});

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: '0.8.20',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
          evmVersion: 'shanghai',
        },
      },
    ],
  },
  networks: {
    hardhat: {
      chainId: 1337,
    },
    vechain_solo: vechainNetwork(
      process.env.THOR_SOLO_URL || 'http://127.0.0.1:8669',
      24652929101810,
      'solo'
    ),
    vechain_testnet: vechainNetwork(
      process.env.VECHAIN_TESTNET_RPC_URL || 'https://testnet.vechain.org',
      100010,
      'public'
    ),
    vechain_mainnet: vechainNetwork(
      process.env.VECHAIN_MAINNET_RPC_URL || 'https://mainnet.vechain.org',
      100009,
      'public'
    ),
  },
  mocha: {
    timeout: 300_000,
  },
  gasReporter: {
    enabled: process.env.GAS_REPORT === 'true',
    currency: 'USD',
    gasPrice: 21,
    token: 'VTHO',
  },
};

export default config;
