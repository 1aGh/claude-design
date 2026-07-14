// POST /_api/import-brand — DDR-173 (Phase 3 / T12). Full HTTP round-trip
// against a real booted server, chained after /_api/import-asset the same
// way the in-app Brand-upload panel does (privilege/CSRF boundary is covered
// generically by canvas-origin-gate.test.ts — this file exercises the
// route's own success/error shapes, incl. the assetPath containment check).

import { describe, expect, test } from 'bun:test';

import { bootServer, killProc, makeSandbox, nextPort } from './_helpers.ts';

const LOGO_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 96">' +
  '<rect width="240" height="96" fill="#0d0d0f"/>' +
  '<circle cx="40" cy="48" r="20" fill="#6b6bf0"/>' +
  '<text x="70" y="56" font-family="Inter, sans-serif" font-size="24" fill="#ffffff">Acme</text>' +
  '</svg>';

describe('POST /_api/import-brand', () => {
  test('chained after /_api/import-asset: extracts palette/fonts, rasterizes the wordmark fallback', async () => {
    const { root } = makeSandbox();
    const port = nextPort();
    const proc = await bootServer(root, port);
    try {
      const base = `http://localhost:${port}`;

      const importAsset = await fetch(`${base}/_api/import-asset`, {
        method: 'POST',
        headers: { 'X-Import-Kind': 'svg', Origin: base },
        body: LOGO_SVG,
      });
      expect(importAsset.status).toBe(201);
      const assetBody = (await importAsset.json()) as { ok: boolean; path: string };
      expect(assetBody.ok).toBe(true);

      const importBrand = await fetch(`${base}/_api/import-brand`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: base },
        body: JSON.stringify({ assetPath: assetBody.path }),
      });
      expect(importBrand.status).toBe(201);
      const brandBody = (await importBrand.json()) as {
        ok: boolean;
        palette: string[];
        fonts: string[];
        logoRef: string;
        logoRasterRef: string | null;
        hadWordmarkText: boolean;
      };
      expect(brandBody.ok).toBe(true);
      expect(brandBody.palette).toContain('#0d0d0f');
      expect(brandBody.palette).toContain('#6b6bf0');
      expect(brandBody.hadWordmarkText).toBe(true);
      expect(brandBody.logoRasterRef).toMatch(/^assets\/logos\/[a-z0-9]{8}\.png$/);
      expect(brandBody.logoRef).toMatch(/^assets\/logos\/[a-z0-9]{8}\.svg$/);
    } finally {
      await killProc(proc);
    }
  }, 45_000);

  test('rejects a client-supplied path that is not a server-generated assets/<sha8>.svg shape', async () => {
    const { root } = makeSandbox();
    const port = nextPort();
    const proc = await bootServer(root, port);
    try {
      const base = `http://localhost:${port}`;
      const attempts = [
        '../../../etc/passwd',
        'assets/../../../etc/passwd',
        '/etc/passwd',
        'assets/not-a-valid-hash.svg',
        'assets/12345678.png', // wrong extension
        '',
      ];
      for (const assetPath of attempts) {
        const res = await fetch(`${base}/_api/import-brand`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Origin: base },
          body: JSON.stringify({ assetPath }),
        });
        expect(res.status).toBe(400);
        const body = (await res.json()) as { ok: boolean };
        expect(body.ok).toBe(false);
      }
    } finally {
      await killProc(proc);
    }
  }, 30_000);

  test('a well-formed but nonexistent asset path is a clean 404, not a 500 crash', async () => {
    const { root } = makeSandbox();
    const port = nextPort();
    const proc = await bootServer(root, port);
    try {
      const base = `http://localhost:${port}`;
      const res = await fetch(`${base}/_api/import-brand`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: base },
        body: JSON.stringify({ assetPath: 'assets/deadbeef.svg' }),
      });
      expect(res.status).toBe(404);
      const body = (await res.json()) as { ok: boolean };
      expect(body.ok).toBe(false);
    } finally {
      await killProc(proc);
    }
  }, 30_000);

  test('rejects GET', async () => {
    const { root } = makeSandbox();
    const port = nextPort();
    const proc = await bootServer(root, port);
    try {
      const base = `http://localhost:${port}`;
      const res = await fetch(`${base}/_api/import-brand`, { method: 'GET' });
      expect(res.status).toBe(405);
    } finally {
      await killProc(proc);
    }
  }, 30_000);
});
