/**
 * <CaptionedClip src="public/scene-02.mp4" captions="public/scene-02.json" />
 *
 * Hides the prop-drilling of the upstream TikTok template. Wraps an
 * <OffthreadVideo> with per-page word-by-word captions driven by the
 * Caption[] JSON written by sub.mjs.
 *
 * If captionsJson is null/undefined, renders the clip without captions —
 * useful for scenes where the burnt-in lower-third caption belongs to a
 * different component.
 */

import { type Caption, createTikTokStyleCaptions } from '@remotion/captions';
import type React from 'react';
import { useMemo } from 'react';
import { AbsoluteFill, OffthreadVideo, Sequence, staticFile, useVideoConfig } from 'remotion';
import SubtitlePage from './SubtitlePage';

type Props = {
  /** Path under public/, e.g. "scene-02-maude-init.mp4". */
  readonly src: string;
  /** Caption[] JSON produced by sub.mjs. Pass `null` to disable captions. */
  readonly captions: Caption[] | null;
  /** Max ms per caption page. Default = 1200 (3-4 words at normal cadence). */
  readonly combineTokensWithinMilliseconds?: number;
};

export const CaptionedClip: React.FC<Props> = ({
  src,
  captions,
  combineTokensWithinMilliseconds = 1200,
}) => {
  const { fps } = useVideoConfig();
  const { pages } = useMemo(() => {
    if (!captions) return { pages: [] };
    return createTikTokStyleCaptions({
      captions,
      combineTokensWithinMilliseconds,
    });
  }, [captions, combineTokensWithinMilliseconds]);

  return (
    <AbsoluteFill>
      <OffthreadVideo src={staticFile(src)} />
      {pages.map((page) => {
        const fromFrame = Math.floor((page.startMs / 1000) * fps);
        const durationFrames = Math.max(
          1,
          Math.ceil((((page.tokens.at(-1)?.toMs ?? page.startMs) - page.startMs) / 1000) * fps)
        );
        return (
          <Sequence
            key={`${page.startMs}-${page.text}`}
            from={fromFrame}
            durationInFrames={durationFrames}
          >
            <SubtitlePage page={page} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
