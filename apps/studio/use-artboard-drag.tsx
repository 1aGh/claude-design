/**
 * @file       use-artboard-drag.tsx — Phase 4.2 artboard drag controller
 * @scope      apps/studio/use-artboard-drag.tsx
 * @purpose    Owns the pointerdown → pointermove → pointerup state machine
 *             for dragging artboards on the infinite canvas. The pure
 *             `dragReducer` + `commitFromState` are unit-testable without a
 *             DOM. The `useArtboardDrag` hook attaches the listeners + wires
 *             commit on settle.
 *
 * Why a separate listener stack (not the input-router)?
 *   `input-router.classify()` is per-event-stateless — drag is a multi-event
 *   state machine (down → move ×N → up). Owning its own listeners mirrors
 *   `useViewportController`. The two stacks coexist:
 *
 *     - router owns: hover, Cmd-select, right-click, V/H/C/Esc.
 *     - viewport-controller owns: wheel, middle-mouse pan, Space pan, Cmd+0/1.
 *     - this hook owns: pointerdown over artboard chrome (label + border) +
 *       its own pointermove/up while a drag is in flight.
 *
 * Click-vs-drag classifier: a 4 px screen-pixel threshold separates a click
 * (delta < 4 px → label `onClick` fires, pan-to-focus) from a drag (delta
 * ≥ 4 px → preventDefault on the synthetic click, commit positions on up).
 *
 * Multi-select: when `artboardId` (the drag leader) is in `selected`, every
 * other artboard whose id matches a selection moves rigidly with the leader
 * (relative offsets captured at drag-start).
 */

