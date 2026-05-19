// Browser-loadable canvas bundle (DDR-019, Phase 3.6 Task 6).
//
// The pre-3.6 pipeline (canvas-pipeline.ts) parses the TSX, injects data-cd-id,
// then lowers JSX via Bun.Transpiler. Output is JS but uses Bun-runtime-internal
// `jsxDEV_<hash>` symbol names — not browser-loadable.
//
// This module wraps that pipeline with a second pass through Bun.build, which
// resolves the JSX runtime against the canonical "react/jsx-dev-runtime" import
// and externalises React + ReactDOM. Output is standard ES module text. The
// browser loads it via the runtime importmap declared in _shell.html.
//
// The two-stage approach is deliberate:
//
//   1. canvas-pipeline.ts (oxc + magic-string) — owns identity. Pre-orders JSX
//      elements, injects data-cd-id, writes _locator.json. Pure + fast.
//   2. canvas-build.ts (Bun.build) — owns module shape. Feeds the post-pass-1
//      source to Bun.build via a virtual-loader plugin, so the bundler
//      processes our edited source (not the on-disk file). Externalises every
//      runtime package the importmap covers.
//
// Caller (http.ts) reads the canvas source, calls buildCanvasModule(), then
// serves the resulting JS at /<designRel>/ui/<slug>.tsx with Content-Type
// `application/javascript`.

import { existsSync } from 'node:fs';
import path from 'node:path';

import { canvasLibPath, canvasLibResolver } from './canvas-lib-resolver.ts';
import { transpileCanvasSource } from './canvas-pipeline.ts';
import type { LocatorMap } from './locator.ts';
import { RUNTIME_PACKAGES } from './runtime-bundle.ts';

export interface CanvasBundleResult {
  /** Browser-loadable ES module text. */
  js: string;
  /** data-cd-id → source location map (same as the pipeline emits). */
  locator: LocatorMap;
  /** Content-derived hash; suitable as HTTP ETag. */
  etag: string;
}

export interface BuildCanvasOptions {
  /**
   * Absolute path to the design root. Used to resolve the virtual specifier
   * `@mdcc/canvas-lib` → `<designRoot>/_lib/canvas-lib.tsx`. If omitted, the
   * design root is inferred from the canvas path (the nearest ancestor that
   * contains a `_lib/canvas-lib.tsx`, falling back to the canvas's containing
   * dir). Pass the real value from `ctx.paths.designRoot` whenever possible.
   */
  designRoot?: string;
}

/**
 * Build a single canvas TSX file end-to-end. Identity pass is from
 * canvas-pipeline.ts; the module pass is Bun.build with React externalised
 * and `@mdcc/canvas-lib` resolved to the project-owned canvas-lib source.
 */
