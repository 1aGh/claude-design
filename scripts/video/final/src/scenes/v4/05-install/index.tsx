import { AbsoluteFill, interpolate, OffthreadVideo, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { maude } from '../../../lib/maude-tokens';
import { DottedCanvas, Caption } from '../../../lib/maude-stage';

/**
 * Scene 05 · Install — hook. REBUILD (v4.1): real footage, not a mock.
 *
 * ~7 s (210f @ 30fps). Signature: a REAL terminal capture (asciinema → agg →
 * mp4) of actual `maude --version` / `maude init --dry-run` / `maude design help`
 * output, framed in a cinematic window with a slow push-in. Intent: real maude
 * CLI output, zero red error text.
 *
 * Footage: public/v4/cli.mp4 (10.4s real capture, played ~1.5× to fit).
 */
export const InstallScene = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = maude.dark;

  const win = spring({ frame: frame - 4, fps, config: { damping: 200 }, durationInFrames: 18 });
  const push = interpolate(frame, [0, 210], [1.0, 1.05]); // slow cinematic push-in
  const rise = interpolate(win, [0, 1], [30, 0]);

  return (
    <AbsoluteFill>
      <DottedCanvas theme="dark" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div
          style={{
            width: 1360,
            opacity: win,
            transform: `translateY(${rise}px) scale(${push})`,
            background: t.bg0,
            border: `1px solid ${t.border}`,
            borderRadius: 16,
            boxShadow: '0 30px 90px rgba(0,0,0,0.55)',
            overflow: 'hidden',
          }}
        >
          {/* window chrome */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '16px 22px', borderBottom: `1px solid ${t.borderSubtle}`, background: t.bg1 }}>
            <span style={{ width: 12, height: 12, borderRadius: 99, background: '#e06b5e' }} />
            <span style={{ width: 12, height: 12, borderRadius: 99, background: '#d8b46a' }} />
            <span style={{ width: 12, height: 12, borderRadius: 99, background: '#5fd3a3' }} />
            <span style={{ marginLeft: 14, fontFamily: maude.font.mono, fontSize: 17, color: t.fg3 }}>zsh — recipe-recap</span>
          </div>
          {/* real terminal footage */}
          <div style={{ background: '#14161c', aspectRatio: '1600 / 900' }}>
            <OffthreadVideo
              src={staticFile('v4/cli.mp4')}
              playbackRate={1.5}
              muted
              style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top left' }}
            />
          </div>
        </div>

        <Caption theme="dark" frame={frame} from={150} text="two plugins, one CLI." />
      </DottedCanvas>
    </AbsoluteFill>
  );
};
