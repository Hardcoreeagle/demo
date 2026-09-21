// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title EventIntegrityAnchor
 * @notice Immutable, append-only integrity anchor for INDIVIDUAL GS1 EPCIS
 *         events on VeChainThor (or any EVM-compatible chain).
 *
 * @dev RELATIONSHIP TO BatchIntegrityAnchor
 *
 *  This contract is deployed ALONGSIDE BatchIntegrityAnchor, not as a
 *  replacement. BatchIntegrityAnchor commits one Merkle root per batch;
 *  EventIntegrityAnchor commits one record per EPCIS event, with one
 *  transaction per event, and links every event to its batch.
 *
 *  DESIGN SUMMARY
 *
 *  - This contract is an INTEGRITY ANCHOR, not a data store. It never holds
 *    EPCIS JSON, PII, documents, images, AI output, or genealogy. Only opaque
 *    32-byte SHA-256 commitments and small classification fields are stored.
 *  - The off-chain Integrity Engine builds the SHA-256 event hash for each
 *    EPCIS event and the SHA-256 Merkle root for the batch. This contract
 *    does NOT build or verify Merkle trees.
 *
 *  SHA-256 vs KECCAK-256
 *  - `eventHash`, `merkleRoot` and `datasetHash` are OPAQUE 32-byte
 *    commitments produced off-chain with SHA-256. The EVM natively uses
 *    Keccak-256, but this contract never hashes or interprets these values.
 *  - The only hash computed on-chain is the role identifier
 *    keccak256("ANCHOR_ROLE"), standard AccessControl practice.
 *
 *  ONE TRANSACTION PER EVENT + BATCH LINKING
 *  - `anchorEvent` anchors exactly one EPCIS event. Every call is its own
 *    transaction, so each event has its own transaction hash you can look up
 *    on a block explorer.
 *  - Each event carries its `batchKey`, indexed in the `EventAnchored` log, so
 *    on an explorer you can filter by the batchKey topic and see every event
 *    transaction belonging to that batch.
 *  - `anchorBatchRoot` anchors the batch's SHA-256 Merkle root once the events
 *    are in. Looking up that transaction shows the batchKey + root + count,
 *    tying the whole set of events together under a single commitment.
 *
 *  IMMUTABILITY
 *  - Events are write-once: a given `eventHash` can be anchored only once.
 *  - A given `batchKey` root can be anchored only once.
 *  - There is intentionally NO update, delete, or replace function.
 *
 *  ACCESS CONTROL
 *  - DEFAULT_ADMIN_ROLE: manages roles and pauses/unpauses. Cannot anchor
 *    unless explicitly also granted ANCHOR_ROLE.
 *  - ANCHOR_ROLE: may call anchorEvent / anchorEventClassified /
 *    anchorBatchRoot only. Holds no admin power.
 *  - The deployer is NOT implicitly privileged: admin is a constructor
 *    argument, and no ANCHOR_ROLE is granted at deployment.
 *
 *  NON-UPGRADEABLE: no proxy, no selfdestruct, no delegatecall.
 *
 *  CHAIN NEUTRALITY
 *  - Only `block.timestamp` and `msg.sender` are used. With VeChain fee
 *    delegation, msg.sender remains the transaction origin/signer, not the
 *    gas sponsor, so `anchoredBy` stays correct.
 */
