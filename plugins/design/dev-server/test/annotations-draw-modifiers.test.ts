// annotations-layer — draw-time resize modifiers (constrainDrawBox +
// applyDrawModifiers). FigJam parity: Shift = 1:1, Alt = from-center, applied
// while CREATING a shape (not just resizing an existing one). Pure functions.

import { describe, expect, test } from 'bun:test';

import {
  type ArrowStroke,
  applyDrawModifiers,
  constrainDrawBox,
  type EllipseStroke,
  type PenStroke,
  type PolygonStroke,
  type RectStroke,
  type StickyStroke,
} from '../annotations-layer.tsx';

const NONE = { shift: false, alt: false };

describe('constrainDrawBox', () => {
  test('no modifiers — corner drag from the anchor (back-compat)', () => {
    expect(constrainDrawBox(10, 20, 110, 70, NONE)).toEqual({ x: 10, y: 20, w: 100, h: 50 });
  });

  test('Shift — locks to a square via the dominant axis, keeps sign', () => {
    expect(constrainDrawBox(0, 0, 120, 200, { shift: true, alt: false })).toEqual({
      x: 0,
      y: 0,
      w: 200,
      h: 200,
    });
    expect(constrainDrawBox(0, 0, -120, -200, { shift: true, alt: false })).toEqual({
      x: 0,
      y: 0,
      w: -200,
      h: -200,
    });
  });

  test('Alt — grows from the anchor as center', () => {
    const b = constrainDrawBox(50, 50, 120, 80, { shift: false, alt: true });
    expect(b).toEqual({ x: -20, y: 20, w: 140, h: 60 });
    expect(b.x + b.w / 2).toBe(50); // center invariant
    expect(b.y + b.h / 2).toBe(50);
  });

  test('Shift+Alt — centered square', () => {
    expect(constrainDrawBox(0, 0, 120, 200, { shift: true, alt: true })).toEqual({
      x: -200,
      y: -200,
      w: 400,
      h: 400,
    });
  });
});

describe('applyDrawModifiers / rect + polygon', () => {
  const rect: RectStroke = {
    id: 'r',
    tool: 'rect',
    color: '#000',
    width: 2,
    x: 0,
    y: 0,
    w: 0,
    h: 0,
  };
  const poly: PolygonStroke = {
    id: 'p',
    tool: 'polygon',
    shape: 'triangle',
    color: '#000',
    width: 2,
    x: 0,
    y: 0,
    w: 0,
    h: 0,
  };
  test('rect no-mod corner drag', () => {
    expect(applyDrawModifiers(rect, { x: 0, y: 0 }, 100, 50, NONE)).toMatchObject({
      x: 0,
      y: 0,
      w: 100,
      h: 50,
    });
  });
  test('rect Shift → square', () => {
    expect(
      applyDrawModifiers(rect, { x: 0, y: 0 }, 100, 50, { shift: true, alt: false })
    ).toMatchObject({ w: 100, h: 100 });
  });
  test('polygon Alt → centered, preserves shape discriminant', () => {
    const out = applyDrawModifiers(poly, { x: 50, y: 50 }, 120, 80, {
      shift: false,
      alt: true,
    }) as PolygonStroke;
    expect(out).toMatchObject({ x: -20, y: 20, w: 140, h: 60, shape: 'triangle' });
  });
});

describe('applyDrawModifiers / ellipse', () => {
  const ell: EllipseStroke = {
    id: 'e',
    tool: 'ellipse',
    color: '#000',
    width: 2,
    cx: 0,
    cy: 0,
    rx: 0,
    ry: 0,
  };
  test('no-mod — corner drag (bbox 0..100 × 0..50)', () => {
    expect(applyDrawModifiers(ell, { x: 0, y: 0 }, 100, 50, NONE)).toMatchObject({
      cx: 50,
      cy: 25,
      rx: 50,
      ry: 25,
    });
  });
  test('Alt — centered on the anchor', () => {
    expect(
      applyDrawModifiers(ell, { x: 50, y: 50 }, 120, 80, { shift: false, alt: true })
    ).toMatchObject({ cx: 50, cy: 50, rx: 70, ry: 30 });
  });
  test('Shift — circle (rx === ry)', () => {
    const out = applyDrawModifiers(ell, { x: 0, y: 0 }, 100, 40, {
      shift: true,
      alt: false,
    }) as EllipseStroke;
    expect(out.rx).toBe(out.ry);
  });
});

describe('applyDrawModifiers / sticky — always square', () => {
  const sticky: StickyStroke = {
    id: 's',
    tool: 'sticky',
    color: '#fce8a6',
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    text: '',
    fontSize: 16,
  };
  test('no-mod still square (larger axis)', () => {
    expect(applyDrawModifiers(sticky, { x: 0, y: 0 }, 150, 120, NONE)).toMatchObject({
      w: 150,
      h: 150,
    });
  });
  test('Alt — centered square', () => {
    expect(
      applyDrawModifiers(sticky, { x: 0, y: 0 }, 150, 120, { shift: false, alt: true })
    ).toMatchObject({ x: -150, y: -150, w: 300, h: 300 });
  });
});

describe('applyDrawModifiers / arrow', () => {
  const arrow: ArrowStroke = {
    id: 'a',
    tool: 'arrow',
    color: '#000',
    width: 2,
    x1: 0,
    y1: 0,
    x2: 0,
    y2: 0,
  };
  test('no-mod — start fixed at anchor, end follows cursor', () => {
    expect(applyDrawModifiers(arrow, { x: 0, y: 0 }, 100, 40, NONE)).toMatchObject({
      x1: 0,
      y1: 0,
      x2: 100,
      y2: 40,
    });
  });
  test('Alt — anchor is the midpoint, start mirrors the end', () => {
    expect(
      applyDrawModifiers(arrow, { x: 0, y: 0 }, 100, 40, { shift: false, alt: true })
    ).toMatchObject({ x1: -100, y1: -40, x2: 100, y2: 40 });
  });
  test('Shift — end snaps to a 45° shaft', () => {
    const out = applyDrawModifiers(arrow, { x: 0, y: 0 }, 50, 60, {
      shift: true,
      alt: false,
    }) as ArrowStroke;
    expect(out.x2).toBeCloseTo(out.y2, 6);
  });
});

describe('applyDrawModifiers / pen — pass-through', () => {
  const pen: PenStroke = {
    id: 'pen',
    tool: 'pen',
    color: '#000',
    width: 2,
    points: [
      [0, 0],
      [5, 5],
    ],
  };
  test('pen is returned unchanged (no box constraint)', () => {
    expect(applyDrawModifiers(pen, { x: 0, y: 0 }, 99, 99, { shift: true, alt: true })).toBe(pen);
  });
});
