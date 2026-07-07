// camera-reveal — Task A3 (feature-element-editing-robustness), Stage A.
//
// Regression guard for Bugs A + B: a `select-by-id` reveal must pan the camera
// (the `.dc-world` transform, via the viewport controller) and MUST NOT scroll
// the overflow:hidden `.dc-canvas` / `.dc-artboard-body` clip layers — host
// scroll is what desynced the camera model (phantom right strip + pan reset
// after an absolute-element move).
//
// canvas-shell.tsx pulls in a React/DOM dependency graph, so we register
// happy-dom for this file (like canvas-hmr-runtime.test.tsx) before importing.

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { GlobalRegistrator } from '@happy-dom/global-registrator';

beforeAll(() => {
  GlobalRegistrator.register();
});
afterAll(() => {
  GlobalRegistrator.unregister();
});

import type { ViewportControllerHandle } from '../canvas-lib.tsx';
import { REVEAL_MARGIN_PX, revealAxisDelta, revealElementViaCamera } from '../canvas-shell.tsx';

const M = REVEAL_MARGIN_PX;

describe('revealAxisDelta — minimal 1-axis camera pan', () => {
  // Viewport spans [0, 1000]; usable band is [M, 1000 - M].
  const V0 = 0;
  const V1 = 1000;

  test('fully visible → no pan', () => {
    expect(revealAxisDelta(200, 400, V0, V1, M)).toBe(0);
  });

  test('flush at the inset band edges → no pan', () => {
    expect(revealAxisDelta(M, V1 - M, V0, V1, M)).toBe(0);
  });

  test('off the start (left/top) edge → positive delta brings the start in', () => {
    // element [-50, 100]; start (-50) is left of the inset band start (M=40).
    const d = revealAxisDelta(-50, 100, V0, V1, M);
    expect(d).toBe(M - -50); // vs - elStart = 40 - (-50) = 90
    expect(d).toBeGreaterThan(0);
  });

  test('off the end (right/bottom) edge → negative delta brings the end in', () => {
    // element [900, 1100]; end (1100) is past the inset band end (960).
    const d = revealAxisDelta(900, 1100, V0, V1, M);
    expect(d).toBe(V1 - M - 1100); // ve - elEnd = 960 - 1100 = -140
    expect(d).toBeLessThan(0);
  });

  test('element wider than the viewport → no pan (matches scrollIntoView nearest)', () => {
    expect(revealAxisDelta(-200, 1200, V0, V1, M)).toBe(0);
  });
});

// Minimal fake controller — only `panBy` is exercised; the rest satisfy the type.
function fakeController(): {
  handle: ViewportControllerHandle;
  calls: Array<[number, number]>;
} {
  const calls: Array<[number, number]> = [];
  const noop = () => {};
  const handle: ViewportControllerHandle = {
    viewport: { x: 0, y: 0, zoom: 1 },
    setViewport: noop,
    panBy: (dx, dy) => calls.push([dx, dy]),
    zoomAt: noop,
    fit: noop,
    reset: noop,
    zoomIn: noop,
    zoomOut: noop,
    jumpTo: noop,
    animateTo: noop,
    isInteracting: false,
  };
  return { handle, calls };
}

function elWithRect(rect: Partial<DOMRect>): HTMLElement {
  const el = document.createElement('div');
  const r = {
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    width: 0,
    height: 0,
    x: 0,
    y: 0,
    ...rect,
  } as DOMRect;
  el.getBoundingClientRect = () => r;
  return el;
}

describe('revealElementViaCamera — pans the controller, never host scroll', () => {
  test('off-screen element pans via panBy and leaves host scroll at 0', () => {
    const host = elWithRect({
      left: 0,
      top: 0,
      right: 1000,
      bottom: 800,
      width: 1000,
      height: 800,
    });
    // Target sits past the right edge — the exact Bug B repro (overflowing element).
    const target = elWithRect({
      left: 1100,
      top: 100,
      right: 1300,
      bottom: 200,
      width: 200,
      height: 100,
    });
    const { handle, calls } = fakeController();

    revealElementViaCamera(host, target, handle);

    expect(calls.length).toBe(1);
    const [dx, dy] = calls[0];
    expect(dx).toBeLessThan(0); // pan world left to reveal the right-side element
    expect(dy).toBe(0); // vertically already in view
    // The invariant: no host scroll was touched.
    expect(host.scrollLeft).toBe(0);
    expect(host.scrollTop).toBe(0);
  });

  test('already-visible element → no pan at all', () => {
    const host = elWithRect({
      left: 0,
      top: 0,
      right: 1000,
      bottom: 800,
      width: 1000,
      height: 800,
    });
    const target = elWithRect({
      left: 300,
      top: 300,
      right: 500,
      bottom: 400,
      width: 200,
      height: 100,
    });
    const { handle, calls } = fakeController();

    revealElementViaCamera(host, target, handle);

    expect(calls.length).toBe(0);
    expect(host.scrollLeft).toBe(0);
    expect(host.scrollTop).toBe(0);
  });

  test('detached element (zero box) → no pan', () => {
    const host = elWithRect({
      left: 0,
      top: 0,
      right: 1000,
      bottom: 800,
      width: 1000,
      height: 800,
    });
    const target = elWithRect({});
    const { handle, calls } = fakeController();

    revealElementViaCamera(host, target, handle);

    expect(calls.length).toBe(0);
  });
});
