import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { easeOut, font, lerp, MaudeMark, maude, Void } from '../../../lib/v5-stage';

/**
 * Beat 99 · End card (120f / 4s).
 *
 * Brand lockup + install + trust line, loop-safe back to the void (bookends the
 * cold open). Grounded: system/maude/preview/logo.tsx.
 * VO: "maude. No telemetry. No sign-up. Your repo is the source of truth."
 */
const t = maude.dark;

export const V5EndCard = () => {
  const frame = useCurrentFrame();
  const lockup = easeOut(lerp(frame, [6, 28], [0, 1]));
  const install = easeOut(lerp(frame, [28, 46], [0, 1]));
  const foot = easeOut(lerp(frame, [44, 60], [0, 1]));
  // loop-safe: settle, hold (over the closing VO), then a gentle fade to the void
  const out = lerp(frame, [182, 201], [1, 0.0]);

  return (
    <AbsoluteFill>
      <Void theme="dark" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 32,
            opacity: out,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 28,
              opacity: lockup,
              transform: `translateY(${interpolate(lockup, [0, 1], [22, 0])}px)`,
            }}
          >
            <MaudeMark size={104} />
            <span
              style={{
                fontFamily: font.display,
                fontWeight: 700,
                fontSize: 140,
                letterSpacing: '-0.03em',
                color: t.fg0,
                lineHeight: 1,
              }}
            >
              maude
            </span>
          </div>

          <span
            style={{
              fontFamily: font.mono,
              fontSize: 36,
              color: t.accent,
              background: t.accentTint,
              border: `1px solid ${t.accentMuted}`,
              borderRadius: 99,
              padding: '14px 36px',
              opacity: install,
              transform: `translateY(${interpolate(install, [0, 1], [14, 0])}px)`,
            }}
          >
            npm i -g @1agh/maude
          </span>

          <span
            style={{
              fontFamily: font.mono,
              fontSize: 24,
              letterSpacing: '0.05em',
              color: t.fg2,
              opacity: foot,
            }}
          >
            no telemetry · no sign-up · your repo is the source of truth
          </span>
        </div>
      </Void>
    </AbsoluteFill>
  );
};