export async function buildCanvasModule(
  canvasAbsPath: string,
  source: string,
  options: BuildCanvasOptions = {}
): Promise<CanvasBundleResult> {
  // Pass 1: inject data-cd-id, capture the locator.
  const pass1 = transpileCanvasSource(canvasAbsPath, source);
  const designRoot = options.designRoot ?? inferDesignRoot(canvasAbsPath);

  // Pre-flight the canvas-lib resolver — Bun.build collapses plugin throws to
  // a useless "Bundle failed" string, so we surface the missing-lib reason
  // ourselves before delegating.
  if (/@mdcc\/canvas-lib/.test(source) && !existsSync(canvasLibPath(designRoot))) {
    throw new Error(
      `[@mdcc/canvas-lib] canvas library missing at ${canvasLibPath(designRoot)}. Canvas ${canvasAbsPath} imports it. Run /design:setup-ds to scaffold, or copy plugins/design/templates/canvas-lib.tsx.template.`
    );
  }

  // Pass 2: Bun.build with a virtual loader that resolves canvasAbsPath to the
  // post-pass-1 TSX. Every other import (npm packages, relative imports of
  // sibling canvas components) goes through Bun's default resolver. The four
  // runtime packages are externalised so they resolve through the importmap.
  const externalSpecifiers = new Set<string>(
    RUNTIME_PACKAGES.flatMap((p) => [p, ...(p === 'react-dom/client' ? ['react-dom'] : [])])
  );

  const built = await Bun.build({
    entrypoints: [canvasAbsPath],
    target: 'browser',
    format: 'esm',
    minify: false,
    splitting: false,
    define: {
      // Match runtime-bundle.ts: production React. Without this the canvas's
      // `import { jsxDEV } from "react/jsx-dev-runtime"` resolves against a
      // bundle that fails to load due to a Bun.build naming collision in the
      // dev variant. Both halves of the system MUST agree on the JSX runtime
      // flavour.
      'process.env.NODE_ENV': '"production"',
    },
    plugins: [
      // Resolve `@mdcc/canvas-lib` BEFORE exact-externals — we want the bare
      // specifier to map to the on-disk lib file, not get marked external.
      canvasLibResolver(designRoot),
      {
        name: 'canvas-virtual-source',
        setup(builder) {
          builder.onLoad({ filter: filterForExactPath(canvasAbsPath) }, () => ({
            contents: pass1.withIds,
            loader: 'tsx',
          }));
        },
      },
      {
        name: 'exact-externals',
        setup(builder) {
          builder.onResolve({ filter: /.*/ }, (args) => {
            if (externalSpecifiers.has(args.path)) {
              return { path: args.path, external: true };
            }
            return null;
          });
        },
      },
    ],
  });

  if (!built.success) {
    const msg = built.logs.map((l) => l.message).join('\n');
    throw new Error(`Bun.build failed on ${canvasAbsPath}:\n${msg}`);
  }
  const entry = built.outputs.find((o) => o.kind === 'entry-point');
  if (!entry) {
    throw new Error(`Bun.build produced no entry-point output for ${canvasAbsPath}`);
  }
  let js = await entry.text();

  // Gather any sibling CSS the bundler produced from `import "./<slug>.css"`
  // statements in the canvas/specimen TSX. Bun.build extracts those into a
  // separate `kind: "asset"` CSS file. Browser-loaded ESM doesn't process
  // `import "*.css"` natively, so we inline the CSS via a `<style>` tag
  // injection at module-init time — keeps each canvas self-contained without
  // needing a parallel `<link>` request.
  const cssAssets = built.outputs.filter((o) => o.kind === 'asset' && o.path.endsWith('.css'));
  if (cssAssets.length > 0) {
    let css = '';
    for (const a of cssAssets) css += await a.text();
    if (css.trim().length > 0) {
      const slug = canvasAbsPath.split('/').pop() ?? 'canvas';
      js = buildCssInjector(slug, css) + js;
    }
  }

  const etag = Bun.hash(js).toString(16);
  return { js, locator: pass1.locator, etag };
}

/**
 * Synthesize a module-init prologue that creates a `<style data-canvas-css>`
 * tag with the bundled CSS text. Idempotent per-slug — duplicate mounts of
 * the same canvas don't re-inject. Run at top-level so it executes before
 * the React component does its first render.
 */
function buildCssInjector(slug: string, css: string): string {
  // JSON-encode the CSS text so we don't need to worry about backticks,
  // backslashes, or embedded `</style>` (which would break a raw template).
  const enc = JSON.stringify(css);
  const id = `canvas-css-${slug.replace(/[^a-zA-Z0-9-]/g, '_')}`;
  return `// canvas-build: inject bundled sibling CSS so the canvas is self-contained.\n(function(){if(typeof document==="undefined")return;if(document.getElementById(${JSON.stringify(id)}))return;var s=document.createElement("style");s.id=${JSON.stringify(id)};s.dataset.canvasCss="bundled";s.textContent=${enc};document.head.appendChild(s);})();\n`;
}

function filterForExactPath(absPath: string): RegExp {
  // Bun.build hands onLoad the resolved on-disk path. On macOS /tmp is a
  // symlink to /private/tmp, so an entrypoint of "/tmp/foo.tsx" arrives in
  // onLoad as "/private/tmp/foo.tsx". Match on the *trailing* path
  // segments — same filename + parent dir — which is enough to uniquely
  // identify a canvas file path while tolerating prefix normalisations.
  // We require the last two segments to match so a canvas with the same
  // filename in a different directory doesn't collide.
  const parts = absPath.split('/');
  const tail = parts.slice(-2).join('/');
  return new RegExp(`/${escapeRegex(tail)}$`);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Walk up from the canvas path looking for an ancestor that contains a
 * `_lib/canvas-lib.tsx`. Falls back to the canvas's containing dir if nothing
 * matches — the resolver will then fail loud if any canvas tries to import
 * `@mdcc/canvas-lib`. Tests + http.ts always pass the explicit designRoot, so
 * this fallback only fires when somebody hand-calls buildCanvasModule().
 */
function inferDesignRoot(canvasAbsPath: string): string {
  let dir = path.dirname(canvasAbsPath);
  // Hard ceiling to avoid runaway loops on weird path shapes.
  for (let i = 0; i < 12; i++) {
    if (existsSync(path.join(dir, '_lib', 'canvas-lib.tsx'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.dirname(canvasAbsPath);
}
