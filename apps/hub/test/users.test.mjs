// Cloud Phase 2 Task 1 — user model, login, expiring peer tokens, offboarding.
//
// The exit-gate properties this file exists to prove:
//   • login → expiring token → the token actually authenticates a sync connect
//   • an expired token stops authenticating (and does not linger in the store)
//   • offboarding ONE user touches nobody else's credentials
//   • the permissive dev-auth path is off the moment a hub has users

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, test } from 'node:test';

import { permissiveDevAuthDisabled, userTokenTtlMs } from '../src/auth-routes.mjs';
import { createHub } from '../src/server.mjs';
import { addToken, listTokensForOwner, purgeExpiredTokens, verifyToken } from '../src/tokens.mjs';
import {
  authenticate,
  closeUsers,
  createUser,
  hashPassword,
  normalizeEmail,
  verifyPassword,
} from '../src/users.mjs';

const BASE_PORT = Number.parseInt(process.env.HUB_USERS_TEST_PORT ?? '14700', 10);
const SECRET = 'test-admin-secret';
const PASSWORD = 'correct-horse-battery-staple';

let hub;
let dataDir;
let PORT;
let portCounter = 0;

beforeEach(async () => {
  PORT = BASE_PORT + portCounter++;
  dataDir = mkdtempSync(join(tmpdir(), 'maude-hub-users-'));
  const built = createHub({
    port: PORT,
    dataDir,
    secret: SECRET,
    publicUrl: `https://hub.example.com:${PORT}`,
    verbose: false,
  });
  hub = built.server;
  await hub.listen();
});

afterEach(async () => {
  if (hub) await hub.destroy();
  if (dataDir) {
    closeUsers(dataDir);
    rmSync(dataDir, { recursive: true, force: true });
  }
});

const base = () => `http://127.0.0.1:${PORT}`;
const admin = (extra = {}) => ({ Authorization: `Bearer ${SECRET}`, ...extra });
const json = (body) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});
const adminJson = (body) => ({
  method: 'POST',
  headers: admin({ 'Content-Type': 'application/json' }),
  body: JSON.stringify(body),
});

async function makeUser(email, password = PASSWORD, extra = {}) {
  const res = await fetch(`${base()}/admin/api/users`, adminJson({ email, password, ...extra }));
  assert.equal(res.status, 201, `createUser(${email}) → ${res.status}`);
  return (await res.json()).user;
}

async function login(email, password = PASSWORD) {
  return fetch(`${base()}/auth/login`, json({ email, password }));
}

// ---------------------------------------------------------------- unit layer

test('password hashing is scrypt, salted, and constant-time verified', () => {
  const a = hashPassword(PASSWORD);
  const b = hashPassword(PASSWORD);
  assert.notEqual(a, b, 'same password must not produce the same record (salt)');
  assert.match(a, /^scrypt\$\d+\$\d+\$\d+\$[0-9a-f]+\$[0-9a-f]+$/);
  assert.equal(verifyPassword(PASSWORD, a), true);
  assert.equal(verifyPassword(`${PASSWORD}x`, a), false);
  // Garbage records are rejected, never thrown on.
  for (const bad of ['', 'nonsense', 'scrypt$x$y$z$aa$bb', 'bcrypt$1$2$3$aa$bb']) {
    assert.equal(verifyPassword(PASSWORD, bad), false);
  }
});

test('a stored record naming absurd scrypt parameters is refused, not obeyed', () => {
  // Defense against a crafted row turning a login attempt into a memory bomb.
  const evil = `scrypt$1073741824$8$1$${'aa'.repeat(16)}$${'bb'.repeat(32)}`;
  assert.equal(verifyPassword(PASSWORD, evil), false);
});

test('addresses are case-folded, so one account cannot hide behind capitals', () => {
  createUser(dataDir, { email: '  Alice@Example.COM ', password: PASSWORD });
  assert.equal(normalizeEmail(' Alice@Example.COM '), 'alice@example.com');
  assert.equal(authenticate(dataDir, 'alice@example.com', PASSWORD).ok, true);
  assert.equal(authenticate(dataDir, 'ALICE@EXAMPLE.COM', PASSWORD).ok, true);
});

