// Admin-channel auth: HUB_SECRET env OR a per-hub admin secret persisted to
// admin.json after bootstrap-key consumption.
//
// Yjs WS auth (tokens.json + HUB_SECRET fallback) is unchanged — admin auth
// is a separate concern that lives only on /admin/api/* routes.
//
// Per DDR-053:
// - Bearer header is the ONLY credential channel. `?secret=` query-string is
//   removed (leaks via Referer + browser history + TLS-MITM proxies).
// - admin.json writes are atomic (tmp + rename).
//
// admin.json layout:
//   { "secret": "<64 hex>", "createdAt": 1716800000000 }

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

export function adminSecretFilePath(dataDir) {
  return join(dataDir, 'admin.json');
}

export function readAdminSecret(dataDir) {
  const path = adminSecretFilePath(dataDir);
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'));
    return typeof parsed?.secret === 'string' ? parsed.secret : null;
  } catch {
    return null;
  }
}

export function writeAdminSecret(dataDir, secret) {
  const path = adminSecretFilePath(dataDir);
  const tmp = `${path}.tmp`;
  const payload = `${JSON.stringify({ secret, createdAt: Date.now() }, null, 2)}\n`;
  writeFileSync(tmp, payload, { encoding: 'utf8', mode: 0o600 });
  try {
    chmodSync(tmp, 0o600);
  } catch {
    /* Windows / read-only fs — best effort. */
  }
  // POSIX-atomic. On Windows, rename over existing file requires unlink first.
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

/** Mint a fresh 64-hex admin secret. */
export function generateAdminSecret() {
  return randomBytes(32).toString('hex');
}

/**
 * Danger-zone kill switch: rotate the persisted admin secret. Every device
 * holding the OLD secret in localStorage 401s on its next request and is forced
 * to re-authenticate (re-bootstrap or HUB_SECRET). Returns nothing — the new
 * value is deliberately NOT surfaced to the caller (the operator re-claims via
 * a fresh bootstrap link or the env secret; we never echo a live admin secret
 * back through the API). HUB_SECRET (env) is independent and still works.
 */
export function rotateAdminSecret(dataDir) {
  const next = generateAdminSecret();
  writeAdminSecret(dataDir, next);
}

/**
 * Verify the incoming request against (a) the HUB_SECRET env override and
 * (b) the persisted admin.json secret. Either succeeds.
 *
 * Per DDR-053: Bearer header is the ONLY accepted credential channel.
 * Query-string `?secret=` was removed to close the Referer/log leakage +
 * cross-origin CSRF surfaces it created.
 *
 * @param {{ headers: Record<string, string|string[]|undefined> }} req
 * @param {{ hubSecret?: string, dataDir: string }} ctx
 * @returns {boolean}
 */
export function verifyAdminAuth(req, { hubSecret = '', dataDir }) {
  const candidate = extractBearer(req);
  if (!candidate) return false;

  const accepted = [];
  if (hubSecret) accepted.push(hubSecret);
  const fileSecret = readAdminSecret(dataDir);
  if (fileSecret) accepted.push(fileSecret);
  if (accepted.length === 0) return false;

  for (const acc of accepted) {
    if (constantTimeEqual(candidate, acc)) return true;
  }
  return false;
}

function extractBearer(req) {
  const auth = req.headers?.authorization || req.headers?.Authorization;
  if (typeof auth !== 'string') return null;
  if (!auth.startsWith('Bearer ')) return null;
  const candidate = auth.slice('Bearer '.length).trim();
  return candidate || null;
}

function constantTimeEqual(a, b) {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
