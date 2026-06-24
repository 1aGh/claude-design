// ACP bridge origin gate (DDR-123). The agent bridge spawns the user's `claude`
// and can drive file edits, so it lives ONLY on the main (privileged) origin and
// only over loopback. This proves:
//   (1) GET /_api/acp/status serves on the main origin;
//   (2) it is 403'd on the untrusted canvas origin (off CANVAS_SAFE_API +
//       startCanvasServer routes — the dual-allowlist rule);
//   (3) /_ws/acp is wired on the main origin (upgrade-without-headers → 400);
//   (4) the loopback guard that fronts /_ws/acp rejects non-loopback hosts.

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { isLoopbackHost } from '../ws.ts';
import { bootServer, killProc, makeSandbox, nextPort } from './_helpers.ts';

async function readCanvasOrigin(designRoot: string): Promise<string> {
  for (let i = 0; i < 40; i++) {
    try {
      const info = JSON.parse(readFileSync(join(designRoot, '_server.json'), 'utf8'));
      if (info.canvasOrigin) return info.canvasOrigin as string;
    } catch {
      /* not written yet */
    }
    await Bun.sleep(50);
  }
  throw new Error('canvasOrigin never appeared in _server.json');
}

describe('ACP bridge origin gate', () => {
  test('status is main-origin only; /_ws/acp wired on main', async () => {
    const { root, designRoot } = makeSandbox();
    const port = nextPort();
    const proc = await bootServer(root, port, { MAUDE_CANVAS_ORIGIN_SPLIT: '1' });
    try {
      const main = `http://localhost:${port}`;
      const canvas = await readCanvasOrigin(designRoot);
      const status = async (base: string, path: string) =>
        (await fetch(base + path, { signal: AbortSignal.timeout(2000) })).status;

      // (1) main origin exposes the readiness probe
      const probe = await fetch(`${main}/_api/acp/status`, { signal: AbortSignal.timeout(2000) });
      expect(probe.status).toBe(200);
      expect(typeof (await probe.json()).available).toBe('boolean');

      // (2) the untrusted canvas origin must NOT reach the probe
      expect(await status(canvas, '/_api/acp/status')).toBe(403);

      // (3) /_ws/acp is wired on the main origin — a plain GET (no Upgrade
      // headers) passes the loopback guard then fails the WS upgrade → 400,
      // which proves the route branch exists (a 404 would mean it's unwired).
      expect(await status(main, '/_ws/acp')).toBe(400);

      // (4) /_api/acp/focus (the /design:chat hook) — POST-only on the main
      // origin, 403 on the canvas origin.
      const focusPost = await fetch(`${main}/_api/acp/focus`, {
        method: 'POST',
        signal: AbortSignal.timeout(2000),
      });
      expect(focusPost.status).toBe(200);
      expect((await focusPost.json()).ok).toBe(true);
      expect(await status(main, '/_api/acp/focus')).toBe(405); // GET not allowed
      expect(await status(canvas, '/_api/acp/focus')).toBe(403); // off the canvas origin

      // (5) DDR-128 — /_api/preflight readiness probe: main-origin 200 with the
      // {ready, items[]} shape; 403 on the untrusted canvas origin (dual-allowlist).
      const pre = await fetch(`${main}/_api/preflight`, { signal: AbortSignal.timeout(2000) });
      expect(pre.status).toBe(200);
      const preJson = await pre.json();
      expect(typeof preJson.ready).toBe('boolean');
      expect(Array.isArray(preJson.items)).toBe(true);
      expect(await status(canvas, '/_api/preflight')).toBe(403);
    } finally {
      await killProc(proc);
    }
  }, 15000);

  test('the loopback guard fronting /_ws/acp rejects non-loopback hosts', () => {
    // Same guard server.ts applies before upgrading the acp socket.
    expect(isLoopbackHost('127.0.0.1:4399')).toBe(true);
    expect(isLoopbackHost('localhost:4399')).toBe(true);
    expect(isLoopbackHost('[::1]:4399')).toBe(true);
    expect(isLoopbackHost('evil.example.com')).toBe(false);
    expect(isLoopbackHost('10.0.0.5:4399')).toBe(false);
    expect(isLoopbackHost(null)).toBe(false);
  });
});
