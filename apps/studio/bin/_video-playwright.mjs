// _video-playwright.mjs — DDR-148 deterministic video/animation capture shim.
//
// The export counterpart to _png-playwright.mjs: instead of one screenshot it
// steps a canvas artboard frame-by-frame and captures each frame. A video-comp
// is deterministic BY CONSTRUCTION (Remotion's useCurrentFrame + the
// window.__maude_seek__ bridge), so two capture runs to frame N are pixel-
// identical — the determinism contract the whole feature rests on.
//
// Reuses the _png-playwright world-plane reset (DDR-041): zero the .dc-world
// zoom/transform, pin the target artboard to (0,0), size the viewport to the
// artboard rect, then screenshot a fixed clip every frame.
//
// Two frame sinks:
//   • --dump-frames <dir>  → write frame-00000.png … (the determinism smoke +
//     a debugging aid). Task 5 deliverable.
//   • --format mp4|webm|gif --out <path> → encode in-page via mediabunny/gifenc
//     (Task 6, wired through _video-encode.mjs helpers loaded as addScriptTag).
//
// Seek model:
//   • video-comp artboard → window.__maude_seek__(frame) (Player frame prop).
//   • ordinary artboard  → time-based: document.getAnimations() currentTime +
//     every <video>.currentTime, awaiting `seeked`. Selected by --mode.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { launchChromium } from './_pw-launch.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, all) => {
    if (cur.startsWith('--')) acc.push([cur.slice(2), all[i + 1] ?? '1']);
    return acc;
  }, [])
);

const {
  url,
  artboard, // data-dc-screen id to capture (default: first artboard)
  selector: selectorArg, // explicit CSS selector (overrides --artboard); from the export target
  fps: fpsArg,
  frames: framesArg,
  'dump-frames': dumpDir,
  'encode-lib': encodeLib, // path to the bundled in-page encoder (mediabunny/gifenc)
  format, // 'mp4' | 'webm' | 'gif' — enables the encode sink (with --out)
  out, // encoded file destination
  mode = 'comp', // 'comp' | 'ordinary'
  timeout = '60',
  scale = '1',
} = args;

if (!url) {
  console.error(
    'usage: _video-playwright.mjs --url <shell-url> [--artboard <id>] [--fps N] [--frames N] --dump-frames <dir>'
  );
  process.exit(2);
}

const timeoutMs = Number(timeout) * 1000;
const deviceScaleFactor = Math.max(1, Math.min(4, Number(scale) || 1));

/** Wait a real turn of the event loop + a frame so a seek settles before shot. */
const SETTLE_MS = 16;

