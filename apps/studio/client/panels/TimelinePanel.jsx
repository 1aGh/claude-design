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

import { useCallback, useEffect, useRef, useState } from 'react';

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
    sound: (
      <>
        <path d="M3 6h2.2L8 3.3v9.4L5.2 10H3z" fill="currentColor" stroke="none" />
        <path d="M10.5 5.5a3.2 3.2 0 0 1 0 5" />
        <path d="M12.3 3.7a5.6 5.6 0 0 1 0 8.6" />
      </>
    ),
    muted: (
      <>
        <path d="M3 6h2.2L8 3.3v9.4L5.2 10H3z" fill="currentColor" stroke="none" />
        <line x1="10.7" y1="6" x2="13.7" y2="10" />
        <line x1="13.7" y1="6" x2="10.7" y2="10" />
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
  audio = [],
  total = 0,
  frame = 0,
  playing = false,
  loop = true,
  onSeek,
  onPlay,
  onPause,
  onToggleLoop,
  muted = false,
  onToggleMute,
  volume = 1,
  onVolume,
  height,
  resizing,
  onResize,
  onRetime,
  onRemove,
  onClose,
}) {
  const comp = comps[0] ?? null;
  const totalFrames = Math.max(1, total || comp?.durationInFrames || 1);
  const fps = comp?.fps ?? 30;
  const clamped = clamp(Math.round(frame), 0, totalFrames - 1);
  const trackRef = useRef(null);
  const draggingRef = useRef(false);
  // Drag-to-retime a sequence's duration: { index, startX, startDur, rowW, curDur }.
  const [retimeDrag, setRetimeDrag] = useState(null);
  // Drag the top edge to resize the panel taller/shorter. Matches the DS
  // resize-panels reference: pointer-capture + window listeners attached
  // SYNCHRONOUSLY in pointerdown (a useEffect-on-state attaches a frame late and
  // drops the first moves — the "sticks / can't resize" jank).
  const beginResize = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      const startY = e.clientY;
      const startH = height || 216;
      const onMove = (ev) => {
        onResize?.(clamp(startH + (startY - ev.clientY), 140, 640));
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [height, onResize]
  );

  // The row-track's frame axis starts AFTER the fixed label gutter (96px).
  const LABEL_GUTTER = 96;
  const seekAt = useCallback(
    (clientX) => {
      const el = trackRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const axis = Math.max(1, r.width - LABEL_GUTTER);
      const pct = clamp((clientX - r.left - LABEL_GUTTER) / axis, 0, 1);
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
    if (retimeDrag) return; // a resize is in flight — don't scrub
    e.preventDefault(); // don't start a text selection while scrubbing
    draggingRef.current = true;
    seekAt(e.clientX);
    // force the effect to (re)attach the window listeners
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  // DDR-148 drag-to-retime — dragging a block's right edge rewrites its
  // durationInFrames (const-preferring on the server, so a derived total moves
  // in lock-step). The width previews live; the source patch lands on release.
  useEffect(() => {
    if (!retimeDrag) return undefined;
    const move = (e) => {
      const deltaFrames =
        ((e.clientX - retimeDrag.startX) / Math.max(1, retimeDrag.rowW)) * (totalFrames - 1);
      const curDur = Math.max(1, Math.round(retimeDrag.startDur + deltaFrames));
      setRetimeDrag((d) => (d ? { ...d, curDur } : d));
    };
    const up = () => {
      setRetimeDrag((d) => {
        if (d && d.curDur !== d.startDur) onRetime?.(d.index, { durationInFrames: d.curDur });
        return null;
      });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [retimeDrag, totalFrames, onRetime]);

  const startResize = (e, index, dur) => {
    e.stopPropagation();
    e.preventDefault();
    const rowTrack = e.currentTarget.closest('.tl-row-track');
    const rowW = rowTrack ? rowTrack.getBoundingClientRect().width : 300;
    setRetimeDrag({ index, startX: e.clientX, startDur: dur, rowW, curDur: dur });
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
      <div
        className="tl-resize-handle"
        data-testid="timeline-resize-handle"
        title="Drag to resize"
        onPointerDown={beginResize}
      />
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
            {audio.length > 0 ? (
              <button
                type="button"
                className={`tl-btn${muted ? '' : ' is-on'}`}
                aria-label={muted ? 'Unmute' : 'Mute'}
                aria-pressed={!muted}
                data-testid="timeline-mute"
                title={muted ? 'Unmute audio' : 'Mute audio'}
                onClick={() => onToggleMute?.()}
              >
                <TIcon name={muted ? 'muted' : 'sound'} />
              </button>
            ) : null}
            {audio.length > 0 ? (
              <input
                type="range"
                className="tl-volume"
                min="0"
                max="100"
                value={Math.round((muted ? 0 : volume) * 100)}
                data-testid="timeline-volume"
                aria-label="Volume"
                title="Volume"
                onChange={(e) => onVolume?.(Number(e.target.value) / 100)}
              />
            ) : null}
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
              sequences.map((seq, i) => {
                const dur =
                  retimeDrag && retimeDrag.index === i ? retimeDrag.curDur : seq.duration;
                const resizing = !!(retimeDrag && retimeDrag.index === i);
                return (
                  <div className="tl-row" key={i} data-testid={`timeline-row-${i}`}>
                    <span className="tl-row-label" title={seq.label}>
                      {seq.label}
                    </span>
                    <div className="tl-row-track">
                      <button
                        type="button"
                        className={`tl-seq-block${resizing ? ' is-resizing' : ''}`}
                        data-testid={`timeline-seq-${i}`}
                        title={`${seq.label} · ${seq.from}–${seq.from + dur}f (${dur}f)`}
                        style={{
                          left: pct(seq.from),
                          width: `${(dur / (totalFrames - 1)) * 100}%`,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSeek?.(seq.from);
                        }}
                      >
                        <span className="tl-seq-name">
                          {seq.label}
                          {resizing ? ` · ${dur}f` : ''}
                        </span>
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
                      {onRetime ? (
                        <span
                          className="tl-seq-resize"
                          data-testid={`timeline-resize-${i}`}
                          title="Drag to retime this sequence"
                          style={{
                            left: `calc(${pct(seq.from)} + ${(dur / (totalFrames - 1)) * 100}% - 5px)`,
                          }}
                          onPointerDown={(e) => startResize(e, i, seq.duration)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : null}
                      {onRemove ? (
                        <button
                          type="button"
                          className="tl-seq-remove"
                          data-testid={`timeline-remove-${i}`}
                          title="Remove this clip"
                          aria-label={`Remove ${seq.label}`}
                          style={{
                            left: `calc(${pct(seq.from)} + ${(dur / (totalFrames - 1)) * 100}% - 17px)`,
                          }}
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemove(i);
                          }}
                        >
                          ×
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}

            {audio.map((a, i) => (
              <div className="tl-row" key={`a${i}`} data-testid={`timeline-audio-${i}`}>
                <span className="tl-row-label" title={a.label}>
                  ♪ {a.label}
                </span>
                <div className="tl-row-track">
                  <div
                    className="tl-audio-block"
                    title={`${a.label} · ${a.from}–${a.from + a.duration}f`}
                    style={{
                      left: pct(a.from),
                      width: `${(a.duration / (totalFrames - 1)) * 100}%`,
                    }}
                  >
                    <svg className="tl-wave" viewBox="0 0 100 12" preserveAspectRatio="none" aria-hidden>
                      <path d="M0 6 Q2 1 4 6 T8 6 T12 6 T16 6 T20 6 T24 6 T28 6 T32 6 T36 6 T40 6 T44 6 T48 6 T52 6 T56 6 T60 6 T64 6 T68 6 T72 6 T76 6 T80 6 T84 6 T88 6 T92 6 T96 6 T100 6" />
                    </svg>
                    <span className="tl-seq-name">{a.label}</span>
                  </div>
                </div>
              </div>
            ))}

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
