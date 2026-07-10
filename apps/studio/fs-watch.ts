// Recursive filesystem watcher.
// Bun ships a working recursive fs.watch on macOS/Linux/Windows out of the box;
// no @parcel/watcher needed. We debounce per-path so a single editor save (which
// often emits ~3 events on macOS) collapses to one bus notification.

import { watch } from 'node:fs';
import path from 'node:path';

import type { Context } from './context.ts';

export interface FsWatch {
  start(): void;
  stop(): void;
}

const DEBOUNCE_MS = 50;

export function createFsWatch(ctx: Context): FsWatch {
  let watcher: ReturnType<typeof watch> | null = null;
  const seen = new Map<string, number>();

  function emit(filename: string) {
    const now = Date.now();
    const prev = seen.get(filename) ?? 0;
    if (now - prev < DEBOUNCE_MS) return;
    seen.set(filename, now);
    const ext = path.extname(filename).toLowerCase();
    const rel = filename.replace(/\\/g, '/');
    if (ext === '.html') ctx.bus.emit('fs:html', rel);
    else if (ext === '.css') ctx.bus.emit('fs:css', rel);
    else if (ext === '.json') ctx.bus.emit('fs:json', rel);
    ctx.bus.emit('fs:any', rel);
  }

  function start() {
    if (watcher) return;
    // Capture/CI opt-out (MAUDE_NO_WATCH=1): a headless render server has no
    // interactive editor to hot-reload, so it never needs the watcher. It's a
    // DEFENSIVE measure for long video exports — an HMR hard-reload broadcast
    // fired mid-capture (from a concurrent write to designRoot, e.g. a peer edit
    // or a runtime-state save NOT in the skip-list below) destroys the Playwright
    // page's execution context. (NB: in the 2026-07-10 cinematic-cut dogfood the
    // ACTUAL cause of the "Execution context was destroyed" crashes turned out to
    // be renderer compositing pressure — too many full-frame mix-blend-mode /
    // filter layers per frame — not the watcher; this guard is belt-and-braces.)
    if (process.env.MAUDE_NO_WATCH === '1') return;
    try {
      watcher = watch(ctx.paths.designRoot, { recursive: true }, (_event, filename) => {
        if (!filename) return;
        // Skip our own runtime artifacts.
        if (filename.startsWith('_server.json')) return;
        if (filename.startsWith('_active.json')) return;
        if (filename.startsWith('_sync.json')) return;
        if (filename.startsWith(`_history${path.sep}`) || filename.startsWith('_history/')) return;
        emit(filename);
      });
    } catch (err) {
      console.warn('[fs-watch] failed to start:', err instanceof Error ? err.message : err);
    }
  }

  function stop() {
    if (!watcher) return;
    try {
      watcher.close();
    } catch {
      /* ignore */
    }
    watcher = null;
    seen.clear();
  }

  return { start, stop };
}
