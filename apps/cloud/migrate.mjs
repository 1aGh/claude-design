// Schema migration — Cloud Phase 12/13.
//
// PURE: takes the schema TEXT, never reads a disk. That is not tidiness — a
// `readFileSync` here made the Worker unpublishable (`No such module
// "node:fs"`), and the failure was invisible locally because the deploy
// output was being grepped for a success line. CI caught it; the decision
// layer taking data instead of fetching it is what makes that fixable in one
// place (DDR-196 §1).
//
// Who supplies the text:
//   - the Worker: `import schemaSql from './schema.sql'` via wrangler's Text
//     rule, so `schema.sql` stays the single source of truth;
//   - Node tests and local tools: `readSchemaSql()` below, which is the only
//     thing in this file that touches a filesystem and is never imported by
//     the Worker.

/** Split schema text into executable statements. One splitter, one behaviour. */
export function schemaStatements(sql) {
  return String(sql)
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
  {
    version: 3, // Phase 19 — where a project mirrors to
    statements: [
      // `owner/name`, validated by mirror.mjs before it is ever written. Stored
      // on the PROJECT, because the control plane must be able to answer "is
      // this the repository that project is allowed to push to" without
      // trusting the asking cell — that check is the whole point of the
      // credential boundary.
      'ALTER TABLE projects ADD COLUMN mirror_repo TEXT;',
      'ALTER TABLE projects ADD COLUMN mirror_branch TEXT;',
    ],
  },
  {
    version: 4, // Phase 22 — membership, so a project can have more than an owner
    statements: [
      // Membership is a CONTROL-PLANE fact (DDR-204). It used to be implied by
      // whoever had a password on a particular cell, which meant removing
      // somebody required reaching into their cell — and left no way to end a
      // session they already had.
      `CREATE TABLE IF NOT EXISTS project_members (
        project_id TEXT NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
        account_id TEXT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
        role       TEXT NOT NULL CHECK (role IN ('viewer','member','owner')),
        added_at   INTEGER NOT NULL,
        PRIMARY KEY (project_id, account_id)
      );`,
      'CREATE INDEX IF NOT EXISTS members_account ON project_members (account_id);',
    ],
  },
  {
    version: 5, // Phase 22 — inviting someone who has no account yet
    statements: [
      // SEPARATE from account_invites, which invites somebody to the PLATFORM
      // (Phase 6). A project invite has to carry the project and the role, and
      // overloading one table would mean a row whose meaning depends on which
      // columns happen to be null — and every reader having to know that.
      `CREATE TABLE IF NOT EXISTS project_invites (
        id          TEXT PRIMARY KEY,
        project_id  TEXT NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
        email       TEXT NOT NULL,
        role        TEXT NOT NULL CHECK (role IN ('viewer','member')),
        created_at  INTEGER NOT NULL,
        expires_at  INTEGER NOT NULL,
        redeemed_at INTEGER,
        revoked_at  INTEGER
      );`,
      'CREATE INDEX IF NOT EXISTS project_invites_email ON project_invites (email);',
    ],
  },
];

/** Apply baseline + pending versioned migrations. Safe to run repeatedly. */
export async function applySchema(db, schemaSql) {
  if (!schemaSql) throw new Error('applySchema needs the schema text (see readSchemaSql)');
  for (const sql of schemaStatements(schemaSql)) {
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
  return { version: row?.v ?? null, statements: schemaStatements(schemaSql).length };
}

/**
 * Read `schema.sql` from disk — NODE ONLY.
 *
 * Deliberately a dynamic import of `node:fs`, so bundling this module for the
 * Worker cannot pull the module in. The Worker never calls this; it imports
 * the .sql as text.
 */
export async function readSchemaSql() {
  const { readFileSync } = await import('node:fs');
  const { dirname, join } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  return readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'schema.sql'), 'utf8');
}
