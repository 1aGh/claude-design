// Phase 4 T5 — `/_api/canvas-meta` GET/PATCH endpoint round-trip.
//
// Verifies:
//   - PATCH merges `viewport` into an existing `<canvas>.meta.json`
//   - PATCH preserves other top-level keys (title, sections, ai_context …)
//   - PATCH clamps zoom to [0.1, 4.0]
//   - PATCH rejects non-finite viewport coords (no write, returns prior)
//   - GET returns the merged meta
//   - Paths that escape repoRoot are 400

import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, test } from 'bun:test';

import { bootServer, killProc, makeSandbox, nextPort } from './_helpers.ts';

interface MetaShape {
  title?: string;
  sections?: unknown[];
  viewport?: { x: number; y: number; zoom: number };
  layout?: { artboards: unknown[] };
  last_modified?: string;
  [k: string]: unknown;
}

function seedCanvas(designRoot: string, name = 'Phase4.tsx', meta?: MetaShape): string {
  const ui = join(designRoot, 'ui');
  mkdirSync(ui, { recursive: true });
  const tsxPath = join(ui, name);
  writeFileSync(tsxPath, 'export default function P(){return <main/>}\n');
  const metaPath = tsxPath.replace(/\.tsx$/, '.meta.json');
  if (meta) writeFileSync(metaPath, JSON.stringify(meta, null, 2));
  return tsxPath.replace(`${designRoot.replace(/\.design$/, '')}`, '').replace(/^\/+/, '');
}

function repoRel(designRoot: string, abs: string): string {
  // designRoot ends in `.design`. repoRoot is its parent.
  const repoRoot = designRoot.replace(/\.design$/, '').replace(/\/+$/, '');
  return abs.startsWith(`${repoRoot}/`) ? abs.slice(repoRoot.length + 1) : abs;
}

