// Phase 9.2 (DDR-064) Phase E — the one-time authoritative seed (Task 9).
//
// Pins the fix for Risk 1, the duplication-on-merge trap: a shared doc must be
// populated from ONE source. These tests prove migrateSeed never duplicates
// comments and is idempotent across re-runs (server restarts).

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as Y from 'yjs';

import { createPersistence, Y_TYPES } from '../collab/persistence.ts';
import type { Context } from '../context.ts';
import { applyCommentsToDoc, applyCssToDoc, applyHtmlToDoc } from '../sync/codec.ts';
import { hashBytes } from '../sync/echo-guard.ts';
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
  test('seeds an empty doc from local files and reports local-adopt', async () => {
    const p = paths();
    writeFileSync(p.html, '<main>local body</main>');
    writeFileSync(p.comments, JSON.stringify([{ id: 'c1', text: 'local' }]));

    const doc = new Y.Doc();
    const result = await migrateSeed({ slug: 's', doc, paths: p });

    expect(result).toBe('local-adopt');
    expect(doc.getText('html').toString()).toBe('<main>local body</main>');
    expect(doc.getArray(Y_TYPES.comments).toArray()).toEqual([{ id: 'c1', text: 'local' }]);
  });

  test('empty doc + no local files → "empty" (nothing to seed)', async () => {
    const doc = new Y.Doc();
    expect(await migrateSeed({ slug: 's', doc, paths: paths() })).toBe('empty');
    expect(docIsEmpty(doc)).toBe(true);
  });
});

