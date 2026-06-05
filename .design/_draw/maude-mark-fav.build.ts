/**
 * maude-mark FAVICON fallback variant — node + spark-corner + ONE diagonal grip.
 * Built ONLY to A/B the 16px legibility claim honestly (the brief asked me to
 * propose the minimal geometry if 3-grips+spark is mush at favicon size).
 * Drops TR + BL grips, keeps the BR grip so the "selected" diagonal still reads,
 * with the TL spark as the single distinguishing accent. Monochrome currentColor.
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
  tl: { x: 5.4, y: 5.4 }, // SPARK
  br: { x: 26, y: 26 }, // single retained grip (the diagonal pair → selected)
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

const R = 5.4;
const K = 0.46;
const r = K * R;
const raw = [
  { x: 0, y: -R },
  { x: r, y: -r },
  { x: R, y: 0 },
  { x: r, y: r },
  { x: 0, y: R },
  { x: -r, y: r },
  { x: -R, y: 0 },
  { x: -r, y: -r },
];
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
  handle(corners.br.x, corners.br.y),
  E.polygon({ points: sparkPts, fill: 'currentColor', grid: 0 }),
];

const opts = {
  viewBox: VB,
  a11y: { title: 'maude', desc: 'maude mark — selected node with an agent spark (favicon)' },
};

if (process.env.DRAW_OUT) await Bun.write(process.env.DRAW_OUT, E.optimizeSvg(E.toSvg(prims, opts)));
console.log(E.toJsx(prims, opts));
