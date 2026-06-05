/**
 * maude-mark — Round-3 single-fix candidate B (base = C3, spark only changed).
 * Same fix as cfixA (shrink R 5.4->4.0, re-seat to (6,6)) but a CHUNKIER inner
 * arm so the spark's filled area lands "modestly larger" than the square grips
 * (brief: ~1.25× area) while the linear ratio stays at the 1.25 cap.
 *   - R = 4.0  => bbox extent 8.0 => linear ratio 1.25 (same as A).
 *   - K = 0.72 => inner arm fuller => area ≈ 1.125× the 6.4 square (A is ≈1.02×).
 * Tests whether a fuller-armed star reads more clearly as the focal corner at
 * 16px without re-introducing the "oversized ornament" problem. Everything else
 * (frame, 3 square handles, monochrome currentColor, seat) is locked.
 */
const E = await import(process.env.MAUDE_DRAW_ENGINE!);

const VB = '0 0 32 32';

const FX = 8,
  FY = 8,
  FW = 16,
  FH = 16,
  FR = 4,
  STROKE = 2.6;

const corners = {
  tl: { x: 6, y: 6 }, // SPARK (agent) — seated with the family
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

const R = 4.0;
const K = 0.72; // chunkier inner arm -> ~1.125× square area, still a clear star
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
  `cfixB: R=${R} K=${K} sparkBBox x[${minX.toFixed(1)},${maxX.toFixed(1)}] y[${minY.toFixed(1)},${maxY.toFixed(1)}] ` +
    `extent=${(maxX - minX).toFixed(2)} linRatio=${((maxX - minX) / HS).toFixed(3)} center=(${corners.tl.x},${corners.tl.y})`
);

if (process.env.DRAW_OUT) await Bun.write(process.env.DRAW_OUT, E.optimizeSvg(E.toSvg(prims, opts)));
console.log(E.toJsx(prims, opts));
