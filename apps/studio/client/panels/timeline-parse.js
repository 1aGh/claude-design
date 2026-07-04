// timeline-parse.js — DDR-148. Parse a video-comp's sequence + keyframe
// structure from its raw .tsx source, so the Timeline panel can draw one row
// per sequence (positioned by frame) with the animation (interpolate) windows
// marked on it. Pure + dependency-free → unit-tested without a DOM.
//
// This is a pragmatic regex parser tuned to the shapes the video-comp skill
// teaches (literal or const `durationInFrames`/`from`, <TransitionSeries> with
// its overlap math, components referenced by name). It degrades gracefully:
// an unparseable comp yields `{ sequences: [] }` and the panel shows a scrub-
// only track. It is NOT a general TSX parser.

/**
 * Collect top-level numeric consts so `durationInFrames={A}` resolves. Two
 * passes: literal ints first, then expression consts built from them
 * (`const TOTAL = A + B - XF;`) so a derived total resolves too.
 */
function collectConsts(source) {
  const consts = {};
  for (const m of source.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*(-?\d+)\s*;/g)) {
    consts[m[1]] = Number(m[2]);
  }
  for (let pass = 0; pass < 3; pass += 1) {
    for (const m of source.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*([^;]+);/g)) {
      const name = m[1];
      if (Object.hasOwn(consts, name)) continue;
      const v = resolveNum(m[2], consts);
      if (v != null) consts[name] = v;
    }
  }
  return consts;
}

/** Resolve a `{...}` expression to an integer: a literal, a const, or simple arithmetic of them. */
function resolveNum(raw, consts) {
  if (raw == null) return null;
  const t = String(raw).trim();
  if (/^-?\d+$/.test(t)) return Number(t);
  if (Object.hasOwn(consts, t)) return consts[t];
  const expr = t.replace(/[A-Za-z_$][\w$]*/g, (id) => (Object.hasOwn(consts, id) ? String(consts[id]) : id));
  if (/^[-+*/()\d\s.]+$/.test(expr) && /\d/.test(expr)) {
    try {
      // eslint-disable-next-line no-new-func
      const v = Function(`"use strict";return (${expr});`)();
      if (Number.isFinite(v)) return Math.round(v);
    } catch {
      /* not arithmetic */
    }
  }
  return null;
}

/** Animation (interpolate-of-frame) windows inside a named component's body. */
function keyframesForComponent(source, compName, consts, seqFrom) {
  if (!compName) return [];
  const def = source.search(new RegExp(`\\b(?:const|function)\\s+${compName}\\b`));
  if (def < 0) return [];
  // Heuristic body window — components in a comp are small; the next top-level
  // `const X =`/`function X` bounds it well enough for the marker overview.
  const rest = source.slice(def + compName.length);
  const nextDef = rest.search(/\n(?:const|function)\s+[A-Z]/);
  const body = rest.slice(0, nextDef > 0 ? nextDef : 2400);
  const kf = [];
  for (const m of body.matchAll(/interpolate\(\s*frame\s*,\s*\[\s*([^,\]]+?)\s*,\s*([^,\]]+?)\s*[,\]]/g)) {
    const a = resolveNum(m[1], consts);
    const b = resolveNum(m[2], consts);
    if (a != null && b != null && b >= a) kf.push({ from: seqFrom + a, to: seqFrom + b });
  }
  return kf;
}

/**
 * Parse the comp's timeline. `totalFrames` (from the comp meta) is the
 * authoritative total; the parser only positions the sequences within it.
 * Returns `{ total, sequences: [{ label, from, duration, keyframes[] }] }`.
 */
/** The source slice of a named component's definition body (heuristic bounds). */
function componentBody(src, name) {
  if (!name) return null;
  const def = src.search(new RegExp(`\\b(?:const|function)\\s+${name}\\b`));
  if (def < 0) return null;
  const rest = src.slice(def + name.length + 1);
  const next = rest.search(/\n(?:const|function|export)\s+[A-Za-z]/);
  return rest.slice(0, next > 0 ? next : rest.length);
}

/** The `<VideoComp component={X} durationInFrames={D} fps={F}>` usages in a canvas. */
function videoCompUsages(src, consts) {
  const out = [];
  for (const m of src.matchAll(/<VideoComp\b([^>]*?)\/?>/g)) {
    const a = m[1];
    const comp = a.match(/component=\{([A-Za-z_$][\w$]*)\}/);
    if (!comp) continue;
    out.push({
      compName: comp[1],
      duration: resolveNum(a.match(/durationInFrames=\{([^}]+)\}/)?.[1], consts),
      fps: resolveNum(a.match(/fps=\{([^}]+)\}/)?.[1], consts) || 30,
    });
  }
  return out;
}

