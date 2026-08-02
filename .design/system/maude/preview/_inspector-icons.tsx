/**
 * Inspector-panel icon set — vendored, local, no npm.
 *
 * WHY THIS FILE EXISTS. The specimen used to `import { … } from "lucide-react"`,
 * which is an npm package: fine on a laptop, impossible in a browser-rendered
 * canvas (Cloud Phase 25 A1 — the sandbox resolves the Maude runtime,
 * @maude/canvas-lib and the project's own files, and nothing else). It was also
 * quietly broken on the desktop: the bundled lucide chunk failed at module
 * evaluation ("default422 is not defined"), so this specimen had been showing a
 * build-error banner rather than a panel.
 *
 * The geometry is lucide's (ISC), extracted from the pinned package so the
 * drawing is unchanged; the wrapper is ours. One file, no dependency, and the
 * canvas now builds in both places.
 *
 * Icons under the ISC license, © Lucide Contributors.
 */
import type { SVGProps } from 'react';

type Node = [string, Record<string, string | number>];

function make(nodes: Node[]) {
  return function Icon({ size = 24, strokeWidth = 2, ...rest }: SVGProps<SVGSVGElement> & { size?: number; strokeWidth?: number }) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        {...rest}
      >
        {nodes.map(([tag, attrs], i) => {
          const Tag = tag as 'path';
          return <Tag key={i} {...(attrs as Record<string, string | number>)} />;
        })}
      </svg>
    );
  };
}

export const ALargeSmall = make([
  ["path", { d: "m15 16 2.536-7.328a1.02 1.02 1 0 1 1.928 0L22 16" }],
  ["path", { d: "M15.697 14h5.606" }],
  ["path", { d: "m2 16 4.039-9.69a.5.5 0 0 1 .923 0L11 16" }],
  ["path", { d: "M3.304 13h6.392" }]
] as Node[]);

export const AlignCenter = make([
  ["path", { d: "M21 5H3" }],
  ["path", { d: "M17 12H7" }],
  ["path", { d: "M19 19H5" }]
] as Node[]);

export const AlignHorizontalJustifyCenter = make([
  ["rect", { width: "6", height: "14", x: "2", y: "5", rx: "2" }],
  ["rect", { width: "6", height: "10", x: "16", y: "7", rx: "2" }],
  ["path", { d: "M12 2v20" }]
] as Node[]);

export const AlignHorizontalJustifyEnd = make([
  ["rect", { width: "6", height: "14", x: "2", y: "5", rx: "2" }],
  ["rect", { width: "6", height: "10", x: "12", y: "7", rx: "2" }],
  ["path", { d: "M22 2v20" }]
] as Node[]);

export const AlignHorizontalJustifyStart = make([
  ["rect", { width: "6", height: "14", x: "6", y: "5", rx: "2" }],
  ["rect", { width: "6", height: "10", x: "16", y: "7", rx: "2" }],
  ["path", { d: "M2 2v20" }]
] as Node[]);

export const AlignHorizontalSpaceBetween = make([
  ["rect", { width: "6", height: "14", x: "3", y: "5", rx: "2" }],
  ["rect", { width: "6", height: "10", x: "15", y: "7", rx: "2" }],
  ["path", { d: "M3 2v20" }],
  ["path", { d: "M21 2v20" }]
] as Node[]);

export const AlignJustify = make([
  ["path", { d: "M3 5h18" }],
  ["path", { d: "M3 12h18" }],
  ["path", { d: "M3 19h18" }]
] as Node[]);

export const AlignLeft = make([
  ["path", { d: "M21 5H3" }],
  ["path", { d: "M15 12H3" }],
  ["path", { d: "M17 19H3" }]
] as Node[]);

export const AlignRight = make([
  ["path", { d: "M21 5H3" }],
  ["path", { d: "M21 12H9" }],
  ["path", { d: "M21 19H7" }]
] as Node[]);

export const Baseline = make([
  ["path", { d: "M4 20h16" }],
  ["path", { d: "m6 16 6-12 6 12" }],
  ["path", { d: "M8 12h8" }]
] as Node[]);

export const Bold = make([
  [
    "path",
    { d: "M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8" }
  ]
] as Node[]);

export const Braces = make([
  [
    "path",
    { d: "M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5c0 1.1.9 2 2 2h1" }
  ],
  [
    "path",
    {
      d: "M16 21h1a2 2 0 0 0 2-2v-5c0-1.1.9-2 2-2a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1"
    }
  ]
] as Node[]);

export const Check = make([["path", { d: "M20 6 9 17l-5-5" }]] as Node[]);

export const ChevronDown = make([["path", { d: "m6 9 6 6 6-6" }]] as Node[]);

export const Columns3 = make([
  ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2" }],
  ["path", { d: "M9 3v18" }],
  ["path", { d: "M15 3v18" }]
] as Node[]);

export const Diamond = make([
  [
    "path",
    {
      d: "M2.7 10.3a2.41 2.41 0 0 0 0 3.41l7.59 7.59a2.41 2.41 0 0 0 3.41 0l7.59-7.59a2.41 2.41 0 0 0 0-3.41l-7.59-7.59a2.41 2.41 0 0 0-3.41 0Z"
    }
  ]
] as Node[]);

export const Eye = make([
  [
    "path",
    {
      d: "M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"
    }
  ],
  ["circle", { cx: "12", cy: "12", r: "3" }]
] as Node[]);

export const EyeOff = make([
  [
    "path",
    {
      d: "M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"
    }
  ],
  ["path", { d: "M14.084 14.158a3 3 0 0 1-4.242-4.242" }],
  [
    "path",
    {
      d: "M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"
    }
  ],
  ["path", { d: "m2 2 20 20" }]
] as Node[]);

