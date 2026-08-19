// The schema stamp — Track A' A2.
//
// An unstamped database is ambiguous FOREVER: a future migration cannot tell
// "predates versioning" from "already at version N". Every deployment that
// starts before the stamp exists bakes that ambiguity in, which is why this
// ships with the durability patch rather than with the migration runner that
// will eventually read it.

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';

import { SCHEMA_VERSION, stampSchemaVersion } from '../src/schema-version.mjs';
import { closeUsers, createUser } from '../src/users.mjs';

const Database = createRequire(import.meta.url)('better-sqlite3');
const dirs = [];
function freshDir() {
  const d = mkdtempSync(join(tmpdir(), 'maude-schema-'));
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

const version = (path) =>
  Number(new Database(path, { readonly: true }).pragma('user_version', { simple: true }));

test('an unstamped database is stamped on first open', () => {
  const db = new Database(join(freshDir(), 'x.db'));
  assert.equal(Number(db.pragma('user_version', { simple: true })), 0);
  const r = stampSchemaVersion(db);
  assert.deepEqual(r, { found: 0, stamped: SCHEMA_VERSION, downgrade: false });
  assert.equal(Number(db.pragma('user_version', { simple: true })), SCHEMA_VERSION);
});

test('re-opening does not churn the stamp', () => {
  const db = new Database(join(freshDir(), 'x.db'));
  stampSchemaVersion(db);
  assert.deepEqual(stampSchemaVersion(db), {
    found: SCHEMA_VERSION,
    stamped: SCHEMA_VERSION,
    downgrade: false,
  });
});

test('a NEWER stamp is left alone and reported as a downgrade', () => {
  // The operator rolled an image back over a database a later version already
  // touched. Silently re-stamping downwards would erase the only evidence.
  const db = new Database(join(freshDir(), 'x.db'));
  db.pragma(`user_version = ${SCHEMA_VERSION + 5}`);
  const r = stampSchemaVersion(db);
  assert.equal(r.downgrade, true);
  assert.equal(r.stamped, SCHEMA_VERSION + 5);
  assert.equal(Number(db.pragma('user_version', { simple: true })), SCHEMA_VERSION + 5);
});

test('users.db carries the stamp through the real open path', () => {
  // The stamp is worthless if it only exists in this test's fixture.
  const dir = freshDir();
  createUser(dir, { email: 'a@b.co', password: 'correct horse battery' });
  closeUsers(dir);
  assert.equal(version(join(dir, 'users.db')), SCHEMA_VERSION);
});
