// Hub user model — Cloud Phase 2 Task 1, implementing DDR-192 §3.
//
// The point of this file (and why it is in the SELF-HOST hub, not in a cloud
// package): the future cloud login is the same code a self-hoster gets. A user
// signing in mints a scoped, EXPIRING peer token on the existing HMAC spine
// (tokens.mjs) instead of a human copying a forever-secret out of a terminal.
// The DDR-053 admin Bearer is untouched and is still the operator credential —
// it is not a user credential and must never become one.
//
// Zero new dependencies, per the phase's constraint: passwords use node's own
// `crypto.scryptSync`, the store is the same `better-sqlite3` already carrying
// tokens.db.
//
// SQLite layout (<dataDir>/users.db, file mode 0600):
//   users(
//     email      TEXT PRIMARY KEY,   -- normalized: trimmed + lowercased
//     hash       TEXT NOT NULL,      -- scrypt$N$r$p$saltHex$hashHex
//     role       TEXT NOT NULL,      -- 'admin' | 'member'
//     scope      TEXT,               -- NULL = wildcard; else a documentName prefix
//     created_at INTEGER NOT NULL,
//     disabled   INTEGER NOT NULL DEFAULT 0
//   )
//
// Password hashes are scrypt, NOT HMAC. tokens.mjs can use HMAC because a token
// is 128 bits of CSPRNG output — brute force is not the threat there. A human's
// password is low-entropy, so it needs a *deliberately slow* KDF; using the
// token spine's HMAC for passwords would be the classic mistake.

