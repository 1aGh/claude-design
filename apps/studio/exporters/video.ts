// DDR-148 — video/animation exporter (mp4 · webm · gif).
//
// Drives bin/_video-playwright.mjs, which picks one of two capture strategies:
//   • mp4/webm of a registered video-comp — DDR-148 addendum (audio export):
//     window.__maude_render_video__ → @remotion/web-renderer's renderMediaOnWeb,
//     video+audio in one pass (Remotion owns the TransitionSeries/volume-closure
//     timeline math). `getWebRendererBundle()` supplies the in-page renderer.
//   • everything else (gif, ordinary/CSS-WAAPI artboards, or no registered
//     comp) — the original frame-step spine: steps the artboard frame-by-frame
//     via window.__maude_seek__ and encodes in-page with mediabunny (H.264/avc
//     MP4, VP9/VP8 WebM fallback) or gifenc. `getEncodeLibBundle()` supplies
//     this in-page encoder, and doubles as the render-lib path's fallback when
//     the target has no registered comp (the shim decides at runtime — see
//     _video-playwright.mjs for the exact routing condition).
// Scope is always `artboard`. No native binaries; the capture Chromium is the
// same one every other exporter already uses (DDR-041).

import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { getEncodeLibBundle, getWebRendererBundle } from './_browser-bundles.ts';
import { exportShimPath, runShim } from './_runtime.ts';
import {
  canvasShellUrl,
  type ExportContext,
  type ExportHooks,
  type ExportOptions,
  type ExportResult,
} from './index.ts';
import type { Target } from './scope.ts';

// DDR-045: resolve via DEV_SERVER_ROOT, never `import.meta.dir`. See _runtime.ts.
const VIDEO_PLAYWRIGHT = exportShimPath('_video-playwright.mjs');

type VideoFormat = 'mp4' | 'webm' | 'gif';

const CONTENT_TYPE: Record<string, string> = {
  mp4: 'video/mp4',
  webm: 'video/webm',
  gif: 'image/gif',
};

/** Hard cap so a runaway/huge comp can't spawn an unbounded screenshot loop. */
const MAX_FRAMES = 900; // 30 s @ 30 fps

