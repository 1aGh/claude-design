// TimelinePanel — DDR-148 shell panel for scrubbing/driving a video-comp.
//
// A minimal maude-styled transport over the embedded Remotion <Player>: play /
// pause / loop, a scrub bar, a frame·time readout, and a playhead track. It
// drives the active canvas iframe via postMessage (`dgn: 'timeline-seek' |
// 'timeline-play' | 'timeline-pause'`), which video-comp.tsx consumes to move
// the Player. Comp meta arrives from the iframe's `timeline-comps` announce and
// the live playhead from `timeline-frame`.
//
// NOT an NLE. v1 is transport + scrub over the whole comp. Per-sequence rows +
// drag-to-retime (source-patch) are the documented follow-up — they need a
// raw-source read + the canvas-edit patch path (DDR-148 open items).

import { useCallback, useMemo } from 'react';

function TIcon({ name, size = 15 }) {
  const paths = {
    play: <path d="M4 3l9 5-9 5z" fill="currentColor" stroke="none" />,
    pause: (
      <>
        <rect x="4" y="3.5" width="3" height="9" fill="currentColor" stroke="none" />
        <rect x="9" y="3.5" width="3" height="9" fill="currentColor" stroke="none" />
      </>
    ),
    loop: (
      <>
        <polyline points="4 4 4 7 7 7" />
        <path d="M4 7a4.5 4.5 0 1 1 1.3 4.6" />
      </>
    ),
    start: (
      <>
        <line x1="4.5" y1="3.5" x2="4.5" y2="12.5" />
        <path d="M12 3.5l-6 4.5 6 4.5z" fill="currentColor" stroke="none" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

function fmtTime(frame, fps) {
  const s = frame / (fps || 30);
  const whole = Math.floor(s);
  const cs = Math.round((s - whole) * 100);
  return `${whole}.${String(cs).padStart(2, '0')}s`;
}

export default function TimelinePanel({
  comps = [],
  frame = 0,
  playing = false,
  loop = true,
  onSeek,
  onPlay,
  onPause,
  onToggleLoop,
  width,
  resizing,
  onClose,
}) {
  // v1 drives the primary (first) comp on the canvas; multi-comp canvases scrub
  // them together (the seek bridge broadcasts to every registered comp).
  const comp = comps[0] ?? null;
  const total = comp ? Math.max(1, comp.durationInFrames) : 1;
  const clamped = Math.max(0, Math.min(total - 1, Math.round(frame)));
  const pct = total > 1 ? (clamped / (total - 1)) * 100 : 0;

  const seek = useCallback(
    (f) => onSeek?.(Math.max(0, Math.min(total - 1, Math.round(f)))),
    [onSeek, total]
  );

  const marks = useMemo(() => {
    if (!comp) return [];
    // Second-boundary ticks across the track (light structure, no NLE rows yet).
    const secs = Math.floor((total - 1) / comp.fps);
    return Array.from({ length: secs + 1 }, (_, i) => (i * comp.fps) / (total - 1));
  }, [comp, total]);

  return (
    <aside
      className={'st-rpanel tl-panel' + (resizing ? ' is-resizing' : '')}
      style={width ? { width, flexBasis: width } : undefined}
      aria-label="Timeline"
      data-testid="timeline-panel"
    >
      <div className="tl-head">
        <span className="tl-title">Timeline</span>
        <span className="tl-spacer" />
        {comp ? <span className="tl-meta">{comp.fps} fps · {total}f</span> : null}
        <button type="button" className="tl-x" aria-label="Close" onClick={onClose}>
          ×
        </button>
      </div>

      {!comp ? (
        <div className="tl-empty" data-testid="timeline-empty">
          No animation on this canvas. Make an artboard a <b>video-comp</b>
          (<code>&lt;VideoComp&gt;</code>) to scrub and export it.
        </div>
      ) : (
        <div className="tl-body">
          <div className="tl-transport">
            <button
              type="button"
              className="tl-btn tl-btn-primary"
              aria-label={playing ? 'Pause' : 'Play'}
              aria-pressed={playing}
              data-testid="timeline-playpause"
              onClick={() => (playing ? onPause?.() : onPlay?.())}
            >
              <TIcon name={playing ? 'pause' : 'play'} />
            </button>
            <button
              type="button"
              className="tl-btn"
              aria-label="Jump to start"
              onClick={() => seek(0)}
            >
              <TIcon name="start" />
            </button>
            <button
              type="button"
              className={'tl-btn' + (loop ? ' is-on' : '')}
              aria-label="Loop"
              aria-pressed={loop}
              data-testid="timeline-loop"
              onClick={() => onToggleLoop?.()}
            >
              <TIcon name="loop" />
            </button>
            <span className="tl-readout" data-testid="timeline-readout">
              <b>{clamped}</b>
              <span className="tl-sep">/</span>
              {total - 1}
              <span className="tl-time">{fmtTime(clamped, comp.fps)}</span>
            </span>
          </div>

          <div className="tl-track" data-testid="timeline-track">
            {marks.map((m, i) => (
              <span key={i} className="tl-tick" style={{ left: `${m * 100}%` }} />
            ))}
            <span
              className="tl-playhead"
              data-testid="timeline-playhead"
              style={{ left: `${pct}%` }}
            />
            <input
              type="range"
              className="tl-scrub"
              min={0}
              max={total - 1}
              step={1}
              value={clamped}
              aria-label="Scrub frame"
              data-testid="timeline-scrub"
              onChange={(e) => seek(Number(e.target.value))}
            />
          </div>

          <p className="tl-hint">
            Export this artboard with <code>⌘E</code> → MP4 / GIF, or
            <code> /design:export mp4</code>.
          </p>
        </div>
      )}
    </aside>
  );
}
