// A connect that has not connected must never read as synced.
//
// THE FALSIFIER. Written against the pre-fix pipeline and expected to FAIL
// there — that failure is the evidence that the status signal is optimistic by
// construction, not merely rendered late. If it ever passes without the
// monitor changing, the premise of this whole change was wrong and the fix
// should be dropped rather than the assertion softened.
//
// Reported as "vyskočí modal, pak vidím jen syncing canvases, ale reálně se nic
// nestane": the user was told the truth about an intention and read it as a
// result.
//
// The two monitor-level defects it pins:
//   1. the monitor is BORN `online` — before a socket exists, before a token is
//      accepted, before a byte moves. Every surface keys off that value.
//   2. `docs.synced` can only ever rise — a hub that dies leaves the last count
//      frozen on screen forever, indistinguishable from a healthy one.
//
// The surface-level defects (one connected provider out of many reading green,
// and the status bar ignoring `docs` entirely) are pinned in
// `sync-presentation.test.ts`, because they live in the presentation rule
// rather than in the state machine.

import { describe, expect, test } from 'bun:test';

import { createConnectionMonitor, type SyncStatusSnapshot } from '../sync/connection-state.ts';

/**
 * The rule the shipped status bar applies (`app.jsx` syncSlot, pre-fix):
 * green dot and the word "synced" whenever `state` is `online`.
 *
 * Reproduced verbatim rather than imported, so this test measures what a USER
 * sees and cannot be quietly satisfied by editing the surface.
 */
function readsAsSynced(snap: SyncStatusSnapshot): boolean {
  return snap.state === 'online' || snap.flash === 'synced';
}

function makeMonitor() {
  const nowMs = 1_000_000;
  const timers = new Map<number, { fireAt: number; cb: () => void }>();
  let nextId = 1;
  const monitor = createConnectionMonitor({
    now: () => nowMs,
    setTimer: (cb, ms) => {
      const id = nextId++;
      timers.set(id, { fireAt: nowMs + ms, cb });
      return id as unknown as ReturnType<typeof setTimeout>;
    },
    clearTimer: (h) => {
      timers.delete(h as unknown as number);
    },
  });
  return { monitor };
}

describe('a connect that has not connected', () => {
  test('does not read as synced at t=0', () => {
    // The instant after Connect: the runtime started, providers exist on paper,
    // nothing has handshaken. This is precisely the moment the user is staring
    // at the note, and the moment the old pipeline claimed success.
    const { monitor } = makeMonitor();
    expect(readsAsSynced(monitor.snapshot())).toBe(false);
  });

  test('does not read as synced while every document is still pending', () => {
    const { monitor } = makeMonitor();
    for (const slug of ['ui-home', 'ui-about', 'ui-welcome']) {
      monitor.noteDocState(slug, 'pending');
    }
    const snap = monitor.snapshot();
    expect(snap.docs).toEqual({ synced: 0, pending: 3, rejected: 0 });
    expect(readsAsSynced(snap)).toBe(false);
  });

  test('does not read as synced when the hub refuses every document', () => {
    // A rotated credential: providers reach the hub, the hub says no. Nothing
    // is syncing, and the count that would say so must not claim otherwise.
    const { monitor } = makeMonitor();
    for (const slug of ['ui-home', 'ui-about']) {
      monitor.noteDocState(slug, 'auth-rejected');
    }
    expect(monitor.snapshot().docs).toEqual({ synced: 0, pending: 0, rejected: 2 });
  });
});

describe('a connect that stops being connected', () => {
  test('docs.synced falls when the providers drop', () => {
    // Today nothing demotes a connected document, so a hub that dies leaves
    // "3 synced" on screen indefinitely — the most convincing possible lie,
    // because it was true a moment ago.
    const { monitor } = makeMonitor();
    for (const slug of ['a', 'b', 'c']) {
      monitor.noteProviderStatus(slug, 'connected');
      monitor.noteDocState(slug, 'connected');
    }
    expect(monitor.snapshot().docs?.synced).toBe(3);

    for (const slug of ['a', 'b', 'c']) monitor.noteProviderStatus(slug, 'disconnected');

    const snap = monitor.snapshot();
    expect(snap.docs?.synced).toBe(0);
    expect(snap.docs?.pending).toBe(3);
  });

  test('a refusal is not transient — a dropped provider cannot launder it', () => {
    // `auth-rejected` outranks a disconnect: the hub gave an answer, and losing
    // the socket does not turn that answer back into "still trying".
    const { monitor } = makeMonitor();
    monitor.noteDocState('a', 'auth-rejected');
    monitor.noteProviderStatus('a', 'disconnected');
    expect(monitor.snapshot().docs).toEqual({ synced: 0, pending: 0, rejected: 1 });
  });
});
