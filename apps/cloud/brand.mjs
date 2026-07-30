// Maude Cloud wears the Maude design system — Cloud Phase 22.
//
// The cloud pages were built on `system-ui` and a couple of hand-picked greys,
// which is exactly the thing this project's own rules forbid: when a project
// has a design system, that system IS the spec. These pages are the first
// thing anyone sees of Maude, and they were the one surface not using it.
//
// WHAT IS LIFTED, AND FROM WHERE:
//
//   tokens  — a SUBSET of `.design/system/maude/colors_and_type.css`, copied
//             verbatim. Not re-derived, not "close enough": a drift test
//             asserts every value here still matches the source (brand.test.mjs).
//   mark    — the spark-on-bubble from `system/maude/preview/logo.tsx`, path
//             and all, with the bubble's squared bottom-right corner. A brand
//             mark in a canvas IS the stored specimen's mark (DDR-141); it is
//             never redrawn from memory, because a redrawn mark is a second
//             mark.
//
// WHY A SUBSET RATHER THAN THE WHOLE FILE. These are small server-rendered
// pages with no external stylesheet (the share view's CSP forbids one, and the
// dashboard deliberately ships nothing it does not need). Inlining 187 lines
// of tokens into every response to use fifteen of them would be waste. The
// drift test is what makes a subset safe.

/**
 * Tokens, verbatim from the design system. Dark is the default theme there,
 * and it is the default here — same reason: this is app chrome, not a
 * document.
 */
export const TOKENS = `
:root {
  --bg-0: oklch(0.165 0.012 255);
  --bg-1: oklch(0.198 0.012 255);
  --bg-2: oklch(0.232 0.013 255);
  --bg-3: oklch(0.270 0.013 252);
  --bg-4: oklch(0.310 0.014 252);
  --border-subtle:  oklch(0.290 0.012 255);
  --border-default: oklch(0.360 0.013 252);
  --border-strong:  oklch(0.450 0.014 250);
  --fg-0: oklch(0.955 0.005 250);
  --fg-1: oklch(0.790 0.008 250);
  --fg-2: oklch(0.660 0.010 250);
  --fg-3: oklch(0.500 0.010 250);
  --accent:        oklch(0.680 0.180 268);
  --accent-hover:  oklch(0.730 0.170 268);
  --accent-active: oklch(0.630 0.180 268);
  --accent-fg:     oklch(0.180 0.030 268);
  --accent-muted:  oklch(0.460 0.110 268);
  --accent-tint:   color-mix(in oklab, var(--accent) 16%, transparent);
  --status-success: oklch(0.760 0.150 162);
  --status-warn:    oklch(0.800 0.130 78);
  --status-error:   oklch(0.660 0.190 25);
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.40);
  --shadow-md: 0 4px 14px rgba(0, 0, 0, 0.46);
  --radius-xs: 3px;
  --radius-sm: 5px;
  --radius-md: 7px;
  --radius-lg: 10px;
  --radius-xl: 14px;
  --radius-pill: 999px;
  --space-1: 2px;
  --space-2: 4px;
  --space-3: 8px;
  --space-4: 12px;
  --space-5: 16px;
  --space-6: 24px;
  --space-7: 32px;
  --space-8: 48px;
  --font-display: "Inter Tight", "Inter", system-ui, -apple-system, sans-serif;
  --font-body:    "Inter", system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-mono:    "JetBrains Mono", "Geist Mono", ui-monospace, "SF Mono", Menlo, monospace;
  --type-xs:   11px;   --lh-xs:   16px;
  --type-sm:   12px;   --lh-sm:   18px;
  --type-base: 14px;   --lh-base: 20px;
  --type-md:   16px;   --lh-md:   24px;
  --type-lg:   19px;   --lh-lg:   26px;
  --type-xl:   23px;   --lh-xl:   30px;
  --type-2xl:  28px;   --lh-2xl:  34px;
  --tracking-tight: -0.014em;
  --dur-soft:  120ms;
  --dur-flip:  140ms;
  --ease-out:  cubic-bezier(0.2, 0, 0, 1);
  --canvas-dot: oklch(0.340 0.012 255);
  --canvas-grid: 24px;
}
@media (prefers-reduced-motion: reduce) {
  :root { --dur-soft: 1ms; --dur-flip: 1ms; }
}
`;

/**
 * The shared chrome.
 *
 * The dotted canvas is the DS's signature surface (the `--canvas-*` family), so
 * the pages that frame somebody's design work sit on it rather than on flat
 * grey — that is the one visual idea this product has, and leaving it off the
 * front door was the whole problem. Panels share ONE material: same hairline,
 * same radius, same elevation, because cohesion is the identity, in the design
 * system's own words.
 *
 * NO CSS COMMENTS inside these strings. They are shipped to every visitor, and
 * the vocabulary lint reads the rendered HTML — a comment saying "tokens" put
 * our word for our thing in front of a customer. Explanations belong here, in
 * bytes nobody downloads.
 */
