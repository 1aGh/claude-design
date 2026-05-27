/**
 * @file       use-collab.tsx — client-side Yjs collab provider for canvas iframes
 * @scope      plugins/design/dev-server/use-collab.tsx
 * @purpose    Mounts a single Y.Doc + Awareness per canvas iframe. Opens a
 *             WebSocket to `/_ws/collab/:slug`, speaks the y-websocket binary
 *             protocol, exposes hooks for the cursor overlay + Task 3 comments
 *             binding.
 *
 * Boundary:
 *   - Server-side equivalent is `collab/protocol.ts` + `collab/room.ts`.
 *   - This file mirrors the message framing (varint-prefixed sync + awareness
 *     frames) so the two sides converge over a binary WS without intermediate
 *     JSON.
 *   - Imports `yjs` + `y-protocols/{sync,awareness}` via the canvas-shell
 *     importmap (RUNTIME_PACKAGES additions). Canvas bundles that don't mount
 *     <CollabProvider> never resolve these specifiers and pay zero bundle cost.
 */

import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import * as decoding from 'lib0/decoding';
import * as encoding from 'lib0/encoding';
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate } from 'y-protocols/awareness';
import { readSyncMessage, writeSyncStep1, writeUpdate } from 'y-protocols/sync';
import * as Y from 'yjs';

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;

// ─────────────────────────────────────────────────────────────────────────────
// Color hash — stable per peer identity.

/**
 * djb2 string hash → 0xRRGGBB color in a curated palette. Determinism per
 * input name is the load-bearing property: every peer hashing "Alice" must
 * land on the SAME color. 12 hues spread evenly around the wheel; saturation
 * + lightness fixed so all colors stay readable on light + dark surfaces.
 */
const COLOR_PALETTE = [
  '#e91e63', // pink
  '#f44336', // red
  '#ff9800', // orange
  '#ffc107', // amber
  '#cddc39', // lime
  '#4caf50', // green
  '#009688', // teal
  '#00bcd4', // cyan
  '#03a9f4', // light blue
  '#3f51b5', // indigo
  '#673ab7', // deep purple
  '#9c27b0', // purple
] as const;

export function colorForName(name: string): string {
  // COLOR_PALETTE is a non-empty const tuple; the explicit `?? '#000'`
  // fallback is unreachable but satisfies `noUncheckedIndexedAccess`.
  const FALLBACK = '#000000';
  if (!name) return COLOR_PALETTE[0] ?? FALLBACK;
  let hash = 5381;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) + hash + name.charCodeAt(i)) | 0;
  }
  const idx = ((hash % COLOR_PALETTE.length) + COLOR_PALETTE.length) % COLOR_PALETTE.length;
  return COLOR_PALETTE[idx] ?? FALLBACK;
}

// ─────────────────────────────────────────────────────────────────────────────
// Awareness state shape.

export interface CollabAwarenessState {
  name: string;
  color: string;
  /**
   * Cursor position in **world coords** (canvas-lib viewport space) so foreign
   * peers see the same conceptual point even when their local viewport is
   * panned/zoomed differently. Null = peer is not over the canvas surface.
   */
  cursor: { x: number; y: number } | null;
  /**
   * Most-recently selected element. `cssPath` is the locator id chain the
   * canvas-shell already uses; `bounds` are screen-px rect at the moment of
   * publish (so it's a hint, not a live ref). Null when nothing selected.
   */
  selection: { cssPath: string; bounds: { x: number; y: number; w: number; h: number } } | null;
  /**
   * Currently-selected annotation stroke IDs (Phase 5). Strokes are addressed
   * by their stable `data-id` attribute, so peers can resolve halos via
   * `document.querySelectorAll('[data-id="<id>"]')`. Empty when nothing
   * annotation-shaped is selected.
   */
  annotationSelection: string[];
  viewport: { x: number; y: number; zoom: number };
  /**
   * Server-side `disconnect` matches awareness states to outgoing peers by
   * this token (must equal the ws.data.id the server assigns at upgrade).
   * Until the server pushes the assigned id back to the client, we use a
   * client-generated UUID — collisions are negligible and disconnect cleanup
   * tolerates a stale state (the next awareness GC pass drops it).
   */
  __connId: string;
}

