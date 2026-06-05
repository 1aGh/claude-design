/**
 * Mascot.tsx — studyfi-v3 mascot (fire mood), React Native. Performance-tuned port.
 *
 * Goal: replicate the web SMIL+CSS fire choreography on native. The 3-layer flame
 * morph is the heavy part: react-native-svg re-parses a Path's `d` on every change,
 * and re-renders the WHOLE <Svg> when any child updates. So:
 *   • the morphing flame lives in its OWN <Svg> (its per-frame `d` churn never dirties
 *     the static body/face),
 *   • NO SVG <Filter> anywhere (gaussian-blur filters re-run an offscreen pass every
 *     frame alongside the flame → the cause of the whole-app jank). Body depth filters
 *     are dropped on RN (see DDR-094 limitations).
 *   • stars are static; only the flame, eyelids, aura and the View transform animate.
 *
 * Layering (matches web: aura + stars don't ride the jump):
 *   layer1 aura · layer2 (JUMPS) = flame <Svg> behind + body/face <Svg> · layer3 stars
 * Motion (one 3.6s master seq, per-segment ease-in-out):
 *   body crouch→jump→land (View transform) · fire-shoot envelope (flame invisible→
 *   erupt→burn→extinguish, baked into the morph worklet) · flicker (3 layers) ·
 *   eyes clench→pop→blink (lid `y`) · aura swell (`r`+`opacity`).
 *
 * KNOWN RN limits (DDR-094): feTurbulence/feDisplacementMap have no native impl
 * (body "shine" texture → pre-bake as raster); SVG <Filter> too costly to animate.
 */
import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Svg, G, Path, Defs, LinearGradient, RadialGradient, Stop, Circle, Rect, Ellipse, Polygon, ClipPath } from 'react-native-svg';
import Animated, {
  useSharedValue, useAnimatedProps, useAnimatedStyle, withRepeat, withTiming,
  Easing, cancelAnimation, useReducedMotion, type SharedValue,
} from 'react-native-reanimated';
import { FIRE_LAYERS, FIRE_GRADIENTS, FIRE_OUTER, type Tmpl } from './mascotFireData';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/* palette (oklch→hex): accent #7850da · accent-2 citron #e2c812 */
const C = {
  pink: '#f894c4', blue: '#221dff', violet: '#8732fe',
  ink: '#1a1622', ink2: '#2a2440', sclera: '#fffefb', iris: '#7850da', aura: '#e2c812',
};
const VB = '0 -44 120 176';
const BODY_TF = 'translate(12.86 4.97) scale(0.09174)';
const FACET = {
  pink: 'M529.24 64.0978C517.757 44.0348 488.853 43.9504 477.253 63.9458L26.1371 841.565C14.5346 861.565 28.9649 886.619 52.0867 886.619L317.561 886.618L503.386 437.572L603.61 194.038L529.24 64.0978Z',
  blue: 'M503.387 437.572L689.184 886.617L948.264 886.619C971.308 886.619 985.748 861.716 974.301 841.717L603.61 194.038L503.387 437.572Z',
  violet: 'M317.562 886.618L475.714 1263.08C486.01 1287.58 520.735 1287.58 531.031 1263.08L689.184 886.618L503.386 437.572L317.562 886.618Z',
};
const EYE = { l: 41.54, r: 76.54, cy: 54.11, R: 13.6 };
const BASE_LOCAL = Math.max(...FIRE_LAYERS.flatMap((L) => L.frames.flatMap((f) => f.filter((_, i) => i % 2 === 1))));

