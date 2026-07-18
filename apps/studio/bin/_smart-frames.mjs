// _smart-frames.mjs — scene-AWARE keyframe extraction for the footage-analyst's
// vision pass (feature-scene-aware-keyframes). The engine behind
// `maude design smart-frames` (DDR-062) and skill `footage-keyframes`.
//
// Instead of blind frame-rate sampling (which straddles and misses short but
// meaningful beats), select frames at scene cuts + semantic action beats + the
// true endpoints, so the analyzer receives fewer, sharper, context-rich frames.
//
// Three tiers, auto-detected, each a graceful fallback of the next:
//   gemma  — Gemma-4 MLX scout (semantic beats) + ffmpeg scene cuts.  Needs ffmpeg
//            + mlx-vlm + a model (Apple Silicon). Opt-in, richest.
//   ffmpeg — ffmpeg scene detection + endpoints + long-shot midpoints. Needs
//            ffmpeg. The practical default; cross-platform, no model download.
//   blind  — delegate to probe-footage (headless Chromium, even-spaced). Zero new
//            deps; the floor so this always works.
//
// Emits a SUPERSET of the probe-footage manifest (drop-in for footage-analyst):
//   { asset, durationSec, width, height, method, sceneCuts[], scoutBeats[],
//     outDir, frames:[{index,t,png}] }
//
// Pure JS (runs under node OR bun, like probe-footage). Exported pure functions
// are unit-tested in _smart-frames.test.mjs.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

// ─── dependency probes ───────────────────────────────────────────────────────

export function hasCommand(cmd) {
  // `which`/`where` are real binaries → no shell (avoids DEP0190 + injection).
  const finder = process.platform === 'win32' ? 'where' : 'which';
  const r = spawnSync(finder, [cmd], { stdio: 'ignore' });
  return r.status === 0;
}

/** Resolve a python that can `import mlx_vlm`, or null. Honors $MAUDE_MLX_PYTHON. */
export function resolveMlxPython(env = process.env) {
  const candidates = [env.MAUDE_MLX_PYTHON, 'python3', 'python'].filter(Boolean);
  for (const py of candidates) {
    const r = spawnSync(py, ['-c', 'import mlx_vlm'], { stdio: 'ignore' });
    if (r.status === 0) return py;
  }
  return null;
}

export function detectAvailability(env = process.env) {
  return {
    ffmpeg: hasCommand('ffmpeg') && hasCommand('ffprobe'),
    mlxPython: resolveMlxPython(env),
  };
}

/** Pick the tier to actually run. Explicit engine wins (and errors if its deps are
 *  missing — no silent downgrade when the user asked for one); `auto` degrades
 *  gemma → ffmpeg → blind based on what's installed. */
export function selectTier(engine, avail) {
  const gemmaOk = Boolean(avail.ffmpeg && avail.mlxPython);
  if (engine && engine !== 'auto') {
    if (engine === 'gemma' && !gemmaOk)
      throw new Error(
        'engine "gemma" needs ffmpeg + mlx-vlm (Apple Silicon). Install both or use --engine ffmpeg|blind|auto.'
      );
    if (engine === 'ffmpeg' && !avail.ffmpeg)
      throw new Error(
        'engine "ffmpeg" needs ffmpeg. Install it (brew install ffmpeg) or use --engine blind|auto.'
      );
    return engine; // blind always allowed
  }
  if (gemmaOk) return 'gemma';
  if (avail.ffmpeg) return 'ffmpeg';
  return 'blind';
}

// ─── timestamp math (pure) ───────────────────────────────────────────────────

/** Parse ffmpeg `showinfo` stderr → scene-cut timestamps (seconds). */
export function parseSceneCuts(stderr) {
  const out = [];
  const re = /pts_time:([0-9.]+)/g;
  let m;
  // biome-ignore lint/suspicious/noAssignInExpressions: standard regex-exec loop.
  while ((m = re.exec(stderr))) out.push(Number(m[1]));
  return out.filter((t) => Number.isFinite(t));
}

/** Parse a Gemma scout's text → beat timestamps. Accepts both `TIME=<sec>` and the
 *  `M:SS | what` shape the small model tends to emit. */
