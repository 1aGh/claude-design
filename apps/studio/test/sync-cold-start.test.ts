// Cold-start decision matrix — hub-sync cold-start safety (DDR-102).
//
// Exhaustive table over (local: absent/empty/clean/diverged) × (doc:
// empty/same/different) × (journal: absent/match/stale), plus both winner
// directions and the null-timestamp fallbacks. Mirrors the table style of
// sync-codec.test.ts: every case is a row with explicit inputs + expected
// action.

import { describe, expect, test } from 'bun:test';

import {
  type ColdStartInput,
  type CssColdStartInput,
  decideColdStart,
  decideCssColdStart,
  isExactRepeat,
  unionCommentsById,
} from '../sync/cold-start.ts';
import { hashBytes } from '../sync/echo-guard.ts';

const BODY_LOCAL = '<div>local work — a day of mascot edits</div>';
const BODY_HUB = '<div>hub state</div>';

/** Convenience: build an input with safe defaults, override per case. */
function input(over: Partial<ColdStartInput>): ColdStartInput {
  return {
    localBody: null,
    docBody: '',
    journalHash: null,
    localMtimeMs: null,
    docBodyEditAtMs: null,
    ...over,
  };
}

describe('decideColdStart — empty/absent sides', () => {
  test('local absent + doc empty → noop', () => {
    expect(decideColdStart(input({})).action).toBe('noop');
  });

  test('local empty-string + doc empty → noop', () => {
    expect(decideColdStart(input({ localBody: '' })).action).toBe('noop');
  });

  test('whitespace-only local counts as empty (mirrors the trim guard)', () => {
    const d = decideColdStart(input({ localBody: '  \n\t ', docBody: BODY_HUB }));
    expect(d.action).toBe('materialize-hub');
  });

  test('local absent + doc non-empty → materialize-hub (clean first sync)', () => {
    const d = decideColdStart(input({ docBody: BODY_HUB }));
    expect(d.action).toBe('materialize-hub');
  });

  test('local empty + doc non-empty → materialize-hub', () => {
    const d = decideColdStart(input({ localBody: '', docBody: BODY_HUB }));
    expect(d.action).toBe('materialize-hub');
  });

  test('local non-empty + doc empty → seed-local-up (DDR-064 guard as a named case)', () => {
    const d = decideColdStart(input({ localBody: BODY_LOCAL, docBody: '' }));
    expect(d.action).toBe('seed-local-up');
  });

  test('local non-empty + whitespace-only doc → seed-local-up', () => {
    const d = decideColdStart(input({ localBody: BODY_LOCAL, docBody: ' \n ' }));
    expect(d.action).toBe('seed-local-up');
  });

  test('seed-local-up holds regardless of journal state (stale journal must not block it)', () => {
    const d = decideColdStart(
      input({ localBody: BODY_LOCAL, docBody: '', journalHash: 'stale-hash' })
    );
    expect(d.action).toBe('seed-local-up');
  });
});

describe('decideColdStart — identical sides', () => {
  test('local == doc → noop (caller records journal)', () => {
    const d = decideColdStart(input({ localBody: BODY_HUB, docBody: BODY_HUB }));
    expect(d.action).toBe('noop');
  });

  test('local == doc with a stale journal is still a noop (content equality wins)', () => {
    const d = decideColdStart(
      input({ localBody: BODY_HUB, docBody: BODY_HUB, journalHash: 'stale' })
    );
    expect(d.action).toBe('noop');
  });
});

