// Phase 6.5 T10 — export history persistence + endpoint.

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { bootServer, killProc, makeSandbox, nextPort } from '../_helpers.ts';

interface HistoryShape {
  history: Array<{ format: string; scope: string; filename: string; at: string }>;
}

describe('/_api/export-history — GET', () => {
  test('returns empty list on fresh sandbox', async () => {
    const { root } = makeSandbox();
    const port = nextPort();
    const proc = await bootServer(root, port);
    try {
      const r = await fetch(`http://localhost:${port}/_api/export-history`);
      expect(r.status).toBe(200);
      const body = (await r.json()) as HistoryShape;
      expect(body.history).toEqual([]);
    } finally {
      await killProc(proc);
    }
  });

  test('POST /_api/export appends a history entry, GET surfaces it', async () => {
    const { root, designRoot } = makeSandbox();
    const port = nextPort();
    const proc = await bootServer(root, port);
    try {
      // Trigger a project-raw zip export (resolver returns file-tree → zip
      // adapter consumes; no Playwright dependency).
      const exp = await fetch(`http://localhost:${port}/_api/export`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ format: 'zip', scope: 'project-raw' }),
      });
      expect(exp.status).toBe(200);
      // Read-back via the dedicated endpoint.
      const r = await fetch(`http://localhost:${port}/_api/export-history`);
      const body = (await r.json()) as HistoryShape;
      expect(body.history.length).toBe(1);
      expect(body.history[0].format).toBe('zip');
      expect(body.history[0].scope).toBe('project-raw');
      expect(body.history[0].filename).toMatch(/\.zip$/);
      // On-disk file persists across server restarts (writes during request).
      const onDisk = JSON.parse(
        readFileSync(join(designRoot, '_export-history.json'), 'utf8')
      ) as HistoryShape['history'];
      expect(onDisk.length).toBe(1);
    } finally {
      await killProc(proc);
    }
  });

  test('caps to 20 most-recent entries', async () => {
    const { root } = makeSandbox();
    const port = nextPort();
    const proc = await bootServer(root, port);
    try {
      for (let i = 0; i < 23; i += 1) {
        const r = await fetch(`http://localhost:${port}/_api/export`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ format: 'zip', scope: 'project-raw' }),
        });
        expect(r.status).toBe(200);
      }
      const r = await fetch(`http://localhost:${port}/_api/export-history`);
      const body = (await r.json()) as HistoryShape;
      expect(body.history.length).toBe(20);
    } finally {
      await killProc(proc);
    }
  });

  test('old-shape entries (no id/status) still parse on a fresh boot', async () => {
    const { root, designRoot } = makeSandbox();
    const { mkdirSync, writeFileSync } = await import('node:fs');
    mkdirSync(designRoot, { recursive: true });
    writeFileSync(
      join(designRoot, '_export-history.json'),
      JSON.stringify([
        {
          format: 'png',
          scope: 'artboard',
          filename: 'legacy.png',
          at: '2026-01-01T00:00:00.000Z',
        },
      ])
    );
    const port = nextPort();
    const proc = await bootServer(root, port);
    try {
      const r = await fetch(`http://localhost:${port}/_api/export-history`);
      expect(r.status).toBe(200);
      const body = (await r.json()) as HistoryShape;
      expect(body.history.length).toBe(1);
      expect(body.history[0].format).toBe('png');
      expect(body.history[0].filename).toBe('legacy.png');
    } finally {
      await killProc(proc);
    }
  });
});
