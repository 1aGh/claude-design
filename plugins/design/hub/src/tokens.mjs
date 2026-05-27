// Token file format + helpers.
//
// Phase 9 Task 2 storage: plaintext tokens.json next to hub.db, file mode 0600.
// Format:
//   {
//     "tokens": [
//       { "label": "alice", "value": "mau_a3f9...", "createdAt": 1716800000000 }
//     ]
//   }
//
// Task 6 (auth hardening) replaces this with HMAC-SHA256-hashed records in
// SQLite — the file then becomes a one-way export used only by `token rotate`.

import { randomBytes, timingSafeEqual } from 'node:crypto';
import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const TOKEN_PREFIX = 'mau_';
const DEV_PREFIX = 'mau_dev_';

/** Compute the path to tokens.json for a given data directory. */
export function tokensFilePath(dataDir) {
  return join(dataDir, 'tokens.json');
}

/**
 * Read the tokens file. Returns `{ tokens: [] }` when the file does not exist
 * or is malformed (treated as "no tokens configured").
 *
 * @param {string} dataDir
 * @returns {{ tokens: Array<{ label: string, value: string, createdAt: number, dev?: boolean }> }}
 */
export function readTokensFile(dataDir) {
  const path = tokensFilePath(dataDir);
  if (!existsSync(path)) return { tokens: [] };
  try {
    const raw = readFileSync(path, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.tokens)) return { tokens: [] };
    return parsed;
  } catch {
    return { tokens: [] };
  }
}

/**
 * Atomic-ish write with restrictive permissions (0600 — owner read/write only).
 * Best-effort chmod; on Windows fs.chmod is a no-op for permission bits.
 *
 * @param {string} dataDir
 * @param {{ tokens: Array<{ label: string, value: string, createdAt: number, dev?: boolean }> }} data
 */
export function writeTokensFile(dataDir, data) {
  const path = tokensFilePath(dataDir);
  const payload = `${JSON.stringify(data, null, 2)}\n`;
  writeFileSync(path, payload, { encoding: 'utf8', mode: 0o600 });
  try {
    chmodSync(path, 0o600);
  } catch {
    /* Windows / read-only fs — best effort. */
  }
}

/** Generate a fresh `mau_<32hex>` token. Dev tokens use the `mau_dev_` prefix. */
export function generateToken({ dev = false } = {}) {
  const prefix = dev ? DEV_PREFIX : TOKEN_PREFIX;
  return prefix + randomBytes(16).toString('hex');
}

/**
 * Add a token to the file. Returns the new record. Idempotent on `label`:
 * if a token with the same label exists, it is overwritten (rotation shape).
 *
 * @param {string} dataDir
 * @param {{ label: string, dev?: boolean }} opts
 * @returns {{ label: string, value: string, createdAt: number, dev?: boolean }}
 */
export function addToken(dataDir, { label, dev = false }) {
  if (!label || typeof label !== 'string') {
    throw new Error('label must be a non-empty string');
  }
  const existing = readTokensFile(dataDir);
  const value = generateToken({ dev });
  const record = { label, value, createdAt: Date.now(), ...(dev ? { dev: true } : {}) };
  const without = existing.tokens.filter((t) => t.label !== label);
  const next = { tokens: [...without, record] };
  writeTokensFile(dataDir, next);
  return record;
}

/**
 * Constant-time verification of an incoming token against the file plus
 * optional HUB_SECRET escape hatch. Returns the matched record (or a synthetic
 * one for the env-secret path) on success, or `null` otherwise.
 *
 * `secret` is the plain `HUB_SECRET` env value. Empty string disables the
 * env path and the function relies solely on tokens.json — which is the
 * production shape once Task 6 lands.
 *
 * @param {string} dataDir
 * @param {string} candidate
 * @param {string} secret
 * @returns {null | { label: string, value: string, createdAt: number, dev?: boolean, source: 'file' | 'env' }}
 */
export function verifyToken(dataDir, candidate, secret) {
  if (typeof candidate !== 'string' || candidate.length === 0) return null;
  const { tokens } = readTokensFile(dataDir);
  const incoming = Buffer.from(candidate, 'utf8');

  for (const t of tokens) {
    if (constantTimeEqual(incoming, Buffer.from(t.value, 'utf8'))) {
      return { ...t, source: 'file' };
    }
  }
  if (secret && constantTimeEqual(incoming, Buffer.from(secret, 'utf8'))) {
    return { label: 'env-secret', value: secret, createdAt: 0, source: 'env' };
  }
  return null;
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
