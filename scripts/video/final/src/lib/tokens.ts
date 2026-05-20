/**
 * Active DS: project (MDCC-DSN/01 — industrial catalogue mood).
 * Tokens mirror .design/system/project/colors_and_type.css.
 * OKLCH values are kept for parity; hex fallbacks for non-CSS contexts.
 *
 * Drift guard: keep this in lockstep with the source CSS. The golden-frame
 * harness (__tests__/frame-regression.test.ts) catches accidental drift
 * because every scene that uses these tokens re-renders to PNG.
 */

export const tokens = {
  light: {
    bg0: 'oklch(97.5% 0.008 78)',
    bg1: 'oklch(95.5% 0.010 78)',
    bg2: 'oklch(93.0% 0.012 78)',
    ink: 'oklch(20% 0.020 60)',
    inkMuted: 'oklch(45% 0.020 60)',
    accent: 'oklch(56% 0.170 50)',
    accentFg: 'oklch(98% 0.008 78)',
    accentTint: 'oklch(92% 0.040 55)',
    rule: 'oklch(82% 0.014 65)',
  },
  dark: {
    bg0: 'oklch(13% 0.012 60)',
    bg1: 'oklch(17% 0.014 60)',
    bg2: 'oklch(20% 0.016 60)',
    ink: 'oklch(94% 0.012 78)',
    inkMuted: 'oklch(72% 0.012 78)',
    accent: 'oklch(72% 0.160 55)',
    accentFg: 'oklch(14% 0.020 50)',
    accentTint: 'oklch(28% 0.060 55)',
    rule: 'oklch(36% 0.014 65)',
  },
  font: {
    mono: "'Berkeley Mono', 'TX-02', 'JetBrains Mono', 'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
    display:
      "'Berkeley Mono', 'TX-02', 'JetBrains Mono', 'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
  },
} as const;

export type Theme = keyof Pick<typeof tokens, 'light' | 'dark'>;
