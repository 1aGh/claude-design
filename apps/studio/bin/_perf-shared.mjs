// _perf-shared.mjs — the measurement contract shared by every `maude design perf`
// engine lane (Chromium via agent-browser, WebKit via safaridriver).
//
// It lives in one file on purpose. Two lanes with two copies of the gesture
// script would drift, and the moment they drift the engines stop being
// comparable — which is the only thing this benchmark is for.

import { existsSync, readFileSync } from 'node:fs';

// ── The in-page harness ──────────────────────────────────────────────────────
//
// Synthesizes the same wheel events the viewport controller listens for
// (`canvas-lib.tsx` onWheel: plain wheel = 2D pan, ctrlKey wheel = pinch-zoom —
// a macOS trackpad pinch arrives as ctrlKey:true, so this is the real gesture
// path, not a side door).
//
// Runs async and parks its result on `window.__maudePerfResult`, which the
// caller polls: both driver protocols return one synchronous value per eval and
// cannot await.
export function harnessSource({ pan, zoom, injectCss, fitAll, setFlags }) {
  const flagBlock = (setFlags || []).map((f) => `\n  win[${JSON.stringify(f)}] = true;`).join('');
  const cssBlock = injectCss
    ? `
  {
    const st = doc.createElement('style');
    st.id = 'maude-perf-variant';
    st.textContent = ${JSON.stringify(injectCss)};
    doc.head.appendChild(st);
  }`
    : '';
  return `(() => {
  const host = document.querySelector('.dc-canvas') ||
               (document.querySelector('iframe') &&
                document.querySelector('iframe').contentDocument &&
                document.querySelector('iframe').contentDocument.querySelector('.dc-canvas'));
  if (!host) return 'NO_HOST';
  const doc = host.ownerDocument;
  const win = doc.defaultView;
  win.__maudePerfResult = null;${flagBlock}${cssBlock}

  // Render counter, installed by canvas-lib when this object exists. Absent
  // instrumentation reports null rather than zero — "not measured" and
  // "measured zero" must never look alike in a baseline.
  win.__dcPerf = { artboardRenders: 0, annotationRenders: 0 };

  const frames = [];
  let longtasks = 0;
  let po = null;
  try {
    po = new win.PerformanceObserver((list) => { longtasks += list.getEntries().length; });
    po.observe({ entryTypes: ['longtask'] });
  } catch { /* longtask unsupported (WebKit) — count stays 0, frames still tell the story */ }

  let last = 0;
  let running = true;
  const tick = (t) => {
    if (last) frames.push(t - last);
    last = t;
    if (running) win.requestAnimationFrame(tick);
  };
  win.requestAnimationFrame(tick);

  const rect = host.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  const wheel = (dx, dy, ctrl) => host.dispatchEvent(new win.WheelEvent('wheel', {
    deltaX: dx, deltaY: dy, ctrlKey: !!ctrl,
    clientX: cx, clientY: cy, bubbles: true, cancelable: true,
  }));

  const nextFrame = () => new Promise((r) => win.requestAnimationFrame(() => r()));

  // The world transform is the ground truth that the gesture LANDED. Without
  // this check a probe whose synthetic events get swallowed reports a beautiful
  // 60fps idle page as a baseline — the exact way a benchmark lies.
  const world = doc.querySelector('.dc-world');
  const transformOf = () => (world ? win.getComputedStyle(world).transform + '|' + (world.style.zoom || '') : '');

  (async () => {
    // Warm-up: one frame so the first measured delta isn't the install cost.
    await nextFrame();

    // FIT-ALL first when asked. This is the state the moodboard RCA identified
    // as the painful one and the state a probe most easily misses: at the
    // canvas's stored viewport only a handful of boards are on screen, so
    // content-visibility culls the rest and the measurement flatters the
    // engine. Zoomed out to the whole plane nothing culls, every board paints,
    // and that is where the user says it stops being usable. Cmd+0 is the
    // canvas's own fit shortcut (canvas-lib keydown, case 0).
    // NB: no backticks in this comment — it lives inside a template literal.
    if (${fitAll ? 'true' : 'false'}) {
      doc.dispatchEvent(new win.KeyboardEvent('keydown', {
        key: '0', code: 'Digit0', metaKey: true, bubbles: true, cancelable: true,
      }));
      host.dispatchEvent(new win.KeyboardEvent('keydown', {
        key: '0', code: 'Digit0', metaKey: true, bubbles: true, cancelable: true,
      }));
      // Let the fit animation finish before the measured gesture starts.
      await new Promise((r) => win.setTimeout(r, 800));
    }
    // Baseline for the did-it-move check is taken HERE, after any fit, not at
    // harness install. Repeated passes are deterministic: pass N ends exactly
    // where "fit + the same pan" lands, so an install-time baseline compares two
    // identical states and rejects a gesture that ran perfectly.
    const t0 = transformOf();
    const panStart = frames.length;
    for (let i = 0; i < ${pan}; i++) { wheel(-12, -9, false); await nextFrame(); }
    const panEnd = frames.length;
    const tPan = transformOf();

    // Zoom: alternate in/out so the run neither drifts to the zoom clamp nor
    // ends somewhere a follow-up run would start from differently.
    // Zoom IN first, then back out — symmetric (net scale change ~0) but it
    // starts in the direction that always has headroom. Starting outward dies
    // at fit-all, where the viewport already sits on ZOOM_MIN: the clamp makes
    // the first half a no-op, the transform never moves, and the validity gate
    // correctly rejects the whole run.
    // Sampled at the TURNAROUND, not at the end: the run is symmetric, so its
    // endpoint transform equals its start. Comparing endpoints would report
    // "zoom never happened" for a zoom that happened twice.
    let tZoomMid = '';
    for (let i = 0; i < ${zoom}; i++) {
      wheel(0, i < ${zoom} / 2 ? -8 : 8, true);
      await nextFrame();
      if (i === Math.floor(${zoom} / 2) - 1) tZoomMid = transformOf();
    }
    const zoomEnd = frames.length;
    const tZoom = tZoomMid;

    // Settle window — the tail spike after the gesture is its own symptom
    // ("seká po dojezdu"), so it is measured separately, not averaged away.
    const settleStart = frames.length;
    await new Promise((r) => win.setTimeout(r, 900));
    running = false;
    if (po) { try { po.disconnect(); } catch {} }

    const slice = (a, b) => frames.slice(a, b).filter((n) => n > 0);
    const pct = (arr, p) => {
      if (!arr.length) return null;
      const s = arr.slice().sort((a, b) => a - b);
      return Math.round(s[Math.min(s.length - 1, Math.floor(s.length * p))] * 100) / 100;
    };
    const stat = (arr) => ({
      frames: arr.length,
      p50: pct(arr, 0.5),
      p95: pct(arr, 0.95),
      max: arr.length ? Math.round(Math.max(...arr) * 100) / 100 : null,
    });

    const gestureFrames = slice(panStart, zoomEnd);
    win.__maudePerfResult = {
      pan: stat(slice(panStart, panEnd)),
      zoom: stat(slice(panEnd, zoomEnd)),
      gesture: stat(gestureFrames),
      settle: stat(slice(settleStart, frames.length)),
      longtasks,
      artboardRenders: win.__dcPerf ? win.__dcPerf.artboardRenders : null,
      annotationRenders: win.__dcPerf ? win.__dcPerf.annotationRenders : null,
      instrumented: !!(win.__dcPerf && win.__dcPerf.instrumented),
      panApplied: tPan !== t0,
      zoomApplied: tZoom !== tPan,
    };
  })();
  return 'STARTED';
})()`;
}

