/**
 * @file       draw/optimize.ts — Phase 25 geometry-engine SVGO wrapper
 * @scope      apps/studio/draw/optimize.ts
 * @purpose    The single external dependency (SVGO — DDR-071). Two jobs:
 *               1. Minify the final on-disk SVG asset (multipass, 2-decimal
 *                  precision) without stripping the a11y/scaling contract.
 *               2. Act as a parse/validity GATE — SVGO's parser throws on
 *                  malformed SVG, so a mangled engine output (or hand-edited
 *                  asset) is caught loudly instead of shipping a broken mark.
 *
 *             SVGO v4 note (verified against svgo@4.0.1): `preset-default` no
 *             longer includes `removeViewBox` / `removeDesc`, so viewBox, the
 *             `<title>` and the `<desc>` are PRESERVED by default — the
 *             accessibility + responsive-scaling contract survives optimization
 *             with no overrides needed. Passing `removeViewBox:false` as an
 *             override actually warns ("not part of preset-default"), so we
 *             deliberately don't. If a future SVGO bump reintroduces those
 *             plugins, re-add explicit `false` overrides here.
 *
 *             This is the ONE engine module with a runtime dependency; the rest
 *             (primitives/geometry/palette/serialize/layout) are pure + dep-free.
 */

import { optimize as svgoOptimize } from 'svgo';

export interface OptimizeOpts {
  /** Coordinate decimal places (default 2). */
  floatPrecision?: number;
  /** Run the plugin pipeline repeatedly until stable (default true). */
  multipass?: boolean;
}

/**
 * Optimize an SVG string. Keeps `viewBox`, `<title>`, `<desc>`. Throws a clear
 * Error if the input doesn't parse (the validity gate).
 */
export function optimizeSvg(svg: string, opts: OptimizeOpts = {}): string {
  const { floatPrecision = 2, multipass = true } = opts;
  let result: { data: string };
  try {
    result = svgoOptimize(svg, {
      multipass,
      floatPrecision,
      // Default plugin set = `preset-default`; in v4 that keeps viewBox/title/desc.
      plugins: ['preset-default'],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`optimizeSvg: input is not valid SVG — ${msg}`);
  }
  return result.data;
}

/**
 * True when `svg` parses as valid SVG. Wraps {@link optimizeSvg}'s validity
 * gate without throwing — for callers that want a boolean pre-check.
 */
export function isValidSvg(svg: string): boolean {
  try {
    optimizeSvg(svg, { multipass: false });
    return true;
  } catch {
    return false;
  }
}
