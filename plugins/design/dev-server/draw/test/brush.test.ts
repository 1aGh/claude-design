import { describe, expect, test } from 'bun:test';
import {
  brushStroke,
  contourLines,
  crossHatch,
  engraveLines,
  hatch,
  roughenFilter,
  scatterAlong,
  stippleFill,
} from '../brush.ts';
import type { Point } from '../primitives.ts';
import { circle } from '../primitives.ts';
import { toSvg } from '../serialize.ts';

const LINE: Point[] = [
  { x: 10, y: 50 },
  { x: 40, y: 20 },
  { x: 70, y: 60 },
  { x: 100, y: 40 },
];

describe('L1 roughenFilter', () => {
  test('emits a feTurbulence → feDisplacementMap chain', () => {
    const svg = toSvg([roughenFilter('rough', { scale: 6 })], { viewBox: '0 0 10 10' });
    expect(svg).toContain('<filter id="rough"');
    expect(svg).toContain('<feTurbulence');
    expect(svg).toContain('<feDisplacementMap');
    expect(svg).toContain('scale="6"');
  });
});

describe('L2 brushStroke (variable width → filled outline)', () => {
  test('is a closed filled path, not a stroke', () => {
    const p = brushStroke(LINE, { width: 14, taper: 'both' }) as {
      el: string;
      d: string;
      fill?: string;
      stroke?: string;
    };
    expect(p.el).toBe('path');
    expect(p.d.startsWith('M')).toBe(true);
    expect(p.d).toContain('C'); // smoothed
    expect(p.d.trimEnd().endsWith('Z')).toBe(true); // closed outline
    expect(p.fill).toBe('currentColor'); // filled, default theme color
    expect(p.stroke).toBeUndefined(); // NOT an svg stroke
  });
  test('taper "both" → pointed ends (start ≈ end ≈ centerline endpoints)', () => {
    const p = brushStroke(LINE, { width: 20, taper: 'both' }) as { d: string };
    // first move-to should be ~ the first centerline point (half-width ≈ 0 at t=0)
    const m = /^M([-\d.]+) ([-\d.]+)/.exec(p.d);
    expect(m).not.toBeNull();
    const x0 = Number((m as RegExpExecArray)[1]);
    const y0 = Number((m as RegExpExecArray)[2]);
    expect(Math.hypot(x0 - 10, y0 - 50)).toBeLessThan(2);
  });
  test('a custom pressure profile is honored', () => {
    const d1 = (brushStroke(LINE, { width: 16, profile: () => 1 }) as { d: string }).d;
    const d2 = (brushStroke(LINE, { width: 16, profile: () => 0.2 }) as { d: string }).d;
    expect(d1).not.toBe(d2); // thinner profile → different outline
  });
  test('deterministic', () => {
    expect((brushStroke(LINE, { width: 12 }) as { d: string }).d).toBe(
      (brushStroke(LINE, { width: 12 }) as { d: string }).d
    );
  });
});

describe('L3 scatterAlong (stamp along a path)', () => {
  test('produces `count` stamped groups, deterministic for a seed', () => {
    const make = () => circle({ cx: 0, cy: 0, r: 3, fill: '#333' });
    const g1 = scatterAlong(LINE, make, { count: 8, jitter: 4, scaleVar: 0.3, seed: 5 }) as {
      el: string;
      children: unknown[];
    };
    expect(g1.el).toBe('group');
    expect(g1.children).toHaveLength(8);
    const g2 = scatterAlong(LINE, make, { count: 8, jitter: 4, scaleVar: 0.3, seed: 5 });
    expect(JSON.stringify(g1)).toBe(JSON.stringify(g2)); // deterministic
    const g3 = scatterAlong(LINE, make, { count: 8, jitter: 4, scaleVar: 0.3, seed: 6 });
    expect(JSON.stringify(g1)).not.toBe(JSON.stringify(g3)); // seed changes layout
  });
  test('stamps carry a transform (placed along the path)', () => {
    const g = scatterAlong(LINE, () => circle({ cx: 0, cy: 0, r: 2 }), { count: 3 }) as {
      children: Array<{ transform?: string }>;
    };
    for (const s of g.children) expect(s.transform).toContain('translate(');
  });
  test('align rotates stamps to the tangent', () => {
    const g = scatterAlong(LINE, () => circle({ cx: 0, cy: 0, r: 2 }), {
      count: 4,
      align: true,
    }) as {
      children: Array<{ transform?: string }>;
    };
    expect(g.children.some((s) => (s.transform ?? '').includes('rotate('))).toBe(true);
  });
});

