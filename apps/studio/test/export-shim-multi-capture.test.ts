// Regression guard for the multi-target capture position-restore bug
// (feature-background-export-notification-center, Phase A). Root cause: each
// per-artboard capture pinned the artboard's `left`/`top` inline style to
// `0px` for the screenshot/PDF/etc. crop but never restored it, so every
// artboard processed earlier in a `--multi` loop stayed stacked at the
// origin and bled into every subsequent target's clip region — the
// `canvas-as-separate` "scattered/overlapping fragments" bug.
//
// Confirmed fixed via a live repro against a real 22-artboard canvas (plan
// Task 26): the PDF export that previously didn't complete in 3+ minutes now
// finishes in ~10s with every page showing its own correct, isolated
// content. That run needs a real Chromium; this suite deliberately doesn't
// spawn one (mirrors `test/exporters/pw-launch.test.ts`: "the launch path
// itself is integration-shape... needs a real browser" — CI has none
// installed). So this guards the FIX SHAPE at the shim source level: a
// revert that drops the restore step (or reintroduces the old one-shot
// "zero every artboard up front" pattern) fails loud here instead of only
// showing up as a live-repro regression nobody runs by hand.

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const BIN_DIR = join(import.meta.dir, '..', 'bin');

function readShim(name: string): string {
  return readFileSync(join(BIN_DIR, name), 'utf8');
}

// The old bug pattern: zero EVERY `[data-dc-screen]` once, up front, before
// any per-target loop runs (no restore possible once every artboard shares
// the same reset).
const ONE_SHOT_RESET =
  /for \(const el of document\.querySelectorAll\(['"]\[data-dc-screen\]['"]\)\)/;

describe('export shims — multi-target position restore (scatter-bug regression)', () => {
  test('_png-playwright.mjs saves + restores each artboard around its own capture', () => {
    const src = readShim('_png-playwright.mjs');
    expect(src).toMatch(/const savedPos = await widenedHandle\.evaluate/);
    expect(src).toMatch(/ab\.style\.left = prev\.left;\s*\n\s*ab\.style\.top = prev\.top;/);
    expect(src).not.toMatch(ONE_SHOT_RESET);
  });

  test('_pdf-playwright.mjs saves + restores each artboard around its own capture', () => {
    const src = readShim('_pdf-playwright.mjs');
    expect(src).toMatch(/const savedPos = await handle\.evaluate/);
    expect(src).toMatch(/ab\.style\.left = prev\.left;\s*\n\s*ab\.style\.top = prev\.top;/);
    expect(src).not.toMatch(ONE_SHOT_RESET);
  });

  test('_svg-playwright.mjs pins + restores per-target via pinArtboard (not a one-shot reset)', () => {
    const src = readShim('_svg-playwright.mjs');
    expect(src).toMatch(/const pinArtboard = async/);
    expect(src).toMatch(/const restore = await pinArtboard\(handle\)/);
    expect(src).not.toMatch(ONE_SHOT_RESET);
  });

  test('_html-playwright.mjs pins + restores per-target via pinArtboard (not a one-shot reset)', () => {
    const src = readShim('_html-playwright.mjs');
    expect(src).toMatch(/const pinArtboard = async/);
    expect(src).toMatch(/const restore = await pinArtboard\(handle\)/);
    expect(src).not.toMatch(ONE_SHOT_RESET);
  });

  test('_pptx-playwright.mjs saves + restores position around its capture', () => {
    const src = readShim('_pptx-playwright.mjs');
    expect(src).toMatch(/const savedPos = await handle\.evaluate/);
    expect(src).toMatch(/ab\.style\.left = prev\.left;\s*\n\s*ab\.style\.top = prev\.top;/);
    expect(src).not.toMatch(ONE_SHOT_RESET);
  });

  test('multi-loops emit MAUDE_PROGRESS per artboard (the notification-center signal)', () => {
    for (const name of [
      '_png-playwright.mjs',
      '_pdf-playwright.mjs',
      '_svg-playwright.mjs',
      '_html-playwright.mjs',
    ]) {
      const src = readShim(name);
      expect(src).toContain('MAUDE_PROGRESS');
    }
  });
});
