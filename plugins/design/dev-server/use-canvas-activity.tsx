/**
 * @file       use-canvas-activity.tsx — Phase 13 / DDR-029 activity context.
 * @scope      plugins/design/dev-server/use-canvas-activity.tsx
 * @purpose    Iframe-runtime React context fed by the server's `activity` WS
 *             messages. `DCArtboard` reads it to render the "agent works here"
 *             overlay on the artboards being edited right now.
 *
 * The bridge: the canvas-shell harness (`templates/_shell.html`) owns the WS
 * connection and re-dispatches every `{ type:'activity', … }` message as a
 * `maude:activity` CustomEvent on `document` (the same pattern used for
 * `maude:meta-refreshed`). This provider subscribes to that event — no second
 * socket, and trivially testable (dispatch the event in a test). In-memory only:
 * activity is ephemeral, never persisted.
 */

import {
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

/** Cross-fade window after a file flips `idle` before its overlay is removed. */
export const ACTIVITY_FADE_MS = 200;

/** Wire shape of a server `activity` message (snake_case, matches activity.ts). */
export interface ActivityMessage {
  type?: 'activity';
  file: string;
  status: 'active' | 'idle';
  artboard_ids?: string[] | null;
  ts: string;
}

interface ActivityEntry {
  status: 'active' | 'idle';
  artboardIds: string[] | null;
  ts: string;
}

type ActivityMap = Record<string, ActivityEntry>;

/** What `useCanvasActivity()` returns for a given canvas file. */
export interface CanvasActivity {
  /** An entry exists (file is active OR within the post-idle fade window). */
  present: boolean;
  /** The file is currently being edited (drives the pulse). */
  active: boolean;
  /** Scoped artboard ids, or null = file-level (every artboard lights up). */
  artboardIds: string[] | null;
  /** Basename of the canvas file, for the badge label. */
  fileLabel: string;
}

interface ActivityContextValue {
  map: ActivityMap;
  /** This canvas's design-root-relative key (server-message keyspace). */
  currentKey: string;
  normalizeKey: (file: string) => string;
}

const ActivityContext = createContext<ActivityContextValue | null>(null);

// ---------------------------------------------------------------------------
// Pure helpers — exported for unit tests.

/**
 * Normalize a canvas path to the server's activity keyspace: design-root-
 * relative, slash-normalized, no leading slash. Accepts the canonical form
 * (`ui/Foo.tsx`) or the designRel-prefixed form (`.design/ui/Foo.tsx`) that
 * `mountCanvas` passes — stripping `designRel` when known.
 */
export function activityKey(file: string, designRel?: string): string {
  let s = (file ?? '').replace(/\\/g, '/').replace(/^\/+/, '');
  const dr = (designRel ?? '').replace(/^\.\//, '').replace(/^\/+|\/+$/g, '');
  if (dr && s.startsWith(`${dr}/`)) s = s.slice(dr.length + 1);
  return s;
}

/** Pure reducer: fold one activity message into the map. */
export function applyActivityChange(prev: ActivityMap, change: ActivityMessage): ActivityMap {
  if (!change || typeof change.file !== 'string' || !change.file) return prev;
  return {
    ...prev,
    [change.file]: {
      status: change.status === 'active' ? 'active' : 'idle',
      artboardIds: Array.isArray(change.artboard_ids) ? change.artboard_ids : null,
      ts: typeof change.ts === 'string' ? change.ts : '',
    },
  };
}

/** True when an artboard id is in scope for a change (null scope = all). */
export function matchesArtboard(artboardIds: string[] | null, id: string): boolean {
  return artboardIds === null || artboardIds.includes(id);
}

function basename(key: string): string {
  const i = key.lastIndexOf('/');
  return i >= 0 ? key.slice(i + 1) : key;
}

function readDesignRel(explicit?: string): string | undefined {
  if (explicit) return explicit;
  if (typeof window !== 'undefined') {
    const w = window as unknown as { __canvas_design_rel__?: string };
    if (typeof w.__canvas_design_rel__ === 'string') return w.__canvas_design_rel__;
  }
  return undefined;
}

/**
 * Seed the map from `window.__maude_activity_seed__` — the WS-open snapshot the
 * shell stashes (raw server `activity.state`, keyed design-root-relative with a
 * camelCase `artboardIds`). Load-bearing after the HMR reload a canvas edit
 * triggers: the snapshot can land before React mounts, so the dispatched event
 * is missed and only this synchronous read recovers the in-flight overlay.
 */
function readActivitySeed(): ActivityMap {
  if (typeof window === 'undefined') return {};
  const w = window as unknown as {
    __maude_activity_seed__?: Record<
      string,
      { status?: 'active' | 'idle'; ts?: string; artboardIds?: string[] | null }
    >;
  };
  const seed = w.__maude_activity_seed__;
  if (!seed || typeof seed !== 'object') return {};
  const out: ActivityMap = {};
  for (const file of Object.keys(seed)) {
    const e = seed[file];
    if (!e || e.status !== 'active') continue; // only resurrect active overlays
    out[file] = {
      status: 'active',
      artboardIds: Array.isArray(e.artboardIds) ? e.artboardIds : null,
      ts: typeof e.ts === 'string' ? e.ts : '',
    };
  }
  return out;
}

// ---------------------------------------------------------------------------

export interface CanvasActivityProviderProps {
  /** This canvas's file (designRel-prefixed or design-root-relative). */
  file?: string;
  /** designRel for key normalization; defaults to `window.__canvas_design_rel__`. */
  designRel?: string;
  /** Seed (snapshot / tests). Keyed by design-root-relative path. */
  initialState?: ActivityMap;
  children: ReactNode;
}

export function CanvasActivityProvider({
  file,
  designRel,
  initialState,
  children,
}: CanvasActivityProviderProps) {
  const dr = readDesignRel(designRel);
  const currentKey = useMemo(() => {
    if (file) return activityKey(file, dr);
    // No explicit file (the canvas-lib mount path) → read the design-root-
    // relative canvas path the shell stamps on window. It already matches the
    // server's activity keyspace, so no normalization is needed.
    if (typeof window !== 'undefined') {
      const w = window as unknown as { __canvas_rel__?: string };
      if (typeof w.__canvas_rel__ === 'string' && w.__canvas_rel__) return w.__canvas_rel__;
    }
    return '';
  }, [file, dr]);
  const [map, setMap] = useState<ActivityMap>(() => initialState ?? readActivitySeed());
  // Per-file removal timers for the post-idle cross-fade.
  const fadeTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const timers = fadeTimers.current;

    function onActivity(ev: Event) {
      const detail = (ev as CustomEvent<ActivityMessage>).detail;
      if (!detail || typeof detail.file !== 'string') return;
      setMap((prev) => applyActivityChange(prev, detail));

      const pending = timers.get(detail.file);
      if (pending) {
        clearTimeout(pending);
        timers.delete(detail.file);
      }
      if (detail.status === 'idle') {
        // Keep the (now-idle) entry around briefly so the overlay cross-fades
        // out instead of snapping off, then drop it.
        const ts = detail.ts;
        const t = setTimeout(() => {
          timers.delete(detail.file);
          setMap((prev) => {
            const entry = prev[detail.file];
            // Only remove if it's still the same idle entry (not re-activated).
            if (!entry || entry.status !== 'idle' || entry.ts !== ts) return prev;
            const { [detail.file]: _drop, ...rest } = prev;
            return rest;
          });
        }, ACTIVITY_FADE_MS);
        timers.set(detail.file, t);
      }
    }

    document.addEventListener('maude:activity', onActivity as EventListener);
    return () => {
      document.removeEventListener('maude:activity', onActivity as EventListener);
      for (const t of timers.values()) clearTimeout(t);
      timers.clear();
    };
  }, []);

  const value = useMemo<ActivityContextValue>(
    () => ({ map, currentKey, normalizeKey: (f: string) => activityKey(f, dr) }),
    [map, currentKey, dr]
  );

  return <ActivityContext.Provider value={value}>{children}</ActivityContext.Provider>;
}

const EMPTY: CanvasActivity = {
  present: false,
  active: false,
  artboardIds: null,
  fileLabel: '',
};

/**
 * Activity state for a canvas. With no argument, returns the current canvas's
 * activity (the provider knows its own file); pass a `file` to query another.
 * Returns an inert value outside the provider (legacy / specimen mounts), so the
 * overlay simply never renders there.
 */
export function useCanvasActivity(file?: string): CanvasActivity {
  const ctx = useContext(ActivityContext);
  if (!ctx) return EMPTY;
  const key = file != null ? ctx.normalizeKey(file) : ctx.currentKey;
  if (!key) return EMPTY;
  const entry = ctx.map[key];
  return {
    present: !!entry,
    active: entry?.status === 'active',
    artboardIds: entry?.artboardIds ?? null,
    fileLabel: basename(key),
  };
}
