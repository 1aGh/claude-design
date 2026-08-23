// capture-chrome.ts — the ONE list of editor-chrome selectors an export must
// never carry (DDR-231 Phase 2 T2).
//
// `_shell.html` has owned this list since the print-marks RCA, as the
// `<style id="canvas-hide-chrome" media="not all">` block that `?hide-chrome=1`
// flips to `media="all"`. That works for every host that NAVIGATES to the shell
// — the desktop / render-worker playwright spine does exactly that.
//
// The browser lane does not navigate: it captures the LIVE canvas the member is
// looking at, where the block is still `media="not all"` and every overlay is
// visible by design. The first cloud export shipped the artboard's own
// `.dc-artboard-label` header straight into the SVG because of it.
//
// So the list needs a second consumer, and a list with two consumers drifts —
// this file is the shared source, and `test/canvas-hide-chrome.test.ts` is the
// tripwire that fails the moment it and the `_shell.html` block disagree in
// either direction. Add a new overlay in ONE place and the test tells you the
// other.
//
// Pure data + a DOM helper — no Node imports (this file bundles for the
// browser through capture-core).

/**
 * Every editor-affordance selector suppressed during a capture. Kept in the
 * same order and grouping as the `_shell.html` block so a diff of the two
 * reads side by side.
 */
export const CAPTURE_HIDDEN_SELECTORS: readonly string[] = [
  // Minimap + zoom + tool palette (and its portaled popovers)
  '.dc-mm',
  '.dc-zoom-tb',
  '.dc-tool-palette',
  '.dc-tp-popover',
  '.dc-tp-shape-popover',
  '.dc-context-menu',
  // Presence — avatars (top-right) + live cursors
  '.dc-participants',
  '.dc-cursor-overlay',
  // Selection + manipulation chrome
  '.dc-cv-halo',
  '.dc-cv-group-bbox',
  '.dc-cv-eq-spacing-layer',
  '.dc-multi-artboard-tb',
  '.dc-elem-ctx-tb',
  '.dc-snap-guide',
  '.dc-snap-pill',
  // Annotations (FigJam-style draw layer)
  '.dc-annot-svg',
  '.dc-annot-ctx',
  '.dc-annot-resize-handle',
  // Comments — pins, threads, composer, @mention popup
  '.cm-layer',
  '.cm-pin',
  '.cm-thread',
  '.cm-composer',
  '.cm-mention-popup',
  // Inspector pin overlay injected into every served shell (inspect.ts)
  '.dgn-pin',
  '#dgn-pin-layer',
  // HUDs + banners
  '.dc-ai-banner',
  '.dc-undo-hud',
  // Activity overlay — live "agent works here" chrome (Phase 13 / DDR-029)
  '.dc-activity-rim',
  // HMR "holding last good" toast (Phase 13.1 / DDR-077)
  '.dc-hmr-holding',
  // Artboard title/label button (editor affordance, not design content)
  '.dc-artboard-label',
  // Print/bleed/trim/margin guide overlay (feature-2-print-artboards)
  '.dc-artboard-guides',
  // Generic opt-in hooks for any future floating overlay
  '[data-dc-overlay]',
  '[data-mdcc-annotations]',
];

/** The CSS rule body both hosts apply. */
export function captureChromeCss(): string {
  return `${CAPTURE_HIDDEN_SELECTORS.join(',')}{display:none !important}`;
}

const STYLE_ID = 'maude-capture-chrome';

/**
 * Hide editor chrome for the duration of a capture and return the undo.
 *
 * Idempotent and ref-counted: a multi-artboard capture calls this once per
 * target through {@link import('./capture-core.ts').svgForElement}, and nesting
 * (the shim host navigates with `?hide-chrome=1` AND runs this) must not leave
 * a half-removed style behind. The live-canvas host MUST call the returned undo
 * — the member is looking at this DOM.
 */
export function applyCaptureChrome(doc: Document): () => void {
  const existing = doc.getElementById(STYLE_ID) as (HTMLStyleElement & { _refs?: number }) | null;
  if (existing) {
    existing._refs = (existing._refs ?? 1) + 1;
    return () => releaseCaptureChrome(doc);
  }
  const style = doc.createElement('style') as HTMLStyleElement & { _refs?: number };
  style.id = STYLE_ID;
  style._refs = 1;
  style.textContent = captureChromeCss();
  (doc.head ?? doc.documentElement).appendChild(style);
  return () => releaseCaptureChrome(doc);
}

function releaseCaptureChrome(doc: Document): void {
  const style = doc.getElementById(STYLE_ID) as (HTMLStyleElement & { _refs?: number }) | null;
  if (!style) return;
  style._refs = (style._refs ?? 1) - 1;
  if (style._refs <= 0) style.remove();
}