import {
  type HTMLAttributes,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { DRAG_THRESHOLD_PX as INPUT_DRAG_THRESHOLD_PX } from './input-router.tsx';
import type { Selection } from './use-selection-set.tsx';
import { computeSnap, type Rect, type SnapResult } from './use-snap-guides.tsx';

// ─────────────────────────────────────────────────────────────────────────────
// Constants

/** Screen-pixel distance the cursor must travel before pending → dragging.
 *  Re-export from `input-router` so artboard-drag, marquees, and annotation
 *  drag-vs-tap share the same canonical value (T25). */
export const DRAG_THRESHOLD_PX = INPUT_DRAG_THRESHOLD_PX;

/** Default grid + tolerance (world units). Documented in DDR-028. */
export const DEFAULT_GRID_SIZE = 40;
export const DEFAULT_SNAP_TOLERANCE = 8;

/** How long the one-shot click suppressor stays armed after a drag's pointerup.
 *  Long enough to catch the synthetic `click` that follows pointerup; short
 *  enough that a legitimate later click on the same element still fires. */
export const CLICK_SUPPRESS_TIMEOUT_MS = 300;

// ─────────────────────────────────────────────────────────────────────────────
// Types

export interface DragTargetSnapshot {
  id: string;
  /** Offset from the leader's starting top-left, in world units. */
  offsetX: number;
  offsetY: number;
  /** Captured starting rect — used for ghost rendering. */
  startRect: Rect;
}

export type DragState =
  | { kind: 'idle' }
  | {
      kind: 'pending';
      startClientX: number;
      startClientY: number;
      leaderId: string;
      leaderStart: Rect;
      followers: DragTargetSnapshot[];
      others: Rect[];
    }
  | {
      kind: 'dragging';
      startClientX: number;
      startClientY: number;
      leaderId: string;
      leaderStart: Rect;
      followers: DragTargetSnapshot[];
      others: Rect[];
      cursorClientX: number;
      cursorClientY: number;
      /** Snapped leader rect — what the ghost renders at. */
      leaderRect: Rect;
      snap: SnapResult;
      alt: boolean;
    };

export type DragEvent =
  | {
      type: 'down';
      clientX: number;
      clientY: number;
      leaderId: string;
      leaderStart: Rect;
      followers: DragTargetSnapshot[];
      others: Rect[];
    }
  | {
      type: 'move';
      clientX: number;
      clientY: number;
      alt: boolean;
      zoom: number;
      gridSize: number;
      tolerance: number;
    }
  | { type: 'up' }
  | { type: 'cancel' };

// ─────────────────────────────────────────────────────────────────────────────
// Pure reducer — unit-tested without a DOM. The hook below is a thin shell
// that wires DOM events into this function.

export function dragReducer(state: DragState, ev: DragEvent): DragState {
  switch (ev.type) {
    case 'down':
      return {
        kind: 'pending',
        startClientX: ev.clientX,
        startClientY: ev.clientY,
        leaderId: ev.leaderId,
        leaderStart: ev.leaderStart,
        followers: ev.followers,
        others: ev.others,
      };
    case 'move': {
      if (state.kind === 'idle') return state;
      const dxClient = ev.clientX - state.startClientX;
      const dyClient = ev.clientY - state.startClientY;
      if (state.kind === 'pending') {
        if (Math.hypot(dxClient, dyClient) < DRAG_THRESHOLD_PX) {
          return state;
        }
      }
      const z = ev.zoom > 0 ? ev.zoom : 1;
      const proposed: Rect = {
        x: state.leaderStart.x + dxClient / z,
        y: state.leaderStart.y + dyClient / z,
        w: state.leaderStart.w,
        h: state.leaderStart.h,
      };
      const snap = computeSnap(proposed, state.others, {
        gridSize: ev.gridSize,
        tolerance: ev.tolerance,
        disabled: ev.alt,
      });
      return {
        kind: 'dragging',
        startClientX: state.startClientX,
        startClientY: state.startClientY,
        leaderId: state.leaderId,
        leaderStart: state.leaderStart,
        followers: state.followers,
        others: state.others,
        cursorClientX: ev.clientX,
        cursorClientY: ev.clientY,
        leaderRect: { x: snap.x, y: snap.y, w: proposed.w, h: proposed.h },
        snap,
        alt: ev.alt,
      };
    }
    case 'up':
    case 'cancel':
      return { kind: 'idle' };
  }
}

/**
 * Translate a dragging state into the commit payload (leader + every follower
 * at their final snapped positions). Returns null when no drag is in flight.
 */
export function commitFromState(state: DragState): { id: string; x: number; y: number }[] | null {
  if (state.kind !== 'dragging') return null;
  const out: { id: string; x: number; y: number }[] = [
    { id: state.leaderId, x: state.leaderRect.x, y: state.leaderRect.y },
  ];
  for (const f of state.followers) {
    out.push({
      id: f.id,
      x: state.leaderRect.x + f.offsetX,
      y: state.leaderRect.y + f.offsetY,
    });
  }
  return out;
}

/**
 * Compute follower snapshots given the leader's starting rect and the live
 * selection set. A follower is any selected artboard whose id appears in
 * `allRects` and isn't the leader itself. If the leader is not in
 * `selectedIds`, followers = [] (the leader drags alone).
 */
export function computeFollowers(
  leaderId: string,
  leaderStart: Rect,
  selectedIds: Set<string>,
  allRects: Rect[]
): DragTargetSnapshot[] {
  if (!selectedIds.has(leaderId)) return [];
  const out: DragTargetSnapshot[] = [];
  for (const r of allRects) {
    if (!r.id || r.id === leaderId) continue;
    if (!selectedIds.has(r.id)) continue;
    out.push({
      id: r.id,
      offsetX: r.x - leaderStart.x,
      offsetY: r.y - leaderStart.y,
      startRect: r,
    });
  }
  return out;
}

/**
 * Project a `Selection[]` into the set of artboard ids it implies for
 * multi-drag. Only `Selection.artboardId` is used — `Selection.id` is the
 * `data-cd-id` of an arbitrary inner element and would pollute the set
 * with child cd-ids that never match an artboard's `data-dc-screen`.
 */
export function selectionsToArtboardIds(selected: Selection[]): Set<string> {
  const out = new Set<string>();
  for (const s of selected) {
    if (s.artboardId) out.add(s.artboardId);
  }
  return out;
}

/**
 * Build the `others` rect array — every rect that isn't the leader or a
 * follower (those are moving rigidly with the leader and shouldn't snap to
 * themselves).
 */
export function computeOthers(
  leaderId: string,
  followerIds: Set<string>,
  allRects: Rect[]
): Rect[] {
  const out: Rect[] = [];
  for (const r of allRects) {
    if (!r.id) continue;
    if (r.id === leaderId) continue;
    if (followerIds.has(r.id)) continue;
    out.push(r);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook

export interface UseArtboardDragOptions {
  /** This DCArtboard's id. */
  artboardId: string;
  /** Live multi-selection (from useSelectionSet). */
  selected: Selection[];
  /** Look up an artboard's current rect. */
  rectFor: (id: string) => Rect | null;
  /** Every artboard's rect in render order. */
  allRects: Rect[];
  /** Live viewport — `null` before first layout. */
  viewport: { zoom: number } | null;
  /** False short-circuits all event handling (e.g. activeTool !== "move"). */
  enabled: boolean;
  /** Called on drop with final positions for leader + followers. */
  onCommit: (next: { id: string; x: number; y: number }[]) => void;
  /** Snap config — defaults via DDR-028. */
  gridSize?: number;
  tolerance?: number;
}

export interface UseArtboardDragHandle {
  /** Spread onto the artboard chrome (label + outer border). */
  bindHandle: () => HTMLAttributes<HTMLElement>;
  /** Current state — consumers read this to render ghosts + the cursor swap. */
  dragState: DragState;
}

export function useArtboardDrag(opts: UseArtboardDragOptions): UseArtboardDragHandle {
  const {
    artboardId,
    selected,
    rectFor,
    allRects,
    viewport,
    enabled,
    onCommit,
    gridSize = DEFAULT_GRID_SIZE,
    tolerance = DEFAULT_SNAP_TOLERANCE,
  } = opts;

  const [dragState, setDragState] = useState<DragState>({ kind: 'idle' });

  // Keep stable refs for callbacks that close over fast-changing inputs.
  const stateRef = useRef<DragState>(dragState);
  stateRef.current = dragState;
  const zoomRef = useRef<number>(viewport?.zoom ?? 1);
  zoomRef.current = viewport?.zoom ?? 1;
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const gridSizeRef = useRef(gridSize);
  gridSizeRef.current = gridSize;
  const toleranceRef = useRef(tolerance);
  toleranceRef.current = tolerance;
  const allRectsRef = useRef(allRects);
  allRectsRef.current = allRects;
  const rectForRef = useRef(rectFor);
  rectForRef.current = rectFor;

  const selectedIdsRef = useRef<Set<string>>(new Set());
  selectedIdsRef.current = useMemo(() => selectionsToArtboardIds(selected), [selected]);

  // When `enabled` flips to false mid-drag, cancel (no commit). Mirrors the
  // tool-mode flip scenario in the plan.
  useEffect(() => {
    if (!enabled && stateRef.current.kind !== 'idle') {
      setDragState({ kind: 'idle' });
    }
  }, [enabled]);

  // Suppress the synthetic click that fires after a drag's pointerup so the
  // label's `onClick` (pan-to-focus) doesn't run. Bind one-shot at the
  // pending→dragging transition; unbinds itself on the next click event.
  const armClickSuppressor = useCallback(() => {
    if (typeof document === 'undefined') return;
    const handler = (e: MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      document.removeEventListener('click', handler, true);
    };
    document.addEventListener('click', handler, true);
    // Auto-disarm after a tick if no click fires (defensive).
    setTimeout(() => {
      document.removeEventListener('click', handler, true);
    }, CLICK_SUPPRESS_TIMEOUT_MS);
  }, []);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (!enabledRef.current) return;
      if (e.button !== 0) return; // only left-button
      // Don't claim modifier-held clicks — Cmd / Ctrl belongs to selection.
      if (e.metaKey || e.ctrlKey) return;
      // Drag handle is the chrome (label strip + outer border) only. Pointer
      // events that originate inside `.dc-artboard-body` stay click-through
      // so Cmd-select continues to work on inner content.
      const target = e.target as Element | null;
      if (target && typeof target.closest === 'function' && target.closest('.dc-artboard-body')) {
        return;
      }
      const leaderStart = rectForRef.current(artboardId);
      if (!leaderStart) return;
      // Don't `setPointerCapture` on the chrome — that re-targets the
      // subsequent `click` event to the captured ancestor (the article)
      // instead of the label `<button>`, which would silently swallow the
      // Phase 4 pan-to-focus `onClick={onFocus}` handler. The global
      // window-level pointermove/up listeners (capture: true) below pick
      // up every event regardless, so capture buys us nothing here.
      const selSet = selectedIdsRef.current;
      const followers = computeFollowers(artboardId, leaderStart, selSet, allRectsRef.current);
      const followerIds = new Set(followers.map((f) => f.id));
      const others = computeOthers(artboardId, followerIds, allRectsRef.current);
      setDragState(
        dragReducer(
          { kind: 'idle' },
          {
            type: 'down',
            clientX: e.clientX,
            clientY: e.clientY,
            leaderId: artboardId,
            leaderStart,
            followers,
            others,
          }
        )
      );
    },
    [artboardId]
  );

  // Global pointermove / pointerup while a drag is in flight. Bound at the
  // window level so a fast drag past any element still feeds the reducer.
  useEffect(() => {
    if (dragState.kind === 'idle') return;
    if (typeof window === 'undefined') return;

    const onMove = (ev: PointerEvent) => {
      const next = dragReducer(stateRef.current, {
        type: 'move',
        clientX: ev.clientX,
        clientY: ev.clientY,
        alt: !!ev.altKey,
        zoom: zoomRef.current,
        gridSize: gridSizeRef.current,
        tolerance: toleranceRef.current,
      });
      // Detect the pending → dragging transition to arm the click suppressor.
      if (stateRef.current.kind === 'pending' && next.kind === 'dragging') {
        armClickSuppressor();
      }
      setDragState(next);
    };

    const onUp = () => {
      const finalState = stateRef.current;
      const commit = commitFromState(finalState);
      setDragState({ kind: 'idle' });
      if (commit) {
        try {
          onCommitRef.current(commit);
        } catch (err) {
          console.warn('[use-artboard-drag] commit failed:', err);
        }
      }
    };

    window.addEventListener('pointermove', onMove, { capture: true });
    window.addEventListener('pointerup', onUp, { capture: true });
    window.addEventListener('pointercancel', onUp, { capture: true });

    return () => {
      window.removeEventListener('pointermove', onMove, { capture: true } as EventListenerOptions);
      window.removeEventListener('pointerup', onUp, { capture: true } as EventListenerOptions);
      window.removeEventListener('pointercancel', onUp, { capture: true } as EventListenerOptions);
    };
  }, [dragState.kind, armClickSuppressor]);

  const bindHandle = useCallback(
    (): HTMLAttributes<HTMLElement> => ({
      onPointerDown,
    }),
    [onPointerDown]
  );

  return { bindHandle, dragState };
}
