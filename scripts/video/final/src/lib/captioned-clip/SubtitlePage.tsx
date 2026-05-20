import type { TikTokPage } from '@remotion/captions';
import type React from 'react';
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { Page } from './Page';

/**
 * Spring-entrance wrapper around <Page>. Adapted from template-tiktok.
 * Damped to 200 (no overshoot) so captions don't bounce — our brand voice is
 * deliberate, not playful.
 */
const SubtitlePage: React.FC<{ readonly page: TikTokPage }> = ({ page }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({
    frame,
    fps,
    config: { damping: 200 },
    durationInFrames: 5,
  });

  return (
    <AbsoluteFill>
      <Page enterProgress={enter} page={page} />
    </AbsoluteFill>
  );
};

export default SubtitlePage;
