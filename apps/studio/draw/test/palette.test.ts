import { describe, expect, test } from 'bun:test';
import {
  CURRENT_COLOR,
  colorDistribution,
  contrastRatio,
  isPerceptuallyEven,
  meetsWcag,
  oklchRamp,
  oklchToRgb,
  parseColor,
  parseOklch,
  relativeLuminance,
  toHex,
} from '../palette.ts';

describe('parsing', () => {
  test('hex (short + long)', () => {
    expect(parseColor('#fff')).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseColor('#000000')).toEqual({ r: 0, g: 0, b: 0 });
    expect(parseColor('#1a2b3c')).toEqual({ r: 26, g: 43, b: 60 });
  });
  test('rgb()', () => {
    expect(parseColor('rgb(10, 20, 30)')).toEqual({ r: 10, g: 20, b: 30 });
  });
  test('rejects junk', () => {
    expect(() => parseColor('chartreuse')).toThrow();
  });
  test('oklch', () => {
    const o = parseOklch('oklch(70% 0.1 250)');
    expect(o.l).toBeCloseTo(0.7, 6);
    expect(o.c).toBeCloseTo(0.1, 6);
    expect(o.h).toBeCloseTo(250, 6);
  });
});

describe('WCAG contrast', () => {
  test('black on white is 21:1', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
  });
  test('order independent', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 1);
  });
  test('#767676 on white ≈ 4.54 (the AA reference gray)', () => {
    expect(contrastRatio('#767676', '#ffffff')).toBeCloseTo(4.54, 1);
  });
  test('relativeLuminance bounds', () => {
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 6);
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 6);
  });
  test('meetsWcag thresholds', () => {
    expect(meetsWcag(4.5)).toBe(true);
    expect(meetsWcag(4.49)).toBe(false);
    expect(meetsWcag(3.2, { large: true })).toBe(true);
    expect(meetsWcag(3.2, { nonText: true })).toBe(true);
    expect(meetsWcag(6.9, { level: 'AAA' })).toBe(false);
    expect(meetsWcag(7.1, { level: 'AAA' })).toBe(true);
  });
});

describe('OKLCH → sRGB', () => {
  test('achromatic extremes', () => {
    expect(oklchToRgb({ l: 1, c: 0, h: 0 })).toEqual({ r: 255, g: 255, b: 255 });
    expect(oklchToRgb({ l: 0, c: 0, h: 0 })).toEqual({ r: 0, g: 0, b: 0 });
  });
  test('mid achromatic is neutral gray (r=g=b)', () => {
    const g = oklchToRgb({ l: 0.5, c: 0, h: 0 });
    expect(g.r).toBe(g.g);
    expect(g.g).toBe(g.b);
    expect(g.r).toBeGreaterThan(70);
    expect(g.r).toBeLessThan(150);
  });
  test('a red-ish hue makes red the dominant channel', () => {
    const red = oklchToRgb({ l: 0.63, c: 0.25, h: 29 });
    expect(red.r).toBeGreaterThan(red.g);
    expect(red.r).toBeGreaterThan(red.b);
  });
  test('round-trips through hex', () => {
    expect(toHex(oklchToRgb({ l: 1, c: 0, h: 0 }))).toBe('#ffffff');
  });
});

describe('ramps', () => {
  test('evenly spaced lightness', () => {
    const ramp = oklchRamp({ hue: 250, chroma: 0.1, count: 5, lMax: 0.9, lMin: 0.3 });
    expect(ramp).toHaveLength(5);
    expect(ramp[0].l).toBeCloseTo(0.9, 6);
    expect(ramp[4].l).toBeCloseTo(0.3, 6);
    expect(isPerceptuallyEven(ramp)).toBe(true);
  });
  test('detects an uneven ramp', () => {
    const uneven = [
      { l: 0.9, c: 0.1, h: 0 },
      { l: 0.85, c: 0.1, h: 0 },
      { l: 0.4, c: 0.1, h: 0 },
    ];
    expect(isPerceptuallyEven(uneven)).toBe(false);
  });
});

describe('60-30-10 distribution', () => {
  test('passes when accent ≤ 15%', () => {
    const r = colorDistribution([
      { role: 'dominant', area: 60 },
      { role: 'secondary', area: 30 },
      { role: 'accent', area: 10 },
    ]);
    expect(r.ok).toBe(true);
    expect(r.accentRatio).toBeCloseTo(0.1, 6);
    expect(r.dominantRole).toBe('dominant');
  });
  test('fails when accent dominates', () => {
    const r = colorDistribution([
      { role: 'base', area: 50 },
      { role: 'accent', area: 50 },
    ]);
    expect(r.ok).toBe(false);
    expect(r.accentRatio).toBeCloseTo(0.5, 6);
  });
});

test('CURRENT_COLOR constant', () => {
  expect(CURRENT_COLOR).toBe('currentColor');
});
