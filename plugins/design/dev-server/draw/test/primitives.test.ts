import { describe, expect, test } from 'bun:test';
import {
  VIEWBOX,
  boxViewBox,
  circle,
  group,
  line,
  place,
  polygon,
  rect,
  snap,
  squareViewBox,
  text,
  transformString,
  use,
} from '../primitives.ts';

describe('snap', () => {
  test('grid 0 is a no-op (optical adjustments survive)', () => {
    expect(snap(12.34)).toBe(12.34);
    expect(snap(12.34, 0)).toBe(12.34);
  });
  test('snaps to nearest multiple', () => {
    expect(snap(13, 8)).toBe(16);
    expect(snap(11, 8)).toBe(8);
    expect(snap(7, 4)).toBe(8);
    expect(snap(5, 4)).toBe(4);
  });
});

describe('constructors', () => {
  test('rect carries geometry + style', () => {
    const r = rect({ x: 1, y: 2, width: 10, height: 20, rx: 3, fill: '#abc' });
    expect(r).toMatchObject({ el: 'rect', x: 1, y: 2, width: 10, height: 20, rx: 3, fill: '#abc' });
  });
  test('rect snaps geometry to grid when requested', () => {
    const r = rect({ x: 3, y: 5, width: 13, height: 21, grid: 8 }) as {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    expect(r.x).toBe(0);
    expect(r.y).toBe(8);
    expect(r.width).toBe(16);
    expect(r.height).toBe(24);
  });
  test('grid is not leaked as a primitive field', () => {
    const r = rect({ x: 0, y: 0, width: 8, height: 8, grid: 8 }) as Record<string, unknown>;
    expect(r.grid).toBeUndefined();
  });
  test('circle / line / polygon shapes', () => {
    expect(circle({ cx: 12, cy: 12, r: 6 })).toMatchObject({ el: 'circle', cx: 12, cy: 12, r: 6 });
    expect(line({ x1: 0, y1: 0, x2: 4, y2: 4 })).toMatchObject({ el: 'line', x2: 4 });
    const poly = polygon({
      points: [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 2, y: 4 },
      ],
    }) as {
      points: Array<{ x: number }>;
    };
    expect(poly.points).toHaveLength(3);
  });
  test('text carries content + type attrs', () => {
    const t = text({
      x: 0,
      y: 0,
      content: 'Hi',
      fontSize: 16,
      fontWeight: 700,
      textAnchor: 'middle',
    });
    expect(t).toMatchObject({
      el: 'text',
      content: 'Hi',
      fontSize: 16,
      fontWeight: 700,
      textAnchor: 'middle',
    });
  });
  test('use references a symbol id', () => {
    expect(use({ href: '#leaf', x: 2, y: 4 })).toMatchObject({
      el: 'use',
      href: '#leaf',
      x: 2,
      y: 4,
    });
  });
});

describe('transform composition', () => {
  test('transformString emits canonical translate→rotate→scale, skipping identity', () => {
    expect(transformString({})).toBe('');
    expect(transformString({ x: 4, y: 6 })).toBe('translate(4 6)');
    expect(transformString({ rotate: 45 })).toBe('rotate(45)');
    expect(transformString({ rotate: 45, originX: 12, originY: 12 })).toBe('rotate(45 12 12)');
    expect(transformString({ x: 2, scale: 1.5, rotate: 90 })).toBe(
      'translate(2 0) rotate(90) scale(1.5)'
    );
  });
  test('place wraps children in a transformed group', () => {
    const g = place([circle({ cx: 0, cy: 0, r: 1 })], { x: 10, y: 10 }) as {
      el: string;
      transform: string;
      children: unknown[];
    };
    expect(g.el).toBe('group');
    expect(g.transform).toBe('translate(10 10)');
    expect(g.children).toHaveLength(1);
  });
  test('group passes opacity + id', () => {
    const g = group([], { opacity: 0.5, id: 'x' }) as { opacity: number; id: string };
    expect(g.opacity).toBe(0.5);
    expect(g.id).toBe('x');
  });
});

describe('viewBox presets', () => {
  test('square / box helpers', () => {
    expect(squareViewBox(24)).toBe('0 0 24 24');
    expect(boxViewBox(1200, 630)).toBe('0 0 1200 630');
  });
  test('named presets', () => {
    expect(VIEWBOX.icon).toBe('0 0 24 24');
    expect(VIEWBOX.logo).toBe('0 0 64 64');
  });
});