export function parseBeats(text, durationSec) {
  const beats = [];
  const reT = /TIME=([0-9.]+)/g;
  let m;
  // biome-ignore lint/suspicious/noAssignInExpressions: standard regex-exec loop.
  while ((m = reT.exec(text))) beats.push({ t: Number(m[1]), what: '' });
  const reMS = /(?:^|\n)\s*(\d+):(\d{2}(?:\.\d+)?)\s*\|\s*([^\n]*)/g;
  // biome-ignore lint/suspicious/noAssignInExpressions: standard regex-exec loop.
  while ((m = reMS.exec(text)))
    beats.push({ t: Number(m[1]) * 60 + Number(m[2]), what: (m[3] || '').trim() });
  return beats.filter((b) => Number.isFinite(b.t) && b.t >= 0 && b.t <= durationSec);
}

/** Merge scene cuts + scout beats into a final, deduped, capped timestamp set —
 *  always incl. the true first & last frame; long shots sampled more. */
export function mergeTimestamps({
  durationSec,
  cuts = [],
  beats = [],
  maxFrames = 12,
  dedupSec = 0.4,
}) {
  const dur = durationSec;
  const pts = new Set([0, Math.max(0, +(dur - 0.05).toFixed(3))]);
  const bounds = Array.from(new Set([0, ...cuts, dur])).sort((a, b) => a - b);
  for (let i = 0; i < bounds.length - 1; i++) {
    const a = bounds[i];
    const b = bounds[i + 1];
    pts.add(+Math.min(a + 0.05, dur).toFixed(3)); // just INSIDE each shot
    const gap = b - a;
    if (gap > 3) {
      const n = Math.floor(gap / 3);
      for (let k = 1; k <= n; k++) pts.add(+(a + (gap * k) / (n + 1)).toFixed(3));
    }
  }
  for (const beat of beats) pts.add(+beat.t.toFixed(3));

  const xs = Array.from(pts).sort((a, b) => a - b);
  const deduped = [];
  for (const t of xs)
    if (!deduped.length || t - deduped[deduped.length - 1] >= dedupSec) deduped.push(t);

  if (deduped.length <= maxFrames) return deduped;
  // too many → keep an even spread across the ordered set
  const capped = [];
  for (let i = 0; i < maxFrames; i++)
    capped.push(deduped[Math.round((i * (deduped.length - 1)) / (maxFrames - 1))]);
  return Array.from(new Set(capped));
}

// ─── ffmpeg / ffprobe wrappers ───────────────────────────────────────────────

function ffprobeMeta(clip) {
  const r = spawnSync(
    'ffprobe',
    [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-show_entries',
      'stream=width,height:format=duration',
      '-of',
      'default=noprint_wrappers=1',
      clip,
    ],
    { encoding: 'utf8' }
  );
  const txt = r.stdout || '';
  const num = (re) => {
    const m = txt.match(re);
    return m ? Number(m[1]) : 0;
  };
  return {
    width: num(/width=(\d+)/),
    height: num(/height=(\d+)/),
    durationSec: num(/duration=([0-9.]+)/),
  };
}

function ffmpegSceneCuts(clip, thresh) {
  const r = spawnSync(
    'ffmpeg',
    ['-i', clip, '-vf', `select='gt(scene,${thresh})',showinfo`, '-f', 'null', '-'],
    { encoding: 'utf8' }
  );
  return parseSceneCuts(r.stderr || '');
}

function extractFrame(clip, t, outPath) {
  const r = spawnSync(
    'ffmpeg',
    ['-y', '-v', 'error', '-ss', String(t), '-i', clip, '-frames:v', '1', outPath],
    {
      encoding: 'utf8',
    }
  );
  return r.status === 0 && existsSync(outPath);
}

// ─── gemma scout ─────────────────────────────────────────────────────────────

const SCOUT_PROMPT = (dur) =>
  `You are a shot-list scout watching a ${dur}-second video clip. List the KEY moments an editor must see: the start of each distinct shot AND any peak action beat (a snap, a catch, a big movement, a reveal) — even inside a continuous shot. Do NOT space them evenly; pick only moments where something meaningful happens or changes. Output ONE line per moment, formatted EXACTLY as: TIME=<seconds> | <a few words>. Seconds must be real numbers between 0 and ${dur}.`;

