/**
 * @file       canvas-icons.tsx — Phase 5.1 inline-SVG icon set
 * @scope      plugins/design/dev-server/canvas-icons.tsx
 * @purpose    Tiny dependency-free Lucide-style icon set for the canvas
 *             chrome (tool palette, context toolbar). Each icon is a single
 *             `<svg>` with `currentColor` stroke so it inherits the button
 *             foreground. Sized 16 px by default; the parent button is
 *             32 × 32, leaving 8 px of optical padding on every side.
 */

import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 16, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export function IconMove(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 4l16 6-7 2-2 7z" />
    </Svg>
  );
}

export function IconHand(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8 13V5a1.5 1.5 0 013 0v6" />
      <path d="M11 11V4a1.5 1.5 0 013 0v7" />
      <path d="M14 11V5.5a1.5 1.5 0 013 0V13" />
      <path d="M17 9a1.5 1.5 0 013 0v6a6 6 0 01-6 6h-2a6 6 0 01-5-2.5L4 14a1.5 1.5 0 012-2l2 2" />
    </Svg>
  );
}

export function IconComment(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M21 12a8 8 0 11-3.3-6.5L21 4l-1 4.3A8 8 0 0121 12z" />
    </Svg>
  );
}

export function IconPen(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M14.5 4.5l5 5L8 21H3v-5z" />
      <path d="M13 6l5 5" />
    </Svg>
  );
}

export function IconRect(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="5" width="16" height="14" rx="1.5" />
    </Svg>
  );
}

export function IconEllipse(props: IconProps) {
  return (
    <Svg {...props}>
      <ellipse cx="12" cy="12" rx="8" ry="6" />
    </Svg>
  );
}

export function IconArrow(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 12h14" />
      <path d="M13 6l6 6-6 6" />
    </Svg>
  );
}

export function IconEraser(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M16 3l5 5-11 11H4v-6z" />
      <path d="M8 14l5 5" />
    </Svg>
  );
}

// Phase 21 — sticky note: folded-corner square (dog-ear at the top-right).
export function IconSticky(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 5h12l4 4v10H4z" />
      <path d="M16 5v4h4" />
    </Svg>
  );
}

// Phase 21 — standalone text: capital-T glyph (cap bar + stem).
export function IconText(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 6h16" />
      <path d="M12 6v12" />
    </Svg>
  );
}

export function IconPresentation(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="4" width="18" height="12" rx="1.5" />
      <path d="M9 21l3-5 3 5" />
    </Svg>
  );
}

export function IconChevronDown(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 9l6 6 6-6" />
    </Svg>
  );
}

// ── Phase 21 context-toolbar icons ──────────────────────────────────────────
// Corner radius: a square whose corners show the chosen rounding.
export function IconCornerSquare(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="5" y="5" width="14" height="14" rx="0.5" />
    </Svg>
  );
}
export function IconCornerSoft(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="5" y="5" width="14" height="14" rx="4" />
    </Svg>
  );
}
export function IconCornerPill(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="5" y="5" width="14" height="14" rx="7" />
    </Svg>
  );
}

// Arrow direction: a shaft with chevron head(s) on the chosen end(s).
export function IconArrowNone(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 12h16" />
    </Svg>
  );
}
export function IconArrowStartHead(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 12h16" />
      <path d="M9 7l-5 5 5 5" />
    </Svg>
  );
}
export function IconArrowEndHead(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 12h16" />
      <path d="M15 7l5 5-5 5" />
    </Svg>
  );
}
export function IconArrowBothHeads(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 12h14" />
      <path d="M9 7l-5 5 5 5" />
      <path d="M15 7l5 5-5 5" />
    </Svg>
  );
}

// Dashed line toggle.
export function IconDash(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 12h4" />
      <path d="M10 12h4" />
      <path d="M17 12h4" />
    </Svg>
  );
}

// Stroke weight: thin vs thick rule.
export function IconLineThin(props: IconProps) {
  return (
    <Svg {...props} strokeWidth={1.25}>
      <path d="M4 12h16" />
    </Svg>
  );
}
export function IconLineThick(props: IconProps) {
  return (
    <Svg {...props} strokeWidth={3.75}>
      <path d="M4 12h16" />
    </Svg>
  );
}

