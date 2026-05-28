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
