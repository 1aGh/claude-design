// whats-new-seen.js — pure, browser-safe "what have I already seen?" logic.
//
// No React, no DOM, no node imports — so it's bundled into the client AND
// imported directly by bun:test (test/whats-new.test.ts). Keep it that way.

/** Parse a semver-ish string into a [major, minor, patch] triple, or null. */
export function parseVer(v) {
  if (typeof v !== 'string') return null;
  const m = v.match(/^(\d+)\.(\d+)\.(\d+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/**
 * Is version `a` strictly newer than `b`?
 * - Unparseable `a` (e.g. "dev") → not newer (false).
 * - Unparseable `b` but parseable `a` → newer (true): a real release outranks
 *   a non-version "seen" marker, so the entry surfaces.
 */
export function verGt(a, b) {
  const pa = parseVer(a);
  const pb = parseVer(b);
  if (!pa) return false;
  if (!pb) return true;
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] > pb[i];
  }
  return false;
}

/**
 * Entries the user hasn't seen yet, given the version they last acknowledged.
 * A pending entry (version == null) is always unseen until acknowledged.
 */
export function computeUnseen(entries, seenVersion) {
  if (!Array.isArray(entries)) return [];
  return entries.filter((e) => e && (e.version == null || verGt(e.version, seenVersion)));
}

/**
 * The version to persist as "seen" after the user reads the panel — the highest
 * of the current feed version and every entry's version. Stamping this clears
 * the unseen set (pending entries excepted — they have no version to outrank).
 */
export function bestSeenVersion(entries, currentVersion) {
  let best = currentVersion;
  if (Array.isArray(entries)) {
    for (const e of entries) {
      if (e && e.version && verGt(e.version, best)) best = e.version;
    }
  }
  return best;
}
