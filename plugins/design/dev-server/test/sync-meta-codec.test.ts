// Gap 2 — .meta.json shared-layout sync codec.
//
// Artboard layout must propagate as a file diff (one machine moves an artboard →
// the other's .meta.json layout converges), while each user's pan/zoom
// (`viewport`) and the security opt-in (`syncable`) stay strictly local. These
// tests pin that split: applyMetaToDoc stores only the shared subset, and
// mergeSharedMetaIntoLocal layers it back without trampling local-only keys.

import { describe, expect, test } from 'bun:test';
import * as Y from 'yjs';

import {
  META_LOCAL_KEYS,
  applyCssToDoc,
  applyMetaToDoc,
  cssFromDoc,
  mergeSharedMetaIntoLocal,
  metaFromDoc,
} from '../sync/codec.ts';

describe('Gap 2 — meta codec: shared layout syncs, per-user keys stay local', () => {
  test('applyMetaToDoc stores ONLY the shared subset (viewport/last_modified/syncable stripped)', () => {
    const doc = new Y.Doc();
    const full = JSON.stringify({
      title: 'Kanban',
      layout: { 'ab-1': { x: 10, y: 20 } },
      viewport: { x: 999, y: 888, zoom: 0.5 },
      last_modified: '2026-01-01T00:00:00Z',
      syncable: true,
    });
    expect(applyMetaToDoc(doc, full)).toBe(true);

    const shared = JSON.parse(metaFromDoc(doc) as string);
    expect(shared.title).toBe('Kanban');
    expect(shared.layout).toEqual({ 'ab-1': { x: 10, y: 20 } });
    // The three per-machine keys never enter the synced doc.
    expect(shared.viewport).toBeUndefined();
    expect(shared.last_modified).toBeUndefined();
    expect(shared.syncable).toBeUndefined();
  });

  test('applyMetaToDoc is a NO-OP when only per-user keys differ (no churn from panning)', () => {
    const doc = new Y.Doc();
    applyMetaToDoc(doc, JSON.stringify({ title: 'X', viewport: { x: 1 } }));
    // Same shared content, different viewport → must not register a change,
    // otherwise every pan would emit a sync op.
    expect(applyMetaToDoc(doc, JSON.stringify({ title: 'X', viewport: { x: 2 } }))).toBe(false);
  });

  test('mergeSharedMetaIntoLocal takes shared layout, PRESERVES local viewport + syncable', () => {
    const shared = JSON.stringify({ title: 'Kanban', layout: { 'ab-1': { x: 10, y: 20 } } });
    const local = JSON.stringify({
      title: 'Kanban (stale)',
      layout: { 'ab-1': { x: 0, y: 0 } },
      viewport: { x: 42, y: 7, zoom: 1.5 },
      syncable: false,
      last_modified: 'local-ts',
    });
    const merged = JSON.parse(mergeSharedMetaIntoLocal(local, shared) as string);
    expect(merged.layout).toEqual({ 'ab-1': { x: 10, y: 20 } }); // shared layout won
    expect(merged.title).toBe('Kanban'); // shared title won
    expect(merged.viewport).toEqual({ x: 42, y: 7, zoom: 1.5 }); // LOCAL viewport kept
    expect(merged.syncable).toBe(false); // LOCAL opt-in kept (security invariant)
    expect(merged.last_modified).toBe('local-ts'); // local timestamp kept
  });

  test('round-trip: artboard move on A reaches B without touching B viewport / syncable', () => {
    const aDoc = new Y.Doc();
    applyMetaToDoc(
      aDoc,
      JSON.stringify({
        title: 'K',
        layout: { 'ab-1': { x: 100, y: 200 } },
        viewport: { zoom: 0.5 },
        syncable: true,
      })
    );
    const shared = metaFromDoc(aDoc) as string;

    const bLocal = JSON.stringify({
      title: 'K',
      layout: { 'ab-1': { x: 0, y: 0 } },
      viewport: { zoom: 2.0 },
      syncable: false,
    });
    const bMerged = JSON.parse(mergeSharedMetaIntoLocal(bLocal, shared) as string);
    expect(bMerged.layout['ab-1']).toEqual({ x: 100, y: 200 }); // A's move landed on B
    expect(bMerged.viewport).toEqual({ zoom: 2.0 }); // B's camera untouched
    expect(bMerged.syncable).toBe(false); // B's opt-in untouched
  });

  test('a freshly-cloned peer with no local viewport just takes the shared subset', () => {
    const merged = JSON.parse(
      mergeSharedMetaIntoLocal('{}', JSON.stringify({ title: 'K', layout: { a: 1 } })) as string
    );
    expect(merged).toEqual({ title: 'K', layout: { a: 1 } });
  });

  test('META_LOCAL_KEYS pins the never-synced set', () => {
    expect([...META_LOCAL_KEYS].sort()).toEqual(['last_modified', 'syncable', 'viewport']);
  });

  test('mergeSharedMetaIntoLocal returns null on an unparseable shared payload', () => {
    expect(mergeSharedMetaIntoLocal('{}', 'not json')).toBeNull();
  });
});

describe('Gap 3 — css codec (opaque wholesale text)', () => {
  test('applyCssToDoc round-trips the css string', () => {
    const doc = new Y.Doc();
    expect(cssFromDoc(doc)).toBeNull();
    const css = '.ka-card { color: red; }\n';
    expect(applyCssToDoc(doc, css)).toBe(true);
    expect(cssFromDoc(doc)).toBe(css);
  });

  test('applyCssToDoc is a no-op when unchanged (loop-safe)', () => {
    const doc = new Y.Doc();
    applyCssToDoc(doc, '.x{}');
    expect(applyCssToDoc(doc, '.x{}')).toBe(false);
    expect(applyCssToDoc(doc, '.x{ color: blue }')).toBe(true);
  });
});
