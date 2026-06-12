/**
 * Sparky — the maude mascot. A cute helmet robot with an LED visor face,
 * inspired by the K-VRC "expression display" robots (Love, Death & Robots) but
 * original and rendered in the maude scheme (indigo helmet, dark visor, glowing
 * indigo LED face). The visor cycles real expressions — happy / grin / wink /
 * surprise / love — with blinks, head tilt and antenna sway, so it feels alive.
 *
 * One API, three modes:
 *   <Sparky size drawP={p} />      — draws itself on (outlines → fills → power-on)
 *   <Sparky size liveFrame={f} />  — alive: expressions cycle + tilt + sway
 *   <Sparky size />                — static, neutral-happy
 *
 * viewBox 0 0 80 80. Single accent hue family; works down to ~24px.
 */
import { maude } from './maude-tokens';

const A = maude.dark.accent;
const AM = maude.dark.accentMuted;
const AH = maude.dark.accentHover;
const STRIPE = maude.dark.fg0;
const VISOR = 'oklch(0.135 0.012 260)';
const FACE = 'oklch(0.86 0.13 268)';

const clamp = (v: number) => Math.max(0, Math.min(1, v));
const heart = (cx: number, cy: number, s: number) =>
  `M${cx} ${cy + 0.75 * s} C${cx - 1.1 * s} ${cy - 0.15 * s} ${cx - 0.6 * s} ${cy - 0.9 * s} ${cx} ${cy - 0.3 * s} C${cx + 0.6 * s} ${cy - 0.9 * s} ${cx + 1.1 * s} ${cy - 0.15 * s} ${cx} ${cy + 0.75 * s}Z`;

type Expr = 'happy' | 'grin' | 'wink' | 'surprise' | 'love';
const ORDER: Expr[] = ['happy', 'grin', 'wink', 'surprise', 'love'];

const EYE_Y = 38;
const MOUTH_Y = 46;
const LX = 33;
const RX = 47;

// ── LED face pieces ──
const Dot = ({ cx, open }: { cx: number; open: number }) => (
  <rect x={cx - 2.4} y={EYE_Y - 3 * open} width={4.8} height={6 * open} rx={1.8} fill={FACE} />
);
const Line = ({ cx }: { cx: number }) => (
  <rect x={cx - 3} y={EYE_Y - 0.9} width={6} height={1.8} rx={0.9} fill={FACE} />
);
const Arc = ({ cx }: { cx: number }) => (
  <path
    d={`M${cx - 3} ${EYE_Y + 1}Q${cx} ${EYE_Y - 3.4} ${cx + 3} ${EYE_Y + 1}`}
    stroke={FACE}
    strokeWidth={2}
    fill="none"
    strokeLinecap="round"
  />
);
const Ring = ({ cx }: { cx: number }) => (
  <circle cx={cx} cy={EYE_Y} r={2.8} fill="none" stroke={FACE} strokeWidth={1.8} />
);
const Heart = ({ cx }: { cx: number }) => <path d={heart(cx, EYE_Y, 3)} fill={FACE} />;

const Smile = () => (
  <path
    d={`M34 ${MOUTH_Y - 2}Q40 ${MOUTH_Y + 3} 46 ${MOUTH_Y - 2}`}
    stroke={FACE}
    strokeWidth={2.4}
    fill="none"
    strokeLinecap="round"
  />
);
const SmallSmile = () => (
  <path
    d={`M36 ${MOUTH_Y - 1}Q40 ${MOUTH_Y + 2.5} 44 ${MOUTH_Y - 1}`}
    stroke={FACE}
    strokeWidth={2.2}
    fill="none"
    strokeLinecap="round"
  />
);
const Grin = () => (
  <path d={`M33 ${MOUTH_Y - 3}Q40 ${MOUTH_Y + 5} 47 ${MOUTH_Y - 3}Z`} fill={FACE} />
);
const OMouth = () => (
  <circle cx={40} cy={MOUTH_Y} r={2.6} fill="none" stroke={FACE} strokeWidth={1.8} />
);

const FaceLED = ({ expr, open }: { expr: Expr; open: number }) => {
  // a blink (open < 1) collapses dot/arc/ring eyes to lines for expressive frames too
  const blinking = open < 0.55;
  const eyes =
    blinking && expr !== 'love' ? (
      <>
        <Line cx={LX} />
        <Line cx={RX} />
      </>
    ) : expr === 'happy' ? (
      <>
        <Dot cx={LX} open={open} />
        <Dot cx={RX} open={open} />
      </>
    ) : expr === 'grin' ? (
      <>
        <Arc cx={LX} />
        <Arc cx={RX} />
      </>
    ) : expr === 'wink' ? (
      <>
        <Dot cx={LX} open={open} />
        <Line cx={RX} />
      </>
    ) : expr === 'surprise' ? (
      <>
        <Ring cx={LX} />
        <Ring cx={RX} />
      </>
    ) : (
      <>
        <Heart cx={LX} />
        <Heart cx={RX} />
      </>
    );
  const mouth =
    expr === 'grin' ? (
      <Grin />
    ) : expr === 'surprise' ? (
      <OMouth />
    ) : expr === 'love' ? (
      <SmallSmile />
    ) : (
      <Smile />
    );
  return (
    <g style={{ filter: `drop-shadow(0 0 2.5px ${FACE})` }}>
      {eyes}
      {mouth}
    </g>
  );
};

