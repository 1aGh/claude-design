#!/usr/bin/env bun
// annotate.mjs — the AI annotation WRITE verb (FigJam v3).
//
// `read-annotations` made the annotation layer machine-READABLE; this verb
// closes the loop: an AI agent (or any tool) creates stickies, labelled
// shapes, BOUND connectors, groups — or a whole auto-laid-out flow diagram —
// through a typed ops vocabulary (never raw SVG). Everything renders through
// the CANONICAL serializer (`annotations-model.ts` — the same code the canvas
// uses) and passes the same allowlist sanitizer before a byte is written, so
// the verb can never emit a shape the canvas wouldn't.
//
// Runs under Bun (the .sh wrapper enforces it) because the model is TS.
//
// Write path: when `<designRoot>/_server.json` points at a live dev-server the
// merged SVG goes through `PUT /_api/annotations` — the server sanitizes,
// persists, and broadcasts through the collab bridge so every open canvas
// updates in real time. With no server, the file is written directly (already
// sanitized). Either way the result is LWW over the whole SVG — the same
// trade-off the canvas itself has (documented; agents should read-then-write).
//
// Every created stroke is stamped `data-author="ai"` (provenance) and the
// verb prints a ref → id map so a follow-up call can target what it made.
// AI writes never enter any user's local undo stack (they arrive over the
// sync channel, not through the canvas's commitStrokes).
//
// Reached via `maude design annotate` (DDR-062), never a raw bin path.
//
// Usage:
//   maude design annotate <rel-path> [--ops <file|->] [--flow <file|->]
//                         [--near <artboardId>] [--canvas-state <path>]
//                         [--root <repo>] [--dry-run]
//
// Ops JSON (--ops / stdin):
//   { "ops": [
//     { "op": "create", "type": "sticky", "ref": "@a", "text": "…",
//       "x"?, "y"?, "w"?, "h"?, "color"? },
//     { "op": "create", "type": "text", "text": "…", "x"?, "y"?, "fontSize"? },
//     { "op": "create", "type": "shape", "shape": "rect|rounded|ellipse|diamond|triangle|triangle-down",
//       "ref"?, "label"?, "x"?, "y"?, "w"?, "h"?, "color"?, "fill"? },
//     { "op": "create", "type": "arrow", "x1", "y1", "x2", "y2" },
//     { "op": "connect", "from": "<id|@ref>", "to": "<id|@ref>", "label"? },
//     { "op": "group", "ids": ["<id|@ref>", …] },
//     { "op": "delete", "id": "<id>" }
//   ] }
//
// Flow JSON (--flow): { "nodes": [{ "id", "label", "shape"? }],
//                       "edges": [{ "from", "to", "label"? }] }
// Nodes are auto-laid-out left→right by dependency layer and connected with
// BOUND arrows, so `read-annotations --graph` reads the diagram back as the
// same graph.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';

import { anchorPoint, facingAnchor } from '../annotations-bindings.ts';
import {
  DEFAULT_COLOR,
  DEFAULT_FONT_SIZE,
  DEFAULT_SECTION_COLOR,
  DEFAULT_STICKY_COLOR,
  gid,
  rid,
  SECTION_DEFAULT_H,
  SECTION_DEFAULT_W,
  STICKY_CORNER_RADIUS,
  STICKY_DEFAULT_H,
  STICKY_DEFAULT_W,
  sanitizeAnnotationSvg,
  strokeToSvgEl,
} from '../annotations-model.ts';
import {
  fileSlug,
  loadArtboards,
  parseAnnotations,
  resolveDesignRoot,
} from './read-annotations.mjs';

// Mirrors MAX_ANNOTATIONS_BYTES (sync/codec.ts) — kept literal here so the bin
// stays import-light; the server enforces the same cap on the PUT path anyway.
const MAX_ANNOTATIONS_BYTES = 1024 * 1024;

