import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { AbsoluteFill, Audio, staticFile } from 'remotion';
import { IntroScene } from '../scenes/01-intro';
import { ContentScene } from '../scenes/02-content';
import { OutroScene } from '../scenes/03-outro';

/**
 * Demo master composition — 3 scenes glued by 12-frame xfade transitions.
 *
 * Frame budget:
 *   intro    60 frames (2.0 s)
 *   xfade    12 frames (0.4 s, overlaps intro tail + content head)
 *   content  90 frames (3.0 s)
 *   xfade    12 frames
 *   outro    75 frames (2.5 s)
 *
 * Net duration: 60 + 90 + 75 - 2*12 = 201 frames = 6.7 s.
 * Total durationInFrames in Root.tsx: 201.
 */
export const Demo = () => (
  <AbsoluteFill>
    <Audio src={staticFile('ambient.aac')} />
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={60}>
        <IntroScene />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 12 })}
      />
      <TransitionSeries.Sequence durationInFrames={90}>
        <ContentScene />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 12 })}
      />
      <TransitionSeries.Sequence durationInFrames={75}>
        <OutroScene />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  </AbsoluteFill>
);
