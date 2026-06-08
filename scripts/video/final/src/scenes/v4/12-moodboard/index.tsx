import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { maude } from '../../../lib/maude-tokens';
import { DottedCanvas, Caption } from '../../../lib/maude-stage';

/**
 * Scene 12 · Moodboard — proof.
 *
 * ~5 s (150f @ 30fps). Signature: the reference pool — mood clusters + OKLCH
 * colour options + type pairings drift in, staggered, like a board being
 * pinned. Intent: mood tiles + colour options + a type pairing visible.
 */
export const MoodboardScene = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = maude.dark;

  // Staggered drift-in helper.
  const drift = (delay: number) => {
    const s = spring({ frame: frame - delay, fps, config: { damping: 200 }, durationInFrames: 20 });
    return { opacity: s, transform: `translateY(${interpolate(s, [0, 1], [26, 0])}px)` };
  };

  const card: React.CSSProperties = {
    position: 'absolute',
    borderRadius: 14,
    border: `1px solid ${t.border}`,
    boxShadow: '0 16px 50px rgba(0,0,0,0.4)',
  };

  const oklch = ['oklch(0.68 0.18 268)', 'oklch(0.62 0.20 28)', 'oklch(0.74 0.15 162)', 'oklch(0.78 0.14 85)', 'oklch(0.70 0.19 322)'];

  return (
    <AbsoluteFill>
      <DottedCanvas theme="dark">
        <div style={{ position: 'absolute', inset: 0 }}>
          {/* label */}
          <div
            style={{
              position: 'absolute',
              left: 200,
              top: 200,
              fontFamily: maude.font.mono,
              fontSize: 22,
              letterSpacing: '0.05em',
              color: t.accent,
              ...drift(0),
            }}
          >
            REFERENCE POOL · domain research
          </div>

          {/* mood tile — accent gradient */}
          <div style={{ ...card, left: 200, top: 270, width: 420, height: 300, background: `linear-gradient(150deg, ${t.accent}, ${t.bg2})`, ...drift(8) }} />
          {/* mood tile — neutral "photo" */}
          <div style={{ ...card, left: 650, top: 270, width: 300, height: 300, background: t.fg2, ...drift(16) }} />
          {/* mood tile — dark dotted panel */}
          <div
            style={{
              ...card,
              left: 200,
              top: 600,
              width: 750,
              height: 200,
              background: t.bg1,
              backgroundImage: `radial-gradient(${t.canvasDot} 1.4px, transparent 1.4px)`,
              backgroundSize: '22px 22px',
              ...drift(24),
            }}
          />

          {/* type pairing card */}
          <div
            style={{
              ...card,
              left: 1010,
              top: 270,
              width: 510,
              height: 300,
              background: t.bg1,
              padding: 34,
              ...drift(20),
            }}
          >
            <div style={{ fontFamily: maude.font.mono, fontSize: 18, color: t.fg2, letterSpacing: '0.05em' }}>TYPE PAIRING</div>
            <div style={{ fontFamily: maude.font.display, fontWeight: 700, fontSize: 96, color: t.fg0, lineHeight: 1.1 }}>Aa</div>
            <div style={{ fontFamily: maude.font.display, fontSize: 26, color: t.fg1 }}>Inter Tight · Inter</div>
            <div style={{ fontFamily: maude.font.mono, fontSize: 22, color: t.fg2, marginTop: 6 }}>JetBrains Mono</div>
          </div>

          {/* OKLCH options row */}
          <div style={{ position: 'absolute', left: 1010, top: 600, width: 510, ...drift(30) }}>
            <div style={{ fontFamily: maude.font.mono, fontSize: 18, color: t.fg2, letterSpacing: '0.05em', marginBottom: 14 }}>
              COLOUR OPTIONS · OKLCH
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              {oklch.map((c) => (
                <span key={c} style={{ flex: 1, height: 84, borderRadius: 12, background: c, border: `1px solid ${t.borderSubtle}` }} />
              ))}
            </div>
          </div>
        </div>

        <Caption theme="dark" frame={frame} from={104} text="research first — a moodboard, not a guess." />
      </DottedCanvas>
    </AbsoluteFill>
  );
};