describe('migrateSeed — idempotent (no duplication on re-run)', () => {
  test('adopting twice leaves comments un-duplicated', async () => {
    const p = paths();
    writeFileSync(
      p.comments,
      JSON.stringify([
        { id: 'c1', text: 'x' },
        { id: 'c2', text: 'y' },
      ])
    );

    const doc = new Y.Doc();
    expect(await migrateSeed({ slug: 's', doc, paths: p })).toBe('local-adopt');
    expect(doc.getArray(Y_TYPES.comments).length).toBe(2);

    // Second run (e.g. server restart): the doc is now non-empty → hub-wins
    // branch → no re-adopt → still exactly 2 comments, byte-identical.
    expect(await migrateSeed({ slug: 's', doc, paths: p })).toBe('hub-wins');
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
  test('a doc already holding hub comments is NOT merged with the local file → no dup', async () => {
    const p = paths();
    // Local file (e.g. copied via git) holds the SAME logical comment id…
    writeFileSync(p.comments, JSON.stringify([{ id: 'c1', text: 'from disk' }]));

    // …but the doc already received it from the hub (a DIFFERENT CRDT item).
    const doc = new Y.Doc();
    applyCommentsToDoc(doc, [{ id: 'c1', text: 'from hub' }], 'hub');

    const result = await migrateSeed({ slug: 's', doc, paths: p });

    // Hub wins; the local file is NOT pushed as a second item — exactly ONE c1
    // (DDR-102 id-union keeps the doc's version for a shared id).
    expect(result).toBe('hub-wins');
    expect(doc.getArray(Y_TYPES.comments).toArray()).toEqual([{ id: 'c1', text: 'from hub' }]);
  });

  test('snapshots divergent local files to historyDir before the hub-wins overwrite', async () => {
    const p = paths();
    writeFileSync(p.html, '<main>LOCAL divergent</main>');
    writeFileSync(p.comments, JSON.stringify([{ id: 'local' }]));

    const doc = new Y.Doc();
    applyHtmlToDoc(doc, '<main>HUB</main>', 'hub'); // doc holds hub state

    const historyDir = join(dir, '_history', 's');
    // DDR-102: this divergence (no journal, no doc stamp) resolves
    // conflict-hub-wins — the legacy whole-set safety copy still happens.
    const result = await migrateSeed({ slug: 's', doc, paths: p, historyDir });

    expect(result).toBe('conflict-hub-wins');
    // The pre-migration snapshot captured the local files for rollback.
    const snapped = readdirSync(join(historyDir, 'pre-shared-doc-migration'));
    expect(snapped).toContain('screen.html');
    expect(snapped).toContain('screen.comments.json');
  });
});

// ---------------------------------------------------------------------------
// DDR-102 — the shared-doc path consumes the same cold-start decision table:
// journal-gated fast-forward, dual snapshot + newest-wins on divergence,
// comments id-union.
describe('migrateSeed — DDR-102 divergence matrix', () => {
  function makeJournal(initial: Record<string, { bodyHash: string }> = {}) {
    const entries = new Map(Object.entries(initial));
    return {
      get: (slug: string) => entries.get(slug) ?? null,
      record: (slug: string, hashes: { bodyHash?: string; cssHash?: string }) => {
        const prev = entries.get(slug);
        entries.set(slug, { bodyHash: hashes.bodyHash ?? prev?.bodyHash ?? '' });
      },
      invalidateIfHubChanged: () => {},
      flush: () => {},
      stop: () => {},
      size: () => entries.size,
    };
  }

  test('journal match → fast-forward (hub keeps), no snapshot, no conflict', async () => {
    const p = paths();
    writeFileSync(p.html, '<main>synced-v1</main>');
    const doc = new Y.Doc();
    applyHtmlToDoc(doc, '<main>hub-v2</main>', 'hub');

    const journal = makeJournal({ s: { bodyHash: hashBytes('<main>synced-v1</main>') } });
    const snapshots: string[] = [];
    const conflicts: unknown[] = [];
    const result = await migrateSeed({
      slug: 's',
      doc,
      paths: p,
      journal,
      snapshot: async (_c, reason) => {
        snapshots.push(reason);
        return 'ts';
      },
      onConflict: (info) => {
        conflicts.push(info);
      },
    });

    expect(result).toBe('hub-wins');
    expect(doc.getText('html').toString()).toBe('<main>hub-v2</main>'); // doc untouched
    expect(snapshots).toHaveLength(0);
    expect(conflicts).toHaveLength(0);
  });

  test('diverged + local newer → conflict-local-wins: doc REBUILT from local in one MIGRATION tx', async () => {
    const p = paths();
    writeFileSync(p.html, '<main>local-newer</main>');
    writeFileSync(p.css, '.local{}');
    const doc = new Y.Doc();
    doc.transact(() => {
      applyHtmlToDoc(doc, '<main>hub-older</main>', 'hub');
      applyCssToDoc(doc, '.hub{}', 'hub');
      doc.getMap('syncMeta').set('bodyEditAt', Date.now() - 60_000);
    });

    const snapshots: Array<{ content: string; reason: string }> = [];
    const conflicts: Array<{ winner?: string; snapshots?: { local?: string; hub?: string } }> = [];
    const result = await migrateSeed({
      slug: 's',
      doc,
      paths: p,
      journal: makeJournal(),
      snapshot: async (content, reason) => {
        snapshots.push({ content, reason });
        return `ts-${snapshots.length}`;
      },
      onConflict: (info) => {
        conflicts.push(info);
      },
    });

    expect(result).toBe('conflict-local-wins');
    expect(doc.getText('html').toString()).toBe('<main>local-newer</main>');
    // css follows the body winner.
    expect(doc.getText('css').toString()).toBe('.local{}');
    // Dual snapshot captured BOTH pre-resolution versions.
    expect(snapshots.map((s) => s.reason)).toEqual(['pre-sync-local', 'pre-sync-hub']);
    expect(snapshots[0].content).toBe('<main>local-newer</main>');
    expect(snapshots[1].content).toBe('<main>hub-older</main>');
    expect(conflicts[0].winner).toBe('local');
    expect(conflicts[0].snapshots).toEqual({ local: 'ts-1', hub: 'ts-2' });
  });

  test('diverged + hub newer (stamp) → conflict-hub-wins: doc untouched', async () => {
    const p = paths();
    writeFileSync(p.html, '<main>local-older</main>');
    const doc = new Y.Doc();
    doc.transact(() => {
      applyHtmlToDoc(doc, '<main>hub-newer</main>', 'hub');
      doc.getMap('syncMeta').set('bodyEditAt', Date.now() + 60_000);
    });

    const conflicts: Array<{ winner?: string }> = [];
    const result = await migrateSeed({
      slug: 's',
      doc,
      paths: p,
      journal: makeJournal(),
      onConflict: (info) => {
        conflicts.push(info);
      },
    });

    expect(result).toBe('conflict-hub-wins');
    expect(doc.getText('html').toString()).toBe('<main>hub-newer</main>');
    expect(conflicts[0].winner).toBe('hub');
  });

  test('doc holds comments but NO body + local body → body-seed-up (gap closed)', async () => {
    const p = paths();
    writeFileSync(p.html, '<main>only-local-body</main>');
    const doc = new Y.Doc();
    doc.getArray(Y_TYPES.comments).push([{ id: 'h1' }]); // doc non-empty, body empty

    const result = await migrateSeed({ slug: 's', doc, paths: p, journal: makeJournal() });

    expect(result).toBe('body-seed-up');
    expect(doc.getText('html').toString()).toBe('<main>only-local-body</main>');
    // Hub comments survive untouched.
    expect(doc.getArray(Y_TYPES.comments).toArray()).toEqual([{ id: 'h1' }]);
  });

  test('comments id-union: local-only comments survive a hub-wins cutover', async () => {
    const p = paths();
    writeFileSync(p.html, '<main>same</main>');
    writeFileSync(
      p.comments,
      JSON.stringify([
        { id: 'c1', text: 'shared' },
        { id: 'c3', text: 'local-only' },
      ])
    );
    const doc = new Y.Doc();
    doc.transact(() => {
      applyHtmlToDoc(doc, '<main>same</main>', 'hub');
      applyCommentsToDoc(
        doc,
        [
          { id: 'c1', text: 'shared (hub copy wins)' },
          { id: 'c2', text: 'hub-only' },
        ],
        'hub'
      );
    });

    const result = await migrateSeed({ slug: 's', doc, paths: p });

    expect(result).toBe('hub-wins');
    expect(doc.getArray(Y_TYPES.comments).toArray()).toEqual([
      { id: 'c1', text: 'shared (hub copy wins)' },
      { id: 'c2', text: 'hub-only' },
      { id: 'c3', text: 'local-only' },
    ]);
  });
});

// DDR-102 fail-closed (security review F1) — the shared-doc path must also
// refuse a hub-wins cutover when the local snapshot didn't land.
describe('migrateSeed — fail-closed on snapshot failure (DDR-102 F1)', () => {
  function makeJournal() {
    const entries = new Map<string, { bodyHash: string }>();
    return {
      get: (slug: string) => entries.get(slug) ?? null,
      record: (slug: string, h: { bodyHash?: string; cssHash?: string }) =>
        entries.set(slug, { bodyHash: h.bodyHash ?? entries.get(slug)?.bodyHash ?? '' }),
      invalidateIfHubChanged: () => {},
      flush: () => {},
      stop: () => {},
      size: () => entries.size,
    };
  }

  test('hub newer BUT local snapshot null → rebuild doc from local (no overwrite), conflict-local-wins', async () => {
    const p = paths();
    writeFileSync(p.html, '<main>local-work</main>');
    const doc = new Y.Doc();
    doc.transact(() => {
      applyHtmlToDoc(doc, '<main>hub-stale</main>', 'hub');
      doc.getMap('syncMeta').set('bodyEditAt', Date.now() + 60_000); // hub would win
    });

    const conflicts: Array<{ winner?: string; snapshotFailed?: boolean }> = [];
    const result = await migrateSeed({
      slug: 's',
      doc,
      paths: p,
      journal: makeJournal(),
      snapshot: async () => null, // _history write fails
      onConflict: (info) => {
        conflicts.push(info);
      },
    });

    // Doc rebuilt from local → projection would write local back (no loss).
    expect(result).toBe('conflict-local-wins');
    expect(doc.getText('html').toString()).toBe('<main>local-work</main>');
    expect(conflicts[0].winner).toBe('local');
    expect(conflicts[0].snapshotFailed).toBe(true);
  });
});
