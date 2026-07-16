// _smart-frames.test.mjs — the pure timestamp/tier logic behind
// `maude design smart-frames` (feature-scene-aware-keyframes). The ffmpeg/gemma
// spawns + Chromium delegate are soft-dep live gates covered by manual runs; this
// covers the deterministic math that decides WHICH frames get pulled.

import { describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  clipCandidates,
  mergeTimestamps,
  parseBeats,
  parseSceneCuts,
  readEnginePref,
  selectTier,
} from './_smart-frames.mjs';

describe('parseSceneCuts', () => {
  test('extracts pts_time values from ffmpeg showinfo stderr', () => {
    const stderr =
      'frame:0 pts_time:0.233333 ...\nframe:1 pts_time:6.533333 ...\nnoise pts_time:bad';
    expect(parseSceneCuts(stderr)).toEqual([0.233333, 6.533333]);
  });
  test('empty on no cuts', () => {
    expect(parseSceneCuts('nothing here')).toEqual([]);
  });
});

describe('parseBeats', () => {
  test('parses the TIME=<sec> format', () => {
    const t = 'TIME=0.5 | opener\nTIME=6.9 | run play\n';
    expect(parseBeats(t, 8).map((b) => b.t)).toEqual([0.5, 6.9]);
  });
  test('parses the M:SS format the small model tends to emit', () => {
    const t = '0:00 | game action\n0:06 | interview\n1:03 | reveal\n';
    const beats = parseBeats(t, 90);
    expect(beats.map((b) => b.t)).toEqual([0, 6, 63]);
    expect(beats[1].what).toBe('interview');
  });
  test('drops out-of-range beats', () => {
    expect(parseBeats('TIME=99 | too late', 8)).toEqual([]);
  });
});

describe('mergeTimestamps', () => {
  test('always includes the true first and last frame', () => {
    const ts = mergeTimestamps({ durationSec: 8, cuts: [], beats: [], maxFrames: 12 });
    expect(ts[0]).toBe(0);
    expect(ts[ts.length - 1]).toBeCloseTo(7.95, 2);
  });
  test('puts a frame just inside a shot at a cut (when not deduped against an endpoint)', () => {
    const ts = mergeTimestamps({ durationSec: 8, cuts: [0.233, 6.533], beats: [], maxFrames: 20 });
    // 6.583 = just after the 6.533 cut — clearly separated, survives dedup.
    expect(ts.some((t) => Math.abs(t - 6.583) < 0.01)).toBe(true);
    // 0.283 (just after the 0.233 cut) is within 0.4s of t=0, so dedup folds it into
    // the opening frame — same moment, correct behavior.
    expect(ts.filter((t) => t < 0.4)).toEqual([0]);
  });
  test('samples long shots more densely', () => {
    // one 8s shot, no cuts → midpoints added (gap>3 → floor(8/3)=2 extra)
    const ts = mergeTimestamps({ durationSec: 8, cuts: [], beats: [], maxFrames: 20 });
    expect(ts.length).toBeGreaterThanOrEqual(4);
  });
  test('dedups within 0.4s', () => {
    const ts = mergeTimestamps({ durationSec: 8, cuts: [], beats: [{ t: 0.1, what: '' }, { t: 0.2, what: '' }], maxFrames: 20 });
    // 0, 0.05(inside), 0.1, 0.2 all within 0.4 → collapse toward the earliest kept
    const near0 = ts.filter((t) => t < 0.4);
    expect(near0.length).toBe(1);
  });
  test('caps to maxFrames with an even spread', () => {
    const beats = Array.from({ length: 40 }, (_, i) => ({ t: (i * 8) / 40, what: '' }));
    const ts = mergeTimestamps({ durationSec: 8, cuts: [], beats, maxFrames: 6 });
    expect(ts.length).toBeLessThanOrEqual(6);
    expect(ts[0]).toBe(0);
  });
});

describe('selectTier', () => {
  const gemmaReady = { ffmpeg: true, mlxPython: 'python3' };
  const ffmpegOnly = { ffmpeg: true, mlxPython: null };
  const bare = { ffmpeg: false, mlxPython: null };

  test('auto degrades gemma → ffmpeg → blind', () => {
    expect(selectTier('auto', gemmaReady)).toBe('gemma');
    expect(selectTier('auto', ffmpegOnly)).toBe('ffmpeg');
    expect(selectTier('auto', bare)).toBe('blind');
  });
  test('explicit engine errors when its deps are missing (no silent downgrade)', () => {
    expect(() => selectTier('gemma', ffmpegOnly)).toThrow(/mlx-vlm/);
    expect(() => selectTier('ffmpeg', bare)).toThrow(/ffmpeg/);
  });
  test('blind is always allowed', () => {
    expect(selectTier('blind', bare)).toBe('blind');
  });
});

describe('clipCandidates', () => {
  test('tries raw, root-relative, and designRoot/assets locations', () => {
    const c = clipCandidates('assets/abc12345.mp4', '/repo', '.design');
    expect(c).toContain('assets/abc12345.mp4');
    expect(c).toContain('/repo/assets/abc12345.mp4');
    expect(c).toContain('/repo/.design/assets/abc12345.mp4');
  });
  test('bare filename resolves under designRoot/assets', () => {
    const c = clipCandidates('abc12345.mp4', '/repo', '.design');
    expect(c).toContain('/repo/.design/assets/abc12345.mp4');
  });
});

describe('readEnginePref', () => {
  function repoWith(config) {
    const root = mkdtempSync(join(tmpdir(), 'maude-sf-'));
    mkdirSync(join(root, '.design'), { recursive: true });
    if (config !== undefined)
      writeFileSync(join(root, '.design', 'config.json'), JSON.stringify(config));
    return root;
  }
  test('reads generation.keyframes.engine when present', () => {
    const root = repoWith({ generation: { keyframes: { engine: 'ffmpeg' } } });
    expect(readEnginePref(root)).toBe('ffmpeg');
  });
  test('null when absent / no config / no root (terminal self-detect path)', () => {
    expect(readEnginePref(repoWith({}))).toBeNull();
    expect(readEnginePref(repoWith(undefined))).toBeNull();
    expect(readEnginePref(null)).toBeNull();
  });
  test('null on an invalid engine value', () => {
    const root = repoWith({ generation: { keyframes: { engine: 'nonsense' } } });
    expect(readEnginePref(root)).toBeNull();
  });
});
