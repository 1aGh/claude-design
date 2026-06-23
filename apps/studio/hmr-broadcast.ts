// HMR broadcaster (Phase 3.6.1 Task 8).
//
// Bridges fs-watch.ts → ws.ts: classifies each change event under the design
// root and emits a `canvas-hmr` WS message. The iframe-side client (inlined in
// _shell.html) reacts to the message:
//
//   - `mode: "css"`    → swap <link> href with a cache-bust query (no module
//                        reload, no React state loss). Sub-150ms latency.
//   - `mode: "module"` → in-place hot-swap of the canvas module when the canvas
//                        runtime is mounted (re-import + remount only the canvas
//                        content; the iframe — and the live CollabProvider +
//                        presence — stay mounted, so a cross-peer synced edit
//                        updates seamlessly without a presence blink — Phase 30
//                        / F4). Falls back to location.reload() with no runtime
//                        (gallery thumbnails) or on a re-import with no usable
//                        default export. State (scroll / tool / undo) survives
//                        the hot-swap path.
//   - `mode: "hard"`   → location.reload() (used when canvas-lib.tsx or any
//                        `_lib/**` file changes — every open canvas needs to
//                        re-bundle).
//
// We deliberately do NOT try to wire Bun's `import.meta.hot.accept(...)`. Bun
// supports HMR in `bun dev` mode (HTML import roots), but canvases here are
// loaded via the importmap + Bun.build-produced ESM — there's no React Fast
// Refresh runtime to register with. Full-reload is the reliable path.

import { existsSync } from 'node:fs';
import path from 'node:path';

import type { Context } from './context.ts';

const DEBOUNCE_MS = 50;

export interface HmrMessage {
  type: 'canvas-hmr';
  mode: 'css' | 'module' | 'hard' | 'meta';
  /**
   * Canvas-relative path of the file that changed, slash-normalised. Absent
   * when mode === 'hard' (the change is global — every canvas reloads).
   *
   * For mode === 'meta' this is the `<base>.meta.json` path; iframe peels off
   * the `.meta.json` suffix to compare against its own `canvasRel`.
   */
  file?: string;
  /** Cache-bust token — etag-like. Caller appends to <link> href. */
  version: number;
  /** Echo of `_lib`-scoped changes for debug + scope reasoning. */
  scope?: 'lib' | 'canvas';
}

export interface HmrBroadcaster {
  /** Stop subscribing to fs-watch events. */
  stop(): void;
}

/**
 * Subscribe to fs:any / fs:css events. Debounces same-path changes, classifies
 * the change, and forwards via `broadcast`. `broadcast` is wired to the
 * existing ws.ts fanout; tests inject a stub.
 */
export function createHmrBroadcaster(
  ctx: Context,
  broadcast: (msg: HmrMessage) => void
): HmrBroadcaster {
  let pending: ReturnType<typeof setTimeout> | null = null;
  let pendingMsg: HmrMessage | null = null;

  function flush() {
    if (pendingMsg) broadcast(pendingMsg);
    pendingMsg = null;
    pending = null;
  }

  function classify(filename: string): HmrMessage | null {
    return classifyChange(filename, (cssRel) => {
      const root = ctx.paths?.designRoot;
      if (!root) return false; // no root resolved → can't probe; keep css swap
      return existsSync(path.join(root, cssRel.replace(/\.css$/i, '.tsx')));
    });
  }

  function enqueue(msg: HmrMessage) {
    // Coalesce: hard > module > css. If a hard reload is queued, ignore any
    // softer follow-up within the debounce window.
    if (pendingMsg) {
      // meta is the lightest signal — it doesn't trigger a reload, just
      // re-fetches the sidecar. CSS still ranks above it so a same-window
      // CSS write wins over a meta echo.
      const rank: Record<HmrMessage['mode'], number> = { meta: 0, css: 1, module: 2, hard: 3 };
      if (rank[msg.mode] < rank[pendingMsg.mode]) {
        // Keep the existing (harder) message; just refresh the timer.
      } else {
        pendingMsg = msg;
      }
    } else {
      pendingMsg = msg;
    }
    if (pending) clearTimeout(pending);
    pending = setTimeout(flush, DEBOUNCE_MS);
  }

  const offAny = ctx.bus.on('fs:any', (rel: string) => {
    const msg = classify(rel);
    if (msg) enqueue(msg);
  });

  return {
    stop() {
      offAny();
      if (pending) clearTimeout(pending);
      pending = null;
      pendingMsg = null;
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers — exported for tests.

export const HMR_DEBOUNCE_MS = DEBOUNCE_MS;

/**
 * Classify a changed design-root-relative path into an HMR message. Pure +
 * fs-injected (`hasSiblingTsx`) so it unit-tests without touching disk.
 *
 * CSS routing is the load-bearing part. A canvas/specimen sibling stylesheet
 * (e.g. `system/x/preview/motion.css` next to `motion.tsx`, pulled in via
 * `import './motion.css'`) is INLINED into the built module as a `<style>` tag
 * by canvas-build.ts — there is NO `<link>` for it. The iframe's `mode:'css'`
 * handler swaps `<link href>` only, so a link swap for inlined CSS is a silent
 * no-op and the edit never reaches the browser (the bug this fixes). For those
 * we emit `mode:'module'` keyed on the sibling `.tsx`, so the open canvas
 * reloads and re-inlines the fresh CSS via the existing module-reload path.
 * Link-mounted CSS (DS tokens, `_components.css`, `_layout.css` — no sibling
 * `.tsx`) keeps the fast, state-preserving css swap.
 */
export function classifyChange(
  filename: string,
  hasSiblingTsx: (cssRel: string) => boolean
): HmrMessage | null {
  const rel = filename.replace(/\\/g, '/');
  const ext = path.extname(rel).toLowerCase();
  const version = Date.now();
  if (rel.startsWith('_lib/')) {
    return { type: 'canvas-hmr', mode: 'hard', scope: 'lib', version };
  }
  if (ext === '.css') {
    if (hasSiblingTsx(rel)) {
      const siblingTsx = rel.replace(/\.css$/i, '.tsx');
      return { type: 'canvas-hmr', mode: 'module', file: siblingTsx, version, scope: 'canvas' };
    }
    return { type: 'canvas-hmr', mode: 'css', file: rel, version, scope: 'canvas' };
  }
  // Phase 8 — canvas-meta sidecar (`<base>.meta.json`) carries the
  // artboard layout / viewport. Emit a `meta` mode so foreign tabs can
  // re-fetch + re-apply the layout WITHOUT a full reload (which would
  // lose React state like tool mode, undo stack, scroll position).
  if (rel.endsWith('.meta.json')) {
    return { type: 'canvas-hmr', mode: 'meta', file: rel, version, scope: 'canvas' };
  }
  if (ext === '.tsx' || ext === '.jsx' || ext === '.ts' || ext === '.js') {
    return { type: 'canvas-hmr', mode: 'module', file: rel, version, scope: 'canvas' };
  }
  return null;
}
