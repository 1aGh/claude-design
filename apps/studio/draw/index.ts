/**
 * @file       draw/index.ts — Phase 25 geometry-engine public surface
 * @scope      apps/studio/draw/index.ts
 * @purpose    Single import point for the draw engine. The draw-agent and the
 *             `draw-proof` / `svg-optimize` bin helpers import from here:
 *
 *               import { rect, circle, place, toSvg, toJsx, optimizeSvg,
 *                        diagram, contrastRatio } from './draw/index.ts';
 *
 *             Layering (each only depends on the ones above it):
 *               primitives  → the DrawPrimitive vocabulary + constructors
 *               geometry    → PCHIP / A* / centroid / optical corrections
 *               palette     → WCAG + OKLCH (pure color math)
 *               layout      → grid snap, modular scale, label placement, diagram()
 *               serialize   → primitives → SVG string + JSX string (single source)
 *               optimize    → SVGO minify + validity gate (the only runtime dep)
 *
 *             React-free (DDR-067) — nothing here imports react / a `.tsx`.
 */

export * from './animate.ts';
export * from './brush.ts';
export * from './composition.ts';
export * from './geometry.ts';
export * from './layout.ts';
export * from './morph.ts';
export * from './optimize.ts';
export * from './palette.ts';
export * from './primitives.ts';
export * from './serialize.ts';
export * from './serialize-animate.ts';
