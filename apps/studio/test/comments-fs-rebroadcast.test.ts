// Issue #74 — `_comments/<slug>.json` written DIRECTLY on disk must reach
// already-open shells over WS.
//
// This pins EXISTING behaviour rather than covering a fix. `/design:edit`
// resolves comments with a plain jq-rewrite of the comments file (edit.md §3's
// documented recipe), which bypasses api.commentsPatch and so never fires the
// `onCommentsChanged` re-broadcast in server.ts. The broadcast happens anyway,
// from collab/index.ts's `fs:any` re-seed ("the sidebar still needs the
// 'comments' bus emit, so keep that unconditionally") — a non-obvious owner
// that a reader of server.ts alone would conclude was missing.
//
// It is worth locking down because the chat panel's "Implement N comments"
// quick action (issue #74) is built on it: the agent resolves comments by
// direct write, and if that stopped reaching open shells the button would keep
// counting comments that are already done, with nothing else failing.

import { describe, expect, test } from 'bun:test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { bootServer, killProc, makeSandbox, nextPort } from './_helpers.ts';

const FILE = '.design/ui/Foo.tsx';
const SLUG = 'ui-foo';

async function openWs(port: number): Promise<WebSocket> {
  const ws = new WebSocket(`ws://localhost:${port}/_ws`);
  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('ws open timeout')), 2000);
    ws.addEventListener('open', () => {
      clearTimeout(t);
      resolve();
    });
    ws.addEventListener('error', (e) => {
      clearTimeout(t);
      reject(e);
    });
  });
  return ws;
}

/** Resolve on the first `comments` frame for `file`, or null after `ms`. */
function nextCommentsFrame(
  ws: WebSocket,
  file: string,
  ms = 5000
): Promise<{ file: string; comments: Array<{ id: string; status: string }> } | null> {
  return new Promise((resolve) => {
    const done = (v: never | null) => {
      clearTimeout(timer);
      ws.removeEventListener('message', onMsg);
      resolve(v);
    };
    const timer = setTimeout(() => done(null), ms);
    const onMsg = (ev: MessageEvent) => {
      try {
        const m = JSON.parse(String(ev.data));
        if (m && m.type === 'comments' && m.file === file) done(m);
      } catch {
        /* non-JSON frame — ignore */
      }
    };
    ws.addEventListener('message', onMsg);
  });
}

function seedCanvas(designRoot: string) {
  mkdirSync(join(designRoot, 'ui'), { recursive: true });
  writeFileSync(join(designRoot, 'ui', 'Foo.tsx'), 'export default function P(){return <main/>}\n');
  mkdirSync(join(designRoot, '_comments'), { recursive: true });
}

function commentsJson(status: 'open' | 'resolved') {
  return JSON.stringify(
    [
      {
        id: 'c_one',
        file: FILE,
        selector: 'main',
        dom_path: ['main'],
        tag: 'main',
        classes: '',
        bounds: null,
        html_excerpt: '',
        text: 'tighten the padding',
        status,
        created: '2026-01-01T00:00:00.000Z',
        resolved_at: status === 'resolved' ? '2026-01-02T00:00:00.000Z' : null,
        author: 'Test User',
        thread: [],
        mentions: [],
      },
    ],
    null,
    2
  );
}

describe('issue #74 — comments file-watch re-broadcast', () => {
  test('a direct resolve-write broadcasts the updated list to open shells', async () => {
    const { root, designRoot } = makeSandbox();
    const port = nextPort();
    const proc = await bootServer(root, port);
    try {
      seedCanvas(designRoot);
      const commentsFile = join(designRoot, '_comments', `${SLUG}.json`);
      writeFileSync(commentsFile, commentsJson('open'));

      const ws = await openWs(port);
      // Clear the fs-watch per-path debounce window (50 ms) so the resolve
      // write below is seen as its own event rather than folded into the seed.
      await Bun.sleep(150);

      const frame = nextCommentsFrame(ws, FILE);
      // Exactly what edit.md §3's resolve recipe does: rewrite the file in
      // place, never touching the API.
      writeFileSync(commentsFile, commentsJson('resolved'));

      const got = await frame;
      ws.close();

      expect(got).not.toBeNull();
      expect(got!.comments).toHaveLength(1);
      expect(got!.comments[0]!.id).toBe('c_one');
      expect(got!.comments[0]!.status).toBe('resolved');
    } finally {
      await killProc(proc);
    }
  }, 20000);

  test('a comments file for an unknown slug is ignored, not fatal', async () => {
    const { root, designRoot } = makeSandbox();
    const port = nextPort();
    const proc = await bootServer(root, port);
    try {
      seedCanvas(designRoot);
      const ws = await openWs(port);
      await Bun.sleep(150);

      // No canvas resolves to this slug — the handler must bail quietly and
      // leave the server healthy.
      writeFileSync(
        join(designRoot, '_comments', 'ui-does-not-exist.json'),
        JSON.stringify([], null, 2)
      );
      await Bun.sleep(400);
      ws.close();

      const health = await fetch(`http://localhost:${port}/_health`);
      expect(health.ok).toBe(true);
    } finally {
      await killProc(proc);
    }
  }, 20000);
});
