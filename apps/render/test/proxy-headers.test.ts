// Regression: the token proxy must never replay Bun-fetch's upstream headers
// verbatim (RCA 2026-08-23, hybrid-export plan T1).
//
// Bun's fetch transparently decompresses a gzip/br body (the Cloudflare edge
// compresses the canvas shell), but the Response it returns still carries the
// upstream `content-encoding` and the COMPRESSED `content-length`. Replaying
// that Response from Bun.serve (`return r`) hands Chromium a header/body
// mismatch: `ERR_CONTENT_DECODING_FAILED` on the main document, the navigation
// never commits (no page → no console/pageerror/requestfailed events), and
// `goto` burns its full timeout with exactly one entry in the proxy log —
// the production signature this suite pins.
//
// Fail-first verified against the verbatim-replay version (red: stale
// `content-encoding: gzip` reached the client) before the fix landed.

import { expect, test } from 'bun:test';

import { startTokenProxy } from '../proxy.ts';

const HTML = `<!doctype html><html><body>${'canvas '.repeat(1024)}</body></html>`;

function gzipUpstream(opts: { alwaysCompress: boolean }) {
  const gz = Bun.gzipSync(Buffer.from(HTML));
  const seen: { acceptEncoding: string | null; token: string | null }[] = [];
  const server = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    fetch(req) {
      const url = new URL(req.url);
      seen.push({
        acceptEncoding: req.headers.get('accept-encoding'),
        token: url.searchParams.get('t'),
      });
      const wantsGzip = (req.headers.get('accept-encoding') ?? '').includes('gzip');
      if (opts.alwaysCompress || wantsGzip) {
        // The edge shape: compressed bytes + the headers describing them.
        return new Response(gz, {
          headers: {
            'content-type': 'text/html',
            'content-encoding': 'gzip',
            'content-length': String(gz.byteLength),
          },
        });
      }
      return new Response(HTML, { headers: { 'content-type': 'text/html' } });
    },
  });
  return { origin: `http://127.0.0.1:${server.port}`, seen, stop: () => server.stop(true) };
}

test('a compressing upstream yields a decodable, encoding-header-free response', async () => {
  // `alwaysCompress` mimics an edge cache serving gzip regardless of the
  // request's accept-encoding — the worst case the proxy must normalize.
  const upstream = gzipUpstream({ alwaysCompress: true });
  const proxy = startTokenProxy({ origin: upstream.origin, token: 'tok-123' });
  try {
    const res = await fetch(`${proxy.origin}/_canvas-shell.html?canvas=x.tsx`);
    expect(res.status).toBe(200);
    // The load-bearing assertions: no stale encoding metadata may survive the
    // hop — the body the client receives is already plain bytes.
    expect(res.headers.get('content-encoding')).toBeNull();
    expect(await res.text()).toBe(HTML);
    // Token injection still works (the proxy's whole purpose).
    expect(upstream.seen[0]?.token).toBe('tok-123');
  } finally {
    proxy.stop();
    upstream.stop();
  }
});

test('the proxy asks upstream for identity encoding (no decompress hop at all)', async () => {
  const upstream = gzipUpstream({ alwaysCompress: false });
  const proxy = startTokenProxy({ origin: upstream.origin });
  try {
    const res = await fetch(`${proxy.origin}/_canvas-shell.html`);
    expect(res.status).toBe(200);
    expect(upstream.seen[0]?.acceptEncoding).toBe('identity');
    expect(res.headers.get('content-encoding')).toBeNull();
    expect(await res.text()).toBe(HTML);
  } finally {
    proxy.stop();
    upstream.stop();
  }
});

test('read-only: non-GET/HEAD is refused without touching upstream', async () => {
  const upstream = gzipUpstream({ alwaysCompress: false });
  const proxy = startTokenProxy({ origin: upstream.origin, token: 'tok' });
  try {
    const res = await fetch(`${proxy.origin}/_api/anything`, { method: 'POST', body: 'x' });
    expect(res.status).toBe(405);
    expect(upstream.seen.length).toBe(0);
  } finally {
    proxy.stop();
    upstream.stop();
  }
});