function gemmaScout(clip, durationSec, { python, model, fps }) {
  const r = spawnSync(
    python,
    [
      '-m',
      'mlx_vlm.generate',
      '--model',
      model,
      '--max-tokens',
      '300',
      '--video',
      clip,
      '--fps',
      String(fps),
      '--prompt',
      SCOUT_PROMPT(durationSec),
    ],
    { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }
  );
  const text = `${r.stdout || ''}\n${r.stderr || ''}`;
  return { beats: parseBeats(text, durationSec), ok: r.status === 0, raw: text };
}

// ─── blind delegate (probe-footage) ──────────────────────────────────────────

function blindProbe(argv) {
  // Reuse the existing Chromium extractor verbatim, then re-tag the manifest.
  const script = join(HERE, '_probe-footage-playwright.mjs');
  const runner = hasCommand('node') ? 'node' : 'bun';
  const r = spawnSync(runner, [script, ...argv], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  if (r.status !== 0) {
    process.stderr.write(r.stderr || 'probe-footage failed\n');
    process.exit(r.status || 4);
  }
  let manifest;
  try {
    const out = r.stdout.trim();
    // probe-footage prints a pretty-printed manifest; parse the last {...} block.
    const start = out.indexOf('{');
    manifest = JSON.parse(start >= 0 ? out.slice(start) : out);
  } catch {
    process.stderr.write('smart-frames: could not parse probe-footage manifest\n');
    process.exit(4);
  }
  return { ...manifest, method: 'blind', sceneCuts: [], scoutBeats: [] };
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

/** Find the clip on disk, trying the probe-footage-style locations + a raw path. */
export function clipCandidates(asset, root, designRoot) {
  const c = [asset];
  if (root) {
    c.push(join(root, asset));
    if (!asset.startsWith('assets/')) c.push(join(root, designRoot, 'assets', asset));
    c.push(join(root, designRoot, asset)); // handles `assets/x` → root/.design/assets/x
  }
  return c;
}

function resolveClip(asset, root, designRoot) {
  for (const cand of clipCandidates(asset, root, designRoot)) if (existsSync(cand)) return cand;
  return null;
}

/** Read the app-persisted keyframe-engine pref from <root>/.design/config.json
 *  (generation.keyframes.engine). Pure JS — no .ts import. Returns null if absent
 *  or unreadable; best-effort, so a standalone terminal run needs no app/config. */
export function readEnginePref(root) {
  if (!root) return null;
  try {
    const cfg = JSON.parse(readFileSync(join(root, '.design', 'config.json'), 'utf8'));
    const e = cfg?.generation?.keyframes?.engine;
    return ['auto', 'gemma', 'ffmpeg', 'blind'].includes(e) ? e : null;
  } catch {
    return null;
  }
}

function parseArgs(argv) {
  const envEngine = process.env.MAUDE_SMARTFRAMES_ENGINE || '';
  const o = {
    engine: envEngine || 'auto',
    engineExplicit: Boolean(envEngine),
    frames: 12,
    sceneThresh: 0.3,
    scoutFps: 4,
  };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--engine') {
      o.engine = argv[++i];
      o.engineExplicit = true;
    } else if (a === '--frames' || a === '--max-frames') o.frames = Number(argv[++i]);
    else if (a === '--out-dir') o.outDir = argv[++i];
    else if (a === '--root') o.root = argv[++i];
    else if (a === '--design-root') o.designRoot = argv[++i];
    else if (a === '--scene-thresh') o.sceneThresh = Number(argv[++i]);
    else if (a === '--scout-fps') o.scoutFps = Number(argv[++i]);
    else if (a === '--help' || a === '-h') o.help = true;
    else rest.push(a);
  }
  o.asset = rest[0];
  return o;
}

