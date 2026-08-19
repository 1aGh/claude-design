// video-encode-lib.ts — DDR-148 in-page MP4/WebM/GIF encoder.
//
// Runs INSIDE the capture Chromium (bundled to a self-contained module by
// _browser-bundles.getEncodeLibBundle, injected via page.addScriptTag). WebCodecs
// is guaranteed there — the user's shell browser / WKWebView never encodes.
//
// The Node shim (bin/_video-playwright.mjs) screenshots each frame, hands the
// PNG in as base64, and this lib decodes → draws to an offscreen canvas →
// encodes: mediabunny (Output + CanvasSource, H.264/avc in MP4, VP9/VP8 in WebM
// as the fallback), or gifenc (quantize → applyPalette). Video codec is chosen
// by mediabunny's own capability probe, so a browser without an H.264 encoder
// degrades to WebM instead of failing. Audio mixing is added in a follow-up
// slice (the comp's <Audio>/<Video> sources via OfflineAudioContext).
//
// The lib assigns a single `window.__maudeEnc` surface (no exports — it's a
// side-effecting module script).

import { applyPalette, GIFEncoder, quantize } from 'gifenc';
import {
  BufferTarget,
  CanvasSource,
  getFirstEncodableVideoCodec,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  type VideoCodec,
  WebMOutputFormat,
} from 'mediabunny';

interface StartVideoOpts {
  width: number;
  height: number;
  fps: number;
  format?: 'mp4' | 'webm';
}
interface StartGifOpts {
  width: number;
  height: number;
  fps: number;
  maxColors?: number;
}
interface EncodeResult {
  b64: string;
  bytes: number;
  container: string;
  codec: string;
}

