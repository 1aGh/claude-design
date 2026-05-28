// Token store — SQLite-backed, HMAC-SHA256 at rest (Phase 9 Task 6).
//
// Phase 9 Task 2 shipped a plaintext tokens.json (file mode 0600). Task 6
// (auth + transport hardening) replaces that with a SQLite `tokens` table whose
// `hash` column stores `hmac_sha256(rawToken, hubKey)` — the raw token value is
// NEVER written to disk. Because HMAC is preimage-resistant, an attacker who
// reads the store cannot derive a raw token that would authenticate (auth
// requires presenting the raw value; the hub hashes it and compares). The
// per-hub key lives in a `meta` row in the SAME db, so this protects against
// REPLAY from a stolen store, not against an attacker forging rows in a store
// they can also write — which is full compromise regardless. Sourcing the key
// from env/KMS (stronger against whole-file theft) is a v1.2 candidate.
//
// SQLite layout (<dataDir>/tokens.db, file mode 0600):
//   meta(k TEXT PRIMARY KEY, v TEXT NOT NULL)          -- holds 'hmac_key'
//   tokens(
//     label        TEXT PRIMARY KEY,                   -- caller-chosen label
//     hash         TEXT NOT NULL UNIQUE,               -- hmac_sha256(value, key)
//     scope        TEXT,                               -- NULL = wildcard
//     dev          INTEGER NOT NULL DEFAULT 0,
//     created_at   INTEGER NOT NULL,
//     last_used_at INTEGER
//   )
//
// Legacy migration: a pre-Task-6 `tokens.json` is imported once on first open
// (each raw value is hashed into the table) and then DELETED. We do not keep a
// `.migrated` backup — that file would be cleartext tokens on disk, defeating
// the entire point of hashing at rest (a stolen backup = replayable tokens).
//
// HMAC key choice: a per-hub random 256-bit key, persisted in the meta table on
// first init. The plan text says "HMAC-SHA256 against HUB_SECRET env"; we use a
// persisted key instead of HUB_SECRET directly so tokens stay valid when the
// operator sets/unsets/changes HUB_SECRET (which is a separate escape-hatch
// credential, compared directly in verifyToken). HUB_SECRET being optional is
// the common case — admin-UI-minted tokens carry no HUB_SECRET.
//
// Per DDR-053 (carried forward):
//   - addToken / rotateToken enforce label regex /^[A-Za-z0-9 _.\-]{1,64}$/.
//   - Tokens carry an optional `scope`; onAuthenticate enforces matchesScope.
//   - Default scope for a new token = its label. `scope: '*'` opts into wildcard.

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { chmodSync, existsSync, readFileSync, unlinkSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
// better-sqlite3 is a runtime-external native binding (see build.ts). Loading
// it lazily keeps the import graph clean for the bundler.
const Database = require('better-sqlite3');

const TOKEN_PREFIX = 'mau_';
const DEV_PREFIX = 'mau_dev_';
const LABEL_REGEX = /^[A-Za-z0-9 _.\-]{1,64}$/;

/** One open Database handle per dataDir. Native init is expensive; cache it. */
const dbCache = new Map();

/** Compute the path to the SQLite token store for a given data directory. */
export function tokensDbPath(dataDir) {
  return join(dataDir, 'tokens.db');
}

/** Legacy plaintext store path — only read once, for migration. */
function legacyTokensFilePath(dataDir) {
  return join(dataDir, 'tokens.json');
}

/** Open (creating + migrating on first touch) the token DB for `dataDir`. */
function db(dataDir) {
  const cached = dbCache.get(dataDir);
  if (cached?.open) return cached;

  const path = tokensDbPath(dataDir);
  const handle = new Database(path);
  // Default rollback journal (not WAL): single-process, low write volume, and
  // it keeps the on-disk footprint to one file (simpler ops + test cleanup).
  handle.exec('CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL)');
  handle.exec(
    `CREATE TABLE IF NOT EXISTS tokens (
       label        TEXT PRIMARY KEY,
       hash         TEXT NOT NULL UNIQUE,
       scope        TEXT,
       dev          INTEGER NOT NULL DEFAULT 0,
       created_at   INTEGER NOT NULL,
       last_used_at INTEGER
     )`
  );
  try {
    chmodSync(path, 0o600);
  } catch {
    /* Windows / read-only fs — best effort. */
  }
  dbCache.set(dataDir, handle);

  migrateLegacy(dataDir, handle);
  return handle;
}

/** Fetch (or mint + persist) the per-hub HMAC key. */
function hubKey(handle) {
  const row = handle.prepare('SELECT v FROM meta WHERE k = ?').get('hmac_key');
  if (row?.v) return row.v;
  const key = randomBytes(32).toString('hex');
  handle.prepare('INSERT OR REPLACE INTO meta (k, v) VALUES (?, ?)').run('hmac_key', key);
  return key;
}

/** hmac_sha256(value, hubKey) → hex digest used as the at-rest token hash. */
function hashToken(handle, value) {
  return createHmac('sha256', hubKey(handle)).update(String(value), 'utf8').digest('hex');
}

/**
 * One-time import of a pre-Task-6 tokens.json into the SQLite table. No-op when
 * the table already has rows or no legacy file exists. The legacy cleartext
 * file is DELETED after import (not preserved) so no replayable tokens linger.
 */
function migrateLegacy(dataDir, handle) {
  const count = handle.prepare('SELECT COUNT(*) AS n FROM tokens').get().n;
  if (count > 0) return;
  const legacyPath = legacyTokensFilePath(dataDir);
  if (!existsSync(legacyPath)) return;

  let parsed;
  try {
    parsed = JSON.parse(readFileSync(legacyPath, 'utf8'));
  } catch {
    return;
  }
  if (!parsed || !Array.isArray(parsed.tokens)) return;

  const insert = handle.prepare(
    'INSERT OR REPLACE INTO tokens (label, hash, scope, dev, created_at, last_used_at) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const tx = handle.transaction((rows) => {
    for (const t of rows) {
      if (!t || typeof t.label !== 'string' || typeof t.value !== 'string') continue;
      const scope = t.scope ?? null;
      insert.run(
        t.label,
        hashToken(handle, t.value),
        scope === '*' ? null : scope,
        t.dev ? 1 : 0,
        typeof t.createdAt === 'number' ? t.createdAt : Date.now(),
        typeof t.lastUsedAt === 'number' ? t.lastUsedAt : null
      );
    }
  });
  tx(parsed.tokens);
  // Shred the cleartext legacy file — the hashed table is now authoritative and
  // keeping plaintext tokens on disk would negate the at-rest protection.
  try {
    unlinkSync(legacyPath);
  } catch {
    /* best-effort — table is authoritative regardless. */
  }
}