export const CHROME = `
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: var(--space-8) var(--space-5) calc(var(--space-8) * 2);
    font-family: var(--font-body);
    font-size: var(--type-md);
    line-height: var(--lh-md);
    color: var(--fg-0);
    background-color: var(--bg-0);
    background-image: radial-gradient(var(--canvas-dot) 1px, transparent 1px);
    background-size: var(--canvas-grid) var(--canvas-grid);
    -webkit-font-smoothing: antialiased;
  }
  main { max-width: 44rem; margin: 0 auto; }
  h1 {
    font-family: var(--font-display);
    font-size: var(--type-2xl); line-height: var(--lh-2xl);
    letter-spacing: var(--tracking-tight);
    font-weight: 600; margin: 0 0 var(--space-2);
  }
  h2 {
    font-family: var(--font-display);
    font-size: var(--type-lg); line-height: var(--lh-lg);
    letter-spacing: var(--tracking-tight);
    font-weight: 600; margin: 0 0 var(--space-1);
  }
  p { margin: 0 0 var(--space-5); }
  .quiet { color: var(--fg-2); font-size: var(--type-base); line-height: var(--lh-base); }
  a { color: var(--accent); text-decoration-color: var(--accent-muted); text-underline-offset: 2px; }
  a:hover { color: var(--accent-hover); }
  .card {
    background: var(--bg-1);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg);
    padding: var(--space-5) var(--space-6);
    box-shadow: var(--shadow-sm);
  }
  .btn { display: inline-block; text-decoration: none; }
  button, .btn {
    font: inherit; font-weight: 600;
    font-size: var(--type-base); line-height: var(--lh-base);
    padding: var(--space-3) var(--space-5);
    border-radius: var(--radius-md);
    border: 1px solid transparent;
    background: var(--accent); color: var(--accent-fg);
    cursor: pointer;
    transition: background var(--dur-soft) var(--ease-out);
  }
  button:hover, .btn:hover { background: var(--accent-hover); }
  button:active, .btn:active { background: var(--accent-active); }
  button.ghost {
    background: var(--bg-2); color: var(--fg-1);
    border-color: var(--border-default);
  }
  button.ghost:hover { background: var(--bg-3); color: var(--fg-0); }
  input[type=email], input[type=password], input[type=text], select {
    font: inherit; font-size: var(--type-base);
    width: 100%; padding: var(--space-3) var(--space-4);
    color: var(--fg-0); background: var(--bg-3);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
  }
  input:focus-visible, select:focus-visible, button:focus-visible, a:focus-visible {
    outline: 2px solid var(--accent); outline-offset: 2px;
  }
  label { display: block; font-size: var(--type-sm); font-weight: 600; color: var(--fg-1); margin: var(--space-5) 0 var(--space-2); }
  .error { color: var(--status-error); font-weight: 600; }
  .ok { color: var(--status-success); font-weight: 600; }
  footer { margin-top: var(--space-8); padding-top: var(--space-5); border-top: 1px solid var(--border-subtle); color: var(--fg-2); font-size: var(--type-sm); line-height: var(--lh-sm); }
`;

/**
 * The mark: the spark on its bubble tile.
 *
 * Path and geometry lifted verbatim from `system/maude/preview/logo.tsx` +
 * `logo.css` — including the squared bottom-right corner, which is the thing
 * that makes it the Maude mark rather than a generic star in a rounded box.
 */
export function lockup({ size = 26, words = 'Maude Cloud', href = '/' } = {}) {
  // A LINK, not a decoration (Cloud Phase 23 A2). Every page wearing the mark
  // gets the way home for free — the return leg people reach for first.
  return `<a class="lockup" href="${href}">
    <span class="mark" style="width:${size}px;height:${size}px">
      <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <path d="M16 5l2.8 8.2L27 16l-8.2 2.8L16 27l-2.8-8.2L5 16l8.2-2.8z" fill="currentColor"/>
      </svg>
    </span>
    <span class="word">${words}</span>
  </a>`;
}

// `border-radius: 24% 24% 0 24%` is TL · TR · BR(square) · BL — the bubble.
// The squared bottom-right corner is what makes it the Maude mark rather than
// a star in a rounded box.
export const LOCKUP_CSS = `
  .lockup { display: inline-flex; align-items: center; gap: 0.34em; margin-bottom: var(--space-6); text-decoration: none; }
  .mark {
    display: grid; place-items: center; flex: none;
    background: var(--accent); color: var(--accent-fg);
    border-radius: 24% 24% 0 24%;
    box-shadow: 0 0 0 3px var(--accent-tint);
  }
  .mark svg { width: 66%; height: 66%; display: block; }
  .word {
    font-family: var(--font-display); font-weight: 600;
    font-size: var(--type-lg); letter-spacing: -0.03em; line-height: 1;
    color: var(--fg-0);
  }
`;

/** Everything a cloud page needs, in one string. */
export const PAGE_CSS = TOKENS + CHROME + LOCKUP_CSS;
