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

/**
 * Runtime-state DIRECTORIES with no `fs:any` subscriber — see the note at the
 * skip site for why this is deliberately NOT the sync taxonomy.
 *
 * `_comments/`, `_canvas-state/` and `_state/` are POINTEDLY absent: the first
 * drives comment collab, and the other two are small and per-user, so there is
 * no volume argument for suppressing them and a real risk in guessing. Add to
 * this list only after confirming no `bus.on('fs:any' | 'fs:json' | …)`
 * subscriber acts on the path.
 */
const RUNTIME_DIRS = ['_history', '_chat', '_trash', '_smoke'] as const;

/**
 * True when `rel` is one of `RUNTIME_DIRS` or a path inside one, on either
 * separator (`fs.watch` hands back platform-native separators on Windows).
 *
 * Matching the BARE directory name is load-bearing, not tidiness: macOS raises
 * an event for the containing directory as well as the file, so a write to
 * `_chat/c-1.jsonl` arrives as BOTH `_chat/c-1.jsonl` and a bare `_chat`.
 * Suppressing only the prefixed form would leave every streamed ACP update
 * still waking every `fs:any` subscriber — the wakeup this list exists to stop.
 */
function isUnderRuntimeDir(rel: string): boolean {
  return RUNTIME_DIRS.some(
    (d) => rel === d || rel.startsWith(`${d}/`) || rel.startsWith(`${d}${path.sep}`)
  );
}

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
        //
        // NOT `isRuntimeStateRel` (sync/file-membership.ts), even though this
        // list looks like a narrower copy of it. That classifier answers "may
        // this file travel to a peer", and it excludes `_comments/` — but
        // `_comments/` IS needed on this bus: collab/index.ts matches
        // `^_comments/(.+)\.json$` on `fs:any`, and git/watch.ts treats it as
        // versionable. Routing this list through the sync taxonomy would
        // silently kill comment collaboration. The two lists answer different
        // questions and are deliberately not the same list.
        //
        // What IS added here (#119) are the high-volume runtime directories
        // with no `fs:any` subscriber. `_chat/` matters most: the bridge
        // appends to it on every streamed update, so each chunk of an agent
        // turn was raising an `fs:any` that woke canvas-list-watch, the
        // activity tracker and gitWatch (the last running git status against
        // the project's whole repo) for a file none of them can act on.
        if (filename.startsWith('_server.json')) return;
        if (filename.startsWith('_active.json')) return;
        if (filename.startsWith('_sync.json')) return;
        if (isUnderRuntimeDir(filename)) return;
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
