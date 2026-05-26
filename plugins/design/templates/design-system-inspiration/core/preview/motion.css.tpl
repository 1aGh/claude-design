/* motion.css — per-specimen CSS for motion.tsx.
 *
 * Scoped to the motion specimen. Tile chrome + curve layout only — the
 * actual animation keyframes/transitions are owned by canvas-lib's
 * <MotionDemo>. This file MUST NOT redefine motion role behavior.
 *
 * Reduced-motion exception (DDR-049, ANIMATION SAFETY block):
 *   This specimen is the documented exception to the @media reduced-motion
 *   killswitch in _layout.css. We use !important here because _layout.css's
 *   universal `animation: none !important` would kill the <MotionDemo>'s
 *   own animate prop. Scoped to .motion-card / .motion-curve only — other
 *   surfaces still honor OS-level reduced-motion.
 */

.motion-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: var(--space-3, 16px);
}

.motion-card {
  background: var(--bg-1);
  padding: var(--space-3, 20px);
  border-radius: var(--radius-md, 6px);
  border: 1px solid var(--border-default, currentColor);
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 12px);
}

.motion-card__stage {
  height: 80px;
  background: var(--bg-2, var(--bg-1));
  border-radius: var(--radius-sm, 4px);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.motion-card__stage .motion-demo {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.motion-card__stage .motion-demo__chip {
  width: 32px;
  height: 32px;
  background: var(--accent, currentColor);
  border-radius: var(--radius-sm, 4px);
}

.motion-card__tokens {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: var(--type-sm, 12px);
  color: var(--fg-2, currentColor);
}

.motion-card__note {
  font-size: var(--type-sm, 12px);
  color: var(--fg-1, currentColor);
}

.motion-curves__row {
  display: flex;
  gap: var(--space-3, 16px);
  flex-wrap: wrap;
  align-items: flex-end;
}

.motion-curve {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1, 6px);
}

.motion-curve figcaption {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: var(--type-xs, 11px);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.motion-curve__values {
  color: var(--fg-2, currentColor);
  font-variant-numeric: tabular-nums;
}

/* Reduced-motion: scoped specimen exception (see header). */
@media (prefers-reduced-motion: reduce) {
  .motion-card .motion-demo__target {
    animation: none !important;
    transition: none !important;
  }
}

/* Specimen honors the chrome toggle for inspection symmetry. */
:root[data-reduced-motion="true"] .motion-card .motion-demo__target {
  animation: none !important;
  transition: none !important;
}
