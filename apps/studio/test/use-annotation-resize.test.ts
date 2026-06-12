// use-annotation-resize — FigJam resize-modifier math (pure `resizeStroke`).
//
// Covers the no-modifier baseline (must stay algebraically identical to the
// pre-modifier corner math) plus Shift (aspect-lock / 45° snap), Alt
// (scale-from-center / mirror-from-midpoint), and Shift+Alt combined, across
// every resizable stroke kind. Pure function — no DOM render needed.

import { describe, expect, test } from 'bun:test';

import type {
  ArrowStroke,
  EllipseStroke,
  ImageStroke,
  LinkStroke,
  PenStroke,
  PolygonStroke,
  RectStroke,
  StickyStroke,
} from '../annotations-layer.tsx';
import { resizeStroke } from '../use-annotation-resize.tsx';

const rect: RectStroke = {
  id: 'r1',
  tool: 'rect',
  color: '#000',
  width: 2,
  x: 0,
  y: 0,
  w: 100,
  h: 50,
};

describe('resizeStroke / rect — no modifiers (baseline)', () => {
  test('se corner anchors the nw corner (back-compat)', () => {
    expect(resizeStroke(rect, 'se', 120, 80)).toEqual({ x: 0, y: 0, w: 120, h: 80 });
  });

  test('nw corner anchors the se corner', () => {
    expect(resizeStroke(rect, 'nw', -20, -10)).toEqual({ x: -20, y: -10, w: 120, h: 60 });
  });

  test('dragging past the anchor flips the box (min/max parity)', () => {
    // se dragged to the left of x=0 → box lives to the left of the anchor.
    expect(resizeStroke(rect, 'se', -40, 80)).toEqual({ x: -40, y: 0, w: 40, h: 80 });
  });
});

describe('resizeStroke / rect — Shift (aspect lock)', () => {
  test('keeps the 2:1 start ratio, dominant axis drives scale', () => {
    // raw 120×200 → scale = max(1.2, 4) = 4 → 400×200 (ratio preserved).
    expect(resizeStroke(rect, 'se', 120, 200, { shift: true, alt: false })).toEqual({
      x: 0,
      y: 0,
      w: 400,
      h: 200,
    });
  });
});

describe('resizeStroke / rect — Alt (scale from center)', () => {
  test('center stays fixed; both sides grow symmetrically', () => {
    const out = resizeStroke(rect, 'se', 120, 80, { shift: false, alt: true });
    expect(out).toEqual({ x: -20, y: -30, w: 140, h: 110 });
    // center invariant: (-20 + 140/2, -30 + 110/2) === (50, 25) === start center.
    expect((out as RectStroke).x + (out as RectStroke).w / 2).toBe(50);
    expect((out as RectStroke).y + (out as RectStroke).h / 2).toBe(25);
  });
});

describe('resizeStroke / rect — Shift+Alt (ratio + center)', () => {
  test('center-anchored and ratio-locked at once', () => {
    expect(resizeStroke(rect, 'se', 120, 200, { shift: true, alt: true })).toEqual({
      x: -300,
      y: -150,
      w: 700,
      h: 350,
    });
  });
});

describe('resizeStroke / polygon — routes through the shared bbox math', () => {
  const poly: PolygonStroke = {
    id: 'p1',
    tool: 'polygon',
    shape: 'diamond',
    color: '#000',
    width: 2,
    x: 0,
    y: 0,
    w: 100,
    h: 50,
  };
  test('Shift aspect-locks the polygon like a rect', () => {
    expect(resizeStroke(poly, 'se', 120, 200, { shift: true, alt: false })).toEqual({
      x: 0,
      y: 0,
      w: 400,
      h: 200,
    });
  });
});

describe('resizeStroke / sticky — always 1:1 square', () => {
  const sticky: StickyStroke = {
    id: 's1',
    tool: 'sticky',
    color: '#fce8a6',
    x: 0,
    y: 0,
    w: 100,
    h: 100,
    text: '',
    fontSize: 16,
  };
  test('no modifiers — larger axis becomes the side', () => {
    expect(resizeStroke(sticky, 'se', 150, 120)).toEqual({ x: 0, y: 0, w: 150, h: 150 });
  });
  test('Alt — square grows from the center', () => {
    expect(resizeStroke(sticky, 'se', 150, 120, { shift: false, alt: true })).toEqual({
      x: -50,
      y: -50,
      w: 200,
      h: 200,
    });
  });
});

