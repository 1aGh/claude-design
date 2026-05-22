// Phase 6.5 T1 — `/_api/export` endpoint smoke.
//
// Boots a real server (per `_helpers.bootServer`) and confirms every format
// stub returns 200 with the right MIME + filename. The stubs themselves emit
// zero-byte bodies; this test only checks the dispatch contract, not adapter
// fidelity (those tests land alongside each adapter in T2…T7).

import { describe, expect, test } from 'bun:test';

import { bootServer, killProc, makeSandbox, nextPort } from '../_helpers.ts';

// Each adapter is paired with a scope that, against the empty sandbox `_active.json`,
// resolves to zero targets so the adapter takes its empty-input branch. That keeps
// the dispatch contract test isolated from real screenshot/render integration
// (those land alongside each adapter's own unit tests).
const FORMATS = [
  // PNG/PDF/SVG/HTML/PPTX/Canva expect element targets — `canvas-as-separate`
  // against `active: null` resolves to [] → adapters short-circuit.
  { format: 'png', scope: 'canvas-as-separate', expectedExt: '.png', expectedMime: 'image/png' },
  { format: 'pdf', scope: 'canvas-as-separate', expectedExt: '.pdf', expectedMime: 'application/pdf' },
  { format: 'svg', scope: 'canvas-as-separate', expectedExt: '.svg', expectedMime: 'image/svg+xml' },
  { format: 'html', scope: 'canvas-as-separate', expectedExt: '.zip', expectedMime: 'application/zip' },
  {
    format: 'pptx',
    scope: 'canvas-as-separate',
    expectedExt: '.pptx',
    expectedMime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  },
  { format: 'canva', scope: 'canvas-as-separate', expectedExt: '.zip', expectedMime: 'application/zip' },
  // ZIP consumes `project-raw` — designRoot walk over the sandbox returns at
  // least the fixture file.
  { format: 'zip', scope: 'project-raw', expectedExt: '.zip', expectedMime: 'application/zip' },
] as const;

describe('/_api/export — endpoint dispatch', () => {
  for (const { format, scope, expectedExt, expectedMime } of FORMATS) {
    test(`POST format=${format} scope=${scope} returns 200 + ${expectedMime}`, async () => {
      const { root } = makeSandbox();
      const port = nextPort();
      const proc = await bootServer(root, port);
      try {
        const r = await fetch(`http://localhost:${port}/_api/export`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ format, scope }),
        });
        expect(r.status).toBe(200);
        expect(r.headers.get('Content-Type')).toBe(expectedMime);
        const disp = r.headers.get('Content-Disposition') ?? '';
        expect(disp).toMatch(/^attachment; filename=/);
        expect(disp.endsWith(`${expectedExt}"`)).toBe(true);
      } finally {
        await killProc(proc);
      }
    });
  }

  test('rejects unknown format with 400', async () => {
    const { root } = makeSandbox();
    const port = nextPort();
    const proc = await bootServer(root, port);
    try {
      const r = await fetch(`http://localhost:${port}/_api/export`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ format: 'jpg', scope: 'project-raw' }),
      });
      expect(r.status).toBe(400);
    } finally {
      await killProc(proc);
    }
  });

  test('rejects unknown scope with 400', async () => {
    const { root } = makeSandbox();
    const port = nextPort();
    const proc = await bootServer(root, port);
    try {
      const r = await fetch(`http://localhost:${port}/_api/export`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ format: 'png', scope: 'everything' }),
      });
      expect(r.status).toBe(400);
    } finally {
      await killProc(proc);
    }
  });

  test('rejects non-POST with 405', async () => {
    const { root } = makeSandbox();
    const port = nextPort();
    const proc = await bootServer(root, port);
    try {
      const r = await fetch(`http://localhost:${port}/_api/export`);
      expect(r.status).toBe(405);
    } finally {
      await killProc(proc);
    }
  });
});
