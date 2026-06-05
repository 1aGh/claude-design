/**
 * maude-mark candidate C3 — Round-2 refinement of the C1 winner.
 * Fixes the two real defects seen in the proof:
 *   1. The spark's inner arm collided with the frame's top-left rounded corner.
 *      → seat the spark a touch further out along the TL diagonal (corner moves
 *        from (6,6) to ~(5.4,5.4)) so its inner arm clears the frame stroke,
 *        mirroring how the square grips sit just OUTSIDE their corners.
 *   2. Keep C1's clear-spark concavity (reads as a star/agent, not a rotated
 *      square) but firm up the arm mass slightly so it doesn't disappear vs the
 *      grips. K stays mid (chunky star, not thin sparkle).
 * Same locked concept, monochrome currentColor.
 */
const E = await import(process.env.MAUDE_DRAW_ENGINE!);

const VB = '0 0 32 32';

const FX = 8,
  FY = 8,
  FW = 16,
  FH = 16,
  FR = 4,
  STROKE = 2.6;

// Grips sit just outside the frame corners at ±2px from the frame edge (centers
// at 6 / 26). The spark corner is nudged a touch further out along its diagonal
// so its inner arm clears the frame's rounded TL corner.
const corners = {
  tl: { x: 5.4, y: 5.4 }, // SPARK (agent) — pulled out along the diagonal
  tr: { x: 26, y: 6 },
  bl: { x: 6, y: 26 },
  br: { x: 26, y: 26 },
};

const HS = 6.4;
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

// Spark: clear 4-point star (the agent). Reach ~5.4, mid concavity so it reads
// as a spark yet carries enough mass to balance the square grips.
const R = 5.4;
const K = 0.46;
const r = K * R;

function sparkPoints(R: number, r: number) {
  return [
    { x: 0, y: -R },
    { x: r, y: -r },
    { x: R, y: 0 },
    { x: r, y: r },
    { x: 0, y: R },
    { x: -r, y: r },
    { x: -R, y: 0 },
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

const minX = Math.min(...sparkPts.map((p) => p.x));
const minY = Math.min(...sparkPts.map((p) => p.y));
const maxX = Math.max(...sparkPts.map((p) => p.x));
const maxY = Math.max(...sparkPts.map((p) => p.y));
console.error(
  `C3: sparkBBox x[${minX.toFixed(1)},${maxX.toFixed(1)}] y[${minY.toFixed(1)},${maxY.toFixed(1)}] ` +
    `(inner arm reaches ${(corners.tl.x + r).toFixed(1)},${(corners.tl.y + r).toFixed(1)}; frame stroke inner edge ≈ ${(FX + STROKE / 2).toFixed(1)})`
);

if (process.env.DRAW_OUT) await Bun.write(process.env.DRAW_OUT, E.optimizeSvg(E.toSvg(prims, opts)));
console.log(E.toJsx(prims, opts));
