// Bootstrap key — single-use 24h URL fragment that lets the first user open
// /admin without typing HUB_SECRET. After consumption the file is renamed to
// `bootstrap.used.json` (POSIX-atomic) so /admin/api/bootstrap rejects replays
// AND so two concurrent POSTs can't both win the race — the loser's rename
// fails with ENOENT. Per DDR-053.
//
// File layout (live, mode 0600):
//   bootstrap.json
//     {
//       "key":       "<64 hex chars>",
//       "issuedAt":  1716800000000,
//       "expiresAt": 1716886400000
//     }
//
// After consumption: file is renamed to `bootstrap.used.json` with `usedAt`
// added. Subsequent reads see no `bootstrap.json` → no further claims accepted.
//
// Issuance policy (`maybeIssueOnBoot`) per DDR-053:
//   - First-ever boot, hub empty + secret unset → issue.
//   - Existing live unclaimed key → reuse (idempotent reboot).
//   - Consumed (bootstrap.used.json exists) OR expired → REFUSE to reissue.
//     Operator must set HUB_SECRET env to recover.

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

import { readTokensFile } from './tokens.mjs';

const TTL_MS = 24 * 60 * 60 * 1000;

export function bootstrapFilePath(dataDir) {
  return join(dataDir, 'bootstrap.json');
}

export function bootstrapUsedFilePath(dataDir) {
  return join(dataDir, 'bootstrap.used.json');
}

/**
 * @typedef {Object} BootstrapRecord
 * @property {string} key       64 hex chars.
 * @property {number} issuedAt  ms epoch.
 * @property {number} expiresAt ms epoch.
 * @property {number|null} [usedAt]  ms epoch — only set in bootstrap.used.json.
 */

/** Read the LIVE bootstrap file, returning `null` when missing or malformed. */
export function readBootstrap(dataDir) {
  return readBootstrapPath(bootstrapFilePath(dataDir));
}

/** Read the CONSUMED bootstrap marker, if any. */
export function readConsumedBootstrap(dataDir) {
  return readBootstrapPath(bootstrapUsedFilePath(dataDir));
}

function readBootstrapPath(path) {
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'));
    if (typeof parsed?.key !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Atomic write with 0600 permissions. */
function atomicWrite(path, record) {
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(record, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  try {
    chmodSync(tmp, 0o600);
  } catch {
    /* best-effort */
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

/**
 * Generate a fresh bootstrap key. Always overwrites — caller is responsible
 * for deciding whether to issue at all (`maybeIssueOnBoot`).
 *
 * @param {string} dataDir
 * @param {{ now?: number, ttlMs?: number }} [opts]
 * @returns {BootstrapRecord}
 */
export function issueBootstrap(dataDir, { now = Date.now(), ttlMs = TTL_MS } = {}) {
  const record = {
    key: randomBytes(32).toString('hex'),
    issuedAt: now,
    expiresAt: now + ttlMs,
  };
  atomicWrite(bootstrapFilePath(dataDir), record);
  return record;
}

/**
 * Issue a bootstrap key ONLY on a first-ever-boot hub with no prior claim.
 *
 *   tokens.json empty AND HUB_SECRET unset AND no prior consumed marker
 *     → issue (or reuse a live one).
 *   anything else
 *     → return null (hub already claimed OR window closed).
 *
 * Per DDR-053 §2: after consumption or expiry we DO NOT reissue. Operator
 * must set HUB_SECRET env to recover — this stops the "indefinite-window
 * unclaimed hub keeps minting credentials into logs" attacker scenario (F1).
 *
 * @param {string} dataDir
 * @param {{ secret?: string, now?: number, ttlMs?: number }} [opts]
 * @returns {BootstrapRecord | null}
 */
export function maybeIssueOnBoot(dataDir, { secret = '', now = Date.now(), ttlMs = TTL_MS } = {}) {
  const { tokens } = readTokensFile(dataDir);
  if (tokens.length > 0 || secret) return null;

  // Prior consumption marker present → refuse to reissue (DDR-053 §2).
  if (existsSync(bootstrapUsedFilePath(dataDir))) return null;

  const existing = readBootstrap(dataDir);
  if (existing) {
    if (existing.expiresAt > now) return existing;
    // Expired and unclaimed — refuse to reissue. Operator must use HUB_SECRET.
    return null;
  }
  return issueBootstrap(dataDir, { now, ttlMs });
}

/**
 * Verify + atomically consume an incoming bootstrap key.
 *
 * Atomicity per DDR-053 §2: the rename of `bootstrap.json → bootstrap.used.json`
 * is POSIX-atomic. Two concurrent callers both reach the rename; the second
 * fails with ENOENT — exactly one consumption wins. Defeats the TOCTOU race.
 *
 * Returns `true` on success and writes the consumed marker. Returns `false`
 * for: missing file, expired key, mismatched key, already-consumed (rename
 * lost the race).
 *
 * @param {string} dataDir
 * @param {string} candidate
 * @param {{ now?: number }} [opts]
 * @returns {boolean}
 */
export function verifyAndConsume(dataDir, candidate, { now = Date.now() } = {}) {
  if (typeof candidate !== 'string' || candidate.length === 0) return false;
  const record = readBootstrap(dataDir);
  if (!record) return false;
  if (record.expiresAt <= now) return false;

  const a = Buffer.from(candidate, 'utf8');
  const b = Buffer.from(record.key, 'utf8');
  if (a.length !== b.length) return false;
  if (!timingSafeEqual(a, b)) return false;

  // The atomic step: rename live → consumed. Whichever process / concurrent
  // caller arrives second gets ENOENT and returns false. POSIX guarantees
  // exactly-one-winner semantics for rename.
  const livePath = bootstrapFilePath(dataDir);
  const consumedPath = bootstrapUsedFilePath(dataDir);
  const consumedRecord = { ...record, usedAt: now };
  try {
    // Write the consumed marker first (atomic via tmp+rename inside
    // atomicWrite), then unlink the live file. We can't use a single rename
    // here because we want to add `usedAt` — so the two-step is:
    //   1. rename live → consumed.in-progress (atomic, one winner)
    //   2. rewrite consumed.in-progress → consumed.json with usedAt added
    // Step 1 settles the race; step 2 is best-effort metadata.
    renameSync(livePath, `${consumedPath}.claim`);
  } catch {
    return false; // lost the race or live file vanished mid-flight
  }
  try {
    atomicWrite(consumedPath, consumedRecord);
  } catch {
    /* metadata write failed — consumed.claim still exists as the proof */
  }
  try {
    unlinkSync(`${consumedPath}.claim`);
  } catch {
    /* ignore */
  }
  return true;
}
