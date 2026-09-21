// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title BatchIntegrityAnchor
 * @notice Immutable, append-only integrity anchor for pharmaceutical batch
 *         EPCIS datasets on VeChainThor (or any EVM-compatible chain).
 *
 * @dev DESIGN SUMMARY
 *
 *  - This contract is an INTEGRITY ANCHOR, not a data store. It never holds
 *    EPCIS JSON, PII, documents, images, AI output, or genealogy.
 *  - The off-chain Integrity Engine builds the SHA-256 event hashes, the
 *    Merkle tree, and the dataset hash. This contract does NOT build or verify
 *    Merkle trees.
 *
 *  SHA-256 vs KECCAK-256
 *  - `merkleRoot` and `datasetHash` are OPAQUE 32-byte commitments produced
 *    off-chain with SHA-256. The EVM natively uses Keccak-256, but this
 *    contract never hashes or interprets these values. Do NOT replace the
 *    Integrity Engine's SHA-256 with Keccak-256 to "match" the EVM.
 *  - The only hash computed on-chain is the role identifier
 *    keccak256("ANCHOR_ROLE"), which is standard AccessControl practice.
 *
 *  BATCH IDENTITY
 *  - `batchKey` is the stable batch identity decided by the upstream
 *    Canonical/GS1 pipeline. The contract does not derive or validate it
 *    beyond rejecting the zero value.
 *
 *  VERSIONING & IMMUTABILITY
 *  - Anchors are append-only: version = latestVersion[batchKey] + 1.
 *  - There is intentionally NO update, delete, or replace function.
 *  - A given (batchKey, merkleRoot) pair can be anchored only once, which
 *    prevents replaying an old root as a "new" version.
 *
 *  ACCESS CONTROL
 *  - DEFAULT_ADMIN_ROLE: manages roles and pauses/unpauses. It cannot anchor
 *    unless it is explicitly also granted ANCHOR_ROLE.
 *  - ANCHOR_ROLE: may call anchorBatch() only. Holds no admin power.
 *  - The deployer is NOT implicitly privileged: the admin is an explicit
 *    constructor argument, and no ANCHOR_ROLE is granted at deployment.
 *
 *  NON-UPGRADEABLE: no proxy, no selfdestruct, no delegatecall.
 *
 *  CHAIN NEUTRALITY
 *  - Only `block.timestamp` and `msg.sender` are used. No reliance on
 *    Ethereum gas semantics, finality, or transaction fields. Fee handling
 *    (VET/VTHO, fee delegation) belongs to the off-chain adapter.
 *
 *  Note on msg.sender: with VeChain fee delegation, msg.sender remains the
 *  transaction origin/signer, not the gas sponsor, so `anchoredBy` stays
 *  correct.
 */
