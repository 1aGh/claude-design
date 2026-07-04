// Maude Video Intro — a video-comp smoke/demo (DDR-148).
// A ~4s branded intro authored AS a canvas: two beats joined by a crossfade,
// everything frame-driven (deterministic → exports frame-perfect). Open it in
// Maude, scrub it in the Timeline panel, and ⌘E → MP4/GIF.

import { DCArtboard, DCSection, DesignCanvas, VideoComp } from '@maude/canvas-lib';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';

const INK = '#0b0e16';
const CREAM = '#f5efe6';
const AMBER = '#e0761f';
const RUST = '#8a2f12';

const A = 66; // beat A frames
const XF = 16; // crossfade frames
const B = 62; // beat B frames
const TOTAL = A + B - XF;

// Beat A — the wordmark springs up letter-by-letter, an amber rule wipes in,
// a spark blinks, and the tagline fades up.
const Intro = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const letters = 'maude'.split('');
  const rule = interpolate(frame, [12, 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const sparkOn = Math.floor(frame / 8) % 2 === 0 && frame > 6;
  const tagY = interpolate(frame, [26, 42], [16, 0], { extrapolateRight: 'clamp' });
  const tagO = interpolate(frame, [26, 42], [0, 1], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(120% 90% at 50% 30%, #131a2b 0%, ${INK} 70%)`,
        color: CREAM,
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif',
      }}
    >
      <div style={{ position: 'relative', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center' }}>
          {letters.map((ch, i) => {
            const s = spring({ frame: frame - i * 4, fps, config: { damping: 200, mass: 0.7 } });
            const y = interpolate(s, [0, 1], [46, 0]);
            const o = interpolate(s, [0, 1], [0, 1]);
            return (
              <span
                key={i}
                style={{
                  display: 'inline-block',
                  fontSize: 132,
                  fontWeight: 800,
                  letterSpacing: '-0.04em',
                  transform: `translateY(${y}px)`,
                  opacity: o,
                  color: '#d48917',
                }}
              >
                {ch}
              </span>
            );
          })}
          <span
            style={{
              display: 'inline-block',
              width: 22,
              height: 96,
              marginLeft: 14,
              borderRadius: 4,
              background: AMBER,
              opacity: sparkOn ? 1 : 0.15,
              boxShadow: sparkOn ? `0 0 24px ${AMBER}` : 'none',
            }}
          />
        </div>
        <div
          style={{
            height: 4,
            marginTop: 14,
            borderRadius: 999,
            background: AMBER,
            transform: `scaleX(${rule})`,
            transformOrigin: 'left center',
          }}
        />
        <div
          style={{
            marginTop: 26,
            fontSize: 26,
            fontWeight: 500,
            letterSpacing: '0.02em',
            color: '#b9b2a6',
            transform: `translateY(${tagY}px)`,
            opacity: tagO,
          }}
        >
          design at the speed of thought
        </div>
      </div>
    </AbsoluteFill>
  );
};

// Beat B — the payoff: "now moves." with a play mark drawing in.
const Payoff = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 180 } });
  const scale = interpolate(pop, [0, 1], [0.86, 1]);
  const triX = interpolate(frame, [10, 24], [-12, 0], { extrapolateRight: 'clamp' });
  const triO = interpolate(frame, [10, 22], [0, 1], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, ${AMBER} 0%, ${RUST} 100%)`,
        color: INK,
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 26, transform: `scale(${scale})` }}>
        <svg width="84" height="84" viewBox="0 0 84 84" style={{ opacity: triO, transform: `translateX(${triX}px)` }} aria-hidden>
          <circle cx="42" cy="42" r="40" fill="rgba(11,14,22,0.16)" />
          <path d="M32 26 L62 42 L32 58 Z" fill={INK} />
        </svg>
        <div style={{ fontSize: 108, fontWeight: 800, letterSpacing: '-0.03em' }}>now moves.</div>
      </div>
    </AbsoluteFill>
  );
};

function Movie() {
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={A}>
        <Intro />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: XF })} />
      <TransitionSeries.Sequence durationInFrames={B}>
        <Payoff />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
}

export default function Canvas() {
  return (
    <DesignCanvas>
      <DCSection title="Video intro">
        <DCArtboard id="intro" label="Maude Intro" width={960} height={540}>
          <VideoComp component={Movie} durationInFrames={TOTAL} fps={30} width={960} height={540} />
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}
