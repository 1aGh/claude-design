import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { Void, Phrase, maude, font, lerp, easeOut, CARD_SHADOW, PANEL_SHADOW } from '../../../lib/v5-stage';

/**
 * Beat 90 · Ship it — handoff to ANY production code (150f / 5s).
 *
 * The built screen swipes left; the right reveals real code (split-screen) with
 * the design flowing left→right into the file. Framework-agnostic — Next / Vite
 * / Bun / raw — wired to your tokens. Grounded: the export engine (registry +
 * raw code).
 * VO: "hand it off — into any codebase. Next, Vite, Bun, or raw — wired to your tokens."
 */
const t = maude.dark;

const CODE: { txt: string; color: string; indent?: number }[] = [
  { txt: 'export function Hero() {', color: t.info },
  { txt: 'return (', color: t.fg1, indent: 1 },
  { txt: '<section className="hero">', color: t.success, indent: 2 },
  { txt: '<h1 style={{ color: "var(--fg-0)" }}>', color: t.success, indent: 3 },
  { txt: 'Build it on the canvas.', color: t.accent, indent: 4 },
  { txt: '</h1>', color: t.success, indent: 3 },
  { txt: '<Button>Start</Button>', color: t.success, indent: 3 },
  { txt: '</section>', color: t.success, indent: 2 },
  { txt: ') }', color: t.fg1, indent: 1 },
];

export const V5Handoff = () => {
  const frame = useCurrentFrame();

  const swipe = easeOut(lerp(frame, [16, 44], [0, 1]));
  const leftW = interpolate(swipe, [0, 1], [1920, 900]);
  const codeIn = easeOut(lerp(frame, [40, 64], [0, 1]));
  const linesShown = Math.floor(lerp(frame, [60, 132], [0, CODE.length]));

  return (
    <AbsoluteFill>
      <Void theme="dark">
        {/* LEFT — the built screen */}
        <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: leftW, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRight: swipe > 0.5 ? `1px solid ${t.border}` : 'none' }}>
          <div style={{ width: 700, height: 460, background: t.bg1, border: `1px solid ${t.border}`, borderRadius: 18, boxShadow: PANEL_SHADOW, padding: 52, transform: `translateX(${interpolate(swipe, [0, 1], [0, -40])}px)` }}>
            <div style={{ fontFamily: font.mono, fontSize: 15, color: t.fg2 }}>Hero.tsx · canvas</div>
            <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 56, lineHeight: 1.05, letterSpacing: '-0.02em', color: t.fg0, marginTop: 30 }}>Build it on the canvas.</div>
            <div style={{ fontFamily: font.body, fontSize: 22, color: t.fg1, marginTop: 16 }}>Real components on your tokens.</div>
            <span style={{ display: 'inline-block', marginTop: 30, fontFamily: font.body, fontWeight: 600, fontSize: 20, color: t.accentFg, background: t.accent, borderRadius: 12, padding: '12px 26px' }}>Start</span>
          </div>
        </div>

        {/* flow particles: canvas → code */}
        {swipe > 0.6
          ? [0, 1, 2, 3, 4].map((i) => {
              const fp = ((frame * 0.02 + i * 0.2) % 1);
              return (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    top: 360 + i * 40 - i * i * 3,
                    left: interpolate(fp, [0, 1], [880, 1080]),
                    width: 8,
                    height: 8,
                    borderRadius: 99,
                    background: t.accent,
                    boxShadow: `0 0 10px ${t.accent}`,
                    opacity: codeIn * Math.sin(fp * Math.PI),
                  }}
                />
              );
            })
          : null}

        {/* RIGHT — the code */}
        <div style={{ position: 'absolute', top: 0, right: 0, height: '100%', width: 1020, opacity: codeIn, transform: `translateX(${interpolate(codeIn, [0, 1], [60, 0])}px)`, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 80px' }}>
          {/* framework chips */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
            {['Next.js', 'Vite', 'Bun', 'raw TSX'].map((fw, i) => (
              <span key={fw} style={{ fontFamily: font.mono, fontSize: 17, color: i === 0 ? t.accent : t.fg1, background: i === 0 ? t.accentTint : t.bg2, border: `1px solid ${i === 0 ? t.accentMuted : t.border}`, borderRadius: 99, padding: '6px 16px' }}>{fw}</span>
            ))}
          </div>
          <div style={{ background: t.bg0, border: `1px solid ${t.border}`, borderRadius: 14, boxShadow: CARD_SHADOW, padding: '28px 32px', fontFamily: font.mono, fontSize: 22, lineHeight: 1.7 }}>
            {CODE.map((l, i) => (
              <div key={i} style={{ opacity: i < linesShown ? 1 : 0, paddingLeft: (l.indent ?? 0) * 22, color: l.color, transform: `translateY(${i < linesShown ? 0 : 6}px)` }}>
                {l.txt}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 20, fontFamily: font.mono, fontSize: 18, color: t.success, opacity: lerp(frame, [132, 146], [0, 1]) }}>
            + components/Hero.tsx · wired to your tokens
          </div>
        </div>

        <Phrase frame={frame} from={100} text="hand it off — into any codebase" size={30} bottom={48} />
      </Void>
    </AbsoluteFill>
  );
};