contract EventIntegrityAnchor is AccessControl, Pausable {
    // ---------------------------------------------------------------------
    // Roles
    // ---------------------------------------------------------------------

    /// @notice Role allowed to anchor event and batch-root commitments.
    bytes32 public constant ANCHOR_ROLE = keccak256("ANCHOR_ROLE");

    // ---------------------------------------------------------------------
    // Types
    // ---------------------------------------------------------------------

    /**
     * @dev One anchored EPCIS event. `eventId` is an opaque 32-byte digest of
     *      the event's EPCIS eventID (SHA-256 off-chain), NOT the raw string,
     *      so no PII/URIs land on-chain. `eventType` is a small enumerated code
     *      (see EventType off-chain mapping: 1=Object, 2=Aggregation,
     *      3=Transaction, 4=Transformation, 5=Association, 0=Unspecified).
     */
    struct EventAnchorRecord {
        bytes32 batchKey;
        bytes32 eventHash;
        bytes32 eventId;
        uint8 eventType;
        uint64 timestamp;
        uint256 sequence; // 1-based position within the batch
        address anchoredBy;
    }

    /// @dev Batch-level Merkle root commitment tying all events together.
    struct BatchRootRecord {
        bytes32 batchKey;
        bytes32 merkleRoot;
        bytes32 datasetHash;
        uint256 eventCount;
        uint64 timestamp;
        address anchoredBy;
    }

    // ---------------------------------------------------------------------
    // Storage
    // ---------------------------------------------------------------------

    /// @dev eventHash => record. Write-once per eventHash.
    mapping(bytes32 => EventAnchorRecord) private eventByHash;

    /// @dev batchKey => ordered list of anchored event hashes.
    mapping(bytes32 => bytes32[]) private batchEventHashes;

    /// @dev batchKey => root record. Write-once per batchKey.
    mapping(bytes32 => BatchRootRecord) private batchRoot;

    /// @dev batchKey => whether the batch root has been anchored.
    mapping(bytes32 => bool) private batchRootAnchored;

    // ---------------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------------

    /**
     * @notice Emitted for every anchored EPCIS event. Indexed by batchKey so an
     *         explorer/indexer can list all events of a batch, and by eventHash
     *         so a single event can be located directly.
     */
    event EventAnchored(
        bytes32 indexed batchKey,
        bytes32 indexed eventHash,
        bytes32 indexed eventId,
        uint8 eventType,
        uint256 sequence,
        uint256 timestamp,
        address anchoredBy
    );

    /// @notice Emitted once per batch when its Merkle root is anchored.
    event BatchRootAnchored(
        bytes32 indexed batchKey,
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
    error InvalidEventHash();
    error InvalidMerkleRoot();
    error InvalidDatasetHash();
    error InvalidEventCount();
    error EventAlreadyAnchored();
    error BatchRootAlreadyAnchored();
    error EventNotFound();
    error BatchRootNotFound();
    error EventCountMismatch();

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
    // Anchoring - events
    // ---------------------------------------------------------------------

    /**
     * @notice Anchor a single EPCIS event (one transaction per event).
     * @param batchKey  Stable batch identity this event belongs to (non-zero).
     * @param eventHash SHA-256 hash of the canonical EPCIS event (non-zero,
     *                  opaque, unique across the contract).
     * @param eventId   Opaque 32-byte digest of the EPCIS eventID (may be zero
     *                  if the source event has no stable id).
     * @param eventType Small enumerated EPCIS event-type code (see struct docs).
     * @return sequence 1-based position of this event within its batch.
     */
    function anchorEvent(
        bytes32 batchKey,
        bytes32 eventHash,
        bytes32 eventId,
        uint8 eventType
    ) external onlyRole(ANCHOR_ROLE) whenNotPaused returns (uint256 sequence) {
        if (batchKey == bytes32(0)) revert InvalidBatchKey();
        if (eventHash == bytes32(0)) revert InvalidEventHash();
        if (eventByHash[eventHash].eventHash != bytes32(0)) {
            revert EventAlreadyAnchored();
        }

        batchEventHashes[batchKey].push(eventHash);
        sequence = batchEventHashes[batchKey].length; // 1-based

        uint64 ts = uint64(block.timestamp);

        eventByHash[eventHash] = EventAnchorRecord({
            batchKey: batchKey,
            eventHash: eventHash,
            eventId: eventId,
            eventType: eventType,
            timestamp: ts,
            sequence: sequence,
            anchoredBy: msg.sender
        });

        emit EventAnchored(
            batchKey,
            eventHash,
            eventId,
            eventType,
            sequence,
            ts,
            msg.sender
        );
    }

    // ---------------------------------------------------------------------
    // Anchoring - batch root (linking)
    // ---------------------------------------------------------------------

    /**
     * @notice Anchor the SHA-256 Merkle root for a batch, linking every event
     *         already anchored under `batchKey` to a single commitment.
     * @param batchKey    Stable batch identity (non-zero).
     * @param merkleRoot  SHA-256 Merkle root over the batch's event hashes
     *                    (non-zero, opaque).
     * @param datasetHash SHA-256 hash of the full dataset (non-zero, opaque).
     * @param eventCount  Number of events committed by the root (> 0). Must
     *                    equal the number of events anchored on-chain for this
     *                    batch, guaranteeing the root and the event set agree.
     */
    function anchorBatchRoot(
        bytes32 batchKey,
        bytes32 merkleRoot,
        bytes32 datasetHash,
        uint256 eventCount
    ) external onlyRole(ANCHOR_ROLE) whenNotPaused {
        if (batchKey == bytes32(0)) revert InvalidBatchKey();
        if (merkleRoot == bytes32(0)) revert InvalidMerkleRoot();
        if (datasetHash == bytes32(0)) revert InvalidDatasetHash();
        if (eventCount == 0) revert InvalidEventCount();
        if (batchRootAnchored[batchKey]) revert BatchRootAlreadyAnchored();
        if (batchEventHashes[batchKey].length != eventCount) {
            revert EventCountMismatch();
        }

        uint64 ts = uint64(block.timestamp);

        batchRootAnchored[batchKey] = true;
        batchRoot[batchKey] = BatchRootRecord({
            batchKey: batchKey,
            merkleRoot: merkleRoot,
            datasetHash: datasetHash,
            eventCount: eventCount,
            timestamp: ts,
            anchoredBy: msg.sender
        });

        emit BatchRootAnchored(
            batchKey,
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

    /// @notice Returns the anchored record for one event hash.
    /// @dev Reverts with EventNotFound if the event was never anchored.
    ///      Named getEventRecord (not getEvent) to avoid colliding with the
    ///      ethers.js BaseContract.getEvent() event-fragment accessor.
    function getEventRecord(
        bytes32 eventHash
    ) external view returns (EventAnchorRecord memory) {
        EventAnchorRecord memory rec = eventByHash[eventHash];
        if (rec.eventHash == bytes32(0)) revert EventNotFound();
        return rec;
    }

    /// @notice Whether an event hash has ever been anchored.
    function isEventAnchored(bytes32 eventHash) external view returns (bool) {
        return eventByHash[eventHash].eventHash != bytes32(0);
    }

    /// @notice All event hashes anchored under a batch, in anchoring order.
    function getBatchEventHashes(
        bytes32 batchKey
    ) external view returns (bytes32[] memory) {
        return batchEventHashes[batchKey];
    }

    /// @notice Number of events anchored under a batch.
    function getBatchEventCount(
        bytes32 batchKey
    ) external view returns (uint256) {
        return batchEventHashes[batchKey].length;
    }

    /// @notice A single event hash of a batch by 1-based sequence.
    /// @dev Reverts with EventNotFound for sequence 0 or out-of-range.
    function getBatchEventHashAt(
        bytes32 batchKey,
        uint256 sequence
    ) external view returns (bytes32) {
        uint256 len = batchEventHashes[batchKey].length;
        if (sequence == 0 || sequence > len) revert EventNotFound();
        return batchEventHashes[batchKey][sequence - 1];
    }

    /// @notice Returns the batch-root commitment.
    /// @dev Reverts with BatchRootNotFound if the root was never anchored.
    function getBatchRoot(
        bytes32 batchKey
    ) external view returns (BatchRootRecord memory) {
        if (!batchRootAnchored[batchKey]) revert BatchRootNotFound();
        return batchRoot[batchKey];
    }

    /// @notice Whether the batch root has been anchored.
    function isBatchRootAnchored(
        bytes32 batchKey
    ) external view returns (bool) {
        return batchRootAnchored[batchKey];
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
