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
  ChatBubble,
  easeOut,
  font,
  lerp,
  maude,
  Phrase,
  Void,
} from '../../../lib/v5-stage';

/**
 * Beat 10 · The questionary + moodboard (240f / 8s).
 *
 * The discovery runs as a messenger thread — sharp, designer-grade questions
 * (not generic), real answers. As each answer lands the REAL captured moodboard
 * grows another band in sync. The thread ends with the AI: "Here's your
 * moodboard." as the board completes. Grounded: /design:setup-ds + .design/ui/<ds>-moodboard.tsx.
 * VO: "It opens like a real designer would — sharp questions, real research,
 * and a moodboard that commits to a direction."
 */
const QA = [
  {
    q: 'What makes this special — the one thing only you would build?',
    a: 'Design and code in one place — directed by pointing, not prompting.',
    at: 8,
  },
  {
    q: 'Who is it for, and what should they feel?',
    a: 'Builders. Calm, fast, a little bit magic.',
    at: 64,
  },
  { q: 'One word for the personality?', a: 'Precise.', at: 116 },
];
const FINAL_AT = 162;

export const V5Questionary = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = maude.dark;

  // moodboard reveals SMOOTHLY, synced to answers (piecewise-eased, no stutter):
  // grows a little as each answer lands, then completes on "Here's your moodboard."
  const boardClip = interpolate(
    frame,
    [QA[0].at + 14, QA[1].at + 14, QA[2].at + 14, FINAL_AT + 6, FINAL_AT + 36],
    [3, 30, 58, 80, 100],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // gentle auto-scroll so the latest message stays in view
  const scroll = -easeOut(lerp(frame, [120, FINAL_AT + 20], [0, 1])) * 150;

  return (
    <AbsoluteFill>
      <Void theme="dark">
        <div style={{ position: 'absolute', inset: '60px 72px', display: 'flex', gap: 56 }}>
          {/* ── chat thread ── */}
          <div style={{ width: 760, position: 'relative', overflow: 'hidden' }}>
            <div
              style={{
                fontFamily: font.mono,
                fontSize: 16,
                letterSpacing: '0.1em',
                color: t.fg2,
                marginBottom: 18,
              }}
            >
              DISCOVERY · built on how the best designers work
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                transform: `translateY(${scroll}px)`,
              }}
            >
              {QA.map((row) => {
                const qOp = lerp(frame, [row.at, row.at + 12], [0, 1]);
                const aSpring = spring({
                  frame: frame - (row.at + 14),
                  fps,
                  config: { damping: 13, mass: 0.7 },
                  durationInFrames: 16,
                });
                return (
                  <div key={row.q} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <ChatBubble opacity={qOp} rise={interpolate(qOp, [0, 1], [14, 0])} width={600}>
                      {row.q}
                    </ChatBubble>
                    <ChatBubble
                      opacity={aSpring}
                      rise={interpolate(aSpring, [0, 1], [14, 0])}
                      width={560}
                    >
                      {row.a}
                    </ChatBubble>
                  </div>
                );
              })}
              {/* final AI message — the payoff */}
              {(() => {
                const s = spring({
                  frame: frame - FINAL_AT,
                  fps,
                  config: { damping: 12, mass: 0.7 },
                  durationInFrames: 16,
                });
                return (
                  <ChatBubble opacity={s} rise={interpolate(s, [0, 1], [14, 0])} width={420}>
                    <span style={{ fontWeight: 700, color: t.accent }}>Here's your moodboard.</span>
                  </ChatBubble>
                );
              })()}
            </div>
          </div>

          {/* ── moodboard that grows ── */}
          <div style={{ flex: 1, position: 'relative' }}>
            <div
              style={{
                fontFamily: font.mono,
                fontSize: 16,
                letterSpacing: '0.1em',
                color: t.fg2,
                marginBottom: 14,
              }}
            >
              MOODBOARD · the direction
            </div>
            <div
              style={{
                position: 'relative',
                width: '100%',
                height: 780,
                borderRadius: 18,
                overflow: 'hidden',
                border: `1px solid ${boardClip > 95 ? t.accentMuted : t.border}`,
                boxShadow: CARD_SHADOW,
                background: t.bg1,
              }}
            >
              <Img
                src={staticFile('v4/moodboard.png')}
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  objectPosition: 'top',
                  clipPath: `inset(0 0 ${100 - boardClip}% 0)`,
                }}
              />
              {/* scanning edge glow */}
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: `${boardClip}%`,
                  height: 3,
                  background: t.accent,
                  boxShadow: `0 0 28px 6px ${t.accent}`,
                  opacity: boardClip < 99 ? 1 : 0,
                  transform: 'translateY(-2px)',
                }}
              />
            </div>
          </div>
        </div>

        <Phrase
          frame={frame}
          from={168}
          text="a moodboard that commits to a direction"
          size={30}
          bottom={32}
        />
      </Void>
    </AbsoluteFill>
  );
};