export type ForeignAwareness = Omit<CollabAwarenessState, '__connId'> & { clientID: number };

// ─────────────────────────────────────────────────────────────────────────────
// Context.

interface CollabValue {
  doc: Y.Doc;
  awareness: Awareness;
  /** Local peer's session-stable color (derived from git user.name). */
  myColor: string;
  /** Local peer's display name (git user.name or anonymous fallback). */
  myName: string;
  /** Local peer's connection id (matches server-side ws.data.id pattern). */
  myConnId: string;
  /** True when the WS is OPEN. Cursor overlay can use this to gate rendering. */
  connected: boolean;
  /** Publish (debounce-coalesced) an updated local awareness state. */
  publishAwareness: (patch: Partial<Omit<CollabAwarenessState, '__connId'>>) => void;
}

const CollabContext = createContext<CollabValue | null>(null);

export function useCollab(): CollabValue | null {
  return useContext(CollabContext);
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook: foreign awareness peers (the cursor overlay subscribes to this).

/**
 * Returns the current set of foreign peers (excludes the local client). The
 * returned array is stable-reference between awareness updates — useful for
 * downstream React.memo cursor components.
 */
export function useForeignAwareness(): ForeignAwareness[] {
  const collab = useCollab();
  const [peers, setPeers] = useState<ForeignAwareness[]>([]);

  useEffect(() => {
    if (!collab) {
      setPeers([]);
      return;
    }
    const { awareness } = collab;
    function compute(): ForeignAwareness[] {
      const out: ForeignAwareness[] = [];
      const myId = awareness.clientID;
      for (const [clientID, state] of awareness.getStates() as Map<number, unknown>) {
        if (clientID === myId) continue;
        if (!state || typeof state !== 'object') continue;
        const s = state as Partial<CollabAwarenessState>;
        // Guard against partial states from stale peers / older protocol versions.
        if (typeof s.name !== 'string' || typeof s.color !== 'string') continue;
        out.push({
          clientID,
          name: s.name,
          color: s.color,
          cursor: s.cursor ?? null,
          selection: s.selection ?? null,
          annotationSelection: Array.isArray(s.annotationSelection) ? s.annotationSelection : [],
          viewport: s.viewport ?? { x: 0, y: 0, zoom: 1 },
        });
      }
      return out;
    }
    setPeers(compute());
    const onChange = () => setPeers(compute());
    awareness.on('change', onChange);
    return () => {
      awareness.off('change', onChange);
    };
  }, [collab]);

  return peers;
}

// ─────────────────────────────────────────────────────────────────────────────
// Slug derivation — must match `api.fileSlug` server-side.

/**
 * Mirror of server-side `api.fileSlug`. The input is the canvas path as the
 * shell stored it on `window.__canvas_meta_file__` (e.g. `.design/ui/Foo.tsx`).
 * Strip the designRel prefix (read from `window.__canvas_design_rel__`, set
 * by _shell.html) so both sides land on the same slug — without this both
 * tabs open a `design-ui-foo` room while the server's inspector bridge
 * pushes into `ui-foo`, and the rooms never converge.
 */
export function canvasSlugFromPath(canvasRel: string | null | undefined): string | null {
  if (!canvasRel) return null;
  let p = canvasRel.replace(/^\/+|\/+$/g, '');
  if (typeof window !== 'undefined') {
    const w = window as unknown as { __canvas_design_rel__?: string };
    const designRel = (w.__canvas_design_rel__ ?? '').replace(/^\/+|\/+$/g, '');
    if (designRel && p.startsWith(`${designRel}/`)) p = p.slice(designRel.length + 1);
  }
  const slug = p
    .replace(/\//g, '-')
    .replace(/\s+/g, '_')
    .replace(/\.(tsx|html)$/i, '')
    .replace(/^\.+/, '')
    .toLowerCase();
  return /^[a-z0-9_-]+$/.test(slug) ? slug : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider — opens WS, owns Y.Doc + Awareness lifecycle.

interface CollabProviderProps {
  /** Canvas slug — must match server-side `parseCollabSlug`. */
  slug: string;
  children: ReactNode;
}

const AWARENESS_THROTTLE_MS = 33; // ~30 Hz

export function CollabProvider({ slug, children }: CollabProviderProps): JSX.Element {
  // Y.Doc + Awareness are recreated whenever the slug changes (switching
  // canvases tears down the prior session cleanly). The useMemo factory
  // bodies don't read `slug` — slug IS the cache key, intentionally.
  // biome-ignore lint/correctness/useExhaustiveDependencies: slug is the cache key
  const doc = useMemo(() => new Y.Doc(), [slug]);
  const awareness = useMemo(() => new Awareness(doc), [doc]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: slug is the cache key
  const myConnId = useMemo(() => crypto.randomUUID(), [slug]);

  const [myName, setMyName] = useState('anonymous');
  const [myColor, setMyColor] = useState(colorForName('anonymous'));
  const [connected, setConnected] = useState(false);

  // Fetch git user.name once per slug; falls back to anonymous-<short id>.
  useEffect(() => {
    let cancelled = false;
    fetch('/_api/git-user')
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        const n = typeof j?.name === 'string' && j.name.trim() ? j.name.trim() : null;
        const finalName = n ?? `anonymous-${myConnId.slice(0, 6)}`;
        setMyName(finalName);
        setMyColor(colorForName(finalName));
      })
      .catch(() => {
        if (cancelled) return;
        const fallback = `anonymous-${myConnId.slice(0, 6)}`;
        setMyName(fallback);
        setMyColor(colorForName(fallback));
      });
    return () => {
      cancelled = true;
    };
  }, [myConnId]);

  // Seed local awareness state immediately so foreign peers see our name even
  // before the cursor moves. Update when myName/myColor settles from the fetch.
  useEffect(() => {
    awareness.setLocalState({
      name: myName,
      color: myColor,
      cursor: null,
      selection: null,
      annotationSelection: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      __connId: myConnId,
    } satisfies CollabAwarenessState);
  }, [awareness, myName, myColor, myConnId]);

  // ── WebSocket lifecycle ──────────────────────────────────────────────────
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    function sendFrame(ws: WebSocket, payload: Uint8Array) {
      try {
        ws.send(payload);
      } catch {
        /* dead socket — close handler will reconnect */
      }
    }

    function broadcastAwareness(ws: WebSocket, changed: number[]) {
      if (changed.length === 0) return;
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
      encoding.writeVarUint8Array(encoder, encodeAwarenessUpdate(awareness, changed));
      sendFrame(ws, encoding.toUint8Array(encoder));
    }

    function broadcastSyncUpdate(ws: WebSocket, update: Uint8Array) {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_SYNC);
      writeUpdate(encoder, update);
      sendFrame(ws, encoding.toUint8Array(encoder));
    }

    function connect() {
      if (cancelled) return;
      const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${proto}//${location.host}/_ws/collab/${slug}`);
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      ws.addEventListener('open', () => {
        setConnected(true);
        // Sync step 1 — announce our state vector so the server can send the
        // missing pieces (matches the encodeHandshake server path).
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, MESSAGE_SYNC);
        writeSyncStep1(encoder, doc);
        sendFrame(ws, encoding.toUint8Array(encoder));
        // Awareness initial state — fire our local state to the room.
        broadcastAwareness(ws, [awareness.clientID]);
      });

      ws.addEventListener('close', () => {
        setConnected(false);
        wsRef.current = null;
        if (cancelled) return;
        reconnectTimer = setTimeout(connect, 1000);
      });

      ws.addEventListener('error', () => {
        // Let close handler do the reconnect; error events without a close
        // would just retry-spam.
      });

      ws.addEventListener('message', (evt) => {
        const payload =
          evt.data instanceof ArrayBuffer
            ? new Uint8Array(evt.data)
            : evt.data instanceof Uint8Array
              ? evt.data
              : null;
        if (!payload) return;
        const decoder = decoding.createDecoder(payload);
        const messageType = decoding.readVarUint(decoder);
        switch (messageType) {
          case MESSAGE_SYNC: {
            const encoder = encoding.createEncoder();
            encoding.writeVarUint(encoder, MESSAGE_SYNC);
            readSyncMessage(decoder, encoder, doc, ws);
            if (encoding.length(encoder) > 1) sendFrame(ws, encoding.toUint8Array(encoder));
            break;
          }
          case MESSAGE_AWARENESS: {
            applyAwarenessUpdate(awareness, decoding.readVarUint8Array(decoder), ws);
            break;
          }
          default:
            break;
        }
      });
    }

    // Wire doc updates → broadcast to server. Origin tagged with the ws ref so
    // server-side updates we receive don't echo back.
    const onDocUpdate = (update: Uint8Array, origin: unknown) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      if (origin === ws) return; // came from server, don't echo
      broadcastSyncUpdate(ws, update);
    };
    doc.on('update', onDocUpdate);

    // Wire awareness changes → broadcast. Same origin guard.
    const onAwarenessUpdate = (
      { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
      origin: unknown
    ) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      if (origin === ws) return;
      const changed = added.concat(updated, removed);
      broadcastAwareness(ws, changed);
    };
    awareness.on('update', onAwarenessUpdate);

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      doc.off('update', onDocUpdate);
      awareness.off('update', onAwarenessUpdate);
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          ws.close();
        } catch {
          /* ignore */
        }
      }
      // Don't destroy doc/awareness here — the useMemo-tied lifetime handles
      // that when the slug changes.
    };
  }, [slug, doc, awareness]);

  // Per-slug cleanup of doc/awareness when slug changes (or provider unmounts).
  useEffect(
    () => () => {
      try {
        awareness.destroy();
      } catch {
        /* ignore */
      }
      try {
        doc.destroy();
      } catch {
        /* ignore */
      }
    },
    [doc, awareness]
  );

  // ── Throttled awareness publish ─────────────────────────────────────────
  const pendingRef = useRef<Partial<Omit<CollabAwarenessState, '__connId'>> | null>(null);
  const throttleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const publishAwareness = useCallback(
    (patch: Partial<Omit<CollabAwarenessState, '__connId'>>) => {
      pendingRef.current = { ...(pendingRef.current ?? {}), ...patch };
      if (throttleTimerRef.current) return;
      throttleTimerRef.current = setTimeout(() => {
        throttleTimerRef.current = null;
        const next = pendingRef.current;
        pendingRef.current = null;
        if (!next) return;
        const current = (awareness.getLocalState() ?? {}) as Partial<CollabAwarenessState>;
        awareness.setLocalState({
          name: current.name ?? myName,
          color: current.color ?? myColor,
          cursor: current.cursor ?? null,
          selection: current.selection ?? null,
          annotationSelection: current.annotationSelection ?? [],
          viewport: current.viewport ?? { x: 0, y: 0, zoom: 1 },
          __connId: myConnId,
          ...next,
        } satisfies CollabAwarenessState);
      }, AWARENESS_THROTTLE_MS);
    },
    [awareness, myName, myColor, myConnId]
  );

  // ── Cleanup throttle timer on unmount ───────────────────────────────────
  useEffect(
    () => () => {
      if (throttleTimerRef.current) clearTimeout(throttleTimerRef.current);
    },
    []
  );

  const value = useMemo<CollabValue>(
    () => ({
      doc,
      awareness,
      myColor,
      myName,
      myConnId,
      connected,
      publishAwareness,
    }),
    [doc, awareness, myColor, myName, myConnId, connected, publishAwareness]
  );

  return <CollabContext.Provider value={value}>{children}</CollabContext.Provider>;
}
