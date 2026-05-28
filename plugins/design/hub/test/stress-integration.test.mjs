// Phase 9 Task 11 — stress + integration against the REAL Node hub.
//
// Covers the subset of the Task 11 matrix that's deterministic in a single-box
// CI run: multi-peer convergence with random ops (scaled down from 5×1h),
// hub-restart persistence (SQLite survives a destroy/recreate), and hub-down
// offline → reconnect flush (the Task 8 offline-mode core, end-to-end).
//
// DEFERRED to CI-nightly / manual (need external infra, not asserted here):
//   - 5 peers × 1 hour soak (time budget)
//   - Fly deploy + cross-continent peers (needs a Fly account + two regions)
//   - token rotation mid-session kicking live WS (covered by rotate-kicks.test
//     at the unit level; the cross-machine reconnect is a manual check)
//   - admin-UI bootstrap end-to-end < 3 min (needs a browser)
//
// Node-only (Hocuspocus' crossws + better-sqlite3 reject Bun) — `node --test`.

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, test } from 'node:test';

import { HocuspocusProvider } from '@hocuspocus/provider';
import * as Y from 'yjs';

import { createHub } from '../src/server.mjs';

let cleanup = [];

afterEach(async () => {
  for (const fn of cleanup.reverse()) {
    try {
      await fn();
    } catch {
      /* best-effort */
    }
  }
  cleanup = [];
});

async function startHub(port, dataDir) {
  const built = createHub({ port, dataDir, secret: '', verbose: false });
  await built.server.listen();
  cleanup.push(() => built.server.destroy());
  return built;
}

function connect(port, name, doc) {
  const provider = new HocuspocusProvider({
    url: `ws://127.0.0.1:${port}`,
    name,
    token: 'dev',
    document: doc,
    connect: true,
  });
  cleanup.push(() => provider.destroy());
  return provider;
}

function onceSynced(provider) {
  return new Promise((res) => {
    if (provider.synced) return res();
    provider.on('synced', () => res());
  });
}

async function waitFor(predicate, { timeoutMs = 5000, stepMs = 25 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return true;
    await new Promise((r) => setTimeout(r, stepMs));
  }
  return predicate();
}

test('5 peers with random ops all converge on the same Y.Text (no echo loop)', async () => {
  const port = 14910;
  const dataDir = mkdtempSync(join(tmpdir(), 'maude-stress-'));
  cleanup.push(() => rmSync(dataDir, { recursive: true, force: true }));
  await startHub(port, dataDir);

  const NAME = 'projects/stress/canvases/screen';
  const docs = Array.from({ length: 5 }, () => new Y.Doc());
  const providers = docs.map((d) => connect(port, NAME, d));
  await Promise.all(providers.map(onceSynced));

  // 50 random single-char appends spread across the 5 peers. Yjs is a CRDT, so
  // every peer must converge to the SAME final string regardless of order.
  for (let i = 0; i < 50; i++) {
    const d = docs[i % docs.length];
    d.getText('content').insert(d.getText('content').length, String(i % 10));
    if (i % 7 === 0) await new Promise((r) => setTimeout(r, 5));
  }

  const converged = await waitFor(() => {
    const strings = docs.map((d) => d.getText('content').toString());
    return strings.every((s) => s === strings[0] && s.length === 50);
  });
  assert.ok(converged, 'all 5 peers converged to identical 50-char content');
});

test('hub restart preserves Y.Doc state via SQLite', async () => {
  const port = 14911;
  const dataDir = mkdtempSync(join(tmpdir(), 'maude-restart-'));
  cleanup.push(() => rmSync(dataDir, { recursive: true, force: true }));
  const NAME = 'projects/restart/canvases/screen';

  // Session 1 — write state, let it persist, tear the provider + hub down.
  let built = await startHub(port, dataDir);
  const docA = new Y.Doc();
  const provA = connect(port, NAME, docA);
  await onceSynced(provA);
  docA.getText('content').insert(0, 'persisted across restart');
  // Give the SQLite extension a beat to flush the update.
  await new Promise((r) => setTimeout(r, 400));
  provA.destroy();
  await built.server.destroy();

  // Session 2 — fresh hub on the SAME dataDir, fresh empty provider doc. The
  // SQLite extension must reload the persisted Y.Doc on first load.
  built = await startHub(port, dataDir);
  const docB = new Y.Doc();
  const provB = connect(port, NAME, docB);
  await onceSynced(provB);

  const loaded = await waitFor(
    () => docB.getText('content').toString() === 'persisted across restart'
  );
  assert.ok(loaded, 'state reloaded from SQLite after hub restart');
});

test('hub-down offline edit flushes when the peer reconnects (offline-mode core)', async () => {
  const port = 14912;
  const dataDir = mkdtempSync(join(tmpdir(), 'maude-offline-'));
  cleanup.push(() => rmSync(dataDir, { recursive: true, force: true }));
  const NAME = 'projects/offline/canvases/screen';

  // Peer connects, hub goes down, peer keeps editing (the edit lives in the
  // local Y.Doc — exactly the offline-buffer the sync agent relies on), hub
  // comes back, the peer reconnects and the buffered edit must land + persist.
  let built = await startHub(port, dataDir);
  const docA = new Y.Doc();
  const provA = connect(port, NAME, docA);
  await onceSynced(provA);
  docA.getText('content').insert(0, 'before-outage ');
  // Let the SQLite extension flush the pre-outage edit before we pull the hub.
  await new Promise((r) => setTimeout(r, 500));

  // Kill the hub — the WS drops; the local Y.Doc keeps accepting edits.
  await built.server.destroy();
  await new Promise((r) => setTimeout(r, 200));

  // Edit while offline — held in docA, unsynced.
  docA.getText('content').insert(docA.getText('content').length, 'edited-offline');

  // Hub returns on the same port + dataDir (pre-outage state reloaded from
  // SQLite). The peer reconnects: we model the reconnect explicitly with a
  // fresh provider on the SAME docA, because HocuspocusProvider's in-process
  // auto-reconnect backoff is seconds-to-minutes scale and belongs in the
  // nightly soak — the flush GUARANTEE (an offline-buffered doc syncs up on
  // the next successful connect) is what matters and is what we assert here.
  built = await startHub(port, dataDir);
  provA.destroy();
  const docB = new Y.Doc();
  connect(port, NAME, docB); // fresh peer, empty doc — loads hub state
  const reProvA = connect(port, NAME, docA); // "reconnect" carrying the offline edit
  await onceSynced(reProvA);

  // Both the pre-outage (from SQLite) and the offline edit (flushed by the
  // reconnecting peer) must converge on the fresh peer.
  const flushed = await waitFor(
    () => docB.getText('content').toString() === 'before-outage edited-offline',
    { timeoutMs: 10_000 }
  );
  assert.ok(
    flushed,
    `offline edit flushed on reconnect (saw: ${JSON.stringify(docB.getText('content').toString())})`
  );
});
