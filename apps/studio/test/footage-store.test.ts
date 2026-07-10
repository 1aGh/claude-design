// footage-store — round-trip + rejection coverage (feature-footage-analysis-director).
// Uses a real temp designRoot on disk (Bun.write/Bun.file). Mirrors the photo
// store's contract: valid analysis + EDL persist and read back; invalid input
// returns a discriminated {ok:false,status} (never throws); traversal params in
// the asset/slug are rejected by construction.

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Context } from '../context.ts';
import { assetSha8, createFootageStore, edlSlug } from '../footage-store.ts';

let root: string;
let store: ReturnType<typeof createFootageStore>;

beforeAll(() => {
  root = mkdtempSync(path.join(tmpdir(), 'footage-store-'));
  const designRoot = path.join(root, '.design');
  // Only the fields footage-store touches are needed.
  store = createFootageStore({ paths: { designRoot } } as unknown as Context);
});
afterAll(() => rmSync(root, { recursive: true, force: true }));

describe('assetSha8 / edlSlug extraction', () => {
  test('accepts the sha8 in every form', () => {
    for (const p of ['assets/a1b2c3d4.mp4', '/assets/a1b2c3d4.png', 'a1b2c3d4.mov', 'a1b2c3d4'])
      expect(assetSha8(p)).toBe('a1b2c3d4');
  });
  test('rejects traversal / non-hex', () => {
    for (const p of ['../x', 'assets/../x', 'not-hex!', '', null]) expect(assetSha8(p)).toBeNull();
  });
  test('slug accepts kebab, rejects traversal / dots', () => {
    expect(edlSlug('alligators-reel')).toBe('alligators-reel');
    for (const s of ['../evil', 'has.dot', 'UPPER', '/abs', '']) expect(edlSlug(s)).toBeNull();
  });
});

describe('analysis round-trip', () => {
  test('saves a valid analysis and reads it back', async () => {
    const res = await store.saveAnalysis('assets/a1b2c3d4.mp4', {
      asset: 'assets/a1b2c3d4.mp4',
      durationSec: 10,
      shots: [{ start: 0, end: 3, usable: true, quality: 0.8 }],
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.path).toBe('assets/a1b2c3d4.footage.json');
    const back = await store.getAnalysis('a1b2c3d4');
    expect(back?.shots?.[0].quality).toBe(0.8);
    expect(back?.version).toBe(1);
  });

  test('rejects an invalid analysis with a 400 (never throws)', async () => {
    const res = await store.saveAnalysis('assets/a1b2c3d4.mp4', { shots: [{ start: 5, end: 5 }] });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(400);
  });

  test('rejects a bad asset param with a 400', async () => {
    const res = await store.saveAnalysis('../evil', {});
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(400);
  });

  test('getAnalysis returns null for an absent sidecar', async () => {
    expect(await store.getAnalysis('ffffffff')).toBeNull();
  });
});

describe('EDL round-trip', () => {
  test('saves a valid EDL under <slug>.edl.json and reads it back', async () => {
    const res = await store.saveEdl('alligators-reel', {
      title: 'Reel',
      fps: 30,
      width: 1920,
      height: 1080,
      beats: [{ clip: 'assets/a1b2c3d4.mp4', startSec: 0, durationFrames: 60, name: 'intro' }],
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.path).toBe('alligators-reel.edl.json');
    const back = await store.getEdl('alligators-reel');
    expect(back?.beats?.[0].name).toBe('intro');
    expect(back?.version).toBe(1);
  });

  test('rejects an EDL with an unbundled transition', async () => {
    const res = await store.saveEdl('bad-reel', {
      beats: [
        {
          clip: 'assets/a1b2c3d4.mp4',
          startSec: 0,
          durationFrames: 30,
          transition: { presentation: 'zoom', frames: 5 },
        },
      ],
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(400);
  });
});
