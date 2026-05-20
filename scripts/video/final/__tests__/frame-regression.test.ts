/**
 * Golden-frame regression. For each <Composition> registered in Root.tsx,
 * renders first / middle / last frame to PNG, diffs against goldens, fails
 * if more than THRESHOLD_PCT pixels differ.
 *
 * Run modes:
 *   bun run goldens:check        -> diff vs goldens, fail on regression
 *   bun run goldens:update       -> overwrite goldens with current renders
 *                                   (do this AFTER intentional visual changes)
 *
 * Threshold rationale: pixelmatch uses 0.1 per-pixel sensitivity (default).
 * THRESHOLD_PCT caps how many flagged pixels we accept per frame — 0.5% absorbs
 * font anti-aliasing noise without missing real DS-token shifts.
 *
 * One bundle is built per test run (~5s) and shared across all frames.
 * Per-frame renderStill is fast (~200ms).
 */

import { beforeAll, describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const GOLDENS_DIR = path.join(import.meta.dir, '..', '__goldens__');
const DIFF_DIR = path.join(GOLDENS_DIR, '.diff');
const THRESHOLD_PCT = 0.5;
const UPDATE_MODE = process.env.GOLDEN_UPDATE === '1';

// Scenes to cover. Keep in sync with Root.tsx — TODO: auto-discover via
// selectComposition listing once Remotion exposes that.
const COMPOSITION_IDS = [
  'scene-00-placeholder',
  'SmokeCard',
  'scene-01-intro',
  'scene-02-content',
  'scene-03-outro',
  'Demo',
];

const FRAME_LABELS = ['first', 'middle', 'last'] as const;
type FrameLabel = (typeof FRAME_LABELS)[number];

let serveUrl: string;

beforeAll(async () => {
  if (!existsSync(GOLDENS_DIR)) mkdirSync(GOLDENS_DIR, { recursive: true });
  if (!existsSync(DIFF_DIR)) mkdirSync(DIFF_DIR, { recursive: true });
  serveUrl = await bundle({
    entryPoint: path.join(import.meta.dir, '..', 'src', 'index.ts'),
    onProgress: () => undefined,
  });
});

const pickFrame = (durationInFrames: number, label: FrameLabel): number => {
  if (label === 'first') return 0;
  if (label === 'last') return Math.max(0, durationInFrames - 1);
  return Math.floor(durationInFrames / 2);
};

describe('frame regression', () => {
  for (const compId of COMPOSITION_IDS) {
    for (const label of FRAME_LABELS) {
      test(`${compId} @ ${label}`, async () => {
        const composition = await selectComposition({ serveUrl, id: compId });
        const frame = pickFrame(composition.durationInFrames, label);

        const outPath = path.join(DIFF_DIR, `${compId}-${label}.png`);
        await renderStill({
          composition,
          frame,
          output: outPath,
          serveUrl,
        });

        const goldenPath = path.join(GOLDENS_DIR, `${compId}-${label}.png`);

        if (UPDATE_MODE || !existsSync(goldenPath)) {
          writeFileSync(goldenPath, readFileSync(outPath));
          console.log(`${UPDATE_MODE ? 'updated' : 'created'} golden ${compId}-${label}.png`);
          return;
        }

        const golden = PNG.sync.read(readFileSync(goldenPath));
        const actual = PNG.sync.read(readFileSync(outPath));
        expect(actual.width).toBe(golden.width);
        expect(actual.height).toBe(golden.height);

        const diff = new PNG({ width: golden.width, height: golden.height });
        const mismatched = pixelmatch(
          golden.data,
          actual.data,
          diff.data,
          golden.width,
          golden.height,
          { threshold: 0.1 }
        );
        const pct = (mismatched / (golden.width * golden.height)) * 100;

        if (pct >= THRESHOLD_PCT) {
          const diffPath = path.join(DIFF_DIR, `${compId}-${label}.diff.png`);
          writeFileSync(diffPath, PNG.sync.write(diff));
          throw new Error(
            `${compId} @ ${label}: ${pct.toFixed(2)}% pixels differ (threshold ${THRESHOLD_PCT}%). Diff written to ${diffPath}.`
          );
        }
      }, 60_000);
    }
  }
});