/* ── worklet helpers ────────────────────────────────────────────────────── */
function smooth(t: number): number { 'worklet'; return t * t * (3 - 2 * t); }
function ie(v: number, T: number[], V: number[]): number {
  'worklet';
  if (v <= T[0]) return V[0];
  for (let i = 0; i < T.length - 1; i++) {
    if (v <= T[i + 1]) { const lt = (v - T[i]) / (T[i + 1] - T[i]); return V[i] + (V[i + 1] - V[i]) * smooth(lt); }
  }
  return V[V.length - 1];
}
/* one flame layer: flicker (phase) + fire-shoot envelope (scale vertex-Y about base), one string build */
function morphD(L: typeof FIRE_LAYERS[number], phase: number, sy: number): string {
  'worklet';
  const x = phase * 3, seg = Math.min(2, Math.floor(x)), e = smooth(x - seg);
  const a = L.frames[seg], b = L.frames[seg + 1], tpl = L.template;
  let s = '', k = 0;
  for (let i = 0; i < tpl.length; i++) {
    s += tpl[i][0];
    const n = tpl[i][1];
    for (let j = 0; j < n; j++) {
      const lerp = a[k] + (b[k] - a[k]) * e;
      const val = k % 2 === 1 ? BASE_LOCAL + (lerp - BASE_LOCAL) * sy : lerp;
      s += ' ' + val.toFixed(1);
      k++;
    }
  }
  return s;
}

/* choreography keyframes (_layout.css .mascot--fire, 3.6s) */
const BODY_T = [0, 0.10, 0.22, 0.26, 0.30, 0.38, 0.48, 0.62, 0.74, 1];
const BODY_TY = [0, 3, 3, 2, 2, 2, -17, 0, 0, 0];
const BODY_SX = [1, 1.06, 1.06, 1.05, 1.05, 1.06, 0.93, 1.09, 0.99, 1];
const BODY_SY = [1, 0.9, 0.9, 0.92, 0.92, 0.9, 1.1, 0.93, 1.02, 1];
const LID_T = [0, 0.06, 0.12, 0.42, 0.47, 0.88, 0.92, 1];
const LID_UP = [0, 0, 16, 16, 0, 0, 16, 0];
const LID_LO = [0, 0, -11, -11, 0, 0, -11, 0];
const SHOOT_T = [0, 0.42, 0.50, 0.58, 0.76, 1];
const SHOOT_SY = [0.02, 0.02, 1.12, 1, 1, 0.05];
const SHOOT_OP = [0, 0, 1, 1, 1, 0];
const AURA_T = [0, 0.10, 0.40, 0.48, 0.60, 1];
const AURA_OP = [0.35, 0.35, 0.70, 0.96, 0.60, 0.35];
const AURA_SC = [0.9, 0.9, 1.04, 1.24, 1.06, 0.9];
const AURA_RB = 52;

export interface MascotProps { size?: number; staticFrame?: boolean }

