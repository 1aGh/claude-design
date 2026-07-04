// timeline-snap.test.ts — DDR-150 Task 15 (Polish). The pure snap helpers behind
// clip move/trim: a dragged edge lands on the nearest second-tick / neighbor edge
// / playhead within a threshold, and Alt (threshold 0) turns it off.

import { describe, expect, test } from 'bun:test';

import {
  computeSnapTargets,
  snapFrame,
  snapThresholdFrames,
} from '../client/panels/timeline-snap.js';

describe('computeSnapTargets', () => {
  test('includes 0, comp end, second ticks, neighbor edges, playhead — excludes the moving clip', () => {
    const targets = computeSnapTargets({
      fps: 30,
      totalFrames: 120,
      clips: [
        { from: 0, duration: 30 }, // clip 0 — the one being moved (excluded)
        { from: 45, duration: 30 }, // clip 1 — edges 45 + 75 should appear
      ],
      movingIndex: 0,
      playhead: 88,
    });
    expect(targets).toContain(0); // start
    expect(targets).toContain(120); // comp end
    expect(targets).toContain(30); // second tick (1s @ 30fps)
    expect(targets).toContain(60); // second tick (2s)
    expect(targets).toContain(90); // second tick (3s)
    expect(targets).toContain(45); // neighbor clip start
    expect(targets).toContain(75); // neighbor clip end
    expect(targets).toContain(88); // playhead
    // the MOVING clip's own edges (0 already a tick; its end 30 is also a tick,
    // but must not be added as a *clip edge* — dedup keeps it single + sorted)
    expect(targets).toEqual([...targets].sort((a, b) => a - b));
    expect(new Set(targets).size).toBe(targets.length); // deduped
  });

  test('clamps targets to [0, totalFrames]', () => {
    const targets = computeSnapTargets({
      fps: 30,
      totalFrames: 50,
      clips: [{ from: 40, duration: 40 }], // end 80 is out of range → dropped
      movingIndex: -1,
      playhead: 200, // out of range → dropped
    });
    expect(Math.max(...targets)).toBeLessThanOrEqual(50);
    expect(targets).not.toContain(80);
    expect(targets).not.toContain(200);
  });
});

describe('snapFrame', () => {
  const targets = [0, 30, 45, 60, 90, 120];

  test('snaps to the nearest target within threshold', () => {
    expect(snapFrame(32, targets, 4)).toBe(30); // 2 away
    expect(snapFrame(43, targets, 4)).toBe(45); // 2 away
  });

  test('leaves the candidate unchanged when nothing is in range', () => {
    expect(snapFrame(52, targets, 4)).toBe(52); // nearest (45/60) is 7/8 away
  });

  test('picks the CLOSER of two in-range targets', () => {
    // 47 is 2 from 45 and 13 from 60 → 45.
    expect(snapFrame(47, targets, 20)).toBe(45);
  });

  test('threshold 0 (Alt override) never snaps', () => {
    expect(snapFrame(30, targets, 0)).toBe(30);
    expect(snapFrame(31, targets, 0)).toBe(31);
  });
});

describe('snapThresholdFrames', () => {
  test('converts an ~8px radius into frames by the row width', () => {
    // 8px on a 800px row spanning 400 frames → ~4 frames.
    expect(Math.round(snapThresholdFrames(800, 401, 8))).toBe(4);
  });

  test('degrades safely on a zero-width row', () => {
    expect(Number.isFinite(snapThresholdFrames(0, 100))).toBe(true);
  });
});
