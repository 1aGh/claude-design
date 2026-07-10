// footage/schema — validator + helper coverage (feature-footage-analysis-director).
// Mirrors the photo/schema house style: a valid fixture round-trips, and every
// rejection lane (unknown key / bad type / out-of-range / non-relative asset /
// end≤start / end>duration / bad transition presentation) is asserted so a
// crafted field can never reach disk via the `/_api/footage` route.

import { describe, expect, test } from 'bun:test';

import {
  EDL_VERSION,
  type Edl,
  emptyFootageAnalysis,
  FOOTAGE_ANALYSIS_VERSION,
  type FootageAnalysis,
  isEmptyAnalysis,
  validateEdl,
  validateFootageAnalysis,
} from './schema.ts';

const GOOD_ANALYSIS: FootageAnalysis = {
  version: FOOTAGE_ANALYSIS_VERSION,
  asset: 'assets/a1b2c3d4.mp4',
  durationSec: 12.5,
  width: 1920,
  height: 1080,
  keyframes: 12,
  shots: [
    {
      start: 0,
      end: 3.2,
      kind: 'establishing',
      motion: 'push-in',
      subject: 'drone push over the river',
      lighting: 'golden hour',
      mood: 'calm',
      quality: 0.9,
      usable: true,
      note: 'hero shot',
    },
    { start: 4, end: 6, kind: 'detail', usable: false },
  ],
  summary: 'Calm aspirational exterior b-roll.',
  tags: ['rebrand', 'exterior'],
};

const GOOD_EDL: Edl = {
  version: EDL_VERSION,
  title: 'Alligators rebrand reel',
  fps: 30,
  width: 1920,
  height: 1080,
  beats: [
    {
      clip: 'assets/a1b2c3d4.mp4',
      startSec: 0,
      durationFrames: 60,
      name: 'intro',
      transition: null,
    },
    {
      clip: 'assets/a1b2c3d4.mp4',
      startSec: 8,
      durationFrames: 45,
      why: 'second shot from the same clip',
      transition: { presentation: 'fade', frames: 15 },
      overlay: { kind: 'title', text: 'Alligators' },
      name: 'hero',
    },
  ],
  music: { asset: 'assets/deadbeef.mp3', fadeOutFrames: 20 },
};

describe('validateFootageAnalysis', () => {
  test('accepts a well-formed analysis', () => {
    expect(validateFootageAnalysis(GOOD_ANALYSIS)).toEqual({ ok: true, errors: [] });
  });

  test('accepts an empty analysis from the helper', () => {
    expect(validateFootageAnalysis(emptyFootageAnalysis('assets/a1b2c3d4.mp4')).ok).toBe(true);
  });

  test('rejects a non-object root', () => {
    expect(validateFootageAnalysis(null).ok).toBe(false);
    expect(validateFootageAnalysis(42).ok).toBe(false);
  });

  test('rejects an unknown top-level key', () => {
    const r = validateFootageAnalysis({ ...GOOD_ANALYSIS, evil: 1 });
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toContain('unknown key "evil"');
  });

  test('rejects a non-relative / traversing asset path', () => {
    for (const asset of ['/etc/passwd', '../secret.mp4', 'assets/../x.mp4', 'http://x/y.mp4']) {
      expect(validateFootageAnalysis({ ...GOOD_ANALYSIS, asset }).ok).toBe(false);
    }
  });

  test('rejects a shot whose end ≤ start', () => {
    const r = validateFootageAnalysis({
      ...GOOD_ANALYSIS,
      shots: [{ start: 5, end: 5 }],
    });
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toContain('end must be > start');
  });

  test('rejects a shot that runs past the clip duration', () => {
    const r = validateFootageAnalysis({
      ...GOOD_ANALYSIS,
      durationSec: 5,
      shots: [{ start: 1, end: 9 }],
    });
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toContain('exceeds clip duration');
  });

  test('rejects an out-of-range quality + bad shot kind', () => {
    expect(
      validateFootageAnalysis({ ...GOOD_ANALYSIS, shots: [{ start: 0, end: 1, quality: 2 }] }).ok
    ).toBe(false);
    expect(
      validateFootageAnalysis({ ...GOOD_ANALYSIS, shots: [{ start: 0, end: 1, kind: 'nope' }] }).ok
    ).toBe(false);
  });
});

describe('isEmptyAnalysis', () => {
  test('true for null / no shots / no usable shots', () => {
    expect(isEmptyAnalysis(null)).toBe(true);
    expect(isEmptyAnalysis({ shots: [] })).toBe(true);
    expect(isEmptyAnalysis({ shots: [{ start: 0, end: 1, usable: false }] })).toBe(true);
  });
  test('false when at least one shot is usable', () => {
    expect(isEmptyAnalysis(GOOD_ANALYSIS)).toBe(false);
  });
});

describe('validateEdl', () => {
  test('accepts a well-formed EDL', () => {
    expect(validateEdl(GOOD_EDL)).toEqual({ ok: true, errors: [] });
  });

  test('rejects a beat with no clip', () => {
    const r = validateEdl({ ...GOOD_EDL, beats: [{ startSec: 0, durationFrames: 30 }] });
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toContain('clip');
  });

  test('rejects a non-relative beat clip', () => {
    expect(
      validateEdl({ ...GOOD_EDL, beats: [{ clip: '/x.mp4', startSec: 0, durationFrames: 30 }] }).ok
    ).toBe(false);
  });

  test('rejects durationFrames < 1 / non-integer', () => {
    expect(
      validateEdl({
        ...GOOD_EDL,
        beats: [{ clip: 'assets/a1b2c3d4.mp4', startSec: 0, durationFrames: 0 }],
      }).ok
    ).toBe(false);
    expect(
      validateEdl({
        ...GOOD_EDL,
        beats: [{ clip: 'assets/a1b2c3d4.mp4', startSec: 0, durationFrames: 12.5 }],
      }).ok
    ).toBe(false);
  });

  test('rejects an unbundled transition presentation', () => {
    const r = validateEdl({
      ...GOOD_EDL,
      beats: [
        {
          clip: 'assets/a1b2c3d4.mp4',
          startSec: 0,
          durationFrames: 30,
          transition: { presentation: 'dreamy-zoom', frames: 10 },
        },
      ],
    });
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toContain('presentation');
  });

  test('rejects an fps above 120 / below 1', () => {
    expect(validateEdl({ ...GOOD_EDL, fps: 999 }).ok).toBe(false);
    expect(validateEdl({ ...GOOD_EDL, fps: 0 }).ok).toBe(false);
  });

  test('rejects a music bed with a non-relative asset', () => {
    expect(validateEdl({ ...GOOD_EDL, music: { asset: 'http://x/y.mp3' } }).ok).toBe(false);
  });
});
