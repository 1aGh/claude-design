// Connection-state machine tests — Phase 9 Task 8 (hub-down offline mode).
//
// Drives the monitor with injected timers + clock so transitions are
// deterministic without real wall-clock waits.

import { describe, expect, test } from 'bun:test';

import { type SyncStatusSnapshot, createConnectionMonitor } from '../sync/connection-state.ts';

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
  test('starts online and stays online when the provider connects', () => {
    const { monitor } = makeMonitor();
    monitor.noteProviderStatus('p1', 'connected');
    expect(monitor.snapshot().state).toBe('online');
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
