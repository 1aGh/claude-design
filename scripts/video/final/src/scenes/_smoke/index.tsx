import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';

/**
 * Phase 15 smoke card — verifies Remotion + the nested workspace boots.
 * Composed into the stitched smoke.mp4 by scripts/video/smoke/run.sh.
 *
 * Kept here (not under cards/) so the SmokeScene's id mirrors its purpose
 * and so /flow:video-new-scene users never accidentally start from this
 * stub when scaffolding a real scene.
 */
export const SmokeScene = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        background: '#111',
        color: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: 56,
        letterSpacing: -0.5,
      }}
    >
      <div style={{ opacity }}>maude smoke test</div>
    </AbsoluteFill>
  );
};
