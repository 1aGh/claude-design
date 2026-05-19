// canvas-build.ts — Phase 3.6 Task 6. Verify the per-canvas Bun.build wrap
// produces browser-loadable ES modules that:
//   1. preserve the data-cd-id attributes injected by canvas-pipeline pass 1,
//   2. import "react" / "react/jsx-dev-runtime" as standard ESM specifiers
//      (browser resolves via importmap to /_canvas-runtime/*.js),
//   3. expose the default export so _shell.html can mount it.

import { describe, expect, test } from 'bun:test';

import { buildCanvasModule } from '../canvas-build.ts';

// Bun.build resolves the entrypoint against the filesystem (its virtual-loader
// plugin only kicks in for onLoad, after onResolve has confirmed the path
// exists). Each test writes its source to a real temp file and points
// buildCanvasModule at it; the canvas-virtual-source plugin then intercepts
// the onLoad and feeds the post-pass-1 TSX.
async function writeTmp(name: string, source: string): Promise<string> {
  const abs = `/tmp/canvas-build-${name}-${Math.random().toString(36).slice(2, 8)}.tsx`;
  await Bun.write(abs, source);
  return abs;
}

describe('canvas-build / buildCanvasModule', () => {
  test('preserves data-cd-id from pass 1', async () => {
    const src =
      `import { useState } from "react";\n` +
      'export default function Demo() {\n' +
      '  const [n] = useState(0);\n' +
      `  return <button className="btn">{n}</button>;\n` +
      '}\n';
    const abs = await writeTmp('cd-id', src);
    const r = await buildCanvasModule(abs, src);
    expect(r.js).toContain('data-cd-id');
    expect(r.js).toContain('className: "btn"');
  });

  test('emits standard react JSX runtime import (no Bun-internal symbols)', async () => {
    const src = 'export default function X() { return <div />; }\n';
    const abs = await writeTmp('std-jsx', src);
    const r = await buildCanvasModule(abs, src);
    // Production-mode build uses react/jsx-runtime (the dev variant trips a
    // Bun.build rename collision with React's CJS `var React` hoist; see
    // runtime-bundle.ts comment). Accept either runtime name.
    expect(r.js).toMatch(/react\/jsx(-dev)?-runtime/);
    // The pre-3.6 Bun.Transpiler-only path emitted `jsxDEV_<hash>` /
    // `jsx_<hash>`; Bun.build uses the standard name.
    expect(r.js).not.toMatch(/jsxDEV?_[0-9a-z]{6,}/);
  });

  test('locator + etag mirror the canvas-pipeline result', async () => {
    const src =
      'export default function Y() {\n' + '  return <section><h1>hi</h1></section>;\n' + '}\n';
    const abs = await writeTmp('locator', src);
    const r = await buildCanvasModule(abs, src);
    // section + h1 = 2 JSX elements → 2 locator entries.
    expect(Object.keys(r.locator).length).toBe(2);
    expect(r.etag).toMatch(/^[0-9a-f]+$/);
  });

  test('externalises react + reactDOM (no inlined copies)', async () => {
    const src = 'export default function Z() { return <span />; }\n';
    const abs = await writeTmp('external', src);
    const r = await buildCanvasModule(abs, src);
    // ReactDOM's package signature; the canvas bundle must NOT contain it,
    // or the runtime singleton invariant breaks (two React copies).
    expect(r.js).not.toContain('ReactCurrentOwner');
    // jsx-runtime stays external too — the canvas should import jsxDEV via
    // a normal specifier, not redefine it.
    expect(r.js).not.toContain('function jsxDEV(');
  });

  test('exposes a default export', async () => {
    const src = 'export default function Q() { return <i />; }\n';
    const abs = await writeTmp('default', src);
    const r = await buildCanvasModule(abs, src);
    expect(r.js).toMatch(/export\s*\{[\s\S]*default[\s\S]*\}/);
  });
});
