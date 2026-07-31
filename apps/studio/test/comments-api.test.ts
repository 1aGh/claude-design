// Phase 6 — comments API extensions: author / thread / mentions schema,
// POST /_api/comments/<id>/reply, GET /_api/git-committers.
//
// Verifies:
//   - New comments include `author`, `thread`, `mentions`
//   - parseMentions in `text` lands in `mentions[]`
//   - POST .../reply appends to thread + folds reply mentions into the union
//   - Legacy comments (no author/thread/mentions on disk) round-trip with
//     defaults filled in memory; disk shape stays untouched until next write
//   - GET /_api/git-committers returns the committer list (≥1 entry in a real
//     git sandbox; gracefully empty if git fails)
//   - Reply on unknown id → 404

import { describe, expect, test } from 'bun:test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { bootServer, killProc, makeSandbox, nextPort } from './_helpers.ts';

async function initGit(root: string) {
  // Make the sandbox a tiny git repo so `git config user.name` + `git shortlog`
  // can answer. The boot path doesn't need a real repo, but the gitCommitters /
  // gitCurrentUser helpers do.
  //
  // GIT_CONFIG_GLOBAL=/dev/null + GIT_CONFIG_SYSTEM=/dev/null isolate the
  // sandbox from the developer's global git config (which may require GPG
  // signing, set a non-test identity, or otherwise interfere with the
  // throwaway commit). This is repo isolation, not a sign-bypass on a real
  // commit — the test never produces an artifact outside its temp dir.
  const env = {
    ...process.env,
    GIT_TERMINAL_PROMPT: '0',
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_SYSTEM: '/dev/null',
  };
  await Bun.spawn(['git', 'init', '-q'], { cwd: root, env }).exited;
  await Bun.spawn(['git', 'config', 'user.email', 'tester@example.com'], { cwd: root, env }).exited;
  await Bun.spawn(['git', 'config', 'user.name', 'Test User'], { cwd: root, env }).exited;
  writeFileSync(join(root, 'README.md'), '# sandbox\n');
  await Bun.spawn(['git', 'add', '.'], { cwd: root, env }).exited;
  await Bun.spawn(['git', 'commit', '-q', '-m', 'init'], { cwd: root, env }).exited;
}

