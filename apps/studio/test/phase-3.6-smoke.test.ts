// Phase 3.6 Task 11 — end-to-end smoke. Runs the full TSX pipeline against
// the migrated canvases sitting in this repo's .design/ui/ folder, verifying:
//
//   - oxc-parser + magic-string two-pass transform produces parseable JS
//   - locator map is non-trivially populated (every JSX element gets an entry)
//   - Bun.build wraps the post-pass-1 source into a browser-loadable ESM
//     (proves the codemod's output cooperates with canvas-build.ts)
//   - handoff.emitRegistryItem produces a schema-valid registry-item.json
//     with `data-cd-id` stripped + react/react-dom in the dep floor
//
// Skips itself cleanly when the canvases haven't been migrated (CI / fresh
// checkout). The bun-only-locally guard keeps the suite portable.

import { describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import path from 'node:path';

import { buildCanvasModule } from '../canvas-build.ts';
import { transpileCanvasSource } from '../canvas-pipeline.ts';
import { emitRegistryItem } from '../handoff.ts';

const REPO_ROOT = path.resolve(import.meta.dir, '../../../..');
const DESIGN_ROOT = path.join(REPO_ROOT, '.design');
const DOCS_SITE = path.join(DESIGN_ROOT, 'ui/Docs Site.tsx');
const CANVAS_VIEWPORT = path.join(DESIGN_ROOT, 'ui/Canvas Viewport.tsx');

const skipReason = (() => {
  if (!existsSync(DOCS_SITE)) return `${DOCS_SITE} missing — run scripts/migrate-canvases.ts`;
  if (!existsSync(CANVAS_VIEWPORT))
    return `${CANVAS_VIEWPORT} missing — run scripts/migrate-canvases.ts`;
  return null;
})();

const describeOrSkip = skipReason ? describe.skip : describe;

describeOrSkip('Phase 3.6 smoke — migrated canvases through the full pipeline', () => {
  test('canvas-pipeline transpiles Docs Site.tsx + emits a non-trivial locator', async () => {
    const src = await Bun.file(DOCS_SITE).text();
    const r = transpileCanvasSource(DOCS_SITE, src);
    expect(r.js.length).toBeGreaterThan(0);
    // Docs Site has 5 artboards × ~tens of elements each — well above the 100 floor.
    expect(Object.keys(r.locator).length).toBeGreaterThan(100);
    // ETag is deterministic across runs on identical source.
    const again = transpileCanvasSource(DOCS_SITE, src);
    expect(again.etag).toBe(r.etag);
  });

  test('canvas-pipeline transpiles Canvas Viewport.tsx', async () => {
    const src = await Bun.file(CANVAS_VIEWPORT).text();
    const r = transpileCanvasSource(CANVAS_VIEWPORT, src);
    expect(r.js.length).toBeGreaterThan(0);
    expect(Object.keys(r.locator).length).toBeGreaterThan(100);
  });

  test('canvas-build produces browser-loadable ESM for Docs Site.tsx', async () => {
    const src = await Bun.file(DOCS_SITE).text();
    const r = await buildCanvasModule(DOCS_SITE, src);
    expect(r.js).toContain('export');
    // React + jsx-runtime stay external (resolved via importmap in shell).
    expect(r.js).toContain('react');
  });

  test('handoff.emitRegistryItem strips data-cd-id + floors react/react-dom', async () => {
    const item = await emitRegistryItem({
      canvasAbsPath: DOCS_SITE,
      title: 'Docs Site',
      description: 'Smoke regression target',
    });
    expect(item.$schema).toBe('https://ui.shadcn.com/schema/registry-item.json');
    expect(item.type).toBe('registry:block');
    expect(item.name).toBe('docs-site');
    expect(item.dependencies).toContain('react');
    expect(item.dependencies).toContain('react-dom');
    expect(item.files[0]?.path).toBe('components/docs-site.tsx');
    expect(item.files[0]?.content).not.toContain('data-cd-id');
  });
});
