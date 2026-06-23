// Cold-start decision matrix — hub-sync cold-start safety (DDR-102).
//
// Exhaustive table over (local: absent/empty/clean/diverged) × (doc:
// empty/same/different) × (journal: absent/match/stale), plus both winner
// directions and the null-timestamp fallbacks. Mirrors the table style of
// sync-codec.test.ts: every case is a row with explicit inputs + expected
// action.

import { describe, expect, test } from 'bun:test';

import { type ColdStartInput, decideColdStart, isExactRepeat } from '../sync/cold-start.ts';
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
