// photo-taxonomy.test.ts — regression guard for the DDR-115 "three lists must
// agree" invariant, extended to the new `assets/<sha8>.photo.json` PhotoEdit
// sidecar (feature-photo-editor, Task 3).
//
// The invariant: a VERSIONED path must be classified VERSIONED by ALL THREE
// lists that encode the taxonomy —
//   (1) apps/studio/git/service.ts  → `isMaudeRuntimeState` (panel backstop),
//   (2) cli/lib/gitignore-block.mjs → `buildBlock` (the `maude init` template),
//   (3) the repo root `.gitignore`  → tested via `git check-ignore` ground truth.
// `assets/**` (binaries AND `.photo.json` sidecars) is VERSIONED, so none of the
// three may hide it. This is the automated form of DDR-115 §3's manual claim.

import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';

import { buildBlock } from '../../../cli/lib/gitignore-block.mjs';
import { __testing } from '../git/service.ts';

const { isMaudeRuntimeState } = __testing;

// Representative content-addressed paths under `assets/`.
const PHOTO_SIDECAR_REL = 'assets/ab12cd34.photo.json';
const PHOTO_SIDECAR_DESIGN = '.design/assets/ab12cd34.photo.json';
const ASSET_BINARY_DESIGN = '.design/assets/ab12cd34.png';
const MATTE_ASSET_DESIGN = '.design/assets/ff00aa99.png';

describe('DDR-115 taxonomy — assets/<sha8>.photo.json is VERSIONED', () => {
  test('isMaudeRuntimeState does NOT classify photo sidecars/assets as runtime', () => {
    expect(isMaudeRuntimeState(PHOTO_SIDECAR_REL)).toBe(false);
    expect(isMaudeRuntimeState(PHOTO_SIDECAR_DESIGN)).toBe(false);
    expect(isMaudeRuntimeState(ASSET_BINARY_DESIGN)).toBe(false);
    expect(isMaudeRuntimeState(MATTE_ASSET_DESIGN)).toBe(false);
  });

  // Positive control — proves the classifier's mechanism actually fires, so the
  // negatives above aren't passing for a trivial reason (e.g. a broken regex).
  test('isMaudeRuntimeState still classifies real runtime state as IGNORED', () => {
    expect(isMaudeRuntimeState('.design/_server.json')).toBe(true);
    expect(isMaudeRuntimeState('.design/_history/foo/bar.png')).toBe(true);
    expect(isMaudeRuntimeState('.design/_canvas-state/x.view.json')).toBe(true);
  });

  // `_photo/` (Task 18/20's headless bg-remove proof canvases, mirroring
  // `_draw/`'s draw-proof canvases) must agree as IGNORED across all three lists.
  test('_photo/ (headless bg-remove proof canvases) is IGNORED across all three lists', () => {
    expect(isMaudeRuntimeState('.design/_photo/smoke-tsx.bgremove.tsx')).toBe(true);

    const block = buildBlock('.design');
    expect(block).toContain('.design/_photo/');

    const top = spawnSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' });
    if (top.status !== 0) {
      console.warn('git rev-parse failed; skipping root .gitignore ground-truth check');
      return;
    }
    const root = top.stdout.trim();
    const r = spawnSync('git', ['check-ignore', '-q', '--', '.design/_photo/x.bgremove.tsx'], {
      cwd: root,
    });
    expect(r.status).toBe(0);
  });

  test('the gitignore-block template ignores no assets/ path', () => {
    for (const root of ['.design', 'design', 'mock']) {
      const block = buildBlock(root);
      // buildBlock only lists `${root}/_*` runtime prefixes — VERSIONED content
      // (assets, canvases, meta) is deliberately absent. A future editor adding
      // an `assets`/`.photo.json` ignore line trips this.
      expect(block).not.toContain('assets');
      expect(block).not.toContain('.photo.json');
    }
  });

  test('root .gitignore (git check-ignore ground truth) does not ignore photo assets', () => {
    const top = spawnSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' });
    if (top.status !== 0) {
      // Not in a git checkout (unexpected in CI/dev) — skip rather than false-fail.
      console.warn('git rev-parse failed; skipping root .gitignore ground-truth check');
      return;
    }
    const root = top.stdout.trim();

    const isIgnored = (relPath: string): boolean => {
      const r = spawnSync('git', ['check-ignore', '-q', '--', relPath], { cwd: root });
      // exit 0 = ignored, 1 = not ignored, other = error.
      return r.status === 0;
    };

    // VERSIONED assets must NOT be ignored by the repo's own .gitignore.
    expect(isIgnored(PHOTO_SIDECAR_DESIGN)).toBe(false);
    expect(isIgnored(ASSET_BINARY_DESIGN)).toBe(false);

    // Positive control — a known runtime path IS ignored, proving check-ignore works here.
    expect(isIgnored('.design/_server.json')).toBe(true);
  });
});
