/**
 * @file       participants-chrome.tsx — top-right avatar stack of live peers
 * @scope      plugins/design/dev-server/participants-chrome.tsx
 * @purpose    Phase 8 Task 6 — show who's currently on the canvas. Colored
 *             initials in a circle per peer, with a popover for full name +
 *             "Follow" button. Follow mode publishes `followTarget` on my
 *             Awareness; a separate effect pulls the target's viewport on
 *             every update and calls controller.setViewport, snapping my pan
 *             + zoom to theirs in lockstep.
 *
 * Follow semantics — soft and one-way. The target peer doesn't know they're
 * being followed (no UI, no Awareness echo). Either party panning the canvas
 * breaks nothing on the other end; I just keep mirroring until I click my
 * own avatar to release. tldraw-style.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useViewportControllerContext } from './canvas-lib.tsx';
import { type ForeignAwareness, useCollab, useForeignAwareness } from './use-collab.tsx';

const CHROME_CSS = `
.dc-participants {
  position: fixed;
  top: 12px;
  right: 12px;
  z-index: 10000;
  display: flex;
  align-items: center;
  gap: -6px;
  pointer-events: auto;
}
.dc-participant {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font: 600 11px/1 system-ui, -apple-system, sans-serif;
  color: #fff;
  border: 2px solid #fff;
  margin-left: -6px;
  cursor: pointer;
  position: relative;
  box-shadow: 0 1px 2px rgba(0,0,0,0.15);
  user-select: none;
  transition: transform 120ms ease, z-index 0ms 120ms;
}
.dc-participant:first-child { margin-left: 0; }
.dc-participant:hover {
  transform: scale(1.08);
  z-index: 10;
  transition-delay: 0ms;
}
.dc-participant--following {
  outline: 2px solid #06b6d4;
  outline-offset: 1px;
}
.dc-participant-popover {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  min-width: 140px;
  padding: 8px 10px;
  background: #1f2937;
  color: #f9fafb;
  border-radius: 6px;
  font: 12px/1.3 system-ui, -apple-system, sans-serif;
  white-space: nowrap;
  box-shadow: 0 4px 12px rgba(0,0,0,0.25);
  z-index: 11;
}
.dc-participant-popover__name {
  font-weight: 600;
  margin-bottom: 6px;
}
.dc-participant-popover__btn {
  display: inline-block;
  padding: 3px 8px;
  background: #06b6d4;
  color: #022c33;
  border: none;
  border-radius: 4px;
  font: 500 11px/1.2 system-ui, -apple-system, sans-serif;
  cursor: pointer;
}
.dc-participant-popover__btn--stop {
  background: #fca5a5;
  color: #7f1d1d;
}
@media (prefers-reduced-motion: reduce) {
  .dc-participant { transition: none; }
}
`.trim();

function ensureChromeStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById('dc-participants-css')) return;
  const s = document.createElement('style');
  s.id = 'dc-participants-css';
  s.textContent = CHROME_CSS;
  document.head.appendChild(s);
}

function initialsFor(name: string): string {
  const cleaned = name.trim();
  if (!cleaned) return '?';
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

interface AvatarProps {
  peer: ForeignAwareness;
  isFollowing: boolean;
  onToggleFollow: (clientID: number) => void;
}

function Avatar({ peer, isFollowing, onToggleFollow }: AvatarProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={`dc-participant${isFollowing ? ' dc-participant--following' : ''}`}
      style={{ background: peer.color }}
      onClick={() => setOpen((v) => !v)}
      title={peer.name}
      aria-label={peer.name}
    >
      {initialsFor(peer.name)}
      {open && (
        <div className="dc-participant-popover" onClick={(e) => e.stopPropagation()}>
          <div className="dc-participant-popover__name">{peer.name}</div>
          <button
            type="button"
            className={`dc-participant-popover__btn${isFollowing ? ' dc-participant-popover__btn--stop' : ''}`}
            onClick={() => {
              onToggleFollow(peer.clientID);
              setOpen(false);
            }}
          >
            {isFollowing ? 'Stop following' : `Follow ${peer.name.split(/\s+/)[0]}`}
          </button>
        </div>
      )}
    </div>
  );
}

export function ParticipantsChrome(): JSX.Element | null {
  ensureChromeStyles();
  const collab = useCollab();
  const peers = useForeignAwareness();
  const controller = useViewportControllerContext();

  const [followTarget, setFollowTarget] = useState<number | null>(null);

  const onToggleFollow = useCallback(
    (clientID: number) => {
      setFollowTarget((prev) => (prev === clientID ? null : clientID));
      if (collab) {
        collab.publishAwareness({
          selection: collab.awareness.getLocalState()?.selection ?? null,
        });
        // Tag follow target as an Awareness key so Phase 9 follow-back UIs
        // can read it; not currently used by anything else.
        const state = collab.awareness.getLocalState() ?? {};
        collab.awareness.setLocalState({
          ...state,
          followTarget: clientID === followTarget ? null : clientID,
        });
      }
    },
    [collab, followTarget]
  );

  // Apply follow — when followTarget is set, mirror the target's viewport
  // onto our local controller. Each peer-Awareness update re-fires this; we
  // skip when the viewport hasn't actually changed (saves a controller write).
  const lastAppliedRef = useRef<{ x: number; y: number; zoom: number } | null>(null);
  useEffect(() => {
    if (followTarget === null) {
      lastAppliedRef.current = null;
      return;
    }
    if (!controller) return;
    const target = peers.find((p) => p.clientID === followTarget);
    if (!target) {
      // Target peer disconnected; release follow.
      setFollowTarget(null);
      return;
    }
    const v = target.viewport;
    const last = lastAppliedRef.current;
    if (last && last.x === v.x && last.y === v.y && last.zoom === v.zoom) return;
    lastAppliedRef.current = { x: v.x, y: v.y, zoom: v.zoom };
    controller.setViewport(v);
  }, [controller, followTarget, peers]);

  if (peers.length === 0) return null;

  return (
    <div className="dc-participants" aria-label="Active collaborators">
      {peers.map((p) => (
        <Avatar
          key={p.clientID}
          peer={p}
          isFollowing={followTarget === p.clientID}
          onToggleFollow={onToggleFollow}
        />
      ))}
    </div>
  );
}

export { initialsFor };
