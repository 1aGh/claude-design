/**
 * @file       use-keyboard-discipline.tsx — T29 (Wave 3)
 * @scope      apps/studio/use-keyboard-discipline.tsx
 * @purpose    Keyboard nudge + Cmd+A select-all-in-artboard. Bail when focus
 *             is inside an input / textarea / contenteditable so typing
 *             into the dev-server's own inputs (file tree filter, etc.)
 *             never collides.
 *
 *             Arrow nudge applies to artboards AND to a single OUT-OF-FLOW
 *             element (position:absolute/fixed) — the latter added in Task L1
 *             once the `reposition-request` channel existed (the original
 *             "no live-position channel" limitation is resolved for out-of-flow
 *             elements: preview inline, commit the settle via reposition-request).
 *             In-flow elements stay a no-op (nudge is ambiguous with no left/top).
 *
 *             Cmd+D duplicate (Task L3) + Cmd+Opt+C/V copy/paste-style (Task L4)
 *             are handled here too, relayed to the parent shell. Esc is owned by
 *             the input-router's onEscape callback, so we don't duplicate it.
 *
 *             Distance:
 *               • Arrow      → 1 world-unit step (DDR-028 world units, not
 *                              screen px).
 *               • Shift+Arrow → 10 world-unit step.
 */

import { useEffect, useRef } from 'react';

import { useArtboardsContext, useDragStateContext } from './canvas-lib.tsx';
import { resolveSelectionEl, scopedCdSelector, selectorIndex } from './dom-selection.ts';
import { isEditableTarget } from './input-router.tsx';
import { type Selection, useSelectionSet } from './use-selection-set.tsx';

const STEP_SMALL = 1;
const STEP_LARGE = 10;

export interface NudgeInput {
  key: string;
  shift: boolean;
}

/**
 * Map a keyboard event into a (dx, dy) delta in world units. Returns null
 * when the key isn't an arrow. Exported for unit tests.
 */
export function nudgeDelta(input: NudgeInput): { dx: number; dy: number } | null {
  const step = input.shift ? STEP_LARGE : STEP_SMALL;
  switch (input.key) {
    case 'ArrowLeft':
      return { dx: -step, dy: 0 };
    case 'ArrowRight':
      return { dx: step, dy: 0 };
    case 'ArrowUp':
      return { dx: 0, dy: -step };
    case 'ArrowDown':
      return { dx: 0, dy: step };
    default:
      return null;
  }
}