function main() {
  const o = parseArgs(process.argv.slice(2));
  if (o.help || !o.asset) {
    process.stdout.write(
      'usage: smart-frames <asset> [--root DIR] [--out-dir DIR] [--frames N]\n' +
        '                    [--engine auto|gemma|ffmpeg|blind] [--scene-thresh 0.3] [--scout-fps 4]\n'
    );
    process.exit(o.asset ? 0 : 2);
  }

  // App-served runs honor the persisted keyframeEngine pref; an explicit --engine /
  // $MAUDE_SMARTFRAMES_ENGINE always wins; standalone terminal runs self-detect.
  if (!o.engineExplicit) {
    const pref = readEnginePref(o.root);
    if (pref) o.engine = pref;
  }

  const avail = detectAvailability();
  let tier;
  try {
    tier = selectTier(o.engine, avail);
  } catch (e) {
    process.stderr.write(`smart-frames: ${e.message}\n`);
    process.exit(3);
  }

  // blind floor delegates wholesale to probe-footage (which does its own, stricter
  // content-addressed resolution) — forward the original args, don't pre-resolve.
  if (tier === 'blind') {
    const passthru = process.argv.slice(2).filter((a, i, arr) => {
      // drop --engine and its value, and --scene-thresh/--scout-fps (probe doesn't know them)
      const prev = arr[i - 1];
      return (
        !['--engine', '--scene-thresh', '--scout-fps'].includes(a) &&
        !['--engine', '--scene-thresh', '--scout-fps'].includes(prev)
      );
    });
    const manifest = blindProbe(passthru);
    process.stdout.write(`${JSON.stringify(manifest)}\n`);
    process.stderr.write('smart-frames: engine=blind (probe-footage / Chromium, even-spaced)\n');
    return;
  }

  // ffmpeg/gemma tiers accept any readable clip (terminal power users analyze
  // arbitrary files, not just content-addressed assets). Try the candidate
  // locations probe-footage would, plus a raw path.
  const clip = resolveClip(o.asset, o.root, o.designRoot || '.design');
  if (!clip) {
    process.stderr.write(`smart-frames: asset not found: ${o.asset}\n`);
    process.exit(2);
  }

  const meta = ffprobeMeta(clip);
  if (!meta.durationSec) {
    process.stderr.write('smart-frames: ffprobe found no video/duration\n');
    process.exit(4);
  }

  const cuts = ffmpegSceneCuts(clip, o.sceneThresh);
  let beats = [];
  let method = 'ffmpeg';
  if (tier === 'gemma') {
    const model = process.env.MAUDE_GEMMA_MODEL || 'mlx-community/gemma-4-e4b-it-4bit';
    const scout = gemmaScout(clip, meta.durationSec, {
      python: avail.mlxPython,
      model,
      fps: o.scoutFps,
    });
    if (scout.ok && scout.beats.length) {
      beats = scout.beats;
      method = 'gemma';
    } else {
      process.stderr.write(
        'smart-frames: gemma scout produced no beats — falling back to ffmpeg tier\n'
      );
    }
  }

  const times = mergeTimestamps({
    durationSec: meta.durationSec,
    cuts,
    beats,
    maxFrames: o.frames,
  });

  const outDir = o.outDir || join(process.env.TMPDIR || '/tmp', `smart-frames-${Date.now()}`);
  mkdirSync(outDir, { recursive: true });
  const frames = [];
  times.forEach((t, i) => {
    const png = join(outDir, `f_${String(i + 1).padStart(2, '0')}.png`);
    if (extractFrame(clip, t, png)) frames.push({ index: i + 1, t, png });
  });
  if (!frames.length) {
    process.stderr.write('smart-frames: ffmpeg extracted no frames\n');
    process.exit(4);
  }

  const manifest = {
    asset: o.asset,
    durationSec: meta.durationSec,
    width: meta.width,
    height: meta.height,
    method,
    sceneCuts: cuts,
    scoutBeats: beats,
    outDir,
    frames,
  };
  process.stdout.write(`${JSON.stringify(manifest)}\n`);
  process.stderr.write(
    `smart-frames: engine=${method} · ${frames.length} frames · ${cuts.length} scene cuts · ${beats.length} scout beats\n`
  );
}

// run only as a CLI, not when imported by the test
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
