// Connection-state machine tests — Phase 9 Task 8 (hub-down offline mode).
//
// Drives the monitor with injected timers + clock so transitions are
// deterministic without real wall-clock waits.

import { describe, expect, test } from 'bun:test';

import { createConnectionMonitor, type SyncStatusSnapshot } from '../sync/connection-state.ts';

/** A controllable timer queue: setTimer enqueues, advance() fires due timers. */
function fakeClock() {
  let nowMs = 1_000_000;
  let nextId = 1;
  const timers = new Map<number, { fireAt: number; cb: () => void }>();
  return {
    now: () => nowMs,
    setTimer: (cb: () => void, ms: number) => {
      const id = nextId++;
      timers.set(id, { fireAt: nowMs + ms, cb });
      return id as unknown as ReturnType<typeof setTimeout>;
    },
    clearTimer: (h: ReturnType<typeof setTimeout>) => {
      timers.delete(h as unknown as number);
    },
    /** Advance virtual time by `ms`, firing every timer whose deadline passed. */
    advance(ms: number) {
      nowMs += ms;
      for (const [id, t] of [...timers.entries()].sort((a, b) => a[1].fireAt - b[1].fireAt)) {
        if (t.fireAt <= nowMs) {
          timers.delete(id);
          t.cb();
        }
      }
    },
  };
}

function makeMonitor(overrides = {}) {
  const clock = fakeClock();
  const changes: SyncStatusSnapshot[] = [];
  const monitor = createConnectionMonitor({
    graceMs: 30_000,
    escalateMs: 24 * 60 * 60 * 1000,
    flashMs: 3_000,
    now: clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    onChange: (s) => changes.push(s),
    ...overrides,
  });
  return { clock, changes, monitor };
}

describe('connection monitor', () => {
  test('starts connecting, and goes online when the provider connects', () => {
    // The seed used to be `online` — success asserted before a socket existed.
    // See `sync-connect-honesty.test.ts` for why that mattered to a user.
    const { monitor } = makeMonitor();
    expect(monitor.snapshot().state).toBe('connecting');
    monitor.noteProviderStatus('p1', 'connected');
    expect(monitor.snapshot().state).toBe('online');
  });

  test('a link nobody answers still escalates to offline', () => {
    // The seed change must not create a state that waits forever: a provider
    // that only ever reports 'connecting' has to reach the offline banner on
    // the same grace clock as a link that dropped after being live.
    const { clock, monitor } = makeMonitor();
    monitor.noteProviderStatus('p1', 'connecting');
    expect(monitor.snapshot().state).toBe('connecting');
    clock.advance(30_000);
    expect(monitor.snapshot().state).toBe('offline');
  });

  test('disconnect → stays connecting during grace, goes offline after graceMs', () => {
    const { clock, monitor } = makeMonitor();
    monitor.noteProviderStatus('p1', 'connected');
    monitor.noteProviderStatus('p1', 'disconnected');
    // Inside the grace window — no offline yet (transient blips don't flash UI).
    expect(monitor.snapshot().state).toBe('connecting');
    clock.advance(29_000);
    expect(monitor.snapshot().state).toBe('connecting');
    clock.advance(2_000); // total 31s > 30s grace
    expect(monitor.snapshot().state).toBe('offline');
    expect(monitor.snapshot().offlineSince).not.toBeNull();
  });

  test('reconnect inside grace cancels the offline transition', () => {
    const { clock, monitor } = makeMonitor();
    monitor.noteProviderStatus('p1', 'connected');
    monitor.noteProviderStatus('p1', 'disconnected');
    clock.advance(10_000);
    monitor.noteProviderStatus('p1', 'connected');
    expect(monitor.snapshot().state).toBe('online');
    clock.advance(60_000); // grace timer must have been cancelled
    expect(monitor.snapshot().state).toBe('online');
  });

  test('queues local edits while offline, resets on reconnect with a green flash', () => {
    const { clock, monitor } = makeMonitor();
    monitor.noteProviderStatus('p1', 'connected');
    monitor.noteProviderStatus('p1', 'disconnected');
    clock.advance(31_000);
    expect(monitor.snapshot().state).toBe('offline');

    monitor.noteLocalEdit();
    monitor.noteLocalEdit();
    monitor.noteLocalEdit();
    expect(monitor.snapshot().queuedOps).toBe(3);

    monitor.noteProviderStatus('p1', 'connected');
    const snap = monitor.snapshot();
    expect(snap.state).toBe('online');
    expect(snap.queuedOps).toBe(0);
    expect(snap.flash).toBe('synced');

    clock.advance(3_500); // flashMs elapses
    expect(monitor.snapshot().flash).toBeNull();
  });

  test('does not count edits made while online toward the queue', () => {
    const { monitor } = makeMonitor();
    monitor.noteProviderStatus('p1', 'connected');
    monitor.noteLocalEdit();
    expect(monitor.snapshot().queuedOps).toBe(0);
  });

  test('escalates to offline-long after escalateMs offline', () => {
    const { clock, monitor } = makeMonitor();
    monitor.noteProviderStatus('p1', 'connected');
    monitor.noteProviderStatus('p1', 'disconnected');
    clock.advance(31_000);
    expect(monitor.snapshot().state).toBe('offline');
    clock.advance(24 * 60 * 60 * 1000 + 1_000);
    expect(monitor.snapshot().state).toBe('offline-long');
  });

  test('aggregates multiple providers: any connected ⇒ online', () => {
    const { clock, monitor } = makeMonitor();
    monitor.noteProviderStatus('a', 'connected');
    monitor.noteProviderStatus('b', 'connected');
    // b drops, a still up → stays online (aggregate sees a connected).
    monitor.noteProviderStatus('b', 'disconnected');
    expect(monitor.snapshot().state).toBe('online');
    // a drops too → grace, then offline.
    monitor.noteProviderStatus('a', 'disconnected');
    clock.advance(31_000);
    expect(monitor.snapshot().state).toBe('offline');
  });

  test('stop() cancels pending timers (no late transitions)', () => {
    const { clock, changes, monitor } = makeMonitor();
    monitor.noteProviderStatus('p1', 'connected');
    monitor.noteProviderStatus('p1', 'disconnected');
    monitor.stop();
    const before = changes.length;
    clock.advance(60_000);
    expect(changes.length).toBe(before); // no offline transition fired
  });
});