async function runVideo(
  format: VideoFormat,
  targets: Target[],
  options: ExportOptions,
  ctx: ExportContext,
  hooks?: ExportHooks
): Promise<ExportResult> {
  const el = targets.find((t): t is Extract<Target, { kind: 'element' }> => t.kind === 'element');
  if (!el) {
    throw new Error(
      `${format} export needs an artboard target — make the artboard a video-comp or add motion`
    );
  }

  // gif has no renderMediaOnWeb container support (and no audio need — GIF is a
  // silent format), so it never needs the render-lib bundle; mp4/webm build it
  // alongside the frame-step encode-lib (the shim decides per-target at runtime
  // whether the artboard has a registered comp to hand the renderer).
  const [lib, renderLib] = await Promise.all([
    getEncodeLibBundle(),
    format === 'gif' ? Promise.resolve(null) : getWebRendererBundle(),
  ]);
  const tmp = mkdtempSync(path.join(tmpdir(), 'maude-video-'));
  const outPath = path.join(tmp, `export.${format}`);

  const args = [
    VIDEO_PLAYWRIGHT,
    '--url',
    canvasShellUrl(ctx, el.file),
    '--selector',
    el.cssPath,
    '--encode-lib',
    lib,
    '--format',
    format,
    '--out',
    outPath,
    '--timeout',
    String((options.timeoutSec as number | undefined) ?? 120),
  ];
  if (renderLib) args.push('--render-lib', renderLib);
  if (el.widen) args.push('--widen', '1');
  // Ordinary artboards animate on wall-clock (WAAPI); video-comps on frame index.
  if (options.mode === 'ordinary') args.push('--mode', 'ordinary');

  // Export-with-audio (DDR-148 addendum) — default ON; only the render-lib path
  // (mp4/webm of a registered comp) can actually produce audio, but the flag is
  // harmless for the frame-step fallback (video-only, always has been).
  const wantAudio = options.audio !== false;
  args.push('--audio', wantAudio ? '1' : '0');
  // Remotion license posture — MAUDE_REMOTION_LICENSE env (config-driven, per
  // project); the shim defaults to 'free-license' when unset. Network egress
  // for web-renderer's optional telemetry is blocked at the CSP layer regardless
  // (cspForCapture's `connect-src 'self'`, http.ts) — no additional code needed
  // for the offline posture beyond passing the key through.
  if (process.env.MAUDE_REMOTION_LICENSE) {
    args.push('--license-key', process.env.MAUDE_REMOTION_LICENSE);
  }

  // Resolution multiplier (1–3×) — the artboard's native size × scale. Default 2×
  // so a 960×540 comp exports at 1920×1080 instead of a tiny native capture. The
  // shim applies it as deviceScaleFactor AND sizes the encoder to match.
  const scale = clampInt(options.scale, 1, 3) ?? 2;
  args.push('--scale', String(scale));

  const fps = clampInt(options.fps, 1, 60);
  if (fps) args.push('--fps', String(fps));

  const frames = resolveFrames(options, fps);
  if (frames) args.push('--frames', String(frames));

  if (format === 'gif') {
    const colors = clampInt(options.gifColors, 2, 256);
    if (colors) args.push('--gifColors', String(colors));
  }

  try {
    const stdoutLines = await runShim(args, {
      cwd: path.dirname(VIDEO_PLAYWRIGHT),
      signal: hooks?.signal,
      // No MAUDE_PROGRESS line from this shim yet — frame-count progress is a
      // follow-up (video scope is always a single artboard, never multi).
    });
    const body = new Uint8Array(readFileSync(outPath));
    // The container can differ from the request (mp4 → webm fallback when the
    // browser has no H.264 encoder). Read the summary line for the real ext, and
    // for the degradation marker the shim sets when it had to fall back from the
    // renderMediaOnWeb audio path to frame-step screenshots (RCA
    // issue-video-mp4-rendermediaonweb-stack-overflow) — surfaced here so the
    // dropped audio isn't silent (job stderr / logs; a UI toast is a follow-up).
    let ext: string = format;
    try {
      const lastLine = stdoutLines.at(-1) ?? '{}';
      const summary = JSON.parse(lastLine) as {
        container?: string;
        degraded?: boolean;
        audioDropped?: boolean;
        fallbackReason?: string;
      };
      if (summary.container) ext = summary.container;
      if (summary.degraded) {
        console.error(
          `⚠ ${format} export degraded: the audio renderer failed ` +
            `(${summary.fallbackReason ?? 'unknown'}), so this file was captured ` +
            'frame-by-frame and has no audio.'
        );
      }
    } catch {
      /* keep the requested ext */
    }
    return {
      filename: `${el.canvasSlug}.${ext}`,
      contentType: CONTENT_TYPE[ext] ?? 'application/octet-stream',
      body,
    };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

/** Coerce an option to an int within [lo, hi], or undefined when absent/invalid. */
function clampInt(raw: unknown, lo: number, hi: number): number | undefined {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return undefined;
  return Math.max(lo, Math.min(hi, n));
}

/** Resolve the frame count from options (frames | durationMs×fps), capped. */
function resolveFrames(options: ExportOptions, fps: number | undefined): number | undefined {
  const explicit = clampInt(options.frames, 1, MAX_FRAMES);
  if (explicit) return explicit;
  const durationMs = Number(options.durationMs);
  if (Number.isFinite(durationMs) && durationMs > 0 && fps) {
    return Math.min(MAX_FRAMES, Math.max(1, Math.round((durationMs / 1000) * fps)));
  }
  // No hint → the shim falls back to the in-page comp meta (durationInFrames),
  // still clamped there. Pass the ceiling so an unbounded comp can't run away.
  return undefined;
}

export const mp4 = {
  run: (t: Target[], o: ExportOptions, c: ExportContext, h?: ExportHooks) =>
    runVideo('mp4', t, o, c, h),
};
export const webm = {
  run: (t: Target[], o: ExportOptions, c: ExportContext, h?: ExportHooks) =>
    runVideo('webm', t, o, c, h),
};
export const gif = {
  run: (t: Target[], o: ExportOptions, c: ExportContext, h?: ExportHooks) =>
    runVideo('gif', t, o, c, h),
};
