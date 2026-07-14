// POST /_api/import-asset — DDR-167 (Phase 3 / T10). Full HTTP round-trip
// against a real booted server (privilege/CSRF boundary is covered generically
// by canvas-origin-gate.test.ts — this file exercises the route's own
// success/error shapes).

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

import { bootServer, killProc, makeSandbox, nextPort } from './_helpers.ts';

const MALICIOUS_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script>' +
  '<rect onclick="alert(2)" fill="#4f46e5" width="10" height="10"/></svg>';

describe('POST /_api/import-asset', () => {
  test('imports and sanitizes an SVG, rejects a PDF kind as not-yet-available, rejects GET', async () => {
    const { root, designRoot } = makeSandbox();
    const port = nextPort();
    const proc = await bootServer(root, port);
    try {
      const base = `http://localhost:${port}`;

      const post = await fetch(`${base}/_api/import-asset`, {
        method: 'POST',
        headers: { 'X-Import-Kind': 'svg', Origin: base },
        body: MALICIOUS_SVG,
      });
      expect(post.status).toBe(201);
      const body = (await post.json()) as { ok: boolean; path: string };
      expect(body.ok).toBe(true);
      expect(body.path).toMatch(/^assets\/[a-z0-9]{8}\.svg$/);
      const written = readFileSync(`${designRoot}/${body.path}`, 'utf8');
      expect(written).not.toContain('script');
      expect(written).not.toContain('onclick');

      const pdfAttempt = await fetch(`${base}/_api/import-asset`, {
        method: 'POST',
        headers: { 'X-Import-Kind': 'pdf', Origin: base },
        body: '%PDF-1.4 fixture',
      });
      expect(pdfAttempt.status).toBe(501);
      const pdfBody = (await pdfAttempt.json()) as { ok: boolean; error: string };
      expect(pdfBody.ok).toBe(false);
      expect(pdfBody.error).toContain('not yet available');

      const getAttempt = await fetch(`${base}/_api/import-asset`, { method: 'GET' });
      expect(getAttempt.status).toBe(405);
    } finally {
      await killProc(proc);
    }
  }, 30_000);

  test('a malformed SVG is rejected with a clean 400, not a 500 crash', async () => {
    const { root } = makeSandbox();
    const port = nextPort();
    const proc = await bootServer(root, port);
    try {
      const base = `http://localhost:${port}`;
      const res = await fetch(`${base}/_api/import-asset`, {
        method: 'POST',
        headers: { 'X-Import-Kind': 'svg', Origin: base },
        body: '<svg><rect',
      });
      expect(res.status).toBe(400);
      const body = (await res.json()) as { ok: boolean };
      expect(body.ok).toBe(false);
    } finally {
      await killProc(proc);
    }
  }, 30_000);
});
