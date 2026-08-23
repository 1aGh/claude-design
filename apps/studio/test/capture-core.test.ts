// capture-core.test.ts — pure-logic guards of the shared capture spine
// (DDR-231). The DOM-dependent half (svgForElement, rasterizeSvg) is exercised
// end-to-end by the fidelity gate (plan T6) — no DOM emulation here.

import { describe, expect, test } from 'bun:test';

import {
  assertRasterSizeOk,
  MAX_OUTPUT_BYTES,
  MAX_OUTPUT_SIDE_PX,
} from '../exporters/capture-core.ts';

describe('assertRasterSizeOk — the raster render guard', () => {
  test('a 1440×900 artboard at 2× passes', () => {
    expect(() => assertRasterSizeOk(1440, 900, 2)).not.toThrow();
  });

  test('a 600dpi A0 poster still fits (the guard ceiling rationale)', () => {
    // 9933×14043 px ≈ 558MB RGBA — deliberately inside the ~600MB ceiling.
    expect(() => assertRasterSizeOk(9933 / 6.25, 14043 / 6.25, 6.25)).not.toThrow();
  });

  test('exceeding the side ceiling throws with an actionable max-DPI hint', () => {
    expect(() => assertRasterSizeOk(MAX_OUTPUT_SIDE_PX, 900, 2)).toThrow(/max supported DPI/);
  });

  test('exceeding the byte ceiling throws even when both sides fit', () => {
    // 15000×15000 × 4B = 900MB > ceiling while each side < 16000.
    expect(15000 * 15000 * 4).toBeGreaterThan(MAX_OUTPUT_BYTES);
    expect(() => assertRasterSizeOk(15000, 15000, 1)).toThrow(/render guard/);
  });
});
