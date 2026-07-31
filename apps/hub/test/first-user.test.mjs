// First-user seeding — the bug a real boot found.
//
// `workspace-up` wrote MAUDE_ADMIN_EMAIL/PASSWORD into .env and compose passed
// them to the container, and nothing read them: a freshly provisioned
// workspace had no users at all, so the person the operator had just named
// could not sign in. These tests pin the three rules that make seeding safe.

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';

import { seedFirstUser, seedFirstUserOnBoot } from '../src/first-user.mjs';
import { authenticate, closeUsers, createUser, listUsers } from '../src/users.mjs';

const dirs = [];
function freshDir() {
  const d = mkdtempSync(join(tmpdir(), 'maude-first-user-'));
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

const PASSWORD = 'a-long-enough-password';

test('the named operator can actually sign in afterwards', () => {
  // The whole point. Creating a row nobody can authenticate against would
  // reproduce the original bug with extra steps.
  const dir = freshDir();
  const res = seedFirstUser(dir, { email: 'Alice@Example.com', password: PASSWORD });
  assert.equal(res.state, 'created');
  assert.equal(res.email, 'alice@example.com', 'address is normalized on the way in');

  const auth = authenticate(dir, 'alice@example.com', PASSWORD);
  assert.equal(auth.ok, true, 'the seeded credential authenticates');
  assert.equal(auth.user.role, 'admin');
});

test('a RESTART never resets an existing password', () => {
  // The dangerous shape: .env still holds the original generated password, so
  // a re-seed on every boot would silently revert a password the operator
  // changed — and revert it to a value sitting in a file on the host.
  const dir = freshDir();
  seedFirstUser(dir, { email: 'alice@example.com', password: PASSWORD });

  const changed = 'the-password-they-chose';
  createUser(dir, { email: 'bob@example.com', password: changed, role: 'member' });

  const again = seedFirstUser(dir, { email: 'alice@example.com', password: 'a-different-one-now' });
  assert.equal(again.state, 'skipped');
  assert.match(again.reason, /already has users/);

  assert.equal(
    authenticate(dir, 'alice@example.com', PASSWORD).ok,
    true,
    'original password still works'
  );
  assert.equal(
    authenticate(dir, 'alice@example.com', 'a-different-one-now').ok,
    false,
    'the .env value did NOT overwrite it'
  );
});

test('an empty password FAILS loudly instead of inventing one', () => {
  // An account whose password the operator does not know is indistinguishable
  // from no account — except that it occupies the first-boot slot, so the
  // recovery path (create it in /admin) then collides.
  const dir = freshDir();
  const res = seedFirstUser(dir, { email: 'alice@example.com', password: '' });
  assert.equal(res.state, 'failed');
  assert.match(res.reason, /MAUDE_ADMIN_PASSWORD/);
  assert.deepEqual(listUsers(dir), [], 'no half-made account left behind');
});

test('no MAUDE_ADMIN_EMAIL is a quiet skip, not a failure', () => {
  // Plenty of hubs are not provisioned by workspace-up. They must boot clean.
  const dir = freshDir();
  const res = seedFirstUser(dir, {});
  assert.equal(res.state, 'skipped');
  assert.deepEqual(listUsers(dir), []);
});

test('a rejected address is reported, never thrown at the boot path', () => {
  // A crash-looping container is strictly worse than a running one with no
  // first user: the latter is recoverable through /admin.
  const dir = freshDir();
  const res = seedFirstUser(dir, { email: 'not-an-address', password: PASSWORD });
  assert.equal(res.state, 'failed');
  assert.deepEqual(listUsers(dir), []);
});

test('the password is NEVER written to the log', () => {
  const dir = freshDir();
  const lines = [];
  const log = { log: (m) => lines.push(m), warn: (m) => lines.push(m) };
  seedFirstUserOnBoot(
    dir,
    { MAUDE_ADMIN_EMAIL: 'alice@example.com', MAUDE_ADMIN_PASSWORD: PASSWORD },
    log
  );

  const joined = lines.join('\n');
  assert.ok(joined.includes('alice@example.com'), 'the address IS useful to log');
  assert.ok(!joined.includes(PASSWORD), 'the password is not');
});

test('a failure to seed is LOUD — the operator must not discover it at sign-in', () => {
  const dir = freshDir();
  const lines = [];
  const log = { log: () => {}, warn: (m) => lines.push(m) };
  seedFirstUserOnBoot(dir, { MAUDE_ADMIN_EMAIL: 'alice@example.com' }, log);

  assert.equal(lines.length, 1);
  assert.match(lines[0], /nobody can sign in/);
});
