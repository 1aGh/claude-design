import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { Caption, DottedCanvas } from '../../../lib/maude-stage';
import { maude } from '../../../lib/maude-tokens';

/**
 * Scene 35 · Cmd+Click — proof.
 *
 * ~6 s (180f @ 30fps). Signature: an inspector halo lands on an element, with a
 * ⌘ cursor and the exact file-path chip. Intent: halo on a distinct element ·
 * path chip readable.
 */
export const CmdClickScene = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = maude.dark;

  const halo = spring({ frame: frame - 58, fps, config: { damping: 200 }, durationInFrames: 14 });
  const chip = spring({ frame: frame - 72, fps, config: { damping: 200 }, durationInFrames: 14 });

  // cursor drifts onto the CTA element, then "clicks"
  const move = spring({ frame: frame - 8, fps, config: { damping: 60 }, durationInFrames: 48 });
  const curX = interpolate(move, [0, 1], [1300, 760]);
  const curY = interpolate(move, [0, 1], [320, 612]);

  return (
    <AbsoluteFill>
      <DottedCanvas theme="dark" style={{ alignItems: 'center', justifyContent: 'center' }}>
        {/* artboard */}
        <div
          style={{
            width: 860,
            background: t.bg1,
            border: `1px solid ${t.border}`,
            borderRadius: 18,
            boxShadow: '0 24px 70px rgba(0,0,0,0.45)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'flex',
              gap: 7,
              alignItems: 'center',
              padding: '16px 24px',
              borderBottom: `1px solid ${t.borderSubtle}`,
            }}
          >
            <span style={{ width: 9, height: 9, borderRadius: 99, background: t.border }} />
            <span style={{ width: 9, height: 9, borderRadius: 99, background: t.border }} />
            <span
              style={{
                marginLeft: 'auto',
                fontFamily: maude.font.mono,
                fontSize: 15,
                color: t.fg3,
              }}
            >
              Recipe Recap.tsx
            </span>
          </div>
          <div style={{ padding: 48, display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div
              style={{
                fontFamily: maude.font.display,
                fontWeight: 700,
                fontSize: 60,
                color: t.fg0,
              }}
            >
              Recipe Recap
            </div>
            <div style={{ height: 16, width: '72%', borderRadius: 6, background: t.bg3 }} />
            <div style={{ height: 16, width: '54%', borderRadius: 6, background: t.bg3 }} />
            {/* target element with halo */}
            <div style={{ position: 'relative', alignSelf: 'flex-start', marginTop: 8 }}>
              <span
                style={{
                  display: 'inline-block',
                  background: t.accent,
                  color: t.accentFg,
                  fontFamily: maude.font.body,
                  fontWeight: 600,
                  fontSize: 24,
                  padding: '14px 30px',
                  borderRadius: 12,
                }}
              >
                Scale portions
              </span>
              {/* halo ring */}
              <span
                style={{
                  position: 'absolute',
                  inset: -8,
                  border: `2px solid ${t.accent}`,
                  borderRadius: 16,
                  boxShadow: `0 0 0 6px ${t.accentTint}`,
                  opacity: halo,
                  transform: `scale(${interpolate(halo, [0, 1], [1.06, 1])})`,
                }}
              />
              {/* path chip */}
              <span
                style={{
                  position: 'absolute',
                  top: -46,
                  left: 0,
                  fontFamily: maude.font.mono,
                  fontSize: 18,
                  color: t.accent,
                  background: t.accentTint,
                  border: `1px solid ${t.accentMuted}`,
                  borderRadius: 8,
                  padding: '5px 12px',
                  whiteSpace: 'nowrap',
                  opacity: chip,
                  transform: `translateY(${interpolate(chip, [0, 1], [8, 0])}px)`,
                }}
              >
                button.btn--primary · Hero.tsx : L42
              </span>
            </div>
          </div>
        </div>

        {/* ⌘ cursor */}
        <div style={{ position: 'absolute', left: curX, top: curY }}>
          <svg width={34} height={34} viewBox="0 0 16 16" fill={t.presence} aria-hidden="true">
            <path d="M3 2l9 4.4-4 1.1-1.1 4z" />
          </svg>
          <span
            style={{
              position: 'absolute',
              left: 24,
              top: 22,
              fontFamily: maude.font.mono,
              fontSize: 16,
              fontWeight: 600,
              color: '#fff',
              background: t.accent,
              borderRadius: 6,
              padding: '2px 8px',
            }}
          >
            ⌘ click
          </span>
        </div>

        <Caption
          theme="dark"
          frame={frame}
          from={120}
          text="cmd+click. the exact file Claude needs."
        />
      </DottedCanvas>
    </AbsoluteFill>
  );
};
