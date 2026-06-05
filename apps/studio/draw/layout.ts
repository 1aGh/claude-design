/**
 * @file       draw/layout.ts — Phase 25 geometry-engine layout / diagram layer
 * @scope      plugins/design/dev-server/draw/layout.ts
 * @purpose    Composition math:
 *               • a deterministic constraint-based label placer (pick the
 *                 candidate slot around each anchor that minimizes overlap —
 *                 NO `Math.random`, so output is reproducible + testable);
 *               • 4/8pt grid snapping + modular type-scale ladders (the
 *                 spacing/type rubric checks 5 + 9);
 *               • `diagram()` — composes nodes + A*-routed edges + labels into
 *                 primitives, the thing the full engine unlocks that LLM
 *                 free-handing can't do (edges that never cross nodes).
 *
 *             React-free (DDR-067).
 */

import { type Rect, routeConnector } from './geometry.ts';
import { type DrawPrimitive, group, type Point, polyline, rect, snap, text } from './primitives.ts';

// ─────────────────────────────────────────────────────────────────────────────
// Grid + modular scale
// ─────────────────────────────────────────────────────────────────────────────

/** Snap a point to a grid base (4 / 8 pt). `base <= 0` is a no-op. */
export function snapToGrid(p: Point, base: number): Point {
  return { x: snap(p.x, base), y: snap(p.y, base) };
}

/**
 * A modular type/space scale: `base · ratio^(startStep + i)` for `count` steps.
 * e.g. `modularScale(16, 1.5, 3)` → `[16, 24, 36]`. Common ratios: 1.2 (minor
 * third), 1.25 (major third), 1.333 (perfect fourth), 1.5 (perfect fifth).
 */
