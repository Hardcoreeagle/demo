/**
 * Off-chain vs on-chain integrity comparison.
 * Recalculated SHA-256 Merkle / dataset hashes must equal the anchored
 * opaque commitments. The contract never recomputes SHA-256.
 */

import type { IntegrityAnchor } from '../vechain/BatchIntegrityAnchorClient';

export interface IntegrityVerification {
  batchKey: string;
  version: bigint;
  calculatedMerkleRoot: string;
  anchoredMerkleRoot: string;
  calculatedDatasetHash: string;
  anchoredDatasetHash: string;
  calculatedEventCount: bigint;
  anchoredEventCount: bigint;
  integrityValid: boolean;
}

const eq32 = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();

export function verifyIntegrity(input: {
  batchKey: string;
  calculatedMerkleRoot: string;
  calculatedDatasetHash: string;
  calculatedEventCount: bigint;
  anchored: IntegrityAnchor;
}): IntegrityVerification {
  const integrityValid =
    eq32(input.calculatedMerkleRoot, input.anchored.merkleRoot) &&
    eq32(input.calculatedDatasetHash, input.anchored.datasetHash) &&
    input.calculatedEventCount === input.anchored.eventCount;

  return {
    batchKey: input.batchKey,
    version: input.anchored.version,
    calculatedMerkleRoot: input.calculatedMerkleRoot,
    anchoredMerkleRoot: input.anchored.merkleRoot,
    calculatedDatasetHash: input.calculatedDatasetHash,
    anchoredDatasetHash: input.anchored.datasetHash,
    calculatedEventCount: input.calculatedEventCount,
    anchoredEventCount: input.anchored.eventCount,
    integrityValid,
  };
}