describe('/_api/canvas-meta — GET/PATCH', () => {
  test('PATCH merges viewport onto existing meta and preserves other keys', async () => {
    const { root, designRoot } = makeSandbox();
    const port = nextPort();
    const proc = await bootServer(root, port);
    try {
      mkdirSync(join(designRoot, 'ui'), { recursive: true });
      const tsxAbs = join(designRoot, 'ui', 'Phase4.tsx');
      writeFileSync(tsxAbs, 'export default function P(){return <main/>}\n');
      const metaAbs = tsxAbs.replace(/\.tsx$/, '.meta.json');
      writeFileSync(
        metaAbs,
        JSON.stringify({
          title: 'Phase 4',
          sections: [{ id: 'overview', label: 'Overview' }],
          ai_context: { pinned_decisions: ['keep dc-* classes'] },
        })
      );
      const file = repoRel(designRoot, tsxAbs);

      const r = await fetch(`http://localhost:${port}/_api/canvas-meta`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ file, patch: { viewport: { x: 12, y: 34, zoom: 1.5 } } }),
      });
      expect(r.status).toBe(200);
      const merged = (await r.json()) as MetaShape;
      expect(merged.title).toBe('Phase 4');
      expect(merged.sections).toBeDefined();
      expect(merged.ai_context).toBeDefined();
      expect(merged.viewport).toEqual({ x: 12, y: 34, zoom: 1.5 });
      expect(typeof merged.last_modified).toBe('string');

      // On-disk reflects the merge.
      const onDisk = JSON.parse(readFileSync(metaAbs, 'utf8')) as MetaShape;
      expect(onDisk.viewport?.zoom).toBe(1.5);
      expect(onDisk.title).toBe('Phase 4');
    } finally {
      await killProc(proc);
    }
  });

  test('PATCH clamps zoom to [0.1, 4.0]', async () => {
    const { root, designRoot } = makeSandbox();
    const port = nextPort();
    const proc = await bootServer(root, port);
    try {
      mkdirSync(join(designRoot, 'ui'), { recursive: true });
      const tsxAbs = join(designRoot, 'ui', 'Clamp.tsx');
      writeFileSync(tsxAbs, 'export default function C(){return <main/>}\n');
      writeFileSync(tsxAbs.replace(/\.tsx$/, '.meta.json'), '{"title":"Clamp"}');
      const file = repoRel(designRoot, tsxAbs);

      const r1 = await fetch(`http://localhost:${port}/_api/canvas-meta`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ file, patch: { viewport: { x: 0, y: 0, zoom: 99 } } }),
      });
      const m1 = (await r1.json()) as MetaShape;
      expect(m1.viewport?.zoom).toBe(4);

      const r2 = await fetch(`http://localhost:${port}/_api/canvas-meta`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ file, patch: { viewport: { x: 0, y: 0, zoom: 0.001 } } }),
      });
      const m2 = (await r2.json()) as MetaShape;
      expect(m2.viewport?.zoom).toBe(0.1);
    } finally {
      await killProc(proc);
    }
  });

  test('PATCH ignores non-finite viewport (NaN/Infinity)', async () => {
    const { root, designRoot } = makeSandbox();
    const port = nextPort();
    const proc = await bootServer(root, port);
    try {
      mkdirSync(join(designRoot, 'ui'), { recursive: true });
      const tsxAbs = join(designRoot, 'ui', 'Bad.tsx');
      writeFileSync(tsxAbs, 'export default function B(){return <main/>}\n');
      writeFileSync(
        tsxAbs.replace(/\.tsx$/, '.meta.json'),
        '{"title":"Bad","viewport":{"x":1,"y":2,"zoom":1}}'
      );
      const file = repoRel(designRoot, tsxAbs);

      const r = await fetch(`http://localhost:${port}/_api/canvas-meta`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ file, patch: { viewport: { x: 'nope', y: null, zoom: 1 } } }),
      });
      const m = (await r.json()) as MetaShape;
      // Prior value preserved.
      expect(m.viewport).toEqual({ x: 1, y: 2, zoom: 1 });
    } finally {
      await killProc(proc);
    }
  });

  test('GET returns the meta document', async () => {
    const { root, designRoot } = makeSandbox();
    const port = nextPort();
    const proc = await bootServer(root, port);
    try {
      mkdirSync(join(designRoot, 'ui'), { recursive: true });
      const tsxAbs = join(designRoot, 'ui', 'Read.tsx');
      writeFileSync(tsxAbs, 'export default function R(){return <main/>}\n');
      writeFileSync(
        tsxAbs.replace(/\.tsx$/, '.meta.json'),
        JSON.stringify({ title: 'Read', viewport: { x: 5, y: 6, zoom: 0.5 } })
      );
      const file = repoRel(designRoot, tsxAbs);

      const r = await fetch(
        `http://localhost:${port}/_api/canvas-meta?file=${encodeURIComponent(file)}`
      );
      expect(r.status).toBe(200);
      const m = (await r.json()) as MetaShape;
      expect(m.title).toBe('Read');
      expect(m.viewport?.zoom).toBe(0.5);
    } finally {
      await killProc(proc);
    }
  });

  test('PATCH layout persists position-only entries (Phase 4.2 strip-on-write)', async () => {
    // DDR-027: artboard w/h is JSX-authoritative. The client-side writer
    // (canvas-lib.tsx patchCanvasMeta) strips w/h before PATCH; the server
    // must round-trip whatever shape it receives without rejecting partial
    // entries.
    const { root, designRoot } = makeSandbox();
    const port = nextPort();
    const proc = await bootServer(root, port);
    try {
      mkdirSync(join(designRoot, 'ui'), { recursive: true });
      const tsxAbs = join(designRoot, 'ui', 'Phase42.tsx');
      writeFileSync(tsxAbs, 'export default function P(){return <main/>}\n');
      const metaAbs = tsxAbs.replace(/\.tsx$/, '.meta.json');
      writeFileSync(metaAbs, JSON.stringify({ title: 'P', sections: [] }));
      const file = repoRel(designRoot, tsxAbs);

      const r = await fetch(`http://localhost:${port}/_api/canvas-meta`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          file,
          patch: {
            layout: {
              artboards: [
                { id: 'a', x: 100, y: 50 },
                { id: 'b', x: 1500, y: 50 },
              ],
            },
          },
        }),
      });
      expect(r.status).toBe(200);
      const merged = (await r.json()) as MetaShape;
      const arts = merged.layout?.artboards as Array<Record<string, unknown>> | undefined;
      expect(arts).toBeDefined();
      expect(arts?.length).toBe(2);
      // No w/h written.
      expect(arts?.[0]).toEqual({ id: 'a', x: 100, y: 50 });
      expect(arts?.[1]).toEqual({ id: 'b', x: 1500, y: 50 });

      const onDisk = JSON.parse(readFileSync(metaAbs, 'utf8')) as MetaShape;
      const diskArts = onDisk.layout?.artboards as Array<Record<string, unknown>> | undefined;
      expect(diskArts?.[0]).not.toHaveProperty('w');
      expect(diskArts?.[0]).not.toHaveProperty('h');
    } finally {
      await killProc(proc);
    }
  });

  test('PATCH rejects paths that escape repoRoot', async () => {
    const { root } = makeSandbox();
    const port = nextPort();
    const proc = await bootServer(root, port);
    try {
      const r = await fetch(`http://localhost:${port}/_api/canvas-meta`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          file: '../escape.tsx',
          patch: { viewport: { x: 0, y: 0, zoom: 1 } },
        }),
      });
      expect(r.status).toBe(404);
    } finally {
      await killProc(proc);
    }
  });
});
