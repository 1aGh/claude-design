// handoff.ts — Phase 3.6 Task 7 + 12b. Tests the shadcn registry-item emitter:
// data-cd-id strip, import classification, className harvest, CSS subset
// extraction, full emit round-trip.

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  classifyImports,
  collectClassNames,
  emitRegistryItem,
  filterComponentsCss,
  filterTokensCss,
  stripDataCdId,
  writeRegistryItem,
  type RegistryItem,
} from '../handoff.ts';
import { transpileCanvasSource } from '../canvas-pipeline.ts';

const CANVAS = '/abs/Canvas.tsx';

describe('handoff / stripDataCdId', () => {
  test('removes pipeline-emitted data-cd-id attrs', () => {
    const src = `function Demo() { return <div className="btn">x</div>; }`;
    const withIds = transpileCanvasSource(CANVAS, src).withIds;
    expect(withIds).toContain('data-cd-id=');
    const stripped = stripDataCdId(CANVAS, withIds);
    expect(stripped).not.toContain('data-cd-id');
    // Same shape as the original source (data-cd-id strip is idempotent on the
    // original).
    expect(stripped).toBe(src);
  });

  test('strip is idempotent on already-stripped source', () => {
    const src = `function Demo() { return <div>x</div>; }`;
    expect(stripDataCdId(CANVAS, src)).toBe(src);
  });

  test('preserves other attributes byte-for-byte', () => {
    const src =
      `function Demo() { return <button className="btn" aria-label="ok" data-cd-id="deadbeef">go</button>; }`;
    const out = stripDataCdId(CANVAS, src);
    expect(out).toContain('className="btn"');
    expect(out).toContain('aria-label="ok"');
    expect(out).not.toContain('data-cd-id');
  });
});

describe('handoff / classifyImports', () => {
  test('separates npm specifiers from registry deps', () => {
    const src = `
      import { useState } from "react";
      import * as ReactDOM from "react-dom/client";
      import { motion } from "motion/react";
      import { Button } from "@/components/ui/button";
      import { Card } from "@/components/ui/card";
      import { localThing } from "./local";
      function Demo() { return <div/>; }
    `;
    const r = classifyImports(CANVAS, src);
    expect(r.dependencies).toEqual(['motion', 'react', 'react-dom']);
    expect(r.registryDependencies).toEqual(['button', 'card']);
  });

  test('relative imports are ignored', () => {
    const src = `
      import { sibling } from "./a";
      import { up } from "../b/c";
      function Demo() { return <div/>; }
    `;
    const r = classifyImports(CANVAS, src);
    // Bun.Transpiler.scanImports auto-surfaces "react" when JSX is present
    // (it's the implicit jsx-runtime import). That's fine — react is in the
    // mandatory dep floor anyway. The relative imports must NOT appear.
    expect(r.dependencies.every((d) => !d.startsWith('.'))).toBe(true);
    expect(r.dependencies).not.toContain('./a');
    expect(r.registryDependencies).toEqual([]);
  });
});

describe('handoff / collectClassNames', () => {
  test('gathers tokens from className literals', () => {
    const src = `
      function Demo() {
        return (
          <div className="btn btn--ghost">
            <span className="sku">x</span>
            <em className={"tile " + "tile--active"}>y</em>
          </div>
        );
      }
    `;
    const names = collectClassNames(CANVAS, src);
    expect(names.has('btn')).toBe(true);
    expect(names.has('btn--ghost')).toBe(true);
    expect(names.has('sku')).toBe(true);
    // String concat → first literal contributes "tile ", second contributes
    // "tile--active". Both surface.
    expect(names.has('tile')).toBe(true);
    expect(names.has('tile--active')).toBe(true);
  });

  test('TemplateLiteral quasis contribute', () => {
    const src = `
      function Demo() {
        const active = true;
        return <div className={\`btn \${active ? 'btn--active' : ''}\`}>x</div>;
      }
    `;
    const names = collectClassNames(CANVAS, src);
    expect(names.has('btn')).toBe(true);
  });
});

describe('handoff / filterComponentsCss', () => {
  const cssSource = `
    /* Buttons */
    .btn {
      padding: 6px var(--space-3);
      color: var(--fg-0);
    }
    .btn--ghost {
      background: transparent;
    }
    .btn:hover { color: var(--accent); }
    .sku {
      letter-spacing: var(--tracking-sku);
    }
    .unused {
      color: red;
    }
    @media (min-width: 1200px) {
      .btn { padding: 8px var(--space-4); }
      .unused { font-size: 16px; }
    }
  `;

  test('keeps rules whose base class is in the keep set', () => {
    const r = filterComponentsCss(cssSource, new Set(['btn']));
    expect(r.css).toContain('.btn {');
    expect(r.css).toContain('.btn--ghost');
    expect(r.css).toContain('.btn:hover');
    expect(r.css).not.toContain('.unused');
    expect(r.css).not.toContain('.sku');
  });

  test('collects var(--*) tokens from kept rules', () => {
    const r = filterComponentsCss(cssSource, new Set(['btn']));
    expect(r.tokens.has('--space-3')).toBe(true);
    expect(r.tokens.has('--fg-0')).toBe(true);
    expect(r.tokens.has('--accent')).toBe(true);
    expect(r.tokens.has('--tracking-sku')).toBe(false);
  });

  test('recurses into @media rules', () => {
    const r = filterComponentsCss(cssSource, new Set(['btn']));
    expect(r.css).toContain('@media');
    expect(r.css).toContain('--space-4');
  });

  test('empty keep set produces empty output', () => {
    const r = filterComponentsCss(cssSource, new Set());
    expect(r.css.trim()).toBe('');
  });
});

