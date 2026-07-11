// footage/schema — validator + helper coverage (feature-footage-analysis-director).
// Mirrors the photo/schema house style: a valid fixture round-trips, and every
// rejection lane (unknown key / bad type / out-of-range / non-relative asset /
// end≤start / end>duration / bad transition presentation) is asserted so a
// crafted field can never reach disk via the `/_api/footage` route.

import { describe, expect, test } from 'bun:test';

import {
  AI_GENERATED_TAG,
  EDL_VERSION,
  type Edl,
  emptyFootageAnalysis,
  FOOTAGE_ANALYSIS_VERSION,
  type FootageAnalysis,
  generatedClipAnalysis,
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

  // feature-ai-media-generation Phase 2 — layered audio tracks + captions.
  test('accepts layered audioTracks (music/VO/SFX)', () => {
    const r = validateEdl({
      ...GOOD_EDL,
      audioTracks: [
        { asset: 'assets/aaaaaaaa.mp3', kind: 'music', gainDb: -12, fadeOutFrames: 30 },
        { asset: 'assets/bbbbbbbb.mp3', kind: 'voiceover', startFrame: 15, durationFrames: 90 },
        { asset: 'assets/cccccccc.mp3', kind: 'sfx', startFrame: 40, name: 'whoosh' },
      ],
    });
    expect(r).toEqual({ ok: true, errors: [] });
  });

  test('rejects an audio track with a bad kind / non-relative asset / out-of-range gain', () => {
    expect(
      validateEdl({ ...GOOD_EDL, audioTracks: [{ asset: 'assets/a.mp3', kind: 'bass' }] }).ok
    ).toBe(false);
    expect(validateEdl({ ...GOOD_EDL, audioTracks: [{ asset: 'http://x/a.mp3' }] }).ok).toBe(false);
    expect(
      validateEdl({ ...GOOD_EDL, audioTracks: [{ asset: 'assets/a.mp3', gainDb: 999 }] }).ok
    ).toBe(false);
    expect(validateEdl({ ...GOOD_EDL, audioTracks: [{ kind: 'music' }] }).ok).toBe(false); // asset required
  });

  test('accepts a captions track', () => {
    const r = validateEdl({
      ...GOOD_EDL,
      captions: {
        style: 'lower-third',
        cues: [
          { startSec: 0, endSec: 0.8, text: 'Hello there.' },
          { startSec: 1.0, endSec: 1.8, text: 'This is Maude.' },
        ],
      },
    });
    expect(r).toEqual({ ok: true, errors: [] });
  });

  test('rejects captions with a bad style, missing text, or non-array cues', () => {
    expect(validateEdl({ ...GOOD_EDL, captions: { style: 'sideways', cues: [] } }).ok).toBe(false);
    expect(validateEdl({ ...GOOD_EDL, captions: { cues: [{ startSec: 0, endSec: 1 }] } }).ok).toBe(
      false
    ); // text required
    expect(validateEdl({ ...GOOD_EDL, captions: { cues: 'nope' } }).ok).toBe(false);
  });

  test('rejects an unknown top-level key (audioTracks typo)', () => {
    expect(validateEdl({ ...GOOD_EDL, audioTrack: [] }).ok).toBe(false);
  });
});

describe('generatedClipAnalysis (Task 3.2 — AI-clip provenance stub)', () => {
  test('produces a VALID, empty-shots, ai-generated-tagged analysis', () => {
    const a = generatedClipAnalysis('assets/deadbeef.mp4', {
      provider: 'gemini',
      model: 'veo-3.1-generate-preview',
      prompt: 'a drone push over a mountain lake at dawn',
    });
    expect(validateFootageAnalysis(a)).toEqual({ ok: true, errors: [] });
    expect(a.asset).toBe('assets/deadbeef.mp4');
    // Empty shots ⇒ the reel's shot-aware cache still runs the analyst on it.
    expect(isEmptyAnalysis(a)).toBe(true);
    expect(a.tags).toContain(AI_GENERATED_TAG);
    expect(a.tags).toContain('gemini');
    expect(a.summary).toContain('mountain lake');
  });

  test('tolerates a missing prompt/provider and stays valid', () => {
    const a = generatedClipAnalysis('assets/abcd1234.webm');
    expect(validateFootageAnalysis(a)).toEqual({ ok: true, errors: [] });
    expect(a.tags).toEqual([AI_GENERATED_TAG]);
  });

  test('maps C0/C1 control chars and caps an oversized prompt under the summary limit', () => {
    const a = generatedClipAnalysis('assets/beadfeed.mp4', {
      provider: 'gemini',
      // C0 newline + C1 NEL (\u0085) must both collapse to a space — no fabricated lines.
      prompt: `injected  line\n\u0085next${'x'.repeat(8000)}`,
    });
    expect(validateFootageAnalysis(a).ok).toBe(true);
    expect(a.summary?.length ?? 0).toBeLessThanOrEqual(3901);
    // No C0 (0x00–0x1f) or C1 (0x7f–0x9f) control byte survives into the sidecar.
    expect(
      [...(a.summary ?? '')].some((c) => {
        const n = c.charCodeAt(0);
        return n <= 0x1f || (n >= 0x7f && n <= 0x9f);
      })
    ).toBe(false);
  });
});
