import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { font, maude, Phrase, pop, Void } from '../../../lib/v5-stage';

/**
 * Beat 94 · The daily loop (150f / 5s).
 *
 * Three command cards pulse in sequence — /flow:plan · /flow:execute · /flow:done
 * — joined by a live loop-back arrow ("day after day"). Grounded: flow daily verbs.
 * VO: "After that, it's a rhythm. Plan. Execute. Done."
 *
 * (design-critic pass: balanced cluster, accent reserved for the active card +
 * the live loop-back; inter-card arrows muted.)
 */
const t = maude.dark;

const STEPS = [
  { cmd: '/flow:plan', sub: 'scope it', icon: '◷' },
  { cmd: '/flow:execute', sub: 'build it', icon: '▸' },
  { cmd: '/flow:done', sub: 'ship it', icon: '✓' },
];

export const V5DailyLoop = () => {
  const frame = useCurrentFrame();
  const intro = pop(frame, 0, 22);
  const cyc = Math.max(0, frame - 28);
  const active = Math.floor(cyc / 26) % 3;
  const dashFlow = (frame * 1.4) % 24; // marching ants right → left (toward /flow:plan)

  return (
    <AbsoluteFill>
      <Void theme="dark" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 56,
            opacity: Math.min(1, intro),
            transform: `translateY(${30 + (1 - Math.min(1, intro)) * 20}px)`,
          }}
        >
          {/* card row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 40 }}>
            {STEPS.map((s, i) => {
              const on = active === i;
              const pulse = on ? 1 + Math.sin(((cyc % 26) / 26) * Math.PI) * 0.05 : 1;
              return (
                <div key={s.cmd} style={{ display: 'flex', alignItems: 'center', gap: 40 }}>
                  <div
                    style={{
                      width: 320,
                      height: 220,
                      background: on ? t.bg2 : t.bg1,
                      border: `2px solid ${on ? t.accent : t.border}`,
                      borderRadius: 20,
                      boxShadow: on
                        ? `0 0 0 6px ${t.accentTint}, 0 24px 70px rgba(0,0,0,0.4)`
                        : '0 24px 70px rgba(0,0,0,0.4)',
                      padding: 32,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      gap: 14,
                      transform: `scale(${pulse})`,
                    }}
                  >
                    <span style={{ fontSize: 44, color: on ? t.accent : t.fg2 }}>{s.icon}</span>
                    <span
                      style={{
                        fontFamily: font.mono,
                        fontSize: 30,
                        color: on ? t.accent : t.fg0,
                        fontWeight: 500,
                      }}
                    >
                      {s.cmd}
                    </span>
                    <span style={{ fontFamily: font.body, fontSize: 22, color: t.fg2 }}>
                      {s.sub}
                    </span>
                  </div>
                  {/* inter-card connectors — muted neutral (accent reserved for active + loop) */}
                  {i < STEPS.length - 1 ? (
                    <span style={{ fontSize: 40, color: t.fg3 }}>→</span>
                  ) : null}
                </div>
              );
            })}
          </div>

          {/* live loop-back arrow — full accent, marching ants toward /flow:plan */}
          <svg aria-hidden="true" width={1300} height={170} style={{ marginTop: -10 }}>
            <path
              d="M 1090 12 C 1180 116, 120 116, 180 16"
              fill="none"
              stroke={t.accent}
              strokeWidth={3}
              strokeDasharray="8 10"
              strokeDashoffset={dashFlow}
              strokeLinecap="round"
              opacity={0.9}
            />
            {/* arrowhead — triangle at the left tip, oriented along the curve's end tangent (up-right, into /flow:plan) */}
            <polygon points="180,16 181,30 169,25" fill={t.accent} />
            <text
              x={650}
              y={150}
              textAnchor="middle"
              fill={t.fg2}
              fontFamily={font.mono}
              fontSize={18}
            >
              day after day
            </text>
          </svg>
        </div>

        <Phrase
          frame={frame}
          from={20}
          text="it's a rhythm"
          align="center"
          size={34}
          bottom={110}
        />
      </Void>
    </AbsoluteFill>
  );
};