export function modularScale(base: number, ratio: number, count: number, startStep = 0): number[] {
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    out.push(Math.round(base * ratio ** (startStep + i) * 1000) / 1000);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constraint-based label placement
// ─────────────────────────────────────────────────────────────────────────────

export interface LabelItem {
  id: string;
  anchor: Point;
  width: number;
  height: number;
}

export interface Placement {
  id: string;
  /** Top-left of the placed label box. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Which compass slot was chosen. */
  slot: string;
}

export interface PlaceLabelsOpts {
  /** Gap between the anchor and the nearest label edge (default 6). */
  gap?: number;
  /** Optional bounds the labels must stay inside. */
  bounds?: Rect;
}

// Candidate slots in deterministic priority order (E reads best, then below…).
const SLOTS = ['E', 'S', 'W', 'N', 'SE', 'NE', 'SW', 'NW'] as const;

function slotBox(item: LabelItem, slot: string, gap: number): Rect {
  const { anchor: a, width: w, height: h } = item;
  switch (slot) {
    case 'E':
      return { x: a.x + gap, y: a.y - h / 2, width: w, height: h };
    case 'W':
      return { x: a.x - gap - w, y: a.y - h / 2, width: w, height: h };
    case 'S':
      return { x: a.x - w / 2, y: a.y + gap, width: w, height: h };
    case 'N':
      return { x: a.x - w / 2, y: a.y - gap - h, width: w, height: h };
    case 'SE':
      return { x: a.x + gap, y: a.y + gap, width: w, height: h };
    case 'NE':
      return { x: a.x + gap, y: a.y - gap - h, width: w, height: h };
    case 'SW':
      return { x: a.x - gap - w, y: a.y + gap, width: w, height: h };
    default: // NW
      return { x: a.x - gap - w, y: a.y - gap - h, width: w, height: h };
  }
}

function overlapArea(a: Rect, b: Rect): number {
  const ox = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const oy = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return ox * oy;
}

function outOfBounds(box: Rect, bounds: Rect): number {
  const dx =
    Math.max(0, bounds.x - box.x) + Math.max(0, box.x + box.width - (bounds.x + bounds.width));
  const dy =
    Math.max(0, bounds.y - box.y) + Math.max(0, box.y + box.height - (bounds.y + bounds.height));
  return dx + dy;
}

/**
 * Place each label in the slot around its anchor that minimizes overlap with
 * already-placed labels, the other anchors, and the bounds. Greedy + ordered by
 * id, so the result is fully deterministic. Returns one {@link Placement} per
 * item, in input order.
 */
export function placeLabels(items: LabelItem[], opts: PlaceLabelsOpts = {}): Placement[] {
  const gap = opts.gap ?? 6;
  const order = [...items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const placed: Rect[] = [];
  const anchors = items.map((it) => it.anchor);
  const byId = new Map<string, Placement>();

  for (const item of order) {
    let best: { slot: string; box: Rect; penalty: number } | null = null;
    for (const slot of SLOTS) {
      const box = slotBox(item, slot, gap);
      let penalty = 0;
      for (const p of placed) penalty += overlapArea(box, p);
      // Don't sit on top of another anchor point.
      for (const a of anchors) {
        if (a === item.anchor) continue;
        if (a.x >= box.x && a.x <= box.x + box.width && a.y >= box.y && a.y <= box.y + box.height) {
          penalty += gap * gap;
        }
      }
      if (opts.bounds) penalty += outOfBounds(box, opts.bounds) * 1000;
      if (best === null || penalty < best.penalty) best = { slot, box, penalty };
      if (penalty === 0) break; // perfect slot — take it (priority order honored)
    }
    const b = best as { slot: string; box: Rect };
    placed.push(b.box);
    byId.set(item.id, {
      id: item.id,
      x: b.box.x,
      y: b.box.y,
      width: item.width,
      height: item.height,
      slot: b.slot,
    });
  }

  return items.map((it) => byId.get(it.id) as Placement);
}

// ─────────────────────────────────────────────────────────────────────────────
// diagram() — nodes + A* edges + labels
// ─────────────────────────────────────────────────────────────────────────────

export interface DiagramNode {
  id: string;
  rect: Rect;
  label?: string;
}

export interface DiagramEdge {
  from: string;
  to: string;
}

export interface DiagramOpts {
  grid?: number;
  /** Inflate nodes when routing so edges keep clearance (default 4). */
  padding?: number;
  /** Corner chamfer radius for the routed edges (default 4). */
  chamfer?: number;
  nodeStyle?: { fill?: string; stroke?: string; strokeWidth?: number; rx?: number };
  edgeStyle?: { stroke?: string; strokeWidth?: number };
  labelStyle?: { fontSize?: number; fontFamily?: string; fontWeight?: number };
}

function center(r: Rect): Point {
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
}

/**
 * Compose a node-link diagram into ordered primitives: edges first (so they
 * tuck behind nodes), then each node's rect + centered label. Edges are routed
 * with the A* connector around every OTHER node, so they never cross a box.
 */
export function diagram(
  nodes: DiagramNode[],
  edges: DiagramEdge[],
  opts: DiagramOpts = {}
): DrawPrimitive[] {
  const grid = opts.grid ?? 10;
  const padding = opts.padding ?? 4;
  const chamfer = opts.chamfer ?? 4;
  const ns = opts.nodeStyle ?? {};
  const es = opts.edgeStyle ?? {};
  const ls = opts.labelStyle ?? {};
  const byId = new Map(nodes.map((n) => [n.id, n]));

  const edgePrims: DrawPrimitive[] = [];
  for (const e of edges) {
    const a = byId.get(e.from);
    const b = byId.get(e.to);
    if (!a || !b) continue;
    const obstacles = nodes.filter((n) => n.id !== e.from && n.id !== e.to).map((n) => n.rect);
    const points = routeConnector(center(a.rect), center(b.rect), obstacles, {
      grid,
      padding,
      chamfer,
    });
    edgePrims.push(
      polyline({
        points,
        fill: 'none',
        stroke: es.stroke ?? 'currentColor',
        strokeWidth: es.strokeWidth ?? 1.5,
        strokeLinejoin: 'round',
        strokeLinecap: 'round',
      })
    );
  }

  const nodePrims: DrawPrimitive[] = [];
  for (const n of nodes) {
    const r = n.rect;
    nodePrims.push(
      rect({
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
        rx: ns.rx ?? 6,
        fill: ns.fill ?? 'none',
        stroke: ns.stroke ?? 'currentColor',
        strokeWidth: ns.strokeWidth ?? 1.5,
      })
    );
    if (n.label) {
      const c = center(r);
      nodePrims.push(
        text({
          x: c.x,
          y: c.y,
          content: n.label,
          textAnchor: 'middle',
          dominantBaseline: 'central',
          fontSize: ls.fontSize ?? 13,
          fontFamily: ls.fontFamily,
          fontWeight: ls.fontWeight,
          fill: 'currentColor',
        })
      );
    }
  }

  return [group(edgePrims, { id: 'edges' }), group(nodePrims, { id: 'nodes' })];
}
