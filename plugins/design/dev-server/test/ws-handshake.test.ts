// Smoke: WebSocket upgrade against Bun.serve's native handler.

import { describe, test, expect } from 'bun:test';

import { makeSandbox, nextPort, bootServer, killProc } from './_helpers.ts';

describe('ws handshake', () => {
  test('upgrades and receives initial snapshot', async () => {
    const { root } = makeSandbox();
    const port = nextPort();
    const proc = await bootServer(root, port);
    try {
      const ws = new WebSocket(`ws://localhost:${port}/_ws`);
      const first = await new Promise<string>((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('no message')), 2000);
        ws.addEventListener('message', (e) => {
          clearTimeout(t);
          resolve(typeof e.data === 'string' ? e.data : new TextDecoder().decode(e.data as ArrayBuffer));
        });
        ws.addEventListener('error', (e) => reject(e));
      });
      const parsed = JSON.parse(first);
      expect(parsed.type).toBe('snapshot');
      expect(parsed.state).toBeDefined();
      expect(parsed.state.session_started).toBeTypeOf('string');
      ws.close();
    } finally {
      await killProc(proc);
    }
  });
});