interface MaudeEnc {
  startVideo(opts: StartVideoOpts): Promise<{ container: string; codec: string }>;
  addVideoFrame(b64png: string, format?: 'png' | 'jpeg'): Promise<void>;
  finishVideo(): Promise<EncodeResult>;
  startGif(opts: StartGifOpts): void;
  addGifFrame(b64png: string): Promise<void>;
  finishGif(): EncodeResult;
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
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

async function decodeToBitmap(
  b64: string,
  mime: 'image/png' | 'image/jpeg' = 'image/png'
): Promise<ImageBitmap> {
  // Uint8Array<ArrayBufferLike> vs BlobPart — see saveAsset in api.ts.
  return createImageBitmap(new Blob([b64ToBytes(b64) as Uint8Array<ArrayBuffer>], { type: mime }));
}

let vstate: {
  output: Output;
  // Held alongside `output` because mediabunny's `Output` types `target` as the
  // Target union — the concrete BufferTarget (the only one this encoder ever
  // constructs) is what carries `.buffer`.
  target: BufferTarget;
  source: CanvasSource;
  canvas: OffscreenCanvas;
  ctx: OffscreenCanvasRenderingContext2D;
  fps: number;
  frame: number;
  container: string;
  codec: string;
} | null = null;

let gstate: {
  enc: ReturnType<typeof GIFEncoder>;
  canvas: OffscreenCanvas;
  ctx: OffscreenCanvasRenderingContext2D;
  delay: number;
  maxColors: number;
} | null = null;

const MP4_CODECS: VideoCodec[] = ['avc', 'hevc'];
const WEBM_CODECS: VideoCodec[] = ['vp9', 'vp8', 'av1'];

const api: MaudeEnc = {
  async startVideo({ width, height, fps, format }) {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no 2d context for encode canvas');

    // Prefer the requested container's codecs; fall back to WebM/VP9 so a
    // browser without an H.264 encoder still produces a file.
    const wantMp4 = format !== 'webm';
    let outFormat: Mp4OutputFormat | WebMOutputFormat = wantMp4
      ? new Mp4OutputFormat()
      : new WebMOutputFormat();
    let codec = await getFirstEncodableVideoCodec(wantMp4 ? MP4_CODECS : WEBM_CODECS, {
      width,
      height,
    });
    if (!codec && wantMp4) {
      outFormat = new WebMOutputFormat();
      codec = await getFirstEncodableVideoCodec(WEBM_CODECS, { width, height });
    }
    if (!codec) throw new Error('no encodable video codec available in this browser');

    const target = new BufferTarget();
    const output = new Output({ format: outFormat, target });
    // `latencyMode: 'quality'` is pinned, not left to the default. Per WebCodecs
    // §7.11 `realtime` explicitly permits the encoder to DROP frames to hit a
    // bitrate/framerate target, while `quality` MUST NOT — and mediabunny flips
    // MediaStream-driven sources to `realtime` automatically. We push frames
    // through a CanvasSource so we are not in that case today, but a future
    // refactor that routes through a stream would silently start dropping
    // frames from an export with no error anywhere.
    const source = new CanvasSource(canvas, {
      codec,
      bitrate: QUALITY_HIGH,
      latencyMode: 'quality',
    });
    output.addVideoTrack(source, { frameRate: fps });
    await output.start();
    const container = outFormat instanceof Mp4OutputFormat ? 'mp4' : 'webm';
    vstate = { output, target, source, canvas, ctx, fps, frame: 0, container, codec };
    return { container, codec };
  },

  async addVideoFrame(b64png, format = 'png') {
    if (!vstate) throw new Error('startVideo not called');
    const bmp = await decodeToBitmap(b64png, format === 'jpeg' ? 'image/jpeg' : 'image/png');
    // REJECT a mismatched frame instead of rescaling it. `drawImage` with
    // explicit dimensions silently resamples anything that does not match the
    // encoder canvas, so a capture whose clip drifted by a pixel produced an
    // invisible resample seam rather than an error — the kind of defect that
    // survives every check we have and shows up as "the export looks slightly
    // off". Loud is the only useful behaviour here.
    if (bmp.width !== vstate.canvas.width || bmp.height !== vstate.canvas.height) {
      const got = `${bmp.width}×${bmp.height}`;
      const want = `${vstate.canvas.width}×${vstate.canvas.height}`;
      if ('close' in bmp) bmp.close();
      throw new Error(
        `frame ${vstate.frame} is ${got} but the encoder canvas is ${want} — ` +
          'refusing to resample. The capture clip changed mid-export.'
      );
    }
    vstate.ctx.drawImage(bmp, 0, 0, vstate.canvas.width, vstate.canvas.height);
    if ('close' in bmp) bmp.close();
    await vstate.source.add(vstate.frame / vstate.fps, 1 / vstate.fps);
    vstate.frame += 1;
  },

  async finishVideo() {
    if (!vstate) throw new Error('startVideo not called');
    await vstate.output.finalize();
    const buf = vstate.target.buffer;
    if (!buf) throw new Error('encode produced no buffer');
    const res: EncodeResult = {
      b64: bytesToB64(buf),
      bytes: buf.byteLength,
      container: vstate.container,
      codec: vstate.codec,
    };
    vstate = null;
    return res;
  },

  startGif({ width, height, fps, maxColors }) {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('no 2d context for gif canvas');
    gstate = {
      enc: GIFEncoder(),
      canvas,
      ctx,
      delay: Math.max(2, Math.round(100 / fps)) * 10, // gifenc delay is in ms
      maxColors: Math.max(2, Math.min(256, maxColors ?? 256)),
    };
  },

  async addGifFrame(b64png) {
    if (!gstate) throw new Error('startGif not called');
    const bmp = await decodeToBitmap(b64png);
    gstate.ctx.drawImage(bmp, 0, 0, gstate.canvas.width, gstate.canvas.height);
    if ('close' in bmp) bmp.close();
    const { data, width, height } = gstate.ctx.getImageData(
      0,
      0,
      gstate.canvas.width,
      gstate.canvas.height
    );
    const palette = quantize(data, gstate.maxColors);
    const index = applyPalette(data, palette);
    gstate.enc.writeFrame(index, width, height, { palette, delay: gstate.delay });
  },

  finishGif() {
    if (!gstate) throw new Error('startGif not called');
    gstate.enc.finish();
    const bytes = gstate.enc.bytes();
    const res: EncodeResult = {
      b64: bytesToB64(bytes),
      bytes: bytes.length,
      container: 'gif',
      codec: 'gif',
    };
    gstate = null;
    return res;
  },
};

(globalThis as unknown as { __maudeEnc: MaudeEnc }).__maudeEnc = api;