describe('decideColdStart — concurrent cold-seed duplication (F1)', () => {
  const BODY = '<div>export default fn — one copy</div>';

  test('doc == local repeated twice → recover-seed-dup (collapse, not conflict)', () => {
    const d = decideColdStart(input({ localBody: BODY, docBody: BODY + BODY }));
    expect(d.action).toBe('recover-seed-dup');
  });

  test('doc == local repeated three times (3-way seed) → recover-seed-dup', () => {
    const d = decideColdStart(input({ localBody: BODY, docBody: BODY.repeat(3) }));
    expect(d.action).toBe('recover-seed-dup');
  });

  test('duplication recovery beats the conflict path even with divergent timestamps', () => {
    // A doubled body is NOT new content — newest-wins must not get to pick it.
    const d = decideColdStart(
      input({
        localBody: BODY,
        docBody: BODY + BODY,
        localMtimeMs: 1_000,
        docBodyEditAtMs: 9_999,
      })
    );
    expect(d.action).toBe('recover-seed-dup');
  });

  test('duplication recovery fires even with a stale journal', () => {
    const d = decideColdStart(
      input({ localBody: BODY, docBody: BODY + BODY, journalHash: 'stale' })
    );
    expect(d.action).toBe('recover-seed-dup');
  });

  test('doc = local + genuinely different bytes is NOT a repeat → conflict (snapshots both)', () => {
    const d = decideColdStart(
      input({
        localBody: BODY,
        docBody: `${BODY}<div>a real concurrent edit</div>`,
        localMtimeMs: 2_000,
        docBodyEditAtMs: 1_000,
      })
    );
    expect(d.action).toBe('conflict');
  });

  test('exact equality (×1) stays a noop, never recover-seed-dup', () => {
    expect(decideColdStart(input({ localBody: BODY, docBody: BODY })).action).toBe('noop');
  });

  test('isExactRepeat — exact multiples only', () => {
    expect(isExactRepeat(BODY + BODY, BODY)).toBe(true);
    expect(isExactRepeat(BODY.repeat(4), BODY)).toBe(true);
    expect(isExactRepeat(BODY, BODY)).toBe(false); // ×1 is equality, not duplication
    expect(isExactRepeat(`${BODY}x`, BODY)).toBe(false); // not a clean multiple
    expect(isExactRepeat(`${BODY}${BODY}x`, BODY)).toBe(false);
    expect(isExactRepeat('', BODY)).toBe(false);
    expect(isExactRepeat(BODY, '')).toBe(false);
  });
});

describe('decideColdStart — journal-gated fast-forward', () => {
  test('local ≠ doc, journal matches hash(local) → fast-forward-hub (no conflict)', () => {
    const d = decideColdStart(
      input({
        localBody: BODY_LOCAL,
        docBody: BODY_HUB,
        journalHash: hashBytes(BODY_LOCAL),
      })
    );
    expect(d.action).toBe('fast-forward-hub');
    expect(d.winner).toBeUndefined();
  });

  test('journal match overrides timestamps — even a NEWER local mtime fast-forwards', () => {
    // mtime newer than the doc stamp, but the bytes are exactly what we last
    // synced (e.g. touch / checkout changed mtime only) → not a conflict.
    const d = decideColdStart(
      input({
        localBody: BODY_LOCAL,
        docBody: BODY_HUB,
        journalHash: hashBytes(BODY_LOCAL),
        localMtimeMs: 2_000,
        docBodyEditAtMs: 1_000,
      })
    );
    expect(d.action).toBe('fast-forward-hub');
  });
});

