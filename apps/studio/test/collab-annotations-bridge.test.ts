// Unit: Task 5 — Registry.syncRoomFromAnnotations bridges PUT /_api/annotations
// writes into the live Y.Map so collab peers see the SVG without cold-open.

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

describe('Registry.syncRoomFromAnnotations', () => {
  test('populates Y.Map.svg', () => {
    const r = createRegistry(noopCallbacks());
    const room = r.get('canvas-slug');
    const map = room.doc.getMap<string>(Y_TYPES.annotations);
    expect(map.get('svg')).toBeUndefined();

    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><g/></svg>';
    r.syncRoomFromAnnotations('canvas-slug', svg);
    expect(map.get('svg')).toBe(svg);
  });

  test('replaces existing svg on each call (LWW)', () => {
    const r = createRegistry(noopCallbacks());
    const room = r.get('canvas-slug');
    r.syncRoomFromAnnotations('canvas-slug', '<svg>1</svg>');
    r.syncRoomFromAnnotations('canvas-slug', '<svg>2</svg>');
    expect(room.doc.getMap(Y_TYPES.annotations).get('svg')).toBe('<svg>2</svg>');
  });

  test('no-op when no room exists for slug', () => {
    const r = createRegistry(noopCallbacks());
    r.syncRoomFromAnnotations('absent', '<svg/>');
    expect(r.peek('absent')).toBeNull();
    expect(r.size()).toBe(0);
  });

  test('inspector-write origin propagates through doc.update', () => {
    const r = createRegistry(noopCallbacks());
    const room = r.get('echo-slug');
    let lastOrigin: unknown;
    room.doc.on('update', (_update, origin) => {
      lastOrigin = origin;
    });
    r.syncRoomFromAnnotations('echo-slug', '<svg/>');
    expect(lastOrigin).toBe('inspector-write');
  });
});
