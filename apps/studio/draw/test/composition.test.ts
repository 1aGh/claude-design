import { describe, expect, test } from 'bun:test';
import {
  armature,
  assignSlots,
  balanceMoment,
  dominanceRatio,
  snapToFocal,
} from '../composition.ts';
import { apcaLc, bestHarmony, harmonize, harmonyDistance, valueRange } from '../palette.ts';

const BOX = { x: 0, y: 0, width: 90, height: 60 };

describe('armatures', () => {
  test('thirds power points at exact 1/3 + 2/3', () => {
    const a = armature(BOX, 'thirds');
    expect(a.focals).toEqual([
      { x: 30, y: 20 },
      { x: 60, y: 20 },
      { x: 30, y: 40 },
      { x: 60, y: 40 },
    ]);
  });
  test('rabatment landscape lines at x=H and x=W−H', () => {
    const a = armature(BOX, 'rabatment'); // W=90,H=60 → x=60, x=30
    const xs = a.focals.map((f) => f.x).sort((p, q) => p - q);
    expect(xs[0]).toBe(30);
    expect(xs[xs.length - 1]).toBe(60);
  });
  test('golden points differ from thirds and are inside the box', () => {
    const a = armature(BOX, 'golden');
    expect(a.focals).toHaveLength(4);
    for (const f of a.focals) {
      expect(f.x).toBeGreaterThan(0);
      expect(f.x).toBeLessThan(90);
    }
    // golden vertical ≈ 90/1.618 = 55.6, not the thirds 60
    expect(a.focals.some((f) => Math.abs(f.x - 55.6) < 0.5)).toBe(true);
  });
  test('dynamic-symmetry yields 4 eyes inside the box, symmetric about center', () => {
    const a = armature(BOX, 'dynamic-symmetry');
    expect(a.focals).toHaveLength(4);
    const cx = a.focals.reduce((s, f) => s + f.x, 0) / 4;
    const cy = a.focals.reduce((s, f) => s + f.y, 0) / 4;
    expect(cx).toBeCloseTo(45, 4); // centroid of the 4 eyes = canvas center
    expect(cy).toBeCloseTo(30, 4);
  });
  test('snapToFocal picks the nearest power point', () => {
    const a = armature(BOX, 'thirds');
    expect(snapToFocal({ x: 28, y: 22 }, a)).toEqual({ x: 30, y: 20 });
  });
});

describe('constraint placement (no random scatter)', () => {
  test('assignSlots fills focals first, then a calm grid — deterministic', () => {
    const a = armature(BOX, 'thirds');
    const p1 = assignSlots(6, a);
    const p2 = assignSlots(6, a);
    expect(p1).toEqual(p2); // deterministic
    expect(p1.slice(0, 4)).toEqual(a.focals); // first 4 land on the power points
    expect(p1).toHaveLength(6);
    for (const p of p1) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(90);
    }
  });
});

describe('VME visual balance', () => {
  test('a symmetric pair scores ~1 (balanced)', () => {
    const els = [
      { bbox: { x: 10, y: 25, width: 10, height: 10 } },
      { bbox: { x: 70, y: 25, width: 10, height: 10 } },
    ];
    const r = balanceMoment(els, BOX);
    expect(r.score).toBeGreaterThan(0.95);
  });
  test('all weight on the left scores low (off-balance)', () => {
    const els = [
      { bbox: { x: 2, y: 25, width: 12, height: 12 } },
      { bbox: { x: 6, y: 5, width: 12, height: 12 } },
    ];
    const r = balanceMoment(els, BOX);
    expect(r.score).toBeLessThan(0.6);
    expect(r.moment.x).toBeLessThan(0); // mass biased left of center
  });
});

describe('dominance', () => {
  test('one big element dominates; equal elements do not', () => {
    expect(
      dominanceRatio([
        { bbox: { x: 0, y: 0, width: 40, height: 40 } },
        { bbox: { x: 0, y: 0, width: 10, height: 10 } },
      ])
    ).toBeCloseTo(16, 5); // 1600 / 100
    expect(
      dominanceRatio([
        { bbox: { x: 0, y: 0, width: 20, height: 20 } },
        { bbox: { x: 0, y: 0, width: 20, height: 20 } },
      ])
    ).toBeCloseTo(1, 5); // competing foci
  });
});

describe('color harmony (Cohen-Or templates)', () => {
  test('analogous hues score ~0 (harmonious); a clash scores high', () => {
    const harmonious = bestHarmony([20, 35, 50]); // tight cluster → fits a V/i wedge
    expect(harmonious.distance).toBeLessThan(5);
    const clash = bestHarmony([0, 70, 150, 250]); // scattered → no single template covers
    expect(clash.distance).toBeGreaterThan(harmonious.distance);
  });
  test('complementary pair fits the I template near 0', () => {
    const fit = bestHarmony([30, 210]); // 180° apart → complementary
    expect(fit.distance).toBeLessThan(5);
  });
  test('harmonize snaps an outlier hue into a wedge', () => {
    // template I = two 18° wedges 180° apart; rotation 30 → wedges at ~30 and ~210
    const snapped = harmonize([30, 200], 'I', 30);
    expect(snapped[0]).toBeCloseTo(30, 1); // already inside
    // 200 is outside the [201,219] wedge → clamps to the near edge (201)
    expect(Math.abs(snapped[1] - 210)).toBeLessThanOrEqual(9 + 1e-6);
  });
  test('harmonyDistance is 0 when all hues sit inside a wedge', () => {
    expect(harmonyDistance([0, 5, -5], 'i', 0)).toBeCloseTo(0, 6); // i = 18° wedge at 0
  });
});

describe('value / contrast metrics', () => {
  test('valueRange flags a washed-out (muddy) set vs a deep one', () => {
    const muddy = valueRange(['#b8a0c0', '#a0b8b0', '#c0b0a0']); // all mid-value pastels
    const deep = valueRange(['#0a0a14', '#ffe7b0']); // near-black ↔ near-white
    expect(muddy).toBeLessThan(0.2);
    expect(deep).toBeGreaterThan(0.6);
  });
  test('apcaLc: black-on-white is high, same-on-same is ~0', () => {
    expect(apcaLc('#000000', '#ffffff')).toBeGreaterThan(100);
    expect(apcaLc('#777777', '#777777')).toBeLessThan(1);
    // mid-gray text on white clears the body-min Lc 75 only when dark enough
    expect(apcaLc('#595959', '#ffffff')).toBeGreaterThan(60);
  });
});