export function Mascot({ size = 180, staticFrame }: MascotProps) {
  const reduced = useReducedMotion() || !!staticFrame;
  const u = size / 120;
  const W = size, H = size * (176 / 120);

  const seq = useSharedValue(0);
  const ph0 = useSharedValue(0);
  const ph1 = useSharedValue(0);
  const ph2 = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    seq.value = withRepeat(withTiming(1, { duration: 3600, easing: Easing.linear }), -1, false);
    ph0.value = withRepeat(withTiming(1, { duration: FIRE_LAYERS[0].durMs, easing: Easing.linear }), -1, false);
    ph1.value = withRepeat(withTiming(1, { duration: FIRE_LAYERS[1].durMs, easing: Easing.linear }), -1, false);
    ph2.value = withRepeat(withTiming(1, { duration: FIRE_LAYERS[2].durMs, easing: Easing.linear }), -1, false);
    return () => { [seq, ph0, ph1, ph2].forEach(cancelAnimation); };
  }, [reduced]);

  const bodyStyle = useAnimatedStyle(() => {
    if (reduced) return {};
    const s = seq.value;
    return { transform: [{ translateY: ie(s, BODY_T, BODY_TY) * u }, { scaleX: ie(s, BODY_T, BODY_SX) }, { scaleY: ie(s, BODY_T, BODY_SY) }] };
  });

  const fp0 = useAnimatedProps(() => ({ d: reduced ? buildStatic(0) : morphD(FIRE_LAYERS[0], ph0.value, ie(seq.value, SHOOT_T, SHOOT_SY)) }));
  const fp1 = useAnimatedProps(() => ({ d: reduced ? buildStatic(1) : morphD(FIRE_LAYERS[1], ph1.value, ie(seq.value, SHOOT_T, SHOOT_SY)) }));
  const fp2 = useAnimatedProps(() => ({ d: reduced ? buildStatic(2) : morphD(FIRE_LAYERS[2], ph2.value, ie(seq.value, SHOOT_T, SHOOT_SY)) }));
  const flameOp = useAnimatedProps(() => ({ opacity: reduced ? 0.95 : ie(seq.value, SHOOT_T, SHOOT_OP) }));
  const auraProps = useAnimatedProps(() => ({
    opacity: reduced ? 0.4 : ie(seq.value, AURA_T, AURA_OP),
    r: reduced ? AURA_RB : AURA_RB * ie(seq.value, AURA_T, AURA_SC),
  }));

  return (
    <View style={{ width: W, height: H }}>
      {/* layer 1 — aura */}
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" viewBox={VB} pointerEvents="none">
        <Defs>
          <RadialGradient id="aura" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={C.aura} stopOpacity={0.85} />
            <Stop offset="0.55" stopColor={C.aura} stopOpacity={0.3} />
            <Stop offset="1" stopColor={C.aura} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <AnimatedCircle cx={60} cy={42} fill="url(#aura)" animatedProps={auraProps} />
      </Svg>

      {/* layer 2 — jumps. TWO svgs: morphing flame isolated from the static body. */}
      <Animated.View style={[StyleSheet.absoluteFill, bodyStyle]}>
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" viewBox={VB} pointerEvents="none">
          <Defs>
            {FIRE_GRADIENTS.map((g) => (
              <LinearGradient key={g.id} id={g.id} x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2}>
                {g.stops.map((s, i) => <Stop key={i} offset={s.offset} stopColor={s.color} stopOpacity={Number(s.opacity)} />)}
              </LinearGradient>
            ))}
          </Defs>
          <AnimatedG transform={FIRE_OUTER} animatedProps={flameOp}>
            <AnimatedPath fill={`url(#${FIRE_LAYERS[0].gradId})`} animatedProps={fp0} />
            <AnimatedPath fill={`url(#${FIRE_LAYERS[1].gradId})`} animatedProps={fp1} />
            <AnimatedPath fill={`url(#${FIRE_LAYERS[2].gradId})`} animatedProps={fp2} />
          </AnimatedG>
        </Svg>

        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" viewBox={VB} pointerEvents="none">
          <Defs>
            <ClipPath id="eyeL"><Circle cx={EYE.l} cy={EYE.cy} r={EYE.R} /></ClipPath>
            <ClipPath id="eyeR"><Circle cx={EYE.r} cy={EYE.cy} r={EYE.R} /></ClipPath>
            <ClipPath id="mouth"><Path d="M49.54 73.91 A22 22 0 0 1 68.54 73.91 A9.5 9 0 0 1 49.54 73.91 Z" /></ClipPath>
          </Defs>
          <G transform={BODY_TF}>
            <Path d={FACET.pink} fill={C.pink} />
            <Path d={FACET.blue} fill={C.blue} />
            <Path d={FACET.violet} fill={C.violet} />
          </G>
          <Rect x={54.04} y={52.31} width={10} height={3.6} rx={1.8} fill={C.ink} />
          <Rect x={20.74} y={52.51} width={6.5} height={3.2} rx={1.6} fill={C.ink} />
          <Rect x={90.84} y={52.51} width={6.5} height={3.2} rx={1.6} fill={C.ink} />
          <Circle cx={EYE.l} cy={EYE.cy} r={15.8} fill="none" stroke={C.ink} strokeWidth={3.6} />
          <Circle cx={EYE.r} cy={EYE.cy} r={15.8} fill="none" stroke={C.ink} strokeWidth={3.6} />
          <FireEye cx={EYE.l} clip="eyeL" gaze={1.3} seq={seq} reduced={reduced} />
          <FireEye cx={EYE.r} clip="eyeR" gaze={-1.3} seq={seq} reduced={reduced} />
          <Path d="M49.54 73.91 A22 22 0 0 1 68.54 73.91 A9.5 9 0 0 1 49.54 73.91 Z" fill={C.ink} />
          <Ellipse cx={59.04} cy={80.91} rx={5.4} ry={3.6} fill={C.pink} clipPath="url(#mouth)" />
        </Svg>
      </Animated.View>

      {/* layer 3 — static stars */}
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" viewBox={VB} pointerEvents="none">
        {STAR_POINTS.map((s, i) => <Polygon key={i} points={s.points} fill={s.fill} opacity={0.8} />)}
      </Svg>
    </View>
  );
}

