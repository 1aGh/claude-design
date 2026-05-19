// HMR broadcaster (Phase 3.6.1 Task 8).
//
// Bridges fs-watch.ts → ws.ts: classifies each change event under the design
// root and emits a `canvas-hmr` WS message. The iframe-side client (inlined in
// _shell.html) reacts to the message:
//
//   - `mode: "css"`    → swap <link> href with a cache-bust query (no module
//                        reload, no React state loss). Sub-150ms latency.
//   - `mode: "module"` → location.reload() of the canvas iframe. State is lost
//                        but the change always picks up. <250ms latency.
//   - `mode: "hard"`   → location.reload() (used when canvas-lib.tsx or any
//                        `_lib/**` file changes — every open canvas needs to
//                        re-bundle).
//
// We deliberately do NOT try to wire Bun's `import.meta.hot.accept(...)`. Bun
// supports HMR in `bun dev` mode (HTML import roots), but canvases here are
// loaded via the importmap + Bun.build-produced ESM — there's no React Fast
// Refresh runtime to register with. Full-reload is the reliable path.

import path from 'node:path';

import type { Context } from './context.ts';

const DEBOUNCE_MS = 50;

export interface HmrMessage {
  type: 'canvas-hmr';
  mode: 'css' | 'module' | 'hard';
  /**
   * Canvas-relative path of the file that changed, slash-normalised. Absent
   * when mode === 'hard' (the change is global — every canvas reloads).
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
    const rel = filename.replace(/\\/g, '/');
    const ext = path.extname(rel).toLowerCase();
    const version = Date.now();
    if (rel.startsWith('_lib/')) {
      return { type: 'canvas-hmr', mode: 'hard', scope: 'lib', version };
    }
    if (ext === '.css') {
      return { type: 'canvas-hmr', mode: 'css', file: rel, version, scope: 'canvas' };
    }
    if (ext === '.tsx' || ext === '.jsx' || ext === '.ts' || ext === '.js') {
      return { type: 'canvas-hmr', mode: 'module', file: rel, version, scope: 'canvas' };
    }
    return null;
  }

  function enqueue(msg: HmrMessage) {
    // Coalesce: hard > module > css. If a hard reload is queued, ignore any
    // softer follow-up within the debounce window.
    if (pendingMsg) {
      const rank: Record<HmrMessage['mode'], number> = { css: 0, module: 1, hard: 2 };
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
