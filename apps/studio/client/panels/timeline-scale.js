// timeline-scale.js — feature-enhanced-video-editing (Task 4). Pure zoom/scale
// helpers for the Timeline: all block/handle/caret/playhead math goes through
// ONE px-per-frame scale (replacing the old %-of-total positioning), so drags
// land on the same frames at every zoom level. Pure + DOM-free → unit-tested.

/** Fit-to-width scale: the whole comp spans the viewport exactly. */
export function fitPxPerFrame(viewportPx, totalFrames) {
  const w = Math.max(1, viewportPx || 1);
  const t = Math.max(1, totalFrames || 1);
  return w / t;
}

/** Hard zoom bounds: never below fit (no dead space right of the comp), never
 *  above MAX_PX_PER_FRAME (a frame wider than ~40px stops being useful). */
export const MAX_PX_PER_FRAME = 40;

export function clampPxPerFrame(pxPerFrame, viewportPx, totalFrames) {
  const fit = fitPxPerFrame(viewportPx, totalFrames);
  const v = Number(pxPerFrame);
  if (!Number.isFinite(v) || v <= 0) return fit;
  return Math.min(MAX_PX_PER_FRAME, Math.max(fit, v));
}

export function frameToPx(frame, pxPerFrame) {
  return frame * pxPerFrame;
}

export function pxToFrame(px, pxPerFrame) {
  return pxPerFrame > 0 ? px / pxPerFrame : 0;
}

/**
 * Zoom keeping `anchorFrame` stationary on screen: given the current scroll
 * offset and the anchor's viewport position, return the scrollLeft that puts
 * the anchor back at the same viewport x under the new scale.
 */
export function zoomAroundScroll(prevPxPerFrame, nextPxPerFrame, anchorFrame, prevScrollLeft) {
  const anchorViewportX = frameToPx(anchorFrame, prevPxPerFrame) - prevScrollLeft;
  return Math.max(0, frameToPx(anchorFrame, nextPxPerFrame) - anchorViewportX);
}

/**
 * Adaptive ruler tick step (in frames): the densest step from the ladder whose
 * ticks stay ≥ `minPx` apart. Ladder walks 1 f → 5 f → 10 f → 1 s → 5 s → 10 s
 * → 30 s → 60 s, so zooming in refines seconds into frames.
 */
export function tickStepFrames(pxPerFrame, fps, minPx = 56) {
  const f = Math.max(1, Math.round(fps || 30));
  const ladder = [1, 5, 10, f, 5 * f, 10 * f, 30 * f, 60 * f];
  for (const step of ladder) {
    if (step * pxPerFrame >= minPx) return step;
  }
  return ladder[ladder.length - 1];
}

/** Ruler tick labels: whole seconds label as `Ns`, sub-second ticks as `Nf`. */
export function tickLabel(frame, fps) {
  const f = Math.max(1, Math.round(fps || 30));
  if (frame % f === 0) return `${frame / f}s`;
  return `${frame}f`;
}

/** Multiplicative zoom step (⌘+/⌘− and the slider use the same factor). */
export const ZOOM_STEP = 1.5;
