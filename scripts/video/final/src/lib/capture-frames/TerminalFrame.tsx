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
 *   <TerminalFrame src="x.mp4" playbackRate={1.5} startFrom={30} endAt={300} />
 *
 * `playbackRate` / `startFrom` / `endAt` pass through to <OffthreadVideo>.
 * NB: startFrom + endAt are frames-at-composition-fps, NOT seconds (DDR-037).
 */
type Props = {
  /** Filename under public/, e.g. "scene-terminal.mp4". */
  readonly src: string;
  /** Padding around the inset frame. Default = generous (matches Final.tsx). */
  readonly padding?: string;
  /** OffthreadVideo passthroughs. */
  readonly playbackRate?: number;
  readonly startFrom?: number;
  readonly endAt?: number;
  /** Hide the dark backdrop (split-screen halves provide their own bg). */
  readonly transparentBackdrop?: boolean;
};

export const TerminalFrame: React.FC<Props> = ({
  src,
  padding = '120px 200px',
  playbackRate,
  startFrom,
  endAt,
  transparentBackdrop = false,
}) => (
  <AbsoluteFill style={{ backgroundColor: transparentBackdrop ? 'transparent' : '#0e0e10' }}>
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
          playbackRate={playbackRate}
          startFrom={startFrom}
          endAt={endAt}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      </div>
    </AbsoluteFill>
  </AbsoluteFill>
);