export const Italic = make([
  ["line", { x1: "19", x2: "10", y1: "4", y2: "4" }],
  ["line", { x1: "14", x2: "5", y1: "20", y2: "20" }],
  ["line", { x1: "15", x2: "9", y1: "4", y2: "20" }]
] as Node[]);

export const Link = make([
  ["path", { d: "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" }],
  ["path", { d: "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" }]
] as Node[]);

export const MoveHorizontal = make([
  ["path", { d: "m18 8 4 4-4 4" }],
  ["path", { d: "M2 12h20" }],
  ["path", { d: "m6 8-4 4 4 4" }]
] as Node[]);

export const Pipette = make([
  [
    "path",
    {
      d: "m12 9-8.414 8.414A2 2 0 0 0 3 18.828v1.344a2 2 0 0 1-.586 1.414A2 2 0 0 1 3.828 21h1.344a2 2 0 0 0 1.414-.586L15 12"
    }
  ],
  [
    "path",
    {
      d: "m18 9 .4.4a1 1 0 1 1-3 3l-3.8-3.8a1 1 0 1 1 3-3l.4.4 3.4-3.4a1 1 0 1 1 3 3z"
    }
  ],
  ["path", { d: "m2 22 .414-.414" }]
] as Node[]);

export const RotateCcw = make([
  ["path", { d: "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" }],
  ["path", { d: "M3 3v5h5" }]
] as Node[]);

export const RotateCw = make([
  ["path", { d: "M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" }],
  ["path", { d: "M21 3v5h-5" }]
] as Node[]);

export const Rows3 = make([
  ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2" }],
  ["path", { d: "M21 9H3" }],
  ["path", { d: "M21 15H3" }]
] as Node[]);

export const Scissors = make([
  ["circle", { cx: "6", cy: "6", r: "3" }],
  ["path", { d: "M8.12 8.12 12 12" }],
  ["path", { d: "M20 4 8.12 15.88" }],
  ["circle", { cx: "6", cy: "18", r: "3" }],
  ["path", { d: "M14.8 14.8 20 20" }]
] as Node[]);

export const ScrollText = make([
  ["path", { d: "M15 12h-5" }],
  ["path", { d: "M15 8h-5" }],
  ["path", { d: "M19 17V5a2 2 0 0 0-2-2H4" }],
  [
    "path",
    {
      d: "M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3"
    }
  ]
] as Node[]);

export const Search = make([
  ["path", { d: "m21 21-4.34-4.34" }],
  ["circle", { cx: "11", cy: "11", r: "8" }]
] as Node[]);

export const Spline = make([
  ["circle", { cx: "19", cy: "5", r: "2" }],
  ["circle", { cx: "5", cy: "19", r: "2" }],
  ["path", { d: "M5 17A12 12 0 0 1 17 5" }]
] as Node[]);

export const Square = make([
  ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2" }]
] as Node[]);

export const SquareDashed = make([
  ["path", { d: "M5 3a2 2 0 0 0-2 2" }],
  ["path", { d: "M19 3a2 2 0 0 1 2 2" }],
  ["path", { d: "M21 19a2 2 0 0 1-2 2" }],
  ["path", { d: "M5 21a2 2 0 0 1-2-2" }],
  ["path", { d: "M9 3h1" }],
  ["path", { d: "M9 21h1" }],
  ["path", { d: "M14 3h1" }],
  ["path", { d: "M14 21h1" }],
  ["path", { d: "M3 9v1" }],
  ["path", { d: "M21 9v1" }],
  ["path", { d: "M3 14v1" }],
  ["path", { d: "M21 14v1" }]
] as Node[]);

export const Underline = make([
  ["path", { d: "M6 4v6a6 6 0 0 0 12 0V4" }],
  ["line", { x1: "4", x2: "20", y1: "20", y2: "20" }]
] as Node[]);

export const Unlink = make([
  [
    "path",
    {
      d: "m18.84 12.25 1.72-1.71h-.02a5.004 5.004 0 0 0-.12-7.07 5.006 5.006 0 0 0-6.95 0l-1.72 1.71"
    }
  ],
  [
    "path",
    {
      d: "m5.17 11.75-1.71 1.71a5.004 5.004 0 0 0 .12 7.07 5.006 5.006 0 0 0 6.95 0l1.71-1.71"
    }
  ],
  ["line", { x1: "8", x2: "8", y1: "2", y2: "5" }],
  ["line", { x1: "2", x2: "5", y1: "8", y2: "8" }],
  ["line", { x1: "16", x2: "16", y1: "19", y2: "22" }],
  ["line", { x1: "19", x2: "22", y1: "16", y2: "16" }]
] as Node[]);

export const Wand2 = make([
  [
    "path",
    {
      d: "m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72"
    }
  ],
  ["path", { d: "m14 7 3 3" }],
  ["path", { d: "M5 6v4" }],
  ["path", { d: "M19 14v4" }],
  ["path", { d: "M10 2v2" }],
  ["path", { d: "M7 8H3" }],
  ["path", { d: "M21 16h-4" }],
  ["path", { d: "M11 3H9" }]
] as Node[]);

export const WrapText = make([
  ["path", { d: "m16 16-3 3 3 3" }],
  ["path", { d: "M3 12h14.5a1 1 0 0 1 0 7H13" }],
  ["path", { d: "M3 19h6" }],
  ["path", { d: "M3 5h18" }]
] as Node[]);

export const X = make([
  ["path", { d: "M18 6 6 18" }],
  ["path", { d: "m6 6 12 12" }]
] as Node[]);
