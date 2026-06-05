/**
 * maude-mark candidate C2 — chunkier agent spark + slightly tighter grips,
 * tuned for the 16px favicon downscale. SAME locked concept as C1; differs only
 * in optical mass: a touch larger spark reach with heavier arms so the agent
 * corner clearly out-masses the plain grips and survives the favicon downscale.
 * Monochrome currentColor.
 */
const E = await import(process.env.MAUDE_DRAW_ENGINE!);

const VB = '0 0 32 32';

const FX = 8,
  FY = 8,
  FW = 16,
  FH = 16,
  FR = 4.2,
  STROKE = 2.6;

const corners = {
  tl: { x: 6, y: 6 },
  tr: { x: 26, y: 6 },
  bl: { x: 6, y: 26 },
  br: { x: 26, y: 26 },
};

// Slightly tighter grips so the spark reads as the heavier corner.
const HS = 6.2;
const HR = 1.6;

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

// Spark: a touch larger reach + heavier arms (higher inner ratio = more mass).
const R = 5.7; // slightly bigger reach than C1
const K = 0.5; // chunkier arms → clearly the heaviest corner at small sizes
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

const starArea = 2 * R * r;
const minX = Math.min(...sparkPts.map((p) => p.x));
const minY = Math.min(...sparkPts.map((p) => p.y));
const maxX = Math.max(...sparkPts.map((p) => p.x));
const maxY = Math.max(...sparkPts.map((p) => p.y));
console.error(
  `C2: squareArea=${(HS * HS).toFixed(1)} starArea=${starArea.toFixed(1)} (ratio ${(starArea / (HS * HS)).toFixed(2)}) ` +
    `sparkBBox x[${minX.toFixed(1)},${maxX.toFixed(1)}] y[${minY.toFixed(1)},${maxY.toFixed(1)}]`
);

if (process.env.DRAW_OUT) await Bun.write(process.env.DRAW_OUT, E.optimizeSvg(E.toSvg(prims, opts)));
console.log(E.toJsx(prims, opts));
