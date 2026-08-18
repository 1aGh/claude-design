// The OIDC sign-in decision — Track C C3/C5.
//
// THE TEST THAT MATTERS is "an OIDC identity whose email matches an existing
// admin gets pending and no session". The draft of this track auto-linked on a
// matching email; `users.mjs` keys accounts BY EMAIL and `createUser` throws on
// a duplicate address "so a signup can never silently overwrite an existing
// account's password" — so auto-link routed around a guard that has held since
// it was written, and one request asserting `admin@company.com` at a permissive
// issuer took the admin account.
//
// That rule is one sentence in a task, which is exactly how it survives being
// implemented from a "Do" line without it. The test is the rule.

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';

import {
  assertStrictIsSurvivable,
  authorizeUrl,
  createTransaction,
  decideOidcOutcome,
  oidcConfig,
  oidcEnabled,
  oidcStrict,
  resolveSubject,
} from '../src/oidc-routes.mjs';
import {
  closeUsers,
  createUser,
  getUserByOidcSub,
  linkOidcSub,
  listPendingOidc,
} from '../src/users.mjs';

const dirs = [];
function freshDir() {
  const d = mkdtempSync(join(tmpdir(), 'maude-oidc-'));
  dirs.push(d);
  return d;
}
after(() => {
  for (const d of dirs) {
    try {
      closeUsers(d);
    } catch {
      /* already closed */
    }
    rmSync(d, { recursive: true, force: true });
  }
});

const CFG = { allowedDomains: ['acme.com'] };
const verified = (over = {}) => ({
  sub: 'auth0|attacker',
  email: 'admin@acme.com',
  emailVerified: true,
  ...over,
});

// ------------------------------------------------------- the takeover fix

test('an OIDC identity whose email matches an existing ADMIN gets pending, not a session', () => {
  const dir = freshDir();
  createUser(dir, { email: 'admin@acme.com', password: 'correct horse battery', role: 'admin' });

  const outcome = resolveSubject(dir, verified(), CFG);

  assert.equal(outcome.action, 'pending', 'a matching email must NEVER grant the account');
  assert.equal(getUserByOidcSub(dir, 'auth0|attacker'), null, 'nothing may be linked');
  assert.deepEqual(
    listPendingOidc(dir).map((p) => p.sub),
    ['auth0|attacker'],
    'the attempt is visible to an operator instead'
  );
});

test('an unverified email claim cannot even reach the allowed-domain check', () => {
  const dir = freshDir();
  const outcome = resolveSubject(dir, verified({ emailVerified: false }), CFG);
  assert.equal(outcome.action, 'pending');
  assert.match(outcome.reason, /not from an allowed domain|no account/);
});

test('a LINKED subject signs in — and linking is an explicit admin act', () => {
  const dir = freshDir();
  createUser(dir, { email: 'alice@acme.com', password: 'correct horse battery' });
  // The admin acts. This is the only path that creates a link.
  linkOidcSub(dir, 'alice@acme.com', 'auth0|alice');

  const outcome = resolveSubject(
    dir,
    verified({ sub: 'auth0|alice', email: 'alice@acme.com' }),
    CFG
  );
  assert.equal(outcome.action, 'sign-in');
  assert.equal(outcome.user.email, 'alice@acme.com');
});

test('linking clears the pending entry and refuses to steal another account’s subject', () => {
  const dir = freshDir();
  createUser(dir, { email: 'alice@acme.com', password: 'correct horse battery' });
  createUser(dir, { email: 'bob@acme.com', password: 'correct horse battery' });
  resolveSubject(dir, verified({ sub: 'auth0|alice' }), CFG);
  assert.equal(listPendingOidc(dir).length, 1);

  linkOidcSub(dir, 'alice@acme.com', 'auth0|alice');
  assert.equal(listPendingOidc(dir).length, 0, 'pending is cleared once acted on');
  assert.throws(() => linkOidcSub(dir, 'bob@acme.com', 'auth0|alice'), /already linked/);
});

test('a disabled account refuses even with a valid link', () => {
  assert.equal(
    decideOidcOutcome({ subject: 's', linkedUser: { disabled: true }, emailAllowed: true }).action,
    'refuse'
  );
});

test('a revoked account refuses even with a valid link', () => {
  assert.equal(
    decideOidcOutcome({
      subject: 's',
      linkedUser: { disabled: false, email: 'a@b.co' },
      emailAllowed: true,
      revoked: true,
    }).action,
    'refuse'
  );
});

// ------------------------------------------------------------ mode switch

