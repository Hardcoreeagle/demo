# SECURITY

## Access-control model

```
ADMIN WALLET   --DEFAULT_ADMIN_ROLE--> grant/revoke ANCHOR_ROLE, pause/unpause
ANCHOR SERVICE --ANCHOR_ROLE---------> anchorBatch() only
```

- Roles are strictly separated. The anchor service has **no** administrative
  power; the admin cannot anchor unless separately granted ANCHOR_ROLE.
- The deployer receives **no** implicit privilege: the admin is an explicit
  constructor argument, and no ANCHOR_ROLE is granted at deployment.
- Production requires two distinct wallets. `configure-roles.ts` warns when
  one wallet holds both roles.

## Private keys (#33)

Never hardcode keys, commit mnemonics, or log credentials. `.env` is for
**local development only** and is git-ignored. Signing strategy is explicit:
exactly one of `VECHAIN_PRIVATE_KEY` / `VECHAIN_MNEMONIC` (configuring both
is an error). Production must migrate to Secret Manager / HSM / Vault /
secure signer **without changing the contract** — keys live only in the
adapter/signer layer.

## Immutability & replay protection

- Append-only versioning: `version = latestVersion + 1`, derived on-chain.
  No `updateAnchor` / `deleteAnchor` / `replaceRoot` exists.
- Duplicate protection: `(batchKey, merkleRoot)` can be anchored once, ever.
  Replaying an old root as a "new version" reverts with `RootAlreadyAnchored`.
- Historical anchors cannot be mutated by anyone, including the admin
  (verified by security and property tests).
- On-chain immutability is paired with no upgradeability: no UUPS/Transparent/
  Beacon proxy, no `selfdestruct`, no `delegatecall`.

## Pause

`pause()`/`unpause()` are admin-only. While paused, anchoring reverts
(`EnforcedPause`) and all queries stay available. This is an incident-response
control for a compromised anchor service — read/verification paths are never
blocked.

## Compromise scenarios (#47)

| Compromise | Impact | Containment |
|---|---|---|
| PostgreSQL / indexer | forged *views*, not forged history | chain remains authoritative; re-verify against contract |
| Anchor service key | attacker can anchor garbage for batches it knows | role isolation, key rotation (`revoke`+`grant`), monitoring, `pause()` |
| Admin key | role management + pause only; cannot rewrite anchors | cold storage, multisig/HSM recommended for mainnet |
| Both keys | attacker can anchor new versions, **still cannot modify or delete** existing versions | duplicate + append-only design bounds the damage |

## Fee delegation

VeChain separates transaction origin from gas payer. A sponsor pays VTHO while
`msg.sender` remains the anchor wallet, so `anchoredBy` stays correct.
Delegation is configured in the adapter only; the contract has no knowledge of
it and needs none. See #32 in the implementation spec and
`VeChainThorAnchorClient.getFeeDelegationInfo()`.

## Static analysis

Run Slither when available:

```bash
pip install slither-analyzer
slither contracts/BatchIntegrityAnchor.sol --solc solc-0.8.20
```

Findings to document on first run: external-call surface (none — no external
calls), reentrancy (none — state changes only), integer overflow (checked
0.8.x arithmetic), access-control coverage (both entry points gated).
Solidity compiler warnings and `npx hardhat size-contracts` should also be
reviewed before mainnet.

## Known limitations

- `block.timestamp` is validator-influenced within consensus bounds —
  acceptable for integrity anchoring; do not use it for sub-minute claims.
- The contract trusts the off-chain Integrity Engine for hash correctness;
  the trust boundary is the anchoring of *commitments*, not hash computation.
- Anchoring garbage with a valid ANCHOR_ROLE key cannot be prevented
  on-chain; mitigate with monitoring, key isolation, and pause.