/**
 * Shape check behind `parseAndValidateResult` — validates a harness result
 * before ANY of it is printed or recorded.
 *
 * The harness parks its result on `window.__maudePerfResult` — a global inside
 * the canvas origin, which DDR-054 treats as untrusted. A canvas from a cloned
 * repo can define that global itself, ahead of our IIFE, and hand back whatever
 * shape it likes. The numbers would be laundered downstream by Math.round, but
 * the per-pass progress line and the refusal message print fields verbatim, so
 * without this gate a hostile canvas gets attacker-authored text into the
 * invoking agent's transcript wearing a first-party tool's voice.
 *
 * Returns the value only when every leaf is the primitive it claims to be.
 */
export function parseAndValidateResult(raw) {
  let decoded;
  try {
    decoded = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    // The PARSE is part of the trust boundary, not a step before it. A canvas
    // owns its window and can replace JSON.stringify, so `raw` is arbitrary
    // text — and a JSON.parse SyntaxError quotes a snippet of its input, which
    // would carry attacker-authored text into the invoking agent's transcript
    // through the generic error handler.
    return null;
  }
  return validateResult(decoded);
}

function validateResult(r) {
  const num = (v) => v === null || (typeof v === 'number' && Number.isFinite(v));
  const stat = (o) => o && typeof o === 'object' && num(o.p50) && num(o.p95) && num(o.max);
  if (!r || typeof r !== 'object') return null;
  if (!stat(r.gesture) || !stat(r.pan) || !stat(r.zoom) || !stat(r.settle)) return null;
  if (!num(r.longtasks) || !num(r.artboardRenders) || !num(r.annotationRenders)) return null;
  if (typeof r.panApplied !== 'boolean' || typeof r.zoomApplied !== 'boolean') return null;
  if (typeof r.instrumented !== 'boolean') return null;
  return r;
}

