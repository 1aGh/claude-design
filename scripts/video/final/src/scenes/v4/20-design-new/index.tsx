import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { AgentCursor, Caption, typewriter } from '../../../lib/maude-stage';
import { maude } from '../../../lib/maude-tokens';

/**
 * Scene 20 · /design:new — proof (the headline beat).
 *
 * ~10 s (300f @ 30fps). Signature: split-screen — the Claude TUI streams on the
 * left while the dev-server canvas fills in live on the right. Intent: left TUI
 * streaming · right canvas appearing live · presence cursor.
 */
export const DesignNewScene = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = maude.dark;

  const appear = (delay: number, rise = 16) => {
    const s = spring({ frame: frame - delay, fps, config: { damping: 200 }, durationInFrames: 14 });
    return { opacity: s, transform: `translateY(${interpolate(s, [0, 1], [rise, 0])}px)` };
  };

  const cmd = typewriter(frame, '/design:new "Recipe Recap"', 18, 40);
  const blink = Math.floor(frame / 15) % 2 === 0;

  // streaming TUI lines
  const lines: { at: number; text: string; color: string }[] = [
    { at: 78, text: '· reading .design/config.json', color: t.fg2 },
    { at: 98, text: '· design system: maude', color: t.fg2 },
    { at: 128, text: '✓ envelope · 3 artboards', color: t.success },
    { at: 158, text: '· writing Recipe Recap.tsx', color: t.fg1 },
    { at: 188, text: '████████░░ streaming tokens…', color: t.accent },
    { at: 240, text: '✓ canvas ready', color: t.success },
  ];

  // presence cursor on the right canvas
  const rightX0 = width / 2 + 120;
  const cur = spring({ frame: frame - 110, fps, config: { damping: 50 }, durationInFrames: 90 });
  const curX = interpolate(cur, [0, 1], [rightX0 + 600, rightX0 + 360]);
  const curY = interpolate(cur, [0, 1], [260, 560]);
  const curOpacity = interpolate(frame, [105, 125], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const sk = (w: string, delay: number, accent = false): React.CSSProperties => ({
    height: 18,
    width: w,
    borderRadius: 6,
    background: accent ? t.accent : t.bg3,
    ...appear(delay),
  });

  return (
    <AbsoluteFill style={{ background: t.bg0 }}>
      {/* LEFT — Claude TUI */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: '50%',
          background: t.bg0,
          padding: '70px 64px',
          borderRight: `2px solid ${t.accentMuted}`,
        }}
      >
        <div
          style={{
            fontFamily: maude.font.mono,
            fontSize: 18,
            color: t.fg3,
            marginBottom: 28,
            letterSpacing: '0.05em',
          }}
        >
          claude · scratch
        </div>
        <div style={{ fontFamily: maude.font.mono, fontSize: 30, color: t.fg0, marginBottom: 28 }}>
          <span style={{ color: t.accent, marginRight: 14 }}>&gt;</span>
          {cmd}
          {frame < 62 ? <span style={{ color: t.accent, opacity: blink ? 1 : 0 }}>▋</span> : null}
        </div>
        {lines.map((l) => (
          <div
            key={l.text}
            style={{
              fontFamily: maude.font.mono,
              fontSize: 24,
              lineHeight: 1.9,
              color: l.color,
              ...appear(l.at, 10),
            }}
          >
            {l.text}
          </div>
        ))}
      </div>

      {/* RIGHT — dev-server canvas filling live */}
      <div
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: '50%',
          backgroundColor: t.canvasBg,
          backgroundImage: `radial-gradient(${t.canvasDot} 1.4px, transparent 1.4px)`,
          backgroundSize: '28px 28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* artboard */}
        <div
          style={{
            width: 720,
            background: t.bg1,
            border: `1px solid ${t.border}`,
            borderRadius: 16,
            boxShadow: '0 24px 70px rgba(0,0,0,0.45)',
            overflow: 'hidden',
            ...appear(70, 30),
          }}
        >
          {/* title bar */}
          <div
            style={{
              display: 'flex',
              gap: 7,
              alignItems: 'center',
              padding: '16px 22px',
              borderBottom: `1px solid ${t.borderSubtle}`,
              ...appear(84),
            }}
          >
            <span style={{ width: 9, height: 9, borderRadius: 99, background: t.border }} />
            <span style={{ width: 9, height: 9, borderRadius: 99, background: t.border }} />
            <span style={{ width: 9, height: 9, borderRadius: 99, background: t.border }} />
            <span
              style={{
                marginLeft: 'auto',
                fontFamily: maude.font.mono,
                fontSize: 15,
                color: t.fg3,
              }}
            >
              Recipe Recap.tsx
            </span>
          </div>
          <div style={{ padding: 40, display: 'flex', flexDirection: 'column', gap: 22 }}>
            <div
              style={{
                fontFamily: maude.font.display,
                fontWeight: 700,
                fontSize: 56,
                color: t.fg0,
                lineHeight: 1.05,
                ...appear(112),
              }}
            >
              Recipe Recap
            </div>
            <div style={sk('70%', 142)} />
            <div style={sk('88%', 168)} />
            <div style={sk('54%', 190)} />
            <div style={{ display: 'flex', gap: 14, marginTop: 10, ...appear(214) }}>
              <span
                style={{
                  background: t.accent,
                  color: t.accentFg,
                  fontFamily: maude.font.body,
                  fontWeight: 600,
                  fontSize: 22,
                  padding: '12px 26px',
                  borderRadius: 10,
                }}
              >
                Scale portions
              </span>
              <span
                style={{
                  border: `1px solid ${t.border}`,
                  color: t.fg1,
                  fontFamily: maude.font.body,
                  fontSize: 22,
                  padding: '12px 26px',
                  borderRadius: 10,
                }}
              >
                Print
              </span>
            </div>
          </div>
        </div>
      </div>

      <AgentCursor theme="dark" x={curX} y={curY} opacity={curOpacity} label="claude" />

      <Caption theme="dark" frame={frame} from={258} text="one slash. real canvas, real code." />
    </AbsoluteFill>
  );
};
