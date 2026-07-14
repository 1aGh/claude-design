// Standalone proof asset for the "drag here" badge — run via
// `maude design draw-build --script _build-arrow-badge.ts --out _arrow-badge.svg`
// (apps/studio/bin/draw-build.sh injects MAUDE_DRAW_ENGINE / DRAW_OUT).
import { arrowBadgePrimitives } from './_arrow-badge.ts';

const E = await import(process.env.MAUDE_DRAW_ENGINE);

const R = 16;
const MARGIN = 2;
const half = R + MARGIN;
const viewBox = `${-half} ${-half} ${half * 2} ${half * 2}`;

const prims = arrowBadgePrimitives(E, { r: R });

const svg = E.optimizeSvg(
  E.toSvg(prims, {
    viewBox,
    width: half * 2,
    height: half * 2,
    a11y: { title: 'Drag to install', decorative: false, role: 'img' },
  })
);

if (process.env.DRAW_OUT) await Bun.write(process.env.DRAW_OUT, svg);
console.log(E.toJsx(prims, { viewBox }));
