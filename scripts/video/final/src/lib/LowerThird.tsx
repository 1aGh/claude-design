import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { tokens } from './tokens';

/**
 * Reusable bottom caption strip with accent-tinted plate.
 * Fades in over 12 frames, holds, fades out over 12 frames.
 *
 * Per [no AI-tell punctuation] memory: captions must be ASCII only (no em/en
 * dash, no curly quotes, no ellipsis char). The component does not enforce
 * this — the storyboard / caller is responsible.
 */
type Props = {
  readonly caption: string;
  readonly durationInFrames: number;
};

export const LowerThird: React.FC<Props> = ({ caption, durationInFrames }) => {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: 'clamp' });
  const fadeOut = interpolate(frame, [durationInFrames - 12, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const opacity = fadeIn * fadeOut;

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingBottom: 80,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          opacity,
          padding: '14px 28px',
          borderRadius: 8,
          backgroundColor: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(8px)',
          borderLeft: `3px solid ${tokens.dark.accent}`,
          fontFamily: tokens.font.mono,
          fontSize: 28,
          color: tokens.dark.ink,
          letterSpacing: '0.01em',
        }}
      >
        {caption}
      </div>
    </AbsoluteFill>
  );
};
