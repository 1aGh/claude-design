// timeline-scale.test.ts — Task 4 pure zoom/scale helpers.

import { describe, expect, test } from 'bun:test';

import {
  clampPxPerFrame,
  fitPxPerFrame,
  frameToPx,
  MAX_PX_PER_FRAME,
  pxToFrame,
  tickLabel,
  tickStepFrames,
  zoomAroundScroll,
} from '../client/panels/timeline-scale.js';

describe('fit + clamp', () => {
  test('fit spans the viewport exactly', () => {
    expect(fitPxPerFrame(900, 900)).toBe(1);
    expect(fitPxPerFrame(1200, 300)).toBe(4);
  });
  test('clamp: never below fit, never above the max', () => {
    expect(clampPxPerFrame(0.1, 900, 900)).toBe(1); // below fit → fit
    expect(clampPxPerFrame(100, 900, 900)).toBe(MAX_PX_PER_FRAME);
    expect(clampPxPerFrame(3, 900, 900)).toBe(3);
    expect(clampPxPerFrame(null, 900, 900)).toBe(1); // absent → fit
  });
});

describe('frame ↔ px round-trip', () => {
  test('at any scale, px→frame(frame→px) is identity', () => {
    for (const pxf of [0.5, 1, 3.7, 40]) {
      expect(pxToFrame(frameToPx(123, pxf), pxf)).toBeCloseTo(123, 6);
    }
  });
});

describe('zoomAroundScroll', () => {
  test('the anchor frame stays at the same viewport x', () => {
    const prev = 1;
    const next = 2;
    const anchor = 300;
    const prevScroll = 100; // anchor at viewport x = 200
    const nextScroll = zoomAroundScroll(prev, next, anchor, prevScroll);
    expect(frameToPx(anchor, next) - nextScroll).toBeCloseTo(frameToPx(anchor, prev) - prevScroll);
  });
  test('never scrolls negative', () => {
    expect(zoomAroundScroll(2, 1, 10, 0)).toBe(0);
  });
});

describe('tickStepFrames — density adapts 1 s → 10 f → 1 f', () => {
  test('at fit on a long comp, ticks are whole/multi seconds', () => {
    const step = tickStepFrames(0.3, 30); // 0.3 px/frame → 30f = 9px, needs ≥56px
    expect(step % 30).toBe(0);
    expect(step).toBeGreaterThanOrEqual(150);
  });
  test('zoomed to 8px/frame → single-frame ticks', () => {
    expect(tickStepFrames(8, 30)).toBe(10); // 10f = 80px ≥ 56 → 10-frame ticks
    expect(tickStepFrames(60, 30)).toBe(1); // 1f = 60px ≥ 56
  });
  test('labels: seconds at whole seconds, frames otherwise', () => {
    expect(tickLabel(60, 30)).toBe('2s');
    expect(tickLabel(45, 30)).toBe('45f');
  });
});
