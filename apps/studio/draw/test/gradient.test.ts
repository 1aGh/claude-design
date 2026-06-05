import { describe, expect, test } from 'bun:test';
import { optimizeSvg } from '../optimize.ts';
import {
  blurFilter,
  circle,
  clipPath,
  defs,
  dropShadowFilter,
  fe,
  filter,
  grainFilter,
  group,
  linearGradient,
  mask,
  pattern,
  radialGradient,
  rect,
} from '../primitives.ts';
import { toJsx, toSvg } from '../serialize.ts';

describe('gradients', () => {
  const prims = [
    defs([
      linearGradient({
        id: 'sky',
        x1: 0,
        y1: 0,
        x2: 0,
        y2: 1,
        stops: [
          { offset: 0, color: '#0b1026' },
          { offset: 1, color: '#f5a623', opacity: 0.9 },
        ],
      }),
      radialGradient({
        id: 'sun',
        cx: 0.5,
        cy: 0.5,
        r: 0.5,
        stops: [
          { offset: 0, color: '#fff' },
          { offset: 1, color: '#fff', opacity: 0 },
        ],
      }),
    ]),
    rect({ x: 0, y: 0, width: 100, height: 60, fill: 'url(#sky)' }),
  ];
  const opts = { viewBox: '0 0 100 60' };

  test('toSvg emits linear + radial gradients with kebab stop-color', () => {
    const svg = toSvg(prims, opts);
    expect(svg).toContain('<linearGradient id="sky"');
    expect(svg).toContain('<radialGradient id="sun"');
    expect(svg).toMatch(/<stop offset="0" stop-color="#0b1026"\s*\/>/);
    expect(svg).toContain('stop-opacity="0.9"');
    expect(svg).toContain('fill="url(#sky)"');
  });

  test('toJsx uses camelCase stopColor / stopOpacity', () => {
    const jsx = toJsx(prims, opts);
    expect(jsx).toContain('stopColor="#0b1026"');
    expect(jsx).toContain('stopOpacity="0.9"');
    expect(jsx).not.toContain('stop-color');
  });

  test('gradient SVG passes the SVGO validity gate', () => {
    expect(() => optimizeSvg(toSvg(prims, opts))).not.toThrow();
  });
});

describe('filters / patterns / masks / blend (design toolkit)', () => {
  test('blur + drop-shadow + grain filters serialize with correct fe primitives', () => {
    const prims = [
      defs([
        blurFilter('b', 4),
        dropShadowFilter('sh', { dy: 3, blur: 4 }),
        grainFilter('grain', { opacity: 0.4 }),
      ]),
      circle({ cx: 50, cy: 50, r: 20, fill: '#333', filter: 'url(#sh)' }),
    ];
    const svg = toSvg(prims, { viewBox: '0 0 100 100' });
    expect(svg).toContain('<feGaussianBlur');
    expect(svg).toContain('stdDeviation="4"');
    expect(svg).toContain('<feDropShadow');
    expect(svg).toContain('flood-opacity="0.3"'); // kebab in SVG dialect
    expect(svg).toContain('<feTurbulence');
    expect(svg).toContain('type="fractalNoise"');
    expect(svg).toContain('filter="url(#sh)"');
    expect(optimizeSvg(svg)).toBeTruthy(); // validity gate
  });

  test('JSX dialect: floodColor camelCase + feMerge children', () => {
    const f = filter('m', [
      fe('feGaussianBlur', { stdDeviation: 2, result: 'blur' }),
      fe('feMerge', undefined, [
        fe('feMergeNode', { in: 'blur' }),
        fe('feMergeNode', { in: 'SourceGraphic' }),
      ]),
    ]);
    const jsx = toJsx([defs([f, dropShadowFilter('sh')])], { viewBox: '0 0 10 10' });
    expect(jsx).toContain('<feMerge>');
    expect(jsx).toContain('<feMergeNode');
    expect(jsx).toContain('floodColor='); // camelCase in JSX
    expect(jsx).not.toContain('flood-color');
  });

  test('pattern tile fills via url()', () => {
    const prims = [
      defs([
        pattern({
          id: 'dots',
          width: 8,
          height: 8,
          children: [circle({ cx: 2, cy: 2, r: 1, fill: '#888' })],
        }),
      ]),
      rect({ x: 0, y: 0, width: 64, height: 64, fill: 'url(#dots)' }),
    ];
    const svg = toSvg(prims, { viewBox: '0 0 64 64' });
    expect(svg).toContain('<pattern id="dots" width="8" height="8" patternUnits="userSpaceOnUse"');
    expect(svg).toContain('fill="url(#dots)"');
    expect(optimizeSvg(svg)).toBeTruthy();
  });

  test('mask + clipPath defs serialize, and mix-blend-mode emits dialect style', () => {
    const prims = [
      defs([
        mask('fade', [rect({ x: 0, y: 0, width: 100, height: 100, fill: 'url(#g)' })]),
        clipPath('round', [circle({ cx: 50, cy: 50, r: 40 })]),
      ]),
      group([rect({ x: 0, y: 0, width: 100, height: 100, fill: '#f00' })], {}),
      rect({
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        fill: '#0f0',
        mask: 'url(#fade)',
        clipPath: 'url(#round)',
        mixBlendMode: 'overlay',
      }),
    ];
    const svg = toSvg(prims, { viewBox: '0 0 100 100' });
    expect(svg).toContain('<mask id="fade">');
    expect(svg).toContain('<clipPath id="round">');
    expect(svg).toContain('mask="url(#fade)"');
    expect(svg).toContain('clip-path="url(#round)"'); // kebab in SVG
    expect(svg).toContain('style="mix-blend-mode:overlay"');
    const jsx = toJsx(prims, { viewBox: '0 0 100 100' });
    expect(jsx).toContain('clipPath="url(#round)"'); // camelCase in JSX
    expect(jsx).toContain('style={{ mixBlendMode: "overlay" }}');
  });

  test('group carries the compositing surface (filter + mask + blend)', () => {
    const g = group([circle({ cx: 10, cy: 10, r: 5 })], {
      filter: 'url(#warp)',
      mask: 'url(#fade)',
      mixBlendMode: 'screen',
    });
    const svg = toSvg([g], { viewBox: '0 0 20 20' });
    expect(svg).toMatch(/<g[^>]*filter="url\(#warp\)"/);
    expect(svg).toContain('mask="url(#fade)"');
    expect(svg).toContain('style="mix-blend-mode:screen"');
    // a group must never leak a stroke default (it's not a fillable shape)
    expect(svg).not.toMatch(/<g[^>]*stroke=/);
  });
});
