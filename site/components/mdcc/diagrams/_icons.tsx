/**
 * Shared thin-stroke (1.4) geometric icon set for the docs diagrams. Lifted from
 * .design/ui/Studio Docs.tsx (and the existing flow-loop.tsx) — terminal/IDE
 * heritage, no emoji (maude DS rule). Every <Icon> is decorative + aria-hidden.
 */
import type { ReactNode } from 'react';

export type DiagramIconName =
  | 'arrow-right'
  | 'arrow-left'
  | 'loop'
  | 'workflow'
  | 'server'
  | 'braces'
  | 'layers'
  | 'terminal'
  | 'folder'
  | 'cube'
  | 'sparkle'
  | 'check'
  | 'pointer'
  | 'push'
  | 'rewind';

const ICON_PATHS: Record<DiagramIconName, ReactNode> = {
  'arrow-right': (
    <>
      <line x1="3" y1="8" x2="12.5" y2="8" />
      <polyline points="9 4.5 12.5 8 9 11.5" />
    </>
  ),
  'arrow-left': (
    <>
      <line x1="13" y1="8" x2="3.5" y2="8" />
      <polyline points="7 4.5 3.5 8 7 11.5" />
    </>
  ),
  loop: (
    <>
      <path d="M3 8a5 5 0 0 1 8.6-3.5L13 6" />
      <polyline points="13 2.5 13 6 9.5 6" />
      <path d="M13 8a5 5 0 0 1-8.6 3.5L3 10" />
      <polyline points="3 13.5 3 10 6.5 10" />
    </>
  ),
  workflow: (
    <>
      <rect x="2.5" y="2.5" width="4" height="4" rx="1" />
      <rect x="9.5" y="9.5" width="4" height="4" rx="1" />
      <path d="M6.5 4.5h3a2 2 0 0 1 2 2v3" />
    </>
  ),
  server: (
    <>
      <rect x="2.5" y="3" width="11" height="4" rx="1" />
      <rect x="2.5" y="9" width="11" height="4" rx="1" />
      <circle cx="5" cy="5" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="5" cy="11" r="0.6" fill="currentColor" stroke="none" />
    </>
  ),
  braces: (
    <>
      <path d="M6 2.5C4.5 2.5 4.5 5 4.5 6S3 8 3 8s1.5 1 1.5 2 0 3.5 1.5 3.5" />
      <path d="M10 2.5C11.5 2.5 11.5 5 11.5 6S13 8 13 8s-1.5 1-1.5 2 0 3.5-1.5 3.5" />
    </>
  ),
  layers: (
    <>
      <polygon points="8 2.2 13.8 5.5 8 8.8 2.2 5.5" />
      <polyline points="2.2 9 8 12.3 13.8 9" />
    </>
  ),
  terminal: (
    <>
      <polyline points="3.5 5.5 6 8 3.5 10.5" />
      <line x1="8" y1="11" x2="12" y2="11" />
    </>
  ),
  folder: <path d="M2.5 4.5h3.2l1.3 1.5h6.5v6.5a1 1 0 0 1-1 1H2.5z" />,
  cube: (
    <>
      <polygon points="8 2.3 13.5 5.2 13.5 10.8 8 13.7 2.5 10.8 2.5 5.2" />
      <line x1="8" y1="2.3" x2="8" y2="13.7" />
      <line x1="2.5" y1="5.2" x2="8" y2="8" />
      <line x1="13.5" y1="5.2" x2="8" y2="8" />
    </>
  ),
  sparkle: (
    <path
      d="M8 1.8l1.4 4.8L14 8l-4.6 1.4L8 14.2l-1.4-4.8L2 8l4.6-1.4z"
      fill="currentColor"
      stroke="none"
    />
  ),
  check: <polyline points="3 8.2 6.4 11.5 13 4.2" />,
  pointer: <path d="M4 3l8.5 4-3.6 1.1L7 12.5z" />,
  push: (
    <>
      <line x1="8" y1="13" x2="8" y2="4" />
      <polyline points="4.5 7.5 8 4 11.5 7.5" />
    </>
  ),
  rewind: (
    <>
      <polyline points="8 4 4 8 8 12" />
      <polyline points="12 4 8 8 12 12" />
    </>
  ),
};

export function Icon({
  name,
  size = 14,
  className,
}: {
  name: DiagramIconName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICON_PATHS[name]}
    </svg>
  );
}
