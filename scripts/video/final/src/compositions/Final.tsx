import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { AbsoluteFill, Audio, Sequence, staticFile } from 'remotion';
import { LowerThird } from '../lib/LowerThird';
import { BrowserChrome, TerminalFrame } from '../lib/capture-frames';
import { IntroScene } from '../scenes/01-intro';
import { OutroScene } from '../scenes/03-outro';

/**
 * Final cut — proves the full phase-15.5 capture-to-assembly pipe works.
 *
 * Frame budget @ 30fps:
 *   intro       60 frames (2.0 s)         IntroScene wordmark
 *   xfade       12 frames (0.4 s)
 *   terminal   135 frames (4.5 s)         VHS-captured maude init
 *   xfade       12 frames
 *   browser    120 frames (4.0 s)         Playwright dev-server tour
 *   xfade       12 frames
 *   outro       75 frames (2.5 s)         OutroScene install command
 *
 * Net: 60 + 135 + 120 + 75 - 3*12 = 354 frames = 11.8 s.
 *
 * Capture scenes get a bottom-aligned <LowerThird> caption strip via
 * <Sequence> overlay. Audio bed plays under everything.
 *
 * Capture wrappers (TerminalFrame / BrowserChrome) live in lib/capture-frames/
 * and accept `src` as a prop — adding a new scene from a new capture is a
 * one-line component invocation, not a copy-paste of the wrapper.
 */

const INTRO = 60;
const XFADE = 12;
const TERMINAL = 135;
const BROWSER = 120;
const OUTRO = 75;

const TERMINAL_START = INTRO - XFADE;
const BROWSER_START = TERMINAL_START + TERMINAL - XFADE;

export const Final = () => (
  <AbsoluteFill>
    <Audio src={staticFile('ambient.aac')} volume={0.7} />

    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={INTRO}>
        <IntroScene />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: XFADE })}
      />
      <TransitionSeries.Sequence durationInFrames={TERMINAL}>
        <TerminalFrame src="scene-terminal.mp4" />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: XFADE })}
      />
      <TransitionSeries.Sequence durationInFrames={BROWSER}>
        <BrowserChrome src="scene-browser.mp4" urlBar="localhost:4399" />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: XFADE })}
      />
      <TransitionSeries.Sequence durationInFrames={OUTRO}>
        <OutroScene />
      </TransitionSeries.Sequence>
    </TransitionSeries>

    {/* Captions over capture scenes only. Intro / outro carry their own typography. */}
    <Sequence from={TERMINAL_START} durationInFrames={TERMINAL}>
      <LowerThird
        caption="maude init  ·  scaffold .ai/ in one command"
        durationInFrames={TERMINAL}
      />
    </Sequence>
    <Sequence from={BROWSER_START} durationInFrames={BROWSER}>
      <LowerThird
        caption="live dev-server  ·  canvas browser at localhost:4399"
        durationInFrames={BROWSER}
      />
    </Sequence>
  </AbsoluteFill>
);
