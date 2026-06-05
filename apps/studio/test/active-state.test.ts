// Smoke: WS `active` + `tabs` + `select` messages reflect into _active.json.

import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';

import { bootServer, killProc, makeSandbox, nextPort } from './_helpers.ts';

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

describe('_active.json round-trip', () => {
  test('active + tabs + selected persist to disk', async () => {
    const { root, designRoot } = makeSandbox();
    const port = nextPort();
    const proc = await bootServer(root, port);
    try {
      const ws = await openWs(port);
      ws.send(JSON.stringify({ type: 'active', file: '.design/ui/fixture.html' }));
      ws.send(JSON.stringify({ type: 'tabs', tabs: ['.design/ui/fixture.html'] }));
      ws.send(
        JSON.stringify({
          type: 'select',
          selection: {
            file: '.design/ui/fixture.html',
            selector: 'h1',
            tag: 'h1',
            classes: '',
            text: 'fixture',
            dom_path: ['html', 'body', 'h1'],
            bounds: { x: 0, y: 0, w: 100, h: 24 },
            html: '<h1>fixture</h1>',
          },
        })
      );

      // Allow time for the queued microtask save to land.
      await Bun.sleep(150);

      const state = (await Bun.file(join(designRoot, '_active.json')).json()) as {
        active: string;
        open_tabs: string[];
        selected: { selector: string; tag: string; v?: number };
      };
      expect(state.active).toBe('.design/ui/fixture.html');
      expect(state.open_tabs).toContain('.design/ui/fixture.html');
      expect(state.selected.selector).toBe('h1');
      expect(state.selected.tag).toBe('h1');
      expect(state.selected.v).toBe(1);
      ws.close();
    } finally {
      await killProc(proc);
    }
  });

  test('selection carrying data-cd-id stamps v=2 + canvas slug', async () => {
    const { root, designRoot } = makeSandbox();
    const port = nextPort();
    const proc = await bootServer(root, port);
    try {
      const ws = await openWs(port);
      ws.send(JSON.stringify({ type: 'active', file: '.design/ui/fixture.tsx' }));
      ws.send(
        JSON.stringify({
          type: 'select',
          selection: {
            file: '.design/ui/fixture.tsx',
            selector: 'div.btn',
            tag: 'button',
            classes: 'btn btn--ghost',
            text: 'OK',
            dom_path: ['html', 'body', 'button'],
            bounds: { x: 10, y: 20, w: 80, h: 32 },
            html: '<button class="btn btn--ghost">OK</button>',
            id: 'a1b2c3d4',
          },
        })
      );
      await Bun.sleep(150);

      const state = (await Bun.file(join(designRoot, '_active.json')).json()) as {
        selected: { id?: string; canvas?: string; v: number; selector: string };
      };
      expect(state.selected.v).toBe(2);
      expect(state.selected.id).toBe('a1b2c3d4');
      // Canvas slug = designRoot-relative path, ext-less, POSIX. The fixture
      // file is `.design/ui/fixture.tsx`; designRel = `.design` → slug =
      // `ui/fixture`.
      expect(state.selected.canvas).toBe('ui/fixture');
      // v=2 still carries the v1 selector as a fallback (legacy readers).
      expect(state.selected.selector).toBe('div.btn');
      ws.close();
    } finally {
      await killProc(proc);
    }
  });

  test('selection without id stays v=1 (legacy HTML canvas / shell chrome click)', async () => {
    const { root, designRoot } = makeSandbox();
    const port = nextPort();
    const proc = await bootServer(root, port);
    try {
      const ws = await openWs(port);
      ws.send(JSON.stringify({ type: 'active', file: '.design/ui/fixture.html' }));
      ws.send(
        JSON.stringify({
          type: 'select',
          selection: {
            file: '.design/ui/fixture.html',
            selector: 'h1',
            tag: 'h1',
            classes: '',
            text: '',
            dom_path: ['html', 'body', 'h1'],
            bounds: { x: 0, y: 0, w: 0, h: 0 },
            html: '<h1/>',
          },
        })
      );
      await Bun.sleep(150);

      const state = (await Bun.file(join(designRoot, '_active.json')).json()) as {
        selected: { v: number; id?: string; canvas?: string };
      };
      expect(state.selected.v).toBe(1);
      expect(state.selected.id).toBeUndefined();
      expect(state.selected.canvas).toBeUndefined();
      ws.close();
    } finally {
      await killProc(proc);
    }
  });
});
