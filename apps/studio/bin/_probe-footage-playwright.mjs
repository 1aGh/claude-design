// _probe-footage-playwright.mjs — keyframe extraction for the footage director
// (feature-footage-analysis-director, Task 4). The READ counterpart to
// _ingest-footage.mjs: given ONE content-addressed clip, decode it in headless
// Chromium and dump N evenly-spaced keyframe PNGs the `footage-analyst` agent
// then WATCHES (vision) to characterize the clip.
//
// WHY A BROWSER, NOT ffmpeg: DDR-148's posture is "no native renderer binaries".
// Chromium already decodes video (it's the capture spine's engine). We don't even
// need Remotion here — a plain HTML5 <video>, seeked frame-by-frame and
// screenshotted, is the whole mechanism. No dev server is required either: the
// page is navigated as file:// and the clip is a file:// subresource (same
// scheme; `--allow-file-access-from-files` permits the load), so probing works
// offline / pre-server, unlike the export capture (which drives the live Player).
//
// Determinism note (DDR-094 — freeze-frames lie): the frames are evenly spaced
// midpoints across the clip, so a downstream reader gets genuine motion samples,
// not one repeated frame.
//
// OUTPUT: keyframe PNGs are THROWAWAY SCRATCH → written under --out-dir (a /tmp
// scratch path, DDR-115: capture scratch never gets a new `_*` dir, never lands
// in the VERSIONED assets/). stdout = a JSON manifest
//   { asset, durationSec, width, height, frames:[{index,t,png}] }
//
// Reached via `maude design probe-footage`, never a raw path.
// Exit: 0 ok · 2 usage · 3 no browser (via _pw-launch) · 4 decode/probe error · 1 other.

import { mkdirSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

import { launchChromium } from './_pw-launch.mjs';

const DEFAULT_FRAMES = 12;
// Cap the longest side of a keyframe PNG — vision only needs legible frames, and
// small PNGs keep the analyst's context lean. 960px is ample.
const MAX_FRAME_EDGE = 960;

function parseArgv(argv) {
  const out = {
    asset: null,
    root: null,
    designRoot: '.design',
    frames: DEFAULT_FRAMES,
    outDir: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    switch (a) {
      case '--asset':
        out.asset = argv[++i];
        break;
      case '--root':
        out.root = argv[++i];
        break;
      case '--design-root':
        out.designRoot = argv[++i];
        break;
      case '--frames':
        out.frames = Number(argv[++i]);
        break;
      case '--out-dir':
        out.outDir = argv[++i];
        break;
      case '--help':
      case '-h':
        out.help = true;
        break;
      default:
        if (a.startsWith('-')) throw usage(`unknown flag ${a}`);
        if (out.asset === null) out.asset = a;
        else throw usage(`unexpected extra arg ${a}`);
    }
  }
  return out;
}

function usage(msg) {
  const e = new Error(msg);
  e.code = 2;
  return e;
}
function probeError(msg) {
  const e = new Error(msg);
  e.code = 4;
  return e;
}

const HELP = `probe-footage — extract keyframe PNGs from one clip for vision analysis
(reached via \`maude design probe-footage\`)

Usage:
  maude design probe-footage <assets/<sha8>.<ext>> --root <repo>
                             [--design-root .design] [--frames N] [--out-dir DIR]

Decodes the clip in headless Chromium, seeks to N evenly-spaced frames, writes a
PNG per frame to --out-dir (a /tmp scratch dir — NOT assets/), and prints a JSON
manifest { asset, durationSec, width, height, frames }.

Exit: 0 ok · 2 usage · 3 no browser · 4 decode/probe error · 1 other.`;

/** Resolve the clip to an absolute path inside <designRoot>/assets and assert containment. */
function resolveAsset(root, designRootRel, asset) {
  const rel = String(asset).replace(/^\/+/, ''); // tolerate a leading slash
  if (isAbsolute(rel) || rel.includes('..'))
    throw usage(`asset must be a relative assets/ path: ${asset}`);
  const assetsDir = resolve(root, designRootRel, 'assets');
  // Accept both `assets/<name>` and a bare `<name>`.
  const name = rel.startsWith('assets/') ? rel.slice('assets/'.length) : rel;
  if (!/^[a-z0-9]{8}\.[a-z0-9]{2,4}$/.test(name))
    throw usage(`asset name must be content-addressed <sha8>.<ext>: ${name}`);
  const abs = resolve(assetsDir, name);
  if (abs !== join(assetsDir, name) || !abs.startsWith(assetsDir + sep))
    throw usage(`asset path escapes assets dir: ${abs}`);
  return { abs, name, rel: `assets/${name}` };
}

async function probe({ asset, root, designRootRel, frames, outDir }) {
  const { abs, name, rel } = resolveAsset(root, designRootRel, asset);
  const nFrames = Number.isInteger(frames) && frames > 0 ? Math.min(frames, 64) : DEFAULT_FRAMES;
  const dir =
    outDir || join(process.env.TMPDIR || '/tmp', `maude-footage-${name.replace(/\./g, '_')}`);
  mkdirSync(dir, { recursive: true });

  const browser = await launchChromium({
    headless: true,
    // file:// page loading a file:// video subresource needs this flag.
    args: ['--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required'],
  });
  try {
    const page = await browser.newPage();
    // A real file:// host page (NOT about:blank — its opaque origin can't load a
    // file:// subresource even with --allow-file-access-from-files). With a
    // file:// page + the flag, the clip loads as a same-scheme cross-dir resource.
    const hostHtml = join(dir, '_probe.html');
    writeFileSync(hostHtml, '<!doctype html><meta charset="utf-8"><body style="margin:0"></body>');
    await page.goto(pathToFileURL(hostHtml).href);

    // Load metadata: duration + intrinsic dimensions.
    const fileUrl = pathToFileURL(abs).href;
    const meta = await page.evaluate(async (url) => {
      const v = document.createElement('video');
      v.id = 'probe-v';
      v.muted = true;
      v.playsInline = true;
      v.preload = 'auto';
      v.style.position = 'fixed';
      v.style.left = '0';
      v.style.top = '0';
      v.style.margin = '0';
      document.body.style.margin = '0';
      document.body.appendChild(v);
      const done = new Promise((res, rej) => {
        v.addEventListener('loadedmetadata', () => res(true), { once: true });
        v.addEventListener('error', () => rej(new Error('video error while loading metadata')), {
          once: true,
        });
        setTimeout(() => rej(new Error('timed out loading metadata (15s)')), 15000);
      });
      v.src = url;
      await done;
      return { duration: v.duration, width: v.videoWidth, height: v.videoHeight };
    }, fileUrl);

    if (!Number.isFinite(meta.duration) || meta.duration <= 0 || !meta.width || !meta.height) {
      throw probeError(
        `clip has no seekable video track (duration=${meta.duration}, ${meta.width}x${meta.height})`
      );
    }

    // Size the <video> element to its intrinsic size, capped, and set the viewport
    // to match so an element screenshot captures the whole frame at 1:1-ish.
    const scale = Math.min(1, MAX_FRAME_EDGE / Math.max(meta.width, meta.height));
    const drawW = Math.max(1, Math.round(meta.width * scale));
    const drawH = Math.max(1, Math.round(meta.height * scale));
    await page.setViewportSize({ width: drawW, height: drawH });
    await page.evaluate(
      ({ w, h }) => {
        const v = document.getElementById('probe-v');
        v.style.width = `${w}px`;
        v.style.height = `${h}px`;
        // Expose a promise-returning seek helper for the frame loop.
        window.__seekTo = (t) =>
          new Promise((res, rej) => {
            const onSeeked = () => {
              v.removeEventListener('seeked', onSeeked);
              res(true);
            };
            v.addEventListener('seeked', onSeeked);
            setTimeout(() => {
              v.removeEventListener('seeked', onSeeked);
              rej(new Error(`seek to ${t}s timed out`));
            }, 8000);
            v.currentTime = t;
          });
      },
      { w: drawW, h: drawH }
    );

    const video = page.locator('#probe-v');
    const outFrames = [];
    for (let i = 0; i < nFrames; i += 1) {
      // Even midpoints across (0, duration) — avoids the exact-0 / exact-end
      // frames some codecs won't decode cleanly.
      const t = (meta.duration * (i + 0.5)) / nFrames;
      try {
        await page.evaluate((tt) => window.__seekTo(tt), t);
      } catch (e) {
        // A single flaky seek shouldn't abort the whole probe — skip this frame.
        outFrames.push({
          index: i,
          t: Number(t.toFixed(3)),
          png: null,
          error: String(e?.message ?? e),
        });
        continue;
      }
      const png = join(dir, `frame-${String(i).padStart(2, '0')}.png`);
      await video.screenshot({ path: png });
      outFrames.push({ index: i, t: Number(t.toFixed(3)), png });
    }

    return {
      asset: rel,
      durationSec: Number(meta.duration.toFixed(3)),
      width: meta.width,
      height: meta.height,
      outDir: dir,
      frames: outFrames,
    };
  } finally {
    await browser.close();
  }
}

async function main() {
  let opts;
  try {
    opts = parseArgv(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`probe-footage: ${err.message}\n`);
    process.exit(err.code ?? 2);
  }
  if (opts.help) {
    process.stdout.write(`${HELP}\n`);
    return;
  }
  if (!opts.asset) {
    process.stderr.write('probe-footage: <assets/<sha8>.<ext>> required\n');
    process.exit(2);
  }
  const root = opts.root || process.env.CLAUDE_PROJECT_DIR || process.cwd();
  try {
    const r = await probe({
      asset: opts.asset,
      root,
      designRootRel: opts.designRoot,
      frames: opts.frames,
      outDir: opts.outDir,
    });
    process.stdout.write(`${JSON.stringify(r, null, 2)}\n`);
  } catch (err) {
    process.stderr.write(`probe-footage: ${err.message}\n`);
    process.exit(err.code ?? 1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
