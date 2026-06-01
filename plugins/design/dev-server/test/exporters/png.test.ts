// Phase 6.5 T2 — PNG adapter unit tests.
//
// Skips the real `screenshot.sh` invocation — that path lands as a scenario
// under `.ai/scenarios/export-from-toolbar/` (T2 plan §Validate). Here we
// cover the contract-shape branches:
//   - empty target list → zero-byte placeholder
//   - file-tree-only targets → throws (PNG adapter rejects)

import { describe, expect, test } from 'bun:test';

import { clampScale, run } from '../../exporters/png.ts';

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
