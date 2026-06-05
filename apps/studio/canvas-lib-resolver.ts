// Virtual-module resolver for `@maude/canvas-lib` (Phase 3.6.1; relocated 4.0.5).
//
// Canvases import the shared canvas library via the specifier `@maude/canvas-lib`.
// At build time we redirect that to the dev-server-bundled source at
// `apps/studio/canvas-lib.tsx` so:
//
//   - the lib ships with the dev-server install (single source of truth — see
//     DDR-025; reverses DDR-022's "project-owned source under <designRoot>/_lib/"),
//   - Bun.build bundles the actually-used exports into the canvas module via
//     normal tree-shaking,
//   - `/design:handoff` can strip the import + inline the same exports for the
//     emitted registry-item (see canvas-lib-inline.ts).
//
// Two surfaces:
//
//   - `canvasLibResolver()` — Bun.build plugin. Registered alongside
//     `exact-externals` in canvas-build.ts. Must run FIRST so the bare specifier
//     gets claimed before any other resolver.
//   - `readCanvasLibSource()` — small async helper used by handoff.ts
//     to read the lib source once for inlining.
//
// Failure mode: if the dev-server's bundled canvas-lib is missing, the install
// is corrupt; canvas-build.ts surfaces a re-install hint.

import { existsSync } from 'node:fs';
import path from 'node:path';

import type { BunPlugin } from 'bun';

import { DEV_SERVER_ROOT } from './paths.ts';

export const CANVAS_LIB_SPECIFIER = '@maude/canvas-lib';

/**
 * Returns the dev-server-internal canvas-lib path. The `_designRoot` parameter
 * is retained for one minor (back-compat with callers we don't control) but
 * ignored — canvas-lib now ships with the dev-server install (DDR-025).
 *
 * Uses DEV_SERVER_ROOT (paths.ts) instead of `import.meta.dir` per DDR-045 —
 * inside `bun --compile` standalone binaries `import.meta.dir` resolves to the
 * virtual `/$bunfs/root` and any subsequent `existsSync` / `fs.watch` against
 * that path silently fails. Same bug class as v0.18.0/0.18.1; this one surfaces
 * as `[canvas-lib] failed to watch ... '/$bunfs/root/canvas-lib.tsx'` at boot
 * and disables canvas-lib HMR.
 */
export function canvasLibPath(_designRoot?: string): string {
  return path.join(DEV_SERVER_ROOT, 'canvas-lib.tsx');
}

export interface CanvasLibResolverOptions {
  /** Throw at resolve-time when the lib file is missing. Defaults to true. */
  failLoud?: boolean;
}

/**
 * Bun.build plugin factory. Maps `@maude/canvas-lib` → the dev-server-bundled
 * `canvas-lib.tsx`. No-op for any other specifier.
 */
export function canvasLibResolver(
  _designRoot?: string,
  opts: CanvasLibResolverOptions = {}
): BunPlugin {
  const target = canvasLibPath();
  const failLoud = opts.failLoud !== false;
  return {
    name: 'maude-canvas-lib',
    setup(builder) {
      builder.onResolve({ filter: /^@maude\/canvas-lib$/ }, () => {
        if (failLoud && !existsSync(target)) {
          throw new Error(
            `[@maude/canvas-lib] canvas library missing at ${target} — dev-server install is corrupt; re-install @1agh/maude.`
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
export async function readCanvasLibSource(_designRoot?: string): Promise<string> {
  const p = canvasLibPath();
  const f = Bun.file(p);
  if (!(await f.exists())) {
    throw new Error(
      `[@maude/canvas-lib] canvas library missing at ${p} — dev-server install is corrupt; re-install @1agh/maude.`
    );
  }
  return f.text();
}