import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { chmodSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

// OWASP-aligned scrypt parameters (N=2^15, r=8, p=1 ≈ 32 MB, ~100 ms).
const SCRYPT_N = 32768;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 32;
// scryptSync enforces a memory ceiling of 32 MB by default; N=2^15 needs
// ~128*N*r = 32 MB exactly, so the limit has to be raised or it throws.
const SCRYPT_MAXMEM = 64 * 1024 * 1024;

const ROLES = new Set(['admin', 'member']);
const MIN_PASSWORD_LENGTH = 12;

/** One open Database handle per dataDir (native init is expensive). */
const dbCache = new Map();

export function usersDbPath(dataDir) {
  return join(dataDir, 'users.db');
}

function db(dataDir) {
  const cached = dbCache.get(dataDir);
  if (cached?.open) return cached;
  const path = usersDbPath(dataDir);
  const handle = new Database(path);
  handle.exec(
    `CREATE TABLE IF NOT EXISTS users (
       email      TEXT PRIMARY KEY,
       hash       TEXT NOT NULL,
       role       TEXT NOT NULL DEFAULT 'member',
       scope      TEXT,
       created_at INTEGER NOT NULL,
       disabled   INTEGER NOT NULL DEFAULT 0
     )`
  );
  try {
    chmodSync(path, 0o600);
  } catch {
    /* Windows / read-only fs — best effort. */
  }
  dbCache.set(dataDir, handle);
  return handle;
}

/** Close + forget cached handles. Tests use this between temp dirs. */
export function closeUsers(dataDir) {
  const handle = dbCache.get(dataDir);
  if (handle?.open) {
    try {
      handle.close();
    } catch {
      /* ignore */
    }
  }
  dbCache.delete(dataDir);
}

// ---------------------------------------------------------------- validation

/**
 * Normalize an address for storage + lookup: trim, lowercase.
 *
 * Case folding is what makes `Alice@Example.com` and `alice@example.com` the
 * same account. Without it, disabling one leaves the other live — an
 * offboarding hole, not a cosmetic issue.
 */
export function normalizeEmail(raw) {
  return typeof raw === 'string' ? raw.trim().toLowerCase() : '';
}

/**
 * Deliberately permissive: one `@`, non-empty both sides, no whitespace or
 * control characters, bounded length. This is an identifier check, not an
 * attempt to validate deliverability — RFC-perfect email regexes are famously
 * wrong in both directions, and the address is never rendered unescaped.
 */
export function assertValidEmail(raw) {
  const email = normalizeEmail(raw);
  if (!email) throw new Error('email must be a non-empty string');
  if (email.length > 254) throw new Error('email must be at most 254 characters');
  // Whitespace + C0/C1 control characters, written as explicit \u escapes: a
  // literal control char in the source is invisible in review, and a range
  // typo here silently rejects valid addresses like `alice+tag@example.com`.
  // biome-ignore lint/suspicious/noControlCharactersInRegex: rejecting control chars is the point.
  if (/[\s\u0000-\u001f\u007f-\u009f]/.test(email)) {
    throw new Error('email must not contain whitespace or control characters');
  }
  const at = email.indexOf('@');
  if (at <= 0 || at !== email.lastIndexOf('@') || at === email.length - 1) {
    throw new Error('email must contain exactly one "@" with text on both sides');
  }
  return email;
}

export function assertValidPassword(password) {
  if (typeof password !== 'string') throw new Error('password must be a string');
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  if (password.length > 1024) throw new Error('password must be at most 1024 characters');
  return password;
}

export function assertValidRole(role) {
  if (role === undefined || role === null) return 'member';
  if (typeof role !== 'string' || !ROLES.has(role)) {
    throw new Error(`role must be one of: ${[...ROLES].join(', ')}`);
  }
  return role;
}

// ------------------------------------------------------------------- hashing

/** `scrypt$N$r$p$saltHex$hashHex` — self-describing so parameters can change. */
export function hashPassword(password) {
  assertValidPassword(password);
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: SCRYPT_MAXMEM,
  });
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString('hex')}$${derived.toString('hex')}`;
}

/** Constant-time verify against a stored `scrypt$...` string. */
export function verifyPassword(password, stored) {
  if (typeof password !== 'string' || typeof stored !== 'string') return false;
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, nRaw, rRaw, pRaw, saltHex, hashHex] = parts;
  const N = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return false;
  // A stored record could name parameters larger than this process is willing
  // to spend memory on. Refuse rather than let a crafted row become a DoS.
  if (N > SCRYPT_N || r > SCRYPT_R * 4 || p > SCRYPT_P * 4) return false;
  let salt;
  let expected;
  try {
    salt = Buffer.from(saltHex, 'hex');
    expected = Buffer.from(hashHex, 'hex');
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length === 0) return false;
  let derived;
  try {
    derived = scryptSync(password, salt, expected.length, {
      N,
      r,
      p,
      maxmem: SCRYPT_MAXMEM,
    });
  } catch {
    return false;
  }
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

// ---------------------------------------------------------------------- CRUD

function rowToRecord(row) {
  return {
    email: row.email,
    role: row.role,
    scope: row.scope ?? '*',
    createdAt: row.created_at,
    disabled: !!row.disabled,
  };
}

/**
 * Create a user. Throws on a duplicate address (callers map that to 409) so a
 * signup can never silently overwrite an existing account's password.
 */
export function createUser(dataDir, { email, password, role, scope } = {}) {
  const normalized = assertValidEmail(email);
  assertValidPassword(password);
  const effectiveRole = assertValidRole(role);
  const storedScope = scope && scope !== '*' ? String(scope) : null;
  const handle = db(dataDir);
  if (handle.prepare('SELECT 1 FROM users WHERE email = ?').get(normalized)) {
    throw new Error(`user "${normalized}" already exists`);
  }
  const createdAt = Date.now();
  handle
    .prepare(
      'INSERT INTO users (email, hash, role, scope, created_at, disabled) VALUES (?, ?, ?, ?, ?, 0)'
    )
    .run(normalized, hashPassword(password), effectiveRole, storedScope, createdAt);
  return { email: normalized, role: effectiveRole, scope: storedScope ?? '*', createdAt, disabled: false };
}

export function getUser(dataDir, email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  try {
    const row = db(dataDir).prepare('SELECT * FROM users WHERE email = ?').get(normalized);
    return row ? rowToRecord(row) : null;
  } catch {
    return null;
  }
}

export function listUsers(dataDir) {
  try {
    return db(dataDir)
      .prepare('SELECT * FROM users ORDER BY created_at ASC')
      .all()
      .map(rowToRecord);
  } catch {
    return [];
  }
}

export function userCount(dataDir) {
  try {
    return db(dataDir).prepare('SELECT COUNT(*) AS n FROM users').get().n;
  } catch {
    return 0;
  }
}

/**
 * Authenticate a password.
 *
 * Returns `{ ok: false, reason }` rather than a bare boolean so the caller can
 * log the distinction while still returning ONE opaque message to the client.
 * `reason` values: 'unknown-user' | 'bad-password' | 'disabled'.
 *
 * An unknown address still pays the scrypt cost (against a throwaway hash), so
 * response timing does not disclose whether an account exists.
 */
export function authenticate(dataDir, email, password) {
  const normalized = normalizeEmail(email);
  let row = null;
  try {
    row = normalized
      ? db(dataDir).prepare('SELECT * FROM users WHERE email = ?').get(normalized)
      : null;
  } catch {
    row = null;
  }
  if (!row) {
    verifyPassword(typeof password === 'string' ? password : '', DUMMY_HASH);
    return { ok: false, reason: 'unknown-user' };
  }
  if (!verifyPassword(password, row.hash)) return { ok: false, reason: 'bad-password' };
  // Checked AFTER the password so a disabled account can't be probed for
  // existence with an arbitrary password.
  if (row.disabled) return { ok: false, reason: 'disabled' };
  return { ok: true, user: rowToRecord(row) };
}

/** Set/clear the disabled flag. Returns the updated record, or null if absent. */
export function setUserDisabled(dataDir, email, disabled) {
  const normalized = normalizeEmail(email);
  const handle = db(dataDir);
  const info = handle
    .prepare('UPDATE users SET disabled = ? WHERE email = ?')
    .run(disabled ? 1 : 0, normalized);
  if (info.changes === 0) return null;
  return getUser(dataDir, normalized);
}

export function setUserPassword(dataDir, email, password) {
  const normalized = normalizeEmail(email);
  assertValidPassword(password);
  const info = db(dataDir)
    .prepare('UPDATE users SET hash = ? WHERE email = ?')
    .run(hashPassword(password), normalized);
  return info.changes > 0;
}

/** Permanently remove a user. Token revocation is the CALLER's job (server.mjs
 *  pairs this with revokeTokensForOwner + a session kick). */
export function removeUser(dataDir, email) {
  const normalized = normalizeEmail(email);
  const info = db(dataDir).prepare('DELETE FROM users WHERE email = ?').run(normalized);
  return info.changes > 0;
}

// A fixed, valid scrypt record used only to burn equivalent CPU on an unknown
// address. Its plaintext is irrelevant — nothing ever authenticates against it.
const DUMMY_HASH = hashPassword('maude-dummy-password-not-a-secret');