export const Sparky: React.FC<{
  size: number;
  color?: string;
  bg?: string;
  drawP?: number;
  liveFrame?: number;
  tiny?: boolean;
  /** force a single expression (else cycles when live, or neutral-happy static). */
  expr?: Expr;
}> = ({ size, drawP = 1, liveFrame, tiny = false, expr }) => {
  const live = liveFrame !== undefined;
  const f = liveFrame ?? 0;

  // draw-on phases
  const od = clamp(drawP / 0.62);
  const fillP = clamp((drawP - 0.5) / 0.4);
  const faceP = clamp((drawP - 0.85) / 0.15);
  const outlineOp = (1 - fillP) * clamp(od);
  // power-on flicker on the face
  const flick = drawP >= 1 ? 1 : faceP < 1 ? (Math.sin(faceP * 30) > -0.3 ? 1 : 0.4) * faceP : 1;

  // live anim
  const exprIdx = Math.floor((f % (ORDER.length * 38)) / 38);
  const curExpr: Expr = expr ?? (live ? ORDER[exprIdx] : 'happy');
  const blinkPhase = f % 66;
  const open =
    live && blinkPhase < 6 ? Math.max(0.12, 1 - Math.sin((blinkPhase / 6) * Math.PI)) : 1;
  const tilt = live ? Math.sin(f / 40) * 2.6 : 0;
  const sway = live ? Math.sin(f / 14) * 5 : 0;

  const ln = (w = 2.6) => ({
    fill: 'none' as const,
    stroke: A,
    strokeWidth: w,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeDasharray: 320,
    strokeDashoffset: 320 * (1 - od),
    opacity: outlineOp,
  });
  const spark = (cx: number, cy: number, R = 2.4) => {
    const r = 0.42 * R;
    return `M${cx} ${cy - R}L${cx + r} ${cy - r}L${cx + R} ${cy}L${cx + r} ${cy + r}L${cx} ${cy + R}L${cx - r} ${cy + r}L${cx - R} ${cy}L${cx - r} ${cy - r}Z`;
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      style={{ overflow: 'visible' }}
      aria-hidden="true"
    >
      <g style={{ transform: `rotate(${tilt}deg)`, transformOrigin: '40px 44px' }}>
        {/* antennae (sway) */}
        <g style={{ transform: `rotate(${sway}deg)`, transformOrigin: '40px 40px' }}>
          <path d="M9 33L4.5 21" {...ln(2.2)} opacity={od} />
          <path d="M71 33L75.5 21" {...ln(2.2)} opacity={od} />
          <path d={spark(4.5, 19, 2.6)} fill={A} opacity={fillP} />
          <path d={spark(75.5, 19, 2.6)} fill={A} opacity={fillP} />
        </g>

        {/* ear pods */}
        <rect x={3} y={33} width={11} height={17} rx={5.5} fill={AM} opacity={fillP} />
        <rect x={66} y={33} width={11} height={17} rx={5.5} fill={AM} opacity={fillP} />
        <rect x={3} y={33} width={11} height={17} rx={5.5} {...ln()} />
        <rect x={66} y={33} width={11} height={17} rx={5.5} {...ln()} />

        {/* helmet dome */}
        <rect x={14} y={12} width={52} height={48} rx={18} fill={A} opacity={fillP} />
        <rect x={14} y={12} width={52} height={48} rx={18} {...ln()} pathLength={320} />

        {/* racing stripes */}
        <rect x={35} y={14.5} width={3.2} height={9} rx={1.6} fill={STRIPE} opacity={fillP} />
        <rect x={41.5} y={14.5} width={3.2} height={9} rx={1.6} fill={STRIPE} opacity={fillP} />

        {/* visor brim */}
        <rect x={16.5} y={24} width={47} height={4.6} rx={2.3} fill={AH} opacity={fillP} />

        {/* visor screen */}
        <rect
          x={20.5}
          y={29}
          width={39}
          height={23}
          rx={9}
          fill={VISOR}
          opacity={Math.max(fillP, faceP)}
        />
        <rect
          x={20.5}
          y={29}
          width={39}
          height={23}
          rx={9}
          fill="none"
          stroke={AM}
          strokeWidth={1}
          opacity={fillP * 0.8}
        />

        {/* CRT scanlines */}
        {!tiny ? (
          <g opacity={faceP * 0.12}>
            {[33, 37, 41, 45, 49].map((y) => (
              <line key={y} x1={22} y1={y} x2={58} y2={y} stroke={FACE} strokeWidth={0.6} />
            ))}
          </g>
        ) : null}

        {/* LED face */}
        <g opacity={faceP * flick}>
          <FaceLED expr={curExpr} open={open} />
        </g>
      </g>
    </svg>
  );
};
