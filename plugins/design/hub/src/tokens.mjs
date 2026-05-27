// Token file format + helpers.
//
// Phase 9 Task 2 storage: plaintext tokens.json next to hub.db, file mode 0600.
// Format:
//   {
//     "tokens": [
//       {
//         "label": "alice",
//         "value": "mau_a3f9...",
//         "createdAt": 1716800000000,
//         "scope": "alice",            // optional; missing = wildcard (legacy)
//         "lastUsedAt": 1716810000000  // optional; written by recordTokenUse
//       }
//     ]
//   }
//
// Per DDR-053:
//   - All writes are atomic (writeFileSync to .tmp + renameSync).
//   - addToken / rotateToken enforce label regex /^[A-Za-z0-9 _.\-]{1,64}$/.
//   - Tokens carry an optional `scope`. `onAuthenticate` enforces
//     `matchesScope(scope, documentName)`. Default for new tokens via
//     admin UI = `scope: label`. Pre-DDR tokens with no scope are
//     grandfathered as wildcard.
//
// Task 6 (auth hardening) replaces plaintext storage with HMAC-SHA256 in
// SQLite — the file then becomes a one-way export used only by `token rotate`.
// The public API surface (label, scope, verifyToken result shape) stays.

import { randomBytes, timingSafeEqual } from 'node:crypto';
import {
  chmodSync,
  existsSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

const TOKEN_PREFIX = 'mau_';
const DEV_PREFIX = 'mau_dev_';
const LABEL_REGEX = /^[A-Za-z0-9 _.\-]{1,64}$/;

/** Compute the path to tokens.json for a given data directory. */
export function tokensFilePath(dataDir) {
  return join(dataDir, 'tokens.json');
}

/**
 * Read the tokens file. Returns `{ tokens: [] }` when the file does not exist
 * or is malformed (treated as "no tokens configured").
 *
 * @param {string} dataDir
 * @returns {{ tokens: Array<{ label: string, value: string, createdAt: number, dev?: boolean, scope?: string, lastUsedAt?: number }> }}
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
 * Atomic write with restrictive permissions (0600 — owner read/write only).
 * Uses writeFileSync(tmp) + renameSync so a crash mid-write doesn't leave a
 * truncated file. Best-effort chmod; on Windows fs.chmod is a no-op for
 * permission bits.
 *
 * @param {string} dataDir
 * @param {{ tokens: Array<object> }} data
 */
export function writeTokensFile(dataDir, data) {
  const path = tokensFilePath(dataDir);
  const tmp = `${path}.tmp`;
  const payload = `${JSON.stringify(data, null, 2)}\n`;
  writeFileSync(tmp, payload, { encoding: 'utf8', mode: 0o600 });
  try {
    chmodSync(tmp, 0o600);
  } catch {
    /* Windows / read-only fs — best effort. */
  }
  try {
    renameSync(tmp, path);
  } catch {
    try {
      unlinkSync(path);
    } catch {
      /* ignore */
    }
    renameSync(tmp, path);
  }
}

/** Generate a fresh `mau_<32hex>` token. Dev tokens use the `mau_dev_` prefix. */
export function generateToken({ dev = false } = {}) {
  const prefix = dev ? DEV_PREFIX : TOKEN_PREFIX;
  return prefix + randomBytes(16).toString('hex');
}

/**
 * Validate a token label. Throws with a stable message on failure so callers
 * can pattern-match. Per DDR-053 §5 — mirrors the client `pattern=` attribute
 * (HTML form validation only protected the happy path).
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
 * Test a `documentName` against a token's scope. Returns true when the token
 * is authorized to read/write that Yjs document.
 *
 *   scope = undefined / "*" → wildcard (legacy + admin tokens)
 *   scope = "alice"         → exact match OR prefix "alice/" (so "alice/foo" passes)
 *
 * Per DDR-053 §3 — gates Chain B (token leak → full hub compromise).
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
 * Add a token to the file. Returns the new record. Idempotent on `label`:
 * if a token with the same label exists, it is overwritten (rotation shape).
 *
 * @param {string} dataDir
 * @param {{ label: string, dev?: boolean, scope?: string | null }} opts
 * @returns {{ label: string, value: string, createdAt: number, dev?: boolean, scope?: string }}
 */
export function addToken(dataDir, { label, dev = false, scope }) {
  assertValidLabel(label);
  const existing = readTokensFile(dataDir);
  const value = generateToken({ dev });
  // Default scope per DDR-053 §3: bind to label. Explicit `scope: '*'` or
  // `scope: null` opts into wildcard (admin-on-Yjs / legacy compat).
  const effectiveScope = scope === undefined ? label : scope;
  const record = {
    label,
    value,
    createdAt: Date.now(),
    ...(dev ? { dev: true } : {}),
    ...(effectiveScope && effectiveScope !== '*' ? { scope: effectiveScope } : {}),
  };
  const without = existing.tokens.filter((t) => t.label !== label);
  const next = { tokens: [...without, record] };
  writeTokensFile(dataDir, next);
  return record;
}

/**
 * Rotate the token with the given label — generate a fresh value, preserve
 * label + dev marker + scope, reset createdAt + lastUsedAt. Returns the new
 * record. Throws if the label does not exist.
 *
 * Caller (server.mjs) is responsible for kicking active WS sessions for the
 * rotated label (DDR-053 §4).
 *
 * @param {string} dataDir
 * @param {string} label
 * @returns {{ label: string, value: string, createdAt: number, dev?: boolean, scope?: string }}
 */
export function rotateToken(dataDir, label) {
  assertValidLabel(label);
  const existing = readTokensFile(dataDir);
  const prior = existing.tokens.find((t) => t.label === label);
  if (!prior) {
    throw new Error(`no token with label "${label}"`);
  }
  return addToken(dataDir, {
    label,
    dev: !!prior.dev,
    scope: prior.scope === undefined ? '*' : prior.scope,
  });
}

/**
 * Sanitized listing for the admin UI / API: returns labels + metadata, never
 * raw token values. `lastUsedAt` is `null` until the first verifyToken match
 * touches the file via `recordTokenUse`. `scope` echoes the stored value
 * (or 'wildcard' marker for legacy tokens with no scope).
 *
 * @param {string} dataDir
 * @returns {Array<{ label: string, createdAt: number, lastUsedAt: number | null, scope: string, dev?: boolean }>}
 */
export function listTokenLabels(dataDir) {
  const { tokens } = readTokensFile(dataDir);
  return tokens.map((t) => ({
    label: t.label,
    createdAt: t.createdAt,
    lastUsedAt: typeof t.lastUsedAt === 'number' ? t.lastUsedAt : null,
    scope: t.scope ?? '*',
    ...(t.dev ? { dev: true } : {}),
  }));
}

/**
 * Update the `lastUsedAt` field for the matching token. Best-effort — failures
 * (concurrent write, ENOENT) are swallowed; auth must not depend on this.
 *
 * @param {string} dataDir
 * @param {string} label
 */
export function recordTokenUse(dataDir, label) {
  try {
    const existing = readTokensFile(dataDir);
    const idx = existing.tokens.findIndex((t) => t.label === label);
    if (idx === -1) return;
    existing.tokens[idx] = { ...existing.tokens[idx], lastUsedAt: Date.now() };
    writeTokensFile(dataDir, existing);
  } catch {
    /* best-effort */
  }
}

/**
 * Constant-time verification of an incoming token against the file plus
 * optional HUB_SECRET escape hatch. Returns the matched record (including
 * `scope` for downstream `matchesScope` enforcement) on success, or `null`
 * otherwise.
 *
 * `secret` is the plain `HUB_SECRET` env value. Empty string disables the
 * env path and the function relies solely on tokens.json — which is the
 * production shape once Task 6 lands.
 *
 * The env-secret path returns scope `'*'` (wildcard) — HUB_SECRET is an
 * admin-on-Yjs escape hatch by design.
 *
 * @param {string} dataDir
 * @param {string} candidate
 * @param {string} secret
 * @returns {null | { label: string, value: string, createdAt: number, dev?: boolean, scope: string, source: 'file' | 'env' }}
 */
export function verifyToken(dataDir, candidate, secret) {
  if (typeof candidate !== 'string' || candidate.length === 0) return null;
  const { tokens } = readTokensFile(dataDir);
  const incoming = Buffer.from(candidate, 'utf8');

  for (const t of tokens) {
    if (constantTimeEqual(incoming, Buffer.from(t.value, 'utf8'))) {
      return { ...t, scope: t.scope ?? '*', source: 'file' };
    }
  }
  if (secret && constantTimeEqual(incoming, Buffer.from(secret, 'utf8'))) {
    return { label: 'env-secret', value: secret, createdAt: 0, scope: '*', source: 'env' };
  }
  return null;
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
