/**
 * Maude DS tokens for the v4 intro film (phase-16).
 *
 * Mirrors `.design/system/maude/colors_and_type.css` — the "Unified Pro Studio"
 * design system (dark-first cool-neutral elevation ladder, hue 255; ONE indigo
 * accent oklch(0.68 0.18 268); Inter / Inter Tight display + JetBrains Mono).
 *
 * This is SEPARATE from lib/tokens.ts (which mirrors the `project` DS — the
 * industrial-catalogue Berkeley-Mono mood). v4 scenes render in the maude DS
 * per the storyboard sign-off; do not cross the two token sets.
 *
 * Drift guard: keep in lockstep with the source CSS. Chromium (Remotion's
 * renderer) supports oklch natively; tints use oklch alpha to avoid a
 * color-mix dependency.
 */

export const maude = {
  dark: {
    bg0: 'oklch(0.165 0.012 255)',
    bg1: 'oklch(0.198 0.012 255)',
    bg2: 'oklch(0.232 0.013 255)',
    bg3: 'oklch(0.270 0.013 252)',
    bg4: 'oklch(0.310 0.014 252)',
    border: 'oklch(0.360 0.013 252)',
    borderSubtle: 'oklch(0.300 0.013 252)',
    fg0: 'oklch(0.955 0.005 250)',
    fg1: 'oklch(0.790 0.008 250)',
    fg2: 'oklch(0.660 0.010 250)',
    fg3: 'oklch(0.500 0.010 250)',
    accent: 'oklch(0.680 0.180 268)',
    accentHover: 'oklch(0.730 0.170 268)',
    accentFg: 'oklch(0.180 0.030 268)',
    accentMuted: 'oklch(0.460 0.110 268)',
    accentTint: 'oklch(0.680 0.180 268 / 0.16)',
    success: 'oklch(0.760 0.150 162)',
    error: 'oklch(0.660 0.190 25)',
    info: 'oklch(0.720 0.120 238)',
    presence: 'oklch(0.700 0.190 322)',
    canvasBg: 'oklch(0.165 0.012 255)',
    canvasDot: 'oklch(0.340 0.012 255)',
  },
  light: {
    bg0: 'oklch(0.975 0.004 255)',
    bg1: 'oklch(1.000 0 0)',
    bg2: 'oklch(0.987 0.003 255)',
    bg3: 'oklch(0.955 0.005 255)',
    bg4: 'oklch(0.928 0.006 255)',
    border: 'oklch(0.868 0.007 255)',
    borderSubtle: 'oklch(0.910 0.006 255)',
    fg0: 'oklch(0.225 0.015 260)',
    fg1: 'oklch(0.400 0.014 260)',
    fg2: 'oklch(0.510 0.012 260)',
    fg3: 'oklch(0.660 0.010 260)',
    accent: 'oklch(0.520 0.195 268)',
    accentHover: 'oklch(0.470 0.195 268)',
    accentFg: 'oklch(0.995 0.004 268)',
    accentMuted: 'oklch(0.895 0.050 268)',
    accentTint: 'oklch(0.520 0.195 268 / 0.12)',
    success: 'oklch(0.560 0.150 162)',
    error: 'oklch(0.560 0.200 25)',
    info: 'oklch(0.530 0.150 238)',
    presence: 'oklch(0.520 0.190 322)',
    canvasBg: 'oklch(0.965 0.004 255)',
    canvasDot: 'oklch(0.860 0.008 255)',
  },
  font: {
    display: "'Inter Tight', 'Inter', system-ui, -apple-system, sans-serif",
    body: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif",
    mono: "'JetBrains Mono', 'Geist Mono', ui-monospace, 'SF Mono', Menlo, monospace",
  },
} as const;

export type MaudeTheme = keyof Pick<typeof maude, 'light' | 'dark'>;