test('userTokenTtlMs defaults to 30 days and clamps a hostile override', () => {
  assert.equal(userTokenTtlMs({}), 30 * 24 * 3600_000);
  assert.equal(userTokenTtlMs({ HUB_USER_TOKEN_TTL_HOURS: '1' }), 3600_000);
  assert.equal(userTokenTtlMs({ HUB_USER_TOKEN_TTL_HOURS: '0' }), 30 * 24 * 3600_000);
  assert.equal(userTokenTtlMs({ HUB_USER_TOKEN_TTL_HOURS: 'abc' }), 30 * 24 * 3600_000);
  // No unbounded lifetime — that would recreate the forever-token this replaces.
  assert.equal(userTokenTtlMs({ HUB_USER_TOKEN_TTL_HOURS: '999999' }), 24 * 365 * 3600_000);
});

// ------------------------------------------------------------------- expiry

test('an expired token stops authenticating AND is swept from the store', () => {
  const past = addToken(dataDir, { label: 'expired-one', scope: '*', expiresAt: Date.now() - 1000 });
  const future = addToken(dataDir, { label: 'live-one', scope: '*', expiresAt: Date.now() + 60_000 });
  const forever = addToken(dataDir, { label: 'no-expiry', scope: '*' });

  assert.equal(verifyToken(dataDir, past.value, ''), null, 'expired must not authenticate');
  assert.ok(verifyToken(dataDir, future.value, ''), 'unexpired must authenticate');
  assert.ok(verifyToken(dataDir, forever.value, ''), 'NULL expiry means never expires');

  // Presenting it removed the dead row, so a later replay is indistinguishable
  // from an unknown token rather than a known-but-refused one.
  assert.equal(verifyToken(dataDir, past.value, ''), null);
});

test('purgeExpiredTokens returns exactly the labels it removed', () => {
  addToken(dataDir, { label: 'gone-a', expiresAt: Date.now() - 1 });
  addToken(dataDir, { label: 'gone-b', expiresAt: Date.now() - 50_000 });
  addToken(dataDir, { label: 'stays', expiresAt: Date.now() + 60_000 });
  addToken(dataDir, { label: 'immortal' });
  const purged = purgeExpiredTokens(dataDir).sort();
  assert.deepEqual(purged, ['gone-a', 'gone-b']);
  assert.deepEqual(purgeExpiredTokens(dataDir), [], 'idempotent');
});

// ------------------------------------------------------------- login/logout

test('login mints a scoped expiring token; the token authenticates a connect', async () => {
  await makeUser('alice@example.com');
  const res = await login('alice@example.com');
  assert.equal(res.status, 200);
  const body = await res.json();

  assert.match(body.token, /^mau_[0-9a-f]{32}$/);
  assert.match(body.label, /^u-[0-9a-f]{12}$/);
  assert.equal(body.user.email, 'alice@example.com');
  assert.equal(body.user.role, 'member');
  assert.ok(body.expiresAt > Date.now(), 'token must carry a future expiry');
  assert.ok(body.expiresAt <= Date.now() + 30 * 24 * 3600_000 + 5000);

  // The end-to-end property: this value is a working peer credential.
  const match = verifyToken(dataDir, body.token, SECRET);
  assert.ok(match, 'minted token must verify against the hub token store');
  assert.equal(match.owner, 'alice@example.com');
  assert.equal(match.label, body.label);
  assert.equal(match.expiresAt, body.expiresAt);

  // The label is NOT derived from the address — token labels are visible to
  // any admin surface and must not leak the user list.
  assert.ok(!body.label.includes('alice'));
});

test('every login failure returns ONE opaque message (no user-existence oracle)', async () => {
  await makeUser('alice@example.com');
  const wrongPassword = await login('alice@example.com', 'not-the-password');
  const noSuchUser = await login('nobody@example.com', PASSWORD);

  assert.equal(wrongPassword.status, 401);
  assert.equal(noSuchUser.status, 401);
  assert.deepEqual(await wrongPassword.json(), await noSuchUser.json());
  assert.equal((await login('alice@example.com', 'x')).status, 401);
});

