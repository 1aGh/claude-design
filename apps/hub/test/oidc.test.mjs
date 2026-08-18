// ID-token verification — Track C C1.
//
// The refusals below are kept EVEN THOUGH `jose` implements them. They stopped
// being correctness tests the moment we took the library; they are now the
// tripwire against a future maintainer swapping the verifier back out for
// something hand-rolled. A test that looks redundant is a test somebody
// deletes, so this comment is part of the test.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { exportJWK, generateKeyPair, SignJWT } from 'jose';

import { createDiscovery, createVerifier, usableEmailClaim } from '../src/oidc.mjs';

const ISSUER = 'https://acme.eu.auth0.com';
const AUDIENCE = 'maude-hub';

/** A fake network: discovery + JWKS served from memory. */
function fakeFetch(jwks, { jwksUri = `${ISSUER}/.well-known/jwks.json` } = {}) {
  return async (url) => {
    if (String(url).endsWith('/.well-known/openid-configuration')) {
      return { issuer: ISSUER, jwks_uri: jwksUri };
    }
    return jwks;
  };
}

async function setup() {
  const rs = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(rs.publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' };
  const fetchImpl = fakeFetch({ keys: [jwk] });
  const verifier = createVerifier({ issuer: ISSUER, audience: AUDIENCE, fetchImpl });
  const sign = (claims = {}, { alg = 'RS256', key = rs.privateKey } = {}) =>
    new SignJWT({ email: 'alice@acme.com', email_verified: true, ...claims })
      .setProtectedHeader({ alg, kid: 'k1' })
      .setIssuer(claims.iss ?? ISSUER)
      .setAudience(claims.aud ?? AUDIENCE)
      .setSubject(claims.sub ?? 'auth0|abc123')
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(key);
  return { verifier, sign, rs, jwk };
}

test('a well-formed token verifies and yields the subject', async () => {
  const { verifier, sign } = await setup();
  const r = await verifier.verifyIdToken(await sign({ nonce: 'n' }), { nonce: 'n' });
  assert.equal(r.sub, 'auth0|abc123');
  assert.equal(r.email, 'alice@acme.com');
  assert.equal(r.emailVerified, true);
});

test('REFUSES a token signed by another key', async () => {
  const { verifier } = await setup();
  const other = await generateKeyPair('RS256');
  const forged = await new SignJWT({ sub: 'auth0|abc123' })
    .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject('auth0|abc123')
    .setExpirationTime('5m')
    .sign(other.privateKey);
  await assert.rejects(() => verifier.verifyIdToken(forged, { nonce: 'n' }));
});

test('REFUSES alg:none', async () => {
  // Tripwire, not a correctness check — see the header.
  const { verifier } = await setup();
  const header = Buffer.from(JSON.stringify({ alg: 'none', kid: 'k1' })).toString('base64url');
  const body = Buffer.from(
    JSON.stringify({ sub: 'x', iss: ISSUER, aud: AUDIENCE, exp: Date.now() / 1000 + 300 })
  ).toString('base64url');
  await assert.rejects(() => verifier.verifyIdToken(`${header}.${body}.`, { nonce: 'n' }));
});

test('REFUSES an HS256 token signed with the public key as the secret', async () => {
  // The RS256→HS256 confusion: the verifier is tricked into treating a PUBLIC
  // key as an HMAC secret, which an attacker also has.
  const { verifier, jwk } = await setup();
  const secret = new TextEncoder().encode(JSON.stringify(jwk));
  const forged = await new SignJWT({ sub: 'x' })
    .setProtectedHeader({ alg: 'HS256', kid: 'k1' })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject('x')
    .setExpirationTime('5m')
    .sign(secret);
  await assert.rejects(() => verifier.verifyIdToken(forged, { nonce: 'n' }));
});

test('REFUSES a wrong issuer and a wrong audience', async () => {
  const { verifier, sign } = await setup();
  const wrongIssuer = await sign({ iss: 'https://evil.example' });
  const wrongAudience = await sign({ aud: 'someone-else' });
  await assert.rejects(() => verifier.verifyIdToken(wrongIssuer, { nonce: 'n' }));
  await assert.rejects(() => verifier.verifyIdToken(wrongAudience, { nonce: 'n' }));
});

test('REFUSES a nonce that does not match this sign-in attempt', async () => {
  const { verifier, sign } = await setup();
  const jwt = await sign({ nonce: 'from-another-attempt' });
  await assert.rejects(() => verifier.verifyIdToken(jwt, { nonce: 'mine' }), /nonce/);
  const ok = await verifier.verifyIdToken(await sign({ nonce: 'mine' }), { nonce: 'mine' });
  assert.equal(ok.sub, 'auth0|abc123');
});

test('REFUSES a token with no subject — identity IS the subject', async () => {
  const { verifier, rs } = await setup();
  const jwt = await new SignJWT({ nonce: 'n' })
    .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setExpirationTime('5m')
    .sign(rs.privateKey);
  await assert.rejects(() => verifier.verifyIdToken(jwt, { nonce: 'n' }), /no subject/);
});

test('discovery refuses a jwks_uri on another origin', async () => {
  const disco = createDiscovery({
    issuer: ISSUER,
    fetchImpl: async () => ({ issuer: ISSUER, jwks_uri: 'https://evil.example/jwks' }),
  });
  await assert.rejects(() => disco.document(), /does not match the issuer origin/);
});

test('discovery refuses a document that claims a different issuer', async () => {
  const disco = createDiscovery({
    issuer: ISSUER,
    fetchImpl: async () => ({ issuer: 'https://evil.example', jwks_uri: `${ISSUER}/jwks` }),
  });
  await assert.rejects(() => disco.document(), /claims issuer/);
});

test('an unverified email claim is never usable', () => {
  // An IdP that lets a user assert an arbitrary address is common. Unverified
  // means the issuer is not vouching for it, so it must not reach any decision.
  assert.equal(usableEmailClaim({ email: 'a@b.co', emailVerified: false }), null);
  assert.equal(usableEmailClaim({ email: 'a@b.co', emailVerified: true }), 'a@b.co');
  assert.equal(usableEmailClaim({ email: 'a@b.co', emailVerified: true }, ['acme.com']), null);
  assert.equal(
    usableEmailClaim({ email: 'a@acme.com', emailVerified: true }, ['acme.com']),
    'a@acme.com'
  );
});