describe('L4 hatch / crossHatch (engraving line shading)', () => {
  const region = { x: 0, y: 0, width: 100, height: 60 };
  test('hatch fills a region with parallel lines; tighter spacing = more lines (darker)', () => {
    const sparse = hatch(region, { angle: 45, spacing: 12 }) as {
      el: string;
      children: Array<{ el: string }>;
    };
    const dense = hatch(region, { angle: 45, spacing: 4 }) as { children: unknown[] };
    expect(sparse.el).toBe('group');
    expect(sparse.children.every((c) => c.el === 'line')).toBe(true);
    expect(dense.children.length).toBeGreaterThan(sparse.children.length);
  });
  test('weightVar makes alternating lines differ in width (burin swell)', () => {
    const g = hatch(region, { spacing: 8, weight: 1, weightVar: 0.5 }) as {
      children: Array<{ strokeWidth?: number }>;
    };
    const widths = new Set(g.children.map((c) => c.strokeWidth));
    expect(widths.size).toBeGreaterThan(1);
  });
  test('crossHatch is two hatch groups at different angles', () => {
    const g = crossHatch(region, { angle: 30, spacing: 8 }) as { children: Array<{ el: string }> };
    expect(g.children).toHaveLength(2);
    expect(g.children.every((c) => c.el === 'group')).toBe(true);
  });
});

describe('L5 contourLines + stippleFill (form-following engraving + graded tone)', () => {
  test('contourLines emits one offset path per offset, following the stroke', () => {
    const g = contourLines(
      [
        { x: 0, y: 0 },
        { x: 50, y: 10 },
        { x: 100, y: 0 },
      ],
      { offsets: [-8, -4, 0, 4, 8], color: '#caa' }
    ) as { el: string; children: Array<{ el: string; d: string; stroke?: string; fill?: string }> };
    expect(g.children).toHaveLength(5);
    expect(
      g.children.every((c) => c.el === 'path' && c.fill === 'none' && c.stroke === '#caa')
    ).toBe(true);
    expect(g.children[0].d.startsWith('M')).toBe(true);
    expect(g.children[0].d).toContain('C'); // smooth
  });
  test('contourLines count+spacing centers the family on the stroke; deterministic', () => {
    const a = contourLines(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
      { count: 6, spacing: 5 }
    ) as { children: unknown[] };
    expect(a.children).toHaveLength(6);
    expect(
      JSON.stringify(
        contourLines(
          [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
          ],
          { count: 6, spacing: 5 }
        )
      )
    ).toBe(JSON.stringify(a));
  });
  test('stippleFill density grades the dot count (light vs dark) + deterministic', () => {
    const region = { x: 0, y: 0, width: 100, height: 100 };
    const dark = stippleFill(region, { dots: 400, density: () => 1, seed: 3 }) as {
      children: unknown[];
    };
    const light = stippleFill(region, { dots: 400, density: () => 0.1, seed: 3 }) as {
      children: unknown[];
    };
    expect(dark.children.length).toBeGreaterThan(light.children.length * 3);
    expect(JSON.stringify(stippleFill(region, { dots: 400, density: () => 1, seed: 3 }))).toBe(
      JSON.stringify(dark)
    );
  });
  test('stippleFill dots land inside the region', () => {
    const g = stippleFill({ x: 10, y: 20, width: 80, height: 60 }, { dots: 100, seed: 2 }) as {
      children: Array<{ cx: number; cy: number }>;
    };
    for (const d of g.children) {
      expect(d.cx).toBeGreaterThanOrEqual(10);
      expect(d.cx).toBeLessThanOrEqual(90);
      expect(d.cy).toBeGreaterThanOrEqual(20);
      expect(d.cy).toBeLessThanOrEqual(80);
    }
  });
});

describe('L6 engraveLines (organic per-line burin marks)', () => {
  const stroke = [
    { x: 0, y: 0 },
    { x: 60, y: 8 },
    { x: 120, y: 0 },
  ];
  test('each line is a tapered filled brushStroke (closed path), deterministic', () => {
    const g = engraveLines(stroke, { count: 8, spacing: 5, seed: 4 }) as {
      el: string;
      children: Array<{ el: string; d: string; fill?: string }>;
    };
    expect(g.el).toBe('group');
    expect(g.children.length).toBeGreaterThan(4);
    expect(g.children.every((c) => c.el === 'path' && c.d.trimEnd().endsWith('Z'))).toBe(true); // filled outline, not stroke
    expect(JSON.stringify(engraveLines(stroke, { count: 8, spacing: 5, seed: 4 }))).toBe(
      JSON.stringify(g)
    );
  });
  test('different seeds → different (jittered) output', () => {
    expect(JSON.stringify(engraveLines(stroke, { count: 8, seed: 1 }))).not.toBe(
      JSON.stringify(engraveLines(stroke, { count: 8, seed: 2 }))
    );
  });
});
