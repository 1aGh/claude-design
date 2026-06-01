/**
 * @file       draw/serialize.ts — Phase 25 geometry-engine serializer
 * @scope      plugins/design/dev-server/draw/serialize.ts
 * @purpose    The dual serializer: ONE `DrawPrimitive[]` produces BOTH an
 *             optimized SVG string (`toSvg`) for on-disk assets AND a JSX string
 *             (`toJsx`) for inline canvas embedding. Both render the SAME
 *             intermediate node tree (`primitivesToNodes`), differing only in
 *             attribute dialect (`stroke-width`/`class` vs `strokeWidth`/
 *             `className`) and the `xmlns` document marker — so the on-disk SVG
 *             and the on-canvas JSX can never structurally drift. This is the
 *             exact single-source invariant `canvas-arrowheads.ts` enforces for
 *             arrows, generalized to the whole vocabulary.
 *
 *             a11y: `toSvg` injects `role="img"` + `<title>` + `<desc>`, keeps
 *             the `viewBox`, and defaults paint to `currentColor` so the mark
 *             inherits theme color (dark-mode / single-color flatten for free).
 *
 *             React-free (DDR-067) — `toJsx` returns a STRING, never a React
 *             element; this module imports nothing from react.
 */

import { CURRENT_COLOR } from './palette.ts';
import type { DrawPrimitive, DrawStyle, Point } from './primitives.ts';

export interface A11y {
  /** Accessible name; rendered as `<title>` + announced under `role="img"`. */
  title?: string;
  /** Long description; rendered as `<desc>`. */
  desc?: string;
  role?: string;
  /** Purely decorative: `aria-hidden`, no title/desc/role. */
  decorative?: boolean;
}

export interface SerializeOpts {
  viewBox: string;
  width?: number | string;
  height?: number | string;
  a11y?: A11y;
  /** Paint applied where a fillable shape declares neither fill nor stroke. */
  defaultColor?: string;
}

/** Dialect-neutral node — the single source both renderers consume. */
export interface SvgNode {
  tag: string;
  /** Ordered [logicalKey, value]. `logicalKey` maps to a dialect attr name. */
  attrs: Array<[string, string]>;
  children: SvgNode[];
  /** Raw text content (already a string; escaped at render time). */
  text?: string;
}

// Logical attr key → { svg, jsx } names. Keys absent here are identical in both
// dialects (x, y, width, height, cx, cy, r, rx, ry, x1, d, points, fill, stroke,
// opacity, transform, viewBox, id, href, role).
const ATTR_DIALECT: Record<string, { svg: string; jsx: string }> = {
  strokeWidth: { svg: 'stroke-width', jsx: 'strokeWidth' },
  strokeLinecap: { svg: 'stroke-linecap', jsx: 'strokeLinecap' },
  strokeLinejoin: { svg: 'stroke-linejoin', jsx: 'strokeLinejoin' },
  strokeDasharray: { svg: 'stroke-dasharray', jsx: 'strokeDasharray' },
  fillOpacity: { svg: 'fill-opacity', jsx: 'fillOpacity' },
  strokeOpacity: { svg: 'stroke-opacity', jsx: 'strokeOpacity' },
  fontSize: { svg: 'font-size', jsx: 'fontSize' },
  fontFamily: { svg: 'font-family', jsx: 'fontFamily' },
  fontWeight: { svg: 'font-weight', jsx: 'fontWeight' },
  textAnchor: { svg: 'text-anchor', jsx: 'textAnchor' },
  dominantBaseline: { svg: 'dominant-baseline', jsx: 'dominantBaseline' },
  letterSpacing: { svg: 'letter-spacing', jsx: 'letterSpacing' },
};

const CONTAINER_TAGS = new Set(['svg', 'g', 'defs', 'symbol', 'text', 'title', 'desc']);

function num(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return String(Math.round(n * 100) / 100); // floatPrecision: 2
}

function pointsStr(pts: Point[]): string {
  return pts.map((p) => `${num(p.x)},${num(p.y)}`).join(' ');
}

function dashValue(dash: boolean | number[], strokeWidth?: number): string | null {
  if (dash === false) return null;
  if (dash === true) {
    const w = strokeWidth ?? 1;
    return `${num(w * 3)} ${num(w * 2)}`;
  }
  if (Array.isArray(dash) && dash.length) return dash.map(num).join(' ');
  return null;
}

/**
 * Append `DrawStyle` attributes, resolving the `currentColor` / `fill="none"`
 * defaults so a stroked outline never gets an accidental black fill and a
 * paint-less shape inherits theme color.
 */
