/**
 * @file       use-cursor-modifiers.tsx — T28 (Wave 3)
 * @scope      apps/studio/use-cursor-modifiers.tsx
 * @purpose    Modifier-aware cursor state machine. Tracks Alt / Shift / Meta
 *             modifier state globally and reflects it as `data-mod-*`
 *             attributes on `.dc-canvas`. CSS rules consume those attrs to
 *             flip cursors live:
 *
 *               • Alt-held over a `[data-cd-id]` in Move tool → cursor: copy
 *                 (preview of "Alt-drag duplicates this element").
 *               • Shift-held in Move tool over empty body padding → crosshair
 *                 (preview of "marquee add mode").
 *
 *             Per the research finding (Excalidraw #250): cursor changes on
 *             HOVER, not on drag-start. We track modifier state at the
 *             document level so the cursor updates the moment the user
 *             presses/releases without waiting for a pointermove.
 *
 *             Resize-handle cursors (nw / ne / ns / ew) live next to the
 *             handle DOM in `use-annotation-resize.tsx` — those don't need
 *             modifier coupling; they fire on hover via their own CSS rules.
 */

import { type RefObject, useEffect } from 'react';

const STYLES = `
/* Alt + cd-id in move tool → copy cursor. The Alt-drag-duplicates affordance
   is partial in v1 (no drag handler yet) — paint the cursor anyway so the
   user discovers the gesture, and a future wave wires the actual duplication. */
.dc-canvas[data-active-tool="move"][data-mod-alt="true"] [data-cd-id],
.dc-canvas[data-active-tool="move"][data-mod-alt="true"] [data-dc-screen] {
  cursor: copy !important;
}

/* Shift over empty body padding in move tool → crosshair (marquee add mode
   preview). Body padding = the .dc-artboard-body direct background, not
   user content. */
.dc-canvas[data-active-tool="move"][data-mod-shift="true"] .dc-artboard-body {
  cursor: crosshair;
}
`.trim();

function ensureStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById('dc-cv-cursor-modifiers-css')) return;
  const s = document.createElement('style');
  s.id = 'dc-cv-cursor-modifiers-css';
  s.textContent = STYLES;
  document.head.appendChild(s);
}

export interface ModifierState {
  alt: boolean;
  shift: boolean;
  meta: boolean;
}

/**
 * Reduce a key event into the modifier slice. Pulled out for unit tests —
 * the actual hook is DOM-bound and harder to test directly.
 */
export function reduceModifiers(
  prev: ModifierState,
  e: { altKey: boolean; shiftKey: boolean; metaKey: boolean; ctrlKey: boolean }
): ModifierState {
  // Treat Ctrl as Meta on non-mac so the cursor preview stays consistent with
  // the input-router's `metaOrCtrl` gate.
  const meta = e.metaKey || e.ctrlKey;
  if (prev.alt === e.altKey && prev.shift === e.shiftKey && prev.meta === meta) {
    return prev;
  }
  return { alt: e.altKey, shift: e.shiftKey, meta };
}

/**
 * Attach modifier tracking to the canvas host element. Reflects the modifier
 * state as `data-mod-alt` / `data-mod-shift` / `data-mod-meta` so cursor CSS
 * rules can act on combinations without re-rendering React.
 *
 * Cleans up on unmount + on window blur (so leaving the tab with Alt held
 * doesn't strand the cursor in copy mode).
 */
export function useCursorModifiers(hostRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const host = hostRef.current;
    if (!host) return;
    ensureStyles();

    let state: ModifierState = { alt: false, shift: false, meta: false };

    const apply = (next: ModifierState) => {
      if (next === state) return;
      state = next;
      host.setAttribute('data-mod-alt', next.alt ? 'true' : 'false');
      host.setAttribute('data-mod-shift', next.shift ? 'true' : 'false');
      host.setAttribute('data-mod-meta', next.meta ? 'true' : 'false');
    };

    const onKeyChange = (e: KeyboardEvent) => apply(reduceModifiers(state, e));
    const onBlur = () => apply({ alt: false, shift: false, meta: false });
    // pointermove carries the modifier state too — handles the case where
    // the user presses a modifier outside the focused window and then mouses
    // back in (keydown/keyup never fires for the press).
    const onPointer = (e: PointerEvent) => apply(reduceModifiers(state, e));

    document.addEventListener('keydown', onKeyChange, true);
    document.addEventListener('keyup', onKeyChange, true);
    document.addEventListener('pointermove', onPointer, { passive: true });
    window.addEventListener('blur', onBlur);

    return () => {
      document.removeEventListener('keydown', onKeyChange, true);
      document.removeEventListener('keyup', onKeyChange, true);
      document.removeEventListener('pointermove', onPointer);
      window.removeEventListener('blur', onBlur);
      host.removeAttribute('data-mod-alt');
      host.removeAttribute('data-mod-shift');
      host.removeAttribute('data-mod-meta');
    };
  }, [hostRef]);
}
