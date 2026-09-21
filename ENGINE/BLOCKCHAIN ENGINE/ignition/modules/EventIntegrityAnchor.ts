import { buildModule } from '@nomicfoundation/ignition-core';

/**
 * Hardhat Ignition module for EventIntegrityAnchor (per-event anchoring).
 *
 * Deployed ALONGSIDE BatchIntegrityAnchor. The admin address is a required
 * module parameter - the deployer is NOT implicitly privileged. ANCHOR_ROLE is
 * intentionally NOT granted here; use scripts/configure-roles.ts with a
 * dedicated admin wallet.
 *
 * Usage:
 *   npx hardhat ignition deploy ignition/modules/EventIntegrityAnchor.ts \
 *     --network vechain_testnet \
 *     --parameters EventIntegrityAnchorModule.admin=0x...
 */
export const EventIntegrityAnchorModule = buildModule(
  'EventIntegrityAnchorModule',
  (m) => {
    const admin = m.getParameter('admin');

    const anchor = m.contract('EventIntegrityAnchor', [admin]);

    // The contract's constructor reverts on the zero address. No ANCHOR_ROLE
    // grant here so the anchor role must be granted deliberately.

    return { anchor };
  }
);
