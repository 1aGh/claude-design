// groq.test.ts — Groq Whisper STT adapter (Task 2.6). Covers the pure
// verbose_json → CaptionWord[] normalization (word + segment fallback), the
// descriptor's transcription-only capability, and the submit guard that rejects
// a non-transcription modality. The network call itself is a live-key gate.

import { describe, expect, test } from 'bun:test';

import { wordsToSrt } from '../captions.ts';
import type { AdapterContext } from '../types.ts';
import { createGroqAdapter, GROQ_DESCRIPTOR, GROQ_MODELS, groqVerboseToWords } from './groq.ts';

const ctx: AdapterContext = {
  apiKey: 'test-key',
  localize: async () => 'assets/00000000.mp3',
  readSourceAsset: async () => ({ bytes: new Uint8Array([1, 2, 3]), mime: 'audio/mpeg' }),
};

describe('groqVerboseToWords', () => {
  test('maps per-word timings (seconds) and trims text', () => {
    const words = groqVerboseToWords({
      words: [
        { word: ' Hello', start: 0, end: 0.4 },
        { word: 'there.', start: 0.4, end: 0.9 },
        { word: '   ', start: 1, end: 1 }, // blank → dropped
      ],
    });
    expect(words).toHaveLength(2);
    expect(words[0]).toEqual({ text: 'Hello', start: 0, end: 0.4 });
    expect(words[1].text).toBe('there.');
  });

  test('falls back to per-segment timings when word granularity is absent', () => {
    const words = groqVerboseToWords({
      segments: [{ text: ' A whole segment ', start: 2, end: 4 }],
    });
    expect(words).toEqual([{ text: 'A whole segment', start: 2, end: 4 }]);
  });

  test('feeds captions.ts to produce a valid SRT', () => {
    const srt = wordsToSrt(
      groqVerboseToWords({
        words: [
          { word: 'Hello', start: 0, end: 0.4 },
          { word: 'world.', start: 0.4, end: 0.9 },
        ],
      })
    );
    expect(srt).toContain('00:00:00,000 --> 00:00:00,900');
    expect(srt).toContain('Hello world.');
  });

  test('empty input yields no words (never throws)', () => {
    expect(groqVerboseToWords({})).toEqual([]);
    expect(groqVerboseToWords({ words: [] })).toEqual([]);
  });
});

describe('GROQ_DESCRIPTOR', () => {
  test('is a cloud, api-key, transcription-only provider', () => {
    expect(GROQ_DESCRIPTOR.id).toBe('groq');
    expect(GROQ_DESCRIPTOR.kind).toBe('cloud');
    expect(GROQ_DESCRIPTOR.auth).toBe('api-key');
    expect(GROQ_DESCRIPTOR.modalities).toEqual(['transcription']);
    expect(GROQ_MODELS.every((m) => m.modality === 'transcription')).toBe(true);
  });
});

describe('createGroqAdapter.submit', () => {
  test('rejects a non-transcription modality without a network call', async () => {
    const adapter = createGroqAdapter(ctx);
    const job = await adapter.submit({ modality: 'image', provider: 'groq', prompt: 'x' });
    await expect(job.result()).rejects.toThrow(/only supports transcription/);
  });

  test('transcription requires a sourceAsset', async () => {
    const adapter = createGroqAdapter({ ...ctx, readSourceAsset: undefined });
    const job = await adapter.submit({ modality: 'transcription', provider: 'groq' });
    await expect(job.result()).rejects.toThrow(/sourceAsset/);
  });
});
