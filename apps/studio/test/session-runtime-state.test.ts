// Cloud Phase 27 D3, end to end: two members of one cell keep their own place.
//
// The unit test next door proves the path helpers; this proves the wiring — a
// real server in workspace mode, two vouched sessions, and the two files the
// plan names by hand: `_active.json` (selection, open tabs) and
// `_canvas-state/<slug>.view.json` (the camera).
//
// The last test is the one that must never go red for the desktop: with no
// session header the server writes exactly the paths it always wrote.

import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { isMaudeRuntimeState } from '../git/service.ts';
import { bootServer, killProc, makeSandbox, nextPort } from './_helpers.ts';

/** The proxy's vouched headers for one member (studio-proxy.mjs injects these). */
function asMember(session: string, role = 'owner') {
  return {
    'x-maude-session': session,
    'x-maude-role': role,
    'x-maude-readonly': '0',
  };
}

const CANVAS = '.design/ui/fixture.html';

describe('two members, one cell', () => {
  test('the camera is per member, and the desktop path is untouched', async () => {
    const { root, designRoot } = makeSandbox();
    const port = nextPort();
    const proc = await bootServer(root, port, {
      MAUDE_WORKSPACE_MODE: '1',
      // A dev checkout resolves Playwright, a legitimate devDependency that
      // would otherwise fail the module half of the containment assert before
      // workspace mode could be tested at all.
      MAUDE_WORKSPACE_ALLOW_DEV_MODULES: '1',
    });
    try {
      const base = `http://localhost:${port}`;
      const patch = (session: string | null, zoom: number) =>
        fetch(`${base}/_api/canvas-meta`, {
          method: 'PATCH',
          headers: {
            'content-type': 'application/json',
            ...(session ? asMember(session) : {}),
          },
          body: JSON.stringify({
            file: CANVAS,
            patch: { viewport: { x: zoom * 10, y: 0, zoom } },
          }),
        });

      const alice = await patch('aaaaaaaaaaaaaaaa', 2);
      const bob = await patch('bbbbbbbbbbbbbbbb', 3);
      expect(alice.status).toBe(200);
      expect(bob.status).toBe(200);

      // Each member's camera is its own FILE — the whole point.
      const aliceView = join(
        designRoot,
        '_canvas-state',
        'aaaaaaaaaaaaaaaa',
        'ui-fixture.view.json'
      );
      const bobView = join(designRoot, '_canvas-state', 'bbbbbbbbbbbbbbbb', 'ui-fixture.view.json');
      expect(existsSync(aliceView)).toBe(true);
      expect(existsSync(bobView)).toBe(true);
      expect((await Bun.file(aliceView).json()).viewport.zoom).toBe(2);
      expect((await Bun.file(bobView).json()).viewport.zoom).toBe(3);

      // And each reads back their OWN camera, not the last writer's.
      const read = async (session: string) => {
        const r = await fetch(`${base}/_api/canvas-meta?file=${encodeURIComponent(CANVAS)}`, {
          headers: asMember(session),
        });
        return (await r.json()) as { viewport?: { zoom?: number } };
      };
      expect((await read('aaaaaaaaaaaaaaaa')).viewport?.zoom).toBe(2);
      expect((await read('bbbbbbbbbbbbbbbb')).viewport?.zoom).toBe(3);
    } finally {
      await killProc(proc);
    }
  }, 30_000);

  test('with no session header the camera lands where it always did', async () => {
    // The desktop regression gate. A `_canvas-state/<slug>.view.json` at the
    // top level, no subdirectory, byte-for-byte the pre-D3 layout.
    const { root, designRoot } = makeSandbox();
    const port = nextPort();
    const proc = await bootServer(root, port);
    try {
      const res = await fetch(`http://localhost:${port}/_api/canvas-meta`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ file: CANVAS, patch: { viewport: { x: 1, y: 2, zoom: 1.5 } } }),
      });
      expect(res.status).toBe(200);
      expect(existsSync(join(designRoot, '_canvas-state', 'ui-fixture.view.json'))).toBe(true);
    } finally {
      await killProc(proc);
    }
  }, 30_000);

  test('a forged session key cannot escape the canvas-state directory', async () => {
    // The key becomes a path segment, so it is a traversal surface. The proxy
    // strips inbound `x-maude-*` before injecting its own, which is the real
    // defence; this is the second one.
    const { root, designRoot } = makeSandbox();
    const port = nextPort();
    const proc = await bootServer(root, port, {
      MAUDE_WORKSPACE_MODE: '1',
      // A dev checkout resolves Playwright, a legitimate devDependency that
      // would otherwise fail the module half of the containment assert before
      // workspace mode could be tested at all.
      MAUDE_WORKSPACE_ALLOW_DEV_MODULES: '1',
    });
    try {
      const res = await fetch(`http://localhost:${port}/_api/canvas-meta`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          'x-maude-session': '../../../../tmp/pwned',
          'x-maude-role': 'owner',
          'x-maude-readonly': '0',
        },
        body: JSON.stringify({ file: CANVAS, patch: { viewport: { x: 0, y: 0, zoom: 1 } } }),
      });
      expect(res.status).toBe(200);
      // Refused, not sanitized — so it lands on the shared singleton, exactly
      // where a request with no session at all would.
      expect(existsSync(join(designRoot, '_canvas-state', 'ui-fixture.view.json'))).toBe(true);
      expect(existsSync('/tmp/pwned')).toBe(false);
    } finally {
      await killProc(proc);
    }
  }, 30_000);

  test('`_active.json` is per member too', async () => {
    // Selection + open tabs travel over the inspector WebSocket, so this drives
    // the socket the way the client does — including the handshake, which is
    // where the session is stamped (a role, and now an identity, is per session
    // and a handshake is the one moment it is unambiguous).
    const { root, designRoot } = makeSandbox();
    const port = nextPort();
    const proc = await bootServer(root, port, {
      MAUDE_WORKSPACE_MODE: '1',
      // A dev checkout resolves Playwright, a legitimate devDependency that
      // would otherwise fail the module half of the containment assert before
      // workspace mode could be tested at all.
      MAUDE_WORKSPACE_ALLOW_DEV_MODULES: '1',
    });
    try {
      const openAs = (session: string, file: string) =>
        new Promise<void>((resolve, reject) => {
          const ws = new WebSocket(`ws://localhost:${port}/_ws`, {
            headers: asMember(session),
          } as unknown as string[]);
          const timer = setTimeout(() => reject(new Error('socket timeout')), 8000);
          ws.onopen = () => {
            ws.send(JSON.stringify({ type: 'active', file }));
            ws.send(JSON.stringify({ type: 'tabs', tabs: [file] }));
            setTimeout(() => {
              clearTimeout(timer);
              ws.close();
              resolve();
            }, 400);
          };
          ws.onerror = (e) => {
            clearTimeout(timer);
            reject(e);
          };
        });

      await openAs('aaaaaaaaaaaaaaaa', '.design/ui/alice.tsx');
      await openAs('bbbbbbbbbbbbbbbb', '.design/ui/bob.tsx');
      await Bun.sleep(300);

      const aliceState = await Bun.file(join(designRoot, '_active.aaaaaaaaaaaaaaaa.json')).json();
      const bobState = await Bun.file(join(designRoot, '_active.bbbbbbbbbbbbbbbb.json')).json();
      expect(aliceState.active).toBe('.design/ui/alice.tsx');
      expect(bobState.active).toBe('.design/ui/bob.tsx');
      // Neither clobbered the other, which before D3 is exactly what happened.
      expect(aliceState.open_tabs).toEqual(['.design/ui/alice.tsx']);
      expect(bobState.open_tabs).toEqual(['.design/ui/bob.tsx']);
    } finally {
      await killProc(proc);
    }
  }, 30_000);
});

