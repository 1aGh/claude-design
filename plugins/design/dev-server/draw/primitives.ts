/**
 * @file       draw/primitives.ts — Phase 25 geometry-engine primitive layer
 * @scope      plugins/design/dev-server/draw/primitives.ts
 * @purpose    The `DrawPrimitive` union + grid-snapped constructors + transform
 *             composition + viewBox presets. This is the "intent" layer the
 *             draw-agent emits: the LLM names shapes and where they go; the
 *             constructors here produce exact, structured primitives that the
 *             serializer (`serialize.ts`) turns into BOTH an SVG string and JSX
 *             from the SAME source — so on-disk and on-canvas forms can never
 *             drift. This generalizes `canvas-arrowheads.ts`'s `SvgPrimitive`
 *             reducer pattern to the full drawing vocabulary.
 *
 *             Back-compat note: this is a superset of the arrow `SvgPrimitive`
 *             (line / path / polyline / polygon / circle) extended with rect,
 *             ellipse, text, group, use, symbol + a shared `DrawStyle`.
 *
 *             DEPENDENCY RULE (DDR-067): this module imports NOTHING from react
 *             or any `.tsx`. JSX rendering lives ONLY in `serialize.ts#toJsx`,
 *             which produces a JSX *string*, never a React element. A `.ts`
 *             root in a re-export cycle with a react `.tsx` breaks
 *             @types/react's global `JSX` namespace under this tsconfig's
 *             `types: ["bun-types"]` — keep the dependency one-way.
 */

/** A 2-D point in viewBox user units. */
export interface Point {
  x: number;
  y: number;
}

/**
 * Presentation attributes shared by every drawable primitive. Geometry lives on
 * the primitive itself; everything paint-related lives here so a single style
 * shape feeds every element kind. Names are canonical (camelCase); the
 * serializer maps them to `stroke-width` (SVG) vs `strokeWidth` (JSX).
 *
 * `dash` accepts `true` (a sensible default dash pattern), a number array
 * (explicit `stroke-dasharray`), or is omitted for a solid stroke — mirroring
 * the arrow `dash: boolean` field while allowing richer patterns.
 */
export interface DrawStyle {
  /** Fill paint. Omit to let the serializer default to `currentColor`. */
  fill?: string;
  /** `'none'` for an unfilled outline shape. */
  stroke?: string;
  strokeWidth?: number;
  strokeLinecap?: 'butt' | 'round' | 'square';
  strokeLinejoin?: 'miter' | 'round' | 'bevel';
  /** Element-wide opacity (0–1). */
  opacity?: number;
  fillOpacity?: number;
  strokeOpacity?: number;
  /** Solid (omitted/false), default dashes (true), or explicit pattern. */
  dash?: boolean | number[];
  /** Optional id (for `<use href>` targets, testing hooks, a11y). */
  id?: string;
}

/** Text-specific attributes layered on top of {@link DrawStyle}. */
export interface TextAttrs {
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: number | string;
  textAnchor?: 'start' | 'middle' | 'end';
  dominantBaseline?: 'auto' | 'middle' | 'central' | 'hanging' | 'text-after-edge';
  letterSpacing?: number;
}

/**
 * The full drawing vocabulary. Every variant carries `el` as its discriminant
 * (matching the `SvgPrimitive` convention) plus geometry, plus an inlined
 * {@link DrawStyle}. Containers (`group`, `defs`, `symbol`) nest children.
 */
export type DrawPrimitive =
  | ({
      el: 'rect';
      x: number;
      y: number;
      width: number;
      height: number;
      rx?: number;
      ry?: number;
    } & DrawStyle)
  | ({ el: 'circle'; cx: number; cy: number; r: number } & DrawStyle)
  | ({ el: 'ellipse'; cx: number; cy: number; rx: number; ry: number } & DrawStyle)
  | ({ el: 'line'; x1: number; y1: number; x2: number; y2: number } & DrawStyle)
  | ({ el: 'polyline'; points: Point[] } & DrawStyle)
  | ({ el: 'polygon'; points: Point[] } & DrawStyle)
  | ({ el: 'path'; d: string } & DrawStyle)
  | ({ el: 'text'; x: number; y: number; content: string } & TextAttrs & DrawStyle)
  | ({ el: 'group'; children: DrawPrimitive[]; transform?: string } & Pick<
      DrawStyle,
      'opacity' | 'id'
    >)
  | { el: 'defs'; children: DrawPrimitive[] }
  | { el: 'symbol'; id: string; children: DrawPrimitive[]; viewBox?: string }
  | ({
      el: 'use';
      href: string;
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      transform?: string;
    } & DrawStyle);

