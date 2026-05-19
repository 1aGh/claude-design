// Virtual-module resolver for `@mdcc/canvas-lib` (Phase 3.6.1).
//
// Canvases import the shared canvas library via the specifier `@mdcc/canvas-lib`.
// At build time we redirect that to `<designRoot>/_lib/canvas-lib.tsx` so:
//
//   - the lib lives under the design root (project-owned source, not an npm dep),
//   - Bun.build bundles the actually-used exports into the canvas module via
//     normal tree-shaking,
//   - `/design:handoff` can strip the import + inline the same exports for the
//     emitted registry-item (see canvas-lib-inline.ts).
//
// Two surfaces:
//
//   - `canvasLibResolver(designRoot)` — Bun.build plugin. Registered alongside
//     `exact-externals` in canvas-build.ts. Must run FIRST so the bare specifier
//     gets claimed before any other resolver.
//   - `readCanvasLibSource(designRoot)` — small async helper used by handoff.ts
//     to read the lib source once for inlining.
//
// Failure mode: if a canvas imports `@mdcc/canvas-lib` but no
// `_lib/canvas-lib.tsx` exists, Bun.build's error message will point at the
// resolver; `canvas-build.ts` wraps the error with a /design:setup-ds hint.

import { existsSync } from 'node:fs';
import path from 'node:path';

import type { BunPlugin } from 'bun';

export const CANVAS_LIB_SPECIFIER = '@mdcc/canvas-lib';

/**
 * Absolute on-disk path the specifier resolves to. Centralised so the plugin
 * + handoff + tests agree on the location.
 */
export function canvasLibPath(designRoot: string): string {
  return path.join(designRoot, '_lib', 'canvas-lib.tsx');
}

export interface CanvasLibResolverOptions {
  /** Throw at resolve-time when the lib file is missing. Defaults to true. */
  failLoud?: boolean;
}

/**
 * Bun.build plugin factory. Maps `@mdcc/canvas-lib` → `<designRoot>/_lib/
 * canvas-lib.tsx`. No-op for any other specifier.
 */
export function canvasLibResolver(
  designRoot: string,
  opts: CanvasLibResolverOptions = {}
): BunPlugin {
  const target = canvasLibPath(designRoot);
  const failLoud = opts.failLoud !== false;
  return {
    name: 'mdcc-canvas-lib',
    setup(builder) {
      builder.onResolve({ filter: /^@mdcc\/canvas-lib$/ }, () => {
        if (failLoud && !existsSync(target)) {
          throw new Error(
            `[@mdcc/canvas-lib] canvas library missing at ${target}. Run /design:setup-ds to scaffold it, or copy from plugins/design/templates/canvas-lib.tsx.template.`
          );
        }
        return { path: target };
      });
    },
  };
}

/**
 * Read the on-disk canvas-lib source. Returns the raw TSX. Throws if the file
 * is missing. Used by handoff.ts to build the export-name → source map for
 * inlining used helpers into the emitted registry-item.
 */
export async function readCanvasLibSource(designRoot: string): Promise<string> {
  const p = canvasLibPath(designRoot);
  const f = Bun.file(p);
  if (!(await f.exists())) {
    throw new Error(
      `[@mdcc/canvas-lib] canvas library missing at ${p}. Run /design:setup-ds to scaffold it.`
    );
  }
  return f.text();
}
