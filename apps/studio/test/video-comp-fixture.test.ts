// video-comp-fixture — DDR-148 end-to-end build guard (CI-safe, no browser).
//
// The heavy render/scrub/export path is verified live via agent-browser + the
// determinism smoke; here we lock the CI-cheap invariant the whole feature
// rests on: a real video-comp canvas (the canonical fixture) BUILDS through the
// production canvas pipeline (buildCanvasModule) with `remotion`,
// `@remotion/transitions`, and the `fade` presentation externalised to the
// importmap (RUNTIME_PACKAGES) — never inlined (which would resolve against a
// non-existent user node_modules on an npm/marketplace install) — and with the
// <VideoComp> wrapper inlined from @maude/canvas-lib.

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

import { buildCanvasModule } from '../canvas-build.ts';

const FIXTURE = new URL('./fixtures/video-comp-fixture.tsx', import.meta.url).pathname;

describe('video-comp fixture — production build guard', () => {
  test('builds through buildCanvasModule with the Remotion runtime externalised', async () => {
    const src = readFileSync(FIXTURE, 'utf8');
    const r = await buildCanvasModule(FIXTURE, src);
    expect(r.js.length).toBeGreaterThan(1000);

    const externals = new Set(
      [...r.js.matchAll(/from\s*["']([^"'.][^"']*)["']/g)].map((m) => m[1])
    );
    // The comp's Remotion imports MUST stay external (importmap → pre-built
    // /_canvas-runtime bundles), or an end-user install can't resolve them.
    expect(externals.has('remotion')).toBe(true);
    expect(externals.has('@remotion/transitions')).toBe(true);
    expect(externals.has('@remotion/transitions/fade')).toBe(true);
    expect(externals.has('react')).toBe(true);

    // <VideoComp> (+ the seek-bridge) is inlined from @maude/canvas-lib.
    expect(r.js).toContain('VideoComp');
    expect(r.js).toContain('__maude_seek__');
  });

  test('every Remotion specifier the fixture imports is a known RUNTIME_PACKAGE', async () => {
    const { RUNTIME_PACKAGES } = await import('../runtime-bundle.ts');
    const known = new Set<string>(RUNTIME_PACKAGES);
    const src = readFileSync(FIXTURE, 'utf8');
    const imported = [...src.matchAll(/from\s*["'](@?remotion[^"']*)["']/g)].map((m) => m[1]);
    expect(imported.length).toBeGreaterThan(0);
    for (const spec of imported) {
      expect(known.has(spec)).toBe(true);
    }
  });
});