describe('resizeStroke / image — Phase 23 (aspect-lock by default, Shift frees)', () => {
  const image: ImageStroke = {
    id: 'im1',
    tool: 'image',
    x: 0,
    y: 0,
    w: 100,
    h: 50, // 2:1 intrinsic aspect
    href: 'assets/abcd1234.png',
  };
  test('no modifiers keeps the intrinsic aspect (the inverse of shapes)', () => {
    // se → 120,80 would be 2.4:1 free, but the lock keeps 2:1 (dominant axis).
    expect(resizeStroke(image, 'se', 120, 80)).toEqual({ x: 0, y: 0, w: 160, h: 80 });
  });
  test('Shift held inverts to a free (unconstrained) resize', () => {
    expect(resizeStroke(image, 'se', 120, 80, { shift: true, alt: false })).toEqual({
      x: 0,
      y: 0,
      w: 120,
      h: 80,
    });
  });
});

describe('resizeStroke / link — Phase 23 (free-resizes like a rect)', () => {
  const link: LinkStroke = {
    id: 'lk1',
    tool: 'link',
    x: 0,
    y: 0,
    w: 200,
    h: 80,
    url: 'https://example.com',
    title: 'Example',
    domain: 'example.com',
  };
  test('no modifiers free-resizes (no forced aspect)', () => {
    expect(resizeStroke(link, 'se', 300, 120)).toEqual({ x: 0, y: 0, w: 300, h: 120 });
  });
});

describe('resizeStroke / ellipse — Alt keeps the center fixed', () => {
  const ell: EllipseStroke = {
    id: 'e1',
    tool: 'ellipse',
    color: '#000',
    width: 2,
    cx: 50,
    cy: 50,
    rx: 40,
    ry: 20,
  };
  test('center invariant under symmetric scale', () => {
    expect(resizeStroke(ell, 'se', 120, 90, { shift: false, alt: true })).toEqual({
      cx: 50,
      cy: 50,
      rx: 70,
      ry: 40,
    });
  });
});

describe('resizeStroke / arrow', () => {
  const arrow: ArrowStroke = {
    id: 'a1',
    tool: 'arrow',
    color: '#000',
    width: 2,
    x1: 0,
    y1: 0,
    x2: 100,
    y2: 0,
  };
  test('no modifiers — only the dragged endpoint moves', () => {
    expect(resizeStroke(arrow, 'ep2', 100, 40)).toEqual({ x2: 100, y2: 40 });
  });
  test('Alt — the midpoint is pinned; the far end mirrors', () => {
    expect(resizeStroke(arrow, 'ep2', 100, 40, { shift: false, alt: true })).toEqual({
      x2: 100,
      y2: 40,
      x1: 0,
      y1: -40,
    });
  });
  test('Shift — shaft angle snaps to the nearest 45°', () => {
    const out = resizeStroke(arrow, 'ep2', 50, 60, { shift: true, alt: false }) as ArrowStroke;
    // Pointer at atan2(60,50)≈49° snaps to 45° → dx === dy along the shaft.
    expect(out.x2).toBeCloseTo(out.y2 ?? Number.NaN, 6);
    expect(out.x2).toBeGreaterThan(0);
  });
});

describe('resizeStroke / pen — point scaling', () => {
  const pen: PenStroke = {
    id: 'pen1',
    tool: 'pen',
    color: '#000',
    width: 2,
    points: [
      [0, 0],
      [100, 0],
      [100, 100],
      [0, 100],
    ],
  };
  test('no modifiers — scales around the opposite corner', () => {
    const out = resizeStroke(pen, 'se', 200, 200) as PenStroke;
    expect(out.points[0]).toEqual([0, 0]);
    expect(out.points[2]).toEqual([200, 200]);
  });
  test('Alt — scales around the bbox center', () => {
    const out = resizeStroke(pen, 'se', 150, 150, { shift: false, alt: true }) as PenStroke;
    expect(out.points[0]).toEqual([-50, -50]);
    expect(out.points[2]).toEqual([150, 150]);
  });
});

