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
});
