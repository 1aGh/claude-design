import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { tokens } from '../../lib/tokens';

/**
 * Scene 01-intro — wordmark card.
 *
 * 60 frames @ 30fps = 2.0 s.
 * Frames 0-18: spring entrance (opacity + 24 px translateY).
 * Frames 18-48: hold.
 * Frames 48-60: fade-out.
 */
export const IntroScene = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({
    frame,
    fps,
    config: { damping: 200 },
    durationInFrames: 18,
  });
  const exit = interpolate(frame, [48, 60], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const opacity = enter * exit;
  const translateY = interpolate(enter, [0, 1], [24, 0]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: tokens.dark.bg0,
        color: tokens.dark.ink,
        fontFamily: tokens.font.mono,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          opacity,
          transform: `translateY(${translateY}px)`,
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 128, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1 }}>
          maude
        </div>
        <div
          style={{
            marginTop: 16,
            fontSize: 28,
            color: tokens.dark.inkMuted,
            letterSpacing: '0.04em',
          }}
        >
          canvas-first design + workflow for Claude Code
        </div>
        <div
          style={{
            marginTop: 32,
            width: 80,
            height: 3,
            margin: '32px auto 0',
            background: tokens.dark.accent,
            transform: `scaleX(${enter})`,
            transformOrigin: 'left center',
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
