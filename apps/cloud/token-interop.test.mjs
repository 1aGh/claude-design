// Cloud Phase 22 — the control plane signs, the cell verifies.
//
// The two halves were written separately, in different runtimes, against
// different crypto APIs: the control plane uses WebCrypto inside a Worker, the
// cell uses node:crypto. They agree only if somebody checks — and the failure
// mode of not checking is that every sign-in fails with "bad-signature" and
// both sides look correct in isolation.
//
// This is the test that would have caught it before a deploy did.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { verifyAccessToken } from '../hub/src/cloud-identity.mjs';

const SECRET = 'f'.repeat(64);
const NOW = 1_700_000_000_000;

/**
 * Sign exactly the way `openProject` in worker.mjs does — WebCrypto, base64url
 * by hand. Copied deliberately: if the worker's signing changes and this does
 * not, the test fails, which is the point.
 */
function b64urlBytes(bytes) {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function signLikeTheWorker(claims, secret) {
  const payload = b64urlBytes(new TextEncoder().encode(JSON.stringify(claims)));
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return `${payload}.${b64urlBytes(new Uint8Array(mac))}`;
}

const claims = (over = {}) => ({
  email: 'a@example.com',
  project: 'alligators',
  role: 'owner',
  iat: NOW,
  exp: NOW + 12 * 60 * 60 * 1000,
  ...over,
});

describe('a token minted by the control plane opens the cell', () => {
  it('round-trips across two runtimes and two crypto APIs', async () => {
    const token = await signLikeTheWorker(claims(), SECRET);
    const verdict = verifyAccessToken(token, SECRET, { now: NOW, tenantId: 'alligators' });
    assert.deepEqual(verdict, { ok: true, user: { email: 'a@example.com', role: 'owner' } });
  });

  it('carries the role through, so a viewer does not arrive as an owner', async () => {
    const token = await signLikeTheWorker(claims({ role: 'viewer' }), SECRET);
    const verdict = verifyAccessToken(token, SECRET, { now: NOW, tenantId: 'alligators' });
    assert.equal(verdict.user.role, 'viewer');
  });

  it('a token for one project does not open another', async () => {
    // Both cells derive their secret from the same master, so this check is
    // the only thing standing between one token and every project.
    const token = await signLikeTheWorker(claims(), SECRET);
    assert.equal(
      verifyAccessToken(token, SECRET, { now: NOW, tenantId: 'someone-else' }).reason,
      'wrong-project'
    );
  });

  it('the cell rejects a token signed with a different cell\'s secret', async () => {
    const token = await signLikeTheWorker(claims(), 'e'.repeat(64));
    assert.equal(
      verifyAccessToken(token, SECRET, { now: NOW, tenantId: 'alligators' }).reason,
      'bad-signature'
    );
  });

  it('expiry is enforced on the verifying side, not trusted from the claim', async () => {
    const token = await signLikeTheWorker(claims({ exp: NOW - 1 }), SECRET);
    assert.equal(
      verifyAccessToken(token, SECRET, { now: NOW, tenantId: 'alligators' }).reason,
      'expired'
    );
  });

  it('non-ASCII in a name survives the trip', async () => {
    // `btoa` throws on characters above U+00FF, and a Czech or Polish name is
    // exactly the input nobody tests with. If this ever fails, the signing
    // side needs a UTF-8 encode before base64 — not a sanitised name.
    const token = await signLikeTheWorker(
      claims({ email: 'michal@example.com', name: 'Michal Dovrtěl — Brno Alligators' }),
      SECRET
    );
    assert.equal(verifyAccessToken(token, SECRET, { now: NOW, tenantId: 'alligators' }).ok, true);
  });
});