export function useKeyboardDiscipline(): void {
  const selSet = useSelectionSet();
  const artboardsCtx = useArtboardsContext();
  const dragBus = useDragStateContext();
  // Element arrow-nudge burst (Task L1): accumulate left/top, preview inline, and
  // commit once after a short pause (one undo per settle, not per keypress).
  const nudgeRef = useRef<{
    id: string;
    beforeLeft: number;
    beforeTop: number;
    left: number;
    top: number;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;

      // Cmd+A → select all stamped elements in the active artboard.
      const isMeta = e.metaKey || e.ctrlKey;
      if (isMeta && e.key.toLowerCase() === 'a') {
        if (!artboardsCtx) return;
        const id = artboardsCtx.activeArtboardId;
        if (!id) return;
        const root = document.querySelector(`[data-dc-screen="${id}"] .dc-artboard-body`);
        if (!root) return;
        const stamped = root.querySelectorAll('[data-cd-id]');
        if (stamped.length === 0) return;
        const hits: Selection[] = [];
        for (const el of stamped) {
          const cdId = el.getAttribute('data-cd-id');
          if (!cdId) continue;
          const kdSelector = scopedCdSelector(cdId, id);
          hits.push({
            id: cdId,
            selector: kdSelector,
            artboardId: id,
            index: selectorIndex(document, kdSelector, el),
            tag: el.tagName.toLowerCase(),
          });
        }
        if (hits.length === 0) return;
        e.preventDefault();
        selSet.replace(hits);
        return;
      }

      // Cmd/Ctrl+D → duplicate the single selected element (Task L3). Main-origin
      // write, so post to the parent shell (pinned to the active canvas + undo).
      // preventDefault so the browser doesn't bookmark the page.
      if (isMeta && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'd') {
        const one = selSet.selected.length === 1 ? selSet.selected[0] : null;
        if (one?.id) {
          e.preventDefault();
          try {
            window.parent.postMessage(
              { dgn: 'duplicate-request', id: one.id, idIndex: one.index },
              '*'
            );
          } catch {
            /* detached / cross-origin */
          }
        }
        return;
      }

      // Cmd/Ctrl+Opt+C / +V → copy-style / paste-style (Task L4). Copy captures the
      // selection's authored appearance (shell-side); paste applies it to the
      // currently selected element. The shell holds the clipboard + does the write.
      if (isMeta && e.altKey && (e.key.toLowerCase() === 'c' || e.key.toLowerCase() === 'v')) {
        const one = selSet.selected.length === 1 ? selSet.selected[0] : null;
        if (one?.id) {
          e.preventDefault();
          try {
            window.parent.postMessage(
              e.key.toLowerCase() === 'c'
                ? { dgn: 'copy-style' }
                : { dgn: 'paste-style', id: one.id },
              '*'
            );
          } catch {
            /* detached / cross-origin */
          }
        }
        return;
      }

      // Delete / Backspace → request a source delete of the single selected
      // element (feature-element-editing-robustness Stage I). The write is
      // main-origin-only (DDR-054), so we POST the request to the parent shell,
      // which performs it (pinned to the active canvas) + records undo. Guarded
      // against text-editing focus above; skip modifier combos + non-single /
      // artboard-only selections (whole-artboard delete is out of scope here).
      if ((e.key === 'Delete' || e.key === 'Backspace') && !isMeta && !e.altKey) {
        const one = selSet.selected.length === 1 ? selSet.selected[0] : null;
        if (one?.id) {
          e.preventDefault();
          try {
            // `index` is the DOM occurrence among same-cd-id nodes, which equals
            // the reused-component usage index — so a shared-instance delete
            // targets the right <Component/> usage (resolveUsageId, canvas-edit).
            window.parent.postMessage(
              { dgn: 'delete-request', id: one.id, idIndex: one.index },
              '*'
            );
          } catch {
            /* detached / cross-origin */
          }
        } else if (one?.artboardId && !one.id) {
          // Whole-artboard delete — addressed by its `id` prop (no cd-id on the
          // rendered <article>). Shell performs it main-origin-only + records undo.
          e.preventDefault();
          try {
            window.parent.postMessage(
              { dgn: 'delete-artboard-request', artboardId: one.artboardId },
              '*'
            );
          } catch {
            /* detached / cross-origin */
          }
        }
        return;
      }

      const delta = nudgeDelta({ key: e.key, shift: e.shiftKey });
      if (!delta) return;
      if (isMeta || e.altKey) return; // modifier combos reserved for future

      // Arrow nudge — a single OUT-OF-FLOW element (position:absolute/fixed).
      // In-flow elements are a no-op (nudging a flow element is ambiguous — it has
      // no free left/top). Preview inline, commit the settle via reposition-request.
      {
        const one = selSet.selected.length === 1 ? selSet.selected[0] : null;
        if (one?.id) {
          const el = resolveSelectionEl(document, one) as HTMLElement | null;
          if (!el) return;
          const cs = getComputedStyle(el);
          if (cs.position !== 'absolute' && cs.position !== 'fixed') return; // no-op
          e.preventDefault();
          const prev = nudgeRef.current?.id === one.id ? nudgeRef.current : null;
          const curLeft = prev
            ? prev.left
            : Number.parseFloat(el.style.left) || Number.parseFloat(cs.left) || 0;
          const curTop = prev
            ? prev.top
            : Number.parseFloat(el.style.top) || Number.parseFloat(cs.top) || 0;
          const beforeLeft = prev ? prev.beforeLeft : curLeft;
          const beforeTop = prev ? prev.beforeTop : curTop;
          const left = curLeft + delta.dx;
          const top = curTop + delta.dy;
          el.style.left = `${left}px`;
          el.style.top = `${top}px`;
          if (prev) clearTimeout(prev.timer);
          const id = one.id;
          const timer = setTimeout(() => {
            const s = nudgeRef.current;
            nudgeRef.current = null;
            if (!s) return;
            try {
              window.parent.postMessage(
                {
                  dgn: 'reposition-request',
                  id: s.id,
                  left: s.left,
                  top: s.top,
                  beforeLeft: s.beforeLeft,
                  beforeTop: s.beforeTop,
                },
                '*'
              );
            } catch {
              /* detached / cross-origin */
            }
          }, 350);
          nudgeRef.current = { id, beforeLeft, beforeTop, left, top, timer };
          return;
        }
      }

      // Arrow nudge — artboards only (see file header for the why).
      if (!artboardsCtx || !dragBus) return;

      const artboardSelections = selSet.selected.filter((s) => !!s.artboardId && !s.id);
      if (artboardSelections.length === 0) return;
      const ids = new Set(artboardSelections.map((s) => s.artboardId as string));
      const targets = artboardsCtx.artboards.filter((r) => ids.has(r.id));
      if (targets.length === 0) return;

      e.preventDefault();
      const moved = targets.map((r) => ({
        id: r.id,
        x: Math.round(r.x + delta.dx),
        y: Math.round(r.y + delta.dy),
      }));
      dragBus.commitPositions(moved);
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [selSet, artboardsCtx, dragBus]);
}
