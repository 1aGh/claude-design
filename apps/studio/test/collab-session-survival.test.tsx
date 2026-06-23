// Collab session survives a canvas hot-swap remount — F4 regression.
//
// RCA: `.ai/logs/rca/issue-collab-observer-tsx-reload-flicker.md`. A cross-peer
// synced edit hot-swaps the canvas module in place, which REMOUNTS the whole
// canvas subtree — including <CollabProvider>. If the Y.Doc + Awareness + socket
// were per-component, that remount would close + re-handshake the awareness
// socket and every peer's cursor/avatar would blink. The fix makes the session
// a module-level, refcounted singleton keyed by slug, so a same-slug remount
// reuses the SAME live socket + Awareness (stable clientID → the server never
// sees the peer leave + rejoin → no blink).
//
// We register happy-dom (error boundaries / real createRoot need a live DOM,
// like canvas-hmr-runtime.test.tsx) and stub WebSocket + fetch.

import { afterAll, afterEach, beforeAll, describe, expect, test } from 'bun:test';
import { GlobalRegistrator } from '@happy-dom/global-registrator';

beforeAll(() => {
  GlobalRegistrator.register();
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
afterAll(() => {
  GlobalRegistrator.unregister();
});

import { act, createElement, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type * as Y from 'yjs';

import { CollabProvider, useCollab } from '../use-collab.tsx';

// ── Fake WebSocket: count constructions + closes; never touches the network ──
let wsConstructed = 0;
let wsClosed = 0;
class FakeWS {
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  readyState = 1; // OPEN immediately — the provider only broadcasts when OPEN
  url: string;
  private handlers: Record<string, Array<(e: unknown) => void>> = {};
  constructor(url: string) {
    this.url = url;
    wsConstructed++;
    // Fire `open` on the next microtask so the provider's open handler runs.
    queueMicrotask(() => this.dispatch('open', {}));
  }
  addEventListener(type: string, fn: (e: unknown) => void) {
    const bucket = this.handlers[type] ?? [];
    bucket.push(fn);
    this.handlers[type] = bucket;
  }
  removeEventListener() {}
  send() {}
  close() {
    if (this.readyState === FakeWS.CLOSED) return;
    this.readyState = FakeWS.CLOSED;
    wsClosed++;
    this.dispatch('close', {});
  }
  private dispatch(type: string, e: unknown) {
    for (const fn of this.handlers[type] ?? []) fn(e);
  }
}

const realWebSocket = globalThis.WebSocket;
const realFetch = globalThis.fetch;

beforeAll(() => {
  (globalThis as unknown as { WebSocket: unknown }).WebSocket = FakeWS;
  (globalThis as unknown as { fetch: unknown }).fetch = () =>
    Promise.resolve({ json: () => Promise.resolve({ name: 'Tester' }) });
});
afterAll(() => {
  (globalThis as unknown as { WebSocket: unknown }).WebSocket = realWebSocket;
  (globalThis as unknown as { fetch: unknown }).fetch = realFetch;
});

afterEach(() => {
  wsConstructed = 0;
  wsClosed = 0;
});

// Captures the live doc + awareness clientID for the mounted provider.
let captured: { doc: Y.Doc; clientID: number } | null = null;
function Probe() {
  const collab = useCollab();
  useEffect(() => {
    if (collab) captured = { doc: collab.doc, clientID: collab.awareness.clientID };
  });
  return null;
}

function mount(el: HTMLElement): Root {
  let root!: Root;
  act(() => {
    root = createRoot(el);
  });
  return root;
}

function renderProvider(root: Root, slug: string) {
  act(() => {
    root.render(createElement(CollabProvider, { slug }, createElement(Probe)));
  });
}

describe('collab session survival across a hot-swap remount', () => {
  test('a same-slug remount reuses the live socket + Awareness (no reconnect)', () => {
    captured = null;
    const host = document.createElement('div');
    const root = mount(host);

    renderProvider(root, 'survival-slug');
    expect(wsConstructed).toBe(1);
    const first = captured;
    expect(first).not.toBeNull();

    // Hot-swap = unmount the canvas subtree, then immediately remount the SAME
    // slug (what CanvasHmrRuntime's key=attempt does on a synced module swap).
    act(() => {
      root.render(createElement('div', null));
    });
    renderProvider(root, 'survival-slug');

    // The session was reused within the grace window — NO second socket, and the
    // SAME doc + Awareness clientID (the server never saw a leave/rejoin).
    expect(wsConstructed).toBe(1);
    expect(wsClosed).toBe(0);
    expect(captured?.doc).toBe(first?.doc);
    expect(captured?.clientID).toBe(first?.clientID);

    act(() => root.unmount());
  });

  test('the session registry is anchored on window under a non-enumerable Symbol', () => {
    // A hot-swap re-imports the canvas bundle with a `?v=` cache-buster, and
    // use-collab is INLINED into that bundle — so a module-scoped `const
    // SESSIONS = new Map()` would be FRESH (empty) on every hot-swap and spin a
    // new clientID each time (phantom self-avatars pile up). Anchoring the map
    // on `window` (under a global Symbol so the re-imported module resolves the
    // same key) is what makes the session survive the swap. This pins that
    // invariant — the registry holds the slug — AND the security posture: the
    // key is a NON-ENUMERABLE Symbol so untrusted same-realm canvas script can't
    // harvest the live network handles via a for-in / Object.keys sweep.
    captured = null;
    const host = document.createElement('div');
    const root = mount(host);
    renderProvider(root, 'window-anchored-slug');
    const w = window as unknown as Record<symbol, Map<string, unknown> | undefined>;
    const reg = w[Symbol.for('maude.collab.sessions.v1')];
    expect(reg).toBeInstanceOf(Map);
    expect(reg?.has('window-anchored-slug')).toBe(true);
    // Not reachable via string-key enumeration (defense in depth).
    expect(Object.keys(window)).not.toContain('__maudeCollabSessions');
    act(() => root.unmount());
  });

  test('a different slug opens its own session (no cross-slug sharing)', () => {
    captured = null;
    const host = document.createElement('div');
    const root = mount(host);

    renderProvider(root, 'slug-a');
    const a = captured;
    renderProvider(root, 'slug-b');
    const b = captured;

    // slug-b reuses slug-a's <CollabProvider> instance but a NEW session →
    // a second socket + a distinct doc.
    expect(wsConstructed).toBe(2);
    expect(b?.doc).not.toBe(a?.doc);

    act(() => root.unmount());
  });
});
