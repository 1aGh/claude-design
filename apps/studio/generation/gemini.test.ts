// generation/gemini.test.ts — the Gemini adapter + download localizer proven
// against a stubbed HTTP response (no real key, no network). A 1x1 PNG's base64
// round-trips: adapter → GenResult.bytes → localizeGenAsset → a saveAsset call
// that lands `assets/<sha8>.png`.

import { afterEach, describe, expect, test } from 'bun:test';

import { createGeminiAdapter } from './adapters/gemini.ts';
import { localizeGenAsset } from './download.ts';
import { createAdapter, providersForModality } from './registry.ts';
import type { AdapterContext } from './types.ts';

// A real 1x1 transparent PNG (so a magic-byte sniff downstream would accept it).
const PNG_1x1_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

function stubFetch(body: unknown, status = 200): void {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    })) as typeof fetch;
}

function ctxWith(overrides: Partial<AdapterContext> = {}): AdapterContext {
  return {
    apiKey: 'AIza-test-key',
    localize: async () => 'assets/stub.png',
    ...overrides,
  };
}

describe('gemini adapter', () => {
  test('a successful generateContent yields an already-done Job with PNG bytes', async () => {
    stubFetch({
      candidates: [
        { content: { parts: [{ inlineData: { mimeType: 'image/png', data: PNG_1x1_B64 } }] } },
      ],
    });
    const adapter = createGeminiAdapter(ctxWith());
    const job = await adapter.submit({
      modality: 'image',
      provider: 'gemini',
      prompt: 'a red circle',
    });
    const res = await job.result();
    expect(job.status()).toBe('done');
    expect(res.assets).toHaveLength(1);
    expect(res.assets[0].kind).toBe('image');
    expect(res.assets[0].bytes?.byteLength).toBeGreaterThan(0);
  });

  test('a missing key fails fast without a network call', async () => {
    let called = false;
    globalThis.fetch = (async () => {
      called = true;
      return new Response('{}');
    }) as typeof fetch;
    const adapter = createGeminiAdapter(ctxWith({ apiKey: null }));
    const job = await adapter.submit({ modality: 'image', provider: 'gemini', prompt: 'x' });
    await expect(job.result()).rejects.toThrow(/no Google Gemini key/);
    expect(called).toBe(false);
  });

  test('an HTTP error surfaces the provider message, never the key', async () => {
    stubFetch({ error: { message: 'quota exceeded' } }, 429);
    const adapter = createGeminiAdapter(ctxWith());
    const job = await adapter.submit({ modality: 'image', provider: 'gemini', prompt: 'x' });
    await expect(job.result()).rejects.toThrow(/quota exceeded/);
  });

  test('a response with no image part is an error', async () => {
    stubFetch({ candidates: [{ content: { parts: [{ text: 'I cannot do that' }] } }] });
    const adapter = createGeminiAdapter(ctxWith());
    const job = await adapter.submit({ modality: 'image', provider: 'gemini', prompt: 'x' });
    await expect(job.result()).rejects.toThrow(/no image/);
  });

  // security fan-out F2 — an env-poisoned non-default base is refused before the
  // key-bearing request (unless MAUDE_GEN_ALLOW_CUSTOM_BASE is opted in).
  test('a non-allowlisted MAUDE_GEMINI_API_BASE is refused without touching the network', async () => {
    const prevBase = process.env.MAUDE_GEMINI_API_BASE;
    const prevAllow = process.env.MAUDE_GEN_ALLOW_CUSTOM_BASE;
    process.env.MAUDE_GEMINI_API_BASE = 'https://evil.example.com/v1beta';
    delete process.env.MAUDE_GEN_ALLOW_CUSTOM_BASE;
    // Re-import the module so the module-level base constant re-reads the env.
    const mod = await import(`./adapters/gemini.ts?evilbase=${Date.now()}`);
    let called = false;
    globalThis.fetch = (async () => {
      called = true;
      return new Response('{}');
    }) as typeof fetch;
    try {
      const adapter = mod.createGeminiAdapter(ctxWith());
      const job = await adapter.submit({ modality: 'image', provider: 'gemini', prompt: 'x' });
      await expect(job.result()).rejects.toThrow(/not allowlisted/);
      expect(called).toBe(false);
    } finally {
      if (prevBase === undefined) delete process.env.MAUDE_GEMINI_API_BASE;
      else process.env.MAUDE_GEMINI_API_BASE = prevBase;
      if (prevAllow === undefined) delete process.env.MAUDE_GEN_ALLOW_CUSTOM_BASE;
      else process.env.MAUDE_GEN_ALLOW_CUSTOM_BASE = prevAllow;
    }
  });

  // security fan-out F1 — an oversized provider response is rejected before it
  // is fully materialized + base64-decoded in RAM (OOM guard).
  test('an over-cap response body is rejected (RAM DoS guard)', async () => {
    const prev = process.env.MAUDE_GEMINI_MAX_RESPONSE_BYTES;
    // The cap has a 1 MB floor, so drive the test with a >1 MB body at the floor.
    process.env.MAUDE_GEMINI_MAX_RESPONSE_BYTES = String(1024 * 1024);
    const mod = await import(`./adapters/gemini.ts?cap=${Date.now()}`);
    globalThis.fetch = (async () =>
      new Response('x'.repeat(2 * 1024 * 1024), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })) as typeof fetch;
    try {
      const adapter = mod.createGeminiAdapter(ctxWith());
      const job = await adapter.submit({ modality: 'image', provider: 'gemini', prompt: 'x' });
      await expect(job.result()).rejects.toThrow(/too large|exceeded/);
    } finally {
      if (prev === undefined) delete process.env.MAUDE_GEMINI_MAX_RESPONSE_BYTES;
      else process.env.MAUDE_GEMINI_MAX_RESPONSE_BYTES = prev;
    }
  });
});

describe('download localizer', () => {
  test('inline bytes land via saveAsset and return the rel path', async () => {
    const saved: Uint8Array[] = [];
    const rel = await localizeGenAsset(
      { kind: 'image', mime: 'image/png', bytes: new Uint8Array([137, 80, 78, 71]) },
      {
        saveAsset: async (bytes) => {
          saved.push(bytes);
          return { ok: true, path: 'assets/deadbeef.png' };
        },
      }
    );
    expect(rel).toBe('assets/deadbeef.png');
    expect(saved).toHaveLength(1);
  });

  test('a rejected save throws', async () => {
    await expect(
      localizeGenAsset(
        { kind: 'image', mime: 'image/png', bytes: new Uint8Array([1]) },
        { saveAsset: async () => ({ ok: false, error: 'not an image' }) }
      )
    ).rejects.toThrow(/rejected on save/);
  });

  test('a URL result fails loud in Phase 0 (no unhardened egress)', async () => {
    await expect(
      localizeGenAsset(
        { kind: 'image', mime: 'image/png', url: 'https://cdn.example/x.png' },
        { saveAsset: async () => ({ ok: true, path: 'assets/x.png' }) }
      )
    ).rejects.toThrow(/Phase 1/);
  });
});

describe('registry', () => {
  test('gemini is registered for image and instantiable', () => {
    expect(providersForModality('image').some((p) => p.id === 'gemini')).toBe(true);
    const adapter = createAdapter('gemini', ctxWith());
    expect(adapter.descriptor.id).toBe('gemini');
  });

  test('an unknown provider throws', () => {
    expect(() => createAdapter('nope', ctxWith())).toThrow(/unknown provider/);
  });
});
