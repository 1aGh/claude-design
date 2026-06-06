import { describe, expect, test } from 'bun:test';
import { sampleTrack } from '../animate.ts';
import { blobPath } from '../geometry.ts';
import { morphVariants, parseMorphPath, templateToPath } from '../morph.ts';
import type { Point } from '../primitives.ts';

describe('parseMorphPath', () => {
  test('extracts vertices + a command template (M…C…Z)', () => {
    const { template, vertices } = parseMorphPath('M0 0C1 1 2 2 3 3Z');
    expect(template.commands.map((c) => c.cmd)).toEqual(['M', 'C', 'Z']);
    expect(template.vertexCount).toBe(4); // M=1 + C=3
    expect(vertices).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
      { x: 3, y: 3 },
    ]);
  });
  test('round-trips through templateToPath', () => {
    const d = 'M0 0L10 0L10 10L0 10Z';
    const { template, vertices } = parseMorphPath(d);
    expect(templateToPath(template, vertices)).toBe(d);
  });
  test('parses negative + decimal + exponent numbers', () => {
    const { vertices } = parseMorphPath('M-1.5 2e1L3 -4.25');
    expect(vertices).toEqual([
      { x: -1.5, y: 20 },
      { x: 3, y: -4.25 },
    ]);
  });
  test('rejects non-morph-safe commands (H/V/A)', () => {
    expect(() => parseMorphPath('M0 0H10')).toThrow(/morph-safe/);
    expect(() => parseMorphPath('M0 0A5 5 0 0 1 10 10')).toThrow(/morph-safe/);
  });
  test('rejects relative (lowercase) commands', () => {
    expect(() => parseMorphPath('M0 0l10 10')).toThrow(/morph-safe/);
  });
  test('templateToPath enforces the vertex-count invariant', () => {
    const { template } = parseMorphPath('M0 0L1 1');
    expect(() => templateToPath(template, [{ x: 0, y: 0 }])).toThrow(/vertex count/);
  });
});

describe('morphVariants', () => {
  const base = blobPath(50, 50, 30, { lobes: 7, seed: 3 });

  test('every keyframe shares the fixed vertex count (interpolability)', () => {
    const { track, template } = morphVariants(base, { n: 4, jitter: 3, seed: 7 });
    for (const kf of track.keyframes) {
      expect((kf.value as Point[]).length).toBe(template.vertexCount);
    }
  });

  test('is deterministic for a given seed', () => {
    const a = morphVariants(base, { n: 3, jitter: 4, seed: 9 });
    const b = morphVariants(base, { n: 3, jitter: 4, seed: 9 });
    expect(a.track.keyframes).toEqual(b.track.keyframes);
  });

  test('different seeds produce different jitter', () => {
    const a = morphVariants(base, { n: 3, jitter: 4, seed: 1 });
    const b = morphVariants(base, { n: 3, jitter: 4, seed: 2 });
    expect(a.track.keyframes[1].value).not.toEqual(b.track.keyframes[1].value);
  });

  test('jitter 0 keeps every keyframe equal to the base shape', () => {
    const { track } = morphVariants(base, { n: 3, jitter: 0, seed: 5 });
    const first = track.keyframes[0].value;
    for (const kf of track.keyframes) expect(kf.value).toEqual(first);
  });

  test('loop (default) returns to the base on the final keyframe', () => {
    const { track } = morphVariants(base, { n: 3, jitter: 5, seed: 5 });
    const kfs = track.keyframes;
    expect(kfs[kfs.length - 1].value).toEqual(kfs[0].value); // seamless repeat
  });

  test('loop:false drops the closing base keyframe', () => {
    const loop = morphVariants(base, { n: 3, jitter: 5, loop: true });
    const open = morphVariants(base, { n: 3, jitter: 5, loop: false });
    expect(open.track.keyframes.length).toBe(loop.track.keyframes.length - 1);
  });

  test('keyframes span [0, dur] evenly', () => {
    const { track } = morphVariants(base, { n: 2, dur: 2 });
    const ts = track.keyframes.map((k) => k.t);
    expect(ts[0]).toBe(0);
    expect(ts[ts.length - 1]).toBe(2);
  });

  test('sampling + toPath yields a valid morph-safe d at mid-timeline', () => {
    const { track, toPath } = morphVariants(base, { n: 3, jitter: 4, dur: 1, seed: 2 });
    const mid = sampleTrack(track, 0.5) as Point[];
    const d = toPath(mid);
    expect(d.startsWith('M')).toBe(true);
    // Re-parsing the rendered frame must keep the same vertex count.
    expect(() => parseMorphPath(d)).not.toThrow();
  });

  test('ease is applied to all but the last keyframe', () => {
    const ease = [0.34, 1.42, 0.64, 1] as const;
    const { track } = morphVariants(base, { n: 2, ease });
    const kfs = track.keyframes;
    for (let i = 0; i < kfs.length - 1; i++) expect(kfs[i].ease).toEqual(ease);
    expect(kfs[kfs.length - 1].ease).toBeUndefined();
  });
});
