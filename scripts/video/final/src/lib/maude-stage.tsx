/**
 * Shared stage primitives for the v4 maude-DS intro film.
 *
 * DottedCanvas — the maude infinite dotted canvas as a full-bleed background.
 * Caption     — voice-aligned lower-third (short, dry, catalog-spine tone).
 * Caret       — a blinking text caret (accent).
 * AgentCursor — the presence-agent cursor (violet-magenta, held off the accent).
 *
 * These keep every v4 scene visually anchored in the same product chrome while
 * each scene supplies its own signature treatment on top.
 */

import { AbsoluteFill, interpolate } from 'remotion';
import { type MaudeTheme, maude } from './maude-tokens';

const DOT_PITCH = 30; // px between dots (scaled up from the 24px UI grid for 1080p)

/** Typewriter: how much of `text` is revealed at `frame` over [start, start+dur]. */
export const typewriter = (frame: number, text: string, start: number, dur: number): string => {
  const n = Math.round(
    interpolate(frame, [start, start + dur], [0, text.length], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    })
  );
  return text.slice(0, n);
};

export const DottedCanvas: React.FC<{
  theme?: MaudeTheme;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ theme = 'dark', children, style }) => {
  const t = maude[theme];
  return (
    <AbsoluteFill
      style={{
        backgroundColor: t.canvasBg,
        backgroundImage: `radial-gradient(${t.canvasDot} 1.4px, transparent 1.4px)`,
        backgroundSize: `${DOT_PITCH}px ${DOT_PITCH}px`,
        color: t.fg0,
        ...style,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

/** A blinking text caret. `frame` drives the blink; pass `solid` to hold it on. */
export const Caret: React.FC<{
  theme?: MaudeTheme;
  frame: number;
  height?: number;
  width?: number;
  solid?: boolean;
}> = ({ theme = 'dark', frame, height = 64, width = 4, solid = false }) => {
  const t = maude[theme];
  const on = solid || Math.floor(frame / 15) % 2 === 0;
  return (
    <span
      style={{
        display: 'inline-block',
        width,
        height,
        background: t.accent,
        opacity: on ? 1 : 0,
        borderRadius: 1,
        verticalAlign: 'middle',
      }}
    />
  );
};

/** The presence-agent cursor (arrow + optional name pill). */
export const AgentCursor: React.FC<{
  theme?: MaudeTheme;
  x: number;
  y: number;
  label?: string;
  opacity?: number;
  size?: number;
}> = ({ theme = 'dark', x, y, label, opacity = 1, size = 34 }) => {
  const t = maude[theme];
  return (
    <div style={{ position: 'absolute', left: x, top: y, opacity, pointerEvents: 'none' }}>
      <svg
        aria-hidden="true"
        width={size}
        height={size}
        viewBox="0 0 16 16"
        fill={t.presence}
        stroke="none"
      >
        <path d="M3 2l9 4.4-4 1.1-1.1 4z" />
      </svg>
      {label ? (
        <span
          style={{
            position: 'absolute',
            left: size * 0.55,
            top: size * 0.62,
            whiteSpace: 'nowrap',
            background: t.presence,
            color: '#fff',
            fontFamily: maude.font.mono,
            fontSize: 16,
            fontWeight: 500,
            padding: '2px 8px',
            borderRadius: 6,
          }}
        >
          {label}
        </span>
      ) : null}
    </div>
  );
};

/**
 * Voice-aligned caption — a lower-third line. Short, dry, lowercase-leaning.
 * Springs in with a small rise + fade over ~12 frames from `from`.
 */
export const Caption: React.FC<{
  theme?: MaudeTheme;
  text: string;
  frame: number;
  from?: number;
  until?: number;
}> = ({ theme = 'dark', text, frame, from = 0, until }) => {
  const t = maude[theme];
  const enter = interpolate(frame, [from, from + 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const exit = until
    ? interpolate(frame, [until - 10, until], [1, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : 1;
  const opacity = enter * exit;
  const rise = interpolate(enter, [0, 1], [14, 0]);
  return (
    <div
      style={{
        position: 'absolute',
        left: 96,
        bottom: 84,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        opacity,
        transform: `translateY(${rise}px)`,
      }}
    >
      <span style={{ width: 28, height: 3, background: t.accent, borderRadius: 2 }} />
      <span
        style={{
          fontFamily: maude.font.mono,
          fontSize: 30,
          fontWeight: 500,
          letterSpacing: '-0.01em',
          color: t.fg0,
        }}
      >
        {text}
      </span>
    </div>
  );
};
