// video-render-lib.ts — DDR-148 addendum: in-page whole-comp render (video +
// audio, one pass) via @remotion/web-renderer's renderMediaOnWeb.
//
// Runs INSIDE the capture Chromium (injected via addScriptTag, mirroring
// video-encode-lib.ts). Replaces the frame-step + mediabunny screenshot loop
// for video-comp mp4/webm export: Remotion owns the TransitionSeries offset
// math and `<Audio volume={fn}>` closures internally, so a single
// renderMediaOnWeb call produces a correctly-muxed, frame-accurate video+audio
// file with no hand-rolled mixing. GIF export (no audio, no renderMediaOnWeb
// container support) stays on the frame-step + gifenc path — proven compatible
// with @remotion/media (screenshot-after-seek reliably shows decoded frames,
// including mid-transition composites; see the DDR-148 addendum retro).
//
// Externalizes 'remotion' + '@remotion/media' (resolved via the SAME importmap
// bundle the page's canvas module tree uses) to avoid the dual-package hazard:
// the `component` passed in was created against the page's imported instances,
// so renderMediaOnWeb's internal Composition/context providers MUST be the
// same instances, or useCurrentFrame()/<Audio> volume closures bind to the
// wrong (default) context and the render freezes / plays silent.
//
// Offline posture (DDR-148 security): the capture CSP already locks network
// egress to loopback-only, which blocks web-renderer's optional telemetry
// (remotion.pro/api/track/register-usage-point) at the network layer — no
// additional code needed here. `licenseKey`/`isProduction` are still threaded
// through per Remotion's disclosed-license posture (MAUDE_REMOTION_LICENSE).

import { renderMediaOnWeb } from '@remotion/web-renderer';
import type { ComponentType } from 'react';

interface RenderVideoOpts {
  component: ComponentType<Record<string, unknown>>;
  inputProps?: Record<string, unknown>;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  container: 'mp4' | 'webm';
  videoCodec?: string;
  audioCodec?: string;
  scale?: number;
  muted?: boolean;
  frameRange?: [number, number];
  licenseKey?: string;
}

interface RenderVideoResult {
  b64: string;
  bytes: number;
  container: string;
  videoCodec: string | null;
  audioCodec: string | null;
}

function bytesToB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

async function renderVideo(opts: RenderVideoOpts): Promise<RenderVideoResult> {
  const muted = opts.muted ?? false;
  const videoCodec = (opts.videoCodec ??
    (opts.container === 'webm' ? 'vp9' : 'h264')) as Parameters<
    typeof renderMediaOnWeb
  >[0]['videoCodec'];
  const audioCodec = muted
    ? null
    : ((opts.audioCodec ?? (opts.container === 'webm' ? 'opus' : 'aac')) as Parameters<
        typeof renderMediaOnWeb
      >[0]['audioCodec']);

  const result = await renderMediaOnWeb({
    composition: {
      component: opts.component,
      id: 'maude-export',
      width: opts.width,
      height: opts.height,
      fps: opts.fps,
      durationInFrames: opts.durationInFrames,
    },
    inputProps: opts.inputProps ?? {},
    container: opts.container,
    videoCodec,
    audioCodec,
    muted,
    scale: opts.scale ?? 1,
    frameRange: opts.frameRange ?? null,
    isProduction: true,
    licenseKey: opts.licenseKey ?? 'free-license',
    logLevel: 'error',
  });
  const blob = await result.getBlob();
  const buf = new Uint8Array(await blob.arrayBuffer());
  return {
    b64: bytesToB64(buf),
    bytes: buf.length,
    container: opts.container,
    videoCodec: videoCodec ?? null,
    audioCodec: audioCodec ?? null,
  };
}

(globalThis as unknown as { __maudeRenderVideo__: typeof renderVideo }).__maudeRenderVideo__ =
  renderVideo;
