import type React from 'react';
import { AbsoluteFill, OffthreadVideo, staticFile } from 'remotion';

/**
 * Wraps a VHS-captured terminal MP4 in a centered inset frame with shadow.
 * Pair with a tape that follows the discipline at tapes/_TEMPLATE.tape:
 *   - 1280×720 canvas (so objectFit:contain centers cleanly)
 *   - Hide+clear+Show before the demo command
 *
 * Usage:
 *   <TerminalFrame src="scene-maude-init.mp4" />
 *
 * For the assembled cut, parent <Sequence> sets duration; this component
 * only owns the visual frame.
 */
type Props = {
  /** Filename under public/, e.g. "scene-terminal.mp4". */
  readonly src: string;
  /** Padding around the inset frame. Default = generous (matches Final.tsx). */
  readonly padding?: string;
};

export const TerminalFrame: React.FC<Props> = ({ src, padding = '120px 200px' }) => (
  <AbsoluteFill style={{ backgroundColor: '#0e0e10' }}>
    <AbsoluteFill
      style={{
        padding,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
          backgroundColor: '#1e1f29',
        }}
      >
        <OffthreadVideo
          src={staticFile(src)}
          muted
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      </div>
    </AbsoluteFill>
  </AbsoluteFill>
);
