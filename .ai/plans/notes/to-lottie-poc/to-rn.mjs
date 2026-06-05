#!/usr/bin/env node
/**
 * _to-rn.mjs — POC generator + reference implementation for the `/design:to-rn` skill.
 *
 * Reads a DISCIPLINED maude SMIL mark (engine-authored: each <animate values="d0;d1;…">
 * keyframe shares an identical command structure / fixed vertex count) and emits a
 * native React Native component (react-native-svg + react-native-reanimated) that
 * renders the SAME animation — path morph via a worklet vertex-lerp, gradients native,
 * colors as props (theme-aware), reduced-motion gated, per-layer independent duration.
 *
 * It is an IR/SMIL EMITTER, never an SVG→Lottie parser. The vertex-lerp only works
 * because the source obeys the fixed-command-structure discipline — which the generator
 * ASSERTS (it throws if a layer's keyframes diverge), the same gate that makes the
 * animation portable to SMIL, motion, and (later) Lottie.
 *
 * Usage:  node _to-rn.mjs <source.tsx> <out.tsx>
 * DDR-094 · plan: feature-draw-animation-layer.md
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const [, , SRC, OUT] = process.argv;
if (!SRC || !OUT) { console.error('usage: node _to-rn.mjs <source.tsx> <out.tsx>'); process.exit(2); }
const src = readFileSync(SRC, 'utf8');

/* ---- 1. Tokenize an SVG path `d` into a command template + flat coord array ---- */
function tokenize(d) {
  const toks = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || [];
  const template = []; const coords = []; let group = null;
  for (const t of toks) {
    if (/[a-zA-Z]/.test(t)) { group = { cmd: t, n: 0 }; template.push(group); }
    else { coords.push(parseFloat(t)); if (group) group.n++; }
  }
  return { template: template.map((g) => [g.cmd, g.n]), coords };
}
const sameTemplate = (a, b) => a.length === b.length && a.every((g, i) => g[0] === b[i][0] && g[1] === b[i][1]);

/* ---- 2. Extract the morphing layers (path base `d`, gradient id, animate values) ---- */
const layerRe = /<path\s+className="mascot-fmorph"\s+fill="url\(#([^)]+)\)"\s+d="([^"]+)"[\s\S]*?<animate\b[^>]*\bdur="([^"]+)"[\s\S]*?\bvalues="([^"]+)"/g;
const layers = [];
for (let m; (m = layerRe.exec(src)); ) {
  const [, gradId, baseD, dur, valuesRaw] = m;
  const variants = valuesRaw.trim().split(';').map((s) => s.trim()).filter(Boolean).map(tokenize);
  // DISCIPLINE GATE: every keyframe must share the base command template.
  const base = tokenize(baseD).template;
  variants.forEach((v, i) => {
    if (!sameTemplate(base, v.template))
      throw new Error(`layer ${gradId}: keyframe ${i} diverges from the command template — morph not portable. Re-author with a fixed vertex count.`);
  });
  layers.push({
    gradId, dur, template: base,
    frames: variants.map((v) => v.coords),
    durMs: Math.round(parseFloat(dur) * 1000),
  });
}
if (!layers.length) throw new Error('no <path className="mascot-fmorph"> morph layers found');

