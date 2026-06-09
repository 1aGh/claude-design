import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { Void, Pointer, Phrase, maude, font, lerp, easeOut, CARD_SHADOW, PANEL_SHADOW } from '../../../lib/v5-stage';

/**
 * Beat 60 · ✦ You talk to it through the canvas (270f / 9s) — THE HEART.
 *
 * Absorbs the old "canvas pan" beat: opens with a camera move across an infinite
 * multi-artboard canvas, pushes into one artboard, then the aha — point (source
 * chip) → comment on a pixel → draw an arrow → the element responds, and the
 * annotations clear once it's done (no clutter on the payoff). A beat of near-
 * silence before the line lands. Grounded: Studio inspector (data-cd-id) +
 * pixel comments + FigJam annotations.
 * VO: "you don't prompt it. You point. You comment on a pixel. You draw on it.
 * And it understands."
 */
const t = maude.dark;
const FOCUS = { x: 1300, y: 720 };

const Artboard: React.FC<{ x: number; y: number; w: number; h: number; dim?: boolean; children?: React.ReactNode; title: string; selected?: boolean }> = ({ x, y, w, h, dim, children, title, selected }) => (
  <div style={{ position: 'absolute', left: x, top: y, width: w, height: h }}>
    <div style={{ fontFamily: font.mono, fontSize: 18, color: t.fg2, marginBottom: 10 }}>{title}</div>
    <div
      style={{
        width: w,
        height: h - 32,
        background: t.bg1,
        border: `1px solid ${selected ? t.accent : t.border}`,
        boxShadow: selected ? `0 0 0 4px ${t.accentTint}, ${CARD_SHADOW}` : CARD_SHADOW,
        borderRadius: 16,
        overflow: 'visible',
        opacity: dim ? 0.5 : 1,
        position: 'relative',
      }}
    >
      {children}
    </div>
  </div>
);

