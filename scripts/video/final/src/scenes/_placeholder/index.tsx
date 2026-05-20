import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { tokens } from '../../lib/tokens';

/**
 * Placeholder scene — sanity check the workspace boots.
 * Replaced when real scenes land via /flow:video-new-scene.
 */
export const PlaceholderScene = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 30, 60, 90], [0, 1, 1, 0], {
    extrapolateRight: 'clamp',
  });

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
      <div style={{ opacity, fontSize: 56, letterSpacing: '0.02em' }}>
        @maude/video — workspace placeholder
      </div>
    </AbsoluteFill>
  );
};
