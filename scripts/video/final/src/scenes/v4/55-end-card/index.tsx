import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { maude } from '../../../lib/maude-tokens';
import { DottedCanvas } from '../../../lib/maude-stage';

/**
 * Scene 55 · End card — closer.
 *
 * ~4 s (120f @ 30fps). Signature: the brand lockup + install line, loop-safe
 * back to the dotted void (bookends the cold open). Intent: `npm i -g
 * @1agh/maude` legible.
 */
export const EndCardScene = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = maude.dark;

  const lockup = spring({ frame: frame - 6, fps, config: { damping: 200 }, durationInFrames: 20 });
  const install = spring({ frame: frame - 26, fps, config: { damping: 200 }, durationInFrames: 16 });
  const foot = spring({ frame: frame - 40, fps, config: { damping: 200 }, durationInFrames: 14 });

  return (
    <AbsoluteFill>
      <DottedCanvas theme="dark" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 30 }}>
          {/* lockup: spark-on-bubble mark + wordmark */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 26, opacity: lockup, transform: `translateY(${interpolate(lockup, [0, 1], [22, 0])}px)` }}>
            <span
              style={{
                width: 92,
                height: 92,
                borderRadius: '24px 24px 6px 24px',
                background: t.accent,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: `0 0 0 8px ${t.accentTint}`,
              }}
            >
              <svg width={52} height={52} viewBox="0 0 32 32" fill={t.accentFg} aria-hidden>
                <path d="M16 5l2.8 8.2L27 16l-8.2 2.8L16 27l-2.8-8.2L5 16l8.2-2.8z" />
              </svg>
            </span>
            <span style={{ fontFamily: maude.font.display, fontWeight: 700, fontSize: 132, letterSpacing: '-0.025em', color: t.fg0, lineHeight: 1 }}>
              maude
            </span>
          </div>

          {/* install line */}
          <span
            style={{
              fontFamily: maude.font.mono,
              fontSize: 36,
              color: t.accent,
              background: t.accentTint,
              border: `1px solid ${t.accentMuted}`,
              borderRadius: 99,
              padding: '14px 34px',
              opacity: install,
              transform: `translateY(${interpolate(install, [0, 1], [14, 0])}px)`,
            }}
          >
            npm i -g @1agh/maude
          </span>

          {/* footer */}
          <span style={{ fontFamily: maude.font.mono, fontSize: 24, letterSpacing: '0.06em', color: t.fg2, opacity: foot }}>
            MIT · no telemetry · no signup
          </span>
        </div>
      </DottedCanvas>
    </AbsoluteFill>
  );
};
