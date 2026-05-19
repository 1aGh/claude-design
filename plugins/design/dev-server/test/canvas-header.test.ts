// canvas-header.ts — Phase 3.6 Task 12a. Tests the JSDoc header projector
// (idempotent replace + ai_context surfacing).

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  type MetaSidecar,
  applyHeader,
  applyHeaderToSource,
  buildHeader,
} from '../canvas-header.ts';

const META: MetaSidecar = {
  title: 'Smoke Canvas',
  subtitle: 'Single hero with CTA — smoke harness',
  brief: 'Verify the JSDoc projection round-trips meta.',
  platform: 'desktop',
  designSystem: 'project',
  opt_out_scope: 'palette',
  css_mode: 'inline',
  sections: [{ id: 's', artboards: [{ id: 'a1' }, { id: 'a2' }] }],
};

describe('canvas-header / buildHeader', () => {
  test('renders all canonical @tags', () => {
    const out = buildHeader({ name: 'Smoke Canvas', meta: META });
    expect(out).toContain('@canvas      Smoke Canvas — Single hero with CTA');
    expect(out).toContain('@ds          project');
    expect(out).toContain('@platform    desktop');
    expect(out).toContain('@opt_out     palette');
    expect(out).toContain('@artboards   a1 | a2');
    expect(out).toContain('@brief       Verify the JSDoc projection');
    expect(out).toContain('@stack       React 19 · TSX · Bun.build · css_mode=inline');
    expect(out).toContain('@history     .design/_history/smoke-canvas/');
    expect(out).toContain('@handoff     bunx shadcn add file://./Smoke Canvas.registry.json');
  });

  test('surfaces ai_context fields when present', () => {
    const meta: MetaSidecar = {
      ...META,
      ai_context: {
        why_this_exists: 'Captures the cold-read contract for future Claude.',
        pinned_decisions: ['Bun.hash over blake3-wasm (smaller dep tree)'],
        known_quirks: ['IDs renumber on sibling-insert — documented in DDR-019'],
      },
    };
    const out = buildHeader({ name: 'Smoke', meta });
    expect(out).toContain('@notes       Captures the cold-read contract');
    expect(out).toContain('@decision    Bun.hash over blake3-wasm');
    expect(out).toContain('@quirk       IDs renumber on sibling-insert');
  });

  test('omits ai_context lines when absent', () => {
    const out = buildHeader({ name: 'Smoke', meta: META });
    expect(out).not.toContain('@notes');
    expect(out).not.toContain('@decision');
    expect(out).not.toContain('@quirk');
  });
});

describe('canvas-header / applyHeaderToSource', () => {
  test('replaces an existing leading block comment', () => {
    const source = `/** STALE HEADER */\nimport { useState } from "react";\nexport default function X() { return <div/>; }\n`;
    const header = '/** NEW HEADER */';
    const out = applyHeaderToSource(source, header);
    expect(out.startsWith('/** NEW HEADER */')).toBe(true);
    expect(out).not.toContain('STALE HEADER');
    expect(out).toContain('import { useState }');
  });

  test('prepends when no leading block comment exists', () => {
    const source = `import { useState } from "react";\nexport default function X() { return <div/>; }\n`;
    const header = '/** NEW HEADER */';
    const out = applyHeaderToSource(source, header);
    expect(out.startsWith('/** NEW HEADER */')).toBe(true);
    expect(out).toContain('import { useState }');
  });

  test('idempotent — applying twice yields the same output', () => {
    const source = `import { useState } from "react";\nexport default function X() { return <div/>; }\n`;
    const header = '/** A */';
    const once = applyHeaderToSource(source, header);
    const twice = applyHeaderToSource(once, header);
    expect(twice).toBe(once);
  });
});

describe('canvas-header / applyHeader (fs)', () => {
  let dir = '';
  beforeAll(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'header-'));
  });
  afterAll(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  test('writes a fresh header + persists meta projection', async () => {
    const canvas = path.join(dir, 'Demo.tsx');
    const meta = path.join(dir, 'Demo.meta.json');
    await Bun.write(
      canvas,
      'import { useState } from "react";\nexport default function Demo() { return <div/>; }\n'
    );
    await Bun.write(meta, JSON.stringify(META, null, 2));
    const r = await applyHeader(canvas);
    expect(r.changed).toBe(true);
    const out = await Bun.file(canvas).text();
    expect(out.startsWith('/**')).toBe(true);
    expect(out).toContain('@canvas      Demo');
    expect(out).toContain('@ds          project');
    expect(out).toContain('export default function Demo');
  });

  test('idempotent — second invocation is no-op', async () => {
    const canvas = path.join(dir, 'Demo2.tsx');
    const meta = path.join(dir, 'Demo2.meta.json');
    await Bun.write(canvas, 'export default function Demo2() { return <div/>; }\n');
    await Bun.write(meta, JSON.stringify(META, null, 2));
    const r1 = await applyHeader(canvas);
    expect(r1.changed).toBe(true);
    const r2 = await applyHeader(canvas);
    expect(r2.changed).toBe(false);
  });
});
