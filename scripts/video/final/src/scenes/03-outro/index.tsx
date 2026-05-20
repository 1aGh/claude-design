import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { tokens } from '../../lib/tokens';

/**
 * Scene 03-outro — install command + GitHub URL.
 *
 * 75 frames @ 30fps = 2.5 s.
 * Underline wipes left -> right under the install command.
 */
export const OutroScene = () => {
  const frame = useCurrentFrame();

  const fade = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: 'clamp' });
  const underlineWidth = interpolate(frame, [12, 48], [0, 1], {
    extrapolateLeft: 'clamp',
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
      <div style={{ opacity: fade, textAlign: 'center' }}>
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <div style={{ fontSize: 56, fontWeight: 600, letterSpacing: '-0.01em' }}>
            npm i -g @1agh/maude
          </div>
          <div
            style={{
              position: 'absolute',
              left: 0,
              bottom: -10,
              height: 4,
              width: '100%',
              background: tokens.dark.accent,
              transform: `scaleX(${underlineWidth})`,
              transformOrigin: 'left center',
            }}
          />
        </div>
        <div
          style={{
            marginTop: 48,
            fontSize: 26,
            color: tokens.dark.inkMuted,
            letterSpacing: '0.04em',
          }}
        >
          github.com/1aGh/maude
        </div>
      </div>
    </AbsoluteFill>
  );
};
