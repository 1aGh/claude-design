import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { Caption, DottedCanvas } from '../../../lib/maude-stage';
import { maude } from '../../../lib/maude-tokens';

/**
 * Scene 50 · Handoff — payoff.
 *
 * ~6 s (180f @ 30fps). Signature: export tiles fan out — shadcn / PNG / code →
 * into the repo. Intent: shadcn + code tiles legible · arrow to repo.
 */
export const HandoffScene = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = maude.dark;

  const tiles = [
    { label: 'shadcn', sub: 'registry-item.json', rot: -8 },
    { label: 'PNG', sub: '1920×1080', rot: -3 },
    { label: 'code', sub: 'Recipe Recap.tsx', rot: 3 },
    { label: 'PDF', sub: 'print-ready', rot: 8 },
  ];

  const arrowIn = spring({
    frame: frame - 96,
    fps,
    config: { damping: 200 },
    durationInFrames: 14,
  });
  const repoIn = spring({
    frame: frame - 112,
    fps,
    config: { damping: 200 },
    durationInFrames: 16,
  });

  return (
    <AbsoluteFill>
      <DottedCanvas theme="dark" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 60 }}>
          {/* fanned export tiles */}
          <div style={{ position: 'relative', width: 820, height: 320 }}>
            {tiles.map((tile, i) => {
              const s = spring({
                frame: frame - (10 + i * 8),
                fps,
                config: { damping: 14, mass: 0.8 },
                durationInFrames: 24,
              });
              const spread = interpolate(s, [0, 1], [0, (i - 1.5) * 196]);
              const rot = interpolate(s, [0, 1], [0, tile.rot]);
              const isAccent = tile.label === 'shadcn';
              return (
                <div
                  key={tile.label}
                  style={{
                    position: 'absolute',
                    left: 310,
                    top: 70,
                    width: 190,
                    height: 180,
                    transform: `translateX(${spread}px) rotate(${rot}deg) scale(${s})`,
                    transformOrigin: 'center bottom',
                    background: isAccent ? t.accent : t.bg1,
                    color: isAccent ? t.accentFg : t.fg0,
                    border: `1px solid ${isAccent ? t.accent : t.border}`,
                    borderRadius: 16,
                    boxShadow: '0 18px 50px rgba(0,0,0,0.45)',
                    padding: 24,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-end',
                    gap: 6,
                    opacity: s,
                  }}
                >
                  <span style={{ fontFamily: maude.font.display, fontWeight: 700, fontSize: 34 }}>
                    {tile.label}
                  </span>
                  <span
                    style={{
                      fontFamily: maude.font.mono,
                      fontSize: 15,
                      color: isAccent ? t.accentFg : t.fg2,
                    }}
                  >
                    {tile.sub}
                  </span>
                </div>
              );
            })}
          </div>

          {/* arrow */}
          <div
            style={{ opacity: arrowIn, fontFamily: maude.font.mono, fontSize: 40, color: t.accent }}
          >
            →
          </div>

          {/* repo card */}
          <div
            style={{
              opacity: repoIn,
              transform: `translateX(${interpolate(repoIn, [0, 1], [20, 0])}px)`,
              width: 360,
              background: t.bg1,
              border: `1px solid ${t.border}`,
              borderRadius: 16,
              boxShadow: '0 18px 50px rgba(0,0,0,0.45)',
              padding: 26,
              fontFamily: maude.font.mono,
            }}
          >
            <div style={{ fontSize: 18, color: t.fg2, letterSpacing: '0.05em', marginBottom: 16 }}>
              YOUR REPO
            </div>
            {[
              '+ components/recipe-recap.tsx',
              '+ registry/recipe-recap.json',
              '+ public/recipe-recap.png',
            ].map((l) => (
              <div key={l} style={{ fontSize: 19, color: t.success, lineHeight: 1.9 }}>
                {l}
              </div>
            ))}
          </div>
        </div>

        <Caption
          theme="dark"
          frame={frame}
          from={138}
          text="then hand off — straight into the repo."
        />
      </DottedCanvas>
    </AbsoluteFill>
  );
};
