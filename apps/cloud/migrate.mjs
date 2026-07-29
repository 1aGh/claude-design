// Schema migration — Cloud Phase 12.
//
// schema.sql is IF-NOT-EXISTS throughout, so "migrate" is "apply it again":
// proven idempotent against the live D1 (applied 2026-07-28, re-run 2026-07-29
// with changed_db:false on every statement). This module exists so tests, the
// local sqlite tools and any future runner all split the file the same way —
// a second, slightly different splitter is how statement 7 silently never runs.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

/** schema.sql as an ordered list of executable statements. */
export function schemaStatements() {
  const raw = readFileSync(join(here, 'schema.sql'), 'utf8');
  return raw
    .replace(/--[^\n]*/g, '') // comments carry no semantics for the engine
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => `${s};`);
}

/**
 * Versioned migrations beyond the baseline. Each entry runs once — guarded by
 * the schema_migrations row, because ALTER TABLE ADD COLUMN is not idempotent
 * the way CREATE IF NOT EXISTS is.
 */
export const MIGRATIONS = [
  {
    version: 2, // Phase 13 — one-account identity
    statements: [
      // Google-linking safety (the no-silent-merge rule) needs to know whether
      // an address was ever actually verified, and which Google subject a row
      // is linked to. `google_sub` is UNIQUE — one Google identity, one account.
      'ALTER TABLE accounts ADD COLUMN email_verified_at INTEGER;',
      'ALTER TABLE accounts ADD COLUMN google_sub TEXT;',
      'CREATE UNIQUE INDEX IF NOT EXISTS accounts_google ON accounts (google_sub) WHERE google_sub IS NOT NULL;',
      'ALTER TABLE accounts ADD COLUMN password_hash TEXT;',
      // Sessions are server-side rows so revocation is real: deleting the row
      // ends the session, not merely the next cookie refresh. `id` stores a
      // SHA-256 of the cookie value — a database read never yields a usable
      // credential.
      `CREATE TABLE IF NOT EXISTS sessions (
        id          TEXT PRIMARY KEY,
        account_id  TEXT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
        created_at  INTEGER NOT NULL,
        expires_at  INTEGER NOT NULL,
        revoked_at  INTEGER
      );`,
      'CREATE INDEX IF NOT EXISTS sessions_account ON sessions (account_id);',
    ],
  },
];

/** Apply baseline + pending versioned migrations. Safe to run repeatedly. */
export async function applySchema(db) {
  for (const sql of schemaStatements()) {
    await db.prepare(sql).run();
  }
  for (const m of MIGRATIONS) {
    const done = await db
      .prepare('SELECT 1 AS x FROM schema_migrations WHERE version = ?')
      .bind(m.version)
      .first();
    if (done) continue;
    for (const sql of m.statements) await db.prepare(sql).run();
    await db
      .prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)')
      .bind(m.version, Date.now())
      .run();
  }
  const row = await db.prepare('SELECT MAX(version) AS v FROM schema_migrations').first();
  return { version: row?.v ?? null, statements: schemaStatements().length };
}