/* ---- 3. Extract gradient defs (stops) ---- */
const gradients = [];
const gradRe = /<linearGradient id="([^"]+)"([^>]*)>([\s\S]*?)<\/linearGradient>/g;
for (let m; (m = gradRe.exec(src)); ) {
  const [, id, attrs, body] = m;
  const coord = (k) => (attrs.match(new RegExp(`${k}="([^"]+)"`)) || [, '0'])[1];
  const stops = [...body.matchAll(/<stop\s+offset="([^"]+)"\s+stopColor="([^"]+)"(?:\s+stopOpacity="([^"]+)")?\s*\/>/g)]
    .map((s) => ({ offset: s[1], color: s[2], opacity: s[3] ?? '1' }));
  gradients.push({ id, x1: coord('x1'), y1: coord('y1'), x2: coord('x2'), y2: coord('y2'), stops });
}

/* ---- 4. Outer static transform + stars ---- */
const outer = (src.match(/<g transform="(translate[^"]+)">/) || [, 'translate(0 0)'])[1];
const stars = [...src.matchAll(/<polygon points="([^"]+)" fill="([^"]+)" \/>/g)].map((s) => ({ points: s[1], fill: s[2] }));

/* ---- 5. Compute a self-contained viewBox (post-transform fire bbox ∪ stars) ---- */
const tm = outer.match(/translate\(([-\d.]+)\s+([-\d.]+)\)(?:\s*scale\(([-\d.]+)\))?/);
const [tx, ty, sc] = [parseFloat(tm[1]), parseFloat(tm[2]), parseFloat(tm[3] || '1')];
let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
const see = (x, y) => { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); };
for (const L of layers) for (const f of L.frames) for (let i = 0; i < f.length; i += 2) see(f[i] * sc + tx, f[i + 1] * sc + ty);
for (const st of stars) { const n = st.points.split(/[ ,]+/).map(Number); for (let i = 0; i < n.length; i += 2) see(n[i], n[i + 1]); }
const padX = (maxX - minX) * 0.08, padY = (maxY - minY) * 0.08;
const vb = [minX - padX, minY - padY, maxX - minX + 2 * padX, maxY - minY + 2 * padY].map((v) => +v.toFixed(2)).join(' ');
const baseY = +maxY.toFixed(2), cx = +((minX + maxX) / 2).toFixed(2);

/* ---- 6. Emit the RN component ---- */
const j = (v) => JSON.stringify(v);
const layerConst = (L, i) => `
const T${i} = ${j(L.template)} as Tmpl;
const F${i} = ${j(L.frames)} as number[][];`;
const gradJsx = (g) => `      <LinearGradient id="${g.id}" x1="${g.x1}" y1="${g.y1}" x2="${g.x2}" y2="${g.y2}">
${g.stops.map((s) => `        <Stop offset="${s.offset}" stopColor={colors?.['${g.id}']?.[${g.stops.indexOf(s)}] ?? '${s.color}'} stopOpacity={${s.opacity}} />`).join('\n')}
      </LinearGradient>`;
const layerJsx = (L, i) => `        <AnimatedPath fill="url(#${L.gradId})" animatedProps={p${i}} />`;
const starJsx = (s) => `        <Polygon points="${s.points}" fill="${s.fill}" />`;
const layerHook = (L, i) => `  const ph${i} = useSharedValue(0);
  const p${i} = useAnimatedProps(() => {
    'worklet';
    if (reduced) return { d: buildD(T${i}, F${i}[0]) };
    const x = ph${i}.value * 3, seg = Math.min(2, Math.floor(x)), e = ease(x - seg);
    return { d: buildD(T${i}, lerpArr(F${i}[seg], F${i}[seg + 1], e)) };
  });`;

