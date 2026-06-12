/**
 * @file       cursors-overlay.tsx — foreign peer cursors rendered on the canvas
 * @scope      apps/studio/cursors-overlay.tsx
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
import { type ForeignAwareness, useCollab, useForeignAwareness } from './use-collab.tsx';

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
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.4));
}
/* DS colors-presence .cur-label recipe — hue pill, mono 10px, dark
 * accent-fg text (never white-on-hue, which washed out on light hues).
 * NOTE: keep this comment backtick-free — it lives inside the CURSOR_CSS
 * template literal and a stray backtick closes it. */
.dc-cursor-label {
  position: absolute;
  top: 16px;
  left: 12px;
  padding: 1px 8px;
  font-family: var(--font-mono, ui-monospace, monospace);
  font-weight: 500;
  font-size: 10px;
  line-height: 1.4;
  color: var(--maude-hud-accent-fg, oklch(0.180 0.030 268));
  border-radius: 999px;
  white-space: nowrap;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.dc-peer-selection {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  border: 2px solid;
  border-radius: var(--radius-sm, 2px);
  box-sizing: border-box;
  will-change: transform, width, height;
}
.dc-peer-selection__label {
  position: absolute;
  top: -18px;
  left: -2px;
  padding: 1px 5px;
  font-family: var(--font-sans, system-ui, -apple-system, sans-serif);
  font-weight: 600;
  font-size: 10px;
  line-height: 1.3;
  color: var(--maude-hud-accent-fg, #fff);
  border-radius: var(--radius-sm, 2px) var(--radius-sm, 2px) 0 0;
  white-space: nowrap;
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
 * Foreign-selection halos for stamped annotation strokes. Each peer publishes
 * `annotationSelection: string[]` — stroke `data-id` values from Phase 5.
 * We resolve each via `[data-id="<id>"]` and render an outlined rect at the
 * element's current screen bounds. Re-runs every render so geometry changes
 * (resize, move) stay in sync without manual re-publish.
 */
interface PeerAnnotationSelectionProps {
  peer: ForeignAwareness;
}

const PeerAnnotationSelection = memo(function PeerAnnotationSelection({
  peer,
}: PeerAnnotationSelectionProps): JSX.Element | null {
  if (!peer.annotationSelection || peer.annotationSelection.length === 0) return null;
  if (typeof document === 'undefined') return null;
  const rects: { id: string; x: number; y: number; w: number; h: number }[] = [];
  for (const id of peer.annotationSelection) {
    try {
      const el = document.querySelector(`[data-id="${CSS.escape(id)}"]`);
      if (!el) continue;
      const r = (el as Element).getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      // Pad by 3px so the halo sits OUTSIDE the stroke instead of clipping it.
      rects.push({ id, x: r.left - 3, y: r.top - 3, w: r.width + 6, h: r.height + 6 });
    } catch {
      /* invalid id token — skip */
    }
  }
  if (rects.length === 0) return null;
  return (
    <>
      {rects.map((r, i) => (
        <div
          key={r.id}
          className="dc-peer-selection"
          style={{
            transform: `translate(${r.x}px, ${r.y}px)`,
            width: r.w,
            height: r.h,
            borderColor: peer.color,
          }}
        >
          {i === 0 && (
            <div className="dc-peer-selection__label" style={{ background: peer.color }}>
              {peer.name}
            </div>
          )}
        </div>
      ))}
    </>
  );
});

/**
 * Foreign-selection halo for canvas-shell elements (cdId-based selSet).
 * The peer publishes selection.cssPath; we re-resolve in the local DOM
 * each render so pan / zoom / hydration changes don't desync. Falls back
 * to the published `bounds` (screen-px at publish time) when cssPath
 * can't be resolved locally.
 */
interface PeerSelectionProps {
  peer: ForeignAwareness;
}

const PeerSelection = memo(function PeerSelection({
  peer,
}: PeerSelectionProps): JSX.Element | null {
  if (!peer.selection) return null;
  const { cssPath, bounds } = peer.selection;

  let rect: { x: number; y: number; w: number; h: number } | null = bounds ?? null;
  if (cssPath && typeof document !== 'undefined') {
    try {
      const el = document.querySelector(cssPath);
      if (el && el instanceof Element) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          rect = { x: r.left, y: r.top, w: r.width, h: r.height };
        }
      }
    } catch {
      /* invalid selector — fall through to published bounds */
    }
  }
  if (!rect) return null;

  return (
    <div
      className="dc-peer-selection"
      style={{
        transform: `translate(${rect.x}px, ${rect.y}px)`,
        width: rect.w,
        height: rect.h,
        borderColor: peer.color,
      }}
    >
      <div className="dc-peer-selection__label" style={{ background: peer.color }}>
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

  // Bump a render tick whenever annotations change so PeerAnnotationSelection
  // re-resolves [data-id] bounds. Without this, a peer resizing a stroke
  // would propagate via Y.Map → local annotations-layer re-render — but the
  // sibling CursorsOverlay wouldn't re-render, so the annotation halo would
  // sit on the OLD bounds until awareness independently changed.
  const collab = useCollab();
  const [, bumpAnnotTick] = useState(0);
  useEffect(() => {
    if (!collab) return;
    const map = collab.doc.getMap('annotations');
    const onChange = () => bumpAnnotTick((n) => n + 1);
    map.observe(onChange);
    return () => {
      try {
        map.unobserve(onChange);
      } catch {
        /* doc destroyed */
      }
    };
  }, [collab]);
  return (
    <div className="dc-cursor-overlay" aria-hidden="true">
      {peers.map((peer) => (
        <PeerSelection key={`sel-${peer.clientID}`} peer={peer} />
      ))}
      {peers.map((peer) => (
        <PeerAnnotationSelection key={`asel-${peer.clientID}`} peer={peer} />
      ))}
      {peers.map((peer) => (
        <Cursor key={peer.clientID} peer={peer} viewport={vp} />
      ))}
    </div>
  );
}
