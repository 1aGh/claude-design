import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { Void, Pointer, Phrase, maude, font, lerp, easeOut } from '../../../lib/v5-stage';

/**
 * Beat 00 · Cold open — the hook (120f / 4s).
 *
 * Caret pulses alone on the dotted void → "maude" types in → multiple LABELLED
 * cursors converge (you + Claude Code + an AI agent) so the very first frame
 * reads as a human × AI collaboration tool, not a solo editor (canvas direction).
 * VO: "Every design tool pulls you out of your code… not this one."
 */
export const V5ColdOpen = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = maude.dark;
  const cx = width / 2;
  const cy = height / 2;

  const typeIn = lerp(frame, [14, 46], [0, 1]);
  const wmReveal = easeOut(typeIn) * 680;
  const caretOn = Math.floor(frame / 14) % 2 === 0;

  // three labelled cursors drift in and settle around the wordmark
  const peers = [
    { color: t.presence, label: 'you', fromX: cx + 620, fromY: cy - 420, toX: cx + 300, toY: cy + 30, delay: 8 },
    { color: t.info, label: 'Claude Code', fromX: cx - 720, fromY: cy + 360, toX: cx - 470, toY: cy + 70, delay: 20 },
    { color: t.success, label: 'AI agent', fromX: cx + 480, fromY: cy + 440, toX: cx + 210, toY: cy - 150, delay: 32 },
  ];

  return (
    <AbsoluteFill>
      <Void theme="dark">
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <span
              style={{
                display: 'inline-block',
                maxWidth: wmReveal,
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                fontFamily: font.display,
                fontWeight: 700,
                fontSize: 156,
                lineHeight: 1,
                letterSpacing: '-0.025em',
                color: t.fg0,
              }}
            >
              maude
            </span>
            <span
              style={{
                display: 'inline-block',
                width: 7,
                height: 112,
                background: t.accent,
                opacity: caretOn ? 1 : 0,
                borderRadius: 2,
              }}
            />
          </div>
        </AbsoluteFill>

        {peers.map((p) => {
          const s = spring({ frame: frame - p.delay, fps, config: { damping: 12, mass: 0.7 }, durationInFrames: 46 });
          const op = lerp(frame, [p.delay, p.delay + 12], [0, 1]);
          return (
            <Pointer
              key={p.label}
              x={interpolate(s, [0, 1], [p.fromX, p.toX])}
              y={interpolate(s, [0, 1], [p.fromY, p.toY])}
              color={p.color}
              label={p.label}
              opacity={op}
            />
          );
        })}

        <Phrase frame={frame} from={48} text="design — inside your code." align="center" size={32} bottom={150} />
      </Void>
    </AbsoluteFill>
  );
};
