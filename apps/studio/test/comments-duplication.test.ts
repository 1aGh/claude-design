// Issue #112 — a comment must never appear twice, and resolving it must
// resolve it.
//
// The sync half of this lives in `sync-seed-duplication.test.ts` (the
// convergence law over the Y.Array). This file pins the two BOUNDARIES that
// stand between a duplicated CRDT array and a human:
//
//   1. disk — `loadCommentsForFile` / `saveCommentsForFile`, the choke point
//      every writer (API mutations AND the collab room's `persistJson`) passes
//      through. A project whose `_comments/<slug>.json` was already doubled by
//      a pre-fix release must HEAL when it is next read or written, not stay
//      broken forever.
//   2. mutations — the reporter's second symptom. `commentsPatch` used to
//      `findIndex` + `return`, so "resolve" marked copy 1 of 8 and the overlay
//      (which filters `status !== 'resolved'`) kept drawing the other seven.
//      Resolve must leave ZERO open entries; delete must remove every copy.
//
// Plus the room seed, the third writer that could concatenate: it pushed the
// local file into the Y.Array unconditionally, which duplicates whenever the
// doc already holds the hub's copy (the DDR-064 Risk 1 window that
// `shouldSeed`/`isPinned` only closes when the pin already exists).

import { describe, expect, test } from 'bun:test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as Y from 'yjs';

import { createApi } from '../api.ts';
import { createPersistence, Y_TYPES } from '../collab/persistence.ts';
import { type Context, createBus } from '../context.ts';
import { makeSandbox } from './_helpers.ts';

function mkCtx(root: string, designRoot: string): Context {
  return {
    cfg: {} as Context['cfg'],
    projectLabel: 'test',
    bus: createBus(),
    paths: {
      repoRoot: root,
      designRel: '.design',
      designRoot,
      serverInfoFile: join(designRoot, '_server.json'),
      activeFile: join(designRoot, '_active.json'),
      commentsDir: join(designRoot, '_comments'),
      canvasStateDir: join(designRoot, '_canvas-state'),
      historyDir: join(designRoot, '_history'),
      tokensUrlRel: '',
      systemDirRel: 'system',
    },
  };
}

const FILE = '.design/ui/Foo.tsx';
const SLUG = 'ui-foo';

function comment(id: string, over: Record<string, unknown> = {}) {
  return {
    id,
    file: FILE,
    selector: 'main',
    index: undefined,
    dom_path: ['main'],
    tag: 'main',
    classes: '',
    bounds: null,
    html_excerpt: '',
    text: `comment ${id}`,
    status: 'open',
    created: '2026-01-01T00:00:00.000Z',
    resolved_at: null,
    author: 'Test User',
    thread: [],
    mentions: [],
    ...over,
  };
}

/** A sandbox holding `_comments/ui-foo.json` with `list` written verbatim —
 *  the shape a pre-fix release left on disk. */
function rig(list: unknown[]) {
  const { root, designRoot } = makeSandbox();
  mkdirSync(join(designRoot, 'ui'), { recursive: true });
  writeFileSync(join(designRoot, 'ui', 'Foo.tsx'), 'export default function P(){return <main/>}\n');
  mkdirSync(join(designRoot, '_comments'), { recursive: true });
  const commentsFile = join(designRoot, '_comments', `${SLUG}.json`);
  writeFileSync(commentsFile, JSON.stringify(list, null, 2));
  const ctx = mkCtx(root, designRoot);
  const api = createApi(ctx, { onCommentsChanged: () => {} });
  const onDisk = () => JSON.parse(readFileSync(commentsFile, 'utf8')) as { id: string }[];
  return { root, designRoot, ctx, api, onDisk };
}

/** The reporter's state: one comment, eight copies (1 → 2 → 4 → 8). */
const EIGHT = Array.from({ length: 8 }, () => comment('c1'));

