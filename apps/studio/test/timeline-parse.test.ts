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

  test('an <Audio> bed becomes its own row spanning the comp (DDR-148 music layer)', () => {
    const src = `${COMP.replace(
      '</TransitionSeries>',
      '</TransitionSeries><Audio src="/.design/assets/music.mp3" />'
    )}`;
    const r = parseCompTimeline(src, 90);
    expect(r.audio).toHaveLength(1);
    expect(r.audio[0]).toMatchObject({ kind: 'audio', label: 'music.mp3', from: 0, duration: 90 });
  });

  test('a multi-comp canvas scopes the timeline to the media comp + its total', () => {
    // Two VideoComps on one canvas: a plain intro (no media) + a reel (has
    // <Audio>). The parser must show the REEL — its sequences, total, audio.
    const src = `
const IT = 40; const RT = 120;
const Intro = () => <AbsoluteFill/>;
function Movie(){ return <TransitionSeries><TransitionSeries.Sequence durationInFrames={IT}><Intro/></TransitionSeries.Sequence></TransitionSeries>; }
const Clip = () => <AbsoluteFill/>;
function Reel(){ return (<AbsoluteFill><TransitionSeries><TransitionSeries.Sequence durationInFrames={RT}><Clip/></TransitionSeries.Sequence></TransitionSeries><Audio src="/x/song.mp3"/></AbsoluteFill>); }
export default function Canvas(){ return (<DesignCanvas>
  <VideoComp component={Movie} durationInFrames={IT} fps={30} width={960} height={540} />
  <VideoComp component={Reel} durationInFrames={RT} fps={30} width={960} height={540} />
</DesignCanvas>); }
`;
    // The app passes the FIRST comp's duration (the intro, 40) — the parser must
    // still pick the reel (media) and report its total (120) + audio.
    const r = parseCompTimeline(src, 40);
    expect(r.total).toBe(120);
    expect(r.sequences).toEqual([expect.objectContaining({ label: 'Clip', duration: 120 })]);
    expect(r.audio).toHaveLength(1);
    expect(r.audio[0].label).toBe('song.mp3');
  });

  test('the Timeline scopes to the SELECTED artboard (follows the canvas)', () => {
    const src = `
const IT = 40; const RT = 120;
const Intro = () => <AbsoluteFill/>;
function Movie(){ return <TransitionSeries><TransitionSeries.Sequence durationInFrames={IT}><Intro/></TransitionSeries.Sequence></TransitionSeries>; }
const Clip = () => <AbsoluteFill/>;
function Reel(){ return (<AbsoluteFill><TransitionSeries><TransitionSeries.Sequence durationInFrames={RT}><Clip/></TransitionSeries.Sequence></TransitionSeries><Audio src="/x/song.mp3"/></AbsoluteFill>); }
export default function Canvas(){ return (<DesignCanvas>
  <DCArtboard id="intro" width={960} height={540}><VideoComp component={Movie} durationInFrames={IT} fps={30} width={960} height={540} /></DCArtboard>
  <DCArtboard id="reel" width={960} height={540}><VideoComp component={Reel} durationInFrames={RT} fps={30} width={960} height={540} /></DCArtboard>
</DesignCanvas>); }
`;
    // Selecting the intro artboard shows the INTRO — even though the reel has media.
    const intro = parseCompTimeline(src, 40, 'intro');
    expect(intro.total).toBe(40);
    expect(intro.sequences).toEqual([expect.objectContaining({ label: 'Intro', duration: 40 })]);
    expect(intro.audio).toHaveLength(0);
    // Selecting the reel shows the reel + its music.
    const reel = parseCompTimeline(src, 40, 'reel');
    expect(reel.total).toBe(120);
    expect(reel.audio).toHaveLength(1);
  });
});
