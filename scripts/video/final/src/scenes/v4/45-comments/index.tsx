import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { Caption, DottedCanvas } from '../../../lib/maude-stage';
import { maude } from '../../../lib/maude-tokens';

/**
 * Scene 45 · Comments + annotations — proof.
 *
 * ~7 s (210f @ 30fps). Signature: a numbered pin anchored to a pixel + a
 * hand-drawn pen arrow & label. Intent: a pin + a drawn annotation (arrow +
 * label) visible.
 */
export const CommentsScene = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = maude.dark;

  const pin = spring({
    frame: frame - 36,
    fps,
    config: { damping: 12, mass: 0.7 },
    durationInFrames: 22,
  });
  const thread = spring({ frame: frame - 58, fps, config: { damping: 200 }, durationInFrames: 14 });

  // pen-draw: stroke reveal via dashoffset
  const PATH_LEN = 280;
  const draw = interpolate(frame, [92, 132], [PATH_LEN, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const labelIn = spring({
    frame: frame - 134,
    fps,
    config: { damping: 200 },
    durationInFrames: 12,
  });

  return (
    <AbsoluteFill>
      <DottedCanvas theme="dark" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ position: 'relative', width: 880 }}>
          {/* artboard */}
          <div
            style={{
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
            <div style={{ padding: 48, display: 'flex', flexDirection: 'column', gap: 22 }}>
              <div
                style={{
                  fontFamily: maude.font.display,
                  fontWeight: 700,
                  fontSize: 58,
                  color: t.fg0,
                }}
              >
                Recipe Recap
              </div>
              <div style={{ height: 16, width: '72%', borderRadius: 6, background: t.bg3 }} />
              <div style={{ height: 16, width: '58%', borderRadius: 6, background: t.bg3 }} />
              <span
                style={{
                  alignSelf: 'flex-start',
                  background: t.accent,
                  color: t.accentFg,
                  fontFamily: maude.font.body,
                  fontWeight: 600,
                  fontSize: 22,
                  padding: '12px 26px',
                  borderRadius: 10,
                  marginTop: 8,
                }}
              >
                Scale portions
              </span>
            </div>
          </div>

          {/* hand-drawn pen arrow pointing at the heading */}
          <svg
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: 300,
              top: -40,
              width: 360,
              height: 220,
              overflow: 'visible',
            }}
            viewBox="0 0 360 220"
            fill="none"
          >
            <path
              d="M340 20 C 250 30, 150 60, 70 150"
              stroke={t.presence}
              strokeWidth={4}
              strokeLinecap="round"
              strokeDasharray={PATH_LEN}
              strokeDashoffset={draw}
            />
            <path
              d="M70 150 l 30 -10 m -30 10 l 12 28"
              stroke={t.presence}
              strokeWidth={4}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={draw < 40 ? 1 : 0}
            />
          </svg>

          {/* annotation label */}
          <span
            style={{
              position: 'absolute',
              right: -40,
              top: -56,
              fontFamily: maude.font.mono,
              fontSize: 22,
              color: '#fff',
              background: t.presence,
              borderRadius: 10,
              padding: '8px 16px',
              transform: `rotate(-3deg) translateY(${interpolate(labelIn, [0, 1], [10, 0])}px)`,
              opacity: labelIn,
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            }}
          >
            ✎ make this bigger
          </span>

          {/* numbered comment pin on the CTA */}
          <div
            style={{
              position: 'absolute',
              left: 250,
              bottom: 70,
              transform: `scale(${pin})`,
              transformOrigin: 'bottom left',
            }}
          >
            <span
              style={{
                display: 'flex',
                width: 44,
                height: 44,
                borderRadius: '50% 50% 50% 4px',
                background: t.accent,
                color: t.accentFg,
                fontFamily: maude.font.mono,
                fontWeight: 700,
                fontSize: 24,
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
              }}
            >
              1
            </span>
          </div>

          {/* comment thread popover */}
          <div
            style={{
              position: 'absolute',
              left: 300,
              bottom: 40,
              width: 320,
              background: t.bg2,
              border: `1px solid ${t.border}`,
              borderRadius: 14,
              padding: 18,
              opacity: thread,
              transform: `translateY(${interpolate(thread, [0, 1], [10, 0])}px)`,
              boxShadow: '0 16px 50px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{ width: 26, height: 26, borderRadius: 99, background: t.presence }} />
              <span
                style={{ fontFamily: maude.font.body, fontSize: 18, fontWeight: 600, color: t.fg0 }}
              >
                you
              </span>
              <span
                style={{
                  marginLeft: 'auto',
                  fontFamily: maude.font.mono,
                  fontSize: 14,
                  color: t.fg3,
                }}
              >
                #1
              </span>
            </div>
            <div
              style={{ fontFamily: maude.font.body, fontSize: 19, color: t.fg1, lineHeight: 1.4 }}
            >
              looks tight — bump the CTA and ship it.
            </div>
          </div>
        </div>

        <Caption
          theme="dark"
          frame={frame}
          from={158}
          text="comment on pixels. draw on them. no exports."
        />
      </DottedCanvas>
    </AbsoluteFill>
  );
};
