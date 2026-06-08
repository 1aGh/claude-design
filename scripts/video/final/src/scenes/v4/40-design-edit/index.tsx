import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { maude } from '../../../lib/maude-tokens';
import { Caption, typewriter } from '../../../lib/maude-stage';

/**
 * Scene 40 · /design:edit — proof.
 *
 * ~9 s (270f @ 30fps). Signature: split-screen — the edit diff on the left, the
 * same canvas reloading on the right. Intent: left edit diff · right edit
 * applied in place.
 */
export const DesignEditScene = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = maude.dark;

  const appear = (delay: number, rise = 14) => {
    const s = spring({ frame: frame - delay, fps, config: { damping: 200 }, durationInFrames: 14 });
    return { opacity: s, transform: `translateY(${interpolate(s, [0, 1], [rise, 0])}px)` };
  };

  const cmd = typewriter(frame, '/design:edit "tighten hero, drop a meta row"', 18, 50);
  const blink = Math.floor(frame / 15) % 2 === 0;

  // reload flash on the right ~frame 150
  const flash = interpolate(frame, [148, 158, 170], [0, 0.5, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const reloaded = spring({ frame: frame - 172, fps, config: { damping: 200 }, durationInFrames: 12 });

  const diff: { sign: '-' | '+'; text: string; at: number }[] = [
    { sign: '-', text: 'padding: 96px 0', at: 80 },
    { sign: '+', text: 'padding: 56px 0', at: 96 },
    { sign: '-', text: '<Meta label="prep" />', at: 116 },
    { sign: '-', text: '<Meta label="cuisine" />', at: 132 },
  ];

  return (
    <AbsoluteFill style={{ background: t.bg0 }}>
      {/* LEFT — TUI + diff */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '50%', background: t.bg0, padding: '70px 64px', borderRight: `2px solid ${t.accentMuted}` }}>
        <div style={{ fontFamily: maude.font.mono, fontSize: 18, color: t.fg3, marginBottom: 28, letterSpacing: '0.05em' }}>claude · scratch</div>
        <div style={{ fontFamily: maude.font.mono, fontSize: 27, color: t.fg0, marginBottom: 34, lineHeight: 1.4 }}>
          <span style={{ color: t.accent, marginRight: 12 }}>&gt;</span>
          {cmd}
          {frame < 74 ? <span style={{ color: t.accent, opacity: blink ? 1 : 0 }}>▋</span> : null}
        </div>
        <div style={{ fontFamily: maude.font.mono, fontSize: 17, color: t.fg3, marginBottom: 14, letterSpacing: '0.05em' }}>Hero.tsx</div>
        {diff.map((d) => (
          <div
            key={d.text}
            style={{
              fontFamily: maude.font.mono,
              fontSize: 24,
              lineHeight: 1.75,
              padding: '2px 14px',
              borderRadius: 6,
              color: d.sign === '-' ? t.error : t.success,
              background: d.sign === '-' ? 'oklch(0.66 0.19 25 / 0.12)' : 'oklch(0.76 0.15 162 / 0.14)',
              marginBottom: 6,
              width: 'fit-content',
              ...appear(d.at, 8),
            }}
          >
            {d.sign} {d.text}
          </div>
        ))}
      </div>

      {/* RIGHT — canvas reloaded */}
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
        <div style={{ position: 'relative', width: 720, background: t.bg1, border: `1px solid ${t.border}`, borderRadius: 16, boxShadow: '0 24px 70px rgba(0,0,0,0.45)', overflow: 'hidden' }}>
          {/* reload flash overlay */}
          <div style={{ position: 'absolute', inset: 0, background: t.accent, opacity: flash, pointerEvents: 'none', zIndex: 2 }} />
          <div style={{ display: 'flex', gap: 7, alignItems: 'center', padding: '16px 22px', borderBottom: `1px solid ${t.borderSubtle}` }}>
            <span style={{ width: 9, height: 9, borderRadius: 99, background: t.border }} />
            <span style={{ width: 9, height: 9, borderRadius: 99, background: t.border }} />
            <span style={{ marginLeft: 'auto', fontFamily: maude.font.mono, fontSize: 15, color: t.fg3 }}>Recipe Recap.tsx</span>
          </div>
          {/* tightened hero (less padding), one fewer meta row */}
          <div style={{ padding: '34px 40px', display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ fontFamily: maude.font.display, fontWeight: 700, fontSize: 52, color: t.fg0 }}>Recipe Recap</div>
            <div style={{ height: 16, width: '70%', borderRadius: 6, background: t.bg3 }} />
            <div style={{ display: 'flex', gap: 12 }}>
              <span style={{ fontFamily: maude.font.mono, fontSize: 18, color: t.fg2, background: t.bg2, borderRadius: 8, padding: '6px 14px' }}>serves 4</span>
              <span style={{ fontFamily: maude.font.mono, fontSize: 18, color: t.fg2, background: t.bg2, borderRadius: 8, padding: '6px 14px' }}>35 min</span>
            </div>
            <span style={{ alignSelf: 'flex-start', background: t.accent, color: t.accentFg, fontFamily: maude.font.body, fontWeight: 600, fontSize: 22, padding: '12px 26px', borderRadius: 10, marginTop: 6 }}>Scale portions</span>
          </div>
          {/* reloaded badge */}
          <span
            style={{
              position: 'absolute',
              top: 16,
              left: 22,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              fontFamily: maude.font.mono,
              fontSize: 16,
              color: t.success,
              background: t.bg2,
              border: `1px solid ${t.borderSubtle}`,
              borderRadius: 99,
              padding: '5px 12px',
              opacity: reloaded,
              zIndex: 3,
            }}
          >
            ✓ reloaded
          </span>
        </div>
      </div>

      <Caption theme="dark" frame={frame} from={210} text="edit. reload. same canvas." />
    </AbsoluteFill>
  );
};