contract BatchIntegrityAnchor is AccessControl, Pausable {
    // ---------------------------------------------------------------------
    // Roles
    // ---------------------------------------------------------------------

    /// @notice Role allowed to anchor batch integrity commitments.
    bytes32 public constant ANCHOR_ROLE = keccak256("ANCHOR_ROLE");

    // ---------------------------------------------------------------------
    // Types
    // ---------------------------------------------------------------------

    /**
     * @dev Storage layout: version (slot 0), merkleRoot (slot 1),
     *      datasetHash (slot 2), eventCount (slot 3),
     *      timestamp + anchoredBy packed together (slot 4).
     */
    struct IntegrityAnchor {
        uint256 version;
        bytes32 merkleRoot;
        bytes32 datasetHash;
        uint256 eventCount;
        uint64 timestamp;
        address anchoredBy;
    }

    // ---------------------------------------------------------------------
    // Storage
    // ---------------------------------------------------------------------

    /// @dev batchKey => version => anchor. Write-once per (batchKey, version).
    mapping(bytes32 => mapping(uint256 => IntegrityAnchor)) private anchors;

    /// @dev batchKey => latest version. Monotonically increasing.
    mapping(bytes32 => uint256) private latestVersion;

    /// @dev batchKey => merkleRoot => already anchored. Never reset to false.
    mapping(bytes32 => mapping(bytes32 => bool)) private rootAnchored;

    // ---------------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------------

    /// @notice Emitted for every successful anchor. Sufficient for an indexer
    ///         to fully reconstruct the anchor without reading storage.
    event BatchAnchored(
        bytes32 indexed batchKey,
        uint256 indexed version,
        bytes32 indexed merkleRoot,
        bytes32 datasetHash,
        uint256 eventCount,
        uint256 timestamp,
        address anchoredBy
    );

    // ---------------------------------------------------------------------
    // Errors
    // ---------------------------------------------------------------------

    error InvalidAdmin();
    error InvalidBatchKey();
    error InvalidMerkleRoot();
    error InvalidDatasetHash();
    error InvalidEventCount();
    error RootAlreadyAnchored();
    error AnchorNotFound();

    // ---------------------------------------------------------------------
    // Constructor
    // ---------------------------------------------------------------------

    /**
     * @param admin Address receiving DEFAULT_ADMIN_ROLE. Must be non-zero.
     *              Use a dedicated admin wallet, separate from the anchor
     *              service wallet. ANCHOR_ROLE is NOT granted here.
     */
    constructor(address admin) {
        if (admin == address(0)) revert InvalidAdmin();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    // ---------------------------------------------------------------------
    // Anchoring
    // ---------------------------------------------------------------------

    /**
     * @notice Anchor a new integrity commitment for a batch.
     * @param batchKey    Stable batch identity (non-zero).
     * @param merkleRoot  SHA-256 Merkle root of the batch's EPCIS event hashes
     *                    (non-zero, opaque to this contract).
     * @param datasetHash SHA-256 hash of the full dataset (non-zero, opaque).
     * @param eventCount  Number of events committed by the root (> 0).
     * @return version    The newly assigned version, starting at 1.
     */
    function anchorBatch(
        bytes32 batchKey,
        bytes32 merkleRoot,
        bytes32 datasetHash,
        uint256 eventCount
    ) external onlyRole(ANCHOR_ROLE) whenNotPaused returns (uint256 version) {
        if (batchKey == bytes32(0)) revert InvalidBatchKey();
        if (merkleRoot == bytes32(0)) revert InvalidMerkleRoot();
        if (datasetHash == bytes32(0)) revert InvalidDatasetHash();
        if (eventCount == 0) revert InvalidEventCount();
        if (rootAnchored[batchKey][merkleRoot]) revert RootAlreadyAnchored();

        // Checked arithmetic (0.8.x): overflow is impossible in practice and
        // would revert rather than wrap.
        version = latestVersion[batchKey] + 1;

        rootAnchored[batchKey][merkleRoot] = true;
        latestVersion[batchKey] = version;

        uint64 ts = uint64(block.timestamp);

        anchors[batchKey][version] = IntegrityAnchor({
            version: version,
            merkleRoot: merkleRoot,
            datasetHash: datasetHash,
            eventCount: eventCount,
            timestamp: ts,
            anchoredBy: msg.sender
        });

        emit BatchAnchored(
            batchKey,
            version,
            merkleRoot,
            datasetHash,
            eventCount,
            ts,
            msg.sender
        );
    }

    // ---------------------------------------------------------------------
    // Queries (always available, including while paused)
    // ---------------------------------------------------------------------

    /// @notice Returns the most recent anchor for a batch.
    /// @dev Reverts with AnchorNotFound if the batch has never been anchored.
    function getLatestAnchor(
        bytes32 batchKey
    ) external view returns (IntegrityAnchor memory) {
        uint256 v = latestVersion[batchKey];
        if (v == 0) revert AnchorNotFound();
        return anchors[batchKey][v];
    }

    /// @notice Returns a specific historical anchor.
    /// @dev Reverts with AnchorNotFound for version 0 or a non-existent version.
    function getAnchor(
        bytes32 batchKey,
        uint256 version
    ) external view returns (IntegrityAnchor memory) {
        if (version == 0 || version > latestVersion[batchKey]) {
            revert AnchorNotFound();
        }
        return anchors[batchKey][version];
    }

    /// @notice Returns the latest version number for a batch (0 if none).
    function getLatestVersion(bytes32 batchKey) external view returns (uint256) {
        return latestVersion[batchKey];
    }

    /// @notice Whether a given root has ever been anchored for a batch.
    function isRootAnchored(
        bytes32 batchKey,
        bytes32 merkleRoot
    ) external view returns (bool) {
        return rootAnchored[batchKey][merkleRoot];
    }

    // ---------------------------------------------------------------------
    // Emergency controls
    // ---------------------------------------------------------------------

    /// @notice Halt anchoring. Reads stay available. Admin only.
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /// @notice Resume anchoring. Admin only.
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}
