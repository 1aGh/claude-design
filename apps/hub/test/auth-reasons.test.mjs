// DDR-102 — distinct auth-rejection reasons over the wire + the rate-limit
// redesign (valid-token bucket generous per label; invalid-token attempts
// tight per IP).
//
// The incident finding: Hocuspocus propagates `error.reason` (NOT
// `error.message`) to the peer's onAuthenticationFailed — the hub's old
// `throw new Error('…')` rejections all arrived as the generic
// 'permission-denied', so the client hint pointed at scopes while the real
// cause was the rate limit. These tests pin the reason strings END-TO-END
// over a real WS.

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, test } from 'node:test';

import { HocuspocusProvider } from '@hocuspocus/provider';
import * as Y from 'yjs';

import {
  CONN_RATE_LIMIT_MAX,
  checkConnRateLimit,
  createHub,
  INVALID_CONN_RATE_LIMIT_MAX,
} from '../src/server.mjs';
import { addToken } from '../src/tokens.mjs';

const BASE_PORT = Number.parseInt(process.env.HUB_TEST_PORT ?? '14920', 10);

// ----------------------------------------------------- bucket unit behavior

test('valid-token ceiling is generous: a 200-auth burst passes (two 83-canvas peers + slack)', () => {
  const buckets = new Map();
  for (let i = 0; i < 200; i++) {
    assert.equal(checkConnRateLimit(buckets, 'michal'), true, `auth #${i + 1} should pass`);
  }
  assert.ok(CONN_RATE_LIMIT_MAX >= 600, 'default valid ceiling must be ≥ 600/min');
});

test('invalid-attempt ceiling stays tight (100/min) via the max parameter', () => {
  const buckets = new Map();
  for (let i = 0; i < INVALID_CONN_RATE_LIMIT_MAX; i++) {
    assert.equal(checkConnRateLimit(buckets, '10.0.0.9', INVALID_CONN_RATE_LIMIT_MAX), true);
  }
  assert.equal(checkConnRateLimit(buckets, '10.0.0.9', INVALID_CONN_RATE_LIMIT_MAX), false);
  assert.equal(INVALID_CONN_RATE_LIMIT_MAX, 100);
});

test('valid and invalid buckets are independent maps (one cannot starve the other)', () => {
  const valid = new Map();
  const invalid = new Map();
  for (let i = 0; i < 150; i++) checkConnRateLimit(invalid, '10.0.0.9', 100);
  // The invalid bucket is exhausted; a valid label still has full budget.
  assert.equal(checkConnRateLimit(valid, 'michal'), true);
});

// -------------------------------------------- reason strings over the wire

let hub;
let dataDir;
let PORT;
let portCounter = 0;
let aliceToken;

beforeEach(async () => {
  PORT = BASE_PORT + portCounter++;
  dataDir = mkdtempSync(join(tmpdir(), 'maude-hub-authreasons-'));
  // A scope-bound token (default scope = label, DDR-053).
  aliceToken = addToken(dataDir, { label: 'alice' }).value;
  const built = createHub({
    port: PORT,
    dataDir,
    secret: '',
    publicUrl: `https://hub.example.com:${PORT}`,
    verbose: false,
    rateLimit: true,
  });
  hub = built.server;
  await hub.listen();
});

afterEach(async () => {
  if (hub) await hub.destroy();
  if (dataDir) rmSync(dataDir, { recursive: true, force: true });
});

/** Connect a provider and resolve with the first auth-failure reason. */
function authFailureReason(port, { name, token }) {
  return new Promise((resolve, reject) => {
    const doc = new Y.Doc();
    const timer = setTimeout(() => {
      provider.destroy();
      reject(new Error('no authenticationFailed within 3s'));
    }, 3000);
    const provider = new HocuspocusProvider({
      url: `ws://127.0.0.1:${port}`,
      name,
      token,
      document: doc,
      connect: true,
      onAuthenticationFailed: ({ reason }) => {
        clearTimeout(timer);
        provider.destroy();
        resolve(reason);
      },
    });
  });
}

test('out-of-scope documentName → reason "token not authorized for this documentName"', async () => {
  const reason = await authFailureReason(PORT, { name: 'bob-private', token: aliceToken });
  assert.equal(reason, 'token not authorized for this documentName');
});

test('unknown token → reason "invalid token"', async () => {
  const reason = await authFailureReason(PORT, { name: 'alice', token: 'mau_garbage' });
  assert.equal(reason, 'invalid token');
});

test('valid-token rate limit → reason names the rate limit + retry hint', async () => {
  // A dedicated hub with ceiling 1 so the SECOND valid auth trips.
  const dir2 = mkdtempSync(join(tmpdir(), 'maude-hub-rl2-'));
  const token = addToken(dir2, { label: 'alice', scope: '*' }).value;
  const port2 = BASE_PORT + 500 + portCounter;
  const built = createHub({
    port: port2,
    dataDir: dir2,
    secret: '',
    publicUrl: `https://hub.example.com:${port2}`,
    verbose: false,
    rateLimit: true,
    connRateLimit: 1,
  });
  await built.server.listen();
  try {
    // First auth passes…
    const doc = new Y.Doc();
    const ok = new HocuspocusProvider({
      url: `ws://127.0.0.1:${port2}`,
      name: 'doc-one',
      token,
      document: doc,
      connect: true,
    });
    await new Promise((res) => ok.on('synced', () => res()));
    // …second trips the valid-token bucket with a reason-correct message.
    const reason = await authFailureReason(port2, { name: 'doc-two', token });
    assert.match(reason, /rate limit exceeded for this token/);
    assert.match(reason, /retry/i);
    ok.destroy();
  } finally {
    await built.server.destroy();
    rmSync(dir2, { recursive: true, force: true });
  }
});
