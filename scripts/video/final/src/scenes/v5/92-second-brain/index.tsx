import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import {
  CARD_SHADOW,
  font,
  lerp,
  MaudeMark,
  maude,
  Phrase,
  pop,
  Void,
} from '../../../lib/v5-stage';

/**
 * Beat 92 · Second brain · it remembers (180f / 6s).
 *
 * An infographic: a dominant ".ai/" core node (glowing) wired to three branches
 * with live, flowing connectors — plans (PRD checklist), decisions (a DDR card:
 * what · why · revisit), continuity (pause today → resume tomorrow). Grounded:
 * /flow:plan + .ai/decisions + /flow:pause/resume.
 * VO: "it remembers everything. Every plan, every decision, the reason behind it.
 * Close the laptop — tomorrow it picks up mid-thought."
 *
 * (design-critic pass: bigger live focal node + glow, balanced branches,
 * consistent card headers, animated connectors.)
 */
const t = maude.dark;
const NODE = { x: 910, y: 520 };

const Card: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  p: number;
  kicker: string;
  title: string;
  children: React.ReactNode;
}> = ({ x, y, w, h, p, kicker, title, children }) => (
  <div
    style={{
      position: 'absolute',
      left: x,
      top: y,
      width: w,
      height: h,
      background: t.bg1,
      border: `1px solid ${t.border}`,
      borderRadius: 16,
      boxShadow: CARD_SHADOW,
      padding: 24,
      opacity: Math.min(1, p),
      transform: `translateY(${interpolate(p, [0, 1], [22, 0])}px) scale(${interpolate(p, [0, 1], [0.94, 1])})`,
      fontFamily: font.body,
    }}
  >
    <div
      style={{
        fontFamily: font.mono,
        fontSize: 13,
        letterSpacing: '0.1em',
        color: t.accent,
        marginBottom: 8,
      }}
    >
      {kicker}
    </div>
    <div
      style={{
        fontFamily: font.display,
        fontWeight: 700,
        fontSize: 26,
        color: t.fg0,
        marginBottom: 14,
      }}
    >
      {title}
    </div>
    {children}
  </div>
);

export const V5SecondBrain = () => {
  const frame = useCurrentFrame();
  const core = pop(frame, 4, 22);
  const c1 = pop(frame, 36, 20);
  const c2 = pop(frame, 64, 20);
  const c3 = pop(frame, 92, 20);
  const wireP = [
    lerp(frame, [28, 56], [0, 1]),
    lerp(frame, [56, 84], [0, 1]),
    lerp(frame, [84, 112], [0, 1]),
  ];
  const dashFlow = -(frame * 0.9) % 24; // marching ants toward the cards

  const connectors = [
    { d: `M 855 478 C 720 420, 580 320, 500 268`, p: wireP[0] },
    { d: `M 975 512 C 1140 470, 1290 400, 1360 380`, p: wireP[1] },
    { d: `M 910 600 C 910 690, 910 740, 910 772`, p: wireP[2] },
  ];

  return (
    <AbsoluteFill>
      <Void theme="dark">
        {/* connectors — emanate from the node, flowing dashes */}
        <svg
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
          }}
        >
          {connectors.map((w, i) => (
            <g key={i}>
              {/* base reveal stroke */}
              <path
                d={w.d}
                fill="none"
                stroke={t.accentMuted}
                strokeWidth={2.5}
                strokeDasharray={620}
                strokeDashoffset={620 - w.p * 620}
                strokeLinecap="round"
                opacity={0.55}
              />
              {/* live flowing dashes once drawn */}
              {w.p > 0.98 ? (
                <path
                  d={w.d}
                  fill="none"
                  stroke={t.accent}
                  strokeWidth={2.5}
                  strokeDasharray="3 21"
                  strokeDashoffset={dashFlow}
                  strokeLinecap="round"
                  opacity={0.9}
                />
              ) : null}
            </g>
          ))}
        </svg>

        {/* core .ai node — dominant + glowing */}
        <div
          style={{
            position: 'absolute',
            left: NODE.x - 70,
            top: NODE.y - 70,
            opacity: Math.min(1, core),
            transform: `scale(${interpolate(core, [0, 1], [0.6, 1])})`,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <div style={{ borderRadius: 36, boxShadow: `0 0 70px 10px ${maude.dark.accent}55` }}>
              <MaudeMark size={140} />
            </div>
            <div
              style={{
                fontFamily: font.mono,
                fontSize: 22,
                color: t.fg0,
                background: t.bg1,
                border: `1px solid ${t.accentMuted}`,
                borderRadius: 10,
                padding: '8px 18px',
              }}
            >
              .ai/ second brain
            </div>
          </div>
        </div>

        {/* branch 1 — plans */}
        <Card x={120} y={150} w={400} h={232} p={c1} kicker="PLAN · PRD-GROUNDED" title="Plans">
          {['Discovery + scope', 'Tasks, in order', 'Acceptance criteria'].map((s, i) => (
            <div
              key={s}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                marginBottom: 12,
                fontSize: 21,
                color: t.fg0,
              }}
            >
              <span
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  background: i < 2 ? t.success : t.bg3,
                  color: t.bg0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 15,
                }}
              >
                {i < 2 ? '✓' : ''}
              </span>
              {s}
            </div>
          ))}
        </Card>

        {/* branch 2 — decisions */}
        <Card
          x={1360}
          y={250}
          w={420}
          h={250}
          p={c2}
          kicker="DECISION · DDR-070"
          title="Geometry engine for SVG"
        >
          <div style={{ fontSize: 19, color: t.fg1, lineHeight: 1.5 }}>
            <span style={{ color: t.accent }}>what</span> · draw as code
            <br />
            <span style={{ color: t.accent }}>why</span> · no hallucinated paths
            <br />
            <span style={{ color: t.accent }}>revisit</span> · when SVGO changes
          </div>
        </Card>

        {/* branch 3 — continuity */}
        <Card
          x={630}
          y={772}
          w={560}
          h={176}
          p={c3}
          kicker="CONTINUITY · PAUSE → RESUME"
          title="Continuity"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
            <span style={{ fontSize: 20, color: t.fg0 }}>today</span>
            <span
              style={{
                flex: 1,
                height: 3,
                background: `linear-gradient(90deg, ${t.fg3}, ${t.accent})`,
                borderRadius: 2,
                position: 'relative',
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: -7,
                  width: 16,
                  height: 16,
                  borderRadius: 99,
                  background: t.bg0,
                  border: `2px dashed ${t.fg3}`,
                }}
              />
            </span>
            <span style={{ fontSize: 20, color: t.accent, fontWeight: 600 }}>tomorrow</span>
          </div>
          <div style={{ fontFamily: font.body, fontSize: 18, color: t.fg1 }}>
            Close the laptop. It picks up mid-thought.
          </div>
        </Card>

        <Phrase
          frame={frame}
          from={108}
          text="it remembers everything"
          align="center"
          size={34}
          bottom={44}
        />
      </Void>
    </AbsoluteFill>
  );
};
