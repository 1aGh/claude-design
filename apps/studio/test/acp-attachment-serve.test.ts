// GET /_api/acp/attachment — the content-addressed serve route behind the ACP
// chat image thumbnails + lightbox. The name is the ONLY input and must match
// our own `<sha8>.<ext>` shape (api.resolveChatAttachment) — traversal-proof by
// construction, so these tests pin the allowlist: a real uploaded attachment
// serves 200 with an image content-type + immutable cache; every malformed /
// hostile name 404s; non-GET/POST methods 405. The canvas-origin 403 lives in
// canvas-origin-gate.test.ts (dual-allowlist invariant, DDR-054/DDR-088).

import { describe, expect, test } from 'bun:test';

import { bootServer, killProc, makeSandbox, nextPort } from './_helpers.ts';

// Minimal valid PNG magic bytes, padded so length checks pass (asset-api idiom).
const pad = (header: number[], len = 64): Uint8Array => {
  const out = new Uint8Array(len);
  out.set(header, 0);
  return out;
};
const PNG = pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe('acp-attachment-serve / GET /_api/acp/attachment', () => {
  test('serves an uploaded attachment by name; rejects hostile names; gates methods', async () => {
    const sandbox = makeSandbox();
    const port = nextPort();
    const proc = await bootServer(sandbox.root, port);
    const base = `http://localhost:${port}/_api/acp/attachment`;
    try {
      // Write side first — the serve route only ever serves what saveChatAttachment
      // itself named (content-addressed <sha8>.<ext>).
      const post = await fetch(base, {
        method: 'POST',
        headers: { 'Content-Type': 'image/png' },
        body: PNG,
      });
      expect(post.status).toBe(201);
      const { path: absPath } = (await post.json()) as { path: string };
      const name = absPath.split('/').pop() as string;
      expect(name).toMatch(/^[0-9a-f]{8}\.png$/);

      // Happy path — 200, image content-type, immutable cache (content-addressed).
      const ok = await fetch(`${base}?name=${name}`);
      expect(ok.status).toBe(200);
      expect(ok.headers.get('content-type')).toBe('image/png');
      expect(ok.headers.get('cache-control')).toContain('immutable');
      expect(new Uint8Array(await ok.arrayBuffer())).toEqual(PNG);

      // Name allowlist — anything that is not our own <sha8>.(png|jpe?g|gif|webp)
      // shape must 404 (never resolved against the filesystem).
      for (const bad of [
        '../../etc/passwd',
        '..%2f..%2fetc%2fpasswd',
        `/etc/passwd`,
        'abc',
        'deadbeef.svg', // SVG is never written — scriptable, stays unservable
        'deadbeef.png.svg',
        'DEADBEEF.png', // uppercase hex — writer emits lowercase only
        'deadbeef1.png', // 9 hex chars
        `_chat/attachments/${name}`,
      ]) {
        const res = await fetch(`${base}?name=${encodeURIComponent(bad)}`);
        expect(res.status).toBe(404);
      }
      // Missing name / valid-shaped but nonexistent file → 404 too.
      expect((await fetch(base)).status).toBe(404);
      expect((await fetch(`${base}?name=00000000.png`)).status).toBe(404);

      // Method gate — only GET (serve) + POST (upload) exist.
      expect((await fetch(base, { method: 'DELETE' })).status).toBe(405);
      expect((await fetch(base, { method: 'PUT' })).status).toBe(405);
    } finally {
      await killProc(proc);
    }
  });
});
