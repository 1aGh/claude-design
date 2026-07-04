// DDR-148 — video/animation exporter (mp4 · webm · gif).
//
// Drives bin/_video-playwright.mjs (the deterministic capture spine): steps the
// artboard frame-by-frame via window.__maude_seek__ and encodes in-page with
// mediabunny (H.264/avc MP4, VP9/VP8 WebM fallback) or gifenc. Scope is always
// `artboard` — an artboard is a video-comp (comp meta drives fps/frames) or an
// ordinary animated mock (options drive them). No native binaries; the capture
// Chromium is the same one every other exporter already uses (DDR-041).

import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { getEncodeLibBundle } from './_browser-bundles.ts';
import {
  canvasShellUrl,
  type ExportContext,
  type ExportOptions,
  type ExportResult,
} from './index.ts';
import type { Target } from './scope.ts';

const VIDEO_PLAYWRIGHT = path.join(import.meta.dir, '..', 'bin', '_video-playwright.mjs');

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
  ctx: ExportContext
): Promise<ExportResult> {
  const el = targets.find((t): t is Extract<Target, { kind: 'element' }> => t.kind === 'element');
  if (!el) {
    throw new Error(
      `${format} export needs an artboard target — make the artboard a video-comp or add motion`
    );
  }

  const lib = await getEncodeLibBundle();
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
  if (el.widen) args.push('--widen', '1');
  // Ordinary artboards animate on wall-clock (WAAPI); video-comps on frame index.
  if (options.mode === 'ordinary') args.push('--mode', 'ordinary');

  const fps = clampInt(options.fps, 1, 60);
  if (fps) args.push('--fps', String(fps));

  const frames = resolveFrames(options, fps);
  if (frames) args.push('--frames', String(frames));

  if (format === 'gif') {
    const colors = clampInt(options.gifColors, 2, 256);
    if (colors) args.push('--gifColors', String(colors));
  }

  try {
    const proc = Bun.spawn(['node', ...args], {
      cwd: path.dirname(VIDEO_PLAYWRIGHT),
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const [stdout, stderr] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);
    const code = await proc.exited;
    if (code !== 0) {
      throw new Error(`_video-playwright exited ${code}: ${stderr.trim() || stdout.trim()}`);
    }
    const body = new Uint8Array(readFileSync(outPath));
    // The container can differ from the request (mp4 → webm fallback when the
    // browser has no H.264 encoder). Read the summary line for the real ext.
    let ext: string = format;
    try {
      const lastLine = stdout.trim().split('\n').filter(Boolean).pop() ?? '{}';
      const summary = JSON.parse(lastLine) as { container?: string };
      if (summary.container) ext = summary.container;
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
  run: (t: Target[], o: ExportOptions, c: ExportContext) => runVideo('mp4', t, o, c),
};
export const webm = {
  run: (t: Target[], o: ExportOptions, c: ExportContext) => runVideo('webm', t, o, c),
};
export const gif = {
  run: (t: Target[], o: ExportOptions, c: ExportContext) => runVideo('gif', t, o, c),
};
