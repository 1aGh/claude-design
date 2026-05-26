/**
 * @file       use-undo-stack.tsx — React Context + Provider for the undo stack
 * @scope      plugins/design/dev-server/use-undo-stack.tsx
 * @purpose    Wraps the pure `undoReducer` (undo-stack.ts) in React state,
 *             owns the async runner that awaits `cmd.do()` / `cmd.undo()`
 *             before applying the next state transition, and exposes the
 *             `lastLabel` HUD signal.
 *
 * Scope per DDR-049 — provider is mounted per canvas iframe inside
 * `CanvasShell`. Switching canvases mounts a fresh provider with an empty
 * stack. External edits to the same canvas file clear the stack via
 * `onExternalEdit` (the canvas-shell wires that to the HMR signal).
 */

import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  type EditCommand,
  type UndoStackState,
  canRedo as canRedoOf,
  canUndo as canUndoOf,
  createUndoStackState,
  undoReducer,
} from './undo-stack.ts';

// ─────────────────────────────────────────────────────────────────────────────
// Context shape

export interface UndoStackValue {
  /**
   * Push a fresh command. The runner calls `cmd.do()` first — the new state
   * is committed only after the side-effect resolves. Awaiting the returned
   * promise is optional; the HUD reads `lastLabel` once the runner finishes.
   */
  push: (cmd: EditCommand) => Promise<void>;
  /** Undo the top of `past`. No-op when empty. */
  undo: () => Promise<void>;
  /** Redo the top of `future`. No-op when empty. */
  redo: () => Promise<void>;
  /** Drop both stacks (external edit, canvas switch). */
  clear: (reason?: string) => void;
  canUndo: boolean;
  canRedo: boolean;
  /**
   * One-line label of the most recent operation. HUD reads this. `null` when
   * nothing's happened since mount or `clear()` was called without a reason.
   */
  lastLabel: string | null;
  /**
   * Monotonic counter that increments on every push / undo / redo / clear.
   * HUD subscribes to bump its auto-dismiss timer even when the same label
   * appears twice in a row (e.g. Cmd+Z Cmd+Z on identical drags).
   */
  lastTick: number;
}

const UndoStackContext = createContext<UndoStackValue | null>(null);

// No-op default — when a consumer reads the hook outside a provider (DS
// specimens, legacy mounts) all methods become silent no-ops. This is the
// same defensive pattern as `useSelectionSetOptional` / `useToolModeOptional`.
const NOOP_VALUE: UndoStackValue = {
  push: () => Promise.resolve(),
  undo: () => Promise.resolve(),
  redo: () => Promise.resolve(),
  clear: () => {},
  canUndo: false,
  canRedo: false,
  lastLabel: null,
  lastTick: 0,
};

// ─────────────────────────────────────────────────────────────────────────────
// Provider

export interface UndoStackProviderProps {
  children: ReactNode;
  /**
   * Optional async-failure hook. Fires when `cmd.do()` / `.undo()` throws or
   * the returned promise rejects. The reducer never commits the transition
   * for a failed side-effect (push: cmd not appended; undo: stays in past;
   * redo: stays in future) — this hook is informational so the HUD can show
   * "Undo failed". Defaults to a console.warn.
   */
  onCommandError?: (err: unknown, op: 'do' | 'undo', cmd: EditCommand) => void;
}

