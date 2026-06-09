import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { Void, Pointer, Phrase, maude, font, lerp, easeOut, CARD_SHADOW, PANEL_SHADOW } from '../../../lib/v5-stage';

/**
 * Beat 65 · Multiplayer (210f / 7s).
 *
 * Continuous from 60 — same focus artboard, now with 2–3 distinctly-coloured
 * presence cursors moving live; a peer's edit lands for everyone (the
 * bidirectional-sync proof); a connected-peers card + a `maude hub` invite. A
 * dramatic "It's multiplayer" title. Grounded: Phase 9 self-hosted hub.
 * VO: "you're not the only cursor. Live, peer to peer, through a hub you run —
 * no SaaS, no sign-up."
 */
const t = maude.dark;

// orbiting peer cursors (sine paths around the artboard)
// orbits roam the margins / lower canvas so labels stay clear of the headline
const PEERS = [
  { label: 'you', color: t.presence, cx: 700, cy: 760, rx: 130, ry: 70, ph: 0, speed: 36 },
  { label: 'Dana', color: t.info, cx: 1320, cy: 470, rx: 120, ry: 110, ph: 2, speed: 44 },
  { label: 'Sam', color: t.success, cx: 1180, cy: 800, rx: 120, ry: 60, ph: 4, speed: 30 },
];

export const V5Multiplayer = () => {
  const frame = useCurrentFrame();

  const board = easeOut(lerp(frame, [0, 16], [0, 1]));
  // Dana's edit lands at ~frame 96: the CTA recolors + a "synced" flash
  const edit = easeOut(lerp(frame, [96, 118], [0, 1]));
  const flash = lerp(frame, [96, 110], [1, 0]);
  const title = easeOut(lerp(frame, [130, 152], [0, 1]));
  const peersCard = easeOut(lerp(frame, [20, 38], [0, 1]));

  return (
    <AbsoluteFill>
      <Void theme="dark">
        {/* focus artboard (continuous look from beat 60) */}
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
          <div
            style={{
              width: 760,
              height: 460,
              background: t.bg1,
              border: `1px solid ${edit < 1 && flash > 0 ? t.success : t.border}`,
              borderRadius: 18,
              boxShadow: PANEL_SHADOW,
              padding: 56,
              position: 'relative',
              opacity: board,
              transform: `scale(${interpolate(board, [0, 1], [0.96, 1])})`,
            }}
          >
            <div style={{ fontFamily: font.mono, fontSize: 16, color: t.fg2, position: 'absolute', top: 18, left: 56 }}>Hero.tsx</div>
            <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 70, lineHeight: 1.05, letterSpacing: '-0.02em', color: t.fg0, marginTop: 24 }}>
              Build it together.
            </div>
            <div style={{ fontFamily: font.body, fontSize: 24, color: t.fg1, marginTop: 18, maxWidth: 520 }}>
              Same canvas. Same repo. Everyone's edits land on disk.
            </div>
            <div style={{ position: 'absolute', left: 56, bottom: 48, display: 'flex', gap: 14, alignItems: 'center' }}>
              <span style={{ fontFamily: font.body, fontWeight: 600, fontSize: 20, color: t.accentFg, background: interpolate(edit, [0, 1], [0.5, 1]) > 0.99 ? t.accent : t.accent, borderRadius: 12, padding: '12px 24px' }}>
                Start
              </span>
              {/* the peer's added chip — lands at frame 96 */}
              <span style={{ fontFamily: font.body, fontWeight: 600, fontSize: 20, color: t.fg0, background: t.bg3, borderRadius: 12, padding: '12px 24px', opacity: edit, transform: `scale(${interpolate(edit, [0, 1], [0.7, 1])})`, border: `1px solid ${t.border}` }}>
                Book a demo
              </span>
              {/* who edited */}
              <span style={{ fontFamily: font.mono, fontSize: 15, color: t.info, opacity: lerp(frame, [100, 112], [0, 1]) * (1 - lerp(frame, [150, 165], [0, 1])) }}>
                ↳ Dana added this
              </span>
            </div>

            {/* synced flash */}
            <div style={{ position: 'absolute', inset: 0, borderRadius: 18, pointerEvents: 'none', boxShadow: `inset 0 0 0 3px ${t.success}`, opacity: flash }} />
          </div>
        </AbsoluteFill>

        {/* connected-peers / hub card */}
        <div style={{ position: 'absolute', right: 48, top: 48, width: 320, background: t.bg1, border: `1px solid ${t.border}`, borderRadius: 14, padding: 20, boxShadow: CARD_SHADOW, opacity: peersCard, transform: `translateY(${interpolate(peersCard, [0, 1], [-12, 0])}px)`, fontFamily: font.mono }}>
          <div style={{ fontSize: 14, letterSpacing: '0.1em', color: t.fg2, marginBottom: 14 }}>maude hub · 3 connected</div>
          {PEERS.map((p) => (
            <div key={p.label} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <span style={{ width: 12, height: 12, borderRadius: 99, background: p.color, boxShadow: `0 0 8px ${p.color}` }} />
              <span style={{ fontSize: 18, color: t.fg0, fontFamily: font.body, fontWeight: 600 }}>{p.label}</span>
            </div>
          ))}
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${t.borderSubtle}`, fontSize: 15, color: t.accent }}>
            $ maude hub serve
          </div>
          <div style={{ fontSize: 13, color: t.fg3, marginTop: 6 }}>peer-to-peer · self-hosted · no SaaS</div>
        </div>

        {/* live cursors */}
        {PEERS.map((p, i) => {
          const op = lerp(frame, [4 + i * 6, 18 + i * 6], [0, 1]);
          const a = (frame + p.ph * 30) / p.speed;
          return <Pointer key={p.label} x={p.cx + Math.cos(a) * p.rx} y={p.cy + Math.sin(a * 1.3) * p.ry} color={p.color} label={p.label} opacity={op} />;
        })}

        {/* dramatic title */}
        <Phrase frame={frame} from={130} text="It's multiplayer." align="center" size={64} accent bottom={96} />
      </Void>
    </AbsoluteFill>
  );
};
