/**
 * maude-mark — Round-3 single-fix candidate A (base = C3, SPARK ONLY changed).
 * REGRESSION FIX: the prior spark used outer R=4.0 / K=0.65, which put the
 * diagonal inner vertices at radius ~3.68 (≈2.6 in x & y) — the concave waists
 * nearly vanished and the mark read as a rounded octagon BLOB, losing the
 * "agent spark" identity. This restores a CRISP 4-point star:
 *   - outer R = 5.0 (axis tips), inner r = 3.0  => K = inner/outer = 0.60.
 *   - diagonal inner vertices land at radius r = 3.0  (= 3.0/√2 ≈ 2.12 in BOTH
 *     x & y from center) — deep concave waists, unmistakable 4-point star.
 *   - centered + seated at (6.2, 6.2) via centroidCenter so the spark tucks
 *     SNUG into the frame's top-left corner curve (kills the "floating detached
 *     at (0,0)" read) — its inner-bottom-right vertex sits just outside the
 *     square-grip family, kissing the frame corner.
 *   - tips on the axes: top (6.2,1.2) right (11.2,6.2) bottom (6.2,11.2)
 *     left (1.2,6.2).
 * Footprint-parity (1.25× bbox) is REJECTED: a thin 4-point star has far less
 * area than a 6.4 square, so to OPTICALLY balance the squares the spark needs a
 * larger extent (~1.5× linear) AND must stay a crisp star. Focal by SHAPE +
 * modest extra extent — never by blobbing it to equal bbox.
 * Everything else (frame, 3 square handles, monochrome currentColor) is locked.
 */
const E = await import(process.env.MAUDE_DRAW_ENGINE!);

const VB = '0 0 32 32';

const FX = 8,
  FY = 8,
  FW = 16,
  FH = 16,
  FR = 4,
  STROKE = 2.6;

// Square grips seat ~2px diagonally outside the frame corner (frame corner
// (8,8) -> grip center (6,6)). The spark seats a touch tighter at (6.2,6.2) so
// its larger extent still tucks SNUG to the TL frame corner.
const corners = {
  tl: { x: 6.2, y: 6.2 }, // SPARK (agent) — crisp 4-point star, tucked to corner
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

// Spark: CRISP 4-point star. Outer R=5.0 (axis tips), inner r=3.0 => K=0.60.
// Diagonal inner vertices at radius r=3.0 (3.0/√2 ≈ 2.12 in x & y) = deep waists.
const R = 5.0;
const K = 0.6;
const r = K * R; // 3.0

function sparkPoints(R: number, r: number) {
  const d = r / Math.SQRT2; // diagonal inner vertex offset (≈2.121 for r=3)
  return [
    { x: 0, y: -R }, // top tip
    { x: d, y: -d }, // inner TR (radius r)
    { x: R, y: 0 }, // right tip
    { x: d, y: d }, // inner BR (radius r)
    { x: 0, y: R }, // bottom tip
    { x: -d, y: d }, // inner BL (radius r)
    { x: -R, y: 0 }, // left tip
    { x: -d, y: -d }, // inner TL (radius r)
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

// --- self-verify the K≈0.60 crisp-star invariant from the SEATED points ---
const cx = sparkPts.reduce((s, p) => s + p.x, 0) / sparkPts.length;
const cy = sparkPts.reduce((s, p) => s + p.y, 0) / sparkPts.length;
const radii = sparkPts.map((p) => Math.hypot(p.x - cx, p.y - cy));
const outer = Math.max(...radii);
const inner = Math.min(...radii);
// the 4 diagonal inner vertices (odd indices) — must sit at radius ~3.0
const diag = [1, 3, 5, 7].map((i) => {
  const p = sparkPts[i];
  return { rad: Math.hypot(p.x - cx, p.y - cy), dx: p.x - cx, dy: p.y - cy };
});
const minX = Math.min(...sparkPts.map((p) => p.x));
const minY = Math.min(...sparkPts.map((p) => p.y));
const maxX = Math.max(...sparkPts.map((p) => p.x));
const maxY = Math.max(...sparkPts.map((p) => p.y));
console.error(
  `cfixA: R=${R} K=${K} | outer=${outer.toFixed(2)} inner=${inner.toFixed(2)} ` +
    `measuredK=${(inner / outer).toFixed(3)}\n` +
    `  diagonal inner vertices (must be radius ~3.0, ~2.12 x&y):\n` +
    diag.map((d, i) => `    [${i}] rad=${d.rad.toFixed(2)} dx=${d.dx.toFixed(2)} dy=${d.dy.toFixed(2)}`).join('\n') +
    `\n  sparkBBox x[${minX.toFixed(2)},${maxX.toFixed(2)}] y[${minY.toFixed(2)},${maxY.toFixed(2)}] ` +
    `extent=${(maxX - minX).toFixed(2)} linRatio=${((maxX - minX) / HS).toFixed(3)} ` +
    `seat=(${corners.tl.x},${corners.tl.y}) center=(${cx.toFixed(2)},${cy.toFixed(2)})`
);

if (process.env.DRAW_OUT) await Bun.write(process.env.DRAW_OUT, E.optimizeSvg(E.toSvg(prims, opts)));
console.log(E.toJsx(prims, opts));
