// DDR-053 §4 — rotate-kicks-sessions integration test.
//
// Reproduces the security re-audit finding: prior implementation captured
// `connection` from onConnect (which doesn't exist on that hook in
// @hocuspocus/server 4.x), making kickSessionsForLabel a silent no-op.
// This test spawns a real HocuspocusProvider against the hub, asserts the
// connection lands, then rotates the token and asserts the provider notices
// the disconnect within a bounded window.

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, test } from 'node:test';

import { HocuspocusProvider } from '@hocuspocus/provider';
import * as Y from 'yjs';

import { createHub } from '../src/server.mjs';
import { addToken } from '../src/tokens.mjs';

const BASE_PORT = Number.parseInt(process.env.HUB_TEST_PORT ?? '14900', 10);
const SECRET = 'rotate-kicks-admin';

let hub;
let dataDir;
let built;
let PORT;
let portCounter = 0;

beforeEach(async () => {
  PORT = BASE_PORT + portCounter++;
  dataDir = mkdtempSync(join(tmpdir(), 'maude-hub-rotate-'));
  built = createHub({
    port: PORT,
    dataDir,
    secret: SECRET,
    publicUrl: `https://hub.example.com:${PORT}`,
    verbose: false,
    rateLimit: false,
  });
  hub = built.server;
  await hub.listen();
});

afterEach(async () => {
  if (hub) await hub.destroy();
  if (dataDir) rmSync(dataDir, { recursive: true, force: true });
});

test('rotate kicks the active WebSocket session for the rotated label', async () => {
  // Seed a token (label = 'alice', default scope = 'alice').
  const tok = addToken(dataDir, { label: 'alice' });

  // Connect a provider with documentName matching the scope.
  const doc = new Y.Doc();
  const provider = new HocuspocusProvider({
    url: `ws://127.0.0.1:${PORT}`,
    name: 'alice/canvas',
    document: doc,
    token: tok.value,
  });

  // Wait until the provider reports synced (handshake complete) — that
  // window is when the `connected` hook fires server-side, which is when
  // the Connection ref lands in the peers Map.
  await new Promise((resolveP, reject) => {
    const timeout = setTimeout(() => reject(new Error('provider never synced')), 5000);
    provider.on('synced', () => {
      clearTimeout(timeout);
      resolveP();
    });
  });

  // Verify the peers Map has the connection ref (not null).
  // Give the `connected` hook one event-loop tick to fire.
  await new Promise((r) => setImmediate(r));
  const peers = Array.from(built.peers.values());
  assert.equal(peers.length, 1, 'one peer expected after sync');
  assert.ok(peers[0].connection, 'peers entry must have a non-null connection (DDR-053 §4)');

  // Rotate via the admin API. The response should report disconnected: 1
  // AND the server-side peers Map must shed alice's entry. We DON'T assert
  // on the provider's `disconnect` event — HocuspocusProvider auto-reconnects
  // immediately, and the event timing is racy. The server-side proof is the
  // canonical check.
  const res = await fetch(`http://127.0.0.1:${PORT}/admin/api/token/rotate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ label: 'alice' }),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.disconnected, 1, 'rotate must report exactly 1 disconnected session');

  // Verify server-side: alice's entry is gone from the peers Map. If
  // kickSessionsForLabel is a no-op (the pre-fix bug), the entry stays.
  // Give one tick for the close handler to settle.
  await new Promise((r) => setTimeout(r, 50));
  const aliceStillPresent = Array.from(built.peers.values()).some((p) => p.user === 'alice');
  assert.equal(aliceStillPresent, false, 'alice must be evicted from peers Map after rotation');

  provider.destroy();
  doc.destroy();
});

test('rotate does not kick sessions belonging to other labels', async () => {
  const aliceTok = addToken(dataDir, { label: 'alice' });
  const bobTok = addToken(dataDir, { label: 'bob' });

  const aliceDoc = new Y.Doc();
  const bobDoc = new Y.Doc();
  const aliceProv = new HocuspocusProvider({
    url: `ws://127.0.0.1:${PORT}`,
    name: 'alice/canvas',
    document: aliceDoc,
    token: aliceTok.value,
  });
  const bobProv = new HocuspocusProvider({
    url: `ws://127.0.0.1:${PORT}`,
    name: 'bob/canvas',
    document: bobDoc,
    token: bobTok.value,
  });

  await Promise.all([
    new Promise((r) => aliceProv.on('synced', r)),
    new Promise((r) => bobProv.on('synced', r)),
  ]);
  await new Promise((r) => setImmediate(r));

  // Rotate only alice — bob's session must stay alive.
  const res = await fetch(`http://127.0.0.1:${PORT}/admin/api/token/rotate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ label: 'alice' }),
  });
  assert.equal((await res.json()).disconnected, 1, 'exactly one kicked');

  // Give the kick a moment to land + then verify bob's still in the Map.
  await new Promise((r) => setTimeout(r, 100));
  const remainingUsers = Array.from(built.peers.values()).map((p) => p.user);
  assert.deepEqual(
    remainingUsers,
    ['bob'],
    `bob's session must survive alice's rotation; got ${JSON.stringify(remainingUsers)}`
  );

  aliceProv.destroy();
  bobProv.destroy();
  aliceDoc.destroy();
  bobDoc.destroy();
});
