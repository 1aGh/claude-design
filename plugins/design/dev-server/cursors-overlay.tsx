/**
 * @file       cursors-overlay.tsx — foreign peer cursors rendered on the canvas
 * @scope      plugins/design/dev-server/cursors-overlay.tsx
 * @purpose    Renders one colored SVG arrow + name label per foreign peer at
 *             their published world coords, transformed through the local
 *             viewport so the cursor anchors to canvas content (not to my
 *             screen) — the standard Excalidraw / tldraw multiplayer model.
 *
 * Render shape:
 *   <div position:fixed top:0 left:0 pointer-events:none>
 *     <Cursor for each foreign peer />
 *   </div>
 *
 * Each cursor is positioned via `transform: translate(screenX px, screenY px)`
 * where (screenX, screenY) = world * viewport.zoom + viewport.{x,y}. No
 * react-spring / lerp in this ship (just last-known-position render); the
 * 30 Hz publish cadence keeps it smooth enough for the multiplayer demo.
 */

import { memo, useEffect, useState } from 'react';

import { useViewportControllerContext } from './canvas-lib.tsx';
import { type ForeignAwareness, useForeignAwareness } from './use-collab.tsx';

const CURSOR_CSS = `
.dc-cursor-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 10000;
}
.dc-cursor {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  will-change: transform;
  /* The arrow tip is the (0,0) anchor of the SVG; the label hangs to the
     bottom-right so it never occludes the tip itself. */
}
.dc-cursor-arrow {
  display: block;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.25));
}
.dc-cursor-label {
  position: absolute;
  top: 18px;
  left: 14px;
  padding: 2px 6px;
  font: 500 11px/1.2 system-ui, -apple-system, sans-serif;
  color: #fff;
  border-radius: 4px;
  white-space: nowrap;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}
@media (prefers-reduced-motion: reduce) {
  .dc-cursor { transition: none !important; }
}
`.trim();

function ensureCursorStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById('dc-cursor-overlay-css')) return;
  const s = document.createElement('style');
  s.id = 'dc-cursor-overlay-css';
  s.textContent = CURSOR_CSS;
  document.head.appendChild(s);
}

interface ViewportSnapshot {
  x: number;
  y: number;
  zoom: number;
}

interface CursorProps {
  peer: ForeignAwareness;
  viewport: ViewportSnapshot;
}

const Cursor = memo(function Cursor({ peer, viewport }: CursorProps): JSX.Element | null {
  if (!peer.cursor) return null;
  // world → screen: screen = world * zoom + viewport.{x,y}
  const screenX = peer.cursor.x * viewport.zoom + viewport.x;
  const screenY = peer.cursor.y * viewport.zoom + viewport.y;
  return (
    <div className="dc-cursor" style={{ transform: `translate(${screenX}px, ${screenY}px)` }}>
      <svg
        className="dc-cursor-arrow"
        width="20"
        height="22"
        viewBox="0 0 20 22"
        aria-hidden="true"
      >
        <path
          d="M 2 2 L 2 18 L 6 14 L 9 21 L 12 20 L 9 13 L 14 13 Z"
          fill={peer.color}
          stroke="#fff"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </svg>
      <div className="dc-cursor-label" style={{ background: peer.color }}>
        {peer.name}
      </div>
    </div>
  );
});

/**
 * Subscribes to foreign awareness + the local viewport. Renders one Cursor per
 * peer. Reads viewport from `useViewportControllerContext` — if the canvas
 * doesn't expose a controller (rare edge case), falls back to identity.
 */
export function CursorsOverlay(): JSX.Element {
  ensureCursorStyles();
  const peers = useForeignAwareness();
  const controller = useViewportControllerContext();
  const liveVp = controller?.viewport ?? { x: 0, y: 0, zoom: 1 };
  // Take a snapshot per render — controller.viewport already changes on
  // throttle, so this stays smooth enough at 30 Hz.
  const [vp, setVp] = useState<ViewportSnapshot>(liveVp);
  useEffect(() => {
    setVp({ x: liveVp.x, y: liveVp.y, zoom: liveVp.zoom });
  }, [liveVp.x, liveVp.y, liveVp.zoom]);
  return (
    <div className="dc-cursor-overlay" aria-hidden="true">
      {peers.map((peer) => (
        <Cursor key={peer.clientID} peer={peer} viewport={vp} />
      ))}
    </div>
  );
}
