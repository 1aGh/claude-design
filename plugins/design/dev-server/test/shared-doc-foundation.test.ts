// Phase 9.2 (DDR-064) Phase A — single-shared-doc foundation.
//
// Phase A is pure plumbing: the registry exposes one cached Y.Doc per slug
// (the seam the hub provider attaches to in Phase B) and the MAUDE_SHARED_DOC
// flag is threaded onto Context (default OFF = the two-doc path = zero
// regression). These tests pin the Task 2 contract + the Risk 2 mitigation
// (a single yjs instance — "imported twice" silently breaks sync).

import { describe, expect, test } from 'bun:test';
import * as Y from 'yjs';

import { createRegistry } from '../collab/registry.ts';
import type { RoomCallbacks } from '../collab/room.ts';

function noopCallbacks(): RoomCallbacks {
  return {
    async seed() {},
    async persistJson() {},
    async persistBinary() {},
  };
}

describe('Phase A — registry.getDoc (single shared doc per slug)', () => {
  test('getDoc caches: repeated calls return the SAME Y.Doc instance', () => {
    const r = createRegistry(noopCallbacks());
    const a = r.getDoc('canvas-x');
    const b = r.getDoc('canvas-x');
    expect(a).toBe(b);
  });

  test('getDoc returns the owning room.doc (single source of truth)', () => {
    const r = createRegistry(noopCallbacks());
    const doc = r.getDoc('canvas-x');
    // get() is get-or-create; it must reuse the room getDoc just created, so
    // the doc the browser room syncs IS the doc the provider would attach to.
    expect(r.get('canvas-x').doc).toBe(doc);
    expect(r.peek('canvas-x')?.doc).toBe(doc);
  });

  test('distinct slugs get distinct docs', () => {
    const r = createRegistry(noopCallbacks());
    expect(r.getDoc('a')).not.toBe(r.getDoc('b'));
  });

  test('Risk 2 — getDoc yields a real Y.Doc from the single yjs instance', () => {
    // If room.ts ever resolved a SECOND copy of yjs, this instanceof against
    // the test's own import would be false and live sync would silently break.
    const r = createRegistry(noopCallbacks());
    expect(r.getDoc('canvas-x')).toBeInstanceOf(Y.Doc);
  });

  test('getDoc creates the room before any browser connects (provider can attach at serve start)', () => {
    const r = createRegistry(noopCallbacks());
    expect(r.peek('canvas-x')).toBeNull(); // nothing created yet
    const doc = r.getDoc('canvas-x');
    // The room now exists with zero connections — exactly the state the hub
    // provider attaches into at serve start (Phase B gotcha).
    const room = r.peek('canvas-x');
    expect(room).not.toBeNull();
    expect(room?.size()).toBe(0);
    expect(room?.doc).toBe(doc);
  });
});
