// element-resize — feature-element-editing-robustness Stage D (Task D1 + G2).
// Pure resize math: `computeElementResize(corner, start, dxW, dyW, mods, flags)`.
// World-unit deltas → target box, deriving left/top only when the moved edge
// permits it (out-of-flow element with an inline value), holding the opposite
// edge fixed (Figma grammar).

import { describe, expect, test } from 'bun:test';
import { computeElementResize, type ElResizeStart } from '../use-element-resize.tsx';

const NO_MODS = { aspect: false, center: false };
const NO_MOVE = { canMoveLeft: false, canMoveTop: false };
const CAN_MOVE = { canMoveLeft: true, canMoveTop: true };

// A 200×100 box at left:50 top:30 (out-of-flow when CAN_MOVE).
const START: ElResizeStart = { w: 200, h: 100, left: 50, top: 30 };

describe('computeElementResize — plain drags', () => {
  test('SE corner grows width + height, never moves origin', () => {
    const r = computeElementResize('se', START, 40, 20, NO_MODS, CAN_MOVE);
    expect(r.width).toBe(240);
    expect(r.height).toBe(120);
    expect(r.left).toBeUndefined();
    expect(r.top).toBeUndefined();
  });

  test('E edge changes width only', () => {
    const r = computeElementResize('e', START, 30, 999, NO_MODS, CAN_MOVE);
    expect(r.width).toBe(230);
    expect(r.height).toBe(100);
  });

  test('S edge changes height only', () => {
    const r = computeElementResize('s', START, 999, -25, NO_MODS, CAN_MOVE);
    expect(r.width).toBe(200);
    expect(r.height).toBe(75);
  });

  test('NW corner (out-of-flow) moves left+top, SE corner stays fixed', () => {
    // Drag NW by (+10, +10): width 190, height 90; left 60, top 40.
    const r = computeElementResize('nw', START, 10, 10, NO_MODS, CAN_MOVE);
    expect(r.width).toBe(190);
    expect(r.height).toBe(90);
    expect(r.left).toBe(60); // start.left + start.w - width = 50 + 200 - 190
    expect(r.top).toBe(40); // start.top + start.h - height = 30 + 100 - 90
    // Opposite (SE) corner is invariant: left+width and top+height unchanged.
    expect((r.left as number) + r.width).toBe(START.left + START.w);
    expect((r.top as number) + r.height).toBe(START.top + START.h);
  });

  test('NW corner IN-FLOW resizes width/height but never writes left/top', () => {
    const r = computeElementResize('nw', START, 10, 10, NO_MODS, NO_MOVE);
    expect(r.width).toBe(190);
    expect(r.height).toBe(90);
    expect(r.left).toBeUndefined();
    expect(r.top).toBeUndefined();
  });

  test('W edge (out-of-flow) moves left, keeps the east edge fixed', () => {
    const r = computeElementResize('w', START, -20, 0, NO_MODS, CAN_MOVE);
    expect(r.width).toBe(220); // start.w - dxW = 200 - (-20)
    expect(r.left).toBe(30); // 50 + 200 - 220
    expect(r.top).toBeUndefined();
  });
});

describe('computeElementResize — modifiers', () => {
  test('Shift on SE corner locks the start aspect ratio (2:1)', () => {
    // Bigger horizontal change → height driven by width to keep 2:1.
    const r = computeElementResize('se', START, 100, 5, { aspect: true, center: false }, CAN_MOVE);
    expect(r.width).toBe(300);
    expect(r.height).toBe(150); // 300 / (200/100)
    expect(r.width / r.height).toBe(START.w / START.h);
  });

  test('Alt on E edge (out-of-flow) resizes from center: 2× delta, left shifts', () => {
    const r = computeElementResize('e', START, 20, 0, { aspect: false, center: true }, CAN_MOVE);
    expect(r.width).toBe(240); // 200 + 2*20
    expect(r.left).toBe(30); // center-preserving: 50 + (200-240)/2
    // Center is invariant: left + width/2 unchanged.
    expect((r.left as number) + r.width / 2).toBe(START.left + START.w / 2);
  });

  test('shrinking past zero clamps to the 1px minimum', () => {
    const r = computeElementResize('se', START, -500, -500, NO_MODS, CAN_MOVE);
    expect(r.width).toBe(1);
    expect(r.height).toBe(1);
  });
});