// ─────────────────────────────────────────────────────────────────────────────
// Grid snapping
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Snap a coordinate to a grid. `grid <= 0` (the default) is a no-op so optical
 * adjustments survive; pass `grid: 1` for pixel-snapping, `4`/`8` for the
 * spacing scale. Rounds half-up, deterministic (no `Math.random`).
 */
export function snap(value: number, grid = 0): number {
  if (!grid || grid <= 0) return value;
  return Math.round(value / grid) * grid;
}

function snapPoint(p: Point, grid: number): Point {
  return { x: snap(p.x, grid), y: snap(p.y, grid) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Constructors — each accepts geometry + style + an optional `grid` to snap.
// The `grid` field is stripped from the emitted primitive (it's a build-time
// instruction, not an SVG attribute).
// ─────────────────────────────────────────────────────────────────────────────

type WithGrid<T> = T & { grid?: number };

function styleOf<T extends DrawStyle>(o: T): DrawStyle {
  const s: DrawStyle = {};
  if (o.fill !== undefined) s.fill = o.fill;
  if (o.stroke !== undefined) s.stroke = o.stroke;
  if (o.strokeWidth !== undefined) s.strokeWidth = o.strokeWidth;
  if (o.strokeLinecap !== undefined) s.strokeLinecap = o.strokeLinecap;
  if (o.strokeLinejoin !== undefined) s.strokeLinejoin = o.strokeLinejoin;
  if (o.opacity !== undefined) s.opacity = o.opacity;
  if (o.fillOpacity !== undefined) s.fillOpacity = o.fillOpacity;
  if (o.strokeOpacity !== undefined) s.strokeOpacity = o.strokeOpacity;
  if (o.dash !== undefined) s.dash = o.dash;
  if (o.id !== undefined) s.id = o.id;
  return s;
}

export function rect(
  o: WithGrid<
    { x: number; y: number; width: number; height: number; rx?: number; ry?: number } & DrawStyle
  >
): DrawPrimitive {
  const g = o.grid ?? 0;
  const out: DrawPrimitive = {
    el: 'rect',
    x: snap(o.x, g),
    y: snap(o.y, g),
    width: snap(o.width, g),
    height: snap(o.height, g),
    ...styleOf(o),
  };
  if (o.rx !== undefined) (out as { rx?: number }).rx = snap(o.rx, g);
  if (o.ry !== undefined) (out as { ry?: number }).ry = snap(o.ry, g);
  return out;
}

export function circle(
  o: WithGrid<{ cx: number; cy: number; r: number } & DrawStyle>
): DrawPrimitive {
  const g = o.grid ?? 0;
  return { el: 'circle', cx: snap(o.cx, g), cy: snap(o.cy, g), r: snap(o.r, g), ...styleOf(o) };
}

export function ellipse(
  o: WithGrid<{ cx: number; cy: number; rx: number; ry: number } & DrawStyle>
): DrawPrimitive {
  const g = o.grid ?? 0;
  return {
    el: 'ellipse',
    cx: snap(o.cx, g),
    cy: snap(o.cy, g),
    rx: snap(o.rx, g),
    ry: snap(o.ry, g),
    ...styleOf(o),
  };
}

export function line(
  o: WithGrid<{ x1: number; y1: number; x2: number; y2: number } & DrawStyle>
): DrawPrimitive {
  const g = o.grid ?? 0;
  return {
    el: 'line',
    x1: snap(o.x1, g),
    y1: snap(o.y1, g),
    x2: snap(o.x2, g),
    y2: snap(o.y2, g),
    ...styleOf(o),
  };
}

export function polyline(o: WithGrid<{ points: Point[] } & DrawStyle>): DrawPrimitive {
  const g = o.grid ?? 0;
  return { el: 'polyline', points: o.points.map((p) => snapPoint(p, g)), ...styleOf(o) };
}

export function polygon(o: WithGrid<{ points: Point[] } & DrawStyle>): DrawPrimitive {
  const g = o.grid ?? 0;
  return { el: 'polygon', points: o.points.map((p) => snapPoint(p, g)), ...styleOf(o) };
}

export function path(o: { d: string } & DrawStyle): DrawPrimitive {
  return { el: 'path', d: o.d, ...styleOf(o) };
}

export function text(
  o: WithGrid<{ x: number; y: number; content: string } & TextAttrs & DrawStyle>
): DrawPrimitive {
  const g = o.grid ?? 0;
  const t: DrawPrimitive = {
    el: 'text',
    x: snap(o.x, g),
    y: snap(o.y, g),
    content: o.content,
    ...styleOf(o),
  };
  const attrs = t as TextAttrs;
  if (o.fontSize !== undefined) attrs.fontSize = o.fontSize;
  if (o.fontFamily !== undefined) attrs.fontFamily = o.fontFamily;
  if (o.fontWeight !== undefined) attrs.fontWeight = o.fontWeight;
  if (o.textAnchor !== undefined) attrs.textAnchor = o.textAnchor;
  if (o.dominantBaseline !== undefined) attrs.dominantBaseline = o.dominantBaseline;
  if (o.letterSpacing !== undefined) attrs.letterSpacing = o.letterSpacing;
  return t;
}

export function group(
  children: DrawPrimitive[],
  o: { transform?: string; opacity?: number; id?: string } = {}
): DrawPrimitive {
  const out: DrawPrimitive = { el: 'group', children };
  if (o.transform !== undefined) (out as { transform?: string }).transform = o.transform;
  if (o.opacity !== undefined) (out as { opacity?: number }).opacity = o.opacity;
  if (o.id !== undefined) (out as { id?: string }).id = o.id;
  return out;
}

export function defs(children: DrawPrimitive[]): DrawPrimitive {
  return { el: 'defs', children };
}

export function symbol(id: string, children: DrawPrimitive[], viewBox?: string): DrawPrimitive {
  const out: DrawPrimitive = { el: 'symbol', id, children };
  if (viewBox !== undefined) (out as { viewBox?: string }).viewBox = viewBox;
  return out;
}

export function use(
  o: {
    href: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    transform?: string;
  } & DrawStyle
): DrawPrimitive {
  const out = { el: 'use' as const, href: o.href, ...styleOf(o) } as DrawPrimitive & {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    transform?: string;
  };
  if (o.x !== undefined) out.x = o.x;
  if (o.y !== undefined) out.y = o.y;
  if (o.width !== undefined) out.width = o.width;
  if (o.height !== undefined) out.height = o.height;
  if (o.transform !== undefined) out.transform = o.transform;
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Transform composition
// ─────────────────────────────────────────────────────────────────────────────

export interface PlaceOpts {
  x?: number;
  y?: number;
  scale?: number;
  /** Degrees, clockwise (SVG convention). */
  rotate?: number;
  /** Rotation pivot (defaults to the local origin). */
  originX?: number;
  originY?: number;
}

/** Round transform numbers to avoid `0.30000000000000004`-style noise. */
function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 1e4) / 1e4);
}

