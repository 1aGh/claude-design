import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { Caption, DottedCanvas, typewriter } from '../../../lib/maude-stage';
import { maude } from '../../../lib/maude-tokens';

/**
 * Scene 10 · Onboarding — proof.
 *
 * ~6 s (180f @ 30fps). Signature: the Claude TUI questionary — a prose question,
 * not a form. Intent: TUI visible · `/design:setup-ds` typed · Stage-1 prose
 * prompt rendering.
 */
export const OnboardingScene = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = maude.dark;

  const panel = spring({ frame: frame - 4, fps, config: { damping: 200 }, durationInFrames: 16 });
  const panelOpacity = panel;
  const panelRise = interpolate(panel, [0, 1], [28, 0]);

  const cmd = typewriter(frame, '/design:setup-ds', 22, 26);
  const arg = typewriter(frame, ' project "industrial catalogue, paper & ink…"', 50, 30);
  const blink = Math.floor(frame / 15) % 2 === 0;
  const typingCmd = frame < 86;

  const q = spring({ frame: frame - 92, fps, config: { damping: 200 }, durationInFrames: 18 });
  const qOpacity = q;
  const qRise = interpolate(q, [0, 1], [18, 0]);

  return (
    <AbsoluteFill>
      <DottedCanvas theme="dark" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div
          style={{
            width: 1180,
            opacity: panelOpacity,
            transform: `translateY(${panelRise}px)`,
            background: t.bg1,
            border: `1px solid ${t.border}`,
            borderRadius: 18,
            boxShadow: '0 24px 80px rgba(0,0,0,0.45)',
            overflow: 'hidden',
            fontFamily: maude.font.mono,
          }}
        >
          {/* header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '18px 28px',
              borderBottom: `1px solid ${t.borderSubtle}`,
              color: t.fg2,
              fontSize: 22,
            }}
          >
            <span style={{ width: 11, height: 11, borderRadius: 99, background: t.success }} />
            claude
            <span style={{ marginLeft: 'auto', color: t.fg3, fontSize: 18 }}>scratch · maude</span>
          </div>

          {/* command */}
          <div style={{ padding: '26px 28px 8px', fontSize: 30, color: t.fg0 }}>
            <span style={{ color: t.accent, marginRight: 16 }}>&gt;</span>
            {cmd}
            <span style={{ color: t.fg2 }}>{arg}</span>
            {typingCmd ? <span style={{ color: t.accent, opacity: blink ? 1 : 0 }}>▋</span> : null}
          </div>

          {/* prose question */}
          <div
            style={{
              padding: '14px 28px 34px',
              opacity: qOpacity,
              transform: `translateY(${qRise}px)`,
            }}
          >
            <div
              style={{ fontSize: 19, letterSpacing: '0.04em', color: t.accent, marginBottom: 14 }}
            >
              STAGE 1 · 1 / 4
            </div>
            <div
              style={{
                fontFamily: maude.font.display,
                fontSize: 44,
                fontWeight: 600,
                lineHeight: 1.18,
                letterSpacing: '-0.01em',
                color: t.fg0,
                maxWidth: '24ch',
              }}
            >
              What feeling should the very first screen give someone?
            </div>
          </div>
        </div>

        <Caption theme="dark" frame={frame} from={130} text="onboarding is a slash command." />
      </DottedCanvas>
    </AbsoluteFill>
  );
};
