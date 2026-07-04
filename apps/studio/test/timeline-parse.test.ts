// timeline-parse — DDR-148 Timeline sequence/keyframe parser.
// Pure regex parse of a video-comp's sequence structure + interpolate windows.

import { describe, expect, test } from 'bun:test';

import { parseCompTimeline } from '../client/panels/timeline-parse.js';

const COMP = `
const A = 45;
const XF = 15;
const B = 60;
const Intro = () => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [0, 14], [0, 1]);
  const y = interpolate(frame, [10, 30], [24, 0]);
  return <AbsoluteFill style={{ opacity: o }} />;
};
const Payoff = () => {
  const frame = useCurrentFrame();
  const s = interpolate(frame, [4, 20], [0.8, 1]);
  return <AbsoluteFill style={{ transform: 's' }} />;
};
function Movie() {
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={A}><Intro /></TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: XF })} />
      <TransitionSeries.Sequence durationInFrames={B}><Payoff /></TransitionSeries.Sequence>
    </TransitionSeries>
  );
}
`;

describe('parseCompTimeline', () => {
  test('parses TransitionSeries sequences with const durations + overlap math', () => {
    const r = parseCompTimeline(COMP, 90);
    expect(r.total).toBe(90);
    expect(r.sequences).toHaveLength(2);
    expect(r.sequences[0]).toMatchObject({ label: 'Intro', from: 0, duration: 45 });
    // Payoff starts at 45 - 15 (the transition overlaps back) = 30.
    expect(r.sequences[1]).toMatchObject({ label: 'Payoff', from: 30, duration: 60 });
  });

  test('attributes interpolate windows to their sequence, offset to absolute frames', () => {
    const r = parseCompTimeline(COMP, 90);
    // Intro's [0,14] + [10,30] stay at from=0.
    expect(r.sequences[0].keyframes).toEqual([
      { from: 0, to: 14 },
      { from: 10, to: 30 },
    ]);
    // Payoff's [4,20] is offset by its from=30 → [34,50].
    expect(r.sequences[1].keyframes).toEqual([{ from: 34, to: 50 }]);
  });

  test('plain <Sequence from={M} durationInFrames={N}> uses absolute from', () => {
    const src =
      'function C(){ return <><Sequence from={20} durationInFrames={40}><Foo/></Sequence></>; }';
    const r = parseCompTimeline(src, 60);
    expect(r.sequences[0]).toMatchObject({ label: 'Foo', from: 20, duration: 40 });
  });

  test('a non-comp / unparseable source yields no sequences (scrub-only)', () => {
    expect(parseCompTimeline('function C(){ return <div/>; }', 30).sequences).toEqual([]);
    expect(parseCompTimeline('', 0).sequences).toEqual([]);
  });

  test('the comp meta total wins over the derived span', () => {
    const r = parseCompTimeline(COMP, 200);
    expect(r.total).toBe(200);
  });
});