export const V5TalkCanvas = () => {
  const frame = useCurrentFrame();

  // ── camera ──
  const pan = easeOut(lerp(frame, [0, 64], [0, 1]));
  const push = easeOut(lerp(frame, [64, 104], [0, 1]));
  const camX = interpolate(pan, [0, 1], [620, FOCUS.x]) * (1 - push) + FOCUS.x * push;
  const camY = interpolate(pan, [0, 1], [620, FOCUS.y]) * (1 - push) + FOCUS.y * push;
  const scale = interpolate(push, [0, 1], [0.6, 1.0]);
  const tx = 960 - camX * scale;
  const ty = 540 - camY * scale;

  // ── interactions ──
  const cursorLand = easeOut(lerp(frame, [104, 130], [0, 1]));
  const cursorToComment = easeOut(lerp(frame, [136, 162], [0, 1]));
  const chip = lerp(frame, [128, 140], [0, 1]);
  const selected = frame > 126 && frame < 232;
  const pin = easeOut(lerp(frame, [144, 162], [0, 1]));
  const thread = lerp(frame, [158, 172], [0, 1]);
  const arrowDraw = lerp(frame, [170, 202], [0, 1]);
  const note = lerp(frame, [188, 202], [0, 1]);
  const grow = easeOut(lerp(frame, [208, 242], [0, 1]));
  const annotFade = 1 - lerp(frame, [206, 230], [0, 1]); // annotations clear as it responds
  const doneChip = easeOut(lerp(frame, [238, 254], [0, 1]));
  const chipFade = 1 - lerp(frame, [224, 234], [0, 1]); // source chip clears before "updated" lands
  const cursorFade = 1 - lerp(frame, [206, 224], [0, 1]);

  const headSize = interpolate(grow, [0, 1], [44, 60]);

  // cursor: lands on headline, then moves down to the comment/draw area, then fades
  const cx = interpolate(cursorLand, [0, 1], [1480, 1000]) * (1 - cursorToComment) + 1180 * cursorToComment;
  const cy = interpolate(cursorLand, [0, 1], [290, 446]) * (1 - cursorToComment) + 700 * cursorToComment;

  return (
    <AbsoluteFill>
      <Void theme="dark">
        <AbsoluteFill style={{ transform: `translate(${tx}px, ${ty}px) scale(${scale})`, transformOrigin: '0 0' }}>
          {/* neighbor artboards (for the pan) */}
          <Artboard x={300} y={360} w={520} h={360} dim title="Pricing">
            <div style={{ padding: 28 }}>
              <div style={{ height: 22, width: '50%', background: t.bg3, borderRadius: 6, marginBottom: 14 }} />
              <div style={{ display: 'flex', gap: 14 }}>
                {[0, 1, 2].map((i) => <div key={i} style={{ flex: 1, height: 180, background: t.bg2, border: `1px solid ${t.border}`, borderRadius: 12 }} />)}
              </div>
            </div>
          </Artboard>
          <Artboard x={300} y={820} w={520} h={340} dim title="Settings">
            <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[0, 1, 2, 3].map((i) => <div key={i} style={{ height: 30, background: t.bg2, borderRadius: 8 }} />)}
            </div>
          </Artboard>
          <Artboard x={2000} y={520} w={460} h={420} dim title="Dashboard">
            <div style={{ padding: 28 }}>
              <div style={{ height: 120, background: t.bg2, borderRadius: 12, marginBottom: 14 }} />
              <div style={{ height: 120, background: t.bg2, borderRadius: 12 }} />
            </div>
          </Artboard>

          {/* FOCUS artboard — Hero */}
          <Artboard x={920} y={520} w={760} h={480} title="Hero.tsx" selected={selected}>
            <div style={{ padding: 56, position: 'relative', height: '100%', overflow: 'visible' }}>
              <div
                style={{
                  fontFamily: font.display,
                  fontWeight: 700,
                  fontSize: headSize,
                  lineHeight: 1.05,
                  letterSpacing: '-0.02em',
                  color: t.fg0,
                  maxWidth: 600,
                }}
              >
                Build it on the canvas.
              </div>
              <div style={{ fontFamily: font.body, fontSize: 24, color: t.fg1, marginTop: 20, maxWidth: 520 }}>
                Point at a pixel. It maps to the exact line of code.
              </div>
              <div style={{ position: 'absolute', left: 56, bottom: 44, display: 'flex', gap: 14 }}>
                <span style={{ fontFamily: font.body, fontWeight: 600, fontSize: 20, color: t.accentFg, background: t.accent, borderRadius: 12, padding: '12px 24px' }}>Start</span>
              </div>

              {/* source chip — Cmd+Click maps pixel → line (above the board) */}
              <div style={{ position: 'absolute', right: 16, top: -44, opacity: chip * chipFade, transform: `translateY(${interpolate(chip, [0, 1], [8, 0])}px)`, display: 'flex', alignItems: 'center', gap: 8, fontFamily: font.mono, fontSize: 18, color: t.accent, background: t.bg0, border: `1px solid ${t.accentMuted}`, borderRadius: 8, padding: '6px 12px', boxShadow: CARD_SHADOW }}>
                ⌘ <span style={{ color: t.fg0 }}>Hero.tsx</span>:<span style={{ color: t.accent }}>42</span>
              </div>

              {/* ✓ updated chip — appears after it responds */}
              <div style={{ position: 'absolute', right: 16, top: -44, opacity: doneChip, transform: `translateY(${interpolate(doneChip, [0, 1], [8, 0])}px)`, display: 'flex', alignItems: 'center', gap: 8, fontFamily: font.mono, fontSize: 18, color: t.success, background: t.bg0, border: `1px solid ${t.success}`, borderRadius: 8, padding: '6px 12px', boxShadow: CARD_SHADOW }}>
                ✓ updated
              </div>

              {/* comment pin + thread — lower-right, clear of the headline */}
              <div style={{ position: 'absolute', left: 360, top: 250, opacity: pin * annotFade, transform: `scale(${interpolate(pin, [0, 1], [0.4, 1])})`, transformOrigin: 'left top' }}>
                <div style={{ width: 34, height: 34, borderRadius: '50% 50% 50% 2px', background: t.presence, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: font.mono, fontSize: 16, fontWeight: 700, boxShadow: CARD_SHADOW }}>1</div>
                <div style={{ marginTop: 8, marginLeft: 6, width: 240, background: t.bg2, border: `1px solid ${t.border}`, borderRadius: 12, padding: '12px 14px', fontFamily: font.body, fontSize: 18, color: t.fg0, boxShadow: PANEL_SHADOW, opacity: thread }}>
                  make this bigger
                </div>
              </div>

              {/* hand-drawn arrow: from comment area up to the headline */}
              <svg style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible', opacity: annotFade }}>
                <path
                  d="M 372 250 C 280 200, 180 150, 150 96"
                  fill="none"
                  stroke={t.accent}
                  strokeWidth={5}
                  strokeLinecap="round"
                  strokeDasharray={420}
                  strokeDashoffset={420 - arrowDraw * 420}
                  style={{ filter: `drop-shadow(0 2px 6px ${t.accent}66)` }}
                />
                {arrowDraw > 0.92 ? (
                  <path d="M 150 96 l 24 6 m -24 -6 l 8 22" fill="none" stroke={t.accent} strokeWidth={5} strokeLinecap="round" />
                ) : null}
              </svg>

              {/* handwritten note near the arrow tail */}
              <div style={{ position: 'absolute', left: 300, top: 210, opacity: note * annotFade, transform: `rotate(-7deg) translateY(${interpolate(note, [0, 1], [8, 0])}px)`, fontFamily: font.display, fontStyle: 'italic', fontWeight: 600, fontSize: 26, color: t.accent }}>
                bigger ✦
              </div>
            </div>
          </Artboard>
        </AbsoluteFill>

        {/* WORLD minimap chip */}
        <div style={{ position: 'absolute', right: 40, bottom: 40, width: 160, height: 100, background: t.bg1, border: `1px solid ${t.border}`, borderRadius: 10, opacity: lerp(frame, [6, 24], [0, 1]), padding: 8, fontFamily: font.mono, fontSize: 12, color: t.fg2 }}>
          WORLD · 4/4
          <div style={{ position: 'relative', marginTop: 6, height: 64 }}>
            {[[10, 8], [10, 38], [62, 20], [120, 28]].map(([mx, my], i) => (
              <div key={i} style={{ position: 'absolute', left: mx, top: my, width: i === 2 ? 26 : 18, height: i === 2 ? 18 : 12, background: i === 2 ? t.accent : t.bg3, borderRadius: 3 }} />
            ))}
          </div>
        </div>

        {/* presence cursor performing the actions */}
        <Pointer x={cx} y={cy} color={t.presence} label="you" opacity={lerp(frame, [104, 116], [0, 1]) * cursorFade} />

        <Phrase frame={frame} from={4} until={70} text="one infinite canvas" align="center" size={36} bottom={150} />
        <Phrase frame={frame} from={248} text="you point. you draw. it understands." align="center" size={38} accent bottom={120} />
      </Void>
    </AbsoluteFill>
  );
};