export function UndoStackProvider({ children, onCommandError }: UndoStackProviderProps) {
  // Ref is the authoritative store — the async runner reads + writes it
  // synchronously between awaited side-effects, so a Cmd+Z keyrepeat at
  // 30 Hz sees its own predecessor's commit even when React hasn't yet
  // re-rendered. `useState` mirrors the ref purely to schedule a re-render
  // for context consumers (HUD canUndo/canRedo readouts).
  const stateRef = useRef<UndoStackState>(createUndoStackState());
  const [, setRenderToken] = useState(0);

  const writeState = useCallback((next: UndoStackState) => {
    stateRef.current = next;
    setRenderToken((t) => t + 1);
  }, []);

  const [lastLabel, setLastLabel] = useState<string | null>(null);
  const [lastTick, setLastTick] = useState(0);

  // Serialize concurrent ops. Cmd+Z held down can repeat at ~30 Hz; the runner
  // awaits each side-effect before applying state. A simple promise chain
  // queues subsequent calls without spawning parallel PATCH-es out of order.
  const inFlightRef = useRef<Promise<void>>(Promise.resolve());

  const reportError = useCallback(
    (err: unknown, op: 'do' | 'undo', cmd: EditCommand) => {
      if (onCommandError) {
        onCommandError(err, op, cmd);
        return;
      }
      console.warn(`[undo-stack] ${op} failed for "${cmd.label}":`, err);
    },
    [onCommandError]
  );

  const bumpLabel = useCallback((label: string | null) => {
    setLastLabel(label);
    setLastTick((t) => t + 1);
  }, []);

  const enqueue = useCallback((task: () => Promise<void>): Promise<void> => {
    const next = inFlightRef.current.then(task, task);
    inFlightRef.current = next.catch(() => {
      /* swallow — per-op error already reported */
    });
    return next;
  }, []);

  const push = useCallback(
    (cmd: EditCommand): Promise<void> =>
      enqueue(async () => {
        try {
          await cmd.do();
        } catch (err) {
          reportError(err, 'do', cmd);
          return;
        }
        writeState(undoReducer(stateRef.current, { type: 'push', cmd }));
        bumpLabel(cmd.label);
      }),
    [enqueue, reportError, bumpLabel, writeState]
  );

  const undo = useCallback(
    (): Promise<void> =>
      enqueue(async () => {
        const cur = stateRef.current;
        if (!canUndoOf(cur)) return;
        const top = cur.past[cur.past.length - 1];
        if (!top) return;
        try {
          await top.undo();
        } catch (err) {
          reportError(err, 'undo', top);
          return;
        }
        writeState(undoReducer(stateRef.current, { type: 'undo' }));
        bumpLabel(`Undo: ${top.label}`);
      }),
    [enqueue, reportError, bumpLabel, writeState]
  );

  const redo = useCallback(
    (): Promise<void> =>
      enqueue(async () => {
        const cur = stateRef.current;
        if (!canRedoOf(cur)) return;
        const top = cur.future[cur.future.length - 1];
        if (!top) return;
        try {
          await top.do();
        } catch (err) {
          reportError(err, 'do', top);
          return;
        }
        writeState(undoReducer(stateRef.current, { type: 'redo' }));
        bumpLabel(`Redo: ${top.label}`);
      }),
    [enqueue, reportError, bumpLabel, writeState]
  );

  const clear = useCallback(
    (reason?: string) => {
      writeState(createUndoStackState());
      bumpLabel(reason ?? null);
    },
    [bumpLabel, writeState]
  );

  /**
   * Phase 20 — external-edit invalidation. Listen for an explicit window
   * event broadcast by the dev-server shell when an `fs:json` event for
   * this canvas's `.meta.json` arrives from outside. Inside the iframe we
   * read `canvas-lib`'s self-echo timestamp (window.__maude_last_meta_self_write_at)
   * to skip events that are our own PATCH bouncing back through fs-watch.
   *
   * Iframe reload (the dominant external-edit case — .tsx file save) naturally
   * resets the stack by unmounting the provider, so we don't have to listen
   * for that.
   */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onInvalidate = (ev: Event) => {
      // Self-echo guard: PATCH writes stamp `__maude_last_meta_self_write_at`
      // before the fetch. If we're inside the echo window, this fs:json is
      // ours bouncing back — don't clear the user's history.
      const w = window as unknown as { __maude_last_meta_self_write_at?: number };
      const last = w.__maude_last_meta_self_write_at ?? 0;
      if (Date.now() - last < 500) return;
      const reason =
        (ev as CustomEvent<{ reason?: string }>).detail?.reason ?? 'External edit detected';
      writeState(createUndoStackState());
      bumpLabel(reason);
    };
    window.addEventListener('maude:invalidate-undo', onInvalidate);
    return () => window.removeEventListener('maude:invalidate-undo', onInvalidate);
  }, [writeState, bumpLabel]);

  const value = useMemo<UndoStackValue>(
    () => ({
      push,
      undo,
      redo,
      clear,
      canUndo: canUndoOf(stateRef.current),
      canRedo: canRedoOf(stateRef.current),
      lastLabel,
      lastTick,
    }),
    // `stateRef.current` doesn't trigger memo invalidation; we depend on
    // `lastTick` (bumped by every push/undo/redo/clear) as the proxy so the
    // memoized canUndo/canRedo readouts re-evaluate on each transition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [push, undo, redo, clear, lastLabel, lastTick]
  );

  return <UndoStackContext.Provider value={value}>{children}</UndoStackContext.Provider>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hooks

/**
 * Required hook — throws outside a provider. Internal canvas-shell wiring
 * should use this so a missing provider mount is loud.
 */
export function useUndoStack(): UndoStackValue {
  const ctx = useContext(UndoStackContext);
  if (!ctx) throw new Error('useUndoStack must be used inside <UndoStackProvider>');
  return ctx;
}

/**
 * Optional hook — silent no-op fallback. Use this in mutators (canvas-lib
 * `commitArtboardPositions`, annotations layer, equal-spacing handles) so
 * DS specimens / legacy mounts that don't carry the provider still work.
 */
export function useUndoStackOptional(): UndoStackValue {
  return useContext(UndoStackContext) ?? NOOP_VALUE;
}

/** For tests / external integrations. */
export { UndoStackContext };

// Re-export the EditCommand type for ergonomic single-import in consumers.
export type { EditCommand } from './undo-stack.ts';
