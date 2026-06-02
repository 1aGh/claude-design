// Sync status store tests — Phase 9 Task 8.

import { describe, expect, test } from 'bun:test';

import type { SyncStatusSnapshot } from '../sync/connection-state.ts';
import { createSyncStatusStore, type SyncStatusPayload } from '../sync/status.ts';

function snap(partial: Partial<SyncStatusSnapshot> = {}): SyncStatusSnapshot {
  return {
    state: 'online',
    queuedOps: 0,
    lastSyncAt: null,
    offlineSince: null,
    flash: null,
    updatedAt: 1,
    ...partial,
  };
}

function makeStore() {
  const writes: SyncStatusPayload[] = [];
  const broadcasts: SyncStatusPayload[] = [];
  const store = createSyncStatusStore({
    url: 'https://hub.example.com',
    canvases: 3,
    write: (p) => writes.push(p),
    broadcast: (p) => broadcasts.push(p),
    now: () => 42,
  });
  return { store, writes, broadcasts };
}

describe('sync status store', () => {
  test('update() writes + broadcasts the merged payload', () => {
    const { store, writes, broadcasts } = makeStore();
    store.update(snap({ state: 'offline', queuedOps: 2 }));
    expect(writes).toHaveLength(1);
    expect(broadcasts).toHaveLength(1);
    expect(writes[0].state).toBe('offline');
    expect(writes[0].queuedOps).toBe(2);
    expect(writes[0].url).toBe('https://hub.example.com');
    expect(writes[0].canvases).toBe(3);
    expect(writes[0].conflicts).toEqual([]);
  });

  test('addConflict() appends a stamped conflict + reflects in get()', () => {
    const { store } = makeStore();
    store.addConflict({ slug: 'screen', kind: 'cold-start-hub-wins' });
    const p = store.get();
    expect(p.conflicts).toHaveLength(1);
    expect(p.conflicts[0]).toEqual({ slug: 'screen', kind: 'cold-start-hub-wins', at: 42 });
  });

  test('conflict list is capped at maxConflicts (drops oldest)', () => {
    const writes: SyncStatusPayload[] = [];
    const store = createSyncStatusStore({
      url: 'https://h',
      canvases: 1,
      write: (p) => writes.push(p),
      maxConflicts: 2,
      now: () => 1,
    });
    store.addConflict({ slug: 'a', kind: 'git-pull' });
    store.addConflict({ slug: 'b', kind: 'git-pull' });
    store.addConflict({ slug: 'c', kind: 'git-pull' });
    const p = store.get();
    expect(p.conflicts.map((c) => c.slug)).toEqual(['b', 'c']);
  });

  test('a throwing writer never propagates into the caller', () => {
    const store = createSyncStatusStore({
      url: 'https://h',
      canvases: 1,
      write: () => {
        throw new Error('disk full');
      },
    });
    expect(() => store.update(snap({ state: 'offline' }))).not.toThrow();
  });
});
