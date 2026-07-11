// generation/captions.test.ts — word-timestamp → SRT/VTT + reflow (Phase 2).

import { describe, expect, test } from 'bun:test';

import { cuesToSrt, cuesToVtt, reflowWords, wordsToSrt, wordsToVtt } from './captions.ts';

const words = [
  { text: 'Hello', start: 0, end: 0.4 },
  { text: 'there.', start: 0.4, end: 0.8 },
  { text: 'This', start: 1.0, end: 1.2 },
  { text: 'is', start: 1.2, end: 1.3 },
  { text: 'Maude.', start: 1.3, end: 1.8 },
];

describe('reflowWords', () => {
  test('breaks on sentence-ending punctuation', () => {
    const cues = reflowWords(words);
    expect(cues).toHaveLength(2);
    expect(cues[0].text).toBe('Hello there.');
    expect(cues[1].text).toBe('This is Maude.');
    expect(cues[0].start).toBe(0);
    expect(cues[0].end).toBeCloseTo(0.8);
  });

  test('breaks on a silence gap', () => {
    const cues = reflowWords(
      [
        { text: 'one', start: 0, end: 0.2 },
        { text: 'two', start: 2.0, end: 2.2 }, // 1.8s gap > default 0.8
      ],
      { gapBreak: 0.8 }
    );
    expect(cues).toHaveLength(2);
  });

  test('breaks on max line length', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      text: `word${i}`,
      start: i * 0.1,
      end: i * 0.1 + 0.09,
    }));
    const cues = reflowWords(many, { maxChars: 20, maxDuration: 999, gapBreak: 999 });
    expect(cues.length).toBeGreaterThan(1);
    for (const c of cues) expect(c.text.length).toBeLessThanOrEqual(28); // maxChars + one overrun word
  });

  test('tolerates missing/NaN timings without throwing', () => {
    const cues = reflowWords([
      { text: 'a', start: Number.NaN, end: Number.NaN },
      { text: 'b.', start: 0.5, end: 0.7 },
    ]);
    expect(cues.length).toBeGreaterThanOrEqual(1);
  });
});

describe('SRT / VTT formatting', () => {
  test('wordsToSrt emits numbered cues with comma-millisecond timestamps', () => {
    const srt = wordsToSrt(words);
    expect(srt).toContain('1\n00:00:00,000 --> 00:00:00,800\nHello there.');
    expect(srt).toContain('2\n00:00:01,000 --> 00:00:01,800\nThis is Maude.');
  });

  test('wordsToVtt emits a WEBVTT header + dot-millisecond timestamps', () => {
    const vtt = wordsToVtt(words);
    expect(vtt.startsWith('WEBVTT\n')).toBe(true);
    expect(vtt).toContain('00:00:00.000 --> 00:00:00.800');
    expect(vtt).not.toContain(','); // VTT uses dots, never commas, in timestamps
  });

  test('timestamps roll over minutes and hours', () => {
    const srt = cuesToSrt([{ start: 3661.5, end: 3662.25, text: 'late' }]);
    expect(srt).toContain('01:01:01,500 --> 01:01:02,250');
  });

  test('cuesToVtt handles an empty list', () => {
    expect(cuesToVtt([])).toBe('WEBVTT\n\n\n');
  });
});
