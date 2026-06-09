import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { Void, Phrase, maude, font, lerp, useEnter, PANEL_SHADOW } from '../../../lib/v5-stage';

/**
 * Beat 50 · It critiques itself (180f / 6s).
 *
 * The real critic roster — ALL of them, no sampling (canvas direction) —
 * resolves in a cascade, then the auto-fix loop ticks. Grounded:
 * plugins/design/agents/*-critic.md.
 * VO: "A panel of critics grades it — accessibility, type, restraint — then
 * fixes what it flags."
 */
const t = maude.dark;

// the real roster (plugins/design/agents/*)
const CRITICS: { name: string; score: number; pass?: boolean }[] = [
  { name: 'design', score: 4.6 },
  { name: 'a11y', score: 5.0, pass: true },
  { name: 'frontend', score: 4.4 },
  { name: 'graphic-design', score: 4.7 },
  { name: 'typography', score: 4.5 },
  { name: 'motion', score: 4.3 },
  { name: 'brand', score: 4.8 },
  { name: 'copy', score: 4.2 },
  { name: 'info-architecture', score: 4.5 },
  { name: 'signature-moment', score: 4.9 },
  { name: 'draw', score: 4.6 },
  { name: 'ds-completeness', score: 5.0, pass: true },
  { name: 'ds-keeper', score: 4.7 },
];

export const V5Critics = () => {
  const frame = useCurrentFrame();
  const panel = useEnter(2, 16);
  // count up alongside the chips so it never reads "0.0" while they're green
  const agg = lerp(frame, [36, 150], [0, 4.6]);
  const fixIn = useEnter(154, 16);

  return (
    <AbsoluteFill>
      <Void theme="dark" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div
          style={{
            width: 1280,
            opacity: panel,
            transform: `translateY(${interpolate(panel, [0, 1], [28, 0])}px)`,
            background: t.bg1,
            border: `1px solid ${t.border}`,
            borderRadius: 22,
            boxShadow: PANEL_SHADOW,
            padding: 44,
            fontFamily: font.mono,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 26 }}>
            <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 32, color: t.fg0, letterSpacing: '-0.01em' }}>Critic panel</span>
            <span style={{ marginLeft: 14, fontSize: 18, color: t.fg2 }}>· {CRITICS.length} reviewers</span>
            <span style={{ marginLeft: 'auto', fontSize: 18, color: t.accent }}>auto-fix loop</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            {CRITICS.map((c, i) => {
              const at = 16 + i * 7;
              const p = lerp(frame, [at, at + 16], [0, 1]);
              const val = (c.score * p).toFixed(1);
              const active = p > 0.05;
              return (
                <div
                  key={c.name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 16px',
                    borderRadius: 12,
                    background: active ? t.bg2 : t.bg0,
                    border: `1px solid ${active ? (c.pass ? t.success : t.accentMuted) : t.borderSubtle}`,
                    opacity: interpolate(p, [0, 0.2], [0.35, 1]),
                  }}
                >
                  <span style={{ flex: 1, fontSize: 18, color: t.fg1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</span>
                  <span style={{ fontSize: 19, color: c.pass ? t.success : t.fg0 }}>{p > 0.6 ? (c.pass ? 'pass' : val) : ''}</span>
                  <span style={{ fontSize: 18, color: c.pass ? t.success : t.accent, opacity: p > 0.7 ? 1 : 0 }}>✓</span>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 30, paddingTop: 26, borderTop: `1px solid ${t.borderSubtle}` }}>
            <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 64, color: t.fg0, lineHeight: 1 }}>{agg.toFixed(1)}</span>
            <span style={{ fontSize: 22, color: t.fg2 }}>/ 5</span>
            <span style={{ marginLeft: 14, fontSize: 24, color: t.success, opacity: lerp(frame, [146, 158], [0, 1]) }}>verdict · SOLID</span>
            <span
              style={{
                marginLeft: 'auto',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                fontSize: 22,
                color: t.accent,
                background: t.accentTint,
                border: `1px solid ${t.accentMuted}`,
                borderRadius: 99,
                padding: '10px 20px',
                opacity: fixIn,
                transform: `translateY(${interpolate(fixIn, [0, 1], [10, 0])}px)`,
              }}
            >
              ✓ auto-fix · 3 applied
            </span>
          </div>
        </div>

        <Phrase frame={frame} from={108} text="then it fixes what it flags" align="center" size={30} bottom={70} />
      </Void>
    </AbsoluteFill>
  );
};
