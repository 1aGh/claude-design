// The cell's revocation registry — Phase 23 B2, hardened after the
// 2026-07-30 validate (attacker A2/A3).
//
// The sweep alone was a SESSION-KILLER, not a door-closer. It deleted a
// removed member's existing hub tokens, but nothing consulted the removal at
// `/auth/login` — so the member re-presented the project token they already
// held (valid for up to 12 h, verified OFFLINE by design) and was handed a
// brand-new session every time the clock killed one. A 10-minute sweep then
// guaranteed access for the whole token lifetime rather than ending it.
//
// This module is the missing half: what the sweep LEARNS, the door READS.
//
// Two properties it must keep:
//   • Offline. A control-plane outage must not lock anyone out (DDR-204), so
//     the registry is the cell's own last-known state, persisted next to the
//     other cell data and re-read on boot. An outage freezes the list; it
//     never empties it.
//   • Monotonic per person. Only the NEWEST revocation instant matters, and a
//     token minted BEFORE it is refused while one minted after (they were
//     re-added, or demoted then restored) is honoured. Comparing against the
//     token's `iat` is what makes re-adding somebody work without a manual
//     reset.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/** email (lower-cased) → ms-epoch of the newest revocation we know about. */
let cache = null;
let cachePath = null;

function fileFor(dataDir) {
  return join(dataDir, 'revocations.json');
}

function load(dataDir) {
  const path = fileFor(dataDir);
  if (cache && cachePath === path) return cache;
  cachePath = path;
  cache = new Map();
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'));
    for (const [email, at] of Object.entries(parsed?.revoked ?? {})) {
      if (typeof at === 'number') cache.set(String(email).toLowerCase(), at);
    }
  } catch {
    /* absent or malformed → an empty registry, which fails OPEN by design:
       a corrupt file must not lock the whole workspace out. The TTL still
       bounds every token, and the next sweep refills the list. */
  }
  return cache;
}

function persist(dataDir) {
  const path = fileFor(dataDir);
  try {
    const dir = dirname(path);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(path, `${JSON.stringify({ revoked: Object.fromEntries(cache) }, null, 2)}\n`);
  } catch (err) {
    // A cell whose disk refuses the write still enforces in memory for this
    // process; the sweep refills after a restart. Loud, not fatal.
    console.error(`[revocation] could not persist the registry: ${err.message}`);
  }
}

/**
 * Record what the sweep learned. Returns how many entries actually moved
 * forward, so the caller can log something true.
 */
export function recordRevocations(dataDir, revocations) {
  const map = load(dataDir);
  let changed = 0;
  for (const r of revocations ?? []) {
    if (typeof r?.email !== 'string' || !r.email) continue;
    const email = r.email.trim().toLowerCase();
    const at = Number(r.at);
    if (!Number.isFinite(at)) continue;
    if (!map.has(email) || map.get(email) < at) {
      map.set(email, at);
      changed += 1;
    }
  }
  if (changed) persist(dataDir);
  return changed;
}

/**
 * Was this person's access withdrawn AFTER the credential was minted?
 *
 * `issuedAt` is the project token's `iat`. A token minted after the newest
 * revocation belongs to a later grant (re-added, or demoted then restored)
 * and is honoured.
 */
export function isRevoked(dataDir, email, issuedAt) {
  if (typeof email !== 'string' || !email) return false;
  const at = load(dataDir).get(email.trim().toLowerCase());
  if (at === undefined) return false;
  if (!Number.isFinite(Number(issuedAt))) return true; // no iat → cannot prove it is newer
  return Number(issuedAt) <= at;
}

/** Test seam — drop the memoized registry. */
export function resetRevocationCache() {
  cache = null;
  cachePath = null;
}
