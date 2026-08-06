// Loopback-host set + log-line sanitizer — a leaf shared between `server.mjs`
// and `studio-child.mjs`, which cannot import from each other directly:
// `server.mjs` imports `createStudioChild` FROM `studio-child.mjs`, so the
// reverse import would close a cycle. Depends on nothing, so it belongs where
// nothing has to depend back — the same reasoning as `apps/studio/sync/limits.ts`
// and `apps/studio/sync/loopback.ts`.
//
// NOT shared with the studio's OWN loopback check
// (`apps/studio/sync/cell-pairing.ts`) — that duplication is deliberate: the
// studio refuses a non-loopback URL on the receiving end, this hub refuses to
// EMIT one, and the point of two independent checks is that editing one
// without the other still leaves the other standing.

export const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/** True when `url`'s hostname is loopback. Unparseable → false (fail loud). */
export function isLoopbackUrl(url) {
  try {
    return LOOPBACK_HOSTS.has(new URL(url).hostname.toLowerCase());
  } catch {
    return false;
  }
}

/**
 * Strip control characters and cap length before a value reaches a log line —
 * a log-forging defense (CRLF / ANSI injection via an attacker-influenced
 * string reaching `console.*`).
 */
export function sanitizeForLog(value) {
  let out = '';
  const s = String(value ?? '').slice(0, 256);
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    out += code < 0x20 || code === 0x7f ? '·' : s[i];
  }
  return out;
}
