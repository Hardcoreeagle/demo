import { buildModule } from '@nomicfoundation/ignition-core';

/**
 * Hardhat Ignition module for BatchIntegrityAnchor (#36).
 *
 * The admin address is a required module parameter - the deployer is NOT
 * implicitly privileged. ANCHOR_ROLE is intentionally NOT granted here;
 * use scripts/configure-roles.ts with a dedicated admin wallet.
 *
 * Usage:
 *   npx hardhat ignition deploy ignition/modules/BatchIntegrityAnchor.ts \
 *     --network vechain_testnet \
 *     --parameters BatchIntegrityAnchorModule.admin=0x...
 */
export const BatchIntegrityAnchorModule = buildModule(
  'BatchIntegrityAnchorModule',
  (m) => {
    // Runtime value: resolved at deployment time by Ignition.
    const admin = m.getParameter('admin');

    const anchor = m.contract('BatchIntegrityAnchor', [admin]);

    // The contract's own constructor reverts on the zero address, which gives
    // a hard on-chain guarantee even if a bad parameter is passed here.
    // No ANCHOR_ROLE grant, no post-deploy calls: the module stays minimal so
    // the anchor role must be granted deliberately by the admin wallet.

    return { anchor };
  }
);
