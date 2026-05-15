// Smoke: boot → /_health 200 → _server.json written → shutdown.

import { describe, test, expect } from 'bun:test';
import { join } from 'node:path';

import { makeSandbox, nextPort, bootServer, killProc } from './_helpers.ts';

describe('server lifecycle', () => {
  test('boots, writes _server.json, responds to /_health', async () => {
    const { root, designRoot } = makeSandbox();
    const port = nextPort();
    const proc = await bootServer(root, port);
    try {
      const h = await fetch(`http://localhost:${port}/_health`);
      expect(h.status).toBe(200);
      const body = (await h.json()) as { ok: boolean; app: string };
      expect(body.ok).toBe(true);
      expect(body.app).toBe('design');

      const info = await Bun.file(join(designRoot, '_server.json')).json();
      expect(info.port).toBe(port);
      expect(info.pid).toBeGreaterThan(0);
      expect(info.url).toBe(`http://localhost:${port}`);
    } finally {
      await killProc(proc);
    }
  });
});