describe('per-member runtime state is runtime state to git', () => {
  test('all three matchers agree that `_active.<session>.json` is not a commit', () => {
    // The comment in session-scope.ts CLAIMED a sibling kept every matcher
    // correct. It did not: `.gitignore`, the CLI's ignore block and the
    // studio's own `isMaudeRuntimeState` all matched `_active.json` by NAME, so
    // each member's file showed as untracked to EVERYONE, "Save all" staged it,
    // and a push published one person's open tabs, active canvas and selection
    // into the tenant's remote.
    const key = 'a1b2c3d4e5f60718';

    // 1. the studio's own matcher — what the Changes panel filters by
    expect(isMaudeRuntimeState(`.design/_active.${key}.json`)).toBe(true);
    expect(isMaudeRuntimeState('.design/_active.json')).toBe(true);
    expect(isMaudeRuntimeState(`.design/_canvas-state/${key}/ui-home.view.json`)).toBe(true);
    // …and it must not have widened into ordinary files on the way.
    expect(isMaudeRuntimeState('.design/ui/Home.tsx')).toBe(false);
    expect(isMaudeRuntimeState('.design/ui/Home.meta.json')).toBe(false);
    expect(isMaudeRuntimeState('.design/_activeXjson')).toBe(false);

    // 2. this repo's own .gitignore
    const ignored = (rel: string) =>
      Bun.spawnSync(['git', 'check-ignore', '-q', rel], {
        cwd: join(import.meta.dir, '..', '..', '..'),
      }).exitCode === 0;
    expect(ignored(`.design/_active.${key}.json`)).toBe(true);

    // 3. the block the CLI writes into a downstream project
    const block = readFileSync(
      join(import.meta.dir, '..', '..', '..', 'cli', 'lib', 'gitignore-block.mjs'),
      'utf8'
    );
    expect(block).toContain('_active.*.json');
  });
});
