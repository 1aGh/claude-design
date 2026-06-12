import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { Caption, DottedCanvas } from '../../../lib/maude-stage';
import { maude } from '../../../lib/maude-tokens';

/**
 * Scene 25 · Critics — proof (the wow beat).
 *
 * ~7 s (210f @ 30fps). Signature: the verdict score card resolves (scores count
 * up, bars grow) then the auto-fix loop ticks. Intent: score numbers + auto-fix
 * tick visible.
 */
export const CriticsScene = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = maude.dark;

  const panel = spring({ frame: frame - 4, fps, config: { damping: 200 }, durationInFrames: 16 });

  const rows = [
    { name: 'signature', score: 4.6, at: 30 },
    { name: 'typography', score: 4.4, at: 42 },
    { name: 'a11y', score: 5.0, at: 54, pass: true },
    { name: 'restraint', score: 4.8, at: 66 },
    { name: 'copy', score: 4.2, at: 78 },
  ];

  const agg = interpolate(frame, [96, 130], [0, 4.6], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const fixIn = spring({ frame: frame - 150, fps, config: { damping: 200 }, durationInFrames: 16 });

  return (
    <AbsoluteFill>
      <DottedCanvas theme="dark" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div
          style={{
            width: 920,
            opacity: panel,
            transform: `translateY(${interpolate(panel, [0, 1], [28, 0])}px)`,
            background: t.bg1,
            border: `1px solid ${t.border}`,
            borderRadius: 20,
            boxShadow: '0 30px 90px rgba(0,0,0,0.5)',
            padding: 44,
            fontFamily: maude.font.mono,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 28 }}>
            <span style={{ fontSize: 20, letterSpacing: '0.05em', color: t.fg2 }}>
              CRITIC PANEL · 5 reviewers
            </span>
            <span style={{ marginLeft: 'auto', fontSize: 18, color: t.accent }}>auto-fix loop</span>
          </div>

          {rows.map((r) => {
            const p = interpolate(frame, [r.at, r.at + 22], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });
            const val = (r.score * p).toFixed(1);
            return (
              <div
                key={r.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 22,
                  marginBottom: 18,
                  opacity: interpolate(p, [0, 0.2], [0, 1]),
                }}
              >
                <span style={{ width: 170, fontSize: 26, color: t.fg1 }}>{r.name}</span>
                <span
                  style={{
                    flex: 1,
                    height: 10,
                    borderRadius: 99,
                    background: t.bg3,
                    overflow: 'hidden',
                  }}
                >
                  <span
                    style={{
                      display: 'block',
                      height: '100%',
                      width: `${(r.score / 5) * p * 100}%`,
                      background: r.pass ? t.success : t.accent,
                      borderRadius: 99,
                    }}
                  />
                </span>
                <span
                  style={{
                    width: 80,
                    textAlign: 'right',
                    fontSize: 26,
                    color: r.pass ? t.success : t.fg0,
                  }}
                >
                  {r.pass ? 'pass' : val}
                </span>
              </div>
            );
          })}

          {/* aggregate verdict */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 20,
              marginTop: 28,
              paddingTop: 26,
              borderTop: `1px solid ${t.borderSubtle}`,
            }}
          >
            <span
              style={{
                fontFamily: maude.font.display,
                fontWeight: 700,
                fontSize: 72,
                color: t.fg0,
                lineHeight: 1,
              }}
            >
              {agg.toFixed(1)}
            </span>
            <span style={{ fontSize: 24, color: t.fg2 }}>/ 5</span>
            <span
              style={{
                marginLeft: 16,
                fontSize: 26,
                color: t.success,
                opacity: interpolate(frame, [126, 140], [0, 1], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                }),
              }}
            >
              verdict · SOLID
            </span>
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
                padding: '8px 18px',
                opacity: fixIn,
                transform: `translateY(${interpolate(fixIn, [0, 1], [10, 0])}px)`,
              }}
            >
              ✓ auto-fix · 2 applied
            </span>
          </div>
        </div>

        <Caption
          theme="dark"
          frame={frame}
          from={172}
          text="critics score it. then it fixes itself."
        />
      </DottedCanvas>
    </AbsoluteFill>
  );
};
