/**
 * @file       ai-banner.tsx — yellow "Claude is editing this canvas" banner
 * @scope      plugins/design/dev-server/ai-banner.tsx
 * @purpose    Mounted by canvas-shell. Subscribes to the inspector WS
 *             `ai-activity` event for the canvas's own file path; shows a
 *             non-modal yellow banner while AI work is in progress and clears
 *             on explicit /end OR 30-second heartbeat-grace expiry.
 *
 * The banner is a soft notice, NOT a lock — the user can still type, click,
 * drag annotations, etc. It exists so the user doesn't unknowingly fight a
 * `/design:edit` that's about to rewrite their HTML.
 */

import { useEffect, useState } from 'react';

function deriveFile(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const p = window.location.pathname;
    if (p === '/_canvas-shell.html' || p === '/_canvas-shell') {
      const qs = new URLSearchParams(window.location.search);
      const canvas = qs.get('canvas') ?? '';
      const designRel = (qs.get('designRel') ?? '.design').replace(/^\/+|\/+$/g, '');
      return canvas ? `${designRel}/${canvas}` : null;
    }
    return decodeURIComponent(p).replace(/^\//, '');
  } catch {
    return null;
  }
}

const BANNER_CSS = `
.dc-ai-banner {
  position: fixed;
  top: 14px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10001;
  padding: 8px 14px;
  display: flex;
  align-items: center;
  gap: 10px;
  background: #fef3c7;
  color: #78350f;
  border: 1px solid #fcd34d;
  border-radius: 999px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  font: 500 13px/1.2 system-ui, -apple-system, sans-serif;
  pointer-events: none;
  user-select: none;
}
.dc-ai-banner__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #d97706;
  flex: 0 0 auto;
  animation: dc-ai-banner-pulse 1.4s ease-in-out infinite;
}
@keyframes dc-ai-banner-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%      { opacity: 0.5; transform: scale(0.75); }
}
@media (prefers-reduced-motion: reduce) {
  .dc-ai-banner__dot { animation: none; }
}
`.trim();

function ensureBannerStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById('dc-ai-banner-css')) return;
  const s = document.createElement('style');
  s.id = 'dc-ai-banner-css';
  s.textContent = BANNER_CSS;
  document.head.appendChild(s);
}

interface AiEntry {
  file: string;
  author: string;
  startedAt: number;
  lastHeartbeat: number;
}

export function AiBanner(): JSX.Element | null {
  ensureBannerStyles();
  const [entry, setEntry] = useState<AiEntry | null>(null);
  const file = deriveFile();

  // Mount-time backfill — the bus only emits on changes, so a freshly opened
  // tab needs to GET the snapshot to learn that an edit is already in flight.
  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    fetch('/_api/ai')
      .then((r) => r.json())
      .then((j: { entries?: AiEntry[] }) => {
        if (cancelled) return;
        const hit = (j.entries ?? []).find((e) => e.file === file);
        if (hit) setEntry(hit);
      })
      .catch(() => {
        /* offline / restart — silently no-op */
      });
    return () => {
      cancelled = true;
    };
  }, [file]);

  // Subscribe to the parent shell's WS broadcast — when the inspector channel
  // receives an `ai-activity` event for OUR file path, update local state.
  // The shell relays via postMessage so we don't need our own WS connection
  // (the iframe already piggybacks on the parent's inspector session).
  //
  // FALLBACK — when the canvas is opened standalone (export iframe, _shell.html
  // direct URL), no parent WS exists. We open a thin reader-only inspector WS
  // ourselves and watch for the matching event.
  useEffect(() => {
    if (!file) return;
    if (typeof window === 'undefined') return;

    // postMessage relay path — parent sends `ai-activity` events.
    const onMessage = (e: MessageEvent) => {
      const m = e.data as { dgn?: string; file?: string; entry?: AiEntry | null } | null;
      if (!m || typeof m !== 'object') return;
      if (m.dgn !== 'ai-activity') return;
      if (m.file !== file) return;
      setEntry(m.entry ?? null);
    };
    window.addEventListener('message', onMessage);

    // Standalone fallback — if no parent is relaying, dial /_ws directly.
    let standaloneWs: WebSocket | null = null;
    let reconnect: ReturnType<typeof setTimeout> | null = null;
    function connectStandalone() {
      const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${proto}//${location.host}/_ws`);
      standaloneWs = ws;
      ws.addEventListener('message', (ev) => {
        try {
          const data = typeof ev.data === 'string' ? ev.data : '';
          if (!data) return;
          const m = JSON.parse(data) as { type?: string; file?: string; entry?: AiEntry | null };
          if (m.type !== 'ai-activity') return;
          if (m.file !== file) return;
          setEntry(m.entry ?? null);
        } catch {
          /* not a JSON frame (binary from collab WS) — ignore */
        }
      });
      ws.addEventListener('close', () => {
        standaloneWs = null;
        reconnect = setTimeout(connectStandalone, 2000);
      });
      ws.addEventListener('error', () => {
        /* close handler reconnects */
      });
    }
    // Only open the standalone WS when we're not inside an iframe — the parent
    // already drives the postMessage relay for embedded canvases.
    if (window.parent === window) connectStandalone();

    return () => {
      window.removeEventListener('message', onMessage);
      if (reconnect) clearTimeout(reconnect);
      if (standaloneWs && standaloneWs.readyState === WebSocket.OPEN) {
        try {
          standaloneWs.close();
        } catch {
          /* ignore */
        }
      }
    };
  }, [file]);

  if (!entry) return null;
  return (
    <div className="dc-ai-banner" role="status" aria-live="polite">
      <span className="dc-ai-banner__dot" aria-hidden="true" />
      <span>{entry.author} is editing this canvas — your changes may conflict</span>
    </div>
  );
}
