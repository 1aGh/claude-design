// Bidirectional Awareness relay — Phase 9 Task 5 (awareness over WSS).
//
// In linked mode each canvas has TWO Awareness instances in this process:
//
//   - the collab Room's Awareness (browser tabs ↔ dev-server, loopback WS)
//   - the sync provider's Awareness (dev-server ↔ hub, HocuspocusProvider)
//
// Hocuspocus relays awareness frames between connected peers on a document out
// of the box, so the provider's Awareness already reaches cross-continent
// peers. The only missing link is in-process: this bridge wires the Room's
// Awareness to the provider's Awareness so a browser cursor published into the
// Room reaches the hub (and back) without either side knowing about the other.
//
// Awareness is EPHEMERAL — it is never persisted to disk. That is why this
// bridge is decoupled from the file-ownership question (DDR-054 F14): relaying
// cursors/selections/viewport touches no `.json` / `.svg` / `.html` file, so
// it neither introduces nor resolves the comments/annotations write race. The
// doc-content bridge (Room doc ↔ provider doc) is intentionally NOT built here
// — disk stays the medium between the two docs (Task 4), and F14 remains a
// documented risk for the doc-content bridge work.
//
// Echo prevention: every cross relay applies the update to the far side tagged
// with a shared BRIDGE origin. Each direction's listener skips updates carrying
// that origin, so a relayed state never bounces back to where it came from.
// This is the same pattern y-websocket uses to relay awareness across a fan-out
// hub. State identity is preserved because awareness updates are keyed by the
// originating clientID — the random 32-bit ids make local↔remote collisions
// negligible.

import { applyAwarenessUpdate, encodeAwarenessUpdate } from 'y-protocols/awareness';
import type { Awareness } from 'y-protocols/awareness';

interface AwarenessChange {
  added: number[];
  updated: number[];
  removed: number[];
}

/**
 * Wire `a` ↔ `b` bidirectionally. Existing states on each side are exchanged
 * immediately so a peer that connected before the bridge existed still shows
 * up. Returns a detach fn that removes both listeners — call it BEFORE either
 * Awareness is destroyed, otherwise a late relay would apply to a dead
 * instance.
 */
export function bridgeAwareness(a: Awareness, b: Awareness): () => void {
  // A single shared origin for both directions. A genuine local change carries
  // some other origin (a browser conn, the provider's internal token, or null),
  // so it relays; a change this bridge applied carries BRIDGE, so it stops.
  const BRIDGE = { awarenessBridge: true };

  function makeRelay(from: Awareness, to: Awareness) {
    return ({ added, updated, removed }: AwarenessChange, origin: unknown) => {
      if (origin === BRIDGE) return;
      const changed = added.concat(updated, removed);
      if (changed.length === 0) return;
      applyAwarenessUpdate(to, encodeAwarenessUpdate(from, changed), BRIDGE);
    };
  }

  const aToB = makeRelay(a, b);
  const bToA = makeRelay(b, a);

  // Initial state exchange — push each side's current states to the other.
  const aClients = Array.from(a.getStates().keys());
  if (aClients.length > 0) applyAwarenessUpdate(b, encodeAwarenessUpdate(a, aClients), BRIDGE);
  const bClients = Array.from(b.getStates().keys());
  if (bClients.length > 0) applyAwarenessUpdate(a, encodeAwarenessUpdate(b, bClients), BRIDGE);

  a.on('update', aToB);
  b.on('update', bToA);

  return () => {
    a.off('update', aToB);
    b.off('update', bToA);
  };
}
