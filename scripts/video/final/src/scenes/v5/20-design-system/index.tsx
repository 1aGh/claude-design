import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {
  CARD_SHADOW,
  easeOut,
  font,
  lerp,
  maude,
  Phrase,
  Vignette,
  Void,
} from '../../../lib/v5-stage';

/**
 * Beat 20 · The robust design system (210f / 7s).
 *
 * A whole tokenized system, not a palette — real specimens AND live components
 * fill the canvas (accent, type, spacing, elevation, buttons, chips, inputs,
 * avatars). They bob dynamically, then swirl into a vortex and vanish. Grounded:
 * system/maude/preview/* + the real ds-accent.png capture.
 * VO: "Then a whole design system, built for you. Colour, type, space, motion,
 * components — every token, in place."
 */
const t = maude.dark;

const Tile: React.FC<{ children: React.ReactNode; w: number; h: number; pad?: number }> = ({
  children,
  w,
  h,
  pad = 22,
}) => (
  <div
    style={{
      width: w,
      height: h,
      background: t.bg1,
      border: `1px solid ${t.border}`,
      borderRadius: 16,
      boxShadow: CARD_SHADOW,
      padding: pad,
      overflow: 'hidden',
      fontFamily: font.body,
      color: t.fg0,
    }}
  >
    {children}
  </div>
);

const label = (s: string) => (
  <div
    style={{
      fontFamily: font.mono,
      fontSize: 13,
      letterSpacing: '0.1em',
      color: t.fg2,
      marginBottom: 12,
    }}
  >
    {s}
  </div>
);

