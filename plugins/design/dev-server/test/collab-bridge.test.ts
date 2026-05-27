// Unit: Registry inspector-bridge — REST/WS writes to api.comments* must
// reach the live Y.Array so collab peers see the change without waiting for
// a cold-open re-seed.

import { describe, expect, test } from 'bun:test';

import * as Y from 'yjs';

import { createRegistry } from '../collab/registry.ts';
import { Y_TYPES } from '../collab/persistence.ts';
import type { RoomCallbacks } from '../collab/room.ts';

function noopCallbacks(): RoomCallbacks {
  return {
    async seed() {},
    async persistJson() {},
    async persistBinary() {},
  };
}

describe('Registry inspector-bridge', () => {
  test('peek returns null when no room is live', () => {
    const r = createRegistry(noopCallbacks());
    expect(r.peek('absent')).toBeNull();
  });

  test('peek returns the room without creating one', () => {
    const r = createRegistry(noopCallbacks());
    expect(r.size()).toBe(0);
    expect(r.peek('foo')).toBeNull();
    expect(r.size()).toBe(0);
    r.get('foo'); // create
    expect(r.size()).toBe(1);
    expect(r.peek('foo')).not.toBeNull();
  });

  test('syncRoomFromComments populates the live Y.Array', () => {
    const r = createRegistry(noopCallbacks());
    const room = r.get('canvas-slug');
    expect(room.doc.getArray(Y_TYPES.comments).length).toBe(0);

    r.syncRoomFromComments('canvas-slug', [
      { id: 'c1', text: 'first', status: 'open' },
      { id: 'c2', text: 'second', status: 'open' },
    ]);

    const arr = room.doc.getArray(Y_TYPES.comments);
    expect(arr.length).toBe(2);
    expect((arr.get(0) as { id: string }).id).toBe('c1');
    expect((arr.get(1) as { id: string }).id).toBe('c2');
  });

  test('syncRoomFromComments replaces existing contents (idempotent)', () => {
    const r = createRegistry(noopCallbacks());
    const room = r.get('canvas-slug');
    r.syncRoomFromComments('canvas-slug', [{ id: 'c1' }, { id: 'c2' }]);
    r.syncRoomFromComments('canvas-slug', [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }]);
    expect(room.doc.getArray(Y_TYPES.comments).length).toBe(3);
    r.syncRoomFromComments('canvas-slug', []);
    expect(room.doc.getArray(Y_TYPES.comments).length).toBe(0);
  });

  test('syncRoomFromComments is a no-op for slugs with no room', () => {
    const r = createRegistry(noopCallbacks());
    // Must not throw, must not create a room.
    r.syncRoomFromComments('absent', [{ id: 'x' }]);
    expect(r.peek('absent')).toBeNull();
    expect(r.size()).toBe(0);
  });

  test('inspector-write origin triggers doc.update broadcast', async () => {
    const r = createRegistry(noopCallbacks());
    const room = r.get('echo-slug');
    let lastOrigin: unknown = undefined;
    room.doc.on('update', (_update, origin) => {
      lastOrigin = origin;
    });
    r.syncRoomFromComments('echo-slug', [{ id: 'c1' }]);
    expect(lastOrigin).toBe('inspector-write');
  });
});
