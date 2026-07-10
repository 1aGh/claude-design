// photo-pipeline.test.ts — Stage B, Task 5. Exercises ONLY the pure decision
// logic in pipeline.ts (`adjustmentCalls`, `resolveSourceUrl`, `needsCompositor`)
// — no pixi filter is constructed, so this runs headlessly. The actual WebGL
// render is verified via `maude design screenshot` (Task 6) + desktop dogfood
// (Task 25). This suite ALSO proves importing pipeline.ts (which statically
// imports pixi.js) does no construction at load time.

import { describe, expect, test } from 'bun:test';

import type { AdjustmentsStep } from '../photo/filters.ts';
import { adjustmentCalls, needsCompositor, resolveSourceUrl } from '../photo/pipeline.ts';

const adj = (ops: AdjustmentsStep['ops']): AdjustmentsStep => ({
  stage: 'adjustments',
  kind: 'colorMatrix',
  ops,
});

describe('adjustmentCalls — normalized → pixi mapping + neutral references', () => {
  test('brightness delta maps to pixi multiplier (neutral 1)', () => {
    expect(adjustmentCalls(adj([{ op: 'brightness', value: 0 }]))[0]).toEqual({
      method: 'brightness',
      args: [1],
    });
    expect(adjustmentCalls(adj([{ op: 'brightness', value: 0.5 }]))[0].args).toEqual([1.5]);
    expect(adjustmentCalls(adj([{ op: 'brightness', value: -1 }]))[0].args).toEqual([0]);
  });

  test('exposure maps to a 2^stop brightness', () => {
    expect(adjustmentCalls(adj([{ op: 'exposure', value: 0 }]))[0]).toEqual({
      method: 'brightness',
      args: [1],
    });
    expect(adjustmentCalls(adj([{ op: 'exposure', value: 1 }]))[0].args).toEqual([2]);
  });

  test('contrast maps into pixi 0..1 with 0.5 neutral', () => {
    expect(adjustmentCalls(adj([{ op: 'contrast', value: 0 }]))[0].args).toEqual([0.5]);
    expect(adjustmentCalls(adj([{ op: 'contrast', value: 1 }]))[0].args).toEqual([1]);
    expect(adjustmentCalls(adj([{ op: 'contrast', value: -1 }]))[0].args).toEqual([0]);
  });

  test('saturation and hue pass through', () => {
    expect(adjustmentCalls(adj([{ op: 'saturation', value: -0.5 }]))[0]).toEqual({
      method: 'saturate',
      args: [-0.5],
    });
    expect(adjustmentCalls(adj([{ op: 'hue', value: 120 }]))[0]).toEqual({
      method: 'hue',
      args: [120],
    });
  });

  test('sepia and invert become isolate-alpha toggles (amount honored)', () => {
    const sepia = adjustmentCalls(adj([{ op: 'sepia', value: 0.7 }]))[0];
    expect(sepia.method).toBe('sepia');
    expect(sepia.args).toEqual([]);
    expect(sepia.isolateAlpha).toBeCloseTo(0.7, 5);
    const invert = adjustmentCalls(adj([{ op: 'invert', value: 1 }]))[0];
    expect(invert.method).toBe('negative');
    expect(invert.isolateAlpha).toBe(1);
  });

  test('order is preserved end-to-end', () => {
    const calls = adjustmentCalls(
      adj([
        { op: 'brightness', value: 0.2 },
        { op: 'contrast', value: 0.1 },
        { op: 'sepia', value: 0.5 },
        { op: 'invert', value: 0.3 },
      ])
    );
    expect(calls.map((c) => c.method)).toEqual(['brightness', 'contrast', 'sepia', 'negative']);
  });
});

describe('resolveSourceUrl — background-removal cutout replaces original', () => {
  const SRC = 'assets/aaaa1111.jpg';
  const MATTE = 'assets/bbbb2222.png';
  test('unedited → original source', () => {
    expect(resolveSourceUrl(null, SRC)).toBe(SRC);
    expect(resolveSourceUrl({}, SRC)).toBe(SRC);
  });
  test('bg-removed enabled with a matte → the matte', () => {
    expect(resolveSourceUrl({ backgroundRemoved: { enabled: true, maskAsset: MATTE } }, SRC)).toBe(
      MATTE
    );
  });
  test('bg-removed disabled OR no matte → original (non-destructive toggle)', () => {
    expect(resolveSourceUrl({ backgroundRemoved: { enabled: false, maskAsset: MATTE } }, SRC)).toBe(
      SRC
    );
    expect(resolveSourceUrl({ backgroundRemoved: { enabled: true } }, SRC)).toBe(SRC);
  });
});

describe('needsCompositor — lazy-bundle gate', () => {
  test('mirrors isDefaultEdit inverse', () => {
    expect(needsCompositor(null)).toBe(false);
    expect(needsCompositor({})).toBe(false);
    expect(needsCompositor({ adjustments: { contrast: 0.4 } })).toBe(true);
    expect(
      needsCompositor({ backgroundRemoved: { enabled: true, maskAsset: 'assets/cc33.png' } })
    ).toBe(true);
  });
});
