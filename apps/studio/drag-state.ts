/**
 * @file       drag-state.ts
 * @purpose    Tiny shared module-scope flag: is an in-canvas ELEMENT drag
 *             (`ReorderDrag` — reorder or out-of-flow reposition) currently
 *             active? Consulted by per-frame rAF overlays (`ElementResizeOverlay`,
 *             `SpacingHandlesOverlay`) so they can skip their own
 *             getBoundingClientRect/getComputedStyle work while the drag's OWN
 *             live-preview chrome is what matters — avoids compounding rAF cost
 *             during the single most DOM-churn-heavy gesture the canvas has
 *             (dogfood 2026-07-07: "hrozně zavaší ten toolbar" during reorder).
 *             A standalone module (not exported from canvas-shell.tsx) so the
 *             overlay files can import it without a circular import back into
 *             canvas-shell.tsx (which imports THEM).
 */

let active = false;

export function setElementDragActive(v: boolean): void {
  active = v;
}

export function isElementDragActive(): boolean {
  return active;
}
