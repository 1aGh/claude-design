import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { Caption, DottedCanvas } from '../../../lib/maude-stage';
import { maude } from '../../../lib/maude-tokens';

/**
 * Scene 15 · DS reveal — proof.
 *
 * ~6 s (180f @ 30fps). Signature: a spec sheet — the type ladder and the colour
 * ramp side by side, like a real specimen page. Intent: at least one specimen
 * clearly readable.
 */
export const DsRevealScene = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = maude.dark;

  const drift = (delay: number) => {
    const s = spring({ frame: frame - delay, fps, config: { damping: 200 }, durationInFrames: 18 });
    return { opacity: s, transform: `translateY(${interpolate(s, [0, 1], [22, 0])}px)` };
  };

  const typeRows = [
    { label: 'display / 48', size: 52 },
    { label: 'lg / 28', size: 30 },
    { label: 'md / 18', size: 20 },
    { label: 'sm / 14', size: 15 },
  ];
  const ramp = [
    { name: '--bg-0', c: t.bg0 },
    { name: '--bg-2', c: t.bg2 },
    { name: '--bg-4', c: t.bg4 },
    { name: '--fg-2', c: t.fg2 },
    { name: '--fg-0', c: t.fg0 },
    { name: '--accent', c: t.accent },
  ];

  const sheet: React.CSSProperties = {
    background: t.bg1,
    border: `1px solid ${t.border}`,
    borderRadius: 16,
    boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
    padding: 40,
  };
  const cap: React.CSSProperties = {
    fontFamily: maude.font.mono,
    fontSize: 20,
    letterSpacing: '0.05em',
    color: t.accent,
    marginBottom: 26,
  };

  return (
    <AbsoluteFill>
      <DottedCanvas theme="dark" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', gap: 32, width: 1480 }}>
          {/* TYPE SCALE */}
          <div style={{ ...sheet, flex: 1.2, ...drift(6) }}>
            <div style={cap}>TYPE SCALE</div>
            {typeRows.map((r, i) => (
              <div
                key={r.label}
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 24,
                  marginBottom: 20,
                  ...drift(12 + i * 6),
                }}
              >
                <span
                  style={{ width: 130, fontFamily: maude.font.mono, fontSize: 16, color: t.fg2 }}
                >
                  {r.label}
                </span>
                <span
                  style={{
                    fontFamily: maude.font.display,
                    fontWeight: 600,
                    fontSize: r.size,
                    color: t.fg0,
                    lineHeight: 1.1,
                  }}
                >
                  The quick brown fox
                </span>
              </div>
            ))}
          </div>

          {/* PALETTE */}
          <div style={{ ...sheet, flex: 1, ...drift(10) }}>
            <div style={cap}>PALETTE</div>
            {ramp.map((s, i) => (
              <div
                key={s.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 18,
                  marginBottom: 16,
                  ...drift(16 + i * 5),
                }}
              >
                <span
                  style={{
                    width: 56,
                    height: 40,
                    borderRadius: 8,
                    background: s.c,
                    border: `1px solid ${t.borderSubtle}`,
                  }}
                />
                <span style={{ fontFamily: maude.font.mono, fontSize: 22, color: t.fg0 }}>
                  {s.name}
                </span>
              </div>
            ))}
          </div>
        </div>

        <Caption theme="dark" frame={frame} from={130} text="a design system from a paragraph." />
      </DottedCanvas>
    </AbsoluteFill>
  );
};
