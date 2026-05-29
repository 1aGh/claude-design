// Phase 9.2 (DDR-064) Phase E — the one-time authoritative seed (Task 9).
//
// Pins the fix for Risk 1, the duplication-on-merge trap: a shared doc must be
// populated from ONE source. These tests prove migrateSeed never duplicates
// comments and is idempotent across re-runs (server restarts).

import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import * as Y from 'yjs';

import { Y_TYPES, createPersistence } from '../collab/persistence.ts';
import type { Context } from '../context.ts';
import { applyCommentsToDoc, applyHtmlToDoc } from '../sync/codec.ts';
import { docIsEmpty, migrateSeed } from '../sync/migrate-seed.ts';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'migrate-seed-'));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function paths() {
  return {
    html: join(dir, 'screen.html'),
    comments: join(dir, 'screen.comments.json'),
    annotations: join(dir, 'screen.annotations.svg'),
    meta: join(dir, 'screen.meta.json'),
    css: join(dir, 'screen.css'),
  };
}

describe('docIsEmpty', () => {
  test('true for a fresh doc, false once any type is populated', () => {
    const doc = new Y.Doc();
    expect(docIsEmpty(doc)).toBe(true);
    doc.getArray(Y_TYPES.comments).push([{ id: 'c1' }]);
    expect(docIsEmpty(doc)).toBe(false);
  });
});

describe('migrateSeed — adopt (hub was empty)', () => {
  test('seeds an empty doc from local files and reports local-adopt', () => {
    const p = paths();
    writeFileSync(p.html, '<main>local body</main>');
    writeFileSync(p.comments, JSON.stringify([{ id: 'c1', text: 'local' }]));

    const doc = new Y.Doc();
    const result = migrateSeed({ slug: 's', doc, paths: p });

    expect(result).toBe('local-adopt');
    expect(doc.getText('html').toString()).toBe('<main>local body</main>');
    expect(doc.getArray(Y_TYPES.comments).toArray()).toEqual([{ id: 'c1', text: 'local' }]);
  });

  test('empty doc + no local files → "empty" (nothing to seed)', () => {
    const doc = new Y.Doc();
    expect(migrateSeed({ slug: 's', doc, paths: paths() })).toBe('empty');
    expect(docIsEmpty(doc)).toBe(true);
  });
});

describe('migrateSeed — idempotent (no duplication on re-run)', () => {
  test('adopting twice leaves comments un-duplicated', () => {
    const p = paths();
    writeFileSync(
      p.comments,
      JSON.stringify([
        { id: 'c1', text: 'x' },
        { id: 'c2', text: 'y' },
      ])
    );

    const doc = new Y.Doc();
    expect(migrateSeed({ slug: 's', doc, paths: p })).toBe('local-adopt');
    expect(doc.getArray(Y_TYPES.comments).length).toBe(2);

    // Second run (e.g. server restart): the doc is now non-empty → hub-wins
    // branch → no re-adopt → still exactly 2 comments, byte-identical.
    expect(migrateSeed({ slug: 's', doc, paths: p })).toBe('hub-wins');
    expect(doc.getArray(Y_TYPES.comments).toArray()).toEqual([
      { id: 'c1', text: 'x' },
      { id: 'c2', text: 'y' },
    ]);
  });
});

describe('room file-seed disable (the other half of the Risk-1 fix)', () => {
  test('persistence.seed is a no-op for a pinned slug — never touches api or the doc', async () => {
    let apiCalled = false;
    // Minimal api stub; seed must short-circuit before reaching it.
    const api = {
      loadCommentsForFile: async () => {
        apiCalled = true;
        return [];
      },
      loadAnnotations: async () => {
        apiCalled = true;
        return null;
      },
    } as unknown as import('../api.ts').Api;
    const ctx = { paths: { designRoot: dir } } as unknown as Context;

    const persistence = createPersistence({
      ctx,
      api,
      fileForSlug: async () => 'ui/x.html',
      // Mirrors createCollab's predicate: don't seed a pinned (provider-attached)
      // slug under sharedDoc — the migrate-seed + provider own population.
      shouldSeed: (slug) => slug !== 'pinned',
    });

    const doc = new Y.Doc();
    await persistence.seed('pinned', doc);
    // Returned before touching the api or mutating the doc → no duplicate items
    // can be introduced by the file-seed after the migrate-seed ran.
    expect(apiCalled).toBe(false);
    expect(docIsEmpty(doc)).toBe(true);
  });
});

describe('migrateSeed — hub-wins (the duplication trap avoided)', () => {
  test('a doc already holding hub comments is NOT merged with the local file → no dup', () => {
    const p = paths();
    // Local file (e.g. copied via git) holds the SAME logical comment id…
    writeFileSync(p.comments, JSON.stringify([{ id: 'c1', text: 'from disk' }]));

    // …but the doc already received it from the hub (a DIFFERENT CRDT item).
    const doc = new Y.Doc();
    applyCommentsToDoc(doc, [{ id: 'c1', text: 'from hub' }], 'hub');

    const result = migrateSeed({ slug: 's', doc, paths: p });

    // Hub wins; the local file is NOT pushed as a second item — exactly ONE c1.
    expect(result).toBe('hub-wins');
    expect(doc.getArray(Y_TYPES.comments).toArray()).toEqual([{ id: 'c1', text: 'from hub' }]);
  });

  test('snapshots divergent local files to historyDir before the hub-wins overwrite', () => {
    const p = paths();
    writeFileSync(p.html, '<main>LOCAL divergent</main>');
    writeFileSync(p.comments, JSON.stringify([{ id: 'local' }]));

    const doc = new Y.Doc();
    applyHtmlToDoc(doc, '<main>HUB</main>', 'hub'); // doc holds hub state

    const historyDir = join(dir, '_history', 's');
    const result = migrateSeed({ slug: 's', doc, paths: p, historyDir });

    expect(result).toBe('hub-wins');
    // The pre-migration snapshot captured the local files for rollback.
    const snapped = readdirSync(join(historyDir, 'pre-shared-doc-migration'));
    expect(snapped).toContain('screen.html');
    expect(snapped).toContain('screen.comments.json');
  });
});