/** Map a DB row to the public record shape (no hash exposed). */
function rowToRecord(row) {
  return {
    label: row.label,
    scope: row.scope ?? '*',
    createdAt: row.created_at,
    lastUsedAt: typeof row.last_used_at === 'number' ? row.last_used_at : null,
    ...(row.dev ? { dev: true } : {}),
  };
}

/**
 * List tokens as metadata (label/scope/createdAt/lastUsedAt/dev). Never returns
 * a raw value or the at-rest hash. Internal callers use `.tokens.length`;
 * the admin API surfaces this verbatim.
 *
 * @param {string} dataDir
 * @returns {{ tokens: Array<{ label: string, scope: string, createdAt: number, lastUsedAt: number | null, dev?: boolean }> }}
 */
export function readTokens(dataDir) {
  try {
    const rows = db(dataDir).prepare('SELECT * FROM tokens ORDER BY created_at ASC').all();
    return { tokens: rows.map(rowToRecord) };
  } catch {
    return { tokens: [] };
  }
}

/** Generate a fresh `mau_<32hex>` token. Dev tokens use the `mau_dev_` prefix. */
export function generateToken({ dev = false } = {}) {
  const prefix = dev ? DEV_PREFIX : TOKEN_PREFIX;
  return prefix + randomBytes(16).toString('hex');
}

/**
 * Validate a token label. Throws with a stable message on failure so callers
 * can pattern-match. Per DDR-053 §5.
 *
 * @param {unknown} label
 */
export function assertValidLabel(label) {
  if (typeof label !== 'string' || label.length === 0) {
    throw new Error('label must be a non-empty string');
  }
  if (!LABEL_REGEX.test(label)) {
    throw new Error(
      'label must match /^[A-Za-z0-9 _.\\-]{1,64}$/ (alphanumeric + space/underscore/dot/hyphen, max 64 chars)'
    );
  }
}

/**
 * Test a `documentName` against a token's scope. Per DDR-053 §3.
 *
 *   scope = undefined / "*" → wildcard (legacy + admin tokens)
 *   scope = "alice"         → exact match OR prefix "alice/"
 *
 * @param {string|undefined} scope
 * @param {string} documentName
 * @returns {boolean}
 */
export function matchesScope(scope, documentName) {
  if (!scope || scope === '*') return true;
  if (documentName === scope) return true;
  return documentName.startsWith(`${scope}/`);
}

/**
 * Add (or replace, by label) a token. Returns the new record INCLUDING the raw
 * `value` — this is the ONLY moment the raw value exists; it is hashed before
 * storage and never recoverable afterward. Idempotent on `label` (rotation
 * shape): an existing label is overwritten with a fresh value.
 *
 * @param {string} dataDir
 * @param {{ label: string, dev?: boolean, scope?: string | null }} opts
 * @returns {{ label: string, value: string, createdAt: number, dev?: boolean, scope?: string }}
 */