// Letter "A" — font-size chips render it at three sizes (S / M / L).
export function IconLetterA(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 5L6 19" />
      <path d="M12 5l6 14" />
      <path d="M8.5 14h7" />
    </Svg>
  );
}

// Trash — delete selected annotations.
export function IconTrash(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 7h16" />
      <path d="M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2" />
      <path d="M6 7l1 12a1 1 0 001 1h8a1 1 0 001-1l1-12" />
      <path d="M10 11v6M14 11v6" />
    </Svg>
  );
}

// ── Phase 24 shape-tool icons ────────────────────────────────────────────────
// IconShape — the Shape tool button: a square + circle composite (FigJam-style).
export function IconShape(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="4" width="11" height="11" rx="1.5" />
      <circle cx="15" cy="15" r="5" />
    </Svg>
  );
}
export function IconSquare(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="4" width="16" height="16" rx="0.5" />
    </Svg>
  );
}
export function IconRoundedSquare(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="4" width="16" height="16" rx="4" />
    </Svg>
  );
}
export function IconCircle(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8" />
    </Svg>
  );
}
export function IconDiamond(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3l9 9-9 9-9-9z" />
    </Svg>
  );
}
export function IconTriangle(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 4l8 16H4z" />
    </Svg>
  );
}
export function IconTriangleDown(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 4h16l-8 16z" />
    </Svg>
  );
}

// ── Phase 24 arrowhead-picker icons ──────────────────────────────────────────
// Each shows a short shaft ending in the head style on the right.
export function IconArrowheadLine(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 12h13" />
      <path d="M12 8l5 4-5 4" />
    </Svg>
  );
}
export function IconArrowheadTriangle(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 12h11" />
      <path d="M13 8l6 4-6 4z" fill="currentColor" />
    </Svg>
  );
}
export function IconArrowheadTriangleOutline(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 12h11" />
      <path d="M13 8l6 4-6 4z" />
    </Svg>
  );
}
export function IconArrowheadCircle(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 12h11" />
      <circle cx="17" cy="12" r="3" fill="currentColor" />
    </Svg>
  );
}
export function IconArrowheadDiamond(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 12h10" />
      <path d="M17 8l4 4-4 4-4-4z" fill="currentColor" />
    </Svg>
  );
}

// ── Phase 24 line-type icons ─────────────────────────────────────────────────
export function IconLineStraight(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 12h16" />
    </Svg>
  );
}
export function IconLineCurved(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 18C4 9 20 15 20 6" />
    </Svg>
  );
}
export function IconLineElbow(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 6v6a2 2 0 002 2h14" />
    </Svg>
  );
}

// ── Phase 24 text-style icons ────────────────────────────────────────────────
export function IconBold(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M7 5h6a3.5 3.5 0 010 7H7zM7 12h7a3.5 3.5 0 010 7H7z" />
    </Svg>
  );
}
export function IconStrike(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 12h14" />
      <path d="M8 7a4 3 0 016-1M16 16a4 3 0 01-7 1" />
    </Svg>
  );
}
export function IconAlignLeft(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 6h16M4 12h10M4 18h13" />
    </Svg>
  );
}
export function IconAlignCenter(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 6h16M7 12h10M5 18h14" />
    </Svg>
  );
}
export function IconAlignRight(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 6h16M10 12h10M7 18h13" />
    </Svg>
  );
}

export const TOOL_ICONS: Record<string, (p: IconProps) => JSX.Element> = {
  move: IconMove,
  hand: IconHand,
  comment: IconComment,
  pen: IconPen,
  // Phase 24 — single Shape tool. rect/ellipse kept for any legacy lookups.
  shape: IconShape,
  rect: IconRect,
  ellipse: IconEllipse,
  sticky: IconSticky,
  arrow: IconArrow,
  text: IconText,
  eraser: IconEraser,
};

// Phase 24 — shape-kind → icon, for the palette popover + context toolbar.
export const SHAPE_KIND_ICONS: Record<string, (p: IconProps) => JSX.Element> = {
  square: IconSquare,
  rounded: IconRoundedSquare,
  circle: IconCircle,
  diamond: IconDiamond,
  triangle: IconTriangle,
  'triangle-down': IconTriangleDown,
};
