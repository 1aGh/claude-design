/**
 * @file       canvas-cursors.ts — Phase 21 custom tool cursors
 * @scope      plugins/design/dev-server/canvas-cursors.ts
 * @purpose    FigJam/Figma-style custom cursors for the annotation + nav tools.
 *             The native `crosshair` / `text` / `cell` cursors are tiny, thin,
 *             and vanish on busy canvases (the "pen is almost invisible"
 *             complaint). These are 32×32 SVG cursors with a WHITE outline halo
 *             so the glyph reads on any background, light or dark, and each one
 *             mirrors its tool-palette icon so the cursor and the tool button
 *             share one visual identity.
 *
 *             Delivered as CSS `cursor: url("data:image/svg+xml,…") hx hy, fb`
 *             — no runtime dependency, no asset files (Figma ships cursors the
 *             same way). 32×32 is the cross-browser-safe ceiling; the hotspot
 *             (hx, hy) is the pixel the click actually registers at.
 */

import type { Tool } from './input-router.tsx';

/** Build a CSS cursor value from an inline SVG + hotspot + native fallback. */
function svgCursor(svg: string, hx: number, hy: number, fallback: string): string {
  // encodeURIComponent is the safest escaping for a data: URI inside url("…").
  return `url("data:image/svg+xml,${encodeURIComponent(svg.trim())}") ${hx} ${hy}, ${fallback}`;
}

const W = `width='32' height='32' viewBox='0 0 32 32' xmlns='http://www.w3.org/2000/svg'`;
const HALO = "stroke='#ffffff' stroke-linejoin='round' stroke-linecap='round'";
const INK = '#1f1f1f';

// Precise crosshair with a centre gap — rect / ellipse / arrow. Hotspot 16,16.
const CROSSHAIR = svgCursor(
  `<svg ${W}>
    <path d='M16 4V13M16 19V28M4 16H13M19 16H28' fill='none' ${HALO} stroke-width='4'/>
    <path d='M16 4V13M16 19V28M4 16H13M19 16H28' fill='none' stroke='${INK}' stroke-width='1.75' stroke-linecap='round'/>
    <circle cx='16' cy='16' r='1.3' fill='${INK}'/>
  </svg>`,
  16,
  16,
  'crosshair'
);

// Marker/pen — nib points at the draw point (bottom-left). Hotspot 6,26.
const PEN = svgCursor(
  `<svg ${W}>
    <path d='M22 4l6 6-15 15-7 1 1-7z' fill='${INK}' ${HALO} stroke-width='2.25'/>
    <path d='M18.5 7.5l6 6' ${HALO} stroke-width='2'/>
    <path d='M7 25l-1.5 1.5' ${HALO} stroke-width='2.5'/>
  </svg>`,
  6,
  26,
  'crosshair'
);

// Bigger I-beam for text. Hotspot 16,16.
const TEXT = svgCursor(
  `<svg ${W}>
    <path d='M16 5V27M11 5H21M11 27H21' fill='none' ${HALO} stroke-width='4.5'/>
    <path d='M16 5V27M11 5H21M11 27H21' fill='none' stroke='${INK}' stroke-width='2' stroke-linecap='round'/>
  </svg>`,
  16,
  16,
  'text'
);

// Speech bubble — drops a comment at the tail tip (bottom-left). Hotspot 8,27.
const COMMENT = svgCursor(
  `<svg ${W}>
    <path d='M8 5H26a4 4 0 0 1 4 4V18a4 4 0 0 1-4 4H14l-6 6v-6H8a4 4 0 0 1-4-4V9a4 4 0 0 1 4-4Z' fill='${INK}' ${HALO} stroke-width='2.25'/>
    <circle cx='12' cy='13.5' r='1.4' fill='#fff'/>
    <circle cx='17' cy='13.5' r='1.4' fill='#fff'/>
    <circle cx='22' cy='13.5' r='1.4' fill='#fff'/>
  </svg>`,
  8,
  27,
  'crosshair'
);

// Open hand for pan/grab. Hotspot 16,17.
const HAND = svgCursor(
  `<svg ${W}>
    <path d='M10 19v-8a1.8 1.8 0 0 1 3.6 0v-1.2a1.8 1.8 0 0 1 3.6 0v.6a1.8 1.8 0 0 1 3.6 0V12a1.8 1.8 0 0 1 3.6 0v6.5a7.5 7.5 0 0 1-7.5 7.5h-1a7.5 7.5 0 0 1-6.4-3.6l-2.4-3.7a1.9 1.9 0 0 1 3-2.3z' fill='${INK}' ${HALO} stroke-width='2'/>
  </svg>`,
  16,
  17,
  'grab'
);

// Eraser — working edge at bottom-left. Hotspot 8,24.
const ERASER = svgCursor(
  `<svg ${W}>
    <path d='M19 5l8 8-10 10H9l-4-4z' fill='${INK}' ${HALO} stroke-width='2.25'/>
    <path d='M13 11l8 8' ${HALO} stroke-width='2'/>
  </svg>`,
  8,
  24,
  'cell'
);

// Sticky — a mini yellow note (matches the card). Drag starts at its top-left.
const STICKY = svgCursor(
  `<svg ${W}>
    <path d='M7 6h11l8 8v12H7z' fill='#ffe27a' stroke='${INK}' stroke-width='2' stroke-linejoin='round'/>
    <path d='M18 6v8h8' fill='none' stroke='${INK}' stroke-width='2' stroke-linejoin='round'/>
  </svg>`,
  8,
  7,
  'crosshair'
);

/**
 * Tool → CSS cursor value. `move` keeps the system arrow (the universal
 * select/move affordance); everything else gets a crafted cursor.
 */
export const TOOL_CURSORS: Record<Tool, string> = {
  move: 'default',
  hand: HAND,
  comment: COMMENT,
  pen: PEN,
  rect: CROSSHAIR,
  ellipse: CROSSHAIR,
  sticky: STICKY,
  arrow: CROSSHAIR,
  text: TEXT,
  eraser: ERASER,
};
