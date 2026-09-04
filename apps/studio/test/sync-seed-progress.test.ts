// The denominator, and the honesty rules around it.
//
// The reported failure: `_sync.json` read `files: {synced: 0, pushed: 0,
// pulled: 0}` for twenty minutes while 2 961 ledger rows changed underneath
// it, because the counters were derived from PER-PASS results and a pass that
// converges nothing is legitimately all zeros. And even correct counters had
// no denominator, so no surface could say "1 412 of 2 961".

import { describe, expect, it } from 'bun:test';

import type { LedgerRow } from '../sync/file-ledger.ts';
import { computeSeedProgress, type SeedProgress } from '../sync/seed-progress.ts';

const NOW = 1_700_000_000_000;

function rows(spec: Array<Partial<LedgerRow> & { rel?: string }>): Record<string, LedgerRow> {
  const out: Record<string, LedgerRow> = {};
  spec.forEach((r, i) => {
    out[r.rel ?? `f${i}.png`] = { syncedHash: null, size: 1024, ...r } as LedgerRow;
  });
  return out;
}

describe('computeSeedProgress', () => {
  it('reports a denominator, which is the whole point', () => {
    const p = computeSeedProgress({
      rows: rows([
        { state: 'on-hub' },
        { state: 'on-hub' },
        { state: 'local-only' },
        { state: 'pushing' },
      ]),
      now: NOW,
    });
    expect(p.tracked).toBe(4);
    expect(p.delivered).toBe(2);
    expect(p.remaining).toBe(2);
    expect(p.phase).toBe('seeding');
  });

  it('an absent state is outstanding, NEVER delivered', () => {
    // The ledger's own rule: absent reads as `local-only`. Counting it as
    // delivered would report a finished seed for files nobody has sent.
    const p = computeSeedProgress({ rows: rows([{}, {}, {}]), now: NOW });
    expect(p.delivered).toBe(0);
    expect(p.remaining).toBe(3);
  });

  it('counts every terminal-good state as delivered', () => {
    const p = computeSeedProgress({
      rows: rows([
        { state: 'on-hub' },
        { state: 'durable' },
        { state: 'at-peer' },
        { state: 'ui-healed' },
        { state: 'everywhere' },
      ]),
      now: NOW,
    });
    expect(p.delivered).toBe(5);
    expect(p.phase).toBe('converged');
  });

  it('separates BLOCKED from remaining — waiting will not clear it', () => {
    const p = computeSeedProgress({
      rows: rows([
        { state: 'on-hub' },
        {
          state: 'refused',
          reason: 'Too big for this workspace — 465.8 MB, and the limit is 95.0 MB',
        },
        { state: 'refused', reason: "This project's upload allowance for the hour is used up" },
      ]),
      now: NOW,
    });
    expect(p.delivered).toBe(1);
    expect(p.remaining).toBe(0);
    expect(p.blocked).toEqual([
      { class: 'too-large', count: 1 },
      { class: 'quota', count: 1 },
    ]);
    // Nothing outstanding that will move on its own ⇒ blocked, not converged.
    expect(p.phase).toBe('blocked');
  });

  it('classifies from the row\'s OWN blockedClass, not from hub-influenceable text', () => {
    // `reason` can embed a bounded snippet of a hub error body, so a hostile hub
    // answering with a body containing "too big" could otherwise steer how its
    // own refusals are labelled. The writer records the class; the reader trusts
    // that, not the prose.
    const p = computeSeedProgress({
      rows: rows([
        { state: 'refused', blockedClass: 'quota', reason: 'HTTP 507 — too big, allegedly' },
        { state: 'refused', blockedClass: 'too-large', reason: 'HTTP 413 — allowance, allegedly' },
      ]),
      now: NOW,
    });
    expect(p.blocked).toEqual([
      { class: 'quota', count: 1 },
      { class: 'too-large', count: 1 },
    ]);
  });

  it('falls back to OUR sentence prefixes for rows written before the field', () => {
    const p = computeSeedProgress({
      rows: rows([
        { state: 'refused', reason: 'Too big for this workspace — 465.8 MB, and the limit is 95.0 MB' },
        { state: 'refused', reason: 'HTTP 500 — a hub body mentioning too big' },
      ]),
      now: NOW,
    });
    // Prefix-anchored: the hub-supplied one degrades to the honest `refused`.
    expect(p.blocked).toEqual([
      { class: 'too-large', count: 1 },
      { class: 'refused', count: 1 },
    ]);
  });

  it('a pause is a phase of its own — nothing is wrong and nothing is lost', () => {
    const p = computeSeedProgress({
      rows: rows([{ state: 'local-only' }]),
      now: NOW,
      pausedUntil: NOW + 30_000,
      pauseCause: 'hub-asked',
    });
    expect(p.phase).toBe('paused');
  });

  it('an EXPIRED pause is not a pause', () => {
    const p = computeSeedProgress({
      rows: rows([{ state: 'local-only' }]),
      now: NOW,
      pausedUntil: NOW - 1,
    });
    expect(p.phase).toBe('seeding');
  });

  it('scanning outranks everything — the denominator is not final yet', () => {
    const p = computeSeedProgress({
      rows: rows([{ state: 'local-only' }]),
      now: NOW,
      scanning: true,
    });
    expect(p.phase).toBe('scanning');
  });

  it('an empty project is converged, not blocked', () => {
    const p = computeSeedProgress({ rows: {}, now: NOW });
    expect(p.phase).toBe('converged');
    expect(p.tracked).toBe(0);
    expect(p.remaining).toBe(0);
  });

  describe('etaMs — the restraint that matters', () => {
    it('is null with no sample at all', () => {
      const p = computeSeedProgress({ rows: rows([{ state: 'local-only' }]), now: NOW });
      expect(p.etaMs).toBeNull();
    });

    it('is null when the sample delivered NOTHING', () => {
      // The 2026-09-03 misreading: bytes were leaving the machine and nothing
      // was landing. A rate computed from bytes-sent would have produced a
      // confident, completely wrong "about ten minutes".
      const p = computeSeedProgress({
        rows: rows([{ state: 'local-only', size: 10_000_000 }]),
        now: NOW,
        deliveredSince: { bytes: 0, ms: 2_000 },
      });
      expect(p.etaMs).toBeNull();
    });

    it('is a number once real bytes have actually landed', () => {
      const p = computeSeedProgress({
        rows: rows([{ state: 'local-only', size: 1_000_000 }]),
        now: NOW,
        deliveredSince: { bytes: 500_000, ms: 1_000 },
      });
      expect(p.etaMs).toBe(2_000);
    });

    it('refuses an absurd estimate rather than printing one', () => {
      const p = computeSeedProgress({
        rows: rows([{ state: 'local-only', size: 9_000_000_000 }]),
        now: NOW,
        deliveredSince: { bytes: 1, ms: 1_000 },
      });
      expect(p.etaMs).toBeNull();
    });
  });

  describe('startedAt', () => {
    it('is stamped when work first appears and kept across ticks', () => {
      const first = computeSeedProgress({ rows: rows([{ state: 'local-only' }]), now: NOW });
      expect(first.startedAt).toBe(NOW);
      const later = computeSeedProgress({
        rows: rows([{ state: 'local-only' }]),
        now: NOW + 60_000,
        previous: first,
      });
      expect(later.startedAt).toBe(NOW);
    });

    it('clears once there is nothing outstanding', () => {
      const prev: SeedProgress = {
        phase: 'seeding',
        tracked: 1,
        delivered: 0,
        remaining: 1,
        bytesRemaining: 0,
        blocked: [],
        etaMs: null,
        startedAt: NOW,
      };
      const done = computeSeedProgress({
        rows: rows([{ state: 'on-hub' }]),
        now: NOW + 1,
        previous: prev,
      });
      expect(done.startedAt).toBeNull();
    });
  });

  it('carries the pass ceiling through, so "more to come" is sayable', () => {
    const p = computeSeedProgress({
      rows: rows([{ state: 'local-only' }]),
      now: NOW,
      passCapped: 'requests',
    });
    expect(p.passCapped).toBe('requests');
  });

  it('scales — a 2 961-row ledger folds without special-casing', () => {
    const big: Record<string, LedgerRow> = {};
    for (let i = 0; i < 2_961; i++) {
      big[`assets/f${i}.jpg`] = {
        syncedHash: null,
        size: 512_000,
        state: i < 2_158 ? 'on-hub' : 'local-only',
      } as LedgerRow;
    }
    const p = computeSeedProgress({ rows: big, now: NOW });
    expect(p.tracked).toBe(2_961);
    expect(p.delivered).toBe(2_158);
    expect(p.remaining).toBe(803); // the real undelivered count
  });
});
