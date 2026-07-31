// Migration runner — Cloud Phase 12.

import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';

import { d1FromSqlite } from './db.mjs';
import { applySchema, MIGRATIONS, schemaStatements } from './migrate.mjs';
import { SCHEMA_SQL } from './schema.mjs';

test('the splitter yields every table the schema declares', async () => {
  const joined = schemaStatements(SCHEMA_SQL).join('\n');
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
  const first = await applySchema(db, SCHEMA_SQL);
  // Derived from MIGRATIONS, not a literal: this test is about IDEMPOTENCE,
  // and hardcoding the number makes every future migration edit a test that
  // has nothing to do with it.
  const latest = Math.max(...MIGRATIONS.map((m) => m.version));
  assert.equal(first.version, latest);
  const second = await applySchema(db, SCHEMA_SQL);
  assert.equal(second.version, latest, 'a re-run neither fails nor re-migrates');
});

test('v2 lands sessions + identity columns exactly once', async () => {
  const raw = new DatabaseSync(':memory:');
  const db = d1FromSqlite(raw);
  await applySchema(db, SCHEMA_SQL);
  await applySchema(db, SCHEMA_SQL); // ALTER TABLE would throw on a second real run
  const cols = raw
    .prepare("SELECT name FROM pragma_table_info('accounts')")
    .all()
    .map((c) => c.name);
  for (const c of ['email_verified_at', 'google_sub', 'password_hash']) {
    assert.ok(cols.includes(c), c);
  }
  assert.ok(raw.prepare("SELECT name FROM sqlite_master WHERE name='sessions'").get());
});

test('schema.mjs and schema.sql are byte-identical', async () => {
  // Two files, one schema. The Worker can only read the .mjs (no node:fs) and
  // `wrangler d1 execute` can only read the .sql, so both must exist — and a
  // silent drift between them would apply one schema in production and assert
  // another in tests. Regenerate with:
  //   node -e "…" (see the header of schema.mjs)
  const { readFileSync } = await import('node:fs');
  const { dirname, join } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const onDisk = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'schema.sql'), 'utf8');
  assert.equal(SCHEMA_SQL, onDisk, 'schema.mjs drifted from schema.sql');
});
