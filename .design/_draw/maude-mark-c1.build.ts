/**
 * maude-mark candidate C1 — reference-faithful, optically-balanced grips.
 * LOCKED concept: selected node (rounded-square frame) + 3 square handles + a
 * top-left 4-point spark (the agent). Monochrome currentColor.
 *
 * Spark sizing note: equal-AREA matching of a thin 4-point star to a square
 * blows the star up (a sparse star needs a huge bounding radius to equal a
 * square's area), so it would DOMINATE, not match. The correct optical target
 * is the reference R≈5.4: the spark's outer points reach about as far from the
 * corner as the square handles' outer edges, while a chunky inner ratio keeps
 * enough arm mass that it reads as the same grip-sized accent. centroidCenter
 * seats its area-centroid exactly on the corner.
 */
const E = await import(process.env.MAUDE_DRAW_ENGINE!);

const VB = '0 0 32 32';

// ── Frame (the node) — dominant element, stroke only.
const FX = 8,
  FY = 8,
  FW = 16,
  FH = 16,
  FR = 4,
  STROKE = 2.6;

// Frame outer-corner centers (grips sit just outside, like real selection grips).
const corners = {
  tl: { x: 6, y: 6 }, // → the SPARK (agent)
  tr: { x: 26, y: 6 },
  bl: { x: 6, y: 26 },
  br: { x: 26, y: 26 },
};

// ── Square handles (TR, BL, BR).
const HS = 6.4; // side  → outer edge reaches 3.2px from corner center
const HR = 1.8;

function handle(cx: number, cy: number) {
  return E.rect({
    x: cx - HS / 2,
    y: cy - HS / 2,
    width: HS,
    height: HS,
    rx: HR,
    fill: 'currentColor',
    grid: 0,
  });
}

// ── Spark (top-left) — 4-point star anchored to the reference outer radius.
// R = outer half-extent (point reach); inner ratio K controls arm mass/concavity.
const R = 5.4; // reference outer radius (points reach 5.4 from corner)
const K = 0.46; // inner/outer → chunky arms (NOT a thin sparkle)
const r = K * R;

function sparkPoints(R: number, r: number) {
  return [
    { x: 0, y: -R }, // top point
    { x: r, y: -r },
    { x: R, y: 0 }, // right
    { x: r, y: r },
    { x: 0, y: R }, // bottom
    { x: -r, y: r },
    { x: -R, y: 0 }, // left
    { x: -r, y: -r },
  ];
}

const raw = sparkPoints(R, r);
const { dx, dy } = E.centroidCenter(raw, corners.tl.x, corners.tl.y);
const sparkPts = raw.map((p) => ({ x: p.x + dx, y: p.y + dy }));

const prims = [
  E.rect({
    x: FX,
    y: FY,
    width: FW,
    height: FH,
    rx: FR,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: STROKE,
    grid: 1,
  }),
  E.group([handle(corners.tr.x, corners.tr.y), handle(corners.bl.x, corners.bl.y), handle(corners.br.x, corners.br.y)]),
  E.polygon({ points: sparkPts, fill: 'currentColor', grid: 0 }),
];

const opts = {
  viewBox: VB,
  a11y: { title: 'maude', desc: 'maude mark — a selected node with an agent spark' },
};

// Diagnostics: confirm star mass vs square + that it stays inside the viewBox.
const starArea = 2 * R * r; // 4-point star polygon area
const minX = Math.min(...sparkPts.map((p) => p.x));
const minY = Math.min(...sparkPts.map((p) => p.y));
const maxX = Math.max(...sparkPts.map((p) => p.x));
const maxY = Math.max(...sparkPts.map((p) => p.y));
console.error(
  `C1: squareArea=${(HS * HS).toFixed(1)} starArea=${starArea.toFixed(1)} (ratio ${(starArea / (HS * HS)).toFixed(2)}) ` +
    `sparkBBox x[${minX.toFixed(1)},${maxX.toFixed(1)}] y[${minY.toFixed(1)},${maxY.toFixed(1)}]`
);

if (process.env.DRAW_OUT) await Bun.write(process.env.DRAW_OUT, E.optimizeSvg(E.toSvg(prims, opts)));
console.log(E.toJsx(prims, opts));
