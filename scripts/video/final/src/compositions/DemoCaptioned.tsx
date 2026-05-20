import type { Caption } from '@remotion/captions';
import { AbsoluteFill } from 'remotion';
import captionsJson from '../../public/demo.json' assert { type: 'json' };
import { CaptionedClip } from '../lib/captioned-clip';

/**
 * DemoCaptioned — same Demo content, but with the captioned-clip overlay
 * proving the TikTok-style caption rendering pipeline works against a real
 * video + Caption[] JSON pair.
 *
 * Captions are hand-crafted in public/demo.json (skip the 466 MB Whisper
 * download for this smoke). The shape matches what sub.mjs would emit.
 */
export const DemoCaptioned = () => (
  <AbsoluteFill>
    <CaptionedClip src="demo.mp4" captions={captionsJson as Caption[]} />
  </AbsoluteFill>
);