const SVG_HEADER = '<svg xmlns="http://www.w3.org/2000/svg" data-mdcc-annotations="1">';

// Flow-node visual defaults — the blue ink + paired tint read on light AND
// dark canvases (the verb cannot know the viewer's theme).
const NODE_INK = '#3b82f6';
const NODE_FILL = '#e0ebfd';
const TEXT_INK = '#1a1a1a';
const NODE_W = 180;
const NODE_H = 80;
const FLOW_GAP_X = 100;
const FLOW_GAP_Y = 60;

const HELP = `annotate.mjs — AI annotation WRITE verb (DDR-062 via \`maude design annotate\`)

Usage:
  maude design annotate <rel-path> [--ops <file|->] [--flow <file|->]
                        [--near <artboardId>] [--canvas-state <path>]
                        [--root <repo>] [--dry-run]

Args:
  <rel-path>          Canvas path relative to the design root (e.g. "ui/Foo.tsx").
  --ops <file|->      Ops JSON ({ ops: [...] }); "-" or omitted = stdin.
  --flow <file|->     Flow JSON ({ nodes, edges }) — auto-laid-out diagram of
                      bound connectors. Mutually exclusive with --ops.
  --near <artboard>   With --canvas-state: place the flow beside this artboard.
  --canvas-state <p>  Artboard rects JSON (same shape read-annotations takes).
  --root <repo>       Repo root. Default: $CLAUDE_PROJECT_DIR, then cwd.
  --dry-run           Print the merged SVG to stdout instead of writing.

Ops vocabulary: create (sticky | text | shape | arrow) · connect (bound arrow
between hosts, by id or @ref) · group · delete. Created strokes carry
data-author="ai" and fresh ids; the verb prints { ok, via, file, refs }.

The write is last-write-wins over the whole SVG — read before you write.`;

// ─────────────────────────────────────────────────────────────────────────────
// Argv

function parseArgv(argv) {
  const out = {
    positional: [],
    ops: null,
    flow: null,
    near: null,
    canvasState: null,
    root: null,
    dryRun: false,
    help: false,
  };
  const VALUE_FLAGS = {
    '--ops': 'ops',
    '--flow': 'flow',
    '--near': 'near',
    '--canvas-state': 'canvasState',
    '--root': 'root',
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const eq = a.indexOf('=');
    const flagKey = eq > 0 ? a.slice(0, eq) : a;
    if (a === '--help' || a === '-h') {
      out.help = true;
    } else if (a === '--dry-run') {
      out.dryRun = true;
    } else if (flagKey in VALUE_FLAGS) {
      if (eq > 0) {
        out[VALUE_FLAGS[flagKey]] = a.slice(eq + 1);
      } else {
        i += 1;
        out[VALUE_FLAGS[flagKey]] = argv[i];
      }
    } else {
      out.positional.push(a);
    }
  }
  return out;
}

function fail(msg, code = 1) {
  process.stderr.write(`annotate: ${msg}\n`);
  process.exit(code);
}

function readInput(spec) {
  if (!spec || spec === '-') {
    try {
      return readFileSync(0, 'utf8'); // stdin
    } catch {
      return '';
    }
  }
  const p = isAbsolute(spec) ? spec : resolve(process.cwd(), spec);
  if (!existsSync(p)) fail(`input not found: ${p}`, 2);
  return readFileSync(p, 'utf8');
}

function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Wave H F2 — the annotate egress allowlist. The dev-server is loopback-only
 * (DDR-054); a PUT target that is not a loopback http(s) origin is refused so
 * a poisoned `_server.json.url` can't exfiltrate the canvas SVG off-box.
 */