function pushStyle(
  attrs: Array<[string, string]>,
  s: DrawStyle,
  fillable: boolean,
  defaultColor: string
): void {
  const hasFill = s.fill !== undefined;
  const hasStroke = s.stroke !== undefined;

  if (fillable) {
    if (!hasFill && !hasStroke) {
      attrs.push(['fill', defaultColor]);
    } else if (!hasFill && hasStroke) {
      attrs.push(['fill', 'none']);
    } else if (hasFill) {
      attrs.push(['fill', s.fill as string]);
    }
  } else if (hasFill) {
    attrs.push(['fill', s.fill as string]);
  }

  if (hasStroke) attrs.push(['stroke', s.stroke as string]);
  else if (!fillable && !hasFill) attrs.push(['stroke', defaultColor]); // bare line → inherit

  if (s.strokeWidth !== undefined) attrs.push(['strokeWidth', num(s.strokeWidth)]);
  if (s.strokeLinecap) attrs.push(['strokeLinecap', s.strokeLinecap]);
  if (s.strokeLinejoin) attrs.push(['strokeLinejoin', s.strokeLinejoin]);
  if (s.opacity !== undefined) attrs.push(['opacity', num(s.opacity)]);
  if (s.fillOpacity !== undefined) attrs.push(['fillOpacity', num(s.fillOpacity)]);
  if (s.strokeOpacity !== undefined) attrs.push(['strokeOpacity', num(s.strokeOpacity)]);
  if (s.dash !== undefined) {
    const d = dashValue(s.dash, s.strokeWidth);
    if (d) attrs.push(['strokeDasharray', d]);
  }
  if (s.id !== undefined) attrs.push(['id', s.id]);
}

function primitiveToNode(p: DrawPrimitive, defaultColor: string): SvgNode {
  switch (p.el) {
    case 'rect': {
      const attrs: Array<[string, string]> = [
        ['x', num(p.x)],
        ['y', num(p.y)],
        ['width', num(p.width)],
        ['height', num(p.height)],
      ];
      if (p.rx !== undefined) attrs.push(['rx', num(p.rx)]);
      if (p.ry !== undefined) attrs.push(['ry', num(p.ry)]);
      pushStyle(attrs, p, true, defaultColor);
      return { tag: 'rect', attrs, children: [] };
    }
    case 'circle': {
      const attrs: Array<[string, string]> = [
        ['cx', num(p.cx)],
        ['cy', num(p.cy)],
        ['r', num(p.r)],
      ];
      pushStyle(attrs, p, true, defaultColor);
      return { tag: 'circle', attrs, children: [] };
    }
    case 'ellipse': {
      const attrs: Array<[string, string]> = [
        ['cx', num(p.cx)],
        ['cy', num(p.cy)],
        ['rx', num(p.rx)],
        ['ry', num(p.ry)],
      ];
      pushStyle(attrs, p, true, defaultColor);
      return { tag: 'ellipse', attrs, children: [] };
    }
    case 'line': {
      const attrs: Array<[string, string]> = [
        ['x1', num(p.x1)],
        ['y1', num(p.y1)],
        ['x2', num(p.x2)],
        ['y2', num(p.y2)],
      ];
      pushStyle(attrs, p, false, defaultColor);
      return { tag: 'line', attrs, children: [] };
    }
    case 'polyline': {
      const attrs: Array<[string, string]> = [['points', pointsStr(p.points)]];
      pushStyle(attrs, p, false, defaultColor);
      return { tag: 'polyline', attrs, children: [] };
    }
    case 'polygon': {
      const attrs: Array<[string, string]> = [['points', pointsStr(p.points)]];
      pushStyle(attrs, p, true, defaultColor);
      return { tag: 'polygon', attrs, children: [] };
    }
    case 'path': {
      const attrs: Array<[string, string]> = [['d', p.d]];
      pushStyle(attrs, p, true, defaultColor);
      return { tag: 'path', attrs, children: [] };
    }
    case 'text': {
      const attrs: Array<[string, string]> = [
        ['x', num(p.x)],
        ['y', num(p.y)],
      ];
      if (p.fontSize !== undefined) attrs.push(['fontSize', num(p.fontSize)]);
      if (p.fontFamily !== undefined) attrs.push(['fontFamily', p.fontFamily]);
      if (p.fontWeight !== undefined) attrs.push(['fontWeight', String(p.fontWeight)]);
      if (p.textAnchor !== undefined) attrs.push(['textAnchor', p.textAnchor]);
      if (p.dominantBaseline !== undefined) attrs.push(['dominantBaseline', p.dominantBaseline]);
      if (p.letterSpacing !== undefined) attrs.push(['letterSpacing', num(p.letterSpacing)]);
      pushStyle(attrs, p, true, defaultColor);
      return { tag: 'text', attrs, children: [], text: p.content };
    }
    case 'group': {
      const attrs: Array<[string, string]> = [];
      if (p.transform) attrs.push(['transform', p.transform]);
      if (p.opacity !== undefined) attrs.push(['opacity', num(p.opacity)]);
      if (p.id !== undefined) attrs.push(['id', p.id]);
      return { tag: 'g', attrs, children: p.children.map((c) => primitiveToNode(c, defaultColor)) };
    }
    case 'defs':
      return {
        tag: 'defs',
        attrs: [],
        children: p.children.map((c) => primitiveToNode(c, defaultColor)),
      };
    case 'symbol': {
      const attrs: Array<[string, string]> = [['id', p.id]];
      if (p.viewBox) attrs.push(['viewBox', p.viewBox]);
      return {
        tag: 'symbol',
        attrs,
        children: p.children.map((c) => primitiveToNode(c, defaultColor)),
      };
    }
    case 'use': {
      const attrs: Array<[string, string]> = [['href', p.href]];
      if (p.x !== undefined) attrs.push(['x', num(p.x)]);
      if (p.y !== undefined) attrs.push(['y', num(p.y)]);
      if (p.width !== undefined) attrs.push(['width', num(p.width)]);
      if (p.height !== undefined) attrs.push(['height', num(p.height)]);
      if (p.transform !== undefined) attrs.push(['transform', p.transform]);
      pushStyle(attrs, p, true, defaultColor);
      return { tag: 'use', attrs, children: [] };
    }
  }
}

