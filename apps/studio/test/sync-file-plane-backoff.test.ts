// Per-path failure backoff — the client's half of "stop making it worse".
//
// The measured shape this prevents (2026-09-03, alligators): 314 PUTs across
// 44 unique paths in a 10-second window — ~7 attempts per file, one sponsor
// logo 24 times — against a cell that was restarting in a loop. The plane had
// no per-path backoff at all, so every pass re-attempted the identical failing
// set at full rate and the retries were themselves what kept the door shut.

import { describe, expect, it } from 'bun:test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  BACKOFF_BASE_MS,
  backoffDelayMs,
  createFileLedger,
  MAX_BACKOFF_MS,
} from '../sync/file-ledger.ts';

function ledgerIn(dir?: string) {
  const root = dir ?? mkdtempSync(path.join(tmpdir(), 'maude-backoff-'));
  return createFileLedger({ designRoot: root, hubUrl: 'https://hub.test' });
}

describe('backoffDelayMs', () => {
  it('grows exponentially and is clamped at the ceiling', () => {
    // `random: () => 1` takes the top of the full-jitter window, so the shape
    // is readable without the draw getting in the way.
    const top = (n: number) => backoffDelayMs(n, () => 1);
    expect(top(1)).toBe(BACKOFF_BASE_MS);
    expect(top(2)).toBe(BACKOFF_BASE_MS * 2);
    expect(top(3)).toBe(BACKOFF_BASE_MS * 4);
    expect(top(50)).toBe(MAX_BACKOFF_MS);
  });

  it('never returns less than the base, whatever the draw', () => {
    for (const n of [1, 2, 5, 12]) {
      expect(backoffDelayMs(n, () => 0)).toBeGreaterThanOrEqual(BACKOFF_BASE_MS);
    }
  });

  it('jitters — two draws for the same attempt differ', () => {
    const draws = [0, 0.25, 0.5, 0.75, 1].map((r) => backoffDelayMs(6, () => r));
    expect(new Set(draws).size).toBeGreaterThan(1);
  });
});

describe('ledger backoff windows', () => {
  it('holds a failed path, then releases it', () => {
    const l = ledgerIn();
    const t0 = 1_000_000;
    expect(l.isBackedOff('a.png', t0)).toBe(false);

    const delay = l.noteAttemptFailed('a.png', t0);
    expect(delay).toBeGreaterThanOrEqual(BACKOFF_BASE_MS);
    expect(l.isBackedOff('a.png', t0)).toBe(true);
    expect(l.isBackedOff('a.png', t0 + delay - 1)).toBe(true);
    expect(l.isBackedOff('a.png', t0 + delay)).toBe(false);
    l.stop();
  });

  it('lengthens the window with each consecutive failure', () => {
    const l = ledgerIn();
    let t = 1_000_000;
    const first = l.noteAttemptFailed('a.png', t);
    t += first;
    const windows: number[] = [first];
    for (let i = 0; i < 5; i++) {
      const d = l.noteAttemptFailed('a.png', t);
      windows.push(d);
      t += d;
    }
    // Not monotonic per-draw (full jitter), but the CEILING must have grown:
    // the last window can reach far beyond the first's maximum.
    expect(Math.max(...windows)).toBeGreaterThan(BACKOFF_BASE_MS);
    expect(l.row('a.png')?.attempts).toBe(6);
    l.stop();
  });

  it('a success clears the counter AND the window', () => {
    const l = ledgerIn();
    const t0 = 1_000_000;
    l.noteAttemptFailed('a.png', t0);
    l.noteAttemptFailed('a.png', t0);
    expect(l.row('a.png')?.attempts).toBe(2);

    l.noteAttemptOk('a.png');
    expect(l.row('a.png')?.attempts).toBeUndefined();
    expect(l.isBackedOff('a.png', t0)).toBe(false);
    l.stop();
  });

  it('backoff is PERSISTED — "restart the app" is not the bypass', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'maude-backoff-persist-'));
    const t0 = 1_000_000;
    const first = ledgerIn(dir);
    const delay = first.noteAttemptFailed('a.png', t0);
    first.flush();
    first.stop();

    // A fresh ledger over the same directory is exactly what a restart gives
    // you. The deletion budget is persisted for this reason; so is this.
    const second = ledgerIn(dir);
    expect(second.isBackedOff('a.png', t0 + delay - 1)).toBe(true);
    second.stop();
  });

  it('a nonsense window from a corrupted row reads as expired, not as forever', () => {
    const l = ledgerIn();
    const t0 = 1_000_000;
    l.setState('a.png', 'stuck', { nextAttemptAt: t0 + MAX_BACKOFF_MS * 1000 });
    expect(l.isBackedOff('a.png', t0)).toBe(false);
    l.stop();
  });

  it('an untouched path is never backed off', () => {
    const l = ledgerIn();
    expect(l.isBackedOff('never-seen.png', Date.now())).toBe(false);
    l.stop();
  });
});