export function parseCompTimeline(source, totalFrames) {
  const src = String(source ?? '');
  const consts = collectConsts(src);

  // A canvas can hold SEVERAL video-comps (one per artboard). Scope the parse to
  // ONE composition's body so a 2-comp canvas doesn't merge every sequence into
  // one track. Prefer the comp whose duration the caller asked for, then a comp
  // with real media (Video/Audio), then the first — and read fps/total from it.
  let scope = src;
  let scopedTotal = totalFrames;
  let scopedFps = 0;
  const usages = videoCompUsages(src, consts)
    .map((u) => ({ ...u, body: componentBody(src, u.compName) }))
    .filter((u) => u.body);
  if (usages.length) {
    // Prefer a comp with real media (Video/Audio) — that's the one worth a
    // timeline; then a duration match to the requested comp; then the first.
    const target =
      usages.find((u) => /<(?:Audio|OffthreadVideo|Video)\b/.test(u.body)) ||
      usages.find((u) => u.duration != null && u.duration === totalFrames) ||
      usages[0];
    scope = target.body;
    if (target.duration != null) scopedTotal = target.duration;
    scopedFps = target.fps;
  }

  const items = [];
  const tagRe =
    /<(TransitionSeries\.Sequence|TransitionSeries\.Transition|Series\.Sequence|Sequence)\b([^>]*)>/g;
  let m;
  while ((m = tagRe.exec(scope))) {
    const kind = m[1];
    const attrs = m[2];
    const openEnd = tagRe.lastIndex;
    if (/Transition$/.test(kind)) {
      const d = attrs.match(/durationInFrames:\s*([^,}\s)]+)/);
      items.push({ type: 'transition', dur: resolveNum(d?.[1], consts) ?? 0 });
    } else {
      const dm = attrs.match(/durationInFrames=\{([^}]+)\}/);
      const fm = attrs.match(/from=\{([^}]+)\}/);
      const after = scope.slice(openEnd, openEnd + 240);
      const lm = after.match(/<([A-Z][A-Za-z0-9]*)\b/);
      items.push({
        type: 'seq',
        dur: resolveNum(dm?.[1], consts),
        from: fm ? resolveNum(fm[1], consts) : null,
        compName: lm ? lm[1] : null,
      });
    }
  }

  let cursor = 0;
  const sequences = [];
  for (const it of items) {
    if (it.type === 'transition') {
      cursor -= it.dur || 0;
      continue;
    }
    const from = it.from != null ? it.from : cursor;
    const duration = it.dur != null ? it.dur : 30;
    sequences.push({
      label: it.compName ?? `Seq ${sequences.length + 1}`,
      from: Math.max(0, from),
      duration: Math.max(1, duration),
      keyframes: keyframesForComponent(src, it.compName, consts, Math.max(0, from)),
    });
    cursor = from + duration;
  }

  const derived = sequences.length
    ? Math.max(...sequences.map((s) => s.from + s.duration))
    : 30;
  const total = Number.isFinite(scopedTotal) && scopedTotal > 0 ? scopedTotal : derived;

  // Audio/music beds — their OWN rows (a `<Audio>` isn't a Sequence, so it never
  // shows up above). Spans the whole comp unless it carries from/durationInFrames.
  const audio = [];
  for (const m of scope.matchAll(/<Audio\b([^>]*)>/g)) {
    const attrs = m[1];
    const srcM = attrs.match(/src=["']([^"']+)["']/);
    const fromM = attrs.match(/from=\{([^}]+)\}/);
    const durM = attrs.match(/durationInFrames=\{([^}]+)\}/);
    const from = fromM ? (resolveNum(fromM[1], consts) ?? 0) : 0;
    const dur = durM ? resolveNum(durM[1], consts) : null;
    const name = srcM ? String(srcM[1]).split(/[\\/]/).pop() : 'audio';
    audio.push({
      kind: 'audio',
      label: name,
      from: Math.max(0, from),
      duration: dur != null ? Math.max(1, dur) : Math.max(1, total - from),
    });
  }

  return { total, fps: scopedFps || undefined, sequences, audio };
}
