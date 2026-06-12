/**
 * @file       use-collab.tsx — client-side Yjs collab provider for canvas iframes
 * @scope      apps/studio/use-collab.tsx
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

import * as decoding from 'lib0/decoding';
import * as encoding from 'lib0/encoding';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate } from 'y-protocols/awareness';
import { readSyncMessage, writeSyncStep1, writeUpdate } from 'y-protocols/sync';
import * as Y from 'yjs';

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;

// ─────────────────────────────────────────────────────────────────────────────
// Color hash — stable per peer identity.

/**
 * djb2 string hash → OKLCH color in a curated palette. Determinism per
 * input name is the load-bearing property: every peer hashing "Alice" must
 * land on the SAME color.
 *
 * DS contract (colors-presence specimen): the AI agent rides
 * `--presence-agent` (violet-magenta, hue 322) — "a hue no human state uses,
 * so attribution on a shared canvas is unambiguous". Human hues therefore
 * EXCLUDE the agent band (~292–352) AND the accent indigo band (~245–290,
 * reserved for selection/active). L/C match the DS presence tokens
 * (oklch ≈0.74 0.16) so every cursor reads at the same weight on both themes.
 */
const COLOR_PALETTE = [
  'oklch(0.70 0.17 12)', // rose
  'oklch(0.72 0.16 40)', // coral
  'oklch(0.78 0.15 78)', // amber  (presence-away hue)
  'oklch(0.76 0.16 108)', // lime
  'oklch(0.74 0.16 145)', // green  (presence-online hue)
  'oklch(0.75 0.14 172)', // teal
  'oklch(0.73 0.13 200)', // cyan
  'oklch(0.72 0.13 238)', // blue   (status-info hue)
] as const;

/** The AI agent's exclusive cursor/avatar hue — `--presence-agent`. */
export const AGENT_COLOR = 'oklch(0.700 0.190 322)';

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
// Untrusted-input sanitization at the awareness trust boundary.
//
// Phase 8 awareness was loopback-only — every state came from a trusted local
// tab. Phase 9 (Task 5) bridges awareness through a SEMI-TRUSTED hub (DDR-054),
// so foreign states are now attacker-influenceable. `useForeignAwareness` is
// the single chokepoint where remote state is read before it reaches the
// cursor / participant render sinks, so all validation lives here. Fields are
// validated for VALUE, not just type:
//   - color: re-derived locally from the (sanitized) name and the wire value
//     is DISCARDED — a hub-chosen `color` string would otherwise flow into an
//     inline `style` and a `url(...)` value beacons every viewer's browser.
//     The palette is deterministic, so re-derivation is visually identical.
//   - name: control / bidi / zero-width chars stripped, length-capped — blocks
//     identity spoofing + render bloat.
//   - cursor / viewport: finite-number gated — a NaN/Infinity would poison the
//     CSS transform / the local viewport controller during Follow mode.
//   - selection.cssPath: charset + length allowlist before it reaches
//     `querySelector` — blocks selector-complexity DoS + arbitrary DOM probing.
//   - annotationSelection: per-id token + array-length capped — blocks a
//     querySelector render-storm.
//   - peer count capped — blocks an unbounded-clients memory/render DoS.

const MAX_FOREIGN_PEERS = 64;
const MAX_NAME_LEN = 64;
const MAX_CSSPATH_LEN = 512;
const MAX_ANNOTATION_IDS = 256;
const MAX_ANNOTATION_ID_LEN = 128;

