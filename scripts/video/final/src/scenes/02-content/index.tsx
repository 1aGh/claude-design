import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { tokens } from '../../lib/tokens';

/**
 * Scene 02-content — three-point feature panel.
 *
 * 90 frames @ 30fps = 3.0 s.
 * Each row fades in staggered (0/8/16 frame offsets), holds, exits together.
 */
export const ContentScene = () => {
  const frame = useCurrentFrame();

  const items = [
    { label: 'maude init', desc: 'scaffold .ai/ in one command' },
    { label: '/design:setup-ds', desc: 'vision -> research -> refinement' },
    { label: '/design:new', desc: 'brief -> multi-artboard canvas' },
  ];

  const exit = interpolate(frame, [75, 90], [1, 0], {
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
        opacity: exit,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
        {items.map((item, i) => {
          const start = i * 8;
          const itemOpacity = interpolate(frame, [start, start + 18], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          const itemTranslate = interpolate(frame, [start, start + 18], [16, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          return (
            <div
              key={item.label}
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 32,
                opacity: itemOpacity,
                transform: `translateX(${itemTranslate}px)`,
              }}
            >
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: tokens.dark.accent,
                  flexShrink: 0,
                  alignSelf: 'center',
                }}
              />
              <div style={{ fontSize: 44, fontWeight: 600, minWidth: 420 }}>{item.label}</div>
              <div style={{ fontSize: 28, color: tokens.dark.inkMuted }}>{item.desc}</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
