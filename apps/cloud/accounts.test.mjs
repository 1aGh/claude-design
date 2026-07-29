// One-account identity — Cloud Phase 13.

import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';

import {
  accountForGoogle,
  authenticate,
  createAccount,
  createSession,
  normalizeEmail,
  revokeAccountSessions,
  revokeSession,
  sessionAccount,
} from './accounts.mjs';
import { d1FromSqlite } from './db.mjs';
import { applySchema } from './migrate.mjs';
import { SCHEMA_SQL } from './schema.mjs';

const PASSWORD = 'a-long-enough-password';

async function freshDb() {
  const db = d1FromSqlite(new DatabaseSync(':memory:'));
  await applySchema(db, SCHEMA_SQL);
  return db;
}

test('signup then sign-in round-trips', async () => {
  const db = await freshDb();
  const acct = await createAccount(db, { email: 'Alice@Example.com', password: PASSWORD });
  assert.equal(acct.email, 'alice@example.com');

  const ok = await authenticate(db, 'alice@example.com', PASSWORD);
  assert.equal(ok.ok, true);
  const bad = await authenticate(db, 'alice@example.com', 'wrong-password-x');
  assert.equal(bad.ok, false);
});

test('unknown address and wrong password are ONE opaque failure shape', async () => {
  const db = await freshDb();
  await createAccount(db, { email: 'alice@example.com', password: PASSWORD });
  const unknown = await authenticate(db, 'ghost@example.com', PASSWORD);
  const wrong = await authenticate(db, 'alice@example.com', 'not-it-either!');
  assert.equal(unknown.ok, false);
  assert.equal(wrong.ok, false);
  // reasons differ INTERNALLY (logs); the caller must map both to one message.
});

test('duplicate signup throws a coded error, never overwrites', async () => {
  const db = await freshDb();
  await createAccount(db, { email: 'alice@example.com', password: PASSWORD });
  await assert.rejects(
    () => createAccount(db, { email: 'alice@example.com', password: 'different-password' }),
    (err) => err.code === 'account-exists'
  );
  assert.equal((await authenticate(db, 'alice@example.com', PASSWORD)).ok, true, 'original intact');
});

// ------------------------------------------------------------------- google

const G = { sub: 'g-sub-1', email: 'alice@example.com', emailVerified: true };

test('google sign-in creates a verified account when the address is new', async () => {
  const db = await freshDb();
  const res = await accountForGoogle(db, G);
  assert.equal(res.action, 'created');
  const again = await accountForGoogle(db, G);
  assert.equal(again.action, 'signed-in');
  assert.equal(again.account.id, res.account.id, 'same row both times');
});

test('NO SILENT MERGE: an unverified password account does not capture a Google sign-in', async () => {
  // The takeover primitive: pre-register victim@gmail.com with a password,
  // wait for the victim to click "Continue with Google".
  const db = await freshDb();
  await createAccount(db, { email: 'alice@example.com', password: PASSWORD }); // unverified
  const res = await accountForGoogle(db, G);
  assert.equal(res.action, 'refused');
  assert.equal(res.reason, 'unverified-password-account');
});

test('a VERIFIED password account links Google onto the same row', async () => {
  const db = await freshDb();
  const acct = await createAccount(db, { email: 'alice@example.com', password: PASSWORD });
  await db.prepare('UPDATE accounts SET email_verified_at = 1 WHERE id = ?').bind(acct.id).run();
  const res = await accountForGoogle(db, G);
  assert.equal(res.action, 'signed-in');
  assert.equal(res.account.id, acct.id, 'ONE account, two doors');
});

test('google-unverified email is refused outright', async () => {
  const db = await freshDb();
  const res = await accountForGoogle(db, { ...G, emailVerified: false });
  assert.equal(res.action, 'refused');
  assert.equal(res.reason, 'google-email-unverified');
});

// ----------------------------------------------------------------- sessions

test('a session round-trips, and revocation ends it NOW', async () => {
  const db = await freshDb();
  const acct = await createAccount(db, { email: 'alice@example.com', password: PASSWORD });
  const { token } = await createSession(db, acct.id);
  assert.equal((await sessionAccount(db, token)).email, 'alice@example.com');

  await revokeSession(db, token);
  assert.equal(await sessionAccount(db, token), null, 'revoked means over, not "at refresh"');
});

test('an expired session is not a session', async () => {
  const db = await freshDb();
  const acct = await createAccount(db, { email: 'alice@example.com', password: PASSWORD });
  const { token } = await createSession(db, acct.id, { now: 1000 });
  assert.equal(await sessionAccount(db, token, { now: 1000 + 31 * 24 * 3600_000 }), null);
});

test('revoking an ACCOUNT kicks every session; the raw token is never stored', async () => {
  const db = await freshDb();
  const acct = await createAccount(db, { email: 'alice@example.com', password: PASSWORD });
  const a = await createSession(db, acct.id);
  const b = await createSession(db, acct.id);
  await revokeAccountSessions(db, acct.id);
  assert.equal(await sessionAccount(db, a.token), null);
  assert.equal(await sessionAccount(db, b.token), null);

  const { results } = await db.prepare('SELECT id FROM sessions').all();
  for (const row of results) {
    assert.ok(
      !a.token.includes(row.id) && !row.id.includes(a.token.slice(4)),
      'stored id is a digest, not the token'
    );
  }
});

test('normalizeEmail rejects shapes that are not addresses', () => {
  assert.equal(normalizeEmail(' Alice@Example.COM '), 'alice@example.com');
  for (const bad of ['', 'nope', 'a@b', '@x.com', null, 'a b@c.com']) {
    assert.equal(normalizeEmail(bad), null, String(bad));
  }
});
