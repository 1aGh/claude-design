import { describe, expect, test } from 'bun:test';
import {
  type CubicBezierHandles,
  easeBezier,
  LINEAR,
  lerpValue,
  lerpVertices,
  parallel,
  resolveStagger,
  sampleTrack,
  sequence,
  shiftTrack,
  stagger,
  type Track,
  timeline,
  track,
  trackSpan,
} from '../animate.ts';

describe('easeBezier', () => {
  test('linear is the identity', () => {
    for (const x of [0, 0.25, 0.5, 0.75, 1]) {
      expect(easeBezier(LINEAR, x)).toBeCloseTo(x, 6);
    }
  });
  test('clamps the endpoints exactly', () => {
    const e: CubicBezierHandles = [0.42, 0, 0.58, 1];
    expect(easeBezier(e, 0)).toBe(0);
    expect(easeBezier(e, 1)).toBe(1);
    expect(easeBezier(e, -0.5)).toBe(0);
    expect(easeBezier(e, 1.5)).toBe(1);
  });
  test('ease-in-out is symmetric about the midpoint and monotone', () => {
    const e: CubicBezierHandles = [0.42, 0, 0.58, 1];
    expect(easeBezier(e, 0.5)).toBeCloseTo(0.5, 4);
    let prev = -1;
    for (let i = 0; i <= 20; i++) {
      const y = easeBezier(e, i / 20);
      expect(y).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = y;
    }
  });
  test('preserves overshoot (y > 1) for a snap easing', () => {
    const snap: CubicBezierHandles = [0.34, 1.42, 0.64, 1];
    let maxY = 0;
    for (let i = 0; i <= 100; i++) maxY = Math.max(maxY, easeBezier(snap, i / 100));
    expect(maxY).toBeGreaterThan(1); // the overshoot the snap depends on
  });
  test('round-trips a known x→t→y solve (ease-out)', () => {
    // cubic-bezier(0,0,0.58,1): solving x then evaluating y must land in (x,1).
    const e: CubicBezierHandles = [0, 0, 0.58, 1];
    const y = easeBezier(e, 0.5);
    expect(y).toBeGreaterThan(0.5); // ease-out is ahead of linear at the midpoint
    expect(y).toBeLessThan(1);
  });
});

describe('lerpValue / lerpVertices', () => {
  test('numbers lerp', () => {
    expect(lerpValue(0, 10, 0.3)).toBeCloseTo(3, 6);
  });
  test('number arrays lerp element-wise', () => {
    expect(lerpValue([0, 10], [10, 0], 0.5)).toEqual([5, 5]);
  });
  test('vertex arrays lerp by component', () => {
    const out = lerpVertices([{ x: 0, y: 0 }], [{ x: 4, y: 8 }], 0.25);
    expect(out).toEqual([{ x: 1, y: 2 }]);
  });
  test('strings are a discrete hold (no interpolation)', () => {
    expect(lerpValue('rotate(0)', 'rotate(90)', 0.5)).toBe('rotate(0)');
    expect(lerpValue('rotate(0)', 'rotate(90)', 1)).toBe('rotate(90)');
  });
  test('vertex count mismatch throws (interpolability constraint)', () => {
    expect(() => lerpVertices([{ x: 0, y: 0 }], [], 0.5)).toThrow(/vertex count mismatch/);
  });
});

describe('sampleTrack', () => {
  const tr = track('opacity', [
    { t: 0, value: 0, ease: LINEAR },
    { t: 1, value: 1 },
  ]);
  test('holds before the first and after the last keyframe', () => {
    expect(sampleTrack(tr, -1)).toBe(0);
    expect(sampleTrack(tr, 5)).toBe(1);
  });
  test('linear interpolation mid-segment', () => {
    expect(sampleTrack(tr, 0.5)).toBeCloseTo(0.5, 6);
  });
  test('applies the leading keyframe easing', () => {
    const eased = track('opacity', [
      { t: 0, value: 0, ease: [0, 0, 0.58, 1] }, // ease-out
      { t: 1, value: 1 },
    ]);
    expect(sampleTrack(eased, 0.5) as number).toBeGreaterThan(0.5);
  });
  test('empty track samples undefined', () => {
    expect(sampleTrack(track('opacity', []), 0)).toBeUndefined();
  });
});

describe('combinators', () => {
  const a = (): Track =>
    track(
      'opacity',
      [
        { t: 0, value: 0 },
        { t: 1, value: 1 },
      ],
      'a'
    );
  const b = (): Track =>
    track(
      'opacity',
      [
        { t: 0, value: 1 },
        { t: 2, value: 0 },
      ],
      'b'
    );

  test('trackSpan is the latest keyframe time', () => {
    expect(trackSpan([a(), b()])).toBe(2);
  });

  test('shiftTrack offsets every keyframe', () => {
    const s = shiftTrack(a(), 3);
    expect(s.keyframes.map((k) => k.t)).toEqual([3, 4]);
    expect(a().keyframes[0].t).toBe(0); // immutable
  });

  test('stagger offsets track i by i·delay', () => {
    const out = stagger([a(), b(), a()], 0.5);
    expect(out[0].keyframes[0].t).toBe(0);
    expect(out[1].keyframes[0].t).toBe(0.5);
    expect(out[2].keyframes[0].t).toBe(1);
  });

  test('resolveStagger bakes the declarative field and grows dur', () => {
    const tl = timeline({ tracks: [a(), b()], dur: 2, stagger: 0.5 });
    const r = resolveStagger(tl);
    expect(r.stagger).toBeUndefined();
    expect(r.tracks[1].keyframes[0].t).toBe(0.5);
    expect(r.dur).toBe(2.5); // b ended at 2 → shifted to 2.5
  });

  test('parallel unions tracks and takes the max duration', () => {
    const tl = parallel(
      timeline({ tracks: [a()], dur: 1 }),
      timeline({ tracks: [b()], dur: 2, begin: 0.5 })
    );
    expect(tl.tracks.length).toBe(2);
    expect(tl.dur).toBe(2.5); // 0.5 begin + 2 dur
    expect(tl.tracks[1].keyframes[0].t).toBe(0.5); // b shifted by its begin
  });

  test('sequence chains timelines end-to-start and sums durations', () => {
    const tl = sequence(timeline({ tracks: [a()], dur: 1 }), timeline({ tracks: [b()], dur: 2 }));
    expect(tl.dur).toBe(3);
    expect(tl.tracks[0].keyframes.map((k) => k.t)).toEqual([0, 1]);
    expect(tl.tracks[1].keyframes.map((k) => k.t)).toEqual([1, 3]); // shifted by first dur
  });

  test('sequence honors a per-timeline begin gap', () => {
    const tl = sequence(
      timeline({ tracks: [a()], dur: 1 }),
      timeline({ tracks: [a()], dur: 1, begin: 0.5 })
    );
    expect(tl.tracks[1].keyframes[0].t).toBe(1.5); // 1 (cursor) + 0.5 (gap)
    expect(tl.dur).toBe(2.5);
  });
});