describe('issue #112 — the disk boundary heals a duplicated comment file', () => {
  test('loadCommentsForFile returns ONE entry for an 8× duplicated file', async () => {
    const { api } = rig(EIGHT);
    const list = await api.loadCommentsForFile(FILE);
    expect(list).toHaveLength(1);
    expect(list[0]!.id).toBe('c1');
  });

  test('two distinct comments survive; only the copies are dropped', async () => {
    const { api } = rig([comment('c1'), comment('c2'), comment('c1'), comment('c2')]);
    const list = await api.loadCommentsForFile(FILE);
    expect(list.map((c) => c.id)).toEqual(['c1', 'c2']);
  });

  test('saveCommentsForFile refuses to persist duplicates', async () => {
    const { api, onDisk } = rig([]);
    await api.saveCommentsForFile(FILE, EIGHT as never);
    expect(onDisk()).toHaveLength(1);
  });

  test('a duplicated file heals on the next write', async () => {
    // The upgrade path for a project already corrupted in the field: nothing
    // needs a migration, the first mutation collapses it.
    const { api, onDisk } = rig(EIGHT);
    expect(onDisk()).toHaveLength(8); // premise
    await api.commentsPatch('c1', { status: 'resolved' });
    expect(onDisk()).toHaveLength(1);
  });

  test('the first occurrence is the one kept (agrees with unionCommentsById)', async () => {
    const { api } = rig([comment('c1', { text: 'original' }), comment('c1', { text: 'copy' })]);
    const list = await api.loadCommentsForFile(FILE);
    expect(list).toHaveLength(1);
    expect(list[0]!.text).toBe('original');
  });
});

describe('issue #112 — resolving actually resolves', () => {
  test('patch leaves ZERO open entries against an 8× duplicated file', async () => {
    const { api, onDisk } = rig(EIGHT);
    const patched = await api.commentsPatch('c1', { status: 'resolved' });
    expect(patched?.status).toBe('resolved');

    // What the overlay reads. It renders every entry with status !== resolved,
    // so a single straggler is a pin the user cannot get rid of.
    const list = await api.loadCommentsForFile(FILE);
    expect(list.filter((c) => c.status !== 'resolved')).toEqual([]);
    expect(onDisk().every((c) => (c as { status: string }).status === 'resolved')).toBe(true);
  });

  test('re-opening a resolved comment is equally total', async () => {
    const { api } = rig(EIGHT);
    await api.commentsPatch('c1', { status: 'resolved' });
    await api.commentsPatch('c1', { status: 'open' });
    const list = await api.loadCommentsForFile(FILE);
    expect(list.filter((c) => c.status !== 'open')).toEqual([]);
  });

  test('delete removes EVERY copy, not one per click', async () => {
    const { api, onDisk } = rig(EIGHT);
    expect(await api.commentsDelete('c1')).toBe(true);
    expect(onDisk()).toHaveLength(0);
    expect(await api.commentsDelete('c1')).toBe(false); // nothing left to delete
  });

  test('delete leaves the other comments alone', async () => {
    const { api, onDisk } = rig([comment('c1'), comment('c2'), comment('c1')]);
    expect(await api.commentsDelete('c1')).toBe(true);
    expect(onDisk().map((c) => c.id)).toEqual(['c2']);
  });

  test('a reply lands exactly once, not once per copy', async () => {
    const { api } = rig(EIGHT);
    const entry = await api.commentsAddReply('c1', { body: 'on it', author: 'Test User' });
    expect(entry?.thread).toHaveLength(1);
    const list = await api.loadCommentsForFile(FILE);
    expect(list).toHaveLength(1);
    expect(list[0]!.thread).toHaveLength(1);
  });
});

describe('issue #112 — the room seed cannot concatenate', () => {
  test('seeding into a doc that already holds the comments is a no-op', async () => {
    const { ctx, api } = rig([comment('c1'), comment('c2')]);
    const persistence = createPersistence({
      ctx,
      api,
      fileForSlug: async () => FILE,
    });

    const doc = new Y.Doc();
    // First seed populates (a room opening with no hub state).
    await persistence.seed(SLUG, doc);
    expect(doc.getArray(Y_TYPES.comments).toArray()).toHaveLength(2);

    // Second seed is the collision: the doc already carries the hub's copy by
    // the time the local file-seed runs. Unconditional `arr.push` doubled it.
    await persistence.seed(SLUG, doc);
    expect(doc.getArray(Y_TYPES.comments).toArray()).toHaveLength(2);
  });

  test('a seed still adds comments the doc is missing', async () => {
    const { ctx, api } = rig([comment('c1'), comment('c2')]);
    const persistence = createPersistence({
      ctx,
      api,
      fileForSlug: async () => FILE,
    });

    const doc = new Y.Doc();
    doc.getArray<unknown>(Y_TYPES.comments).push([comment('c1')]); // hub had one
    await persistence.seed(SLUG, doc);
    const ids = (doc.getArray(Y_TYPES.comments).toArray() as { id: string }[]).map((c) => c.id);
    expect(ids).toEqual(['c1', 'c2']);
  });
});
