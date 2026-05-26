/**
 * @file       undo-stack.ts — per-canvas in-memory command stack
 * @scope      plugins/design/dev-server/undo-stack.ts
 * @purpose    Pure state + reducer for canvas Cmd+Z / Cmd+Shift+Z. No React,
 *             no DOM, no fetch — `EditCommand.do()` / `.undo()` are caller-
 *             supplied side-effects so this file stays trivially testable
 *             under `bun:test`.
 *
 * Scope (DDR-049):
 *   - Per-canvas-iframe, in-memory, ephemerality is a feature: switching
 *     canvases or receiving an external file edit clears the stack.
 *   - Command-pattern (inverse payload), NOT snapshot. Each mutator emits a
 *     command holding the minimum diff needed to invert itself.
 *   - Depth-capped at 50 — typical session has 10–30 edits before save.
 *     The cap is a ring (shift oldest from `past` when full).
 *   - Future-discarded on push (canonical undo-stack behavior).
 *   - Viewport + selection are intentionally NOT pushed (Figma/Sketch
 *     convention — viewport is ephemeral navigation, selection is not an
 *     edit).
 *
 * Async note. `cmd.do()` and `cmd.undo()` may return a Promise (server
 * PATCH/PUT). The reducer itself is synchronous and never awaits — the
 * runner inside `use-undo-stack.tsx` is responsible for awaiting the
 * side-effect BEFORE dispatching the state transition. Reducer-pure
 * keeps reasoning + tests trivial.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types

/**
 * A single reversible edit. `kind` is freeform — used for telemetry + the
 * HUD's debug branch only; orchestration looks at `label`. Implementations
 * live under `./commands/*.ts` and each owns its own inverse payload shape.
 */
export interface EditCommand {
  readonly kind: string;
  readonly label: string;
  do(): Promise<void> | void;
  undo(): Promise<void> | void;
}

export interface UndoStackState {
  past: readonly EditCommand[];
  future: readonly EditCommand[];
}

export type UndoAction =
  | { type: 'push'; cmd: EditCommand }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'clear' };

// ─────────────────────────────────────────────────────────────────────────────
// Constants

/**
 * Ring cap. When `past.length === MAX_DEPTH` and a new command is pushed,
 * the oldest entry is dropped. 50 ≈ 3–5 minutes of intense iteration
 * before the user can no longer undo to the start.
 */
export const MAX_DEPTH = 50;

// ─────────────────────────────────────────────────────────────────────────────
// Factory + reducer

export function createUndoStackState(): UndoStackState {
  return { past: [], future: [] };
}

export function undoReducer(state: UndoStackState, action: UndoAction): UndoStackState {
  switch (action.type) {
    case 'push': {
      const next = state.past.length >= MAX_DEPTH ? state.past.slice(1) : state.past;
      return { past: [...next, action.cmd], future: [] };
    }
    case 'undo': {
      if (state.past.length === 0) return state;
      const top = state.past[state.past.length - 1];
      if (!top) return state;
      return {
        past: state.past.slice(0, -1),
        future: [...state.future, top],
      };
    }
    case 'redo': {
      if (state.future.length === 0) return state;
      const top = state.future[state.future.length - 1];
      if (!top) return state;
      return {
        past: [...state.past, top],
        future: state.future.slice(0, -1),
      };
    }
    case 'clear':
      return createUndoStackState();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Selectors — keep state-shape inspection out of consumers.

export function canUndo(state: UndoStackState): boolean {
  return state.past.length > 0;
}

export function canRedo(state: UndoStackState): boolean {
  return state.future.length > 0;
}

/** Top of `past` — the command an `undo` will invert. */
export function peekUndo(state: UndoStackState): EditCommand | null {
  return state.past[state.past.length - 1] ?? null;
}

/** Top of `future` — the command a `redo` will re-apply. */
export function peekRedo(state: UndoStackState): EditCommand | null {
  return state.future[state.future.length - 1] ?? null;
}
