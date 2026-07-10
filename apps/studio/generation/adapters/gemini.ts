// generation/adapters/gemini.ts — Google "Nano Banana" image generation via the
// Gemini REST API (DDR-16x, Phase 0). Direct BYOK: the user's own Google key →
// generativelanguage.googleapis.com directly, no aggregator, no SDK (plain
// `fetch` in the sidecar per the plan).
//
// SYNC shape: `:generateContent` returns the image inline as base64 in ONE round
// trip, so `submit()` hands back an already-`done` Job — callers never branch on
// sync/async. The base64 is localized into `assets/<sha8>.png` by the host's
// `ctx.localize` (download.ts), never referenced inline.
//
// The key is injected via AdapterContext at call time (keys.ts) and used ONLY in
// the `x-goog-api-key` header — never logged, never put in the URL query (so it
// can't leak via a redirect Location or an error string echoed to the client).
//
// Editing (maskless, Nano Banana's strength): pass a `sourceAsset` and the host
// reads its bytes into an inlineData part alongside the text — the Phase-1 image-
// editing wiring (Task 1.2) drives that; Phase 0 is text→image only.

import type {
  AdapterContext,
  GenAsset,
  GenRequest,
  GenResult,
  Job,
  ModelDescriptor,
  ProviderAdapter,
  ProviderDescriptor,
} from '../types.ts';

const GEMINI_DEFAULT_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const GEMINI_API_BASE = process.env.MAUDE_GEMINI_API_BASE ?? GEMINI_DEFAULT_BASE;
// The only host the BYOK key may ever be sent to. `MAUDE_GEMINI_API_BASE` exists
// so a test can point at a local mock — but per the security fan-out (F2) an
// env-controlled base is otherwise a key-egress redirect + SSRF, so a non-default
// base is refused unless MAUDE_GEN_ALLOW_CUSTOM_BASE is explicitly opted in.
const GEMINI_ALLOWED_HOST = 'generativelanguage.googleapis.com';
const ALLOW_CUSTOM_BASE = /^(1|true|on|yes)$/i.test(process.env.MAUDE_GEN_ALLOW_CUSTOM_BASE ?? '');

// Hard ceiling on the provider RESPONSE the adapter will buffer before decode
// (security fan-out F1). `res.json()` + `Buffer.from(base64)` would otherwise
// materialize a multi-GB upstream body in RAM — OOM-crashing the shared server —
// long before saveAsset's disk cap can fire. Generous for a 4K image, bounded
// against abuse. Env-overridable for an operator who raises the asset caps.
const MAX_RESPONSE_BYTES = Math.max(
  1024 * 1024,
  Number(process.env.MAUDE_GEMINI_MAX_RESPONSE_BYTES) || 64 * 1024 * 1024
);

/**
 * Validate the outbound base ONCE at call time (F1/F2 defense-in-depth). Assert
 * https + the fixed host allowlist so a poisoned env can never redirect the
 * key-bearing request to a plaintext scheme or an attacker/internal host.
 */
function assertSafeBase(base: string): void {
  let u: URL;
  try {
    u = new URL(base);
  } catch {
    throw new Error('Gemini API base is not a valid URL');
  }
  if (u.protocol !== 'https:') throw new Error('Gemini API base must be https');
  if (u.hostname !== GEMINI_ALLOWED_HOST && !ALLOW_CUSTOM_BASE) {
    throw new Error(
      `Gemini API base host ${u.hostname} is not allowlisted (set MAUDE_GEN_ALLOW_CUSTOM_BASE=1 to override)`
    );
  }
}

/** Read a Response body into text with a hard byte cap (F1) — rejects a body
 *  that exceeds the cap by Content-Length hint OR by actual streamed size, so an
 *  upstream that omits Content-Length can't slip past. */
async function readTextCapped(res: Response, maxBytes: number): Promise<string> {
  const declared = Number(res.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new Error(`Gemini response too large (${declared} > ${maxBytes} bytes)`);
  }
  const body = res.body;
  if (!body) return await res.text();
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => {});
        throw new Error(`Gemini response exceeded ${maxBytes} bytes`);
      }
      chunks.push(value);
    }
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

export const GEMINI_DESCRIPTOR: ProviderDescriptor = {
  id: 'gemini',
  label: 'Google Gemini (Nano Banana)',
  kind: 'cloud',
  auth: 'api-key',
  keychainService: 'com.maude.app.gemini',
  modalities: ['image'],
  keyUrl: 'https://aistudio.google.com/apikey',
  notes:
    'Nano Banana image generation. Your Google AI Studio key bills your own Google account. Generated images may carry a SynthID watermark; review Google’s usage terms for commercial use.',
};

export const GEMINI_MODELS: ModelDescriptor[] = [
  {
    id: 'gemini-2.5-flash-image',
    label: 'Nano Banana (2.5 Flash Image)',
    modality: 'image',
    aspectRatios: ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9'],
    costNote: '~$0.04/image',
    sync: true,
  },
  {
    id: 'gemini-3-pro-image-preview',
    label: 'Nano Banana Pro (3 Pro Image)',
    modality: 'image',
    aspectRatios: ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'],
    costNote: 'higher — 1K/2K/4K',
    sync: true,
  },
];

const DEFAULT_MODEL = 'gemini-2.5-flash-image';

/** The subset of the Gemini generateContent response we read. */
interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
  error?: { message?: string };
}