describe('decideColdStart — divergence (conflict + newest-wins)', () => {
  test('journal ABSENT, local newer → conflict, winner=local (the incident shape)', () => {
    const d = decideColdStart(
      input({
        localBody: BODY_LOCAL,
        docBody: BODY_HUB,
        localMtimeMs: 2_000,
        docBodyEditAtMs: 1_000,
      })
    );
    expect(d.action).toBe('conflict');
    expect(d.winner).toBe('local');
  });

  test('journal ABSENT, doc newer → conflict, winner=hub', () => {
    const d = decideColdStart(
      input({
        localBody: BODY_LOCAL,
        docBody: BODY_HUB,
        localMtimeMs: 1_000,
        docBodyEditAtMs: 2_000,
      })
    );
    expect(d.action).toBe('conflict');
    expect(d.winner).toBe('hub');
  });

  test('journal STALE (≠ hash(local)), local newer → conflict, winner=local', () => {
    const d = decideColdStart(
      input({
        localBody: BODY_LOCAL,
        docBody: BODY_HUB,
        journalHash: hashBytes('<div>some older synced state</div>'),
        localMtimeMs: 5_000,
        docBodyEditAtMs: 4_000,
      })
    );
    expect(d.action).toBe('conflict');
    expect(d.winner).toBe('local');
  });

  test('journal STALE, doc newer → conflict, winner=hub', () => {
    const d = decideColdStart(
      input({
        localBody: BODY_LOCAL,
        docBody: BODY_HUB,
        journalHash: hashBytes('<div>some older synced state</div>'),
        localMtimeMs: 4_000,
        docBodyEditAtMs: 5_000,
      })
    );
    expect(d.action).toBe('conflict');
    expect(d.winner).toBe('hub');
  });

  test('journal matching hash(DOC) — not local — is still divergence', () => {
    // The journal proves we once synced what the HUB now holds reverted to;
    // local moved past it → local is unreconciled work, must conflict.
    const d = decideColdStart(
      input({
        localBody: BODY_LOCAL,
        docBody: BODY_HUB,
        journalHash: hashBytes(BODY_HUB),
        localMtimeMs: 2_000,
        docBodyEditAtMs: 1_000,
      })
    );
    expect(d.action).toBe('conflict');
    expect(d.winner).toBe('local');
  });

  test('doc stamp NULL (older peer never stamped) → hub-wins fallback', () => {
    const d = decideColdStart(
      input({
        localBody: BODY_LOCAL,
        docBody: BODY_HUB,
        localMtimeMs: 2_000,
        docBodyEditAtMs: null,
      })
    );
    expect(d.action).toBe('conflict');
    expect(d.winner).toBe('hub');
  });

  test('local mtime NULL → hub-wins fallback', () => {
    const d = decideColdStart(
      input({
        localBody: BODY_LOCAL,
        docBody: BODY_HUB,
        localMtimeMs: null,
        docBodyEditAtMs: 2_000,
      })
    );
    expect(d.action).toBe('conflict');
    expect(d.winner).toBe('hub');
  });

  test('both timestamps NULL → hub-wins fallback', () => {
    const d = decideColdStart(input({ localBody: BODY_LOCAL, docBody: BODY_HUB }));
    expect(d.action).toBe('conflict');
    expect(d.winner).toBe('hub');
  });

  test('timestamps TIED → hub-wins fallback', () => {
    const d = decideColdStart(
      input({
        localBody: BODY_LOCAL,
        docBody: BODY_HUB,
        localMtimeMs: 1_000,
        docBodyEditAtMs: 1_000,
      })
    );
    expect(d.action).toBe('conflict');
    expect(d.winner).toBe('hub');
  });

  test('every decision carries a human-readable reason', () => {
    const cases: ColdStartInput[] = [
      input({}),
      input({ docBody: BODY_HUB }),
      input({ localBody: BODY_LOCAL }),
      input({ localBody: BODY_HUB, docBody: BODY_HUB }),
      input({ localBody: BODY_LOCAL, docBody: BODY_HUB, journalHash: hashBytes(BODY_LOCAL) }),
      input({ localBody: BODY_LOCAL, docBody: BODY_HUB }),
    ];
    for (const c of cases) {
      const d = decideColdStart(c);
      expect(d.reason.length).toBeGreaterThan(0);
    }
  });
});

/* ------------------------------------------------------------------ css */
//
// Issue #114 — the css lane had NO cold-start table and no duplication guard,
// which made it the only Plane-A lane that never survived a multi-peer cold
// start intact (measured on the reporting machine: 0 of 43 css lanes clean,
// against 21 of 84 bodies).

const CSS_LOCAL = ':root { --accent: oklch(70% 0.18 145); }\n.card { padding: 16px; }\n';
const CSS_HUB = ':root { --accent: oklch(52% 0.2 28); }\n';

function cssInput(over: Partial<CssColdStartInput>): CssColdStartInput {
  return {
    local: null,
    doc: null,
    journalHash: null,
    hash: hashBytes,
    bodyWinner: 'hub',
    ...over,
  };
}

describe('decideCssColdStart — empty/absent sides', () => {
  test('both empty → none', () => {
    expect(decideCssColdStart(cssInput({})).winner).toBe('none');
  });

  test('empty-string doc counts as empty, not as content', () => {
    expect(decideCssColdStart(cssInput({ local: CSS_LOCAL, doc: '' })).winner).toBe('local');
  });

  test('no local css → hub materializes', () => {
    expect(decideCssColdStart(cssInput({ doc: CSS_HUB })).winner).toBe('hub');
  });

  test('empty hub lane never beats local content, even when the body went hub (DDR-064)', () => {
    // The row that also closes a quieter bug: a local `.css` next to a
    // hub-winning body used to travel nowhere at all.
    expect(decideCssColdStart(cssInput({ local: CSS_LOCAL, bodyWinner: 'hub' })).winner).toBe(
      'local'
    );
  });
});

