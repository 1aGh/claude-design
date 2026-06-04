/**
 * @file        _specimen-controls.tsx
 * @purpose     Shared client controls for every maude preview/*.tsx specimen —
 *              <ThemeToggle> (dark/light switch on the document root) and
 *              <ReducedMotionToggle> (motion-specimen page only).
 *
 * The toggle sets BOTH the `maude` root class AND `data-theme` on
 * <html> — colors_and_type.css gates its theme blocks on
 * `.maude[data-theme="…"]`, so both must be present for overrides to fire.
 * dark is the default (the studio / canvas-browser surface).
 */
import { useEffect, useState } from "react";

const THEME_KEY = "maude:design:theme";
const RM_KEY = "maude:design:reduced-motion";

type Theme = "dark" | "light";

function readInitialTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  const fromRoot = document.documentElement.dataset.theme as Theme | undefined;
  if (fromRoot === "light" || fromRoot === "dark") return fromRoot;
  try {
    const stored = window.localStorage?.getItem(THEME_KEY) as Theme | null;
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    /* ignore */
  }
  return "dark";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => readInitialTheme());

  useEffect(() => {
    document.documentElement.classList.add("maude");
    document.documentElement.dataset.theme = theme;
    try {
      window.localStorage?.setItem(THEME_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  // Toggle group, not a tab set (no tabpanels) — role="group" + aria-pressed is
  // the valid ARIA combo; role="tab" forbids aria-pressed (a11y blocker, Kolo 1).
  return (
    <span className="theme-toggle" role="group" aria-label="Theme">
      <button
        type="button"
        aria-pressed={theme === "dark"}
        data-theme="dark"
        onClick={() => setTheme("dark")}
      >
        DARK
      </button>
      <button
        type="button"
        aria-pressed={theme === "light"}
        data-theme="light"
        onClick={() => setTheme("light")}
      >
        LIGHT
      </button>
    </span>
  );
}

export function ReducedMotionToggle() {
  const [rm, setRm] = useState<boolean>(() => {
    if (typeof document === "undefined") return false;
    const fromRoot = document.documentElement.dataset.reducedMotion;
    if (fromRoot === "true") return true;
    if (fromRoot === "false") return false;
    try {
      const stored = window.localStorage?.getItem(RM_KEY);
      if (stored === "true" || stored === "false") return stored === "true";
    } catch {
      /* ignore */
    }
    return false;
  });

  useEffect(() => {
    document.documentElement.dataset.reducedMotion = String(rm);
    try {
      window.localStorage?.setItem(RM_KEY, String(rm));
    } catch {
      /* ignore */
    }
  }, [rm]);

  return (
    <span className="seg" role="group" aria-label="Reduced motion">
      <button type="button" aria-pressed={!rm} onClick={() => setRm(false)}>MOTION</button>
      <button type="button" aria-pressed={rm} onClick={() => setRm(true)}>REDUCED</button>
    </span>
  );
}
