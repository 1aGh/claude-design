// canvas-zoom-floor — issue #91 dogfood report: dragging an artboard across a
// large board, the user can't zoom out far enough to complete the move in one
// motion. Root cause: `clampZoom` applies a single hard-coded floor to every
// viewport write, including the programmatic `fit()` path — a board wider
// than ~10x the viewport could never be framed whole. See
// .ai/logs/rca/issue-91-canvas-zoom-floor.md.
//
// canvas-lib.tsx pulls in a React/DOM dependency graph, so we register
// happy-dom for this file (like camera-reveal.test.tsx) before importing.

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { GlobalRegistrator } from '@happy-dom/global-registrator';

beforeAll(() => {
  GlobalRegistrator.register();
});
afterAll(() => {
  GlobalRegistrator.unregister();
});

import { clampZoom, computeFit } from '../canvas-lib.tsx';

function fakeHost(clientWidth: number, clientHeight: number): HTMLElement {
  const el = document.createElement('div');
  Object.defineProperty(el, 'clientWidth', { value: clientWidth });
  Object.defineProperty(el, 'clientHeight', { value: clientHeight });
  return el;
}

describe('clampZoom — the interactive zoom floor (issue #91)', () => {
  test('a deep zoom-out below the OLD 0.1 floor is no longer clamped', () => {
    expect(clampZoom(0.05)).toBe(0.05);
    expect(clampZoom(0.02)).toBe(0.02);
  });

  test('still clamps below the new floor', () => {
    expect(clampZoom(0.0001)).toBe(0.02);
    expect(clampZoom(-5)).toBe(0.02);
  });

  test('still clamps above the max and normalizes non-finite input', () => {
    expect(clampZoom(99)).toBe(4);
    expect(clampZoom(Number.NaN)).toBe(1);
    expect(clampZoom(Number.POSITIVE_INFINITY)).toBe(1);
  });
});

describe('computeFit → clampZoom — fit() can now frame a wide board (issue #91)', () => {
  test('a board ~20x the viewport width computes a zoom the old floor would have clamped up', () => {
    // Viewport 1000x800; board 20000 wide — the exact "more than a screenful
    // of artboards" shape from the report. Ideal fit zoom is well under 0.1.
    const host = fakeHost(1000, 800);
    const fit = computeFit([{ x: 0, y: 0, w: 20000, h: 800 }], host, 24);

    expect(fit.zoom).toBeLessThan(0.1); // the bug: old floor would have clamped this
    expect(fit.zoom).toBeGreaterThanOrEqual(0.02); // still within the new interactive floor

    // The regression proper: applying the viewport funnel's clamp must be a
    // no-op for this value now — before the fix (ZOOM_MIN = 0.1) this would
    // have raised fit.zoom back up to 0.1, cropping the board.
    expect(clampZoom(fit.zoom)).toBe(fit.zoom);
  });

  test('an extremely wide board (>50x viewport) still bottoms out at the interactive floor', () => {
    const host = fakeHost(1000, 800);
    const fit = computeFit([{ x: 0, y: 0, w: 100000, h: 800 }], host, 24);

    // The ideal fit zoom is far below even the new floor — clampZoom must
    // still protect the interactive floor for pathological board sizes.
    expect(fit.zoom).toBeLessThan(0.02);
    expect(clampZoom(fit.zoom)).toBe(0.02);
  });
});