export const V5DesignSystem = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cx = 960;
  const cy = 540;

  const specimens = [
    // real specimen centerpiece (brightened)
    {
      x: 720,
      y: 400,
      w: 480,
      h: 300,
      delay: 0,
      ang: 0,
      pad: 0,
      node: (
        <Img
          src={staticFile('v4/ds-accent.png')}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'top left',
            filter: 'brightness(1.25) contrast(1.04) saturate(1.05)',
          }}
        />
      ),
    },
    {
      x: 120,
      y: 150,
      w: 330,
      h: 250,
      delay: 6,
      ang: -6,
      node: (
        <>
          {label('ACCENT · ONE INDIGO')}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: 16,
                background: t.accent,
                boxShadow: `0 0 0 6px ${t.accentTint}`,
              }}
            />
            <div>
              <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 28 }}>Indigo</div>
              <div style={{ fontFamily: font.mono, fontSize: 15, color: t.fg2 }}>
                oklch(.68 .18 268)
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            {[0.46, 0.56, 0.68, 0.73, 0.82].map((l) => (
              <div
                key={l}
                style={{ flex: 1, height: 28, borderRadius: 8, background: `oklch(${l} 0.16 268)` }}
              />
            ))}
          </div>
        </>
      ),
    },
    {
      x: 1380,
      y: 140,
      w: 360,
      h: 280,
      delay: 12,
      ang: 5,
      node: (
        <>
          {label('TYPE LADDER')}
          <div
            style={{
              fontFamily: font.display,
              fontWeight: 700,
              fontSize: 50,
              lineHeight: 1.05,
              letterSpacing: '-0.02em',
            }}
          >
            Display
          </div>
          <div style={{ fontFamily: font.display, fontWeight: 600, fontSize: 32, marginTop: 4 }}>
            Heading
          </div>
          <div style={{ fontFamily: font.body, fontSize: 21, color: t.fg1, marginTop: 8 }}>
            Body copy reads easy and even.
          </div>
          <div style={{ fontFamily: font.mono, fontSize: 16, color: t.fg2, marginTop: 8 }}>
            mono · 0123456789
          </div>
        </>
      ),
    },
    {
      x: 600,
      y: 110,
      w: 340,
      h: 210,
      delay: 9,
      ang: 4,
      node: (
        <>
          {label('COMPONENTS')}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
            <span
              style={{
                fontWeight: 600,
                fontSize: 18,
                color: t.accentFg,
                background: t.accent,
                borderRadius: 10,
                padding: '10px 18px',
              }}
            >
              Primary
            </span>
            <span
              style={{
                fontWeight: 600,
                fontSize: 18,
                color: t.fg0,
                background: t.bg3,
                borderRadius: 10,
                padding: '10px 18px',
              }}
            >
              Ghost
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span
              style={{
                width: 52,
                height: 30,
                borderRadius: 99,
                background: t.accent,
                position: 'relative',
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  right: 3,
                  top: 3,
                  width: 24,
                  height: 24,
                  borderRadius: 99,
                  background: '#fff',
                }}
              />
            </span>
            <span
              style={{
                flex: 1,
                height: 6,
                borderRadius: 99,
                background: t.bg3,
                position: 'relative',
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  width: '60%',
                  height: '100%',
                  borderRadius: 99,
                  background: t.accent,
                }}
              />
              <span
                style={{
                  position: 'absolute',
                  left: '60%',
                  top: -7,
                  width: 20,
                  height: 20,
                  borderRadius: 99,
                  background: '#fff',
                }}
              />
            </span>
          </div>
        </>
      ),
    },
    {
      x: 1500,
      y: 510,
      w: 340,
      h: 160,
      delay: 18,
      ang: -4,
      node: (
        <>
          {label('CHIPS · BADGES')}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {[
              ['Done', t.success],
              ['Active', t.accent],
              ['Beta', t.info],
              ['Draft', t.fg2],
            ].map(([s, c]) => (
              <span
                key={s}
                style={{
                  fontFamily: font.mono,
                  fontSize: 16,
                  color: c as string,
                  background: t.bg2,
                  border: `1px solid ${c}`,
                  borderRadius: 99,
                  padding: '6px 14px',
                }}
              >
                {s}
              </span>
            ))}
          </div>
        </>
      ),
    },
    {
      x: 1360,
      y: 720,
      w: 350,
      h: 210,
      delay: 24,
      ang: -5,
      node: (
        <>
          {label('ELEVATION · MOTION')}
          <div style={{ display: 'flex', gap: 14 }}>
            {[0.2, 0.34, 0.5].map((o, i) => (
              <div
                key={o}
                style={{
                  width: 66,
                  height: 66,
                  borderRadius: 14,
                  background: t.bg2,
                  boxShadow: `0 ${8 + i * 10}px ${20 + i * 16}px rgba(0,0,0,${o})`,
                }}
              />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            {['120', '200', '320'].map((d) => (
              <span
                key={d}
                style={{
                  fontFamily: font.mono,
                  fontSize: 15,
                  color: t.accent,
                  background: t.accentTint,
                  borderRadius: 99,
                  padding: '4px 12px',
                }}
              >
                {d}ms
              </span>
            ))}
          </div>
        </>
      ),
    },
    {
      x: 120,
      y: 470,
      w: 340,
      h: 150,
      delay: 15,
      ang: 6,
      node: (
        <>
          {label('INPUT')}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              height: 50,
              background: t.bg0,
              border: `2px solid ${t.accent}`,
              borderRadius: 12,
              padding: '0 16px',
              boxShadow: `0 0 0 4px ${t.accentTint}`,
            }}
          >
            <span style={{ fontFamily: font.body, fontSize: 20, color: t.fg0 }}>maude</span>
            <span style={{ width: 2, height: 24, background: t.accent, marginLeft: 2 }} />
            <span style={{ marginLeft: 'auto', fontFamily: font.mono, fontSize: 14, color: t.fg3 }}>
              ⏎
            </span>
          </div>
        </>
      ),
    },
    {
      x: 130,
      y: 760,
      w: 320,
      h: 200,
      delay: 21,
      ang: 4,
      node: (
        <>
          {label('SPACING · 4PT GRID')}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 90 }}>
            {[16, 28, 44, 64, 84].map((s) => (
              <div
                key={s}
                style={{ width: 34, height: s, background: t.accentMuted, borderRadius: 6 }}
              />
            ))}
          </div>
          <div style={{ fontFamily: font.mono, fontSize: 14, color: t.fg2, marginTop: 10 }}>
            4 · 8 · 12 · 16 · 24 · 32
          </div>
        </>
      ),
    },
    {
      x: 740,
      y: 720,
      w: 330,
      h: 170,
      delay: 27,
      ang: -6,
      node: (
        <>
          {label('PRESENCE · AVATARS')}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {[t.presence, t.info, t.success].map((c, i) => (
              <span
                key={i}
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 99,
                  background: c,
                  border: `3px solid ${t.bg1}`,
                  marginLeft: i ? -14 : 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontFamily: font.body,
                  fontWeight: 600,
                  fontSize: 18,
                }}
              >
                {['D', 'S', 'A'][i]}
              </span>
            ))}
            <span
              style={{
                width: 46,
                height: 46,
                borderRadius: 99,
                background: t.bg3,
                border: `3px solid ${t.bg1}`,
                marginLeft: -14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: t.fg1,
                fontFamily: font.mono,
                fontSize: 16,
              }}
            >
              +3
            </span>
            <span
              style={{
                marginLeft: 16,
                width: 12,
                height: 12,
                borderRadius: 99,
                background: t.success,
                boxShadow: `0 0 8px ${t.success}`,
              }}
            />
            <span style={{ marginLeft: 8, fontFamily: font.mono, fontSize: 15, color: t.fg2 }}>
              live
            </span>
          </div>
        </>
      ),
    },
  ];

  return (
    <AbsoluteFill>
      <Void theme="dark">
        {specimens.map((sp, i) => {
          const enter = spring({
            frame: frame - sp.delay,
            fps,
            config: { damping: 12, mass: 0.7 },
            durationInFrames: 30,
          });
          const bob = Math.sin((frame + i * 22) / 26) * 9;
          // professional exit: a staggered cascade — each tile dips (anticipation),
          // then glides to centre, scales out + fades. No chaotic spin.
          const vp = easeOut(lerp(frame, [206 + i * 3, 232 + i * 3], [0, 1]));
          const vx = (cx - (sp.x + sp.w / 2)) * vp;
          const vy = (cy - (sp.y + sp.h / 2)) * vp;
          const exitScale = interpolate(vp, [0, 0.18, 1], [1, 1.05, 0]);
          const rot = sp.ang + (i % 2 ? 1 : -1) * vp * 40;
          const scale = interpolate(enter, [0, 1], [0.8, 1]) * exitScale;
          const op = Math.min(1, enter) * (1 - Math.min(1, vp * 1.05));
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: sp.x + vx,
                top: sp.y + vy + (1 - vp) * bob,
                opacity: op,
                transform: `rotate(${rot}deg) scale(${scale})`,
                transformOrigin: 'center',
                zIndex: i === 0 ? 20 : 10,
              }}
            >
              <Tile w={sp.w} h={sp.h} pad={sp.pad}>
                {sp.node}
              </Tile>
            </div>
          );
        })}
        <Vignette strength={0.4} />
        <Phrase
          frame={frame}
          from={40}
          until={205}
          text="every token, in place"
          align="center"
          size={34}
          bottom={110}
        />
      </Void>
    </AbsoluteFill>
  );
};
