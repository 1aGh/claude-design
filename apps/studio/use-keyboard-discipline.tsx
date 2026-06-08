/**
 * @file       use-keyboard-discipline.tsx — T29 (Wave 3)
 * @scope      apps/studio/use-keyboard-discipline.tsx
 * @purpose    Keyboard nudge + Cmd+A select-all-in-artboard. Bail when focus
 *             is inside an input / textarea / contenteditable so typing
 *             into the dev-server's own inputs (file tree filter, etc.)
 *             never collides.
 *
 *             Scope decision — arrow nudge applies to **artboards** only.
 *             User content inside artboards has no live-position channel
 *             (canvas surface is HTML; element positions are CSS-derived
 *             from the compiled JSX, not directly manipulable). Element
 *             nudge would require either an ephemeral CSS-transform overlay
 *             (cleaner) or a TSX rewrite channel (heavier). Out of scope
 *             for this wave — the artboard channel + dragBus.commitPositions
 *             already exists, so we leverage that and document the
 *             limitation here.
 *
 *             Cmd+D duplicate is also deferred — same architectural reason
 *             (no duplicate channel). Esc is owned by the input-router's
 *             onEscape callback, so we don't duplicate it here.
 *
 *             Distance:
 *               • Arrow      → 1 world-unit step (DDR-028 world units, not
 *                              screen px).
 *               • Shift+Arrow → 10 world-unit step.
 */

import { useEffect } from 'react';

import { useArtboardsContext, useDragStateContext } from './canvas-lib.tsx';
import { scopedCdSelector } from './dom-selection.ts';
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
          hits.push({
            id: cdId,
            selector: scopedCdSelector(cdId, id),
            artboardId: id,
            tag: el.tagName.toLowerCase(),
          });
        }
        if (hits.length === 0) return;
        e.preventDefault();
        selSet.replace(hits);
        return;
      }

      // Arrow nudge — artboards only (see file header for the why).
      const delta = nudgeDelta({ key: e.key, shift: e.shiftKey });
      if (!delta) return;
      if (isMeta || e.altKey) return; // modifier combos reserved for future
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