const out = `/**
 * MascotFireRing.tsx — POC (auto-generated by .design/_draw/_to-rn.mjs).
 *
 * Native React Native port of the studyfi-v3 streak-fire (_mascot-fire-ring.tsx).
 * Proves DDR-094 part 3: ONE keyframe IR → a native renderer, NO Lottie, NO editor,
 * NO lossy conversion. ${layers.length} morph layers → vertex-lerp worklets; gradients native;
 * colors are PROPS (theme-aware — the win over Lottie's baked color); reduced-motion
 * gated via Reanimated; each layer its own duration (${layers.map((l) => l.dur).join(' / ')}) so they interweave.
 *
 * Path morph works because every keyframe shares an identical command structure
 * (fixed vertex count) — the same discipline SMIL needs. The worklet lerps the
 * coordinate arrays and rebuilds \`d\` from the shared template.
 *
 * Stack: react-native-svg + react-native-reanimated (validated: Expo 53 / RN 0.79 /
 * rn-svg 15.13 / reanimated 3.17). This file is the reference output of /design:to-rn.
 */
import { useEffect } from 'react';
import { Svg, G, Path, Defs, LinearGradient, Stop, Polygon } from 'react-native-svg';
import Animated, {
  useSharedValue, useAnimatedProps, withRepeat, withTiming,
  Easing, cancelAnimation, useReducedMotion,
} from 'react-native-reanimated';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedG = Animated.createAnimatedComponent(G);

type Tmpl = [string, number][];

/* smoothstep ease-in-out worklet — approximates the SMIL keySplines "0.42 0 0.58 1".
   Inlined (not Easing.bezier) because Easing.bezier returns a factory object, not a
   callable, so it can't be invoked directly inside a worklet. */
function ease(t: number): number {
  'worklet';
  return t * t * (3 - 2 * t);
}

function lerpArr(a: number[], b: number[], t: number): number[] {
  'worklet';
  const o: number[] = [];
  for (let i = 0; i < a.length; i++) o.push(a[i] + (b[i] - a[i]) * t);
  return o;
}
/* rebuild an SVG \`d\` from a shared command template + a flat coord array */
function buildD(template: Tmpl, coords: number[]): string {
  'worklet';
  let s = '', k = 0;
  for (let i = 0; i < template.length; i++) {
    s += template[i][0];
    const n = template[i][1];
    for (let j = 0; j < n; j++) s += ' ' + coords[k++].toFixed(2);
  }
  return s;
}
${layers.map(layerConst).join('\n')}

export interface MascotFireRingProps {
  size?: number;
  /** Per-gradient stop-color override → theme-aware. e.g. { ${layers[0].gradId}: ['#fff', ...] } */
  colors?: Record<string, string[]>;
  /** Force-disable motion (otherwise follows the OS reduce-motion setting). */
  staticFrame?: boolean;
}

export function MascotFireRing({ size = 160, colors, staticFrame }: MascotFireRingProps) {
  const reduced = useReducedMotion() || !!staticFrame;
${layers.map(layerHook).join('\n')}

  // Envelope (transform track): shoot up from the base on mount — demonstrates that
  // sequences/transforms compose alongside the morph (position split from animation:
  // static outer translate, animated inner scaleY).
  const rise = useSharedValue(reduced ? 1 : 0);
  const riseProps = useAnimatedProps(() => ({ scaleY: rise.value, originY: ${baseY}, originX: ${cx} }));

  useEffect(() => {
    if (reduced) { rise.value = 1; return; }
    rise.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) });
${layers.map((L, i) => `    ph${i}.value = withRepeat(withTiming(1, { duration: ${L.durMs}, easing: Easing.linear }), -1, false);`).join('\n')}
    return () => {
      cancelAnimation(rise);
${layers.map((_, i) => `      cancelAnimation(ph${i});`).join('\n')}
    };
  }, [reduced]);

  return (
    <Svg width={size} height={size} viewBox="${vb}">
      <Defs>
${gradients.map(gradJsx).join('\n')}
      </Defs>
      <AnimatedG animatedProps={riseProps}>
        <G transform="${outer}">
${layers.map(layerJsx).join('\n')}
        </G>
      </AnimatedG>
${stars.map(starJsx).join('\n')}
    </Svg>
  );
}

export default MascotFireRing;
`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, out);

/* ---- 7. Also emit a DATA module so the full Mascot can reuse the flame (single-source) ---- */
const dataPath = OUT.replace(/[^/]+$/, 'mascotFireData.ts');
const dataOut = `/** mascotFireData.ts — auto-generated by .design/_draw/_to-rn.mjs.
 * The studyfi-v3 streak-fire keyframe data (vertex arrays + shared command templates),
 * gradients, outer transform and stars — single source for MascotFireRing.tsx AND Mascot.tsx.
 * Path morph keyframes share an identical command structure (fixed vertex count). */
export type Tmpl = [string, number][];
export interface FireLayer { gradId: string; durMs: number; template: Tmpl; frames: number[][]; }
export interface FireGradient { id: string; x1: string; y1: string; x2: string; y2: string; stops: { offset: string; color: string; opacity: string }[]; }

export const FIRE_OUTER = ${j(outer)};
export const FIRE_VIEWBOX_FIT = ${j(vb)};      // self-contained (flame ∪ stars)
export const FIRE_LAYERS: FireLayer[] = ${JSON.stringify(layers.map((L) => ({ gradId: L.gradId, durMs: L.durMs, template: L.template, frames: L.frames })))};
export const FIRE_GRADIENTS: FireGradient[] = ${JSON.stringify(gradients)};
export const FIRE_STARS: { points: string; fill: string }[] = ${JSON.stringify(stars)};
`;
writeFileSync(dataPath, dataOut);

console.error(`✓ ${layers.length} morph layers (discipline OK), ${gradients.length} gradients, ${stars.length} stars`);
console.error(`✓ viewBox ${vb}  base ${baseY}`);
console.error(`✓ wrote ${OUT}`);
console.error(`✓ wrote ${dataPath} (shared data module)`);
