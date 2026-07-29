// Migration runner — Cloud Phase 12.

import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';

import { d1FromSqlite } from './db.mjs';
import { applySchema, schemaStatements } from './migrate.mjs';

test('the splitter yields every table the schema declares', () => {
  const joined = schemaStatements().join('\n');
  for (const table of [
    'accounts',
    'projects',
    'jobs',
    'account_invites',
    'audit_log',
    'schema_migrations',
  ]) {
    assert.match(joined, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`), table);
  }
});

test('applySchema is idempotent — the property the live D1 run proved', async () => {
  const db = d1FromSqlite(new DatabaseSync(':memory:'));
  const first = await applySchema(db);
  assert.equal(first.version, 2);
  const second = await applySchema(db);
  assert.equal(second.version, 2, 'a re-run neither fails nor re-migrates');
});

test('v2 lands sessions + identity columns exactly once', async () => {
  const raw = new DatabaseSync(':memory:');
  const db = d1FromSqlite(raw);
  await applySchema(db);
  await applySchema(db); // ALTER TABLE would throw on a second real run
  const cols = raw
    .prepare("SELECT name FROM pragma_table_info('accounts')")
    .all()
    .map((c) => c.name);
  for (const c of ['email_verified_at', 'google_sub', 'password_hash']) {
    assert.ok(cols.includes(c), c);
  }
  assert.ok(raw.prepare("SELECT name FROM sqlite_master WHERE name='sessions'").get());
});
