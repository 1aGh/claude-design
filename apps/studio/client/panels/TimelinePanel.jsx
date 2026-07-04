// TimelinePanel — DDR-148 bottom timeline for a video-comp.
//
// A horizontal, bottom-docked transport + track: play/pause/loop, a scrub, and
// one ROW PER SEQUENCE (parsed from the comp's raw .tsx by timeline-parse.js),
// each block positioned by frame with its animation (interpolate) windows
// marked as keyframe bars. Clicking a sequence seeks to its start; dragging
// anywhere on the track scrubs. It drives the embedded Player via postMessage
// (`dgn: 'timeline-seek' | -play | -pause`), consumed by video-comp.tsx.
//
// v1 is read-only rows (see + seek). Drag-to-retime a block / move a keyframe
// (source-patch) is the documented next slice.

import { useCallback, useEffect, useRef } from 'react';

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

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

function fmtTime(frame, fps) {
  const s = frame / (fps || 30);
  const whole = Math.floor(s);
  const cs = Math.round((s - whole) * 100);
  return `${whole}.${String(cs).padStart(2, '0')}s`;
}

export default function TimelinePanel({
  comps = [],
  sequences = [],
  total = 0,
  frame = 0,
  playing = false,
  loop = true,
  onSeek,
  onPlay,
  onPause,
  onToggleLoop,
  height,
  resizing,
  onClose,
}) {
  const comp = comps[0] ?? null;
  const totalFrames = Math.max(1, total || comp?.durationInFrames || 1);
  const fps = comp?.fps ?? 30;
  const clamped = clamp(Math.round(frame), 0, totalFrames - 1);
  const trackRef = useRef(null);
  const draggingRef = useRef(false);

  const seekAt = useCallback(
    (clientX) => {
      const el = trackRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const pct = clamp((clientX - r.left) / Math.max(1, r.width), 0, 1);
      onSeek?.(Math.round(pct * (totalFrames - 1)));
    },
    [onSeek, totalFrames]
  );

  useEffect(() => {
    if (!draggingRef.current) return undefined;
    const move = (e) => seekAt(e.clientX);
    const up = () => {
      draggingRef.current = false;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  });

  const onTrackDown = (e) => {
    // A click on a sequence block seeks to its start (handled there); a click on
    // the bare track scrubs + starts a drag.
    draggingRef.current = true;
    seekAt(e.clientX);
    // force the effect to (re)attach the window listeners
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  // Second ticks across the ruler.
  const secs = Math.max(1, Math.floor((totalFrames - 1) / fps));
  const ticks = Array.from({ length: secs + 1 }, (_, i) => (i * fps) / (totalFrames - 1));
  const pct = (f) => `${(clamp(f, 0, totalFrames - 1) / (totalFrames - 1)) * 100}%`;

  return (
    <aside
      className={`tl-panel${resizing ? ' is-resizing' : ''}`}
      style={height ? { height } : undefined}
      aria-label="Timeline"
      data-testid="timeline-panel"
    >
      <div className="tl-head">
        {comp ? (
          <>
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
            <button type="button" className="tl-btn" aria-label="Jump to start" onClick={() => onSeek?.(0)}>
              <TIcon name="start" />
            </button>
            <button
              type="button"
              className={`tl-btn${loop ? ' is-on' : ''}`}
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
              {totalFrames - 1}
              <span className="tl-time">{fmtTime(clamped, fps)}</span>
            </span>
          </>
        ) : (
          <span className="tl-title">Timeline</span>
        )}
        <span className="tl-spacer" />
        {comp ? <span className="tl-meta">{fps} fps · {totalFrames}f</span> : null}
        <button type="button" className="tl-x" aria-label="Close timeline" onClick={onClose}>
          ×
        </button>
      </div>

      {!comp ? (
        <div className="tl-empty" data-testid="timeline-empty">
          No animation on this canvas. Make an artboard a <b>video-comp</b>
          (<code>&lt;VideoComp&gt;</code>) to scrub and export it.
        </div>
      ) : (
        <div className="tl-scroll">
          <div
            className="tl-tracks"
            ref={trackRef}
            data-testid="timeline-track"
            onPointerDown={onTrackDown}
          >
            <div className="tl-ruler">
              {ticks.map((t, i) => (
                <span key={i} className="tl-tick" style={{ left: `${t * 100}%` }}>
                  <span className="tl-tick-label">{i}s</span>
                </span>
              ))}
            </div>

            {sequences.length === 0 ? (
              <div className="tl-row">
                <span className="tl-row-label">comp</span>
                <div className="tl-row-track">
                  <div className="tl-seq-block" style={{ left: '0%', width: '100%' }}>
                    <span className="tl-seq-name">whole composition</span>
                  </div>
                </div>
              </div>
            ) : (
              sequences.map((seq, i) => (
                <div className="tl-row" key={i} data-testid={`timeline-row-${i}`}>
                  <span className="tl-row-label" title={seq.label}>
                    {seq.label}
                  </span>
                  <div className="tl-row-track">
                    <button
                      type="button"
                      className="tl-seq-block"
                      data-testid={`timeline-seq-${i}`}
                      title={`${seq.label} · ${seq.from}–${seq.from + seq.duration}f`}
                      style={{ left: pct(seq.from), width: `${(seq.duration / (totalFrames - 1)) * 100}%` }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSeek?.(seq.from);
                      }}
                    >
                      <span className="tl-seq-name">{seq.label}</span>
                      {seq.keyframes.map((kf, k) => {
                        const l = ((kf.from - seq.from) / Math.max(1, seq.duration)) * 100;
                        const w = ((kf.to - kf.from) / Math.max(1, seq.duration)) * 100;
                        return (
                          <span
                            key={k}
                            className="tl-kf"
                            style={{ left: `${clamp(l, 0, 100)}%`, width: `${Math.max(1.5, w)}%` }}
                            title={`animates ${kf.from}–${kf.to}f`}
                          />
                        );
                      })}
                    </button>
                  </div>
                </div>
              ))
            )}

            <span
              className="tl-playhead"
              data-testid="timeline-playhead"
              style={{ left: `calc(96px + (100% - 96px) * ${(clamped / (totalFrames - 1)) || 0})` }}
            />
          </div>
        </div>
      )}
    </aside>
  );
}
