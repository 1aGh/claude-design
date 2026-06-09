/**
 * maude-bot ("Sparky") — an ORIGINAL friendly robot mascot, drawn as code via
 * the geometry engine (DDR-070). On-brand: the 4-point agent spark recurs as the
 * antenna tip + a belly mark. Line-first (stroke outlines) so it draws-on cleanly
 * over construction guides in the intro film (beat 70 → 80). No IP — original.
 *
 * Run: maude design draw-build --script .design/_draw/maude-bot.build.ts --out .design/_draw/maude-bot.svg
 */
const E = await import(process.env.MAUDE_DRAW_ENGINE!);

const VB = '0 0 80 80';
const SW = 2.6;

// 4-point agent spark (matches the maude mark), centered at (cx,cy), radius R.
function spark(cx: number, cy: number, R: number, K = 0.42) {
  const r = K * R;
  return E.polygon({
    points: [
      { x: cx, y: cy - R },
      { x: cx + r, y: cy - r },
      { x: cx + R, y: cy },
      { x: cx + r, y: cy + r },
      { x: cx, y: cy + R },
      { x: cx - r, y: cy + r },
      { x: cx - R, y: cy },
      { x: cx - r, y: cy - r },
    ],
    fill: 'currentColor',
    grid: 0,
  });
}

const stroke = { stroke: 'currentColor', strokeWidth: SW, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

const prims = [
  // antenna
  E.line({ x1: 40, y1: 16, x2: 40, y2: 9, ...stroke }),
  spark(40, 6, 4.2),

  // head
  E.rect({ x: 16, y: 15, width: 48, height: 33, rx: 13, ...stroke }),

  // eyes (filled) + shine
  E.circle({ cx: 31, cy: 31, r: 3.3, fill: 'currentColor', grid: 0 }),
  E.circle({ cx: 49, cy: 31, r: 3.3, fill: 'currentColor', grid: 0 }),

  // smile
  E.path({ d: 'M32 38 Q40 44 48 38', ...stroke }),

  // body
  E.rect({ x: 25, y: 50, width: 30, height: 18, rx: 9, ...stroke }),
  // belly spark
  spark(40, 59, 3.4, 0.4),

  // arms — left waving up, right resting
  E.path({ d: 'M25 55 Q16 52 14 43', ...stroke }),
  E.path({ d: 'M55 56 Q63 58 65 64', ...stroke }),

  // feet
  E.line({ x1: 33, y1: 68, x2: 33, y2: 73, ...stroke }),
  E.line({ x1: 47, y1: 68, x2: 47, y2: 73, ...stroke }),
  E.circle({ cx: 32, cy: 74, r: 2.4, fill: 'currentColor', grid: 0 }),
  E.circle({ cx: 48, cy: 74, r: 2.4, fill: 'currentColor', grid: 0 }),
];

const opts = {
  viewBox: VB,
  a11y: { title: 'Sparky', desc: 'maude mascot — a friendly robot with an agent spark' },
};

if (process.env.DRAW_OUT) await Bun.write(process.env.DRAW_OUT, E.optimizeSvg(E.toSvg(prims, opts)));
console.log(E.toJsx(prims, opts));