test('the mode is explicit — naming the issuer is not consent to a mode', () => {
  // cloud-identity.mjs: "An env var that names a dependency must never double
  // as consent to a behavioral mode."
  assert.equal(oidcEnabled({ HUB_OIDC_ISSUER: 'https://acme.eu.auth0.com' }), false);
  assert.equal(oidcEnabled({ HUB_OIDC_MODE: 'hybrid' }), true);
  assert.equal(oidcStrict({ HUB_OIDC_MODE: 'hybrid' }), false);
  assert.equal(oidcStrict({ HUB_OIDC_MODE: 'strict' }), true);
  assert.equal(oidcEnabled({ HUB_OIDC_MODE: 'yes' }), false, 'unknown values are OFF, not on');
});

const FULL = {
  HUB_OIDC_MODE: 'hybrid',
  HUB_OIDC_ISSUER: 'https://acme.eu.auth0.com',
  HUB_OIDC_CLIENT_ID: 'cid',
  HUB_OIDC_CLIENT_SECRET: 'shh',
  HUB_OIDC_ALLOWED_DOMAINS: 'acme.com',
};

test('a complete configuration validates, and reports every gap at once', () => {
  assert.deepEqual(oidcConfig(FULL).errors, []);
  const errs = oidcConfig({ HUB_OIDC_MODE: 'hybrid' }).errors;
  assert.equal(errs.length, 4, 'issuer, client id, secret and allowlist');
});

test('the allowlist is REQUIRED once a mode is set', () => {
  const { errors } = oidcConfig({ ...FULL, HUB_OIDC_ALLOWED_DOMAINS: '' });
  assert.match(errors.join(' '), /HUB_OIDC_ALLOWED_DOMAINS is required/);
});

test('two identity authorities refuse to coexist', () => {
  // MAUDE_CLOUD_IDENTITY × HUB_OIDC_MODE is nine untested combinations. One
  // refusal kills four of them permanently.
  const { errors } = oidcConfig({ ...FULL, MAUDE_CLOUD_IDENTITY: '1' });
  assert.match(errors.join(' '), /cannot both be set/);
});

test('strict refuses to start when nobody could sign in', () => {
  const cfg = oidcConfig({ ...FULL, HUB_OIDC_MODE: 'strict' });
  assert.throws(() => assertStrictIsSurvivable(cfg, { linkedAccounts: 0 }), /refuses to start/);
  assertStrictIsSurvivable(cfg, { linkedAccounts: 1 });
});

// ------------------------------------------------------------------ PKCE

test('every attempt gets fresh state, nonce and an S256 challenge', () => {
  const a = createTransaction();
  const b = createTransaction();
  assert.notEqual(a.state, b.state);
  assert.notEqual(a.nonce, b.nonce);
  assert.notEqual(a.codeVerifier, a.codeChallenge, 'the challenge is a hash, not the verifier');

  const url = new URL(
    authorizeUrl(
      oidcConfig(FULL),
      a,
      'https://hub.acme.com/auth/oidc/callback',
      'https://acme.eu.auth0.com/authorize'
    )
  );
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(url.searchParams.get('state'), a.state);
  assert.equal(url.searchParams.get('nonce'), a.nonce);
  assert.ok(!url.searchParams.has('code_verifier'), 'the verifier must never leave the hub');
});

// -------------------------------------------------- the exchange + txn codec

test('the code exchange refuses a token endpoint on another origin', async () => {
  // The discovery document is as operator-influenced as jwks_uri, and just as
  // able to name link-local. Same guard, same reason.
  const { exchangeCode } = await import('../src/oidc-routes.mjs');
  await assert.rejects(
    () =>
      exchangeCode(oidcConfig(FULL), {
        code: 'c',
        codeVerifier: 'v',
        redirectUri: 'https://hub/cb',
        tokenEndpoint: 'https://evil.example/token',
      }),
    /does not match the issuer origin/
  );
});

test('the client secret and verifier go in the BODY, never the query', async () => {
  const { exchangeCode } = await import('../src/oidc-routes.mjs');
  let seen = null;
  await exchangeCode(
    oidcConfig(FULL),
    {
      code: 'c',
      codeVerifier: 'v',
      redirectUri: 'https://hub/cb',
      tokenEndpoint: 'https://acme.eu.auth0.com/oauth/token',
    },
    {
      fetchImpl: async (url, opts) => {
        seen = { url: String(url), body: opts.body };
        return { id_token: 'jwt' };
      },
    }
  );
  assert.ok(!seen.url.includes('shh'), 'the secret must not reach the URL');
  assert.ok(!seen.url.includes('code_verifier'), 'nor the verifier');
  assert.match(seen.body, /client_secret=shh/);
  assert.match(seen.body, /code_verifier=v/);
});

test('a stale or forged transaction cookie is not a transaction', async () => {
  const { encodeTransaction, readTransaction } = await import('../src/oidc-routes.mjs');
  const txn = createTransaction();
  assert.equal(readTransaction(encodeTransaction(txn))?.state, txn.state);
  assert.equal(readTransaction('not-base64url-json'), null);
  assert.equal(readTransaction(encodeTransaction({ ...txn, createdAt: 0 })), null, 'expired');
  assert.equal(readTransaction(null), null);
});
