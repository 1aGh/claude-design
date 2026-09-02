// The concurrent-seed convergence law — issue #114 (and #112).
//
// WHAT THIS PINS. When two (or three) peers seed the SAME canvas into the SAME
// empty document at the same instant, every lane must end up holding exactly
// ONE copy of the content. Yjs keeps both of two concurrent inserts at the same
// position — correctly, that is what a CRDT does — so `CONTENT × N` is the
// natural outcome and every lane needs a guard against it. The body lane had
// three; the css lane had none, and shipped `CSS × 3..5` to a real project's
// entire design system.
//
// The law is written LANE-GENERIC on purpose. Per-lane vigilance is precisely
// what failed here: the mitigations existed, they were just attached to `html`
// and nobody attached them to `css`. A table driven by LANES means a new lane
// cannot be added without either passing this or visibly opting out of it.

import { describe, expect, test } from 'bun:test';
import * as Y from 'yjs';

import {
  applyCommentsToDoc,
  applyCssToDoc,
  applyHtmlToDoc,
  commentsFromDoc,
  cssFromDoc,
  htmlFromDoc,
  Y_SYNC_TYPES,
} from '../sync/codec.ts';
import { decideColdStart, decideCssColdStart, unionCommentsById } from '../sync/cold-start.ts';
import { hashBytes } from '../sync/echo-guard.ts';

const BODY = 'export default function Canvas() {\n  return <div>Alligators</div>;\n}\n';
const CSS = ':root { --accent: oklch(70% 0.18 145); }\n.card { padding: 16px; }\n';

/** Merge every doc into every other, as a real hub round-trip eventually does. */
function mergeAll(docs: Y.Doc[]): void {
  for (const a of docs) {
    for (const b of docs) {
      if (a === b) continue;
      Y.applyUpdate(a, Y.encodeStateAsUpdate(b));
    }
  }
}

/** N peers each seed the same content into their own empty replica, then merge. */
function seedConcurrently(n: number, seed: (doc: Y.Doc) => void): Y.Doc[] {
  const docs = Array.from({ length: n }, () => new Y.Doc());
  for (const d of docs) seed(d); // nobody has heard from anybody yet
  mergeAll(docs);
  return docs;
}

describe('concurrent seeding really does duplicate (the premise)', () => {
  // If this ever stops being true the guards below are dead weight — pin the
  // premise so the fix is never "fixed" by a change in Yjs semantics nobody noticed.
  test('two peers seeding one empty body lane produce BODY × 2', () => {
    const [doc] = seedConcurrently(2, (d) => applyHtmlToDoc(d, BODY));
    expect(htmlFromDoc(doc!)).toBe(BODY.repeat(2));
  });

  test('two peers seeding one empty css lane produce CSS × 2', () => {
    const [doc] = seedConcurrently(2, (d) => applyCssToDoc(d, CSS));
    expect(cssFromDoc(doc!)).toBe(CSS.repeat(2));
  });

  test('css doubles even though its codec is a delete-all + insert', () => {
    // The shape that made css WORSE than the body in the field: the "repair"
    // is itself a full insert, so a second concurrent repair re-doubles it.
    const [doc] = seedConcurrently(3, (d) => applyCssToDoc(d, CSS));
    expect(cssFromDoc(doc!)).toBe(CSS.repeat(3));
  });

  test('two peers replacing one comments array keep both pushes', () => {
    const comment = { id: 'c1', text: 'looks good' };
    const [doc] = seedConcurrently(2, (d) => applyCommentsToDoc(d, [comment]));
    expect(commentsFromDoc(doc!)).toEqual([comment, comment]);
  });
});