// Charset of every selector the canvas-shell `cssPath()` emits
// (`[data-*="..."]`, `#id`, `tag.cls:nth-child(N)`, ` > ` combinators).
const CSSPATH_ALLOWED = /^[A-Za-z0-9 ._#>:[\]="'()-]+$/;
// `cssPath()` only ever emits `:nth-child(N)` as a parenthesised construct.
// Functional pseudo-classes (`:has()`, `:is()`, `:where()`, `:not()`) trigger
// per-render subtree walks → a malicious hub peer could publish a deeply
// nested `:has()` selector and pin every viewer's main thread (querySelector
// re-runs each render). So after stripping the legit `:nth-child/of-type(N)`
// forms, any residual paren means a functional pseudo — reject. The charset
// allowlist alone was wider than the generator (the original DoS hole).
const CSSPATH_NTH = /:nth-(child|of-type)\(\d{1,4}\)/g;
const ANNOTATION_ID_ALLOWED = /^[A-Za-z0-9._:-]+$/;

function isSafeCssPath(p: string): boolean {
  if (p.length > MAX_CSSPATH_LEN || !CSSPATH_ALLOWED.test(p)) return false;
  const stripped = p.replace(CSSPATH_NTH, '');
  return !stripped.includes('(') && !stripped.includes(')');
}

function isFiniteNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

// Control (C0/C1), zero-width, and bidi-override code points get stripped from
// displayed strings so a remote peer can't spoof another's identity or hide
// payloads in labels. A charCode scan (not a regex literal with raw control
// chars) sidesteps biome's noControlCharactersInRegex while keeping the same
// semantics — same approach as the hub's sanitizeForLog (DDR-053).
function isUnsafeCodePoint(cp: number): boolean {
  return (
    cp <= 0x1f ||
    (cp >= 0x7f && cp <= 0x9f) ||
    (cp >= 0x200b && cp <= 0x200f) ||
    (cp >= 0x202a && cp <= 0x202e) ||
    (cp >= 0x2066 && cp <= 0x2069) ||
    cp === 0xfeff
  );
}

function sanitizeName(raw: unknown): string {
  if (typeof raw !== 'string') return 'anonymous';
  let cleaned = '';
  for (const ch of raw) {
    if (!isUnsafeCodePoint(ch.codePointAt(0) ?? 0)) cleaned += ch;
  }
  cleaned = cleaned.trim().slice(0, MAX_NAME_LEN);
  return cleaned || 'anonymous';
}

function sanitizeCursor(raw: unknown): { x: number; y: number } | null {
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as { x?: unknown; y?: unknown };
  return isFiniteNum(c.x) && isFiniteNum(c.y) ? { x: c.x, y: c.y } : null;
}

function sanitizeViewport(raw: unknown): { x: number; y: number; zoom: number } {
  const fallback = { x: 0, y: 0, zoom: 1 };
  if (!raw || typeof raw !== 'object') return fallback;
  const v = raw as { x?: unknown; y?: unknown; zoom?: unknown };
  if (!isFiniteNum(v.x) || !isFiniteNum(v.y) || !isFiniteNum(v.zoom) || v.zoom <= 0)
    return fallback;
  return { x: v.x, y: v.y, zoom: v.zoom };
}

function sanitizeSelection(raw: unknown): CollabAwarenessState['selection'] {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as { cssPath?: unknown; bounds?: unknown };
  const b = s.bounds as { x?: unknown; y?: unknown; w?: unknown; h?: unknown } | undefined;
  const bounds =
    b && isFiniteNum(b.x) && isFiniteNum(b.y) && isFiniteNum(b.w) && isFiniteNum(b.h)
      ? { x: b.x, y: b.y, w: b.w, h: b.h }
      : null;
  // Only keep cssPath if it matches the locator grammar — otherwise drop it and
  // let the renderer fall back to the (validated) bounds.
  const cssPath = typeof s.cssPath === 'string' && isSafeCssPath(s.cssPath) ? s.cssPath : '';
  if (!cssPath && !bounds) return null;
  return { cssPath, bounds: bounds ?? { x: 0, y: 0, w: 0, h: 0 } };
}

function sanitizeAnnotationSelection(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const id of raw) {
    if (out.length >= MAX_ANNOTATION_IDS) break;
    if (
      typeof id === 'string' &&
      id.length <= MAX_ANNOTATION_ID_LEN &&
      ANNOTATION_ID_ALLOWED.test(id)
    )
      out.push(id);
  }
  return out;
}

/**
 * Validate + normalize one foreign awareness state at the trust boundary.
 * Returns null for states that can't be a peer (no usable name). `color` is
 * always re-derived locally from the sanitized name — the wire value is never
 * trusted, which is what closes the hub CSS-`url()` exfil channel. Exported so
 * the hostile-input matrix can exercise it without a React harness.
 */
export function sanitizeForeignState(clientID: number, state: unknown): ForeignAwareness | null {
  if (!state || typeof state !== 'object') return null;
  const s = state as Partial<CollabAwarenessState>;
  if (typeof s.name !== 'string') return null;
  const name = sanitizeName(s.name);
  return {
    clientID,
    name,
    color: colorForName(name),
    cursor: sanitizeCursor(s.cursor),
    selection: sanitizeSelection(s.selection),
    annotationSelection: sanitizeAnnotationSelection(s.annotationSelection),
    viewport: sanitizeViewport(s.viewport),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Context.

interface CollabValue {
  doc: Y.Doc;
  /**
   * SECURITY INVARIANT: in linked mode this Awareness carries states relayed
   * from a SEMI-TRUSTED hub (DDR-054). Foreign states are untrusted input —
   * read them ONLY through `useForeignAwareness`, which sanitizes every field
   * at the trust boundary (`sanitizeForeignState`). Do NOT call
   * `awareness.getStates()` directly in render code; that bypasses the gate.
   */
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
        if (out.length >= MAX_FOREIGN_PEERS) break; // bound DoS via unbounded peers
        // Sanitize every now-remote field at this trust boundary (Task 5).
        const peer = sanitizeForeignState(clientID, state);
        if (peer) out.push(peer);
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
