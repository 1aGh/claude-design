import { DesignCanvas, DCSection, DCArtboard, VideoComp } from '@maude/canvas-lib';
import { AbsoluteFill } from 'remotion';
import { TransitionSeries } from '@remotion/transitions';

// Desktop-E2E fixture for the enhanced-video-editing timeline scenario:
// a deterministic 3-beat <TransitionSeries> storyline (hard cuts, no media,
// no motion) so the harness can assert select / split / delete / undo / zoom
// against a stable comp. Restored byte-exact after every run.

const B1 = 60;
const B2 = 90;
const B3 = 60;
const TOTAL = B1 + B2 + B3;

const Comp = () => (
  <AbsoluteFill style={{ background: '#101014' }}>
    <TransitionSeries>
      <TransitionSeries.Sequence name="beat-one" durationInFrames={B1}>
        <AbsoluteFill style={{ background: '#1d4ed8', display: 'grid', placeItems: 'center', color: '#fff', fontFamily: 'system-ui', fontSize: 64 }}>1</AbsoluteFill>
      </TransitionSeries.Sequence>
      <TransitionSeries.Sequence name="beat-two" durationInFrames={B2}>
        <AbsoluteFill style={{ background: '#15803d', display: 'grid', placeItems: 'center', color: '#fff', fontFamily: 'system-ui', fontSize: 64 }}>2</AbsoluteFill>
      </TransitionSeries.Sequence>
      <TransitionSeries.Sequence name="beat-three" durationInFrames={B3}>
        <AbsoluteFill style={{ background: '#b91c1c', display: 'grid', placeItems: 'center', color: '#fff', fontFamily: 'system-ui', fontSize: 64 }}>3</AbsoluteFill>
      </TransitionSeries.Sequence>
    </TransitionSeries>
  </AbsoluteFill>
);

export default function Cut() {
  return (
    <DesignCanvas>
      <DCSection title="Timeline cut fixture">
        <DCArtboard id="cut" label="CUT/01" width={480} height={270}>
          <VideoComp component={Comp} durationInFrames={TOTAL} fps={30} width={480} height={270} />
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}