const browser = await launchChromium();
try {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor,
  });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'networkidle', timeout: timeoutMs });
  await page.evaluate(() => document.fonts.ready);

  // Resolve the target artboard handle. Priority: explicit --selector (from the
  // export scope Target) → --artboard id → first artboard. `--widen` climbs to
  // the enclosing [data-dc-screen] (the descendant-selector export case).
  const widen = args.widen !== undefined;
  const selector = selectorArg
    ? selectorArg
    : artboard
      ? `[data-dc-screen="${cssEscape(artboard)}"]`
      : '[data-dc-screen]';
  const located = page.locator(selector).first();
  await located.waitFor({ state: 'visible', timeout: timeoutMs });
  const handle = widen
    ? await located.evaluateHandle((el) => el.closest('[data-dc-screen]') ?? el)
    : located;

  // DDR-041 world-plane reset + pin the target artboard to (0,0) so the clip is
  // the artboard's native pixels, not the pan/zoomed world.
  await page.evaluate(() => {
    const world = document.querySelector('.dc-world');
    if (world) {
      world.style.zoom = '1';
      world.style.transform = 'none';
    }
  });
  await handle.evaluate((el) => {
    const ab = el.closest('[data-dc-screen]') ?? el;
    ab.style.left = '0px';
    ab.style.top = '0px';
  });
  const rect0 = await handle.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { width: r.width, height: r.height };
  });
  await page.setViewportSize({
    width: Math.max(1, Math.ceil(rect0.width)),
    height: Math.max(1, Math.ceil(rect0.height)),
  });
  await handle.evaluate((el) => {
    el.scrollIntoView({ block: 'start', inline: 'start' });
    window.scrollTo(0, 0);
  });
  const clip = await handle.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return {
      x: Math.max(0, Math.floor(r.left)),
      y: Math.max(0, Math.floor(r.top)),
      width: Math.max(1, Math.ceil(r.width)),
      height: Math.max(1, Math.ceil(r.height)),
    };
  });

  // Resolve fps + frame count. Prefer explicit args (the exporter computes them
  // from comp meta / options); fall back to the registered comp meta in-page.
  const compMeta = await page.evaluate(() => {
    try {
      const comps =
        typeof window.__maude_comps__ === 'function' ? window.__maude_comps__() : [];
      return comps[0] ?? null;
    } catch {
      return null;
    }
  });
  const fps = Number(fpsArg) || compMeta?.fps || 30;
  // Cap at 900 frames (30 s @ 30 fps) so a runaway/huge comp can't spawn an
  // unbounded screenshot loop — matches exporters/video.ts MAX_FRAMES.
  const frameCount = Math.min(
    900,
    Number(framesArg) || compMeta?.durationInFrames || Math.round(fps * 3) // 3 s default
  );
  if (!Number.isFinite(fps) || fps <= 0 || !Number.isFinite(frameCount) || frameCount <= 0) {
    console.error('_video-playwright: could not resolve fps/frameCount (no comp meta, no args)');
    process.exit(2);
  }

  // For ordinary artboards, prime the <video> elements (await first seeked).
  if (mode === 'ordinary') {
    await page.evaluate(async () => {
      const vids = Array.from(document.querySelectorAll('video'));
      await Promise.all(
        vids.map(
          (v) =>
            new Promise((res) => {
              if (v.readyState >= 2) return res(undefined);
              v.addEventListener('loadeddata', () => res(undefined), { once: true });
              // safety timeout
              setTimeout(() => res(undefined), 2000);
            })
        )
      );
    });
  }

  const dump = dumpDir ? (mkdirSync(dumpDir, { recursive: true }), dumpDir) : null;
  const framePaths = [];
  const t0 = Date.now();

  // Encode sink (Task 6) — inject the in-page mediabunny/gifenc lib and start it.
  const encoding = !!(encodeLib && format && out);
  const isGif = format === 'gif';
  if (encoding) {
    const libSrc = readFileSync(encodeLib, 'utf8');
    await page.addScriptTag({ content: libSrc, type: 'module' });
    await page.waitForFunction(() => typeof window.__maudeEnc === 'object', { timeout: timeoutMs });
    const started = await page.evaluate(
      async ({ width, height, fps, isGif, gifColors, fmt }) => {
        if (isGif) {
          window.__maudeEnc.startGif({ width, height, fps, maxColors: gifColors });
          return { container: 'gif', codec: 'gif' };
        }
        return window.__maudeEnc.startVideo({ width, height, fps, format: fmt });
      },
      {
        width: clip.width,
        height: clip.height,
        fps,
        isGif,
        gifColors: Number(args.gifColors) || 256,
        fmt: format,
      }
    );
    console.error(`encoder: ${started.container} / ${started.codec}`);
  }

  for (let f = 0; f < frameCount; f += 1) {
    await seekFrame(page, f, fps, mode);
    await page.waitForTimeout(SETTLE_MS);
    const shot = await page.screenshot({ clip });
    if (dump) {
      const p = join(dump, `frame-${String(f).padStart(5, '0')}.png`);
      writeFileSync(p, shot);
      framePaths.push(p);
    }
    if (encoding) {
      const b64 = shot.toString('base64');
      await page.evaluate(
        async ({ b64, isGif }) => {
          if (isGif) return window.__maudeEnc.addGifFrame(b64);
          return window.__maudeEnc.addVideoFrame(b64);
        },
        { b64, isGif }
      );
    }
    if (f % 30 === 0) console.error(`frame ${f + 1}/${frameCount}`);
  }

  let result = { fps, frameCount, width: clip.width, height: clip.height, framePaths };
  if (encoding) {
    const enc = await page.evaluate(
      async ({ isGif }) =>
        isGif ? window.__maudeEnc.finishGif() : window.__maudeEnc.finishVideo(),
      { isGif }
    );
    writeFileSync(out, Buffer.from(enc.b64, 'base64'));
    result = { ...result, out, bytes: enc.bytes, container: enc.container, codec: enc.codec };
    console.error(`✓ encoded ${enc.container}/${enc.codec} → ${out} (${enc.bytes} B)`);
  }

  const ms = Date.now() - t0;
  console.error(
    `✓ captured ${frameCount} frames @ ${fps}fps (${clip.width}×${clip.height}) in ${ms}ms`
  );
  // stdout = machine-readable summary for the exporter.
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
}

/** Seek one frame via the right bridge. Resolves after the frame has painted. */
async function seekFrame(page, frame, fps, mode) {
  if (mode === 'ordinary') {
    await page.evaluate(
      async ({ frame, fps }) => {
        const ms = (frame / fps) * 1000;
        for (const a of document.getAnimations()) {
          try {
            a.pause();
            a.currentTime = ms;
          } catch {
            /* unseekable */
          }
        }
        const vids = Array.from(document.querySelectorAll('video'));
        await Promise.all(
          vids.map(
            (v) =>
              new Promise((res) => {
                const target = ms / 1000;
                if (Math.abs(v.currentTime - target) < 1e-3) return res(undefined);
                v.addEventListener('seeked', () => res(undefined), { once: true });
                v.currentTime = target;
                setTimeout(() => res(undefined), 500);
              })
          )
        );
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
      },
      { frame, fps }
    );
    return;
  }
  // comp mode — the seek bridge pauses + seeks the Player and resolves post-paint.
  await page.evaluate(async (frame) => {
    if (typeof window.__maude_seek__ === 'function') {
      await window.__maude_seek__(frame);
    }
  }, frame);
}

/** Minimal CSS.escape for the data-dc-screen attribute selector. */
function cssEscape(s) {
  return String(s).replace(/["\\\]]/g, '\\$&');
}
