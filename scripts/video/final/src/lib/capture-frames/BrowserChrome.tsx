import type React from 'react';
import { AbsoluteFill, OffthreadVideo, staticFile } from 'remotion';
import { tokens } from '../tokens';

/**
 * Wraps a Playwright-captured browser MP4 in mock browser chrome (macOS-style
 * traffic lights + URL bar) so it reads as "live UI" rather than "raw
 * screenshot."
 *
 * Pair with a Playwright config that uses viewport 1280×720 (not 1920×1080)
 * so the captured UI fills the source frame instead of leaving empty bg.
 * See scripts/video/playwright/playwright.config.ts for the canonical config.
 *
 * Usage:
 *   <BrowserChrome src="scene-dev-server.mp4" urlBar="localhost:4399" />
 *   <BrowserChrome src="x.mp4" playbackRate={1.2} startFrom={45} endAt={300} />
 *
 * `playbackRate` / `startFrom` / `endAt` pass through to <OffthreadVideo>.
 * NB: startFrom + endAt are frames-at-composition-fps, NOT seconds (DDR-037).
 */
type Props = {
  readonly src: string;
  readonly urlBar?: string;
  readonly padding?: string;
  readonly playbackRate?: number;
  readonly startFrom?: number;
  readonly endAt?: number;
  readonly transparentBackdrop?: boolean;
};

export const BrowserChrome: React.FC<Props> = ({
  src,
  urlBar = 'localhost',
  padding = '60px 120px',
  playbackRate,
  startFrom,
  endAt,
  transparentBackdrop = false,
}) => (
  <AbsoluteFill
    style={{
      backgroundColor: transparentBackdrop ? 'transparent' : tokens.dark.bg0,
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
        backgroundColor: '#1a1a1a',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          height: 36,
          backgroundColor: '#262626',
          display: 'flex',
          alignItems: 'center',
          paddingLeft: 16,
          gap: 8,
          flexShrink: 0,
        }}
      >
        <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff5f57' }} />
        <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#febc2e' }} />
        <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#28c840' }} />
        <div
          style={{
            marginLeft: 24,
            fontSize: 14,
            color: '#888',
            fontFamily: tokens.font.mono,
          }}
        >
          {urlBar}
        </div>
      </div>
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <OffthreadVideo
          src={staticFile(src)}
          muted
          playbackRate={playbackRate}
          startFrom={startFrom}
          endAt={endAt}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>
    </div>
  </AbsoluteFill>
);
