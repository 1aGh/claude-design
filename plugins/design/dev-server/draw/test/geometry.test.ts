import { describe, expect, test } from 'bun:test';
import {
  EQUAL_AREA_CIRCLE_SCALE,
  centroid,
  centroidCenter,
  chamferCorners,
  convexHull,
  equalWeightCircleDiameter,
  overshoot,
  pchipEval,
  pchipPath,
  pchipSlopes,
  polygonArea,
  routeConnector,
  simplifyCollinear,
} from '../geometry.ts';
import type { Point } from '../primitives.ts';

describe('PCHIP monotone interpolation', () => {
  const xs = [0, 1, 2, 3, 4];
  const ys = [0, 0, 1, 1, 2]; // monotone non-decreasing, with flats

  test('slopes are non-negative for monotone-increasing data', () => {
    const m = pchipSlopes(xs, ys);
    expect(m.every((s) => s >= -1e-12)).toBe(true);
  });

  test('interpolant never overshoots the data envelope (the whole point vs Bézier)', () => {
    const lo = Math.min(...ys);
    const hi = Math.max(...ys);
    let prev = Number.NEGATIVE_INFINITY;
    for (let i = 0; i <= 200; i++) {
      const x = (i / 200) * 4;
      const v = pchipEval(xs, ys, x);
      expect(v).toBeGreaterThanOrEqual(lo - 1e-9);
      expect(v).toBeLessThanOrEqual(hi + 1e-9);
      expect(v).toBeGreaterThanOrEqual(prev - 1e-9); // monotone non-decreasing
      prev = v;
    }
  });

  test('passes through every knot', () => {
    for (let i = 0; i < xs.length; i++) {
      expect(pchipEval(xs, ys, xs[i])).toBeCloseTo(ys[i], 9);
    }
  });

  test('pchipPath produces an M…C… cubic string', () => {
    const d = pchipPath([
      { x: 0, y: 0 },
      { x: 1, y: 2 },
      { x: 2, y: 1 },
    ]);
    expect(d.startsWith('M')).toBe(true);
    expect(d).toContain('C');
  });

  test('clamps outside the domain', () => {
    expect(pchipEval(xs, ys, -5)).toBe(0);
    expect(pchipEval(xs, ys, 99)).toBe(2);
  });
});

describe('polygon helpers', () => {
  const square: Point[] = [
    { x: 0, y: 0 },
    { x: 2, y: 0 },
    { x: 2, y: 2 },
    { x: 0, y: 2 },
  ];

  test('polygonArea (abs) of a 2×2 square is 4', () => {
    expect(Math.abs(polygonArea(square))).toBeCloseTo(4, 9);
  });
  test('centroid of a square is its center', () => {
    const c = centroid(square);
    expect(c.x).toBeCloseTo(1, 9);
    expect(c.y).toBeCloseTo(1, 9);
  });
  test('convex hull drops interior points', () => {
    const pts: Point[] = [...square, { x: 1, y: 1 }];
    const hull = convexHull(pts);
    expect(hull).toHaveLength(4);
    expect(hull.some((p) => p.x === 1 && p.y === 1)).toBe(false);
  });
});

describe('optical corrections', () => {
  test('equal-area circle scale ≈ 1.1284', () => {
    expect(EQUAL_AREA_CIRCLE_SCALE).toBeCloseTo(1.1284, 3);
    expect(equalWeightCircleDiameter(100)).toBeCloseTo(112.84, 1);
  });
  test('overshoot grows extent by ratio', () => {
    expect(overshoot(100, 0.02)).toBeCloseTo(102, 9);
  });
  test('centroidCenter offsets a triangle so its centroid hits the target', () => {
    // Right triangle — bbox center (1,1) differs from centroid (2/3, 2/3).
    const tri: Point[] = [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 0, y: 2 },
    ];
    const { dx, dy } = centroidCenter(tri, 12, 12);
    const moved = tri.map((p) => ({ x: p.x + dx, y: p.y + dy }));
    const c = centroid(moved);
    expect(c.x).toBeCloseTo(12, 6);
    expect(c.y).toBeCloseTo(12, 6);
  });
});

describe('A* connector routing', () => {
  test('clear field routes essentially straight', () => {
    const pts = routeConnector({ x: 0, y: 0 }, { x: 100, y: 0 }, [], { grid: 10 });
    expect(pts[0]).toEqual({ x: 0, y: 0 });
    expect(pts[pts.length - 1]).toEqual({ x: 100, y: 0 });
    expect(pts.every((p) => Math.abs(p.y) < 1e-6)).toBe(true);
    expect(pts.length).toBe(2); // collapsed to a single straight run
  });

  test('routes around an obstacle without entering it', () => {
    const obstacle = { x: 40, y: -20, width: 20, height: 40 };
    const pts = routeConnector({ x: 0, y: 0 }, { x: 100, y: 0 }, [obstacle], { grid: 10 });
    expect(pts[0]).toEqual({ x: 0, y: 0 });
    expect(pts[pts.length - 1]).toEqual({ x: 100, y: 0 });
    const inside = (p: Point) =>
      p.x > obstacle.x &&
      p.x < obstacle.x + obstacle.width &&
      p.y > obstacle.y &&
      p.y < obstacle.y + obstacle.height;
    expect(pts.some(inside)).toBe(false);
    expect(pts.length).toBeGreaterThan(2); // had to bend
  });

  test('is deterministic', () => {
    const obstacle = { x: 40, y: -20, width: 20, height: 40 };
    const a = routeConnector({ x: 0, y: 0 }, { x: 100, y: 0 }, [obstacle], { grid: 10 });
    const b = routeConnector({ x: 0, y: 0 }, { x: 100, y: 0 }, [obstacle], { grid: 10 });
    expect(a).toEqual(b);
  });
});

describe('path post-processing', () => {
  test('simplifyCollinear removes mid points on a straight run', () => {
    const out = simplifyCollinear([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 2 },
    ]);
    expect(out).toEqual([
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 2 },
    ]);
  });
  test('chamferCorners replaces a corner with two offset points', () => {
    const out = chamferCorners(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ],
      2
    );
    expect(out.length).toBe(4); // 2 endpoints + 2 chamfer points for 1 corner
    expect(out[0]).toEqual({ x: 0, y: 0 });
    expect(out[out.length - 1]).toEqual({ x: 10, y: 10 });
  });
});