/**
 * Build an SVG `transform` string in the canonical order
 * `translate → rotate → scale`. Each part is emitted only when it's non-identity
 * so trivial placements stay clean. Deterministic; no floating noise.
 */
export function transformString(o: PlaceOpts): string {
  const parts: string[] = [];
  const x = o.x ?? 0;
  const y = o.y ?? 0;
  if (x !== 0 || y !== 0) parts.push(`translate(${fmt(x)} ${fmt(y)})`);
  if (o.rotate) {
    if (o.originX !== undefined || o.originY !== undefined) {
      parts.push(`rotate(${fmt(o.rotate)} ${fmt(o.originX ?? 0)} ${fmt(o.originY ?? 0)})`);
    } else {
      parts.push(`rotate(${fmt(o.rotate)})`);
    }
  }
  const s = o.scale ?? 1;
  if (s !== 1) parts.push(`scale(${fmt(s)})`);
  return parts.join(' ');
}

/**
 * Compose a sub-drawing by wrapping it in a `<g transform=…>`. The single
 * highest-leverage composition primitive: parts are authored once at the origin
 * and *placed* — no manual coordinate arithmetic, which is exactly the LLM
 * failure mode (coordinate drift) the engine removes.
 */
export function place(part: DrawPrimitive[], opts: PlaceOpts): DrawPrimitive {
  return group(part, { transform: transformString(opts) });
}

// ─────────────────────────────────────────────────────────────────────────────
// viewBox presets
// ─────────────────────────────────────────────────────────────────────────────

/** A canonical square viewBox `0 0 n n`. */
export function squareViewBox(n: number): string {
  return `0 0 ${n} ${n}`;
}

/** An arbitrary `0 0 w h` viewBox. */
export function boxViewBox(w: number, h: number): string {
  return `0 0 ${w} ${h}`;
}

/**
 * Common viewBox presets. `icon` = the 24-grid Material/Lucide standard;
 * `iconLg` = 48-grid; `logo` = 64-grid lockup; `social` = wide marketing card.
 */
export const VIEWBOX = {
  icon: squareViewBox(24),
  iconLg: squareViewBox(48),
  logo: squareViewBox(64),
  social: boxViewBox(1200, 630),
} as const;
