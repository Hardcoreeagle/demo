import { expect } from 'chai';
import { createHash } from 'crypto';
import {
  canonicalize,
  hashEpcisEvent,
  hashEpcisDocument,
  buildMerkleRoot,
  buildMerkleProof,
  verifyMerkleProof,
  hashDataset,
  deriveBatchCommitment,
} from '../src/integrity/IntegrityEngine';

/**
 * Integrity Engine tests: canonicalization determinism, SHA-256 event
 * hashing, Merkle properties (order independence, proofs, tamper detection),
 * dataset hash, and known-answer vectors.
 */
describe('IntegrityEngine', () => {
  const sha = (s: string) => createHash('sha256').update(s).digest('hex');

  // -------------------------------------------------------------------
  // Canonical JSON
  // -------------------------------------------------------------------

  describe('canonicalize (RFC 8785 subset)', () => {
    it('sorts object keys deterministically', () => {
      const a = { b: 1, a: 2, C: 3, 'ü': 4 };
      const b = { 'ü': 4, C: 3, b: 1, a: 2 };
      expect(canonicalize(a)).to.equal(canonicalize(b));
      expect(canonicalize(a)).to.equal('{"C":3,"a":2,"b":1,"ü":4}');
    });

    it('removes whitespace and normalizes numbers', () => {
      expect(canonicalize({ x: 1.0, y: [1, 2.5] })).to.equal('{"x":1,"y":[1,2.5]}');
    });

    it('treats arrays as ordered (no sorting)', () => {
      expect(canonicalize([3, 1, 2])).to.equal('[3,1,2]');
      expect(canonicalize([1, 2, 3])).to.not.equal(canonicalize([3, 2, 1]));
    });

    it('escapes strings per JSON', () => {
      expect(canonicalize('a"b\\c\n')).to.equal('"a\\"b\\\\c\\n"');
    });

    it('rejects non-finite numbers', () => {
      expect(() => canonicalize({ x: NaN })).to.throw();
      expect(() => canonicalize({ x: Infinity })).to.throw();
    });
  });

  // -------------------------------------------------------------------
  // Event hashing
  // -------------------------------------------------------------------

  describe('hashEpcisEvent', () => {
    const event = {
      type: 'TransformationEvent',
      eventID: 'urn:uuid:test-1',
      eventTime: '2010-02-01T00:00:00Z',
    };

    it('produces a stable 0x 32-byte hash', () => {
      const h = hashEpcisEvent(event);
      expect(h).to.match(/^0x[0-9a-f]{64}$/);
      expect(h).to.equal(hashEpcisEvent({ ...event }));
    });

    it('is order-independent over object keys', () => {
      expect(hashEpcisEvent({ type: 'X', eventID: 'y' })).to.equal(
        hashEpcisEvent({ eventID: 'y', type: 'X' })
      );
    });

    it('differs for different events', () => {
      expect(hashEpcisEvent(event)).to.not.equal(
        hashEpcisEvent({ ...event, eventID: 'other' })
      );
    });

    it('is domain-separated from raw SHA-256 of the JSON', () => {
      const raw = sha(JSON.stringify(event));
      expect(hashEpcisEvent(event)).to.not.equal('0x' + raw);
    });

    it('known-answer vector', () => {
      // sha256("EPCIS_EVENT_V1:" + '{"a":1}') - pins the algorithm version
      const expected = '0x' + sha('EPCIS_EVENT_V1:' + '{"a":1}');
      expect(hashEpcisEvent({ a: 1 })).to.equal(expected);
    });
  });

  // -------------------------------------------------------------------
  // Document hashing
  // -------------------------------------------------------------------

  describe('hashEpcisDocument', () => {
    const makeDoc = (n: number) => ({
      '@context': ['https://ref.gs1.org/epcis/epcis-context.jsonld'],
      type: 'EPCISDocument',
      schemaVersion: '2.0',
      epcisBody: {
        eventList: Array.from({ length: n }, (_, i) => ({
          type: 'ObjectEvent',
          eventID: `urn:uuid:e-${i}`,
        })),
      },
    });

    it('hashes all events of a GS1-produced document', () => {
      const { eventHashes, eventCount } = hashEpcisDocument(makeDoc(3));
      expect(eventCount).to.equal(3);
      expect(eventHashes).to.have.length(3);
      expect(new Set(eventHashes).size).to.equal(3); // all distinct
    });

    it('accepts a bare event array', () => {
      const { eventCount } = hashEpcisDocument([{ type: 'X' }, { type: 'Y' }]);
      expect(eventCount).to.equal(2);
    });

    it('rejects empty and malformed input', () => {
      expect(() => hashEpcisDocument({ epcisBody: { eventList: [] } })).to.throw();
      expect(() => hashEpcisDocument({ foo: 1 })).to.throw();
    });
  });

  // -------------------------------------------------------------------
  // Merkle tree
  // -------------------------------------------------------------------

  describe('buildMerkleRoot', () => {
    it('order-independent: shuffled input gives identical root', () => {
      const events = Array.from({ length: 9 }, (_, i) => hashEpcisEvent({ i }));
      const root1 = buildMerkleRoot(events);
      const shuffled = [...events].sort(() => Math.random() - 0.5);
      const root2 = buildMerkleRoot(shuffled);
      expect(root1).to.equal(root2);
    });

    it('single event: root equals domain-separated leaf hash', () => {
      const h = hashEpcisEvent({ a: 1 });
      const expected =
        '0x' +
        createHash('sha256')
          .update(
            Buffer.concat([
              Buffer.from('EPCIS_LEAF_V1:'),
              Buffer.from(h.slice(2), 'hex'),
            ])
          )
          .digest('hex');
      expect(buildMerkleRoot([h])).to.equal(expected);
    });

    it('changes when any event changes (tamper detection)', () => {
      const events = Array.from({ length: 7 }, (_, i) => hashEpcisEvent({ i }));
      const root = buildMerkleRoot(events);
      const tampered = [...events];
      tampered[3] = hashEpcisEvent({ evil: true });
      expect(buildMerkleRoot(tampered)).to.not.equal(root);
    });

    it('handles power-of-two and non-power-of-two sizes', () => {
      for (const n of [1, 2, 3, 4, 5, 7, 8, 15, 16, 17]) {
        const events = Array.from({ length: n }, (_, i) => hashEpcisEvent({ n, i }));
        expect(buildMerkleRoot(events)).to.match(/^0x[0-9a-f]{64}$/);
      }
    });

    it('rejects empty input', () => {
      expect(() => buildMerkleRoot([])).to.throw();
    });
  });

  // -------------------------------------------------------------------
  // Merkle proofs
  // -------------------------------------------------------------------

  describe('Merkle proofs', () => {
    const sizes = [1, 2, 3, 5, 8, 13];
    const makeEvents = (n: number) =>
      Array.from({ length: n }, (_, i) => hashEpcisEvent({ size: n, i }));

    for (const n of sizes) {
      it(`proves inclusion of every event in a ${n}-leaf tree`, () => {
        const events = makeEvents(n);
        const root = buildMerkleRoot(events);
        for (const h of events) {
          const proof = buildMerkleProof(events, h);
          expect(verifyMerkleProof(h, proof, root)).to.equal(true);
        }
      });
    }

    it('rejects proofs for events not in the tree', () => {
      const events = makeEvents(4);
      expect(() => buildMerkleProof(events, hashEpcisEvent({ unknown: true }))).to.throw();
    });

    it('verifies false against a different root', () => {
      const eventsA = makeEvents(4);
      const eventsB = makeEvents(5);
      const rootB = buildMerkleRoot(eventsB);
      const proof = buildMerkleProof(eventsA, eventsA[0]);
      expect(verifyMerkleProof(eventsA[0], proof, rootB)).to.equal(false);
    });

    it('tampered leaf fails verification', () => {
      const events = makeEvents(6);
      const root = buildMerkleRoot(events);
      const proof = buildMerkleProof(events, events[2]);
      expect(verifyMerkleProof(hashEpcisEvent({ forged: 1 }), proof, root)).to.equal(false);
    });
  });

  // -------------------------------------------------------------------
  // Dataset hash
  // -------------------------------------------------------------------

  describe('hashDataset', () => {
    it('covers the whole document, including non-event fields', () => {
      const doc = { a: 1, epcisBody: { eventList: [{ type: 'X' }] } };
      const doc2 = { epcisBody: { eventList: [{ type: 'X' }] }, a: 1 };
      expect(hashDataset(doc)).to.equal(hashDataset(doc2)); // key order
      expect(hashDataset({ ...doc, extra: true })).to.not.equal(hashDataset(doc));
    });

    it('known-answer vector', () => {
      const expected = '0x' + sha('EPCIS_DATASET_V1:' + '{"x":1}');
      expect(hashDataset({ x: 1 })).to.equal(expected);
    });
  });

  // -------------------------------------------------------------------
  // Batch commitment
  // -------------------------------------------------------------------

  describe('deriveBatchCommitment', () => {
    const PF05043_KEY =
      '0x' + sha('PF05043'); // upstream decides the exact derivation

    it('produces a complete, consistent commitment', () => {
      const doc = {
        epcisBody: {
          eventList: [
            { type: 'TransformationEvent', eventID: 't1' },
            { type: 'ObjectEvent', eventID: 'o1' },
            { type: 'ObjectEvent', eventID: 'o2' },
          ],
        },
      };
      const c = deriveBatchCommitment(doc, PF05043_KEY);
      expect(c.batchKey).to.equal(PF05043_KEY);
      expect(c.eventCount).to.equal(3n);
      expect(c.eventHashes).to.have.length(3);
      // Root is reproducible from the event hashes alone.
      expect(buildMerkleRoot(c.eventHashes)).to.equal(c.merkleRoot);
    });

    it('rejects malformed batch keys', () => {
      expect(() => deriveBatchCommitment({ epcisBody: { eventList: [{ type: 'X' }] } }, 'PF05043')).to.throw();
      expect(() => deriveBatchCommitment({ epcisBody: { eventList: [{ type: 'X' }] } }, '0x1234')).to.throw();
    });
  });
});
