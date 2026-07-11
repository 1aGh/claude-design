// generation/elevenlabs.test.ts — the ElevenLabs adapter proven per-capability
// against stubbed HTTP (no real key, no network). Audio verbs yield audio bytes;
// Scribe yields an SRT built from word timings.

import { afterEach, describe, expect, test } from 'bun:test';

import { createElevenLabsAdapter, parseHistory } from './adapters/elevenlabs.ts';
import { createAdapter, providersForModality } from './registry.ts';
import type { AdapterContext, GenRequest } from './types.ts';

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

function ctxWith(overrides: Partial<AdapterContext> = {}): AdapterContext {
  return {
    apiKey: 'sk-eleven-test',
    localize: async () => 'assets/stub.mp3',
    ...overrides,
  };
}

/** Capture the last request + return a canned response. */
function stub(makeRes: () => Response): { calls: Array<{ url: string; init: RequestInit }> } {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url: String(url), init });
    return makeRes();
  }) as typeof fetch;
  return { calls };
}

const MP3 = new Uint8Array([0xff, 0xfb, 0x90, 0x00, 1, 2, 3, 4]); // MP3 frame-sync-ish
function audioRes(): Response {
  return new Response(MP3, { status: 200, headers: { 'content-type': 'audio/mpeg' } });
}

async function firstAsset(adapter: ReturnType<typeof createElevenLabsAdapter>, req: GenRequest) {
  const job = await adapter.submit(req);
  const res = await job.result();
  return { job, res };
}

describe('elevenlabs audio', () => {
  test('music POSTs /v1/music and yields audio bytes', async () => {
    const { calls } = stub(audioRes);
    const { job, res } = await firstAsset(createElevenLabsAdapter(ctxWith()), {
      modality: 'audio',
      provider: 'elevenlabs',
      prompt: 'a warm lo-fi loop',
    });
    expect(job.status()).toBe('done');
    expect(calls[0].url).toContain('/v1/music');
    expect(res.assets[0].kind).toBe('audio');
    expect(res.assets[0].bytes?.byteLength).toBe(MP3.byteLength);
    // The key rides the header only, never the URL.
    expect(String(calls[0].init.headers['xi-api-key'])).toBe('sk-eleven-test');
    expect(calls[0].url).not.toContain('sk-eleven-test');
  });

  test('sfx POSTs /v1/sound-generation with a duration', async () => {
    const { calls } = stub(audioRes);
    await firstAsset(createElevenLabsAdapter(ctxWith()), {
      modality: 'audio',
      provider: 'elevenlabs',
      prompt: 'glass shatter',
      params: { audioKind: 'sfx', durationSeconds: 2 },
    });
    expect(calls[0].url).toContain('/v1/sound-generation');
    expect(JSON.parse(String(calls[0].init.body)).duration_seconds).toBe(2);
  });

  test('tts POSTs /v1/text-to-speech/{voice} and requires a voice_id', async () => {
    const { calls } = stub(audioRes);
    await firstAsset(createElevenLabsAdapter(ctxWith()), {
      modality: 'audio',
      provider: 'elevenlabs',
      prompt: 'Welcome to Maude',
      params: { audioKind: 'tts', voice_id: 'Rachel' },
    });
    expect(calls[0].url).toContain('/v1/text-to-speech/Rachel');

    const noVoice = createElevenLabsAdapter(ctxWith());
    const job = await noVoice.submit({
      modality: 'audio',
      provider: 'elevenlabs',
      prompt: 'x',
      params: { audioKind: 'tts' },
    });
    await expect(job.result()).rejects.toThrow(/voice_id/);
  });

  test('a missing key fails fast without a network call', async () => {
    let called = false;
    globalThis.fetch = (async () => {
      called = true;
      return audioRes();
    }) as typeof fetch;
    const job = await createElevenLabsAdapter(ctxWith({ apiKey: null })).submit({
      modality: 'audio',
      provider: 'elevenlabs',
      prompt: 'x',
    });
    await expect(job.result()).rejects.toThrow(/no ElevenLabs key/);
    expect(called).toBe(false);
  });

  test('an HTTP error surfaces the provider detail, never the key', async () => {
    stub(
      () =>
        new Response(JSON.stringify({ detail: { message: 'quota exceeded' } }), {
          status: 429,
          headers: { 'content-type': 'application/json' },
        })
    );
    const job = await createElevenLabsAdapter(ctxWith()).submit({
      modality: 'audio',
      provider: 'elevenlabs',
      prompt: 'x',
    });
    await expect(job.result()).rejects.toThrow(/quota exceeded/);
  });
});