function isLoopbackHttpUrl(base) {
  let u;
  try {
    u = new URL(base);
  } catch {
    return false;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
  const h = u.hostname.toLowerCase();
  return h === '127.0.0.1' || h === 'localhost' || h === '::1' || h === '[::1]';
}

// ─────────────────────────────────────────────────────────────────────────────
// Existing-canvas context — host geometry for binds, placement origin.

/** Fabricate a bbox-shaped rect Stroke for an EXISTING annotation so the
 *  binding helpers (which only read strokeBBox) work against parsed data. */
function fakeHost(ann) {
  return {
    id: ann.id,
    tool: 'rect',
    color: '#000',
    width: 1,
    x: ann.x ?? 0,
    y: ann.y ?? 0,
    w: ann.w ?? 0,
    h: ann.h ?? 0,
  };
}

const BINDABLE_PARSED = new Set(['rect', 'ellipse', 'polygon', 'sticky', 'image']);

// ─────────────────────────────────────────────────────────────────────────────
// Op application

function buildContext(existing, artboards, near) {
  // Placement origin: beside --near's artboard when given, else right of the
  // existing annotation extent, else a sane top-left.
  let origin = { x: 100, y: 100 };
  const nearBoard = near ? artboards.find((r) => r.id === near) : null;
  if (nearBoard) {
    origin = { x: nearBoard.x + nearBoard.w + 80, y: nearBoard.y };
  } else if (existing.length) {
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    for (const a of existing) {
      if (a.x == null) continue;
      maxX = Math.max(maxX, a.x + (a.w || 0));
      minY = Math.min(minY, a.y ?? 0);
    }
    if (Number.isFinite(maxX)) origin = { x: maxX + 80, y: Math.max(0, minY) };
  }
  return {
    origin,
    cursor: { ...origin },
    refs: new Map(), // '@ref' → minted id
    newById: new Map(), // id → new Stroke
    created: [], // Stroke[] in creation order
    groupExisting: [], // { id, groupId } injections into existing elements
    deletes: [], // existing ids to remove
    existingById: new Map(existing.map((a) => [a.id, a])),
  };
}

function resolveTarget(ctx, idOrRef) {
  if (typeof idOrRef !== 'string' || !idOrRef) return null;
  const id = idOrRef.startsWith('@') ? ctx.refs.get(idOrRef) : idOrRef;
  if (!id) return null;
  const created = ctx.newById.get(id);
  if (created) return { id, stroke: created, isNew: true };
  const existing = ctx.existingById.get(id);
  if (existing && BINDABLE_PARSED.has(existing.tool)) {
    return { id, stroke: fakeHost(existing), isNew: false };
  }
  return null;
}

function mint(ctx, ref) {
  const id = rid();
  if (typeof ref === 'string' && ref.startsWith('@')) ctx.refs.set(ref, id);
  return id;
}

function autoPlace(ctx, w, op) {
  const x = Number.isFinite(op.x) ? op.x : ctx.cursor.x;
  const y = Number.isFinite(op.y) ? op.y : ctx.cursor.y;
  if (!Number.isFinite(op.x)) ctx.cursor.x = x + w + 40;
  return { x, y };
}

function pushCreated(ctx, stroke) {
  ctx.created.push(stroke);
  ctx.newById.set(stroke.id, stroke);
  return stroke;
}

function createSticky(ctx, op) {
  const w = Number.isFinite(op.w) ? op.w : STICKY_DEFAULT_W;
  const h = Number.isFinite(op.h) ? op.h : STICKY_DEFAULT_H;
  const { x, y } = autoPlace(ctx, w, op);
  return pushCreated(ctx, {
    id: mint(ctx, op.ref),
    tool: 'sticky',
    color: typeof op.color === 'string' ? op.color : DEFAULT_STICKY_COLOR,
    x,
    y,
    w,
    h,
    text: typeof op.text === 'string' ? op.text : '',
    fontSize: Number.isFinite(op.fontSize) ? op.fontSize : DEFAULT_FONT_SIZE,
    cornerRadius: STICKY_CORNER_RADIUS,
    author: 'ai',
  });
}

function createSection(ctx, op) {
  const w = Number.isFinite(op.w) ? op.w : SECTION_DEFAULT_W;
  const h = Number.isFinite(op.h) ? op.h : SECTION_DEFAULT_H;
  const { x, y } = autoPlace(ctx, w, op);
  return pushCreated(ctx, {
    id: mint(ctx, op.ref),
    tool: 'section',
    x,
    y,
    w,
    h,
    label: typeof op.label === 'string' && op.label ? op.label : 'Section',
    color: typeof op.color === 'string' ? op.color : DEFAULT_SECTION_COLOR,
    author: 'ai',
  });
}

function createText(ctx, op) {
  const { x, y } = autoPlace(ctx, 160, op);
  return pushCreated(ctx, {
    id: mint(ctx, op.ref),
    tool: 'text',
    color: typeof op.color === 'string' ? op.color : TEXT_INK,
    fontSize: Number.isFinite(op.fontSize) ? op.fontSize : DEFAULT_FONT_SIZE,
    text: typeof op.text === 'string' ? op.text : '',
    x,
    y,
    author: 'ai',
  });
}

function createShape(ctx, op) {
  const w = Number.isFinite(op.w) ? op.w : NODE_W;
  const h = Number.isFinite(op.h) ? op.h : NODE_H;
  const { x, y } = autoPlace(ctx, w, op);
  const ink = typeof op.color === 'string' ? op.color : NODE_INK;
  const fill = op.fill === null ? null : typeof op.fill === 'string' ? op.fill : NODE_FILL;
  const kind = typeof op.shape === 'string' ? op.shape : 'rounded';
  const id = mint(ctx, op.ref);
  let shape;
  if (kind === 'ellipse' || kind === 'circle') {
    shape = {
      id,
      tool: 'ellipse',
      color: ink,
      width: 3,
      cx: x + w / 2,
      cy: y + h / 2,
      rx: w / 2,
      ry: h / 2,
      fill,
      author: 'ai',
    };
  } else if (kind === 'diamond' || kind === 'triangle' || kind === 'triangle-down') {
    shape = {
      id,
      tool: 'polygon',
      shape: kind,
      color: ink,
      width: 3,
      x,
      y,
      w,
      h,
      fill,
      author: 'ai',
    };
  } else {
    shape = {
      id,
      tool: 'rect',
      color: ink,
      width: 3,
      x,
      y,
      w,
      h,
      fill,
      cornerRadius: kind === 'rect' || kind === 'square' ? 0 : 8,
      author: 'ai',
    };
  }
  pushCreated(ctx, shape);
  if (typeof op.label === 'string' && op.label) {
    // Anchored label — renders centered in the host (the canvas convention).
    // Wave G widened anchored text to every closed shape, polygons included.
    pushCreated(ctx, {
      id: rid(),
      tool: 'text',
      color: TEXT_INK,
      fontSize: DEFAULT_FONT_SIZE,
      text: op.label,
      anchorId: id,
      author: 'ai',
    });
  }
  return shape;
}

function createConnect(ctx, op) {
  const from = resolveTarget(ctx, op.from);
  const to = resolveTarget(ctx, op.to);
  if (!from || !to) {
    fail(
      `connect: unknown ${!from ? `"from" (${op.from})` : `"to" (${op.to})`} — targets must be existing bindable ids or @refs created earlier in the batch`,
      2
    );
  }
  const fromCenter = centerOf(from.stroke);
  const toCenter = centerOf(to.stroke);
  const sb = facingAnchor(from.stroke, toCenter[0], toCenter[1]);
  const eb = facingAnchor(to.stroke, fromCenter[0], fromCenter[1]);
  if (!sb || !eb) fail('connect: could not derive anchors (zero-extent host?)', 2);
  const p1 = anchorPoint(from.stroke, sb.nx, sb.ny);
  const p2 = anchorPoint(to.stroke, eb.nx, eb.ny);
  if (!p1 || !p2) fail('connect: could not derive endpoints', 2);
  const arrow = pushCreated(ctx, {
    id: mint(ctx, op.ref),
    tool: 'arrow',
    color: typeof op.color === 'string' ? op.color : DEFAULT_COLOR,
    width: 3,
    x1: p1[0],
    y1: p1[1],
    x2: p2[0],
    y2: p2[1],
    startBind: { hostId: from.id, nx: sb.nx, ny: sb.ny },
    endBind: { hostId: to.id, nx: eb.nx, ny: eb.ny },
    author: 'ai',
  });
  if (typeof op.label === 'string' && op.label) {
    pushCreated(ctx, {
      id: rid(),
      tool: 'text',
      color: TEXT_INK,
      fontSize: 12,
      text: op.label,
      x: (p1[0] + p2[0]) / 2 + 6,
      y: (p1[1] + p2[1]) / 2 - 18,
      author: 'ai',
    });
  }
  return arrow;
}

function centerOf(stroke) {
  if (stroke.tool === 'ellipse') return [stroke.cx, stroke.cy];
  return [stroke.x + (stroke.w ?? 0) / 2, stroke.y + (stroke.h ?? 0) / 2];
}

function applyGroup(ctx, op) {
  const ids = Array.isArray(op.ids) ? op.ids : [];
  const resolved = [];
  for (const raw of ids) {
    const id = typeof raw === 'string' && raw.startsWith('@') ? ctx.refs.get(raw) : raw;
    if (!id) fail(`group: unknown ref ${raw}`, 2);
    resolved.push(id);
  }
  if (resolved.length < 2) fail('group: needs at least two ids', 2);
  const groupId = gid();
  for (const id of resolved) {
    const created = ctx.newById.get(id);
    if (created) {
      created.groupIds = [...(created.groupIds ?? []), groupId];
    } else if (ctx.existingById.has(id)) {
      ctx.groupExisting.push({ id, groupId });
    } else {
      fail(`group: id not found on canvas: ${id}`, 2);
    }
  }
}

function applyOps(ctx, ops) {
  for (const op of ops) {
    if (!op || typeof op !== 'object') fail('ops: every entry must be an object', 2);
    if (op.op === 'create') {
      if (op.type === 'sticky') createSticky(ctx, op);
      else if (op.type === 'section') createSection(ctx, op);
      else if (op.type === 'text') createText(ctx, op);
      else if (op.type === 'shape') createShape(ctx, op);
      else if (op.type === 'arrow') {
        if ([op.x1, op.y1, op.x2, op.y2].every(Number.isFinite)) {
          pushCreated(ctx, {
            id: mint(ctx, op.ref),
            tool: 'arrow',
            color: typeof op.color === 'string' ? op.color : DEFAULT_COLOR,
            width: 3,
            x1: op.x1,
            y1: op.y1,
            x2: op.x2,
            y2: op.y2,
            author: 'ai',
          });
        } else {
          createConnect(ctx, op); // from/to form
        }
      } else fail(`create: unknown type "${op.type}"`, 2);
    } else if (op.op === 'connect') {
      createConnect(ctx, op);
    } else if (op.op === 'group') {
      applyGroup(ctx, op);
    } else if (op.op === 'delete') {
      if (typeof op.id !== 'string' || !op.id) fail('delete: missing id', 2);
      ctx.deletes.push(op.id);
    } else {
      fail(`ops: unknown op "${op.op}"`, 2);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Flow mode — layered left→right layout of nodes + bound connector edges.

function flowToOps(flow) {
  const nodes = Array.isArray(flow.nodes) ? flow.nodes : [];
  const edges = Array.isArray(flow.edges) ? flow.edges : [];
  if (!nodes.length) fail('flow: needs at least one node', 2);
  const ids = nodes.map((n) => n.id);
  const idSet = new Set(ids);
  for (const e of edges) {
    if (!idSet.has(e.from) || !idSet.has(e.to)) {
      fail(`flow: edge references unknown node (${e.from} → ${e.to})`, 2);
    }
  }
  // Longest-path layering via Kahn; cycle leftovers keep their seeded layer.
  const indeg = new Map(ids.map((id) => [id, 0]));
  const adj = new Map(ids.map((id) => [id, []]));
  for (const e of edges) {
    adj.get(e.from).push(e.to);
    indeg.set(e.to, indeg.get(e.to) + 1);
  }
  const layer = new Map(ids.map((id) => [id, 0]));
  const queue = ids.filter((id) => indeg.get(id) === 0);
  while (queue.length) {
    const id = queue.shift();
    for (const t of adj.get(id)) {
      layer.set(t, Math.max(layer.get(t), layer.get(id) + 1));
      indeg.set(t, indeg.get(t) - 1);
      if (indeg.get(t) === 0) queue.push(t);
    }
  }
  const byLayer = new Map();
  for (const id of ids) {
    const l = layer.get(id);
    if (!byLayer.has(l)) byLayer.set(l, []);
    byLayer.get(l).push(id);
  }
  const ops = [];
  for (const [l, list] of [...byLayer.entries()].sort((a, b) => a[0] - b[0])) {
    list.forEach((id, i) => {
      const node = nodes.find((n) => n.id === id);
      ops.push({
        op: 'create',
        type: 'shape',
        shape: typeof node.shape === 'string' ? node.shape : 'rounded',
        ref: `@${id}`,
        label: typeof node.label === 'string' ? node.label : String(id),
        // Relative to the placement origin — autoPlace sees explicit coords.
        flowX: l * (NODE_W + FLOW_GAP_X),
        flowY: i * (NODE_H + FLOW_GAP_Y),
      });
    });
  }
  for (const e of edges) {
    ops.push({ op: 'connect', from: `@${e.from}`, to: `@${e.to}`, label: e.label });
  }
  return ops;
}

// ─────────────────────────────────────────────────────────────────────────────
// SVG assembly — deletes + group injections on the existing string, new
// strokes serialized through the canonical serializer, sanitize, cap.

function deleteElement(svg, id) {
  const idEsc = escapeRe(id);
  let out = svg.replace(
    new RegExp(`<(g|text)\\b[^>]*data-id="${idEsc}"[^>]*>[\\s\\S]*?</\\1>`, 'g'),
    ''
  );
  out = out.replace(
    new RegExp(`<(?:path|rect|ellipse|polygon|image)\\b[^>]*data-id="${idEsc}"[^>]*/>`, 'g'),
    ''
  );
  // Cascade — anchored text hosted by the deleted shape goes with it (the
  // canvas deleteStrokes rule).
  out = out.replace(
    new RegExp(`<text\\b[^>]*data-anchor-id="${idEsc}"[^>]*>[\\s\\S]*?</text>`, 'g'),
    ''
  );
  return out;
}

function injectGroupAttr(svg, id, groupId) {
  const idEsc = escapeRe(id);
  const re = new RegExp(`(<[a-zA-Z]+\\b[^>]*data-id="${idEsc}"[^>]*?)(/?>)`);
  return svg.replace(re, (_whole, head, close) => {
    if (/data-group-ids="/.test(head)) {
      return (
        head.replace(
          /data-group-ids="([^"]*)"/,
          (_m, cur) => `data-group-ids="${cur} ${groupId}"`
        ) + close
      );
    }
    return `${head} data-group-ids="${groupId}"${close}`;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Main

async function main() {
  const args = parseArgv(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(`${HELP}\n`);
    return;
  }
  const relPath = args.positional[0];
  if (!relPath) fail(`missing <rel-path>.\n\n${HELP}`, 2);
  if (args.ops && args.flow) fail('--ops and --flow are mutually exclusive', 2);

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
  const existing = parseAnnotations(svg);

  const artboards = args.canvasState
    ? loadArtboards(
        isAbsolute(args.canvasState) ? args.canvasState : resolve(process.cwd(), args.canvasState)
      )
    : [];

  const ctx = buildContext(existing, artboards, args.near);

  let ops;
  if (args.flow != null) {
    const flow = parseJsonInput(readInput(args.flow), '--flow');
    ops = flowToOps(flow).map((op) =>
      'flowX' in op ? { ...op, x: ctx.origin.x + op.flowX, y: ctx.origin.y + op.flowY } : op
    );
  } else {
    const payload = parseJsonInput(readInput(args.ops), '--ops');
    ops = Array.isArray(payload.ops) ? payload.ops : Array.isArray(payload) ? payload : null;
    if (!ops) fail('ops: expected { ops: [...] } (or a bare array)', 2);
  }

  applyOps(ctx, ops);

  // Assemble. Deletes + group injections operate on the existing string; new
  // strokes append before </svg> through the canonical serializer.
  let merged = svg && /<svg[\s>]/i.test(svg) ? svg : `${SVG_HEADER}</svg>`;
  for (const id of ctx.deletes) merged = deleteElement(merged, id);
  for (const inj of ctx.groupExisting) merged = injectGroupAttr(merged, inj.id, inj.groupId);
  if (ctx.created.length) {
    const body = ctx.created.map((s) => strokeToSvgEl(s)).join('');
    const close = merged.lastIndexOf('</svg>');
    if (close < 0) fail('existing annotation file is not a valid SVG', 1);
    merged = merged.slice(0, close) + body + merged.slice(close);
  }
  merged = sanitizeAnnotationSvg(merged);
  const bytes = Buffer.byteLength(merged, 'utf8');
  if (bytes > MAX_ANNOTATIONS_BYTES) {
    fail(`result exceeds the 1 MB annotation cap (${bytes} bytes) — nothing written`, 1);
  }

  if (args.dryRun) {
    process.stdout.write(`${merged}\n`);
    return;
  }

  // Prefer the live server (sanitize + persist + collab broadcast — open
  // canvases update in real time); fall back to a direct file write.
  let via = 'file';
  const serverJsonPath = join(designRoot, '_server.json');
  if (existsSync(serverJsonPath)) {
    try {
      const srv = JSON.parse(readFileSync(serverJsonPath, 'utf8'));
      const base = typeof srv.url === 'string' ? srv.url.replace(/\/+$/, '') : null;
      // Security (Wave H F2): `_server.json` is local dev-server state, but the
      // verb runs in an AGENT loop — only ever PUT to a loopback http(s) origin
      // so a poisoned/foreign `url` can't turn this into an SSRF primitive that
      // exfiltrates the whole canvas SVG to an arbitrary host. On anything else
      // (remote host, file:, javascript:) we silently fall back to the file
      // write — the local intent still succeeds, the egress is denied.
      if (base && isLoopbackHttpUrl(base)) {
        const res = await fetch(`${base}/_api/annotations`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file: `${designRel}/${relPath}`, svg: merged }),
          signal: AbortSignal.timeout(3000),
        });
        if (res.ok) via = 'server';
      }
    } catch {
      /* stale _server.json / server down — fall through to the file write */
    }
  }
  if (via === 'file') {
    writeFileSync(svgPath, merged, 'utf8');
  }

  const refs = {};
  for (const [ref, id] of ctx.refs) refs[ref] = id;
  process.stdout.write(
    `${JSON.stringify({ ok: true, via, file: svgPath, bytes, created: ctx.created.length, deleted: ctx.deletes.length, refs })}\n`
  );
}

function parseJsonInput(raw, what) {
  if (!raw?.trim()) fail(`${what}: empty input`, 2);
  try {
    return JSON.parse(raw);
  } catch (err) {
    fail(`${what}: invalid JSON — ${err?.message ?? err}`, 2);
  }
}

await main();
