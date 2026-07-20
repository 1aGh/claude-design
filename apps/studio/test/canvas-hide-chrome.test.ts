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
  const blockMatch = shellHtml.match(
    /<style id="canvas-hide-chrome"[^>]*>([\s\S]*?)<\/style>/
  );

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
