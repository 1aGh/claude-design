/**
 * Shared stage primitives for the v5 SHOWREEL (phase-16).
 *
 * The v5 cut is a feature showreel (not a tutorial). It grounds every beat in
 * the REAL maude product — real Studio chrome / canvas / DS specimen / moodboard
 * captures live in `public/v4/*.png` and are composited under animated overlays.
 *
 * Importing this module side-effect-loads the maude DS fonts (Inter Tight /
 * Inter / JetBrains Mono) — the v4 scenes silently fell back to system-ui
 * because nothing imported maude-fonts. Every v5 scene imports from here, so the
 * fonts are guaranteed loaded for the whole bundle.
 */

import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { maude, type MaudeTheme } from './maude-tokens';
import './maude-fonts'; // side-effect: register + delayRender the DS fonts

export { maude };
export type { MaudeTheme };
export const font = maude.font;

export const PANEL_SHADOW = '0 40px 120px rgba(0,0,0,0.55)';
export const CARD_SHADOW = '0 24px 70px rgba(0,0,0,0.40)';

/** ease-out cubic on a 0..1 input. */
export const easeOut = (p: number) => 1 - (1 - p) ** 3;

/** ease-out-back — overshoots past 1 then settles. The "liveliness" curve. */
export const easeOutBack = (p: number, s = 1.7) => {
  const c = Math.max(0, Math.min(1, p));
  return 1 + (s + 1) * (c - 1) ** 3 + s * (c - 1) ** 2;
};

/** clamp interpolate helper (the most common shape used across scenes). */
export const lerp = (frame: number, inR: [number, number], outR: [number, number]) =>
  interpolate(frame, inR, outR, { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

/** A snappy entrance 0..1 (overshoots, then settles) over [delay, delay+dur]. */
export const pop = (frame: number, delay: number, dur = 18) =>
  easeOutBack(lerp(frame, [delay, delay + dur], [0, 1]));

/** A spring 0..1 that starts at `delay` and settles over `dur`. Lively overshoot. */
export const useEnter = (delay: number, dur = 18, damping = 13) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping, mass: 0.7 }, durationInFrames: dur });
};

/* ────────────────────────────────────────────────────────────────────────── */
/* Dotted void background (shared with v4)                                      */
/* ────────────────────────────────────────────────────────────────────────── */

const DOT_PITCH = 30;

