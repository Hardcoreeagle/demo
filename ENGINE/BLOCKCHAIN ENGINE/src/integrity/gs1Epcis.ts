/**
 * Load real GS1 Engine EPCIS 2.0.1 documents from the sibling GS1 ENGINE
 * output tree. Blockchain Engine must not generate EPCIS itself.
 */

import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import { createHash } from 'crypto';

export interface Gs1EpcisDocument {
  type?: string;
  schemaVersion?: string;
  epcisBody: { eventList: unknown[] };
  [key: string]: unknown;
}

const ENGINE_ROOT = resolve(__dirname, '../../..');

const OUTPUT_CANDIDATES = [
  join(ENGINE_ROOT, 'GS1 ENGINE', 'output', 'epcis_pf05043'),
  join(ENGINE_ROOT, 'GS1 ENGINE', 'output', 'epcis'),
];

export function sha256BatchKey(batchId: string): string {
  return '0x' + createHash('sha256').update(batchId, 'utf8').digest('hex');
}

export function loadGs1EpcisFile(filePath: string): Gs1EpcisDocument {
  if (!existsSync(filePath)) {
    throw new Error(`GS1 EPCIS file not found: ${filePath}`);
  }
  const doc = JSON.parse(readFileSync(filePath, 'utf8')) as Gs1EpcisDocument;
  if (!doc?.epcisBody || !Array.isArray(doc.epcisBody.eventList)) {
    throw new Error(`Not an EPCIS document with epcisBody.eventList: ${filePath}`);
  }
  return doc;
}

export function resolveGs1OutputDir(): string {
  const found = OUTPUT_CANDIDATES.find((dir) =>
    existsSync(join(dir, 'production', 'epcis-production.json'))
  );
  if (!found) {
    throw new Error(
      `GS1 EPCIS output not found. Looked in:\n${OUTPUT_CANDIDATES.join('\n')}`
    );
  }
  return found;
}

export function loadPf05043Epcis(): {
  outputDir: string;
  production: Gs1EpcisDocument;
  quality: Gs1EpcisDocument | null;
} {
  const outputDir = resolveGs1OutputDir();
  const production = loadGs1EpcisFile(
    join(outputDir, 'production', 'epcis-production.json')
  );
  const qualityPath = join(outputDir, 'quality', 'epcis-quality.json');
  const quality = existsSync(qualityPath) ? loadGs1EpcisFile(qualityPath) : null;
  return { outputDir, production, quality };
}

/** Combine EPCIS event lists into one document for a later dataset version. */
export function mergeEpcisDocuments(
  documents: Gs1EpcisDocument[]
): Gs1EpcisDocument {
  if (documents.length === 0) {
    throw new Error('mergeEpcisDocuments requires at least one document');
  }
  const eventList = documents.flatMap((d) => d.epcisBody.eventList);
  return {
    ...documents[0],
    epcisBody: {
      ...documents[0].epcisBody,
      eventList,
    },
  };
}
