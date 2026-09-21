/**
 * Off-chain Integrity Engine (#13, #14, #45).
 *
 * Pipeline:
 *   EPCIS event -> deterministic canonical JSON -> SHA-256 -> event hash
 *   event hashes -> deterministic ordering -> Merkle tree -> merkleRoot
 *   full dataset  -> canonical JSON -> SHA-256 -> datasetHash
 *
 * HASH POLICY (do not change without a full re-anchor of the platform):
 *   - All hashing is SHA-256 (FIPS 180-4). The EVM's Keccak-256 is NEVER used
 *     here; the contract treats our outputs as opaque commitments.
 *   - Canonical JSON: RFC 8785 (JCS). Sort keys by UTF-16 code units, no
 *     whitespace, minimal number formatting, strings escaped per JSON spec.
 *   - Event hash domain separation: sha256("EPCIS_EVENT_V1:" + canonical(event)).
 *   - Leaf hashing: sha256("EPCIS_LEAF_V1:" + eventHash) - RFC 6962-style
 *     domain separation so raw event hashes can never collide with leaves.
 *   - Internal nodes: sha256("EPCIS_NODE_V1:" + left || right) with explicit
 *     duplication of the last node on odd levels (Bitcoin/OpenZeppelin style).
 *   - Ordering: lexicographic sort of event hashes before tree building -
 *     independent of input document order. Even unordered input produces an
 *     identical root.
 */

import { createHash } from 'crypto';

// ---------------------------------------------------------------------------
// Canonical JSON (RFC 8785 subset for JSON-serializable EPCIS data)
// ---------------------------------------------------------------------------

/** Compare strings by UTF-16 code units, as required by RFC 8785. */
const compareUtf16 = (a: string, b: string): number =>
  a < b ? -1 : a > b ? 1 : 0;

/**
 * RFC 8785 number serialization (subset): integers without exponent or
 * decimal point; other finite numbers via shortest round-trip representation.
 */
const serializeNumber = (n: number): string => {
  if (!Number.isFinite(n)) {
    throw new Error(`Cannot canonicalize non-finite number: ${n}`);
  }
  if (Number.isInteger(n) && Math.abs(n) <= 1e15) {
    return String(n);
  }
  const json = String(n); // JS default is shortest round-trip, JCS-compatible
  if (json.includes('e') || json.includes('E')) {
    // Normalize exponent form to plain decimal for small exponents.
    return n.toFixed(20).replace(/\.?0+$/, '');
  }
  return json;
};