// DDR-102 — per-doc states + real lastSyncAt.
describe('connection monitor — per-doc states (DDR-102)', () => {
  test('noteDocState rolls up into docs counts + rejectedSlugs', () => {
    const { monitor } = makeMonitor();
    monitor.noteDocState('ui-a', 'pending');
    monitor.noteDocState('ui-b', 'connected');
    monitor.noteDocState('ui-c', 'auth-rejected');
    monitor.noteDocState('ui-d', 'auth-rejected');

    const snap = monitor.snapshot();
    expect(snap.docs).toEqual({ synced: 1, pending: 1, rejected: 2 });
    expect(snap.rejectedSlugs?.sort()).toEqual(['ui-c', 'ui-d']);
  });

  test('doc state transitions update the rollup (rejected → connected after re-link)', () => {
    const { monitor, changes } = makeMonitor();
    monitor.noteDocState('ui-a', 'auth-rejected');
    expect(monitor.snapshot().docs?.rejected).toBe(1);
    monitor.noteDocState('ui-a', 'connected');
    const snap = monitor.snapshot();
    expect(snap.docs).toEqual({ synced: 1, pending: 0, rejected: 0 });
    expect(snap.rejectedSlugs).toEqual([]);
    // Each transition emitted (no-op repeats don't).
    const emitted = changes.length;
    monitor.noteDocState('ui-a', 'connected');
    expect(changes.length).toBe(emitted);
  });

  test('rejectedSlugs caps at 20 while docs.rejected carries the true count', () => {
    const { monitor } = makeMonitor();
    for (let i = 0; i < 25; i++) monitor.noteDocState(`ui-${i}`, 'auth-rejected');
    const snap = monitor.snapshot();
    expect(snap.docs?.rejected).toBe(25);
    expect(snap.rejectedSlugs).toHaveLength(20);
  });

  test('noteSyncActivity sets lastSyncAt to now and promotes a pending doc', () => {
    const { clock, monitor } = makeMonitor();
    monitor.noteDocState('ui-a', 'pending');
    expect(monitor.snapshot().lastSyncAt).toBeNull();

    clock.advance(5_000);
    monitor.noteSyncActivity('ui-a');
    const snap = monitor.snapshot();
    expect(snap.lastSyncAt).toBe(clock.now());
    expect(snap.docs?.synced).toBe(1);
    expect(snap.docs?.pending).toBe(0);
  });

  test('noteSyncActivity does NOT resurrect an auth-rejected doc', () => {
    const { monitor } = makeMonitor();
    monitor.noteDocState('ui-a', 'auth-rejected');
    monitor.noteSyncActivity('ui-a');
    expect(monitor.snapshot().docs?.rejected).toBe(1);
    expect(monitor.snapshot().lastSyncAt).not.toBeNull();
  });

  test('lastSyncAt advances on repeated activity (real activity, not just transitions)', () => {
    const { clock, monitor } = makeMonitor();
    monitor.noteDocState('ui-a', 'connected');
    monitor.noteSyncActivity('ui-a');
    const first = monitor.snapshot().lastSyncAt;
    clock.advance(10_000);
    monitor.noteSyncActivity('ui-a');
    expect(monitor.snapshot().lastSyncAt).toBe((first as number) + 10_000);
  });
});

describe('what this run pulled down', () => {
  // This field was `remoteGap`, "what the project has that this machine does
  // not" — and it was recorded AFTER the pull, so it named exactly the
  // canvases that had just arrived. `_sync.json` was observed listing two
  // documents that were sitting on disk. The name now matches the fact.
  test('records the canvases that arrived, with a true count', () => {
    const { monitor } = makeMonitor();
    monitor.notePulled(['ui-welcome', 'ui-how-to']);
    expect(monitor.snapshot().pulled).toEqual({
      names: ['ui-welcome', 'ui-how-to'],
      count: 2,
    });
  });

  test('a run that pulled nothing says nothing', () => {
    const { monitor } = makeMonitor();
    monitor.notePulled([]);
    expect(monitor.snapshot().pulled).toBeUndefined();
  });

  test('the name list is capped but the count is not — a cap must not falsify a number', () => {
    // Hub-controlled payload size (same reasoning as rejectedSlugs).
    const { monitor } = makeMonitor();
    monitor.notePulled(Array.from({ length: 50 }, (_, i) => `ui-${i}`));
    const pulled = monitor.snapshot().pulled;
    expect(pulled?.names).toHaveLength(20);
    expect(pulled?.count).toBe(50);
  });
});