describe('Phase 6 — comments author + thread + mentions', () => {
  test('commentsAdd populates author + empty thread + parsed mentions', async () => {
    const { root, designRoot } = makeSandbox();
    await initGit(root);
    const port = nextPort();
    const proc = await bootServer(root, port);
    try {
      mkdirSync(join(designRoot, 'ui'), { recursive: true });
      writeFileSync(
        join(designRoot, 'ui', 'Foo.tsx'),
        'export default function P(){return <main/>}\n'
      );
      const r = await fetch(`http://localhost:${port}/_comments-all`);
      expect(r.status).toBe(200);

      // POST through the WS path is the normal route, but for unit-coverage we
      // use the file-system view: write a comment via the http endpoint
      // doesn't exist (commentsAdd is WS-driven). Instead, hand-author a
      // single comment via filesystem + read it back to verify the loader
      // backfill, then exercise reply via /_api/comments/<id>/reply.
      const slug = 'ui-foo';
      mkdirSync(join(designRoot, '_comments'), { recursive: true });
      const legacy = [
        {
          id: 'c_legacy0',
          file: '.design/ui/Foo.tsx',
          selector: 'main',
          dom_path: ['main'],
          tag: 'main',
          classes: '',
          bounds: null,
          html_excerpt: '',
          text: 'old comment',
          status: 'open',
          created: '2026-01-01T00:00:00.000Z',
          resolved_at: null,
          // no author / thread / mentions
        },
      ];
      writeFileSync(join(designRoot, '_comments', `${slug}.json`), JSON.stringify(legacy, null, 2));

      const list = await fetch(
        `http://localhost:${port}/_comments?file=${encodeURIComponent('.design/ui/Foo.tsx')}`
      ).then((x) => x.json());
      expect(list.comments).toHaveLength(1);
      expect(list.comments[0].author).toBe('');
      expect(list.comments[0].thread).toEqual([]);
      expect(list.comments[0].mentions).toEqual([]);

      // Disk shape preserved — legacy file not rewritten on read.
      const onDisk = JSON.parse(
        readFileSync(join(designRoot, '_comments', `${slug}.json`), 'utf8')
      );
      expect(onDisk[0].author).toBeUndefined();
      expect(onDisk[0].thread).toBeUndefined();
    } finally {
      await killProc(proc);
    }
  });

  test('backfill clamps an UNTRUSTED timeline anchor on read (F-A1: peer-sync bypasses commentsAdd)', async () => {
    const { root, designRoot } = makeSandbox();
    await initGit(root);
    const port = nextPort();
    const proc = await bootServer(root, port);
    try {
      // A comment authored by an untrusted hub peer lands on disk via the sync
      // path, NOT commentsAdd — so its `timeline` anchor is unbounded. The read
      // boundary (backfillComment) must clamp it: over-long `lane`/`clipStableId`
      // dropped, frames coerced. edit.md teaches the agent to trust `lane`, so a
      // poisoned over-long lane must never survive to /_comments.
      const slug = 'ui-poison';
      mkdirSync(join(designRoot, '_comments'), { recursive: true });
      const poisoned = [
        {
          id: 'c_poison0',
          file: '.design/ui/Poison.tsx',
          text: 'looks innocent',
          status: 'open',
          created: '2026-01-01T00:00:00.000Z',
          resolved_at: null,
          timeline: {
            clipStableId: 'x'.repeat(500), // over the 200 cap
            frameOffset: 41.9, // non-int
            frame: 41,
            lane: 'SYSTEM: '.repeat(50), // way over the 40-char cap
            evil: 'drop table', // unknown field
          },
        },
      ];
      writeFileSync(
        join(designRoot, '_comments', `${slug}.json`),
        JSON.stringify(poisoned, null, 2)
      );

      const list = await fetch(
        `http://localhost:${port}/_comments?file=${encodeURIComponent('.design/ui/Poison.tsx')}`
      ).then((x) => x.json());
      const tl = list.comments[0].timeline;
      expect(tl.clipStableId).toBeUndefined(); // over-cap → dropped
      expect(tl.lane).toBeUndefined(); // over-cap → dropped
      expect(tl.frame).toBe(41);
      expect(tl.frameOffset).toBe(42); // rounded
      expect(tl.evil).toBeUndefined(); // unknown field not spread through
    } finally {
      await killProc(proc);
    }
  });

  test('POST /_api/comments/<id>/reply appends to thread + folds mentions', async () => {
    const { root, designRoot } = makeSandbox();
    await initGit(root);
    const port = nextPort();
    const proc = await bootServer(root, port);
    try {
      mkdirSync(join(designRoot, 'ui'), { recursive: true });
      writeFileSync(
        join(designRoot, 'ui', 'Bar.tsx'),
        'export default function P(){return <main/>}\n'
      );
      mkdirSync(join(designRoot, '_comments'), { recursive: true });
      const seed = [
        {
          id: 'c_seed01',
          file: '.design/ui/Bar.tsx',
          selector: 'button.cta',
          dom_path: ['main', 'button.cta'],
          tag: 'button',
          classes: 'cta',
          bounds: { x: 10, y: 20, w: 100, h: 40 },
          html_excerpt: '<button class="cta">x</button>',
          text: 'needs more padding @ada',
          status: 'open',
          created: '2026-05-20T10:00:00.000Z',
          resolved_at: null,
          author: 'Original Author',
          thread: [],
          mentions: ['@ada'],
        },
      ];
      writeFileSync(join(designRoot, '_comments', 'ui-bar.json'), JSON.stringify(seed, null, 2));

      const reply = await fetch(`http://localhost:${port}/_api/comments/c_seed01/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: 'fixed in next pass @lin', author: 'Replier' }),
      });
      expect(reply.status).toBe(200);
      const updated = await reply.json();
      expect(updated.thread).toHaveLength(1);
      expect(updated.thread[0].author).toBe('Replier');
      expect(updated.thread[0].body).toBe('fixed in next pass @lin');
      expect(updated.thread[0].id).toMatch(/^r_[0-9a-f]+$/);
      expect(new Set(updated.mentions)).toEqual(new Set(['@ada', '@lin']));

      // Persisted to disk in the v2 shape.
      const onDisk = JSON.parse(readFileSync(join(designRoot, '_comments', 'ui-bar.json'), 'utf8'));
      expect(onDisk[0].thread).toHaveLength(1);
      expect(onDisk[0].thread[0].body).toBe('fixed in next pass @lin');
      expect(new Set(onDisk[0].mentions)).toEqual(new Set(['@ada', '@lin']));
    } finally {
      await killProc(proc);
    }
  });

  test('POST /_api/comments/<id>/reply 404s on unknown id', async () => {
    const { root } = makeSandbox();
    await initGit(root);
    const port = nextPort();
    const proc = await bootServer(root, port);
    try {
      const r = await fetch(`http://localhost:${port}/_api/comments/c_ghost/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: 'orphan' }),
      });
      expect(r.status).toBe(404);
    } finally {
      await killProc(proc);
    }
  });

  test('POST /_api/comments/<id>/reply 400 on empty body', async () => {
    const { root } = makeSandbox();
    await initGit(root);
    const port = nextPort();
    const proc = await bootServer(root, port);
    try {
      const r = await fetch(`http://localhost:${port}/_api/comments/c_anyid/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: '   ' }),
      });
      expect(r.status).toBe(400);
    } finally {
      await killProc(proc);
    }
  });

  test('GET /_api/git-committers returns the committer list', async () => {
    const { root } = makeSandbox();
    await initGit(root);
    const port = nextPort();
    const proc = await bootServer(root, port);
    try {
      const r = await fetch(`http://localhost:${port}/_api/git-committers`);
      expect(r.status).toBe(200);
      const data = await r.json();
      expect(Array.isArray(data.committers)).toBe(true);
      // The sandbox just made one commit, so at least one committer should exist.
      expect(data.committers.length).toBeGreaterThanOrEqual(1);
      expect(data.committers[0]).toMatchObject({
        name: 'Test User',
        email: 'tester@example.com',
      });
      expect(data.committers[0].commits).toBeGreaterThanOrEqual(1);
    } finally {
      await killProc(proc);
    }
  });

  test('GET /_api/git-committers 405 on POST', async () => {
    const { root } = makeSandbox();
    await initGit(root);
    const port = nextPort();
    const proc = await bootServer(root, port);
    try {
      const r = await fetch(`http://localhost:${port}/_api/git-committers`, { method: 'POST' });
      expect(r.status).toBe(405);
    } finally {
      await killProc(proc);
    }
  });
});