describe('the cold-start tables collapse it back to one copy — every lane', () => {
  // One row per lane: seed N-way, run that lane's cold-start decision against
  // the local file, apply the verdict, assert a single copy. A lane with no
  // table cannot appear in this list, which is the point.
  const LANES = [
    {
      name: 'html',
      local: BODY,
      seed: (d: Y.Doc) => applyHtmlToDoc(d, BODY),
      read: (d: Y.Doc) => htmlFromDoc(d),
      /** The collapse op alone, no decision table — what every peer runs. */
      repairRaw: (d: Y.Doc, local: string) => applyHtmlToDoc(d, local),
      repair: (d: Y.Doc, local: string) => {
        const decision = decideColdStart({
          localBody: local,
          docBody: htmlFromDoc(d),
          journalHash: null,
          localMtimeMs: null,
          docBodyEditAtMs: null,
        });
        expect(decision.action).toBe('recover-seed-dup');
        applyHtmlToDoc(d, local);
      },
    },
    {
      name: 'css',
      local: CSS,
      seed: (d: Y.Doc) => applyCssToDoc(d, CSS),
      read: (d: Y.Doc) => cssFromDoc(d) ?? '',
      repairRaw: (d: Y.Doc, local: string) => applyCssToDoc(d, local),
      repair: (d: Y.Doc, local: string) => {
        const decision = decideCssColdStart({
          local,
          doc: cssFromDoc(d),
          journalHash: null,
          hash: hashBytes,
          bodyWinner: 'hub',
        });
        expect(decision.recoveredDuplication).toBe(true);
        applyCssToDoc(d, local);
      },
    },
  ] as const;

  for (const lane of LANES) {
    for (const peers of [2, 3, 5]) {
      test(`${lane.name}: ${peers}-way concurrent seed converges to ONE copy`, () => {
        const docs = seedConcurrently(peers, lane.seed);
        const doc = docs[0]!;
        expect(lane.read(doc)).toBe(lane.local.repeat(peers)); // premise
        lane.repair(doc, lane.local);
        expect(lane.read(doc)).toBe(lane.local);

        // And the collapse must PROPAGATE, not just look right locally: it is a
        // delete of CRDT items every peer holds, so merging it out converges.
        mergeAll(docs);
        for (const d of docs) expect(lane.read(d)).toBe(lane.local);
      });
    }
  }

  // THE TEST THAT WAS MISSING, AND THE ONE THAT MATTERS.
  //
  // The first cut of this fix passed every case above and was still broken: it
  // only ever exercised ONE peer repairing, then merged. In the real failure
  // every peer cold-starts and every peer reaches the same verdict, so they all
  // run the collapse concurrently. With a delete-all + insert codec that is not
  // a repair at all — both inserts survive and the lane re-doubles, forever.
  // The collapse only converges because it comes out of the prefix/suffix diff
  // as a PURE DELETE, and deletes of the same items are idempotent.
  for (const lane of LANES) {
    test(`${lane.name}: two peers collapsing the SAME duplication converge (idempotent repair)`, () => {
      const docs = seedConcurrently(2, lane.seed);
      expect(lane.read(docs[0]!)).toBe(lane.local.repeat(2)); // premise

      // Both peers independently decide to collapse — nobody has heard the other.
      for (const d of docs) lane.repairRaw(d, lane.local);
      mergeAll(docs);

      for (const d of docs) expect(lane.read(d)).toBe(lane.local);
    });

    test(`${lane.name}: a third repair round changes nothing (stable fixpoint)`, () => {
      const docs = seedConcurrently(3, lane.seed);
      for (const d of docs) lane.repairRaw(d, lane.local);
      mergeAll(docs);
      for (const d of docs) lane.repairRaw(d, lane.local);
      mergeAll(docs);
      for (const d of docs) expect(lane.read(d)).toBe(lane.local);
    });
  }

  test('comments: an 8× doubled array collapses through the union merge', () => {
    const doc = new Y.Doc();
    const c1 = { id: 'c1', text: 'first' };
    const c2 = { id: 'c2', text: 'second' };
    applyCommentsToDoc(doc, [c1, c2, c1, c2, c1, c2, c1, c2]);
    const merged = unionCommentsById(commentsFromDoc(doc), []);
    applyCommentsToDoc(doc, merged);
    expect(commentsFromDoc(doc)).toEqual([c1, c2]);
  });
});

describe('the repair never eats a genuine edit', () => {
  test('a peer that edited the body diverges instead of being collapsed', () => {
    const [doc] = seedConcurrently(2, (d) => applyHtmlToDoc(d, BODY));
    const edited = `${BODY}// a real second peer's work\n`;
    const decision = decideColdStart({
      localBody: edited,
      docBody: htmlFromDoc(doc!),
      journalHash: null,
      localMtimeMs: null,
      docBodyEditAtMs: null,
    });
    expect(decision.action).not.toBe('recover-seed-dup');
  });

  test('css that merely repeats a PREFIX is not an integer repeat', () => {
    const doc = new Y.Doc();
    applyCssToDoc(doc, `${CSS}${CSS}.extra { color: red; }\n`);
    const decision = decideCssColdStart({
      local: CSS,
      doc: cssFromDoc(doc),
      journalHash: null,
      hash: hashBytes,
      bodyWinner: 'hub',
    });
    expect(decision.recoveredDuplication).toBeUndefined();
  });

  test('a lane the doc genuinely owns alone is left exactly as it is', () => {
    const doc = new Y.Doc();
    applyCssToDoc(doc, CSS);
    expect(doc.getText(Y_SYNC_TYPES.css).toString()).toBe(CSS);
    const decision = decideCssColdStart({
      local: CSS,
      doc: cssFromDoc(doc),
      journalHash: null,
      hash: hashBytes,
      bodyWinner: 'hub',
    });
    expect(decision.winner).toBe('none');
  });
});
