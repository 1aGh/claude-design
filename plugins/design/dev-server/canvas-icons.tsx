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

export const TOOL_ICONS: Record<string, (p: IconProps) => JSX.Element> = {
  move: IconMove,
  hand: IconHand,
  comment: IconComment,
  pen: IconPen,
  rect: IconRect,
  ellipse: IconEllipse,
  arrow: IconArrow,
  eraser: IconEraser,
};
