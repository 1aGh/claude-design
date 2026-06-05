/**
 * @file       artboard-activity-overlay.tsx — Phase 13 / DDR-029 overlay.
 * @scope      plugins/design/dev-server/artboard-activity-overlay.tsx
 * @purpose    The "agent works here" chrome for a single artboard: an animated
 *             rim + a top-right `editing — <label>` badge. Rendered by
 *             `DCArtboard` as a world-coord sibling of the `<article>`, so it
 *             pans/zooms with the artboard for free.
 *
 * Decorative — `aria-hidden` + `pointer-events:none`. All visual styling
 * (border, pulse keyframes, reduced-motion fallback) lives in the inspector
 * style block injected by `inspect.ts` (single injection point — DDR-029), so
 * this component only places the box and toggles `data-fading` for the 200 ms
 * cross-fade out when the file goes idle.
 */

import type { CSSProperties } from 'react';

export interface OverlayRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function ArtboardActivityOverlay({
  rect,
  label,
  active,
  color,
}: {
  rect: OverlayRect;
  label: string;
  /** true = editing now (pulse, opacity 1); false = idle, cross-fading out. */
  active: boolean;
  /**
   * Per-agent presence color (Phase 13.2 / DDR-078). Overrides the default
   * `--mdcc-activity` hue so each agent's rim + badge carry its own color.
   * Omitted for manual / non-agent edits (default inspector blue).
   */
  color?: string;
}) {
  const style: CSSProperties = {
    position: 'absolute',
    left: rect.x,
    top: rect.y,
    width: rect.w,
    height: rect.h,
    pointerEvents: 'none',
    // The injected CSS reads `var(--mdcc-activity)`; setting it here recolors the
    // border, the ::after glow, and the badge background in one shot.
    ...(color ? ({ '--mdcc-activity': color } as CSSProperties) : {}),
  };
  return (
    <div
      className="dc-activity-rim"
      data-fading={active ? undefined : 'true'}
      aria-hidden
      style={style}
    >
      {/* Phase 13.3 — full-artboard scan beam (top→bottom sweep). Styled +
          animated by the injected inspector CSS; this just mounts the cover. */}
      <div className="dc-activity-scan" />
      <span className="dc-activity-badge">editing — {label}</span>
    </div>
  );
}
ArtboardActivityOverlay.displayName = 'ArtboardActivityOverlay';