describe('decideCssColdStart — duplication recovery (the #114 row)', () => {
  test('doc == local repeated twice → local wins, flagged as a recovery', () => {
    const d = decideCssColdStart(cssInput({ local: CSS_LOCAL, doc: CSS_LOCAL.repeat(2) }));
    expect(d.winner).toBe('local');
    expect(d.recoveredDuplication).toBe(true);
  });

  test('3-, 4- and 5-way seed collisions all collapse (every shape seen in the field)', () => {
    for (const n of [3, 4, 5]) {
      const d = decideCssColdStart(cssInput({ local: CSS_LOCAL, doc: CSS_LOCAL.repeat(n) }));
      expect(d.winner).toBe('local');
      expect(d.recoveredDuplication).toBe(true);
    }
  });

  test('the recovery is checked BEFORE the journal fast-forward', () => {
    // With a matching journal hash the fast-forward row would hand this to the
    // hub — i.e. KEEP the doubled lane and write it to disk. Row order is the fix.
    const d = decideCssColdStart(
      cssInput({ local: CSS_LOCAL, doc: CSS_LOCAL.repeat(2), journalHash: hashBytes(CSS_LOCAL) })
    );
    expect(d.winner).toBe('local');
    expect(d.recoveredDuplication).toBe(true);
  });

  test('a genuine hub edit is NEVER mistaken for a duplication', () => {
    const d = decideCssColdStart(cssInput({ local: CSS_LOCAL, doc: CSS_HUB, bodyWinner: 'hub' }));
    expect(d.winner).toBe('hub');
    expect(d.recoveredDuplication).toBeUndefined();
  });

  test('a doc that merely CONTAINS local is not an exact repeat', () => {
    const d = decideCssColdStart(
      cssInput({ local: CSS_LOCAL, doc: `${CSS_LOCAL}${CSS_HUB}`, bodyWinner: 'hub' })
    );
    expect(d.recoveredDuplication).toBeUndefined();
  });
});

describe('decideCssColdStart — journal + divergence', () => {
  test('identical sides → none', () => {
    expect(decideCssColdStart(cssInput({ local: CSS_LOCAL, doc: CSS_LOCAL })).winner).toBe('none');
  });

  test('local matches the journal checkpoint → hub is ahead, fast-forward', () => {
    // The `cssHash` the journal has been writing since DDR-102 and never reading.
    const d = decideCssColdStart(
      cssInput({ local: CSS_LOCAL, doc: CSS_HUB, journalHash: hashBytes(CSS_LOCAL) })
    );
    expect(d.winner).toBe('hub');
  });

  test('stale journal + divergence → follows the body winner, both directions', () => {
    for (const bodyWinner of ['local', 'hub'] as const) {
      const d = decideCssColdStart(
        cssInput({
          local: CSS_LOCAL,
          doc: CSS_HUB,
          journalHash: hashBytes('something else'),
          bodyWinner,
        })
      );
      expect(d.winner).toBe(bodyWinner);
    }
  });

  test('every decision carries a human-readable reason', () => {
    const cases: CssColdStartInput[] = [
      cssInput({}),
      cssInput({ doc: CSS_HUB }),
      cssInput({ local: CSS_LOCAL }),
      cssInput({ local: CSS_LOCAL, doc: CSS_LOCAL }),
      cssInput({ local: CSS_LOCAL, doc: CSS_LOCAL.repeat(2) }),
      cssInput({ local: CSS_LOCAL, doc: CSS_HUB, journalHash: hashBytes(CSS_LOCAL) }),
      cssInput({ local: CSS_LOCAL, doc: CSS_HUB }),
    ];
    for (const c of cases) expect(decideCssColdStart(c).reason.length).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------- comments union */
//
// Issue #112 — `out` was seeded as `[...docList]`, so the union filtered the
// LOCAL side only. A doc array that had already been concurrency-doubled
// carried every copy forward and re-published it as truth: 2 → 4 → 8.

describe('unionCommentsById — the doc is deduped against itself', () => {
  const c1 = { id: 'c1', text: 'first' };
  const c2 = { id: 'c2', text: 'second' };

  test('an already-duplicated doc list collapses to one entry per id', () => {
    const doubled = [c1, c2, c1, c2, c1, c2, c1, c2]; // the reported ×8 shape
    expect(unionCommentsById(doubled, [])).toEqual([c1, c2]);
  });

  test('local-only comments still survive the merge', () => {
    const local = [{ id: 'c3', text: 'local only' }];
    expect(unionCommentsById([c1, c1], local)).toEqual([c1, local[0]]);
  });

  test('same-id entries still keep the DOC version, not local', () => {
    expect(unionCommentsById([c1], [{ id: 'c1', text: 'local edit' }])).toEqual([c1]);
  });

  test('id-less entries dedupe by JSON identity, on the doc side too', () => {
    const anon = { text: 'no id' };
    expect(unionCommentsById([anon, anon], [anon])).toEqual([anon]);
  });

  test('doc order is preserved', () => {
    expect(unionCommentsById([c2, c1, c2], [])).toEqual([c2, c1]);
  });
});