test('a disabled user cannot log in, and is disabled by password too', async () => {
  await makeUser('bob@example.com');
  assert.equal((await login('bob@example.com')).status, 200);

  const res = await fetch(`${base()}/admin/api/users/disable`, adminJson({ email: 'bob@example.com' }));
  assert.equal(res.status, 200);

  assert.equal((await login('bob@example.com')).status, 401);
  // Correct password + disabled account must be indistinguishable from a wrong
  // password, or "is this account disabled?" becomes a probe.
  const disabled = await login('bob@example.com');
  const wrong = await login('bob@example.com', 'wrong-password-entirely');
  assert.deepEqual(await disabled.json(), await wrong.json());
});

test('logout revokes exactly the surrendered token', async () => {
  await makeUser('carol@example.com');
  const first = await (await login('carol@example.com')).json();
  const second = await (await login('carol@example.com')).json();
  assert.notEqual(first.token, second.token);

  const res = await fetch(`${base()}/auth/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${first.token}` },
  });
  assert.equal(res.status, 200);

  assert.equal(verifyToken(dataDir, first.token, SECRET), null, 'logged-out token is dead');
  assert.ok(verifyToken(dataDir, second.token, SECRET), 'the other session survives');
});

test('logout with the ADMIN Bearer is refused — it is not a user session', async () => {
  // The admin Bearer is an operator credential, not a user credential (DDR-053).
  const res = await fetch(`${base()}/auth/logout`, {
    method: 'POST',
    headers: admin(),
  });
  assert.equal(res.status, 401);
});

test('GET /auth/session reflects the live session', async () => {
  await makeUser('dave@example.com', PASSWORD, { role: 'admin' });
  const session = await (await login('dave@example.com')).json();
  const res = await fetch(`${base()}/auth/session`, {
    headers: { Authorization: `Bearer ${session.token}` },
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.user.email, 'dave@example.com');
  assert.equal(body.user.role, 'admin');
  assert.equal(body.label, session.label);
  assert.equal(body.expiresAt, session.expiresAt);
});

// --------------------------------------------------------------- offboarding

test('offboarding one user touches NOBODY else — the exit-gate property', async () => {
  await makeUser('alice@example.com');
  await makeUser('bob@example.com');
  const aliceA = await (await login('alice@example.com')).json();
  const aliceB = await (await login('alice@example.com')).json();
  const bob = await (await login('bob@example.com')).json();
  // A machine token owned by nobody — the CI credential an offboard must not eat.
  const machine = addToken(dataDir, { label: 'ci-runner', scope: '*' });

  const res = await fetch(`${base()}/admin/api/users/delete`, adminJson({ email: 'alice@example.com' }));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.revoked, 2, 'both of alice’s sessions revoked');

  assert.equal(verifyToken(dataDir, aliceA.token, SECRET), null);
  assert.equal(verifyToken(dataDir, aliceB.token, SECRET), null);
  assert.ok(verifyToken(dataDir, bob.token, SECRET), "bob's session is untouched");
  assert.ok(verifyToken(dataDir, machine.value, SECRET), 'the machine token is untouched');
  assert.ok(verifyToken(dataDir, SECRET, SECRET), 'the admin Bearer is untouched');

  assert.equal((await login('alice@example.com')).status, 401);
  assert.equal((await login('bob@example.com')).status, 200);
});

test('offboarding is exact-match, not prefix — a lookalike address is safe', async () => {
  // `revokeTokensForOwner` matching by prefix would take out the wrong account.
  await makeUser('alice@example.com');
  await makeUser('alice@example.com.evil.test');
  const victim = await (await login('alice@example.com.evil.test')).json();
  const target = await (await login('alice@example.com')).json();

  await fetch(`${base()}/admin/api/users/delete`, adminJson({ email: 'alice@example.com' }));

  assert.equal(verifyToken(dataDir, target.token, SECRET), null);
  assert.ok(verifyToken(dataDir, victim.token, SECRET), 'the lookalike account survives');
});

test('disabling revokes live credentials, not just future logins', async () => {
  await makeUser('erin@example.com');
  const session = await (await login('erin@example.com')).json();
  assert.ok(verifyToken(dataDir, session.token, SECRET));

  const res = await fetch(`${base()}/admin/api/users/disable`, adminJson({ email: 'erin@example.com' }));
  assert.equal((await res.json()).revoked, 1);
  assert.equal(
    verifyToken(dataDir, session.token, SECRET),
    null,
    'disabled must mean "cannot keep working", not only "cannot log in again"'
  );
});