describe('resizeStroke / rotation — Wave G corner rotate zones', () => {
  // rect center = (50, 25). Angles below are measured around it.
  test('relative rotation: grab angle is the zero reference (no jump)', () => {
    // Grab at angle 0° (due east of center), drag to 45° → rotation 45.
    const rotRef = { angle0: 0, rot0: 0 };
    const out = resizeStroke(
      rect,
      'rot-se',
      50 + 70,
      25 + 70,
      { shift: false, alt: false },
      rotRef
    );
    expect(out).toEqual({ rotation: 45 });
  });

  test('starting rotation accumulates with the drag delta', () => {
    const rotated: RectStroke = { ...rect, rotation: 30 };
    const rotRef = { angle0: 0, rot0: 30 };
    const out = resizeStroke(
      rotated,
      'rot-ne',
      50 + 70,
      25 + 70,
      { shift: false, alt: false },
      rotRef
    );
    expect(out).toEqual({ rotation: 75 });
  });

  test('magnetic cardinals: within 2° of 0 lock on and serialize as undefined', () => {
    const rotated: RectStroke = { ...rect, rotation: 44 };
    // Drag back by 42.5° → raw −1.5° + rot0 44 = ... use angle0 50, current 7.5 → deg = 44 − 42.5 = 1.5 → locks to 0.
    const cur = (Math.PI / 180) * 7.5;
    const out = resizeStroke(
      rotated,
      'rot-nw',
      50 + 70 * Math.cos(cur),
      25 + 70 * Math.sin(cur),
      { shift: false, alt: false },
      { angle0: 50, rot0: 44 }
    );
    expect(out).toEqual({ rotation: undefined });
  });

  test('Shift snaps to 15° steps', () => {
    // delta = 40° → snaps to 45.
    const cur = (Math.PI / 180) * 40;
    const out = resizeStroke(
      rect,
      'rot-sw',
      50 + 70 * Math.cos(cur),
      25 + 70 * Math.sin(cur),
      { shift: true, alt: false },
      { angle0: 0, rot0: 0 }
    );
    expect(out).toEqual({ rotation: 45 });
  });

  test('non-rotatable strokes refuse the rotate corners', () => {
    const arrow: ArrowStroke = {
      id: 'a1',
      tool: 'arrow',
      color: '#000',
      width: 2,
      x1: 0,
      y1: 0,
      x2: 100,
      y2: 0,
    };
    expect(
      resizeStroke(arrow, 'rot-se', 50, 50, { shift: false, alt: false }, { angle0: 0, rot0: 0 })
    ).toBeNull();
  });

  test('polygon rotates (diamond/triangle are rotatable hosts)', () => {
    const poly: PolygonStroke = {
      id: 'p1',
      tool: 'polygon',
      shape: 'diamond',
      color: '#000',
      width: 2,
      x: 0,
      y: 0,
      w: 100,
      h: 50,
    };
    const out = resizeStroke(
      poly,
      'rot-se',
      50 + 70,
      25 + 70,
      { shift: false, alt: false },
      { angle0: 0, rot0: 0 }
    );
    expect(out).toEqual({ rotation: 45 });
  });
});

describe('resizeStroke / rotated strokes — Wave H anchor compensation', () => {
  // rect 100×50 at origin, rotated 90° around its center (50, 25).
  const rotated: RectStroke = { ...rect, rotation: 90 };
  const rotP = (px: number, py: number, cx: number, cy: number, deg: number): [number, number] => {
    const r = (deg * Math.PI) / 180;
    const dx = px - cx;
    const dy = py - cy;
    return [cx + dx * Math.cos(r) - dy * Math.sin(r), cy + dx * Math.sin(r) + dy * Math.cos(r)];
  };

  test('se-corner drag keeps the nw corner fixed in WORLD space', () => {
    // Cursor in the LOCAL frame (applyResize inverse-rotates before calling).
    const out = resizeStroke(rotated, 'se', 140, 90) as RectStroke;
    expect(out.w).toBeCloseTo(140, 6);
    expect(out.h).toBeCloseTo(90, 6);
    const before = rotP(0, 0, 50, 25, 90);
    const after = rotP(out.x, out.y, out.x + out.w / 2, out.y + out.h / 2, 90);
    expect(after[0]).toBeCloseTo(before[0], 6);
    expect(after[1]).toBeCloseTo(before[1], 6);
  });

  test('e-edge drag keeps the west edge midpoint fixed in WORLD space', () => {
    const out = resizeStroke(rotated, 'e', 130, 25) as RectStroke;
    expect(out.w).toBeCloseTo(130, 6);
    const before = rotP(0, 25, 50, 25, 90);
    const after = rotP(out.x, out.y + out.h / 2, out.x + out.w / 2, out.y + out.h / 2, 90);
    expect(after[0]).toBeCloseTo(before[0], 6);
    expect(after[1]).toBeCloseTo(before[1], 6);
  });

  test('Alt resize keeps the center (no compensation path)', () => {
    const out = resizeStroke(rotated, 'se', 130, 80, { shift: false, alt: true }) as RectStroke;
    expect(out.x + out.w / 2).toBeCloseTo(50, 6);
    expect(out.y + out.h / 2).toBeCloseTo(25, 6);
  });

  test('unrotated strokes are byte-stable (no shift applied)', () => {
    expect(resizeStroke(rect, 'se', 120, 80)).toEqual({ x: 0, y: 0, w: 120, h: 80 });
  });

  test('rotated ellipse: se drag keeps the nw bbox corner fixed in WORLD space', () => {
    const ell: EllipseStroke = {
      id: 'e1',
      tool: 'ellipse',
      color: '#000',
      width: 2,
      cx: 50,
      cy: 25,
      rx: 50,
      ry: 25,
      rotation: 45,
    };
    const out = resizeStroke(ell, 'se', 140, 90) as EllipseStroke;
    const before = rotP(0, 0, 50, 25, 45);
    const after = rotP(out.cx - out.rx, out.cy - out.ry, out.cx, out.cy, 45);
    expect(after[0]).toBeCloseTo(before[0], 6);
    expect(after[1]).toBeCloseTo(before[1], 6);
  });
});
