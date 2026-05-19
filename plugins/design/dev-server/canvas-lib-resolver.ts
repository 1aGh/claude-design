// Virtual-module resolver for `@mdcc/canvas-lib` (Phase 3.6.1; relocated 4.0.5).
//
// Canvases import the shared canvas library via the specifier `@mdcc/canvas-lib`.
// At build time we redirect that to the dev-server-bundled source at
// `plugins/design/dev-server/canvas-lib.tsx` so:
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

export const CANVAS_LIB_SPECIFIER = '@mdcc/canvas-lib';

/**
 * Returns the dev-server-internal canvas-lib path. The `_designRoot` parameter
 * is retained for one minor (back-compat with callers we don't control) but
 * ignored — canvas-lib now ships with the dev-server install (DDR-025).
 */
export function canvasLibPath(_designRoot?: string): string {
  return path.join(import.meta.dir, 'canvas-lib.tsx');
}

export interface CanvasLibResolverOptions {
  /** Throw at resolve-time when the lib file is missing. Defaults to true. */
  failLoud?: boolean;
}

/**
 * Bun.build plugin factory. Maps `@mdcc/canvas-lib` → the dev-server-bundled
 * `canvas-lib.tsx`. No-op for any other specifier.
 */
export function canvasLibResolver(
  _designRoot?: string,
  opts: CanvasLibResolverOptions = {}
): BunPlugin {
  const target = canvasLibPath();
  const failLoud = opts.failLoud !== false;
  return {
    name: 'mdcc-canvas-lib',
    setup(builder) {
      builder.onResolve({ filter: /^@mdcc\/canvas-lib$/ }, () => {
        if (failLoud && !existsSync(target)) {
          throw new Error(
            `[@mdcc/canvas-lib] canvas library missing at ${target} — dev-server install is corrupt; re-install @1agh/md-claude.`
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
      `[@mdcc/canvas-lib] canvas library missing at ${p} — dev-server install is corrupt; re-install @1agh/md-claude.`
    );
  }
  return f.text();
}
