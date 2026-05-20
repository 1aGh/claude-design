import type React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { tokens } from '../../lib/tokens';

/**
 * 4 marketing benefit cards (2.5 s each in the final cut).
 * Paper bg, 1 px hairlines, SKU stamp top-left, catalog footer.
 * Berkeley Mono 96 pt headline, 24 pt subline.
 * Spring entrance for headline + subline.
 *
 * Copy lifted verbatim from storyboard.md § "Benefit cards".
 */

export type BenefitKind = 'local-figma' | 'all-in-one' | 'human-ai' | 'your-repo';

type CardCopy = {
  readonly sku: string;
  readonly headline: string;
  readonly subline: string;
  readonly accentPart?: string; // optional substring to amber-paint inside headline
};

const COPY: Record<BenefitKind, CardCopy> = {
  'local-figma': {
    sku: 'MDCC-MKT/01 · CARD · v0.16.0',
    headline: 'Local Figma. For Claude Code.',
    subline: 'Canvas-first iteration. In your repo. Under .design/.',
  },
  'all-in-one': {
    sku: 'MDCC-MKT/02 · CARD · v0.16.0',
    headline: 'Plan. Design. Ship.',
    subline: 'Two plugins, one CLI, some vibes.',
  },
  'human-ai': {
    sku: 'MDCC-MKT/03 · CARD · v0.16.0',
    headline: 'Human reads. AI iterates.',
    subline: 'Both sides speak the same canvas.',
  },
  'your-repo': {
    sku: 'MDCC-MKT/04 · CARD · v0.16.0',
    headline: 'Your repo. Yours forever.',
    subline: 'No telemetry. No signup. No book a demo button.',
  },
};

const FOOTER = 'github.com/1aGh/maude · 2 plugins · 1 CLI · zero telemetry';

type Props = { readonly kind: BenefitKind };

export const BenefitCard: React.FC<Props> = ({ kind }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const copy = COPY[kind];

  // Spring entrance for headline + subline (subline a touch delayed).
  const enterHead = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 18 });
  const enterSub = spring({
    frame: Math.max(0, frame - 6),
    fps,
    config: { damping: 200 },
    durationInFrames: 18,
  });
  const exit = interpolate(frame, [Math.max(0, durationInFrames - 8), durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const headOpacity = enterHead * exit;
  const subOpacity = enterSub * exit;
  const headTranslate = interpolate(enterHead, [0, 1], [24, 0]);
  const subTranslate = interpolate(enterSub, [0, 1], [16, 0]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: tokens.light.bg0,
        color: tokens.light.ink,
        fontFamily: tokens.font.mono,
        padding: '64px 96px',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* SKU stamp top-left */}
      <div
        style={{
          fontSize: 14,
          letterSpacing: '0.18em',
          color: tokens.light.inkMuted,
          textTransform: 'uppercase',
          borderTop: `1px solid ${tokens.light.rule}`,
          borderBottom: `1px solid ${tokens.light.rule}`,
          padding: '6px 0',
        }}
      >
        {copy.sku}
      </div>

      {/* Headline + subline, vertically centered */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          paddingTop: 24,
          paddingBottom: 24,
        }}
      >
        <div
          style={{
            opacity: headOpacity,
            transform: `translateY(${headTranslate}px)`,
            fontSize: 96,
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: '-0.02em',
            color: tokens.light.ink,
          }}
        >
          {renderHeadlineWithAccent(copy.headline, kind)}
        </div>
        <div
          style={{
            marginTop: 36,
            opacity: subOpacity,
            transform: `translateY(${subTranslate}px)`,
            fontSize: 28,
            color: tokens.light.inkMuted,
            letterSpacing: '0.01em',
            maxWidth: 1200,
          }}
        >
          {copy.subline}
        </div>
      </div>

      {/* Catalog footer */}
      <div
        style={{
          fontSize: 14,
          letterSpacing: '0.16em',
          color: tokens.light.inkMuted,
          textTransform: 'uppercase',
          borderTop: `1px solid ${tokens.light.rule}`,
          paddingTop: 10,
        }}
      >
        {FOOTER}
      </div>
    </AbsoluteFill>
  );
};

// Amber-rust accent over specific phrase per kind — keeps the card feeling
// catalog-stamp, not corporate.
function renderHeadlineWithAccent(headline: string, kind: BenefitKind): React.ReactNode {
  const accentMap: Record<BenefitKind, string | null> = {
    'local-figma': 'Local Figma.',
    'all-in-one': 'Ship.',
    'human-ai': 'iterates.',
    'your-repo': 'Yours forever.',
  };
  const accentPart = accentMap[kind];
  if (!accentPart) return headline;
  const idx = headline.indexOf(accentPart);
  if (idx < 0) return headline;
  const before = headline.slice(0, idx);
  const after = headline.slice(idx + accentPart.length);
  return (
    <>
      {before}
      <span style={{ color: tokens.light.accent }}>{accentPart}</span>
      {after}
    </>
  );
}