describe('elevenlabs scribe (transcription)', () => {
  test('word timings become an SRT text asset', async () => {
    stub(
      () =>
        new Response(
          JSON.stringify({
            text: 'Hello there.',
            words: [
              { text: 'Hello', start: 0, end: 0.4, type: 'word' },
              { text: ' ', start: 0.4, end: 0.4, type: 'spacing' },
              { text: 'there.', start: 0.4, end: 0.8, type: 'word' },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
    );
    const adapter = createElevenLabsAdapter(
      ctxWith({
        readSourceAsset: async () => ({ bytes: new Uint8Array([1, 2, 3]), mime: 'audio/mpeg' }),
      })
    );
    const { res } = await firstAsset(adapter, {
      modality: 'transcription',
      provider: 'elevenlabs',
      sourceAsset: 'assets/deadbeef.mp3',
    });
    const asset = res.assets[0];
    expect(asset.kind).toBe('transcription');
    expect(asset.text).toContain('00:00:00,000 --> 00:00:00,800');
    expect(asset.text).toContain('Hello there.');
    // The spacing token is dropped, not emitted as a word.
    expect(asset.text).not.toContain('Hello  there');
  });

  test('transcription without a source asset fails', async () => {
    const job = await createElevenLabsAdapter(ctxWith()).submit({
      modality: 'transcription',
      provider: 'elevenlabs',
      sourceAsset: 'assets/deadbeef.mp3',
    });
    // no readSourceAsset wired → hard error
    await expect(job.result()).rejects.toThrow(/source-asset access/);
  });
});

describe('registry', () => {
  test('elevenlabs is registered for audio + transcription', () => {
    expect(providersForModality('audio').some((p) => p.id === 'elevenlabs')).toBe(true);
    expect(providersForModality('transcription').some((p) => p.id === 'elevenlabs')).toBe(true);
    const adapter = createAdapter('elevenlabs', ctxWith());
    expect(adapter.descriptor.id).toBe('elevenlabs');
  });
});

describe('elevenlabs history (Task 2.5 — reuse-before-you-pay)', () => {
  test('parseHistory maps items, drops id-less, converts date_unix → ISO', () => {
    const items = parseHistory({
      history: [
        { history_item_id: 'h1', text: 'warm lofi loop', voice_id: 'v1', date_unix: 1_700_000_000 },
        { text: 'no id — dropped' },
        { history_item_id: 'h2', text: 'sfx whoosh' },
      ],
    });
    expect(items.map((i) => i.id)).toEqual(['h1', 'h2']);
    expect(items[0].text).toBe('warm lofi loop');
    expect(items[0].voiceId).toBe('v1');
    expect(items[0].at).toBe(new Date(1_700_000_000 * 1000).toISOString());
    expect(items[1].at).toBeUndefined();
  });

  test('parseHistory tolerates an empty / missing history', () => {
    expect(parseHistory({})).toEqual([]);
    expect(parseHistory({ history: [] })).toEqual([]);
  });

  test('listHistory GETs /v1/history with the key in the header only', async () => {
    const { calls } = stub(
      () =>
        new Response(JSON.stringify({ history: [{ history_item_id: 'h1', text: 'x' }] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
    );
    const items = await createElevenLabsAdapter(ctxWith()).listHistory?.();
    expect(items?.[0].id).toBe('h1');
    expect(calls[0].url).toContain('/v1/history');
    expect(String(calls[0].init.headers['xi-api-key'])).toBe('sk-eleven-test');
    expect(calls[0].url).not.toContain('sk-eleven-test');
  });

  test('fetchHistoryAudio GETs the item audio and yields audio bytes', async () => {
    const { calls } = stub(audioRes);
    const asset = await createElevenLabsAdapter(ctxWith()).fetchHistoryAudio?.('h1');
    expect(asset?.kind).toBe('audio');
    expect(asset?.bytes?.byteLength).toBe(MP3.byteLength);
    expect(calls[0].url).toContain('/v1/history/h1/audio');
  });
});
