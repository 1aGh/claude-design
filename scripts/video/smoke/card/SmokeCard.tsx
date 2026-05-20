import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';

export const SmokeCard = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: 'clamp' });
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
