// The status store's three honesty properties.
//
// All three were observed failing against a real 8.8 GB seed on 2026-09-03:
// a freshness stamp 130 s stale on a file being rewritten continuously, an
// unbounded per-path map re-serialized on every emit, and a write+broadcast
// per emit for a payload nobody can read that fast.

import { describe, expect, it } from 'bun:test';

import { createSyncStatusStore, type SyncStatusPayload } from '../sync/status.ts';

function store(over: Partial<Parameters<typeof createSyncStatusStore>[0]> = {}) {
  const writes: SyncStatusPayload[] = [];
  const broadcasts: SyncStatusPayload[] = [];
  const s = createSyncStatusStore({
    url: 'https://hub.test',
    canvases: 3,
    write: (p) => writes.push(p),
    broadcast: (p) => broadcasts.push(p),
    flushIntervalMs: 0, // coalescing off unless a test asks for it
    ...over,
  });
  return { s, writes, broadcasts };
}

describe('updatedAt', () => {
  it('stamps when the PAYLOAD was built, not when the monitor last spoke', () => {
    let clock = 1_000_000;
    const { s, writes } = store({ now: () => clock });

    s.update({
      state: 'online',
      queuedOps: 0,
      lastSyncAt: null,
      offlineSince: null,
      flash: null,
      updatedAt: clock,
    });
    expect(writes.at(-1)?.updatedAt).toBe(1_000_000);

    // 130 seconds later the FILE lane reports. Nothing about the connection
    // changed — and that is exactly the case that used to publish a stale
    // stamp about itself, so `maude design status` read a live sync as dead.
    clock += 130_000;
    s.updateFiles({ synced: 1, pulled: 0, conflicts: 0 });
    expect(writes.at(-1)?.updatedAt).toBe(1_130_000);
    // The monitor's own stamp is preserved, under a name that says what it is.
    expect(writes.at(-1)?.connectionUpdatedAt).toBe(1_000_000);
  });

  it('advances on an asset emit too', () => {
    let clock = 1_000_000;
    const { s, writes } = store({ now: () => clock });
    clock += 5_000;
    s.updateAssets({
      total: 2,
      done: 1,
      pushed: 1,
      skipped: 0,
      failedCount: 0,
      failures: [],
      active: 'a.png',
      finished: false,
    });
    expect(writes.at(-1)?.updatedAt).toBe(1_005_000);
  });
});

describe('flush coalescing', () => {
  it('collapses a burst into one leading write plus one trailing write', async () => {
    const { s, writes } = store({ flushIntervalMs: 20 });
    for (let i = 0; i < 25; i++) {
      s.updateFiles({ synced: i, pulled: 0, conflicts: 0 });
    }
    // Leading edge only, so far — 25 emits are not 25 disk writes.
    expect(writes.length).toBe(1);
    await new Promise((r) => setTimeout(r, 40));
    // …and the final state still lands, so nothing is lost to the debounce.
    expect(writes.length).toBe(2);
    expect(writes.at(-1)?.files?.synced).toBe(24);
  });

  it('NEVER delays a conflict — that is what a person is waiting on', () => {
    const { s, writes } = store({ flushIntervalMs: 10_000 });
    s.updateFiles({ synced: 1, pulled: 0, conflicts: 0 }); // opens the window
    const before = writes.length;
    s.addConflict({ slug: 'home', kind: 'git-pull' });
    expect(writes.length).toBe(before + 1);
  });

  it('NEVER delays a notice', () => {
    const { s, writes } = store({ flushIntervalMs: 10_000 });
    s.updateFiles({ synced: 1, pulled: 0, conflicts: 0 });
    const before = writes.length;
    s.notice({ id: 'files-rate-limited', severity: 'info', text: 'paused' });
    expect(writes.length).toBe(before + 1);
  });

  it('NEVER delays a finished seed', () => {
    const { s, writes } = store({ flushIntervalMs: 10_000 });
    s.updateFiles({ synced: 1, pulled: 0, conflicts: 0 });
    const before = writes.length;
    s.updateFiles({
      synced: 5,
      pulled: 0,
      conflicts: 0,
      progress: {
        phase: 'converged',
        tracked: 5,
        delivered: 5,
        remaining: 0,
        bytesRemaining: 0,
        blocked: [],
        etaMs: null,
        startedAt: null,
      },
    });
    expect(writes.length).toBe(before + 1);
  });

  it('a connection state CHANGE is immediate; a heartbeat is not', () => {
    const { s, writes } = store({ flushIntervalMs: 10_000 });
    const snap = (state: 'online' | 'offline') => ({
      state,
      queuedOps: 0,
      lastSyncAt: null,
      offlineSince: null,
      flash: null,
      updatedAt: 1,
    });
    s.update(snap('online')); // change from `connecting` → immediate
    const afterChange = writes.length;
    s.update(snap('online')); // heartbeat → coalesced
    expect(writes.length).toBe(afterChange);
    s.update(snap('offline')); // change → immediate
    expect(writes.length).toBe(afterChange + 1);
  });
});

describe('payload shape', () => {
  it('carries progress and the delivery truncation count through', () => {
    const { s, writes } = store();
    s.updateFiles({
      synced: 2_158,
      pulled: 0,
      conflicts: 0,
      deliveryTruncated: 2_661,
      progress: {
        phase: 'seeding',
        tracked: 2_961,
        delivered: 2_158,
        remaining: 803,
        bytesRemaining: 2_417_000_000,
        blocked: [{ class: 'too-large', count: 2 }],
        etaMs: null,
        startedAt: 1,
      },
    });
    const p = writes.at(-1);
    expect(p?.files?.progress?.tracked).toBe(2_961);
    expect(p?.files?.progress?.remaining).toBe(803);
    expect(p?.files?.deliveryTruncated).toBe(2_661);
    // The RAW counters stay beside the derived view — DDR-214: a panel
    // derived from the same source it displays cannot be cross-checked.
    expect(p?.files?.synced).toBe(2_158);
  });
});
