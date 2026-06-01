import { describe, expect, test } from 'bun:test';
import { isValidSvg, optimizeSvg } from '../optimize.ts';
import { rect } from '../primitives.ts';
import { toSvg } from '../serialize.ts';

describe('optimizeSvg', () => {
  test('round-trips a known mark and stays valid', () => {
    const svg = toSvg([rect({ x: 2, y: 2, width: 20, height: 20, fill: '#aabbcc' })], {
      viewBox: '0 0 24 24',
      a11y: { title: 'Square', desc: 'A rounded square' },
    });
    const out = optimizeSvg(svg);
    expect(out).toContain('viewBox="0 0 24 24"');
    expect(out).toContain('<title>Square</title>');
    expect(out).toContain('<desc>A rounded square</desc>');
    expect(isValidSvg(out)).toBe(true);
  });

  test('preserves the a11y + scaling contract (viewBox / title / desc kept)', () => {
    const src =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><title>T</title><desc>D</desc><circle cx="5" cy="5" r="4"/></svg>';
    const out = optimizeSvg(src);
    expect(out).toContain('viewBox="0 0 10 10"');
    expect(out).toContain('<title>T</title>');
    expect(out).toContain('<desc>D</desc>');
  });

  test('shrinks coordinate precision', () => {
    const src =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M1.23456789 2 L4 4"/></svg>';
    const out = optimizeSvg(src, { floatPrecision: 2 });
    expect(out).not.toContain('1.23456789');
  });

  test('throws on malformed SVG (the validity gate)', () => {
    expect(() => optimizeSvg('<svg><rect')).toThrow(/not valid SVG/);
    expect(isValidSvg('<svg><rect')).toBe(false);
    expect(isValidSvg('not svg at all <<<')).toBe(false);
  });
});
