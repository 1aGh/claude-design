// Phase 6.5 T2 — PNG adapter unit tests.
//
// Skips the real `screenshot.sh` invocation — that path lands as a scenario
// under `.ai/scenarios/export-from-toolbar/` (T2 plan §Validate). Here we
// cover the contract-shape branches:
//   - empty target list → zero-byte placeholder
//   - file-tree-only targets → throws (PNG adapter rejects)

import { describe, expect, test } from 'bun:test';

import { clampDpi, clampScale, resolveDeviceScale, run } from '../../exporters/png.ts';

const CTX = {
  designRoot: '/tmp/.design',
  repoRoot: '/tmp',
  serverOrigin: 'http://localhost:0',
};

describe('png adapter — contract', () => {
  test('empty targets → zero-byte PNG placeholder', async () => {
    const r = await run([], {}, CTX);
    expect(r.contentType).toBe('image/png');
    expect(r.body.byteLength).toBe(0);
    expect(r.filename.endsWith('.png')).toBe(true);
  });

  test('file-tree targets → throws (PNG cannot render a project)', async () => {
    await expect(run([{ kind: 'file-tree', paths: ['ui/Home.tsx'] }], {}, CTX)).rejects.toThrow(
      /element targets/i
    );
  });
});

describe('png clampScale — size presets (item 1)', () => {
  test('defaults to 2× when scale is absent / invalid', () => {
    expect(clampScale(undefined)).toBe(2);
    expect(clampScale(null)).toBe(2);
    expect(clampScale('nonsense')).toBe(2);
    expect(clampScale(0)).toBe(2);
  });

  test('honours the 1×/2×/3× presets (number or string)', () => {
    expect(clampScale(1)).toBe(1);
    expect(clampScale(2)).toBe(2);
    expect(clampScale(3)).toBe(3);
    expect(clampScale('1')).toBe(1);
    expect(clampScale('3')).toBe(3);
  });

  test('clamps out-of-range / fractional values to the preset set', () => {
    expect(clampScale(4)).toBe(2); // above max → safe default
    expect(clampScale(2.6)).toBe(3); // rounds to nearest preset
    expect(clampScale(1.2)).toBe(1);
  });
});

describe('png clampDpi — feature-2-print-artboards T4', () => {
  test('undefined/null → undefined (falls back to scale)', () => {
    expect(clampDpi(undefined)).toBeUndefined();
    expect(clampDpi(null)).toBeUndefined();
  });

  test('non-numeric → undefined', () => {
    expect(clampDpi('nonsense')).toBeUndefined();
  });

  test('exact presets pass through', () => {
    expect(clampDpi(96)).toBe(96);
    expect(clampDpi(150)).toBe(150);
    expect(clampDpi(300)).toBe(300);
    expect(clampDpi(600)).toBe(600);
  });

  test('snaps to the nearest preset', () => {
    expect(clampDpi(200)).toBe(150);
    expect(clampDpi(250)).toBe(300);
    expect(clampDpi(1000)).toBe(600);
    expect(clampDpi(0)).toBe(96);
  });
});

describe('png resolveDeviceScale — dpi wins over scale', () => {
  test('dpi=300 → 3.125× (300/96)', () => {
    expect(resolveDeviceScale({ dpi: 300 })).toBeCloseTo(300 / 96, 10);
  });

  test('dpi=600 → 6.25× (300dpi ceiling raise, item T4)', () => {
    expect(resolveDeviceScale({ dpi: 600 })).toBeCloseTo(600 / 96, 10);
  });

  test('dpi=96 → 1× (no-op)', () => {
    expect(resolveDeviceScale({ dpi: 96 })).toBeCloseTo(1, 10);
  });

  test('no dpi → falls back to the legacy scale preset', () => {
    expect(resolveDeviceScale({ scale: 3 })).toBe(3);
    expect(resolveDeviceScale({})).toBe(2); // clampScale default
  });

  test('dpi present but not a number → falls back to scale', () => {
    expect(resolveDeviceScale({ dpi: 'nope', scale: 1 })).toBe(1);
  });
});