/** Median across kept passes — robust to the one pass that hit a GC. */
export function medianOf(passes) {
  const med = (pick) => {
    const vals = passes.map(pick).filter((v) => v != null);
    if (!vals.length) return null;
    const s = vals.slice().sort((a, b) => a - b);
    return Math.round(s[Math.floor(s.length / 2)] * 100) / 100;
  };
  return {
    pan: { p95: med((p) => p.pan.p95) },
    zoom: { p95: med((p) => p.zoom.p95) },
    gesture: {
      p50: med((p) => p.gesture.p50),
      p95: med((p) => p.gesture.p95),
      max: med((p) => p.gesture.max),
    },
    settle: { max: med((p) => p.settle.max) },
    longtasks: med((p) => p.longtasks),
    artboardRenders: med((p) => p.artboardRenders),
    annotationRenders: med((p) => p.annotationRenders),
    instrumented: passes.some((p) => p.instrumented),
    passes: passes.length,
    // The spread across kept passes IS a result: a delta smaller than this is
    // noise, and the report says so rather than leaving the reader to guess.
    p95Spread:
      passes.length > 1
        ? Math.round(
            (Math.max(...passes.map((p) => p.gesture.p95)) -
              Math.min(...passes.map((p) => p.gesture.p95))) *
              100
          ) / 100
        : null,
  };
}

export function buildRow({ result, label, engineTag, opts }) {
  return {
    date: new Date().toISOString(),
    canvas: label,
    engine: engineTag,
    url: opts.url,
    panFrames: opts.pan,
    zoomFrames: opts.zoom,
    p50FrameMs: result.gesture.p50,
    p95FrameMs: result.gesture.p95,
    maxFrameMs: result.gesture.max,
    panP95Ms: result.pan.p95,
    zoomP95Ms: result.zoom.p95,
    settleMaxMs: result.settle.max,
    longtasks: result.longtasks,
    artboardRenders: result.artboardRenders,
    annotationRenders: result.annotationRenders,
    instrumented: result.instrumented,
    passes: result.passes,
    p95SpreadMs: result.p95Spread,
  };
}

/** Delta vs the previous run of the same (canvas, engine) pair. */
export function deltaLine(label, cur, prev, unit = 'ms') {
  if (cur == null) return `  ${label.padEnd(22)} —`;
  if (prev == null) return `  ${label.padEnd(22)} ${cur}${unit}   (no prior run)`;
  const d = Math.round((cur - prev) * 100) / 100;
  const pctChange = prev === 0 ? null : Math.round((d / prev) * 1000) / 10;
  const arrow = d === 0 ? '=' : d < 0 ? '▼' : '▲';
  const pctTxt = pctChange == null ? '' : ` ${pctChange > 0 ? '+' : ''}${pctChange}%`;
  return `  ${label.padEnd(22)} ${cur}${unit}   ${arrow} ${d > 0 ? '+' : ''}${d}${unit}${pctTxt}  (was ${prev}${unit})`;
}

export function readHistory(path, label, engineTag) {
  if (!path || !existsSync(path)) return null;
  let prev = null;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const row = JSON.parse(line);
      if (row.canvas === label && row.engine === engineTag) prev = row;
    } catch {
      /* a corrupt line must not sink the run — history is a convenience, not a source of truth */
    }
  }
  return prev;
}

/**
 * One-line, control-character-free rendering of a caller-supplied string.
 * A canvas filename comes from the repo and POSIX allows newlines in it, so
 * echoing one raw lets a hostile repo inject its own line into a report an
 * agent reads.
 */
function safeLabel(v) {
  let out = '';
  for (const ch of String(v).slice(0, 200)) {
    const code = ch.codePointAt(0);
    out += code < 0x20 || code === 0x7f ? ' ' : ch;
  }
  return out;
}

export function renderReport({ row, prev, opts, label, engineTag }) {
  const out = [];
  out.push(`\n  canvas: ${safeLabel(label)}    engine: ${safeLabel(engineTag)}`);
  out.push(`  gesture: ${opts.pan} pan frames + ${opts.zoom} zoom frames\n`);
  out.push(deltaLine('frame p50', row.p50FrameMs, prev?.p50FrameMs));
  out.push(deltaLine('frame p95', row.p95FrameMs, prev?.p95FrameMs));
  out.push(deltaLine('frame max', row.maxFrameMs, prev?.maxFrameMs));
  out.push(deltaLine('pan p95', row.panP95Ms, prev?.panP95Ms));
  out.push(deltaLine('zoom p95', row.zoomP95Ms, prev?.zoomP95Ms));
  out.push(deltaLine('settle max', row.settleMaxMs, prev?.settleMaxMs));
  out.push(deltaLine('long tasks', row.longtasks, prev?.longtasks, ''));
  out.push(deltaLine('artboard renders', row.artboardRenders, prev?.artboardRenders, ''));
  out.push(deltaLine('annotation renders', row.annotationRenders, prev?.annotationRenders, ''));
  if (!row.instrumented) {
    out.push(
      '\n  note: render counters are not instrumented in this build — frame timings are still valid.'
    );
  }
  if (row.p95SpreadMs != null) {
    out.push(
      `\n  p95 spread across ${row.passes} kept passes: ${row.p95SpreadMs}ms ` +
        '— treat any delta smaller than this as noise.'
    );
  }
  if (opts.history) out.push(`\n  history: ${opts.history}`);
  out.push(
    `  ${prev ? 'compared against the previous run' : 'first run — this IS the baseline'}\n`
  );
  return out.join('\n');
}
