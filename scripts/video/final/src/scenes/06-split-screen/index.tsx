import type React from 'react';
import { AbsoluteFill } from 'remotion';
import { BrowserChrome, TerminalFrame } from '../../lib/capture-frames';
import { tokens } from '../../lib/tokens';

/**
 * SplitScreenFrame — 50/50 composite for "cause + effect" capture pairs.
 *
 * Left half: VHS Claude TUI recording (terminal frame).
 * Right half: Playwright dev-server iframe recording (browser chrome).
 * 1 px DS-token hairline rule between the halves.
 *
 * Both halves wrap their source MP4 with passthroughs to <OffthreadVideo>;
 * use rightStartFrom (in COMPOSITION FRAMES, not seconds) to align the
 * "Enter pressed" moment on the left with the "canvas appears" moment on
 * the right.
 *
 * Usage:
 *   <SplitScreenFrame
 *     leftSrc="scene-tui-new.mp4"
 *     rightSrc="scene-canvas-appears.mp4"
 *     rightStartFrom={45}
 *     leftLabel="TUI"
 *     rightLabel="DEV SERVER"
 *     urlBar="localhost:4400"
 *   />
 */
type Props = {
  readonly leftSrc: string;
  readonly rightSrc: string;
  readonly leftStartFrom?: number;
  readonly rightStartFrom?: number;
  readonly leftEndAt?: number;
  readonly rightEndAt?: number;
  readonly leftPlaybackRate?: number;
  readonly rightPlaybackRate?: number;
  readonly leftLabel?: string;
  readonly rightLabel?: string;
  readonly urlBar?: string;
};

export const SplitScreenFrame: React.FC<Props> = ({
  leftSrc,
  rightSrc,
  leftStartFrom,
  rightStartFrom,
  leftEndAt,
  rightEndAt,
  leftPlaybackRate,
  rightPlaybackRate,
  leftLabel = 'TUI',
  rightLabel = 'DEV SERVER',
  urlBar = 'localhost:4400',
}) => (
  <AbsoluteFill style={{ backgroundColor: tokens.dark.bg0, flexDirection: 'row' }}>
    <div style={{ position: 'relative', flex: 1, height: '100%' }}>
      <TerminalFrame
        src={leftSrc}
        padding="60px 60px"
        playbackRate={leftPlaybackRate}
        startFrom={leftStartFrom}
        endAt={leftEndAt}
        transparentBackdrop
      />
      <Label text={leftLabel} side="left" />
    </div>
    <div
      style={{
        width: 1,
        height: '100%',
        backgroundColor: tokens.dark.rule,
        flexShrink: 0,
      }}
    />
    <div style={{ position: 'relative', flex: 1, height: '100%' }}>
      <BrowserChrome
        src={rightSrc}
        urlBar={urlBar}
        padding="60px 60px"
        playbackRate={rightPlaybackRate}
        startFrom={rightStartFrom}
        endAt={rightEndAt}
        transparentBackdrop
      />
      <Label text={rightLabel} side="right" />
    </div>
  </AbsoluteFill>
);

const Label: React.FC<{ readonly text: string; readonly side: 'left' | 'right' }> = ({
  text,
  side,
}) => (
  <div
    style={{
      position: 'absolute',
      top: 24,
      [side === 'left' ? 'right' : 'left']: 24,
      fontFamily: tokens.font.mono,
      fontSize: 14,
      letterSpacing: '0.12em',
      color: tokens.dark.inkMuted,
      textTransform: 'uppercase',
      padding: '4px 10px',
      border: `1px solid ${tokens.dark.rule}`,
      borderRadius: 2,
      background: 'rgba(0,0,0,0.35)',
    }}
  >
    {text}
  </div>
);