function buildStatic(i: number): string {
  'worklet';
  const L = FIRE_LAYERS[i], tpl = L.template, f = L.frames[0];
  let s = '', k = 0;
  for (let a = 0; a < tpl.length; a++) { s += tpl[a][0]; for (let j = 0; j < tpl[a][1]; j++) s += ' ' + f[k++].toFixed(1); }
  return s;
}

function FireEye({ cx, clip, gaze, seq, reduced }: { cx: number; clip: string; gaze: number; seq: SharedValue<number>; reduced: boolean }) {
  const cy = EYE.cy, px = cx + gaze, py = cy + 1;
  const upRest = cy - EYE.R + 1 - 50;
  const loRest = cy + EYE.R - 1;
  const upProps = useAnimatedProps(() => ({ y: reduced ? upRest : upRest + ie(seq.value, LID_T, LID_UP) }));
  const loProps = useAnimatedProps(() => ({ y: reduced ? loRest : loRest + ie(seq.value, LID_T, LID_LO) }));
  return (
    <G>
      <Circle cx={cx} cy={cy} r={EYE.R} fill={C.sclera} />
      <G clipPath={`url(#${clip})`}>
        <Circle cx={px} cy={py} r={6.9} fill={C.iris} />
        <Circle cx={px} cy={py} r={5.6} fill={C.ink} />
        <Circle cx={px + 2.6} cy={py - 3} r={2.4} fill={C.sclera} />
        <Circle cx={px - 2.6} cy={py + 3} r={1.05} fill={C.sclera} fillOpacity={0.7} />
        <AnimatedRect x={cx - 21} width={42} height={50} fill={C.ink2} animatedProps={upProps} />
        <AnimatedRect x={cx - 21} width={42} height={50} fill={C.ink2} animatedProps={loProps} />
      </G>
    </G>
  );
}

const STAR_POINTS = [
  { points: '60.47,-37.37 60.82,-34.61 63.37,-33.53 60.61,-33.18 59.53,-30.63 59.19,-33.39 56.63,-34.47 59.39,-34.81', fill: '#fff0c2' },
  { points: '21.46,-0.54 22.43,1.35 24.54,1.46 22.65,2.42 22.54,4.54 21.58,2.65 19.46,2.54 21.35,1.58', fill: '#ffc23d' },
  { points: '98.7,3.19 98.75,5.55 100.81,6.7 98.45,6.75 97.3,8.81 97.25,6.45 95.19,5.3 97.55,5.25', fill: '#fff0c2' },
  { points: '12.21,38.01 12.47,39.62 13.99,40.21 12.38,40.47 11.79,41.99 11.53,40.38 10.01,39.79 11.62,39.53', fill: '#ffc23d' },
  { points: '107.68,41.72 108.42,43.45 110.28,43.68 108.55,44.42 108.32,46.28 107.59,44.55 105.72,44.32 107.45,43.59', fill: '#ffc23d' },
  { points: '30.3,108.33 30.42,109.71 31.67,110.3 30.29,110.42 29.71,111.67 29.58,110.29 28.33,109.71 29.71,109.58', fill: '#ffc23d' },
  { points: '91.8,110.11 92.36,111.56 93.89,111.8 92.44,112.36 92.2,113.89 91.64,112.44 90.11,112.2 91.56,111.64', fill: '#ffc23d' },
];

export default Mascot;
