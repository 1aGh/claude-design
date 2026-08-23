// canvas-hide-chrome.test.ts — regression guard for RCA
// issue-pdf-print-export-marks-missing (Bug A). `_shell.html`'s
// `#canvas-hide-chrome` style block is the sanctioned "never leaks into an
// export" list every exporter relies on (`?hide-chrome=1` flips it from
// `media="not all"` to `media="all"` — see exporters/index.ts
// canvasShellUrl()). `.dc-artboard-guides` (the print bleed/trim/margin guide
// overlay, artboard-guides-overlay.tsx) was never added to this list when
// feature-2-print-artboards shipped, so it rendered straight into every PDF/
// PNG/SVG capture whenever a canvas had it toggled on. Grep-based, mirrors
// shell-importmap.test.ts's own style for the same file.

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { CAPTURE_HIDDEN_SELECTORS } from '../exporters/capture-chrome.ts';
import { DEV_SERVER_ROOT } from '../paths.ts';

const SHELL_HTML_PATH = join(
  DEV_SERVER_ROOT,
  '..',
  '..',
  'plugins',
  'design',
  'templates',
  '_shell.html'
);

describe('_shell.html #canvas-hide-chrome covers every overlay mount class', () => {
  const shellHtml = readFileSync(SHELL_HTML_PATH, 'utf8');
  const blockMatch = shellHtml.match(/<style id="canvas-hide-chrome"[^>]*>([\s\S]*?)<\/style>/);

  test('the #canvas-hide-chrome style block exists', () => {
    expect(blockMatch).not.toBeNull();
  });

  const block = blockMatch?.[1] ?? '';

  // Every editor-chrome overlay class that must never leak into a capture
  // render. `.dc-artboard-guides` is the one this RCA adds; the rest already
  // guard against the same class of regression for their own overlays.
  const REQUIRED_SELECTORS = [
    '.dc-mm',
    '.dc-tool-palette',
    '.dc-participants',
    '.dc-cv-halo',
    '.dc-snap-guide',
    '.dc-annot-svg',
    '.cm-layer',
    '.dc-artboard-label',
    '.dc-artboard-guides',
  ];

  for (const selector of REQUIRED_SELECTORS) {
    test(`"${selector}" is hidden during capture`, () => {
      expect(block.includes(selector)).toBe(true);
    });
  }
});

// DDR-231 Phase 2 T2 — the SECOND consumer. The browser lane captures the live
// canvas (it never navigates to `?hide-chrome=1`), so it applies the same
// suppression from `exporters/capture-chrome.ts`. Two copies of a selector list
// drift; this is the tripwire that makes them fail loudly instead. Same shape
// as the `isMaudeRuntimeState` / `isRuntimeStateRel` agreement pin.
describe('capture-chrome.ts agrees with the _shell.html block', () => {
  const shellHtml = readFileSync(SHELL_HTML_PATH, 'utf8');
  const block =
    shellHtml.match(/<style id="canvas-hide-chrome"[^>]*>([\s\S]*?)<\/style>/)?.[1] ?? '';

  /** Selectors declared in the shell's style block, comments stripped. */
  const shellSelectors = block
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{[\s\S]*$/, '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  test('every shell selector is in CAPTURE_HIDDEN_SELECTORS', () => {
    const ours = new Set(CAPTURE_HIDDEN_SELECTORS);
    expect(shellSelectors.filter((s) => !ours.has(s))).toEqual([]);
  });

  test('every CAPTURE_HIDDEN_SELECTORS entry is in the shell block', () => {
    const theirs = new Set(shellSelectors);
    expect(CAPTURE_HIDDEN_SELECTORS.filter((s) => !theirs.has(s))).toEqual([]);
  });
});
