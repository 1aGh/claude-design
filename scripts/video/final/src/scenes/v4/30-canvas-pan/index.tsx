import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { AgentCursor, Caption, DottedCanvas } from '../../../lib/maude-stage';
import { maude } from '../../../lib/maude-tokens';

/**
 * Scene 30 · Canvas reveal — proof.
 *
 * ~6 s (180f @ 30fps). Signature: a wide pan across the multi-artboard canvas,
 * edges bleeding off-frame. Intent: 3+ artboards visible mid-pan · grab
 * affordance.
 */
export const CanvasPanScene = () => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const t = maude.dark;

  // Smooth horizontal pan: artboard strip slides left.
  const pan = spring({ frame, fps, config: { damping: 200, mass: 1.4 }, durationInFrames: 170 });
  const x = interpolate(pan, [0, 1], [220, -980]);

  const Artboard: React.FC<{ title: string; children: React.ReactNode }> = ({
    title,
    children,
  }) => (
    <div
      style={{
        width: 560,
        flex: '0 0 560px',
        background: t.bg1,
        border: `1px solid ${t.border}`,
        borderRadius: 16,
        boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: 6,
          alignItems: 'center',
          padding: '14px 20px',
          borderBottom: `1px solid ${t.borderSubtle}`,
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: 99, background: t.border }} />
        <span style={{ width: 8, height: 8, borderRadius: 99, background: t.border }} />
        <span
          style={{ marginLeft: 'auto', fontFamily: maude.font.mono, fontSize: 14, color: t.fg3 }}
        >
          {title}
        </span>
      </div>
      <div style={{ padding: 30, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {children}
      </div>
    </div>
  );
  const bar = (w: string, accent = false): React.CSSProperties => ({
    height: 16,
    width: w,
    borderRadius: 6,
    background: accent ? t.accent : t.bg3,
  });

  return (
    <AbsoluteFill>
      <DottedCanvas theme="dark">
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: 0,
            transform: `translate(${x}px, -50%)`,
            display: 'flex',
            gap: 56,
            alignItems: 'center',
          }}
        >
          <Artboard title="hero.tsx">
            <div
              style={{
                fontFamily: maude.font.display,
                fontWeight: 700,
                fontSize: 40,
                color: t.fg0,
              }}
            >
              Recipe Recap
            </div>
            <div style={bar('70%')} />
            <div style={bar('40%', true)} />
          </Artboard>
          <Artboard title="list.tsx">
            <div style={bar('60%')} />
            <div style={bar('85%')} />
            <div style={bar('72%')} />
            <div style={bar('50%')} />
          </Artboard>
          <Artboard title="scaler.tsx">
            <div style={{ fontFamily: maude.font.mono, fontSize: 44, color: t.accent }}>×2</div>
            <div style={bar('80%')} />
            <div style={bar('55%')} />
          </Artboard>
          <Artboard title="print.tsx">
            <div style={bar('90%')} />
            <div style={bar('66%')} />
            <div style={bar('78%')} />
          </Artboard>
        </div>

        {/* zoom pill */}
        <div
          style={{
            position: 'absolute',
            left: 64,
            bottom: 64,
            display: 'flex',
            gap: 10,
            fontFamily: maude.font.mono,
            fontSize: 20,
          }}
        >
          <span
            style={{
              color: t.fg1,
              background: t.bg1,
              border: `1px solid ${t.border}`,
              borderRadius: 99,
              padding: '8px 18px',
            }}
          >
            1:1
          </span>
          <span
            style={{
              color: t.fg2,
              background: t.bg1,
              border: `1px solid ${t.border}`,
              borderRadius: 99,
              padding: '8px 18px',
            }}
          >
            fit
          </span>
        </div>

        <AgentCursor theme="dark" x={width / 2 + 40} y={460} label="grab" />

        <Caption theme="dark" frame={frame} from={132} text="multi-artboard. pan, zoom, ship." />
      </DottedCanvas>
    </AbsoluteFill>
  );
};
