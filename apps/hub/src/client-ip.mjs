// Trusted-proxy client-IP resolution — Cloud Phase 2 Task 2.
//
// Until now the hub deliberately ignored `X-Forwarded-For` (DDR-053 §6: "not
// trusted in v1.1"). That was the safe default while there was no way to know
// which upstream to believe — an attacker can put anything in that header, so
// honouring it blindly turns every per-IP rate limit into "send a random XFF
// per request and never be limited."
//
// But behind Caddy / Fly / a Cloudflare Worker, EVERY request arrives from the
// proxy's address, so ignoring it collapses all clients into one bucket: one
// noisy tenant rate-limits everybody, and login brute-force is unbounded per
// attacker. Both failure modes are real; the fix is to make trust explicit.
//
// HUB_TRUSTED_PROXIES is a comma-separated list of CIDRs (or bare addresses).
// The rule: only when the peer address is itself trusted do we read XFF, and
// then we take the RIGHTMOST hop that is not trusted. Rightmost — not leftmost
// — because the header is appended to left-to-right, so everything to the left
// of our own trusted chain is attacker-supplied and unverifiable.

import { isIP } from 'node:net';

/** Strip an IPv4-mapped IPv6 prefix and any zone id / brackets. */
export function normalizeAddress(raw) {
  if (typeof raw !== 'string') return '';
  let addr = raw.trim();
  if (addr.startsWith('[')) {
    const end = addr.indexOf(']');
    if (end > 0) addr = addr.slice(1, end);
  }
  const zone = addr.indexOf('%');
  if (zone > 0) addr = addr.slice(0, zone);
  const mapped = addr.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mapped?.[1]) return mapped[1];
  return addr;
}

/** IPv4 dotted-quad → 32-bit integer, or null. */
function v4ToInt(addr) {
  const parts = addr.split('.');
  if (parts.length !== 4) return null;
  let out = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const n = Number(p);
    if (n > 255) return null;
    out = out * 256 + n;
  }
  return out;
}

/** IPv6 → 16-byte Buffer, or null. Handles `::` compression. */
function v6ToBytes(addr) {
  if (isIP(addr) !== 6) return null;
  const [headRaw, tailRaw] = addr.split('::');
  const head = headRaw ? headRaw.split(':').filter(Boolean) : [];
  const tail = tailRaw !== undefined ? (tailRaw ? tailRaw.split(':').filter(Boolean) : []) : null;
  let groups;
  if (tail === null) {
    groups = head;
  } else {
    const fill = 8 - head.length - tail.length;
    if (fill < 0) return null;
    groups = [...head, ...Array(fill).fill('0'), ...tail];
  }
  if (groups.length !== 8) return null;
  const bytes = Buffer.alloc(16);
  for (let i = 0; i < 8; i++) {
    const g = groups[i];
    if (!/^[0-9a-f]{1,4}$/i.test(g)) return null;
    const n = Number.parseInt(g, 16);
    bytes[i * 2] = (n >> 8) & 0xff;
    bytes[i * 2 + 1] = n & 0xff;
  }
  return bytes;
}

/**
 * Parse `HUB_TRUSTED_PROXIES` into matchers. Invalid entries are DROPPED with a
 * warning rather than silently widening trust — a typo'd CIDR must never
 * become "trust everything".
 *
 * @param {string|undefined} raw
 * @param {(msg: string) => void} [warn]
 */
export function parseTrustedProxies(raw, warn = (m) => console.warn(m)) {
  if (typeof raw !== 'string' || raw.trim() === '') return [];
  const out = [];
  for (const entry of raw.split(',')) {
    const token = entry.trim();
    if (!token) continue;
    const [addrRaw, bitsRaw] = token.split('/');
    const addr = normalizeAddress(addrRaw);
    const family = isIP(addr);
    if (family === 0) {
      warn(`[hub] HUB_TRUSTED_PROXIES: ignoring unparseable entry "${token}"`);
      continue;
    }
    const maxBits = family === 4 ? 32 : 128;
    let bits = maxBits;
    if (bitsRaw !== undefined) {
      bits = Number(bitsRaw);
      if (!Number.isInteger(bits) || bits < 0 || bits > maxBits) {
        warn(`[hub] HUB_TRUSTED_PROXIES: ignoring entry with bad prefix length "${token}"`);
        continue;
      }
    }
    out.push({ family, addr, bits });
  }
  return out;
}

/** True when `candidate` falls inside any parsed CIDR. */
export function isTrustedProxy(candidate, cidrs) {
  if (!Array.isArray(cidrs) || cidrs.length === 0) return false;
  const addr = normalizeAddress(candidate);
  const family = isIP(addr);
  if (family === 0) return false;

  for (const cidr of cidrs) {
    if (cidr.family !== family) continue;
    if (family === 4) {
      const a = v4ToInt(addr);
      const b = v4ToInt(cidr.addr);
      if (a === null || b === null) continue;
      if (cidr.bits === 0) return true;
      const mask = cidr.bits === 32 ? -1 : ~((1 << (32 - cidr.bits)) - 1);
      if ((a & mask) >>> 0 === (b & mask) >>> 0) return true;
    } else {
      const a = v6ToBytes(addr);
      const b = v6ToBytes(cidr.addr);
      if (!a || !b) continue;
      const fullBytes = cidr.bits >> 3;
      const restBits = cidr.bits & 7;
      if (fullBytes > 0 && !a.subarray(0, fullBytes).equals(b.subarray(0, fullBytes))) continue;
      if (restBits === 0) return true;
      const mask = 0xff << (8 - restBits) & 0xff;
      if ((a[fullBytes] & mask) === (b[fullBytes] & mask)) return true;
    }
  }
  return false;
}

/**
 * Resolve the address a rate-limit bucket should be keyed by.
 *
 * With no trusted proxies configured this returns the socket address and XFF is
 * ignored entirely — the pre-existing DDR-053 §6 behaviour, unchanged, which is
 * what keeps this safe by default.
 *
 * @param {import('node:http').IncomingMessage} request
 * @param {Array} trustedProxies  output of parseTrustedProxies
 * @returns {string}
 */
export function clientIpFor(request, trustedProxies) {
  const peer = normalizeAddress(request?.socket?.remoteAddress ?? '') || '0.0.0.0';
  if (!trustedProxies || trustedProxies.length === 0) return peer;
  if (!isTrustedProxy(peer, trustedProxies)) {
    // The request did NOT come from a trusted proxy, so its XFF is just a
    // header a stranger typed. Ignore it and bucket by who actually connected.
    return peer;
  }
  const header = request?.headers?.['x-forwarded-for'];
  const raw = Array.isArray(header) ? header.join(',') : header;
  if (typeof raw !== 'string' || raw.trim() === '') return peer;
  const hops = raw
    .split(',')
    .map((h) => normalizeAddress(h))
    .filter((h) => isIP(h) !== 0);
  // Rightmost hop that is not one of our own proxies. Everything further left
  // was appended by something we do not control.
  for (let i = hops.length - 1; i >= 0; i--) {
    if (!isTrustedProxy(hops[i], trustedProxies)) return hops[i];
  }
  // Every hop is a trusted proxy of ours — the peer address is the best answer.
  return peer;
}