export function addToken(dataDir, { label, dev = false, scope }) {
  assertValidLabel(label);
  const handle = db(dataDir);
  const value = generateToken({ dev });
  // Default scope per DDR-053 §3: bind to label. Explicit `scope: '*'` /
  // `scope: null` opts into wildcard (stored as NULL).
  const effectiveScope = scope === undefined ? label : scope;
  const storedScope = effectiveScope && effectiveScope !== '*' ? effectiveScope : null;
  const createdAt = Date.now();

  handle
    .prepare(
      'INSERT OR REPLACE INTO tokens (label, hash, scope, dev, created_at, last_used_at) VALUES (?, ?, ?, ?, ?, NULL)'
    )
    .run(label, hashToken(handle, value), storedScope, dev ? 1 : 0, createdAt);

  return {
    label,
    value,
    createdAt,
    ...(dev ? { dev: true } : {}),
    ...(storedScope ? { scope: storedScope } : {}),
  };
}

/**
 * Rotate the token with the given label — fresh value, preserve label + dev +
 * scope. Returns the new record (with raw value). Throws if the label is absent.
 *
 * Caller (server.mjs) is responsible for kicking active WS sessions for the
 * rotated label (DDR-053 §4).
 *
 * @param {string} dataDir
 * @param {string} label
 */
export function rotateToken(dataDir, label) {
  assertValidLabel(label);
  const handle = db(dataDir);
  const prior = handle.prepare('SELECT * FROM tokens WHERE label = ?').get(label);
  if (!prior) {
    throw new Error(`no token with label "${label}"`);
  }
  return addToken(dataDir, {
    label,
    dev: !!prior.dev,
    scope: prior.scope === null || prior.scope === undefined ? '*' : prior.scope,
  });
}

/**
 * Sanitized listing for the admin UI / API: labels + metadata, never raw
 * values or hashes. `lastUsedAt` is null until recordTokenUse stamps it.
 *
 * @param {string} dataDir
 * @returns {Array<{ label: string, createdAt: number, lastUsedAt: number | null, scope: string, dev?: boolean }>}
 */
export function listTokenLabels(dataDir) {
  return readTokens(dataDir).tokens.map((t) => ({
    label: t.label,
    createdAt: t.createdAt,
    lastUsedAt: t.lastUsedAt,
    scope: t.scope,
    ...(t.dev ? { dev: true } : {}),
  }));
}

/**
 * Update the `last_used_at` field for the matching token. Best-effort — auth
 * must not depend on this.
 *
 * @param {string} dataDir
 * @param {string} label
 */
export function recordTokenUse(dataDir, label) {
  try {
    db(dataDir)
      .prepare('UPDATE tokens SET last_used_at = ? WHERE label = ?')
      .run(Date.now(), label);
  } catch {
    /* best-effort */
  }
}

/**
 * Constant-time verification of an incoming token against the SQLite store plus
 * the optional HUB_SECRET escape hatch. Returns the matched record (with
 * `scope` for downstream matchesScope enforcement) on success, else null.
 *
 * The token is hashed (HMAC-SHA256, per-hub key) and looked up by hash. We then
 * re-confirm with a timing-safe compare so the path doesn't early-exit on a
 * partial hash match. HUB_SECRET is an admin-on-Yjs escape hatch (scope '*').
 *
 * @param {string} dataDir
 * @param {string} candidate
 * @param {string} secret
 * @returns {null | { label: string, createdAt: number, dev?: boolean, scope: string, source: 'file' | 'env' }}
 */
export function verifyToken(dataDir, candidate, secret) {
  if (typeof candidate !== 'string' || candidate.length === 0) return null;
  let handle;
  try {
    handle = db(dataDir);
  } catch {
    handle = null;
  }
  if (handle) {
    const digest = hashToken(handle, candidate);
    const row = handle.prepare('SELECT * FROM tokens WHERE hash = ?').get(digest);
    if (row && constantTimeEqual(Buffer.from(digest, 'utf8'), Buffer.from(row.hash, 'utf8'))) {
      // lastUsedAt is stamped by the caller (server.mjs onAuthenticate) so the
      // contract matches the pre-Task-6 behavior; verifyToken stays read-only.
      return {
        label: row.label,
        createdAt: row.created_at,
        scope: row.scope ?? '*',
        source: 'file',
        ...(row.dev ? { dev: true } : {}),
      };
    }
  }
  if (secret && constantTimeEqual(Buffer.from(candidate, 'utf8'), Buffer.from(secret, 'utf8'))) {
    return { label: 'env-secret', createdAt: 0, scope: '*', source: 'env' };
  }
  return null;
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
