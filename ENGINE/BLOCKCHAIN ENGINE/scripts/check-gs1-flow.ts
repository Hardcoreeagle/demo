import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, relative, resolve, sep } from 'path';
import {
  loadPf05043Epcis,
  mergeEpcisDocuments,
  sha256BatchKey,
} from '../src/integrity/gs1Epcis';

/**
 * ENGINE_ROOT is the directory that contains both "GS1 ENGINE" and
 * "BLOCKCHAIN ENGINE". This script lives in BLOCKCHAIN ENGINE/scripts, so the
 * root is two levels up. Reports store paths RELATIVE to this root so they are
 * portable across machines, usernames, and install locations.
 */
const ENGINE_ROOT = resolve(__dirname, '..', '..');

/**
 * Convert an absolute path into a portable, forward-slash, ENGINE_ROOT-relative
 * path (e.g. "GS1 ENGINE/output/epcis_pf05043"). Never emits a drive letter or
 * user directory. Falls back to a relative path from cwd if the input somehow
 * sits outside ENGINE_ROOT.
 */
function toPortablePath(absPath: string): string {
  const rel = relative(ENGINE_ROOT, absPath);
  const normalized = rel.startsWith('..') ? relative(process.cwd(), absPath) : rel;
  return normalized.split(sep).join('/');
}
import {
  deriveBatchCommitment,
  buildMerkleProof,
  verifyMerkleProof,
  hashEpcisEvent,
} from '../src/integrity/IntegrityEngine';

/**
 * GS1 → Integrity flow check.
 * Prints the report and auto-saves it under deployments/ for audit reuse.
 *
 * Does NOT put EPCIS JSON on-chain. Saves off-chain operational metadata only.
 */
async function main(): Promise<void> {
  const loaded = loadPf05043Epcis();
  const prod = loaded.production;
  const events = prod.epcisBody.eventList as Array<Record<string, unknown>>;
  const batchId = process.env.BATCH_ID?.trim() || 'PF05043';
  const key = sha256BatchKey(batchId);
  const c1 = deriveBatchCommitment(prod, key);
  const merged = loaded.quality
    ? mergeEpcisDocuments([prod, loaded.quality])
    : prod;
  const c2 = deriveBatchCommitment(merged, key);
  const proofOk = verifyMerkleProof(
    c1.eventHashes[0],
    buildMerkleProof(c1.eventHashes, c1.eventHashes[0]),
    c1.merkleRoot
  );

  const contract = resolveContractAddress();
  let testnetHasCode = false;
  if (contract) {
    const acc = await fetch(
      `https://testnet.vechain.org/accounts/${contract}`
    ).then((r) => r.json() as Promise<{ hasCode?: boolean; code?: string }>);
    testnetHasCode = Boolean(acc.hasCode || (acc.code && acc.code !== '0x'));
  }

  const report = {
    generatedAt: new Date().toISOString(),
    gs1DoesNotCallBlockchain: true,
    coupling: 'JSON files on disk',
    gs1OutputDir: toPortablePath(loaded.outputDir),
    productionPath: toPortablePath(
      join(loaded.outputDir, 'production', 'epcis-production.json')
    ),
    fileExists: existsSync(
      join(loaded.outputDir, 'production', 'epcis-production.json')
    ),
    epcisType: prod.type,
    schemaVersion: prod.schemaVersion,
    batchId,
    productionEvents: events.map((e) => ({
      type: e.type,
      eventID: e.eventID,
      transformationID: e.transformationID,
    })),
    whatLeavesGs1: 'full EPCIS JSON (events, quantities, locations)',
    whatEntersChain: {
      batchKey: key,
      merkleRoot: c1.merkleRoot,
      datasetHash: c1.datasetHash,
      eventCount: c1.eventCount.toString(),
      epcisJsonOnChain: false,
    },
    perEventSha256: events.map((e) => ({
      eventID: e.eventID,
      eventHash: hashEpcisEvent(e),
    })),
    v2EventCount: c2.eventCount.toString(),
    v2MerkleRoot: c2.merkleRoot,
    v2RootDiffers: c2.merkleRoot !== c1.merkleRoot,
    merkleProofOk: proofOk,
    testnetContract: contract,
    testnetHasCode,
  };

  const outDir = join('deployments', 'integrity-reports');
  mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outFile = join(outDir, `${batchId}-${stamp}.json`);
  const latestFile = join(outDir, `${batchId}-latest.json`);
  const body = JSON.stringify(report, null, 2);
  writeFileSync(outFile, body);
  writeFileSync(latestFile, body);

  process.stdout.write(body + '\n');
  process.stderr.write(`\nSaved integrity metadata:\n  ${outFile}\n  ${latestFile}\n`);
}

function resolveContractAddress(): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('dotenv').config();
  } catch {
    /* optional */
  }
  const fromEnv =
    process.env.BATCH_INTEGRITY_ANCHOR_ADDRESS?.trim() ||
    process.env.ANCHOR_CONTRACT_ADDRESS?.trim();
  if (fromEnv && /^0x[0-9a-fA-F]{40}$/.test(fromEnv)) return fromEnv;

  const file = join('deployments', 'vechain_testnet.json');
  if (!existsSync(file)) return null;
  const json = JSON.parse(readFileSync(file, 'utf8')) as {
    contractAddress?: string;
  };
  return json.contractAddress && /^0x[0-9a-fA-F]{40}$/.test(json.contractAddress)
    ? json.contractAddress
    : null;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