test('changing a password revokes existing sessions', async () => {
  await makeUser('frank@example.com');
  const session = await (await login('frank@example.com')).json();
  const res = await fetch(
    `${base()}/admin/api/users/password`,
    adminJson({ email: 'frank@example.com', password: 'a-brand-new-password' })
  );
  assert.equal(res.status, 200);
  assert.equal(verifyToken(dataDir, session.token, SECRET), null);
  assert.equal((await login('frank@example.com')).status, 401);
  assert.equal((await login('frank@example.com', 'a-brand-new-password')).status, 200);
});

// ------------------------------------------------------------- admin surface

test('user admin routes require the admin Bearer', async () => {
  for (const [path, init] of [
    ['/admin/api/users', {}],
    ['/admin/api/users', json({ email: 'x@y.com', password: PASSWORD })],
    ['/admin/api/users/delete', json({ email: 'x@y.com' })],
    ['/admin/api/users/disable', json({ email: 'x@y.com' })],
  ]) {
    const res = await fetch(`${base()}${path}`, init);
    assert.equal(res.status, 401, `${path} must be 401 without the Bearer`);
  }
});

test('a user session token is NOT admin access', async () => {
  await makeUser('grace@example.com', PASSWORD, { role: 'admin' });
  const session = await (await login('grace@example.com')).json();
  // Even role:'admin' on the USER record grants nothing on the operator surface —
  // there is no path from a password to the DDR-053 Bearer.
  const res = await fetch(`${base()}/admin/api/users`, {
    headers: { Authorization: `Bearer ${session.token}` },
  });
  assert.equal(res.status, 401);
});

test('creating a duplicate user is 409, never a silent password overwrite', async () => {
  await makeUser('heidi@example.com');
  const res = await fetch(
    `${base()}/admin/api/users`,
    adminJson({ email: 'HEIDI@example.com', password: 'a-different-password' })
  );
  assert.equal(res.status, 409);
  assert.equal((await login('heidi@example.com')).status, 200, 'original password still works');
});

test('weak or malformed input is rejected at the source', async () => {
  for (const body of [
    { email: 'short@example.com', password: 'short' },
    { email: 'not-an-email', password: PASSWORD },
    { email: 'two@at@example.com', password: PASSWORD },
    { email: '@example.com', password: PASSWORD },
    { email: 'a@b', password: PASSWORD, role: 'superuser' },
  ]) {
    const res = await fetch(`${base()}/admin/api/users`, adminJson(body));
    assert.equal(res.status, 400, `expected 400 for ${JSON.stringify(body)}`);
  }
});

test('GET /admin/api/users lists accounts with live-credential counts, never hashes', async () => {
  await makeUser('ivan@example.com');
  await login('ivan@example.com');
  await login('ivan@example.com');
  const res = await fetch(`${base()}/admin/api/users`, { headers: admin() });
  const { users } = await res.json();
  assert.equal(users.length, 1);
  assert.equal(users[0].email, 'ivan@example.com');
  assert.equal(users[0].tokenCount, 2);
  assert.equal(users[0].disabled, false);
  assert.ok(!('hash' in users[0]), 'never surface the password hash');
  assert.equal(listTokensForOwner(dataDir, 'ivan@example.com').length, 2);
});

// --------------------------------------------------------- dev-mode footgun

test('the permissive dev-auth path is off the moment the hub has a user', () => {
  assert.equal(permissiveDevAuthDisabled(dataDir, {}), false, 'empty hub: dev mode allowed');
  assert.equal(
    permissiveDevAuthDisabled(dataDir, { HUB_WORKSPACE_MODE: '1' }),
    true,
    'workspace mode disables it outright'
  );
  createUser(dataDir, { email: 'someone@example.com', password: PASSWORD });
  assert.equal(
    permissiveDevAuthDisabled(dataDir, {}),
    true,
    'one real account is enough — there is no flag to turn it back on'
  );
});
