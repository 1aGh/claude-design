import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { AgentCursor, Caption, Caret, DottedCanvas } from '../../../lib/maude-stage';
import { maude } from '../../../lib/maude-tokens';

/**
 * Scene 00 · Cold open — hook.
 *
 * ~3 s (90f @ 30fps). Signature: a caret pulses ALONE on an empty dotted void
 * (the "you start with nothing" beat), then the wordmark types in from the left
 * with the caret trailing as the insertion point. A single presence cursor
 * drifts in. Zero chrome. Intent: "maude" legible · single cursor · no UI.
 *
 * iter1 (structural): caret pulled out of the wordmark opacity wrapper so it is
 * the opening beat — fixes the iter0 signature miss (caret never read on void).
 */
export const ColdOpenScene = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = maude.dark;
  const cx = width / 2;
  const cy = height / 2;

  // Wordmark "types in" left→right via a max-width reveal; caret trails it as
  // the insertion point. Before frame 12 the reveal is 0 → only the caret shows,
  // centered, pulsing on the void.
  const typeIn = interpolate(frame, [12, 42], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const wmReveal = typeIn * 660; // px — comfortably past the rendered wordmark width

  // Single agent cursor drifts in from top-right, settles just past the unit.
  const drift = spring({ frame: frame - 6, fps, config: { damping: 60 }, durationInFrames: 40 });
  const curX = interpolate(drift, [0, 1], [cx + 540, cx + 270]);
  const curY = interpolate(drift, [0, 1], [cy - 360, cy + 18]);
  const curOpacity = interpolate(frame, [6, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill>
      <DottedCanvas theme="dark">
        {/* wordmark (max-width reveal) + trailing caret, centered as one unit */}
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <span
              style={{
                display: 'inline-block',
                maxWidth: wmReveal,
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                fontFamily: maude.font.display,
                fontWeight: 700,
                fontSize: 150,
                lineHeight: 1,
                letterSpacing: '-0.02em',
                color: t.fg0,
              }}
            >
              maude
            </span>
            <Caret theme="dark" frame={frame} height={104} width={6} />
          </div>
        </AbsoluteFill>

        <AgentCursor theme="dark" x={curX} y={curY} opacity={curOpacity} />

        <Caption
          theme="dark"
          frame={frame}
          from={54}
          text="you start with nothing — a dotted canvas and an idea."
        />
      </DottedCanvas>
    </AbsoluteFill>
  );
};
