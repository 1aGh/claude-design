// Regression test for issue-report-a-bug-http-500 (RCA:
// .ai/logs/rca/issue-report-a-bug-http-500.md). `/_api/report` proxies the
// dialog's multipart body to `MAUDE_REPORT_URL`. A bare `fetch(endpoint, …)`
// call inside http.ts silently resolved to this module's OWN same-named
// fall-through handler instead of the global `fetch` — the request never left
// the machine, and the route mirrored a bogus local 500 back to the client.
// These tests boot a real server pointed at a real stub upstream, so a
// reintroduced shadow (or any other break in the proxy hop) fails loudly
// instead of only being caught by a mocked-upstream unit test.

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

import { bootServer, killProc, makeSandbox, nextPort } from './_helpers.ts';

async function bootStubUpstream(
  handler: (req: Request) => Response | Promise<Response>
): Promise<{ url: string; stop: () => void; received: () => number }> {
  let received = 0;
  const server = Bun.serve({
    port: 0,
    fetch: async (req) => {
      received += 1;
      return handler(req);
    },
  });
  return {
    url: `http://127.0.0.1:${server.port}`,
    stop: () => server.stop(true),
    received: () => received,
  };
}

describe('/_api/report proxy hop', () => {
  test('forwards the multipart body verbatim and mirrors a successful upstream response', async () => {
    const { root } = makeSandbox();
    let capturedBytes = 0;
    let capturedHasReportPart = false;
    const upstream = await bootStubUpstream(async (req) => {
      const form = await req.formData();
      capturedHasReportPart = typeof form.get('report') === 'string';
      // Multipart parsing consumed the body — approximate "did real bytes
      // arrive" by re-serializing what FormData kept.
      capturedBytes = [...form.values()].reduce(
        (n, v) => n + (typeof v === 'string' ? v.length : (v as Blob).size),
        0
      );
      return Response.json({ ok: true, issueNumber: 1, issueUrl: 'https://example.com/issues/1' });
    });

    const port = nextPort();
    const proc = await bootServer(root, port, { MAUDE_REPORT_URL: `${upstream.url}/report` });
    try {
      const form = new FormData();
      form.set(
        'report',
        JSON.stringify({ schema: 'maude-report/v1', description: 'test', reportId: 'r-0123abcd' })
      );
      form.append('screenshot', new Blob([new Uint8Array([1, 2, 3, 4])]), 'shot.png');

      const res = await fetch(`http://localhost:${port}/_api/report`, {
        method: 'POST',
        body: form,
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({ ok: true, issueNumber: 1, issueUrl: 'https://example.com/issues/1' });

      expect(upstream.received()).toBe(1);
      expect(capturedHasReportPart).toBe(true);
      expect(capturedBytes).toBeGreaterThan(0);
    } finally {
      await killProc(proc);
      upstream.stop();
    }
  });

  test('an unreachable upstream yields 502 with a JSON error, not a bare 500', async () => {
    const { root } = makeSandbox();
    const port = nextPort();
    // Nothing listens on this port — the fetch itself must fail/timeout.
    const proc = await bootServer(root, port, { MAUDE_REPORT_URL: 'http://127.0.0.1:1/report' });
    try {
      const form = new FormData();
      form.set(
        'report',
        JSON.stringify({ schema: 'maude-report/v1', description: 'test', reportId: 'r-0123abcd' })
      );
      const res = await fetch(`http://localhost:${port}/_api/report`, {
        method: 'POST',
        body: form,
      });
      expect(res.status).toBe(502);
      const json = await res.json();
      expect(json).toEqual({ error: 'report service unreachable' });
    } finally {
      await killProc(proc);
    }
  });
});

describe('no bare `fetch(` call sites in http.ts', () => {
  test('every fetch call is either the global fetch (qualified) or a local handler name', () => {
    const src = readFileSync(new URL('../http.ts', import.meta.url), 'utf8');
    // A bare `fetch(` immediately preceded by a word-boundary and NOT preceded
    // by a `.` (member access) or `function ` (declaration) would silently
    // resolve to this file's own same-named fall-through handler instead of
    // the global — exactly the bug this test guards against. `handleFallthrough`
    // is the current, unambiguous name; this assertion also fails if the
    // handler is ever renamed back to something call-site-ambiguous.
    const bareFetchCalls = [...src.matchAll(/(?<![.\w])fetch\(/g)];
    const lines = src.split('\n');
    // Skip: comment lines (mentioning `fetch(` in prose is fine) and the one
    // legitimate bare occurrence — the type-signature parameter name
    // `fetch(req: Request): Promise<Response>;` in the `Api`-shaped interface,
    // which is a declaration, not a call.
    const offendingLines = bareFetchCalls
      .map((m) => src.slice(0, m.index).split('\n').length)
      .map((line) => ({ line, text: lines[line - 1] ?? '' }))
      .filter(({ text }) => !/^\s*(\/\/|\*)/.test(text))
      .filter(({ text }) => !/^\s*fetch\(req: Request\): Promise<Response>;/.test(text));

    expect(offendingLines).toEqual([]);
  });
});
