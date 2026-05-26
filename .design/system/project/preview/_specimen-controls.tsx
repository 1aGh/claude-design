/**
 * @file        _specimen-controls.tsx
 * @purpose     Shared client components for every preview/*.tsx specimen —
 *              <ThemeToggle> (light/dark switch on document root) and
 *              <ReducedMotionToggle> (motion-specimen-page-only).
 *
 * Pre-fix: each specimen embedded an inert `<span className="theme-toggle">
 * <button data-theme="light">LIGHT</button> ...` with no `onClick` — pure
 * markup. Phase 3.7 wires real state.
 *
 * Pattern: clients persist preferences to localStorage so navigating between
 * specimens doesn't reset the user's choice. Tokens already define
 * [data-theme="dark"] overrides in colors_and_type.css.
 */
import { useEffect, useState } from "react";

const THEME_KEY = "maude:design:theme";
const RM_KEY = "maude:design:reduced-motion";

type Theme = "light" | "dark";

function readInitialTheme(): Theme {
  if (typeof document === "undefined") return "light";
  // Already set on the root? Honor it (lets SSR / parent host pre-paint).
  const fromRoot = document.documentElement.dataset.theme as Theme | undefined;
  if (fromRoot === "light" || fromRoot === "dark") return fromRoot;
  try {
    const stored = window.localStorage?.getItem(THEME_KEY) as Theme | null;
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // localStorage may be unavailable (sandboxed iframe, private mode) — fall through.
  }
  // Fall back to OS preference; default to light when undecided.
  if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) return "dark";
  return "light";
}

/**
 * Drop-in replacement for the inert `<span className="theme-toggle">...`
 * blocks every specimen used to inline. Sets `data-theme` on
 * `document.documentElement` so the token overrides in `colors_and_type.css`
 * kick in everywhere (chrome + bespoke specimen CSS alike).
 */
export function ThemeToggle() {
  // Lazy init — readInitialTheme() touches `document` which is fine in CSR but
  // we keep the function form so the SSR pass uses the default branch.
  const [theme, setTheme] = useState<Theme>(() => readInitialTheme());

  useEffect(() => {
    // `colors_and_type.css` gates dark overrides on `.mdcc[data-theme="dark"]`
    // — both the class AND the attribute must be present for the rule to
    // fire. The class is idempotent; we add it once and never remove it.
    document.documentElement.classList.add("mdcc");
    document.documentElement.dataset.theme = theme;
    try {
      window.localStorage?.setItem(THEME_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  return (
    <span className="theme-toggle" role="tablist" aria-label="Theme">
      <button
        type="button"
        role="tab"
        aria-pressed={theme === "light"}
        data-theme="light"
        onClick={() => setTheme("light")}
      >
        LIGHT
      </button>
      <button
        type="button"
        role="tab"
        aria-pressed={theme === "dark"}
        data-theme="dark"
        onClick={() => setTheme("dark")}
      >
        DARK
      </button>
    </span>
  );
}

/**
 * Motion-specimen toggle — sets `data-rm="true|false"` on
 * `document.documentElement`. Motion CSS responds to this attribute, not the
 * OS-level `prefers-reduced-motion: reduce`. Rationale: the motion specimen
 * page exists EXCLUSIVELY to demonstrate motion; OS-level reduced-motion would
 * defeat that. The toggle gives reviewers explicit control over both branches.
 *
 * Other specimens still honor OS-level `prefers-reduced-motion: reduce` via
 * the token `--dur-*: 1ms` collapse + the universal animation killswitch in
 * `_layout.css`. This toggle is scoped to the motion specimen only.
 */
export function ReducedMotionToggle() {
  const [rm, setRm] = useState<boolean>(() => {
    if (typeof document === "undefined") return false;
    const fromRoot = document.documentElement.dataset.rm;
    if (fromRoot === "true") return true;
    if (fromRoot === "false") return false;
    try {
      const stored = window.localStorage?.getItem(RM_KEY);
      if (stored === "true" || stored === "false") return stored === "true";
    } catch {
      /* ignore */
    }
    // Default: OFF on the motion specimen so demos play on first paint.
    return false;
  });

  useEffect(() => {
    document.documentElement.dataset.rm = rm ? "true" : "false";
    try {
      window.localStorage?.setItem(RM_KEY, rm ? "true" : "false");
    } catch {
      /* ignore */
    }
    // Cleanup when this specimen unmounts (e.g. tab switch). Other pages
    // shouldn't inherit a stale `data-rm` from the motion specimen.
    return () => {
      delete document.documentElement.dataset.rm;
    };
  }, [rm]);

  return (
    <span className="rm-toggle" role="group" aria-label="Reduced motion override">
      <span className="rm-toggle__label">REDUCED&nbsp;MOTION</span>
      <button
        type="button"
        role="switch"
        aria-checked={!rm}
        data-rm-state={rm ? "off" : "on"}
        onClick={() => setRm((v) => !v)}
      >
        {rm ? "PAUSED" : "PLAYING"}
      </button>
    </span>
  );
}
