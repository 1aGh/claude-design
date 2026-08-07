// timeline-media-cache.test.ts — bug fix: dropping a clip on the timeline
// used to always trim it to a flat 3s instead of its real duration
// (durationInFrames was `Math.round(fps * 3)` regardless of the probed
// media length). durationFramesForDrop is the pure decision the drop
// handler in app.jsx now delegates to.

import { describe, expect, test } from 'bun:test';

import { durationFramesForDrop } from '../client/panels/timeline-media-cache.js';

describe('durationFramesForDrop', () => {
  test('uses the real probed duration, not the flat 3s default', () => {
    // A 7.4s clip at 30fps must land at its own length (222 frames), not the
    // fixed fps*3 = 90 frames the drop handler used to hardcode.
    expect(durationFramesForDrop(30, 7.4)).toBe(Math.round(30 * 7.4));
    expect(durationFramesForDrop(30, 7.4)).not.toBe(Math.round(30 * 3));
  });

  test('rounds to the nearest frame', () => {
    expect(durationFramesForDrop(24, 2.501)).toBe(60); // 24 * 2.501 = 60.024
  });

  test('falls back to 3s when no duration was probed (null/failed probe)', () => {
    expect(durationFramesForDrop(30, null)).toBe(90);
    expect(durationFramesForDrop(30, undefined)).toBe(90);
    expect(durationFramesForDrop(30, NaN)).toBe(90);
  });

  test('falls back to 3s for a non-positive probed duration', () => {
    expect(durationFramesForDrop(30, 0)).toBe(90);
    expect(durationFramesForDrop(30, -1)).toBe(90);
  });

  test('a caller can override the fallback (e.g. synthetic content)', () => {
    expect(durationFramesForDrop(30, null, 5)).toBe(150);
  });

  test('never returns less than 1 frame', () => {
    expect(durationFramesForDrop(30, 0.001)).toBeGreaterThanOrEqual(1);
  });
});
