import { describe, expect, test } from 'bun:test';
import { path, circle, group, line, rect, text } from '../primitives.ts';
import type { DrawPrimitive } from '../primitives.ts';
import { primitivesToNodes, toJsx, toSvg } from '../serialize.ts';

const SAMPLE: DrawPrimitive[] = [
  rect({ x: 2, y: 2, width: 20, height: 20, rx: 4 }), // fillable, no paint → currentColor
  circle({ cx: 12, cy: 12, r: 6, stroke: '#333', strokeWidth: 1.5 }), // stroked → fill none
  line({ x1: 0, y1: 0, x2: 24, y2: 24 }), // bare line → stroke currentColor
  group([path({ d: 'M0 0 L4 4', fill: 'none', stroke: 'currentColor' })], {
    transform: 'translate(1 1)',
  }),
  text({ x: 12, y: 20, content: 'Hi & <there>', fontSize: 8, textAnchor: 'middle' }),
];

const OPTS = { viewBox: '0 0 24 24', a11y: { title: 'Sample mark', desc: 'A test drawing' } };

describe('toSvg', () => {
  const svg = toSvg(SAMPLE, OPTS);
  test('is a complete accessible document', () => {
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('viewBox="0 0 24 24"');
    expect(svg).toContain('role="img"');
    expect(svg).toContain('<title>Sample mark</title>');
    expect(svg).toContain('<desc>A test drawing</desc>');
  });
  test('defaults a paint-less fillable shape to currentColor', () => {
    expect(svg).toMatch(/<rect[^>]*fill="currentColor"/);
  });
  test('stroked shape with no fill gets fill="none"', () => {
    expect(svg).toMatch(/<circle[^>]*fill="none"[^>]*stroke="#333"/);
  });
  test('bare line inherits stroke currentColor', () => {
    expect(svg).toMatch(/<line[^>]*stroke="currentColor"/);
  });
  test('kebab-case attribute names + escaped text', () => {
    expect(svg).toContain('stroke-width="1.5"');
    expect(svg).toContain('text-anchor="middle"');
    expect(svg).toContain('Hi &amp; &lt;there&gt;');
  });
  test('self-closes leaf shapes', () => {
    expect(svg).toMatch(/<rect[^>]*\/>/);
  });
});

describe('toJsx', () => {
  const jsx = toJsx(SAMPLE, OPTS);
  test('uses camelCase attribute dialect', () => {
    expect(jsx).toContain('strokeWidth="1.5"');
    expect(jsx).toContain('textAnchor="middle"');
  });
  test('omits the xmlns document marker', () => {
    expect(jsx).not.toContain('xmlns=');
  });
  test('keeps viewBox + role + title', () => {
    expect(jsx).toContain('viewBox="0 0 24 24"');
    expect(jsx).toContain('role="img"');
    expect(jsx).toContain('<title>Sample mark</title>');
  });
});

describe('SVG ↔ JSX parity (the single-source invariant)', () => {
  const svg = toSvg(SAMPLE, OPTS);
  const jsx = toJsx(SAMPLE, OPTS);

  const openTags = (s: string): string[] =>
    Array.from(s.matchAll(/<([a-zA-Z][a-zA-Z0-9]*)/g), (m) => m[1]);
  const numbers = (s: string): number[] =>
    Array.from(s.replace(/\sxmlns="[^"]*"/, '').matchAll(/-?\d+\.?\d*/g), (m) => Number(m[0])).sort(
      (a, b) => a - b
    );

  test('identical element sequence', () => {
    expect(openTags(jsx)).toEqual(openTags(svg));
  });
  test('identical geometry (number multiset, ignoring xmlns)', () => {
    expect(numbers(jsx)).toEqual(numbers(svg));
  });
  test('both built from one node tree (primitivesToNodes)', () => {
    const root = primitivesToNodes(SAMPLE, OPTS);
    expect(root.tag).toBe('svg');
    // title + desc + 5 primitives
    expect(root.children.map((c) => c.tag)).toEqual([
      'title',
      'desc',
      'rect',
      'circle',
      'line',
      'g',
      'text',
    ]);
  });
});

describe('decorative a11y', () => {
  test('decorative marks get aria-hidden and no title/desc/role', () => {
    const svg = toSvg([circle({ cx: 12, cy: 12, r: 6 })], {
      viewBox: '0 0 24 24',
      a11y: { decorative: true },
    });
    expect(svg).toContain('aria-hidden="true"');
    expect(svg).not.toContain('role="img"');
    expect(svg).not.toContain('<title>');
  });
});
