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

/**
 * Build a single canvas TSX file end-to-end. Identity pass is from
 * canvas-pipeline.ts; the module pass is Bun.build with React externalised.
 */
export async function buildCanvasModule(
  canvasAbsPath: string,
  source: string
): Promise<CanvasBundleResult> {
  // Pass 1: inject data-cd-id, capture the locator.
  const pass1 = transpileCanvasSource(canvasAbsPath, source);

  // Pass 2: Bun.build with a virtual loader that resolves canvasAbsPath to the
  // post-pass-1 TSX. Every other import (npm packages, relative imports of
  // sibling canvas components) goes through Bun's default resolver. The four
  // runtime packages are externalised so they resolve through the importmap.
  const externalSpecifiers = new Set<string>(
    RUNTIME_PACKAGES.flatMap((p) => [
      p,
      ...(p === 'react-dom/client' ? ['react-dom'] : []),
    ])
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
  const out = built.outputs[0];
  if (!out) {
    throw new Error(`Bun.build produced no output for ${canvasAbsPath}`);
  }
  const js = await out.text();
  const etag = Bun.hash(js).toString(16);
  return { js, locator: pass1.locator, etag };
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
