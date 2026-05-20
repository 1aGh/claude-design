/**
 * Word-by-word caption page — adapted from remotion-dev/template-tiktok.
 *
 * Differences from upstream:
 *   - Font swapped from TheBoldFont (TikTok template's bundled OTF) to our
 *     load-font.ts JetBrains Mono (deterministic in CI; Berkeley Mono on
 *     the local dev machine via the OS font stack).
 *   - Colors sourced from lib/tokens.ts so brand-drift catches in the
 *     golden-frame harness.
 *   - Removed uppercase transform (our brand voice is sentence case, not
 *     SCREAMING marketing).
 */

import { makeTransform, scale, translateY } from '@remotion/animation-utils';
import type { TikTokPage } from '@remotion/captions';
import { fitText } from '@remotion/layout-utils';
import type React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { tokens } from '../tokens';

const DESIRED_FONT_SIZE = 96;

type Props = {
  readonly enterProgress: number;
  readonly page: TikTokPage;
  readonly highlightColor?: string;
  readonly textColor?: string;
  readonly bottomOffset?: number;
};

export const Page: React.FC<Props> = ({
  enterProgress,
  page,
  highlightColor = tokens.dark.accent,
  textColor = '#ffffff',
  bottomOffset = 220,
}) => {
  const frame = useCurrentFrame();
  const { width, fps } = useVideoConfig();
  const timeInMs = (frame / fps) * 1000;

  const fittedText = fitText({
    fontFamily: tokens.font.mono,
    text: page.text,
    withinWidth: width * 0.9,
  });
  const fontSize = Math.min(DESIRED_FONT_SIZE, fittedText.fontSize);

  void fps;

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'center',
        alignItems: 'center',
        top: undefined,
        bottom: bottomOffset,
        height: 160,
      }}
    >
      <div
        style={{
          fontSize,
          color: textColor,
          WebkitTextStroke: '14px black',
          paintOrder: 'stroke',
          transform: makeTransform([
            scale(interpolate(enterProgress, [0, 1], [0.8, 1])),
            translateY(interpolate(enterProgress, [0, 1], [50, 0])),
          ]),
          fontFamily: tokens.font.mono,
          letterSpacing: '0.01em',
        }}
      >
        {page.tokens.map((t) => {
          const startRelativeToSequence = t.fromMs - page.startMs;
          const endRelativeToSequence = t.toMs - page.startMs;
          const active = startRelativeToSequence <= timeInMs && endRelativeToSequence > timeInMs;
          return (
            <span
              key={t.fromMs}
              style={{
                display: 'inline',
                whiteSpace: 'pre',
                color: active ? highlightColor : textColor,
              }}
            >
              {t.text}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