/** Deterministic canonical JSON string for any JSON-serializable value. */
export function canonicalize(value: unknown): string {
  if (value === null || typeof value === 'boolean') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') return serializeNumber(value);
  if (typeof value === 'string') return JSON.stringify(value);

  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(',')}]`;
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>).sort(compareUtf16);
    const parts = keys.map(
      (k) => `${JSON.stringify(k)}:${canonicalize((value as Record<string, unknown>)[k])}`
    );
    return `{${parts.join(',')}}`;
  }
  throw new Error(`Cannot canonicalize value of type ${typeof value}`);
}

const sha256Hex = (input: string | Buffer): string =>
  createHash('sha256').update(input).digest('hex');

// ---------------------------------------------------------------------------
// Event hashing
// ---------------------------------------------------------------------------

export interface EpcisEventLike {
  type: string;
  eventID?: string;
  [key: string]: unknown;
}

/** Domain separator for event hashes. Versioned for future migration. */
const EVENT_HASH_PREFIX = 'EPCIS_EVENT_V1:';
const LEAF_PREFIX = 'EPCIS_LEAF_V1:';
const NODE_PREFIX = 'EPCIS_NODE_V1:';
export const DATASET_HASH_PREFIX = 'EPCIS_DATASET_V1:';

/**
 * SHA-256 hash of one EPCIS event.
 * @param event Raw EPCIS event object (any JSON-serializable shape).
 * @returns 0x-prefixed 32-byte hex hash.
 */
export function hashEpcisEvent(event: unknown): string {
  return '0x' + sha256Hex(EVENT_HASH_PREFIX + canonicalize(event));
}

/**
 * Hash every event in an EPCIS 2.0 document (`epcisBody.eventList`).
 * Accepts either the full document or a bare event array.
 */
export function hashEpcisDocument(
  doc: unknown
): { eventHashes: string[]; eventCount: number } {
  let events: unknown[];
  if (Array.isArray(doc)) {
    events = doc;
  } else if (
    doc &&
    typeof doc === 'object' &&
    (doc as Record<string, unknown>).epcisBody
  ) {
    const body = (doc as Record<string, unknown>).epcisBody as Record<
      string,
      unknown
    >;
    const list = body.eventList;
    if (!Array.isArray(list)) {
      throw new Error('EPCIS document has no eventList array');
    }
    events = list;
  } else {
    throw new Error(
      'Input must be an EPCIS document with epcisBody.eventList or an event array'
    );
  }

  if (events.length === 0) {
    throw new Error('EPCIS document contains zero events');
  }

  const eventHashes = events.map(hashEpcisEvent);
  return { eventHashes, eventCount: events.length };
}

// ---------------------------------------------------------------------------
// Merkle tree
// ---------------------------------------------------------------------------

export interface MerkleProof {
  /** Sibling hashes from leaf level to root. */
  siblings: string[];
  /** true = sibling is on the right (hash current || sibling). */
  isRight: boolean[];
}

/** Internal node: full tree level, used for proof generation. */
interface TreeLevel {
  hashes: string[];
}

const hashNode = (left: string, right: string): string =>
  '0x' + sha256Hex(Buffer.concat([Buffer.from(left.slice(2), 'hex'), Buffer.from(right.slice(2), 'hex')]));

/** RFC 6962-style leaf hash with domain separation. */
const hashLeaf = (eventHash: string): string =>
  '0x' + sha256Hex(Buffer.concat([Buffer.from(LEAF_PREFIX), Buffer.from(eventHash.slice(2), 'hex')]));

/**
 * Build the Merkle root over deterministically ordered event hashes.
 * - Leaves are the SHA-256 of each event hash (domain-separated).
 * - Leaf order: lexicographic sort of the event hashes themselves.
 * - Odd node at any level is paired with itself.
 */
export function buildMerkleRoot(eventHashes: string[]): string {
  if (eventHashes.length === 0) {
    throw new Error('Cannot build a Merkle tree from zero events');
  }

  const sorted = [...eventHashes].sort(compareUtf16);
  let level: TreeLevel = { hashes: sorted.map(hashLeaf) };

  while (level.hashes.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < level.hashes.length; i += 2) {
      const left = level.hashes[i];
      const right = i + 1 < level.hashes.length ? level.hashes[i + 1] : left; // duplicate last
      next.push(hashNode(left, right));
    }
    level = { hashes: next };
  }

  return level.hashes[0];
}

/**
 * Generate an inclusion proof for one event's hash.
 * Throws if the event hash is not part of the tree.
 */
export function buildMerkleProof(
  eventHashes: string[],
  targetEventHash: string
): MerkleProof {
  const idx = [...eventHashes].sort(compareUtf16).indexOf(targetEventHash);
  if (idx === -1) {
    throw new Error('Event hash not found in this dataset');
  }

  const sorted = [...eventHashes].sort(compareUtf16);
  let level: string[] = sorted.map(hashLeaf);
  let i = idx;
  const siblings: string[] = [];
  const isRight: boolean[] = [];

  while (level.length > 1) {
    if (i % 2 === 0) {
      const sib = i + 1 < level.length ? level[i + 1] : level[i]; // duplicated
      siblings.push(sib);
      isRight.push(true);
      i = i / 2;
    } else {
      siblings.push(level[i - 1]);
      isRight.push(false);
      i = (i - 1) / 2;
    }
    const next: string[] = [];
    for (let j = 0; j < level.length; j += 2) {
      const left = level[j];
      const right = j + 1 < level.length ? level[j + 1] : level[j];
      next.push(hashNode(left, right));
    }
    level = next;
  }

  return { siblings, isRight };
}

/** Verify a Merkle proof against a root. Pure function, no I/O. */
export function verifyMerkleProof(
  leafEventHash: string,
  proof: MerkleProof,
  root: string
): boolean {
  let acc = hashLeaf(leafEventHash);
  for (let d = 0; d < proof.siblings.length; d++) {
    acc = proof.isRight[d] ? hashNode(acc, proof.siblings[d]) : hashNode(proof.siblings[d], acc);
  }
  return acc === root;
}

// ---------------------------------------------------------------------------
// Dataset hash
// ---------------------------------------------------------------------------

/**
 * SHA-256 over the canonical JSON of the FULL EPCIS document (byte-exact
 * commitment to the whole dataset, not just the event list).
 */
export function hashDataset(doc: unknown): string {
  return '0x' + sha256Hex(DATASET_HASH_PREFIX + canonicalize(doc));
}

// ---------------------------------------------------------------------------
// Batch commitment (adapter input)
// ---------------------------------------------------------------------------

export interface BatchCommitment {
  batchKey: string;
  merkleRoot: string;
  datasetHash: string;
  eventCount: bigint;
  /** Per-event hashes, in input order (audit trail). */
  eventHashes: string[];
}

/**
 * Derive the complete commitment for one batch from its EPCIS document.
 * batchKey must match the upstream Canonical/GS1 pipeline identity.
 */
export function deriveBatchCommitment(
  epcisDoc: unknown,
  batchKey: string
): BatchCommitment {
  if (!/^0x[0-9a-fA-F]{64}$/.test(batchKey)) {
    throw new Error('batchKey must be a 0x-prefixed 32-byte hex string');
  }
  const { eventHashes, eventCount } = hashEpcisDocument(epcisDoc);
  return {
    batchKey,
    merkleRoot: buildMerkleRoot(eventHashes),
    datasetHash: hashDataset(epcisDoc),
    eventCount: BigInt(eventCount),
    eventHashes,
  };
}

// ---------------------------------------------------------------------------
// Per-event commitments (event-level anchoring)
// ---------------------------------------------------------------------------

/**
 * Numeric EPCIS event-type codes stored on-chain (EventIntegrityAnchor uses a
 * uint8). Kept small and stable; do not renumber existing entries.
 */
export enum EpcisEventType {
  Unspecified = 0,
  Object = 1,
  Aggregation = 2,
  Transaction = 3,
  Transformation = 4,
  Association = 5,
}

/** Domain separator for the on-chain eventId digest (opaque, no PII on-chain). */
const EVENT_ID_PREFIX = 'EPCIS_EVENTID_V1:';

const ZERO_BYTES32 =
  '0x0000000000000000000000000000000000000000000000000000000000000000';

/**
 * Map an EPCIS event's `type` (or `isA`/`@type`) string to a numeric code.
 * Unknown/absent types map to Unspecified (0) rather than throwing, so a
 * malformed type never blocks anchoring the event's integrity hash.
 */
export function classifyEpcisEventType(event: unknown): EpcisEventType {
  const t =
    event && typeof event === 'object'
      ? String(
          (event as Record<string, unknown>).type ??
            (event as Record<string, unknown>).isA ??
            (event as Record<string, unknown>)['@type'] ??
            ''
        )
      : '';
  switch (t) {
    case 'ObjectEvent':
      return EpcisEventType.Object;
    case 'AggregationEvent':
      return EpcisEventType.Aggregation;
    case 'TransactionEvent':
      return EpcisEventType.Transaction;
    case 'TransformationEvent':
      return EpcisEventType.Transformation;
    case 'AssociationEvent':
      return EpcisEventType.Association;
    default:
      return EpcisEventType.Unspecified;
  }
}

/**
 * Opaque 32-byte digest of an EPCIS event's `eventID` string. Returns the zero
 * hash when the event has no eventID. The raw eventID (often a URN/URI) is
 * never placed on-chain; only this SHA-256 digest is.
 */
export function deriveEventIdDigest(event: unknown): string {
  const id =
    event && typeof event === 'object'
      ? (event as Record<string, unknown>).eventID
      : undefined;
  if (typeof id !== 'string' || id.length === 0) {
    return ZERO_BYTES32;
  }
  return '0x' + sha256Hex(EVENT_ID_PREFIX + id);
}

/** One event's on-chain anchoring inputs. */
export interface EventCommitment {
  /** SHA-256 hash of the canonical event (matches hashEpcisEvent). */
  eventHash: string;
  /** Opaque digest of the EPCIS eventID, or zero hash when absent. */
  eventId: string;
  /** Numeric EPCIS event-type code for the on-chain uint8. */
  eventType: EpcisEventType;
}

/** Per-event commitments plus the batch-level linking commitment. */
export interface EventBatchCommitment {
  batchKey: string;
  /** One entry per event, in input order. */
  events: EventCommitment[];
  /** SHA-256 Merkle root linking all events (matches BatchCommitment). */
  merkleRoot: string;
  /** SHA-256 hash of the full dataset. */
  datasetHash: string;
  /** Number of events. */
  eventCount: bigint;
}

/**
 * Derive per-event commitments and the batch-linking root for an EPCIS
 * document. Every event yields an {eventHash, eventId, eventType} record for
 * one-transaction-per-event anchoring; the merkleRoot/datasetHash/eventCount
 * are the same commitments deriveBatchCommitment produces, so the event set
 * and the batch root always agree.
 */
export function deriveEventCommitments(
  epcisDoc: unknown,
  batchKey: string
): EventBatchCommitment {
  if (!/^0x[0-9a-fA-F]{64}$/.test(batchKey)) {
    throw new Error('batchKey must be a 0x-prefixed 32-byte hex string');
  }

  // Reuse the canonical extraction so event ordering matches hashEpcisDocument.
  let events: unknown[];
  if (Array.isArray(epcisDoc)) {
    events = epcisDoc;
  } else if (
    epcisDoc &&
    typeof epcisDoc === 'object' &&
    (epcisDoc as Record<string, unknown>).epcisBody
  ) {
    const body = (epcisDoc as Record<string, unknown>).epcisBody as Record<
      string,
      unknown
    >;
    const list = body.eventList;
    if (!Array.isArray(list)) {
      throw new Error('EPCIS document has no eventList array');
    }
    events = list;
  } else {
    throw new Error(
      'Input must be an EPCIS document with epcisBody.eventList or an event array'
    );
  }

  if (events.length === 0) {
    throw new Error('EPCIS document contains zero events');
  }

  const commitments: EventCommitment[] = events.map((ev) => ({
    eventHash: hashEpcisEvent(ev),
    eventId: deriveEventIdDigest(ev),
    eventType: classifyEpcisEventType(ev),
  }));

  const eventHashes = commitments.map((c) => c.eventHash);

  return {
    batchKey,
    events: commitments,
    merkleRoot: buildMerkleRoot(eventHashes),
    datasetHash: hashDataset(epcisDoc),
    eventCount: BigInt(events.length),
  };
}
