#!/usr/bin/env node
// read-annotations.mjs — headless, zero-dep SVG → JSON annotation reader.
//
// Phase 22. The browser-side parser `svgToStrokes` (annotations-layer.tsx) needs
// a DOMParser, which plain Node does not expose. This is its headless cousin: it
// reads a canvas's `<slug>.annotations.svg` and extracts every sticky / text /
// shape as structured JSON the `/design:new` ingest path folds into a generation
// brief. It is a SEPARATE implementation (not an import) of the same fixed
// vocabulary `strokesToSvg` serializes — `read-annotations.test.ts` rebuilds
// strokes through the CANONICAL serializer and asserts this reader recovers them,
// so any drift in the SVG shape (Phase 21 / 23 / 24 …) fails that test loud.
//
// Regex-over-known-vocabulary, mirroring the discipline of `sanitizeAnnotationSvg`
// (api.ts) and the defensive defaults of `svgToStrokes`. We never DOM-parse.
//
// Output: a JSON array of `{ tool, id, x, y, w, h, text, color }`. Strokes that
// carry words (sticky, text) populate `text`; position-only strokes (pen, rect,
// ellipse, polygon, arrow) emit `text: null` with their bounding box. With
// `--canvas-state <path>` each annotation also gets `artboard: <id|null>` by bbox
// overlap. Forward-compat: an unknown `data-tool` (Phase 23 image/link) passes
// through with any `href`/`url`/`title` it carries, so a later ingest picks up
// dropped reference media without a reader change.
//
// Reached via `maude design read-annotations "<rel-path>"` (DDR-062), never a raw
// bin path. A missing annotation file is NOT an error — a board with no notes is
// valid; the reader emits `[]` and exits 0.
//
// Usage:
//   read-annotations.mjs <rel-path-relative-to-designRoot> [--root <repo>]
//                        [--canvas-state <path>] [--json]

import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// ─────────────────────────────────────────────────────────────────────────────
// Argv

function parseArgv(argv) {
  const out = { positional: [], root: null, canvasState: null, help: false, graph: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--help' || a === '-h') {
      out.help = true;
    } else if (a === '--json') {
      /* default — accepted for symmetry with other verbs */
    } else if (a === '--graph') {
      out.graph = true;
    } else if (a === '--root') {
      i += 1;
      out.root = argv[i];
    } else if (a.startsWith('--root=')) {
      out.root = a.slice('--root='.length);
    } else if (a === '--canvas-state') {
      i += 1;
      out.canvasState = argv[i];
    } else if (a.startsWith('--canvas-state=')) {
      out.canvasState = a.slice('--canvas-state='.length);
    } else {
      out.positional.push(a);
    }
  }
  return out;
}

const HELP = `read-annotations.mjs — headless SVG → JSON annotation reader (DDR-062 via \`maude design read-annotations\`)

Usage:
  maude design read-annotations <rel-path> [--root <repo>] [--canvas-state <path>]

Args:
  <rel-path>          Canvas path relative to the design root (e.g. "ui/Foo.tsx").
  --root <repo>       Repo root. Default: $CLAUDE_PROJECT_DIR, then cwd.
  --canvas-state <p>  JSON of artboard rects ([{id,x,y,w,h}] or {artboards:[…]});
                      each annotation is tagged with the artboard it overlaps,
                      plus artboard-relative coords (rel) and a W3C-style
                      target block { source, selector, geometry }.
  --graph             Emit { annotations, graph } instead of the bare array:
                      graph.edges = bound arrows (from/to host ids), graph.nodes
                      = the strokes those arrows connect (with labels) — a
                      bound flow diagram reads back as a graph.
  --json              No-op (JSON is the only output form).

FigJam v3 additive fields per annotation: z (render order), groupIds (deepest →
shallowest), author ("ai" for annotate-verb strokes), and from/to host ids on
bound arrows.

Emits JSON to stdout. A missing annotation file emits [] (exit 0).`;

// ─────────────────────────────────────────────────────────────────────────────
// Path + slug resolution — mirror the dev-server (api.ts fileSlug, context.ts
// designRoot). The annotation file is named by fileSlug(), so we recompute the
// SAME slug to find it.