describe('handoff / filterTokensCss', () => {
  const tokensCss = `
    :root {
      --fg-0: #111;
      --bg-0: #fff;
      --accent: #d97706;
      --unused: #abc;
    }
  `;

  test('extracts only requested tokens', () => {
    const r = filterTokensCss(tokensCss, new Set(['--fg-0', '--accent']));
    expect(r.theme['fg-0']).toBe('#111');
    expect(r.theme['accent']).toBe('#d97706');
    expect(r.theme['unused']).toBeUndefined();
    expect(r.usedCss).toContain('--fg-0: #111;');
    expect(r.usedCss).toContain('--accent: #d97706;');
    expect(r.usedCss).not.toContain('--unused');
  });
});

describe('handoff / emitRegistryItem end-to-end', () => {
  let tmpDir = '';
  beforeAll(() => {
    tmpDir = mkdtempSync(path.join(tmpdir(), 'handoff-'));
  });
  afterAll(() => {
    if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
  });

  test('emits valid registry-item with stripped TSX + bundled CSS + cssVars', async () => {
    // Lay out a minimal canvas + DS in the tmp dir.
    const canvasAbs = path.join(tmpDir, 'Test Canvas.tsx');
    const componentsCssAbs = path.join(tmpDir, '_components.css');
    const tokensCssAbs = path.join(tmpDir, 'tokens.css');
    await Bun.write(
      canvasAbs,
      `import { useState } from "react";
       import { Button } from "@/components/ui/button";
       export default function TestCanvas() {
         return (
           <div className="mdcc">
             <h1 className="sku">Hi</h1>
             <button className="btn btn--ghost" data-cd-id="cafef00d">Go</button>
           </div>
         );
       }`
    );
    await Bun.write(
      componentsCssAbs,
      `.btn { padding: 6px var(--space-3); color: var(--fg-0); }
       .btn--ghost { background: transparent; }
       .sku { letter-spacing: var(--tracking-sku); }
       .unused { color: red; }`
    );
    await Bun.write(
      tokensCssAbs,
      `:root { --space-3: 12px; --fg-0: #111; --tracking-sku: 0.04em; --unused: #abc; }`
    );

    const item = await emitRegistryItem({
      canvasAbsPath: canvasAbs,
      title: 'Test Canvas',
      description: 'Smoke harness',
      componentsCssPath: componentsCssAbs,
      tokensCssPath: tokensCssAbs,
    });

    expect(item.$schema).toBe('https://ui.shadcn.com/schema/registry-item.json');
    expect(item.name).toBe('test-canvas');
    expect(item.type).toBe('registry:block');
    expect(item.title).toBe('Test Canvas');
    expect(item.description).toBe('Smoke harness');
    expect(item.dependencies).toContain('react');
    expect(item.dependencies).toContain('react-dom');
    expect(item.registryDependencies).toEqual(['button']);

    // files[0] is the TSX, sans data-cd-id.
    expect(item.files[0]?.path).toBe('components/test-canvas.tsx');
    expect(item.files[0]?.type).toBe('registry:component');
    expect(item.files[0]?.content).not.toContain('data-cd-id');

    // CSS bundle present + token bundle present + cssVars present.
    const cssFile = item.files.find((f) => f.type === 'registry:style');
    expect(cssFile).toBeDefined();
    expect(cssFile?.content).toContain('.btn');
    expect(cssFile?.content).toContain('.sku');
    expect(cssFile?.content).not.toContain('.unused');

    const tokenFile = item.files.find((f) => f.type === 'registry:theme');
    expect(tokenFile?.content).toContain('--space-3');
    expect(tokenFile?.content).toContain('--fg-0');
    expect(tokenFile?.content).not.toContain('--unused');

    expect(item.cssVars?.theme?.['space-3']).toBe('12px');
    expect(item.cssVars?.theme?.['fg-0']).toBe('#111');

    // Persisted form is valid JSON.
    const dest = path.join(tmpDir, 'Test Canvas.registry.json');
    await writeRegistryItem(dest, item);
    const parsed: RegistryItem = await Bun.file(dest).json();
    expect(parsed.name).toBe('test-canvas');
    expect(parsed.files.length).toBe(item.files.length);
  });

  test('emit without CSS paths produces TSX-only registry-item', async () => {
    const canvasAbs = path.join(tmpDir, 'NoCss.tsx');
    await Bun.write(
      canvasAbs,
      `export default function NoCss() { return <div>x</div>; }`
    );
    const item = await emitRegistryItem({ canvasAbsPath: canvasAbs });
    expect(item.files.length).toBe(1);
    expect(item.files[0]?.type).toBe('registry:component');
    expect(item.cssVars).toBeUndefined();
  });
});