/**
 * Build the dialect-neutral `<svg>` node tree both serializers render. Injects
 * the a11y nodes (`<title>`/`<desc>` or `aria-hidden`) and the root attributes.
 */
export function primitivesToNodes(primitives: DrawPrimitive[], opts: SerializeOpts): SvgNode {
  const defaultColor = opts.defaultColor ?? CURRENT_COLOR;
  const rootAttrs: Array<[string, string]> = [['viewBox', opts.viewBox]];
  if (opts.width !== undefined) rootAttrs.push(['width', String(opts.width)]);
  if (opts.height !== undefined) rootAttrs.push(['height', String(opts.height)]);

  const a11y = opts.a11y;
  const children: SvgNode[] = [];
  if (a11y?.decorative) {
    rootAttrs.push(['aria-hidden', 'true']);
  } else if (a11y && (a11y.title || a11y.desc)) {
    rootAttrs.push(['role', a11y.role ?? 'img']);
    if (a11y.title) children.push({ tag: 'title', attrs: [], children: [], text: a11y.title });
    if (a11y.desc) children.push({ tag: 'desc', attrs: [], children: [], text: a11y.desc });
  } else if (a11y?.role) {
    rootAttrs.push(['role', a11y.role]);
  }

  for (const p of primitives) children.push(primitiveToNode(p, defaultColor));
  return { tag: 'svg', attrs: rootAttrs, children };
}

// ─────────────────────────────────────────────────────────────────────────────
// Rendering
// ─────────────────────────────────────────────────────────────────────────────

type Dialect = 'svg' | 'jsx';

function attrName(key: string, dialect: Dialect): string {
  const mapped = ATTR_DIALECT[key];
  return mapped ? mapped[dialect] : key;
}

function escapeText(s: string, dialect: Dialect): string {
  let out = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // In JSX text, `{` / `}` open expression containers — neutralize them.
  if (dialect === 'jsx') out = out.replace(/\{/g, '&#123;').replace(/\}/g, '&#125;');
  return out;
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function renderNode(node: SvgNode, dialect: Dialect, indent: string): string {
  const pad = indent;
  const attrParts: string[] = [];

  if (node.tag === 'svg' && dialect === 'svg') {
    attrParts.push('xmlns="http://www.w3.org/2000/svg"');
  }
  for (const [key, value] of node.attrs) {
    attrParts.push(`${attrName(key, dialect)}="${escapeAttr(value)}"`);
  }
  const attrStr = attrParts.length ? ` ${attrParts.join(' ')}` : '';

  const isContainer = CONTAINER_TAGS.has(node.tag);
  const hasText = node.text !== undefined && node.text !== '';
  const hasChildren = node.children.length > 0;

  if (!isContainer && !hasText && !hasChildren) {
    return `${pad}<${node.tag}${attrStr} />`;
  }

  // Text-only leaf (text/title/desc) on a single line.
  if (hasText && !hasChildren) {
    return `${pad}<${node.tag}${attrStr}>${escapeText(node.text as string, dialect)}</${node.tag}>`;
  }

  const inner = node.children.map((c) => renderNode(c, dialect, `${pad}  `)).join('\n');
  const textLine = hasText ? `${pad}  ${escapeText(node.text as string, dialect)}\n` : '';
  return `${pad}<${node.tag}${attrStr}>\n${textLine}${inner}\n${pad}</${node.tag}>`;
}

/**
 * Serialize primitives to a complete, accessible SVG document string
 * (`xmlns` + `viewBox` + `role`/`<title>`/`<desc>`). Pair with
 * `optimize()` for the final on-disk asset.
 */
export function toSvg(primitives: DrawPrimitive[], opts: SerializeOpts): string {
  const root = primitivesToNodes(primitives, opts);
  return renderNode(root, 'svg', '');
}

/**
 * Serialize primitives to a JSX string for inline embedding into a canvas TSX
 * file (`strokeWidth`/`className` dialect, no `xmlns`). Structurally identical
 * to {@link toSvg} — same node tree, same shapes, same geometry.
 */
export function toJsx(primitives: DrawPrimitive[], opts: SerializeOpts): string {
  const root = primitivesToNodes(primitives, opts);
  return renderNode(root, 'jsx', '');
}
