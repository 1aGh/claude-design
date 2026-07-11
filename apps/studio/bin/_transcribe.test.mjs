// _transcribe.test.mjs — the whisper.cpp JSON → word-timings parser (Phase 2).
// The spawn/model resolution is a soft-dep live gate; this covers the pure,
// deterministic parsing that turns whisper.cpp `-oj` output into CaptionWords
// (then captions.ts renders the SRT — covered in captions.test.ts).

import { describe, expect, test } from 'bun:test';

import { whisperJsonToWords } from './_transcribe.mjs';
import { wordsToSrt } from '../generation/captions.ts';

const WHISPER_JSON = JSON.stringify({
  transcription: [
    { offsets: { from: 0, to: 480 }, text: ' Hello' },
    { offsets: { from: 480, to: 900 }, text: ' there.' },
    { offsets: { from: 1200, to: 1800 }, text: ' Maude' },
    { offsets: { from: 0, to: 0 }, text: '   ' }, // blank → dropped
  ],
});

describe('whisperJsonToWords', () => {
  test('maps offsets (ms) to seconds and trims text', () => {
    const words = whisperJsonToWords(WHISPER_JSON);
    expect(words).toHaveLength(3);
    expect(words[0]).toEqual({ text: 'Hello', start: 0, end: 0.48 });
    expect(words[1]).toEqual({ text: 'there.', start: 0.48, end: 0.9 });
    expect(words[2].text).toBe('Maude');
  });

  test('feeds captions.ts to produce a valid SRT', () => {
    const srt = wordsToSrt(whisperJsonToWords(WHISPER_JSON));
    expect(srt).toContain('00:00:00,000 --> 00:00:00,900');
    expect(srt).toContain('Hello there.');
  });

  test('malformed / empty JSON yields no words (never throws)', () => {
    expect(whisperJsonToWords('not json')).toEqual([]);
    expect(whisperJsonToWords('{}')).toEqual([]);
    expect(whisperJsonToWords(JSON.stringify({ transcription: [] }))).toEqual([]);
  });

  test('tolerates missing offsets', () => {
    const words = whisperJsonToWords(JSON.stringify({ transcription: [{ text: 'x' }] }));
    expect(words).toEqual([{ text: 'x', start: 0, end: 0 }]);
  });
});