export const Void: React.FC<{
  theme?: MaudeTheme;
  children?: React.ReactNode;
  style?: React.CSSProperties;
  /** parallax shift of the dot grid, in px (for camera-move scenes) */
  panX?: number;
  panY?: number;
}> = ({ theme = 'dark', children, style, panX = 0, panY = 0 }) => {
  const t = maude[theme];
  return (
    <AbsoluteFill
      style={{
        backgroundColor: t.canvasBg,
        backgroundImage: `radial-gradient(${t.canvasDot} 1.4px, transparent 1.4px)`,
        backgroundSize: `${DOT_PITCH}px ${DOT_PITCH}px`,
        backgroundPosition: `${panX}px ${panY}px`,
        color: t.fg0,
        overflow: 'hidden',
        ...style,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

/** Soft radial vignette to push the eye to center — cinematic darkening. */
export const Vignette: React.FC<{ strength?: number }> = ({ strength = 0.5 }) => (
  <AbsoluteFill
    style={{
      pointerEvents: 'none',
      background: `radial-gradient(120% 90% at 50% 46%, transparent 40%, rgba(0,0,0,${strength}) 100%)`,
    }}
  />
);

/* ────────────────────────────────────────────────────────────────────────── */
/* Presence cursor (color-customizable — multiplayer needs ≥3 distinct hues)    */
/* ────────────────────────────────────────────────────────────────────────── */

export const Pointer: React.FC<{
  x: number;
  y: number;
  color?: string;
  label?: string;
  opacity?: number;
  size?: number;
}> = ({ x, y, color = maude.dark.presence, label, opacity = 1, size = 36 }) => (
  <div style={{ position: 'absolute', left: x, top: y, opacity, pointerEvents: 'none', zIndex: 50 }}>
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.45))' }}>
      <path d="M3 2l9 4.4-4 1.1-1.1 4z" fill={color} stroke="#fff" strokeWidth={0.5} />
    </svg>
    {label ? (
      <span
        style={{
          position: 'absolute',
          left: size * 0.5,
          top: size * 0.55,
          whiteSpace: 'nowrap',
          background: color,
          color: '#fff',
          fontFamily: maude.font.mono,
          fontSize: 15,
          fontWeight: 600,
          padding: '2px 9px',
          borderRadius: 7,
          boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
        }}
      >
        {label}
      </span>
    ) : null}
  </div>
);

/* ────────────────────────────────────────────────────────────────────────── */
/* Kinetic key phrase — sparse on-screen text (the audio VO carries the rest)   */
/* ────────────────────────────────────────────────────────────────────────── */

export const Phrase: React.FC<{
  text: React.ReactNode;
  frame: number;
  from?: number;
  until?: number;
  theme?: MaudeTheme;
  size?: number;
  align?: 'left' | 'center';
  accent?: boolean;
  bottom?: number;
}> = ({ text, frame, from = 0, until, theme = 'dark', size = 34, align = 'left', accent = false, bottom = 88 }) => {
  const t = maude[theme];
  const enter = lerp(frame, [from, from + 12], [0, 1]);
  const exit = until ? lerp(frame, [until - 10, until], [1, 0]) : 1;
  const opacity = enter * exit;
  const rise = interpolate(easeOutBack(enter), [0, 1], [20, 0]);
  return (
    <div
      style={{
        position: 'absolute',
        left: align === 'left' ? 96 : 0,
        right: align === 'center' ? 0 : undefined,
        bottom,
        display: 'flex',
        alignItems: 'center',
        justifyContent: align === 'center' ? 'center' : 'flex-start',
        gap: 18,
        opacity,
        transform: `translateY(${rise}px)`,
      }}
    >
      {align === 'left' ? <span style={{ width: 30, height: 3, background: t.accent, borderRadius: 2 }} /> : null}
      <span
        style={{
          fontFamily: maude.font.display,
          fontSize: size,
          fontWeight: 600,
          letterSpacing: '-0.015em',
          color: accent ? t.accent : t.fg0,
          textShadow: '0 2px 24px rgba(0,0,0,0.5)',
        }}
      >
        {text}
      </span>
    </div>
  );
};

/* ────────────────────────────────────────────────────────────────────────── */
/* Chat bubble (for the discovery questionary beat)                             */
/* ────────────────────────────────────────────────────────────────────────── */

export const ChatBubble: React.FC<{
  role: 'ai' | 'you';
  children: React.ReactNode;
  opacity?: number;
  rise?: number;
  width?: number;
}> = ({ role, children, opacity = 1, rise = 0, width = 560 }) => {
  const t = maude.dark;
  const ai = role === 'ai';
  return (
    <div
      style={{
        alignSelf: ai ? 'flex-start' : 'flex-end',
        maxWidth: width,
        opacity,
        transform: `translateY(${rise}px)`,
        background: ai ? t.bg2 : t.accent,
        color: ai ? t.fg0 : t.accentFg,
        border: ai ? `1px solid ${t.border}` : 'none',
        borderRadius: ai ? '4px 18px 18px 18px' : '18px 4px 18px 18px',
        padding: '16px 22px',
        fontFamily: maude.font.body,
        fontSize: 26,
        lineHeight: 1.35,
        fontWeight: ai ? 500 : 600,
        boxShadow: CARD_SHADOW,
      }}
    >
      {ai ? (
        <div style={{ fontFamily: maude.font.mono, fontSize: 14, letterSpacing: '0.08em', color: t.accent, marginBottom: 6 }}>
          /design:setup-ds
        </div>
      ) : null}
      {children}
    </div>
  );
};

/* ────────────────────────────────────────────────────────────────────────── */
/* Brand mark — the spark-on-bubble lockup (matches system/maude/preview/logo)  */
/* ────────────────────────────────────────────────────────────────────────── */

export const MaudeMark: React.FC<{ size?: number; halo?: boolean; color?: string; fg?: string }> = ({
  size = 92,
  halo = true,
  color = maude.dark.accent,
  fg = maude.dark.accentFg,
}) => (
  <span
    style={{
      width: size,
      height: size,
      borderRadius: `${size * 0.26}px ${size * 0.26}px ${size * 0.07}px ${size * 0.26}px`,
      background: color,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: halo ? `0 0 0 ${size * 0.09}px ${maude.dark.accentTint}` : 'none',
      flexShrink: 0,
    }}
  >
    <svg width={size * 0.56} height={size * 0.56} viewBox="0 0 32 32" fill={fg} aria-hidden>
      <path d="M16 5l2.8 8.2L27 16l-8.2 2.8L16 27l-2.8-8.2L5 16l8.2-2.8z" />
    </svg>
  </span>
);