function resolveDesignRoot(repoRoot) {
  // config.json is ALWAYS at <repoRoot>/.design/config.json; its optional
  // `designRoot` field (default ".design") is where canvases + annotation SVGs
  // actually live. (context.ts:64,226 — designRoot defaults to ".design".)
  let designRel = '.design';
  try {
    const cfg = JSON.parse(readFileSync(join(repoRoot, '.design', 'config.json'), 'utf8'));
    if (typeof cfg.designRoot === 'string' && cfg.designRoot.trim()) {
      designRel = cfg.designRoot.replace(/^\/+|\/+$/g, '');
    }
  } catch {
    /* no config — default .design */
  }
  return { designRel, designRoot: join(repoRoot, designRel) };
}

// Byte-for-byte the producer's rule (api.ts:266 fileSlug). The reader's input is
// design-root-relative, but we still strip a leading designRel/ prefix so a
// repo-root-relative path ("./design/ui/Foo.tsx") resolves to the same slug.
function fileSlug(file, designRel) {
  let p = String(file).replace(/^\/+|\/+$/g, '');
  try {
    p = decodeURIComponent(p);
  } catch {
    /* leave as-is */
  }
  const prefix = `${designRel.replace(/^\/+|\/+$/g, '')}/`;
  if (p.startsWith(prefix)) p = p.slice(prefix.length);
  return p
    .replace(/\//g, '-')
    .replace(/\s+/g, '_')
    .replace(/\.(tsx|html)$/i, '')
    .replace(/^\.+/, '')
    .toLowerCase();
}

// ─────────────────────────────────────────────────────────────────────────────
// Tiny SVG helpers — attribute pluck, entity-decode, number coerce.

function attr(s, name) {
  const re = new RegExp(
    `(?:^|\\s)${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*=\\s*"([^"]*)"`
  );
  const m = s.match(re);
  return m ? m[1] : null;
}

function hasAttr(s, name) {
  return attr(s, name) !== null;
}

// Reverse esc() (annotations-layer.tsx): &amp; / &quot; / &lt; are the only
// entities the serializer writes, but we decode the common set defensively.
// Named entities first, &amp; LAST so "&amp;lt;" (a literal "&lt;") survives.
function decodeEntities(s) {
  return String(s)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function num(v, d = 0) {
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : d;
}

function stripTags(s) {
  return String(s).replace(/<[^>]*>/g, '');
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-tool extraction.

function readText(attrs, inner) {
  const anchorId = attr(attrs, 'data-anchor-id');
  const standalone = !anchorId;
  const o = {
    tool: 'text',
    id: attr(attrs, 'data-id') || '',
    x: standalone ? num(attr(attrs, 'x')) : null,
    y: standalone ? num(attr(attrs, 'y')) : null,
    w: null,
    h: null,
    text: decodeEntities(inner).trim(),
    color: attr(attrs, 'fill') || attr(attrs, 'stroke') || null,
  };
  if (anchorId) o.anchorId = anchorId;
  return o;
}

// FigJam v3 — section container: geometry off the inner <rect>, label off
// data-label (the inner <text> is presentational chrome).
function readSection(attrs, inner) {
  const rectAttrs = inner.match(/<rect\b([^>]*?)\/?>/)?.[1] ?? '';
  return {
    tool: 'section',
    id: attr(attrs, 'data-id') || '',
    x: num(attr(rectAttrs, 'x')),
    y: num(attr(rectAttrs, 'y')),
    w: num(attr(rectAttrs, 'width')),
    h: num(attr(rectAttrs, 'height')),
    text: decodeEntities(attr(attrs, 'data-label') || ''),
    color: attr(attrs, 'fill') || null,
  };
}

function readSticky(attrs, inner) {
  // Geometry off the inner <rect>; paper tint off the group fill; body off the
  // inner <text>. (annotations-layer.tsx strokeToSvgEl 'sticky' branch.)
  const rectAttrs = inner.match(/<rect\b([^>]*?)\/?>/)?.[1] ?? '';
  const body = inner.match(/<text\b[^>]*>([\s\S]*?)<\/text>/)?.[1] ?? '';
  return {
    tool: 'sticky',
    id: attr(attrs, 'data-id') || '',
    x: num(attr(rectAttrs, 'x')),
    y: num(attr(rectAttrs, 'y')),
    w: num(attr(rectAttrs, 'width')),
    h: num(attr(rectAttrs, 'height')),
    text: decodeEntities(body).trim(),
    color: attr(attrs, 'fill') || null,
  };
}

// FigJam v3 — a bound endpoint persists as `data-(start|end)-bind="<hostId>
// <nx> <ny>"`. Malformed / out-of-range values are rejected (mirror of the
// canonical parser's clamp).
function parseBind(raw) {
  if (!raw) return null;
  const parts = String(raw).trim().split(/\s+/);
  if (parts.length !== 3) return null;
  const nx = Number.parseFloat(parts[1]);
  const ny = Number.parseFloat(parts[2]);
  if (!parts[0] || !Number.isFinite(nx) || !Number.isFinite(ny)) return null;
  if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return null;
  return { hostId: parts[0], nx, ny };
}

function readArrow(attrs, inner) {
  const id = attr(attrs, 'data-id') || '';
  const color = attr(attrs, 'stroke') || null;
  let ends = null;
  const lineAttrs = inner.match(/<line\b([^>]*?)\/?>/)?.[1];
  if (lineAttrs) {
    ends = {
      x1: num(attr(lineAttrs, 'x1')),
      y1: num(attr(lineAttrs, 'y1')),
      x2: num(attr(lineAttrs, 'x2')),
      y2: num(attr(lineAttrs, 'y2')),
    };
  } else {
    // Curved / elbow arrow persists a <path>; first + last coordinate pairs are
    // the endpoints (arrowEndpoints in annotations-layer.tsx).
    const d = inner.match(/<path\b([^>]*?)\/?>/)?.[1];
    const nums = d ? (attr(d, 'd') || '').match(/-?\d+(?:\.\d+)?/g) : null;
    if (nums && nums.length >= 4) {
      ends = {
        x1: num(nums[0]),
        y1: num(nums[1]),
        x2: num(nums[nums.length - 2]),
        y2: num(nums[nums.length - 1]),
      };
    }
  }
  if (!ends) return { tool: 'arrow', id, x: null, y: null, w: null, h: null, text: null, color };
  return {
    tool: 'arrow',
    id,
    x: Math.min(ends.x1, ends.x2),
    y: Math.min(ends.y1, ends.y2),
    w: Math.abs(ends.x2 - ends.x1),
    h: Math.abs(ends.y2 - ends.y1),
    text: null,
    color,
  };
}

function bboxFromNums(nums) {
  let xMin = Number.POSITIVE_INFINITY;
  let yMin = Number.POSITIVE_INFINITY;
  let xMax = Number.NEGATIVE_INFINITY;
  let yMax = Number.NEGATIVE_INFINITY;
  for (let i = 0; i + 1 < nums.length; i += 2) {
    const px = num(nums[i]);
    const py = num(nums[i + 1]);
    if (px < xMin) xMin = px;
    if (px > xMax) xMax = px;
    if (py < yMin) yMin = py;
    if (py > yMax) yMax = py;
  }
  if (!Number.isFinite(xMin)) return null;
  return { x: xMin, y: yMin, w: xMax - xMin, h: yMax - yMin };
}

function readPen(attrs) {
  const id = attr(attrs, 'data-id') || '';
  const color = attr(attrs, 'stroke') || null;
  const bb = bboxFromNums((attr(attrs, 'd') || '').match(/-?\d+(?:\.\d+)?/g) || []);
  if (!bb) return { tool: 'pen', id, x: null, y: null, w: null, h: null, text: null, color };
  return { tool: 'pen', id, ...bb, text: null, color };
}

function readRect(attrs) {
  return {
    tool: 'rect',
    id: attr(attrs, 'data-id') || '',
    x: num(attr(attrs, 'x')),
    y: num(attr(attrs, 'y')),
    w: num(attr(attrs, 'width')),
    h: num(attr(attrs, 'height')),
    text: null,
    color: attr(attrs, 'stroke') || null,
  };
}

function readEllipse(attrs) {
  const cx = num(attr(attrs, 'cx'));
  const cy = num(attr(attrs, 'cy'));
  const rx = num(attr(attrs, 'rx'));
  const ry = num(attr(attrs, 'ry'));
  return {
    tool: 'ellipse',
    id: attr(attrs, 'data-id') || '',
    x: cx - rx,
    y: cy - ry,
    w: rx * 2,
    h: ry * 2,
    text: null,
    color: attr(attrs, 'stroke') || null,
  };
}

function readPolygon(attrs) {
  const id = attr(attrs, 'data-id') || '';
  const color = attr(attrs, 'stroke') || null;
  const nums = (attr(attrs, 'points') || '').match(/-?\d+(?:\.\d+)?/g) || [];
  const bb = bboxFromNums(nums);
  if (!bb) return { tool: 'polygon', id, x: null, y: null, w: null, h: null, text: null, color };
  return { tool: 'polygon', id, ...bb, text: null, color };
}

// Forward-compat (Phase 23) — an unknown data-tool (image / link chip) passes
// through with whatever geometry + media attrs it carries.
function readUnknown(tool, attrs, inner) {
  const text = inner
    ? decodeEntities(stripTags(inner)).trim() || null
    : attr(attrs, 'data-text')
      ? decodeEntities(attr(attrs, 'data-text'))
      : null;
  const o = {
    tool,
    id: attr(attrs, 'data-id') || '',
    x: hasAttr(attrs, 'x') ? num(attr(attrs, 'x')) : null,
    y: hasAttr(attrs, 'y') ? num(attr(attrs, 'y')) : null,
    w: hasAttr(attrs, 'width') ? num(attr(attrs, 'width')) : null,
    h: hasAttr(attrs, 'height') ? num(attr(attrs, 'height')) : null,
    text,
    color: attr(attrs, 'fill') || attr(attrs, 'stroke') || null,
  };
  const href = attr(attrs, 'href') || attr(attrs, 'xlink:href');
  const url = attr(attrs, 'data-url');
  const title = attr(attrs, 'data-title');
  if (href) o.href = href;
  if (url) o.url = url;
  if (title) o.title = decodeEntities(title);
  return o;
}

// ─────────────────────────────────────────────────────────────────────────────
// Top-level element walk. The annotation vocabulary nests at most one level —
// sticky/arrow are <g> wrapping leaf primitives, text wraps only character data,
// and NO container nests inside the same container — so a non-greedy backref
// match recovers each top-level element in document order. (Task-2 drift guard
// keeps this invariant honest against the canonical serializer.)
// FigJam v3 — shared root attrs every tool can carry: group membership,
// provenance, render order (z = document position). Applied uniformly after
// the per-tool extraction; arrows additionally surface bound endpoints as
// `from`/`to` host ids so a bound diagram reads back as a GRAPH.
function withShared(o, attrs, z) {
  o.z = z;
  const g = attr(attrs, 'data-group-ids');
  if (g) {
    const ids = g.split(/\s+/).filter(Boolean);
    if (ids.length) o.groupIds = ids;
  }
  if (attr(attrs, 'data-author') === 'ai') o.author = 'ai';
  if (o.tool === 'arrow') {
    const sb = parseBind(attr(attrs, 'data-start-bind'));
    if (sb) o.from = sb.hostId;
    const eb = parseBind(attr(attrs, 'data-end-bind'));
    if (eb) o.to = eb.hostId;
  }
  return o;
}

function parseAnnotations(svg) {
  const out = [];
  if (!svg || !/<svg[\s>]/i.test(svg)) return out;
  const re =
    /<(g|text)\b([^>]*)>([\s\S]*?)<\/\1>|<(path|rect|ellipse|polygon|image)\b([^>]*?)\/?>/g;
  let m = re.exec(svg);
  while (m !== null) {
    if (m[1]) {
      const attrs = m[2];
      const inner = m[3];
      const tool = attr(attrs, 'data-tool');
      if (tool === 'sticky') out.push(withShared(readSticky(attrs, inner), attrs, out.length));
      else if (tool === 'section')
        out.push(withShared(readSection(attrs, inner), attrs, out.length));
      else if (tool === 'arrow') out.push(withShared(readArrow(attrs, inner), attrs, out.length));
      else if (tool === 'text') out.push(withShared(readText(attrs, inner), attrs, out.length));
      else if (tool) out.push(withShared(readUnknown(tool, attrs, inner), attrs, out.length));
    } else {
      const attrs = m[5];
      const tool = attr(attrs, 'data-tool');
      if (tool === 'pen') out.push(withShared(readPen(attrs), attrs, out.length));
      else if (tool === 'rect') out.push(withShared(readRect(attrs), attrs, out.length));
      else if (tool === 'ellipse') out.push(withShared(readEllipse(attrs), attrs, out.length));
      else if (tool === 'polygon') out.push(withShared(readPolygon(attrs), attrs, out.length));
      else if (tool) out.push(withShared(readUnknown(tool, attrs, ''), attrs, out.length));
    }
    m = re.exec(svg);
  }
  return out;
}

// FigJam v3 — derive the node/edge view of a bound diagram. Edges are arrows
// with at least one bound end; nodes are the strokes those arrows reference,
// labelled by their own text or by anchored text targeting them.
function buildGraph(annotations) {
  const edges = [];
  for (const a of annotations) {
    if (a.tool === 'arrow' && (a.from || a.to)) {
      edges.push({ id: a.id, from: a.from ?? null, to: a.to ?? null });
    }
  }
  const refIds = new Set();
  for (const e of edges) {
    if (e.from) refIds.add(e.from);
    if (e.to) refIds.add(e.to);
  }
  const labelByAnchor = new Map();
  for (const a of annotations) {
    if (a.tool === 'text' && a.anchorId && a.text) labelByAnchor.set(a.anchorId, a.text);
  }
  const nodes = annotations
    .filter((a) => refIds.has(a.id))
    .map((a) => ({
      id: a.id,
      tool: a.tool,
      label: a.text || labelByAnchor.get(a.id) || null,
      x: a.x,
      y: a.y,
      w: a.w,
      h: a.h,
      artboard: a.artboard ?? null,
    }));
  return { nodes, edges };
}

// ─────────────────────────────────────────────────────────────────────────────
// --canvas-state artboard overlap tagging.

function loadArtboards(p) {
  try {
    const raw = JSON.parse(readFileSync(p, 'utf8'));
    const arr = Array.isArray(raw)
      ? raw
      : Array.isArray(raw.artboards)
        ? raw.artboards
        : Array.isArray(raw.layout?.artboards)
          ? raw.layout.artboards
          : [];
    return arr.filter(
      (r) => r && typeof r.id === 'string' && [r.x, r.y, r.w, r.h].every((n) => Number.isFinite(n))
    );
  } catch {
    return [];
  }
}

function findArtboard(ann, artboards) {
  if (ann.x == null || ann.y == null) return null;
  const ax2 = ann.x + (ann.w || 0);
  const ay2 = ann.y + (ann.h || 0);
  for (const r of artboards) {
    const rx2 = r.x + r.w;
    const ry2 = r.y + r.h;
    if (ann.x <= rx2 && ax2 >= r.x && ann.y <= ry2 && ay2 >= r.y) return r;
  }
  return null;
}

function tagArtboard(ann, artboards) {
  return findArtboard(ann, artboards)?.id ?? null;
}

/**
 * FigJam v3 — anchor an annotation to its artboard for AI consumers: the
 * overlapping artboard id, artboard-RELATIVE coords (what survives an artboard
 * move), and a W3C Web-Annotation-style target (anchor by stable id first,
 * geometry as the refinement/fallback).
 */
function anchorToArtboard(ann, artboards) {
  const r = findArtboard(ann, artboards);
  if (!r) return { ...ann, artboard: null };
  return {
    ...ann,
    artboard: r.id,
    rel: ann.x != null ? { x: ann.x - r.x, y: ann.y - r.y } : null,
    target: {
      source: r.id,
      selector: { type: 'AnnotationIdSelector', value: ann.id },
      geometry: ann.x != null ? { x: ann.x, y: ann.y, w: ann.w ?? 0, h: ann.h ?? 0 } : null,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main

function main() {
  const args = parseArgv(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(`${HELP}\n`);
    return;
  }
  const relPath = args.positional[0];
  if (!relPath) {
    process.stderr.write(`read-annotations: missing <rel-path>.\n\n${HELP}\n`);
    process.exit(2);
  }

  const repoRoot = args.root
    ? resolve(args.root)
    : process.env.CLAUDE_PROJECT_DIR
      ? resolve(process.env.CLAUDE_PROJECT_DIR)
      : process.cwd();

  const { designRel, designRoot } = resolveDesignRoot(repoRoot);
  const slug = fileSlug(relPath, designRel);
  const svgPath = join(designRoot, `${slug}.annotations.svg`);

  let svg = '';
  if (existsSync(svgPath)) {
    try {
      svg = readFileSync(svgPath, 'utf8');
    } catch {
      svg = '';
    }
  }

  let annotations = parseAnnotations(svg);

  if (args.canvasState) {
    const csPath = isAbsolute(args.canvasState)
      ? args.canvasState
      : resolve(process.cwd(), args.canvasState);
    const artboards = loadArtboards(csPath);
    if (artboards.length) {
      annotations = annotations.map((a) => anchorToArtboard(a, artboards));
    }
  }

  if (args.graph) {
    process.stdout.write(`${JSON.stringify({ annotations, graph: buildGraph(annotations) })}\n`);
    return;
  }
  process.stdout.write(`${JSON.stringify(annotations)}\n`);
}

// FigJam v3 — the parsing core is importable (the `annotate` write verb reuses
// it for host-geometry lookups); main() runs only when invoked as a script.
export { buildGraph, fileSlug, loadArtboards, parseAnnotations, resolveDesignRoot, tagArtboard };

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) main();
