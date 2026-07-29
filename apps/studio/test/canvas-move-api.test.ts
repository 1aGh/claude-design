// /_api/fs-move — feature-file-tree-drag-drop-folders (Task 3). Covers the
// HTTP round-trip (happy path, containment, DS refusal, collision, full
// re-key across every sidecar) plus, in-process (no server boot needed), the
// collab-pin refusal — the one guard an HTTP-only black-box test can't drive,
// since pinning a room requires reaching into the dev-server's in-memory
// collab registry.

import { describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { createApi } from '../api.ts';
import { type Context, createBus } from '../context.ts';
import { bootServer, killProc, makeSandbox, nextPort } from './_helpers.ts';

async function createBoard(port: number, name: string, group?: string) {
  const r = await fetch(`http://localhost:${port}/_api/canvas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, kind: 'brief-board', group }),
  });
  return (await r.json()) as { file: string; rel: string; slug: string };
}

function move(port: number, file: string, toDir: string) {
  return fetch(`http://localhost:${port}/_api/fs-move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file, toDir }),
  });
}

describe('/_api/fs-move — POST round-trip', () => {
  test('happy path: relocates the primary + meta into the destination dir', async () => {
    const { root, designRoot } = makeSandbox();
    const port = nextPort();
    const proc = await bootServer(root, port);
    try {
      const created = await createBoard(port, 'Movable');
      const r = await move(port, created.rel, 'ui/sub');
      expect(r.status).toBe(200);
      const j = (await r.json()) as {
        ok: boolean;
        fromRel: string;
        toRel: string;
        fromSlug: string;
        toSlug: string;
        moved: string[];
      };
      expect(j.ok).toBe(true);
      expect(j.toRel).toBe('ui/sub/Movable.tsx');
      expect(j.fromSlug).toBe('ui-movable');
      expect(j.toSlug).toBe('ui-sub-movable');

      expect(existsSync(join(designRoot, 'ui', 'Movable.tsx'))).toBe(false);
      expect(existsSync(join(designRoot, 'ui', 'sub', 'Movable.tsx'))).toBe(true);
      expect(existsSync(join(designRoot, 'ui', 'sub', 'Movable.meta.json'))).toBe(true);
    } finally {
      await killProc(proc);
    }
  });

  test('full re-key: history, canvas-state view, comments, annotations, locator all follow the move', async () => {
    const { root, designRoot } = makeSandbox();
    const port = nextPort();
    const proc = await bootServer(root, port);
    try {
      const created = await createBoard(port, 'Full Rekey');
      const fromSlug = created.slug; // 'ui-full_rekey'

      mkdirSync(join(designRoot, '_history', fromSlug), { recursive: true });
      writeFileSync(join(designRoot, '_history', fromSlug, 'snap.json'), '{}');
      mkdirSync(join(designRoot, '_canvas-state'), { recursive: true });
      writeFileSync(
        join(designRoot, '_canvas-state', `${fromSlug}.view.json`),
        JSON.stringify({ viewport: { x: 1, y: 2, scale: 1 } })
      );
      mkdirSync(join(designRoot, '_comments'), { recursive: true });
      writeFileSync(join(designRoot, '_comments', `${fromSlug}.json`), '[]');
      writeFileSync(
        join(designRoot, `${fromSlug}.annotations.svg`),
        '<svg xmlns="http://www.w3.org/2000/svg" data-mdcc-annotations="1"></svg>'
      );
      const locatorAbs = join(designRoot, '_locator.json');
      const locatorKey = 'ui/Full Rekey'; // locatorKeyFor shape: posix, ext-less, NOT slugified
      writeFileSync(
        locatorAbs,
        JSON.stringify({ [locatorKey]: { a1b2c3d4: { canvas: '/x', line: 1, col: 0, jsxPath: [], componentName: '' } } })
      );

      const r = await move(port, created.rel, 'ui/nested');
      expect(r.status).toBe(200);
      const j = (await r.json()) as { toSlug: string };
      const toSlug = j.toSlug; // 'ui-nested-full_rekey'

      expect(existsSync(join(designRoot, '_history', toSlug, 'snap.json'))).toBe(true);
      expect(existsSync(join(designRoot, '_history', fromSlug))).toBe(false);
      expect(existsSync(join(designRoot, '_canvas-state', `${toSlug}.view.json`))).toBe(true);
      expect(existsSync(join(designRoot, '_canvas-state', `${fromSlug}.view.json`))).toBe(false);
      expect(existsSync(join(designRoot, '_comments', `${toSlug}.json`))).toBe(true);
      expect(existsSync(join(designRoot, `${toSlug}.annotations.svg`))).toBe(true);
      expect(existsSync(join(designRoot, `${fromSlug}.annotations.svg`))).toBe(false);

      const locator = JSON.parse(readFileSync(locatorAbs, 'utf8'));
      expect(locator['ui/nested/Full Rekey']).toBeDefined();
      expect(locator[locatorKey]).toBeUndefined();

      // Forensic log for the non-atomic move.
      expect(existsSync(join(designRoot, '_history', toSlug, '_move.json'))).toBe(true);
    } finally {
      await killProc(proc);
    }
  });

  test('containment: a toDir escaping the design root is rejected (400), nothing moved', async () => {
    const { root, designRoot } = makeSandbox();
    const port = nextPort();
    const proc = await bootServer(root, port);
    try {
      const created = await createBoard(port, 'Contained');
      const r = await move(port, created.rel, '../../../../tmp');
      expect(r.status).toBe(400);
      expect(existsSync(join(designRoot, 'ui', 'Contained.tsx'))).toBe(true);
    } finally {
      await killProc(proc);
    }
  });

  test('refuses moving a design-system canvas (400, untouched)', async () => {
    const { root, designRoot } = makeSandbox();
    const port = nextPort();
    const proc = await bootServer(root, port);
    try {
      mkdirSync(join(designRoot, 'system', 'project'), { recursive: true });
      const dsFile = join(designRoot, 'system', 'project', 'Spec.tsx');
      writeFileSync(dsFile, 'export default function S(){return null}');
      const r = await move(port, '.design/system/project/Spec.tsx', 'ui');
      expect(r.status).toBe(400);
      expect(existsSync(dsFile)).toBe(true);
    } finally {
      await killProc(proc);
    }
  });

  test('refuses moving INTO the design-system group (400, untouched)', async () => {
    const { root, designRoot } = makeSandbox();
    const port = nextPort();
    const proc = await bootServer(root, port);
    try {
      const created = await createBoard(port, 'Into DS');
      const r = await move(port, created.rel, 'system/project');
      expect(r.status).toBe(400);
      expect(existsSync(join(designRoot, 'ui', 'Into DS.tsx'))).toBe(true);
    } finally {
      await killProc(proc);
    }
  });

  test('a name collision at the destination returns 409, nothing moved', async () => {
    const { root, designRoot } = makeSandbox();
    const port = nextPort();
    const proc = await bootServer(root, port);
    try {
      const created = await createBoard(port, 'Dup');
      mkdirSync(join(designRoot, 'ui', 'sub'), { recursive: true });
      writeFileSync(
        join(designRoot, 'ui', 'sub', 'Dup.tsx'),
        'export default function D(){return null}'
      );
      const r = await move(port, created.rel, 'ui/sub');
      expect(r.status).toBe(409);
      expect(existsSync(join(designRoot, 'ui', 'Dup.tsx'))).toBe(true);
    } finally {
      await killProc(proc);
    }
  });

  test('a no-op move (same dir) is rejected with 400', async () => {
    const { root } = makeSandbox();
    const port = nextPort();
    const proc = await bootServer(root, port);
    try {
      const created = await createBoard(port, 'Same Dir');
      const r = await move(port, created.rel, 'ui');
      expect(r.status).toBe(400);
    } finally {
      await killProc(proc);
    }
  });

  test('a missing source canvas returns 404', async () => {
    const { root } = makeSandbox();
    const port = nextPort();
    const proc = await bootServer(root, port);
    try {
      const r = await move(port, 'ui/Nope.tsx', 'ui/sub');
      expect(r.status).toBe(404);
    } finally {
      await killProc(proc);
    }
  });

  test('emits a canvas-list-update "moved" action over the inspector WS', async () => {
    const { root } = makeSandbox();
    const port = nextPort();
    const proc = await bootServer(root, port);
    let socket: WebSocket | null = null;
    try {
      const messages: Array<{ type: string; payload?: Record<string, unknown> }> = [];
      const sock = new WebSocket(`ws://localhost:${port}/_ws`);
      socket = sock;
      await new Promise<void>((res, rej) => {
        sock.addEventListener('open', () => res());
        sock.addEventListener('error', () => rej(new Error('ws error')));
        setTimeout(() => rej(new Error('ws open timeout')), 2000);
      });
      sock.addEventListener('message', (ev) => {
        try {
          messages.push(JSON.parse(String(ev.data)));
        } catch {
          /* ignore */
        }
      });
      const created = await createBoard(port, 'Live Move');
      const r = await move(port, created.rel, 'ui/sub');
      expect(r.status).toBe(200);

      const deadline = Date.now() + 2000;
      let hit: (typeof messages)[number] | undefined;
      while (Date.now() < deadline && !hit) {
        hit = messages.find(
          (m) => m.type === 'canvas-list-update' && m.payload?.action === 'moved'
        );
        if (!hit) await Bun.sleep(25);
      }
      expect(hit?.payload?.toSlug ?? hit?.payload?.slug).toBeTruthy();
      expect(hit?.payload?.fromSlug).toBe('ui-live_move');
    } finally {
      try {
        socket?.close();
      } catch {
        /* ignore */
      }
      await killProc(proc);
    }
  }, 10_000);

  test('unknown method (GET) returns 405', async () => {
    const { root } = makeSandbox();
    const port = nextPort();
    const proc = await bootServer(root, port);
    try {
      const r = await fetch(`http://localhost:${port}/_api/fs-move`, { method: 'GET' });
      expect(r.status).toBe(405);
    } finally {
      await killProc(proc);
    }
  });

  test('rejects a cross-origin move (CSRF guard)', async () => {
    const { root } = makeSandbox();
    const port = nextPort();
    const proc = await bootServer(root, port);
    try {
      const created = await createBoard(port, 'Forge Move');
      const r = await fetch(`http://localhost:${port}/_api/fs-move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: 'http://evil.example' },
        body: JSON.stringify({ file: created.rel, toDir: 'ui/sub' }),
      });
      expect(r.status).toBe(403);
    } finally {
      await killProc(proc);
    }
  });
});

describe('/_api/fs-move — folder move (Task 11)', () => {
  test('moving a folder relocates every nested canvas + its sidecars', async () => {
    const { root, designRoot } = makeSandbox();
    const port = nextPort();
    const proc = await bootServer(root, port);
    try {
      await createBoard(port, 'One', 'ui');
      const r1 = await move(port, 'ui/One.tsx', 'ui/Src');
      expect(r1.status).toBe(200);
      await createBoard(port, 'Two', 'ui');
      const r2 = await move(port, 'ui/Two.tsx', 'ui/Src');
      expect(r2.status).toBe(200);
      // Seed a history sidecar for One to prove slug-keyed sidecars follow too.
      mkdirSync(join(designRoot, '_history', 'ui-src-one'), { recursive: true });
      writeFileSync(join(designRoot, '_history', 'ui-src-one', 'snap.json'), '{}');

      const r = await move(port, 'ui/Src', 'ui/Dest');
      expect(r.status).toBe(200);
      const j = (await r.json()) as { ok: boolean; toRel: string; moved: string[] };
      expect(j.ok).toBe(true);
      expect(j.toRel).toBe('ui/Dest/Src');

      expect(existsSync(join(designRoot, 'ui', 'Src'))).toBe(false);
      expect(existsSync(join(designRoot, 'ui', 'Dest', 'Src', 'One.tsx'))).toBe(true);
      expect(existsSync(join(designRoot, 'ui', 'Dest', 'Src', 'Two.tsx'))).toBe(true);
      expect(existsSync(join(designRoot, '_history', 'ui-dest-src-one', 'snap.json'))).toBe(true);
      expect(existsSync(join(designRoot, '_history', 'ui-src-one'))).toBe(false);
    } finally {
      await killProc(proc);
    }
  });

  test('refuses moving a folder into itself or a descendant (400)', async () => {
    const { root, designRoot } = makeSandbox();
    const port = nextPort();
    const proc = await bootServer(root, port);
    try {
      mkdirSync(join(designRoot, 'ui', 'Parent', 'Child'), { recursive: true });
      const intoSelf = await move(port, 'ui/Parent', 'ui/Parent');
      expect(intoSelf.status).toBe(400);
      const intoChild = await move(port, 'ui/Parent', 'ui/Parent/Child');
      expect(intoChild.status).toBe(400);
      expect(existsSync(join(designRoot, 'ui', 'Parent', 'Child'))).toBe(true);
    } finally {
      await killProc(proc);
    }
  });

  test('refuses moving a canvas GROUP ROOT (not a user-created folder) (400)', async () => {
    const { root } = makeSandbox();
    const port = nextPort();
    const proc = await bootServer(root, port);
    try {
      const r = await move(port, 'ui', 'system');
      expect(r.status).toBe(400);
    } finally {
      await killProc(proc);
    }
  });

  test('a missing source folder returns 404', async () => {
    const { root } = makeSandbox();
    const port = nextPort();
    const proc = await bootServer(root, port);
    try {
      const r = await move(port, 'ui/Nope', 'ui/Dest');
      expect(r.status).toBe(404);
    } finally {
      await killProc(proc);
    }
  });

  test('a destination collision returns 409, nothing moved', async () => {
    const { root, designRoot } = makeSandbox();
    const port = nextPort();
    const proc = await bootServer(root, port);
    try {
      mkdirSync(join(designRoot, 'ui', 'Src'), { recursive: true });
      mkdirSync(join(designRoot, 'ui', 'Dest', 'Src'), { recursive: true });
      const r = await move(port, 'ui/Src', 'ui/Dest');
      expect(r.status).toBe(409);
      expect(existsSync(join(designRoot, 'ui', 'Src'))).toBe(true);
    } finally {
      await killProc(proc);
    }
  });
});

// In-process: the collab-pin guard. Reaching a REAL pinned room requires the
// MAUDE_SHARED_DOC sync runtime; exercising the guard through api.moveCanvas
// directly with a stub `isRoomPinned` hook proves the refusal wiring without
// standing up the whole shared-doc machinery.
describe('moveCanvas — collab-pin guard (in-process)', () => {
  function mkCtx(root: string, designRoot: string): Context {
    return {
      cfg: {
        canvasGroups: [
          { label: 'Design system', path: 'system' },
          { label: 'Canvases', path: 'ui' },
        ],
      } as Context['cfg'],
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

  test('refuses the move (409) when the slug is pinned, and does not touch disk', async () => {
    const { root, designRoot } = makeSandbox();
    const abs = join(designRoot, 'ui', 'Pinned.tsx');
    mkdirSync(join(designRoot, 'ui'), { recursive: true });
    writeFileSync(abs, 'export default function P(){return null}');
    const ctx = mkCtx(root, designRoot);
    const api = createApi(ctx, {
      onCommentsChanged: () => {},
      isRoomPinned: (slug) => slug === 'ui-pinned',
      flushAndDropRoom: async () => {
        throw new Error('must not be called when pinned');
      },
    });

    const result = await api.moveCanvas({ file: 'ui/Pinned.tsx', toDir: 'ui/sub' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(409);
    expect(existsSync(abs)).toBe(true);
  });

  test('calls flushAndDropRoom when NOT pinned', async () => {
    const { root, designRoot } = makeSandbox();
    const abs = join(designRoot, 'ui', 'Unpinned.tsx');
    mkdirSync(join(designRoot, 'ui'), { recursive: true });
    writeFileSync(abs, 'export default function U(){return null}');
    const ctx = mkCtx(root, designRoot);
    let flushed = false;
    const api = createApi(ctx, {
      onCommentsChanged: () => {},
      isRoomPinned: () => false,
      flushAndDropRoom: async (slug) => {
        expect(slug).toBe('ui-unpinned');
        flushed = true;
      },
    });

    const result = await api.moveCanvas({ file: 'ui/Unpinned.tsx', toDir: 'ui/sub' });
    expect(result.ok).toBe(true);
    expect(flushed).toBe(true);
  });
});
