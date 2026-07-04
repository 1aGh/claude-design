// video-comp-fixture.tsx — DDR-148 canonical video-comp fixture.
//
// A reusable comp exercising the full authoring vocabulary: a frame-driven
// animated title, two "clips" joined by a crossfade in a <TransitionSeries>,
// and a music-bed <Audio> with a volume envelope. Used by:
//   • video-comp-fixture.test.ts — builds it through the real canvas pipeline
//     (buildCanvasModule) and asserts remotion / @remotion/transitions stay
//     external + <VideoComp> is present (CI-safe, no browser).
//   • the live E2E sweep (drop → scrub → export) as a stable target.
//
// Deterministic BY CONSTRUCTION — every value is a pure function of the frame.

import { DCArtboard, DCSection, DesignCanvas, VideoComp } from '@maude/canvas-lib';
import { AbsoluteFill, Audio, interpolate, useCurrentFrame } from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';

const CLIP = 45;
const XF = 15;
const TOTAL = 2 * CLIP - XF; // two clips + one crossfade

const Beat = ({ label, bg }: { label: string; bg: string }) => {
  const frame = useCurrentFrame();
  const y = interpolate(frame, [0, 14], [24, 0], { extrapolateRight: 'clamp' });
  const opacity = interpolate(frame, [0, 14], [0, 1], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill
      style={{
        background: bg,
        color: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'system-ui, sans-serif',
        fontSize: 72,
        fontWeight: 800,
      }}
    >
      <div style={{ transform: `translateY(${y}px)`, opacity }}>{label}</div>
    </AbsoluteFill>
  );
};

function Fixture() {
  return (
    <AbsoluteFill>
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={CLIP}>
          <Beat label="MAUDE" bg="#0f172a" />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: XF })}
        />
        <TransitionSeries.Sequence durationInFrames={CLIP}>
          <Beat label="VIDEO" bg="#7c2d12" />
        </TransitionSeries.Sequence>
      </TransitionSeries>
      <Audio
        src="assets/music.mp3"
        volume={(f) =>
          interpolate(f, [TOTAL - 15, TOTAL], [0.7, 0], { extrapolateLeft: 'clamp' })
        }
      />
    </AbsoluteFill>
  );
}

export default function Canvas() {
  return (
    <DesignCanvas>
      <DCSection title="Video-comp fixture">
        <DCArtboard id="fixture" label="Fixture" width={640} height={360}>
          <VideoComp component={Fixture} durationInFrames={TOTAL} fps={30} width={640} height={360} />
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}
