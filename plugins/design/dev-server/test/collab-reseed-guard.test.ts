// Gap 1 (file-sync clobber fix) — the syncRoomFrom* no-op guards.
//
// createCollab now re-seeds a live room from disk whenever a synced file
// changes externally (sync-agent hub-push or `design:edit` write), so the
// room stops clobbering the external change back. That re-seed reuses
// syncRoomFromComments/syncRoomFromAnnotations, which ALSO run on the room's
// own persist → file → fs-event path. Without an equality short-circuit that
// would spin an 800ms persist storm. These tests pin the guard: an identical
// re-seed emits NO doc update (→ no persist → no loop); a real change emits one.

import { describe, expect, test } from 'bun:test';

import { Y_TYPES } from '../collab/persistence.ts';
import { createRegistry } from '../collab/registry.ts';
import type { RoomCallbacks } from '../collab/room.ts';

function noopCallbacks(): RoomCallbacks {
  return {
    async seed() {},
    async persistJson() {},
    async persistBinary() {},
  };
}

describe('Gap 1 — syncRoomFromComments no-op guard', () => {
  test('re-seeding identical comments emits NO doc update (loop-safe)', () => {
    const r = createRegistry(noopCallbacks());
    const room = r.get('s');
    const list = [{ id: 'c1', text: 'hi' }];
    r.syncRoomFromComments('s', list);

    let updates = 0;
    room.doc.on('update', () => {
      updates++;
    });
    // Identical content (the room's-own-persist echo, or a redundant hub push)
    // → must not emit, or the reseed↔persist loop never settles.
    r.syncRoomFromComments('s', [{ id: 'c1', text: 'hi' }]);
    expect(updates).toBe(0);

    // A genuine change still propagates — exactly one update.
    r.syncRoomFromComments('s', [
      { id: 'c1', text: 'hi' },
      { id: 'c2', text: 'yo' },
    ]);
    expect(updates).toBe(1);
  });

  test('re-seed brings a STALE room up to the on-disk list (the clobber fix)', () => {
    const r = createRegistry(noopCallbacks());
    const room = r.get('s');
    const arr = room.doc.getArray(Y_TYPES.comments);
    expect(arr.length).toBe(0); // room opened empty (the "B shows []" state)

    // Sync agent wrote a hub-pushed comment to disk → createCollab re-seeds:
    r.syncRoomFromComments('s', [{ id: 'c1', text: 'from peer A' }]);
    expect(arr.toArray()).toEqual([{ id: 'c1', text: 'from peer A' }]);
  });
});

describe('Gap 1 — syncRoomFromAnnotations no-op guard', () => {
  test('re-seeding the identical svg emits NO doc update', () => {
    const r = createRegistry(noopCallbacks());
    const room = r.get('s');
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><g/></svg>';
    r.syncRoomFromAnnotations('s', svg);

    let updates = 0;
    room.doc.on('update', () => {
      updates++;
    });
    r.syncRoomFromAnnotations('s', svg); // identical → no-op
    expect(updates).toBe(0);

    r.syncRoomFromAnnotations('s', '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>');
    expect(updates).toBe(1);
  });
});
