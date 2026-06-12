import { AbsoluteFill, useCurrentFrame } from 'remotion';
import {
  CARD_SHADOW,
  easeOut,
  font,
  lerp,
  maude,
  Phrase,
  Pointer,
  Void,
} from '../../../lib/v5-stage';

/**
 * Beat 40 · It draws itself (210f / 7s).
 *
 * Multiple artboards side by side on the infinite canvas — each builds in with
 * the SAME scan-reveal used on the moodboard (a glowing edge sweeps top→bottom,
 * revealing the screen), staggered, with the Claude cursor following the active
 * build. Grounded: Studio + /design:new.
 * VO: "Describe a screen. Watch it appear. Real components, real tokens, real code."
 */
const t = maude.dark;

const ScanArtboard: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  p: number;
  children: React.ReactNode;
}> = ({ x, y, w, h, title, p, children }) => {
  const building = p > 0.01 && p < 0.99;
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: w }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 10,
          fontFamily: font.mono,
          fontSize: 16,
          color: building ? t.accent : t.fg2,
        }}
      >
        {title}
        {building ? (
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 99,
              background: t.accent,
              boxShadow: `0 0 8px ${t.accent}`,
            }}
          />
        ) : p >= 0.99 ? (
          <span style={{ color: t.success }}>✓</span>
        ) : null}
      </div>
      <div
        style={{
          position: 'relative',
          width: w,
          height: h,
          background: t.bg1,
          border: `1px solid ${building ? t.accent : t.border}`,
          borderRadius: 16,
          boxShadow: CARD_SHADOW,
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'absolute', inset: 0, clipPath: `inset(0 0 ${(1 - p) * 100}% 0)` }}>
          {children}
        </div>
        {building ? (
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: `${p * 100}%`,
              height: 3,
              background: t.accent,
              boxShadow: `0 0 26px 6px ${t.accent}`,
              transform: 'translateY(-2px)',
            }}
          />
        ) : null}
      </div>
    </div>
  );
};