/**
 * Build the request body — text prompt + optional source image (maskless edit,
 * Nano Banana's strength: the source is read into an `inlineData` part alongside
 * the text) + optional aspect config. Async because the source-asset read is
 * host-provided (ctx.readSourceAsset) so the adapter never touches the FS.
 */
async function buildBody(req: GenRequest, ctx: AdapterContext): Promise<unknown> {
  const parts: Array<Record<string, unknown>> = [];

  // Edit flow (Task 1.2): the source image goes FIRST, then the instruction text
  // (Gemini's documented image-editing order). Requires the host to have wired
  // readSourceAsset; a sourceAsset with no reader is a hard error (never a
  // silent text-only generation that ignores the requested edit).
  if (req.sourceAsset) {
    if (!ctx.readSourceAsset) {
      throw new Error('image editing requires source-asset access, which is not wired');
    }
    const src = await ctx.readSourceAsset(req.sourceAsset);
    if (!src) throw new Error(`source asset not found or unreadable: ${req.sourceAsset}`);
    if (!src.mime.startsWith('image/')) {
      throw new Error(`source asset is not an image (${src.mime}) — cannot edit`);
    }
    parts.push({
      inlineData: { mimeType: src.mime, data: Buffer.from(src.bytes).toString('base64') },
    });
  }

  if (req.prompt) parts.push({ text: req.prompt });

  const body: Record<string, unknown> = {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      responseModalities: ['IMAGE'],
      ...(req.aspectRatio ? { imageConfig: { aspectRatio: req.aspectRatio } } : {}),
    },
  };
  return body;
}

/** Resolve the model, defaulting when the request left it blank. */
function resolveModel(req: GenRequest): string {
  if (req.model && GEMINI_MODELS.some((m) => m.id === req.model)) return req.model;
  return DEFAULT_MODEL;
}

/** A sync Job wrapper — already resolved, so callers never branch on async. */
function doneJob(id: string, result: Promise<GenResult>): Job {
  let settledStatus: 'done' | 'failed' = 'done';
  const guarded = result.catch((err) => {
    settledStatus = 'failed';
    throw err;
  });
  return {
    id,
    status: () => settledStatus,
    async *events() {
      try {
        await guarded;
        yield { status: 'done' as const };
      } catch (err) {
        yield {
          status: 'failed' as const,
          message: err instanceof Error ? err.message : String(err),
        };
      }
    },
    result: () => guarded,
    cancel: () => {},
  };
}

export function createGeminiAdapter(ctx: AdapterContext): ProviderAdapter {
  async function runOnce(req: GenRequest): Promise<GenResult> {
    if (!ctx.apiKey) {
      throw new Error('no Google Gemini key configured — add one in Settings');
    }
    const model = resolveModel(req);
    const started = Date.now();
    // F2 — validate the outbound base (https + host allowlist) BEFORE the
    // key-bearing request, so a poisoned env can't redirect the BYOK key.
    assertSafeBase(GEMINI_API_BASE);
    const url = `${GEMINI_API_BASE}/models/${encodeURIComponent(model)}:generateContent`;

    // Build the body first (an edit flow reads the source asset host-side here).
    const requestBody = JSON.stringify(await buildBody(req, ctx));

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          // Key ONLY in the header — never the query string (redirect/log leak).
          'x-goog-api-key': ctx.apiKey,
        },
        body: requestBody,
        signal: ctx.signal ?? AbortSignal.timeout(120_000),
      });
    } catch (err) {
      throw new Error(`Gemini request failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    // F1 — bound the response before decode so an oversized upstream body can't
    // OOM-crash the shared server (saveAsset's cap only guards the disk write,
    // which is downstream of this full in-RAM allocation).
    let json: GeminiResponse | null = null;
    try {
      const text = await readTextCapped(res, MAX_RESPONSE_BYTES);
      json = JSON.parse(text) as GeminiResponse;
    } catch (err) {
      // A too-large body is a hard error; a parse failure on an error status
      // falls through to the status-based message below.
      if (err instanceof Error && /too large|exceeded/.test(err.message)) throw err;
      json = null;
    }
    if (!res.ok) {
      // Never surface the key; Gemini's own error message is safe to relay.
      const msg = json?.error?.message ?? `HTTP ${res.status}`;
      throw new Error(`Gemini error: ${msg}`);
    }
    if (json?.promptFeedback?.blockReason) {
      throw new Error(`Gemini blocked the prompt: ${json.promptFeedback.blockReason}`);
    }

    const parts = json?.candidates?.[0]?.content?.parts ?? [];
    const assets: GenAsset[] = [];
    for (const part of parts) {
      const inline = part.inlineData;
      if (inline?.data) {
        assets.push({
          kind: 'image',
          mime: inline.mimeType ?? 'image/png',
          bytes: new Uint8Array(Buffer.from(inline.data, 'base64')),
        });
      }
    }
    if (assets.length === 0) {
      throw new Error('Gemini returned no image (the model may have refused the prompt)');
    }

    return { assets, usage: { ms: Date.now() - started }, raw: json };
  }

  return {
    descriptor: GEMINI_DESCRIPTOR,
    async listModels() {
      return GEMINI_MODELS;
    },
    async submit(req: GenRequest): Promise<Job> {
      const id = `gen_${crypto.randomUUID()}`;
      // Sync provider — kick off the single call and wrap it in an already-
      // resolving Job so the queue treats it uniformly with async providers.
      return doneJob(id, runOnce(req));
    },
  };
}