export const V5ItDraws = () => {
  const frame = useCurrentFrame();

  const p1 = easeOut(lerp(frame, [14, 72], [0, 1]));
  const p2 = easeOut(lerp(frame, [66, 126], [0, 1]));
  const p3 = easeOut(lerp(frame, [118, 178], [0, 1]));

  // Claude cursor just drifts freely across the canvas (not bound to the scans)
  const cursorX = 960 + Math.sin(frame / 40) * 640 + Math.sin(frame / 17) * 40;
  const cursorY = 470 + Math.sin(frame / 25) * 240;

  const ABw = 480;
  const ABh = 560;
  const y = 280;

  return (
    <AbsoluteFill>
      <Void theme="dark">
        {/* command chip — what's running */}
        <div
          style={{
            position: 'absolute',
            top: 56,
            left: 64,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontFamily: font.mono,
            fontSize: 19,
            color: t.accent,
            background: t.accentTint,
            border: `1px solid ${t.accentMuted}`,
            borderRadius: 10,
            padding: '9px 16px',
            opacity: lerp(frame, [4, 20], [0, 1]),
          }}
        >
          <span style={{ color: t.fg2 }}>$</span> /design:new
        </div>

        {/* AB1 — Hero */}
        <ScanArtboard x={120} y={y} w={ABw} h={ABh} title="Hero.tsx" p={p1}>
          <div style={{ padding: 40 }}>
            <div
              style={{
                fontFamily: font.display,
                fontWeight: 700,
                fontSize: 44,
                lineHeight: 1.05,
                letterSpacing: '-0.02em',
                color: t.fg0,
              }}
            >
              Design, in your repo.
            </div>
            <div style={{ fontFamily: font.body, fontSize: 21, color: t.fg1, marginTop: 14 }}>
              Real components on your tokens.
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
              {['--accent', '--bg-1', '--fg-0'].map((c) => (
                <span
                  key={c}
                  style={{
                    fontFamily: font.mono,
                    fontSize: 14,
                    color: t.accent,
                    background: t.accentTint,
                    border: `1px solid ${t.accentMuted}`,
                    borderRadius: 99,
                    padding: '5px 12px',
                  }}
                >
                  {c}
                </span>
              ))}
            </div>
            <span
              style={{
                display: 'inline-block',
                marginTop: 28,
                fontFamily: font.body,
                fontWeight: 600,
                fontSize: 18,
                color: t.accentFg,
                background: t.accent,
                borderRadius: 12,
                padding: '12px 24px',
              }}
            >
              Get started
            </span>
            <div
              style={{
                marginTop: 28,
                height: 140,
                borderRadius: 12,
                background: t.bg2,
                border: `1px solid ${t.border}`,
              }}
            />
          </div>
        </ScanArtboard>

        {/* AB2 — Pricing */}
        <ScanArtboard x={720} y={y} w={ABw} h={ABh} title="Pricing.tsx" p={p2}>
          <div style={{ padding: 36 }}>
            <div
              style={{
                fontFamily: font.display,
                fontWeight: 700,
                fontSize: 34,
                color: t.fg0,
                marginBottom: 22,
              }}
            >
              Simple pricing
            </div>
            <div style={{ display: 'flex', gap: 14 }}>
              {['Free', 'Pro', 'Team'].map((plan, i) => (
                <div
                  key={plan}
                  style={{
                    flex: 1,
                    height: 320,
                    borderRadius: 14,
                    background: i === 1 ? t.bg2 : t.bg1,
                    border: `1px solid ${i === 1 ? t.accent : t.border}`,
                    padding: 18,
                  }}
                >
                  <div
                    style={{ fontFamily: font.body, fontWeight: 600, fontSize: 20, color: t.fg0 }}
                  >
                    {plan}
                  </div>
                  <div
                    style={{
                      fontFamily: font.display,
                      fontWeight: 700,
                      fontSize: 34,
                      color: i === 1 ? t.accent : t.fg0,
                      marginTop: 10,
                    }}
                  >
                    ${[0, 19, 49][i]}
                  </div>
                  <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {[0, 1, 2].map((r) => (
                      <div key={r} style={{ height: 10, borderRadius: 5, background: t.bg3 }} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </ScanArtboard>

        {/* AB3 — Dashboard */}
        <ScanArtboard x={1320} y={y} w={ABw} h={ABh} title="Dashboard.tsx" p={p3}>
          <div style={{ padding: 36 }}>
            <div
              style={{
                fontFamily: font.display,
                fontWeight: 700,
                fontSize: 32,
                color: t.fg0,
                marginBottom: 20,
              }}
            >
              Overview
            </div>
            <div style={{ display: 'flex', gap: 14, marginBottom: 18 }}>
              {[
                ['Revenue', '$48k'],
                ['Users', '1,204'],
                ['Churn', '1.2%'],
              ].map(([k, v]) => (
                <div
                  key={k}
                  style={{
                    flex: 1,
                    borderRadius: 12,
                    background: t.bg2,
                    border: `1px solid ${t.border}`,
                    padding: 16,
                  }}
                >
                  <div style={{ fontFamily: font.mono, fontSize: 13, color: t.fg2 }}>{k}</div>
                  <div
                    style={{
                      fontFamily: font.display,
                      fontWeight: 700,
                      fontSize: 26,
                      color: t.fg0,
                      marginTop: 6,
                    }}
                  >
                    {v}
                  </div>
                </div>
              ))}
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: 12,
                height: 200,
                padding: 16,
                borderRadius: 12,
                background: t.bg2,
                border: `1px solid ${t.border}`,
              }}
            >
              {[60, 110, 80, 150, 120, 180, 140].map((h, i) => (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    height: h,
                    borderRadius: 6,
                    background: i === 5 ? t.accent : t.accentMuted,
                  }}
                />
              ))}
            </div>
          </div>
        </ScanArtboard>

        {/* Claude cursor following the active build */}
        <Pointer
          x={cursorX}
          y={cursorY}
          color={t.presence}
          label="Claude"
          opacity={lerp(frame, [10, 22], [0, 1]) * (1 - lerp(frame, [184, 198], [0, 1]))}
        />

        <Phrase
          frame={frame}
          from={126}
          text="describe a screen — watch it appear"
          align="center"
          size={32}
          bottom={70}
        />
      </Void>
    </AbsoluteFill>
  );
};
