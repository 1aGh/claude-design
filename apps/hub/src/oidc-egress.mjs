// The JWKS fetch, and why it is ours — Track C C2.
//
// `jose` verifies signatures. It does NOT decide what to connect to:
// `createRemoteJWKSet(url)` fetches whatever URL you hand it. The network half
// of this track is ours either way, and it is the half with the sharp edge.
//
// THE ATTACK. `HUB_OIDC_ISSUER` is operator-supplied, discovery yields
// `jwks_uri` from that issuer's document, and an unknown `kid` triggers a
// refetch. On the AWS EC2 deployment our own runbook recommends, an unpinned
// fetch from inside the VPC reaches the instance metadata service at
// 169.254.169.254 — i.e. the S3 credentials `_credentials.md` calls the ones
// with real blast radius. A misconfigured or hostile issuer document is enough.
//
// FOUR GUARDS, and the last one is the one that gets skipped:
//
//   1. `jwks_uri` must share the issuer's ORIGIN. Discovery is not a redirect
//      to anywhere.
//   2. https only.
//   3. Redirects are re-checked, never followed blind.
//   4. RESOLVE, CHECK THE RESOLVED ADDRESS, CONNECT TO THAT ADDRESS. A
//      hostname allowlist does not stop DNS rebinding: the name passes, then
//      resolves to 169.254.169.254 on the connection the check did not cover.
//      Node's `fetch` cannot express this, so this module uses `https.request`
//      with a custom `lookup` — that hook is what makes the check and the
//      connection the same event.
//
// Same shape as `curl-local.sh` (DDR-185) inverted: that one refuses anything
// NOT loopback, this one refuses anything that IS private.

import { lookup as dnsLookup } from 'node:dns';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';

/** Refetch budget for unknown `kid` — an attacker must not drive egress. */
const REFETCH_WINDOW_MS = 60_000;
const REFETCH_MAX = 5;

/**
 * Is this address one a server must never be talked into reaching?
 *
 * Loopback, link-local (AWS/GCP/Azure metadata all live at 169.254.169.254),
 * RFC1918, CGNAT, unique-local and IPv4-mapped IPv6 forms of all of those.
 */
export function isForbiddenAddress(addr) {
  const ip = String(addr ?? '').trim();
  if (!ip) return true;
  const v = isIP(ip);
  if (v === 4) return forbiddenV4(ip);
  if (v === 6) {
    const lower = ip.toLowerCase();
    if (lower === '::1' || lower === '::') return true;
    if (lower.startsWith('fe80')) return true; // link-local
    if (/^f[cd]/.test(lower)) return true; // unique-local
    // ::ffff:169.254.169.254 and friends — the mapped form must not be a bypass.
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return forbiddenV4(mapped[1]);
    return false;
  }
  return true; // not an IP at all → refuse rather than guess
}

function forbiddenV4(ip) {
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = p;
  if (a === 0 || a === 127) return true; // this-host, loopback
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true; // link-local — the metadata service
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224) return true; // multicast + reserved
  return false;
}

/**
 * The JWKS URI must be https and share the issuer's origin.
 *
 * Discovery is a document the issuer serves about itself, not a licence to
 * name a different host.
 */
export function assertSameOrigin(issuer, jwksUri) {
  let iss;
  let jwks;
  try {
    iss = new URL(issuer);
    jwks = new URL(jwksUri);
  } catch {
    throw new Error(`oidc: jwks_uri "${jwksUri}" is not a URL`);
  }
  if (jwks.protocol !== 'https:') {
    throw new Error(`oidc: jwks_uri must be https (got ${jwks.protocol.replace(':', '')})`);
  }
  if (jwks.origin !== iss.origin) {
    throw new Error(
      `oidc: jwks_uri origin ${jwks.origin} does not match the issuer origin ${iss.origin}`
    );
  }
  return jwks;
}

/** A DNS lookup that refuses to hand back an address we must not reach. */
function guardedLookup(hostname, options, callback) {
  dnsLookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err);
    const list = Array.isArray(addresses) ? addresses : [addresses];
    // EVERY resolved address must be acceptable. Checking only the one we
    // happen to use would leave a round-robin record half-open.
    for (const a of list) {
      if (isForbiddenAddress(a.address)) {
        return callback(
          new Error(`oidc: ${hostname} resolves to ${a.address}, which this hub refuses to reach`)
        );
      }
    }
    const first = list[0];
    // Hand back the ADDRESS we validated, so the socket connects to the thing
    // that was checked rather than re-resolving the name.
    if (options?.all) return callback(null, list);
    return callback(null, first.address, first.family);
  });
}

/**
 * Fetch a JWKS document with every guard applied.
 *
 * Deliberately not `fetch`: the resolve-check-connect hook does not exist
 * there, and without it guards 1–3 are theatre against rebinding.
 */
export function fetchGuarded(
  url,
  { maxRedirects = 3, timeoutMs = 5000, method = 'GET', body = null, headers = {} } = {}
) {
  return new Promise((resolve, reject) => {
    const target = new URL(String(url));
    if (target.protocol !== 'https:') {
      reject(new Error('oidc: refusing a non-https JWKS fetch'));
      return;
    }
    const req = httpsRequest(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || 443,
        path: `${target.pathname}${target.search}`,
        method,
        lookup: guardedLookup,
        timeout: timeoutMs,
        headers: {
          accept: 'application/json',
          host: target.host,
          ...(body
            ? {
                'content-type': 'application/x-www-form-urlencoded',
                'content-length': Buffer.byteLength(body),
              }
            : {}),
          ...headers,
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          if (maxRedirects <= 0) {
            reject(new Error('oidc: too many redirects fetching the JWKS'));
            return;
          }
          // RE-CHECKED, never followed blind: the redirect target goes through
          // the same origin rule and the same lookup guard.
          let next;
          try {
            next = new URL(res.headers.location, target);
            assertSameOrigin(target.origin, next.href);
          } catch (err) {
            reject(err);
            return;
          }
          fetchGuarded(next, {
            maxRedirects: maxRedirects - 1,
            timeoutMs,
            method,
            body,
            headers,
          }).then(resolve, reject);
          return;
        }
        if (status !== 200) {
          res.resume();
          reject(new Error(`oidc: JWKS fetch returned HTTP ${status}`));
          return;
        }
        const chunks = [];
        let bytes = 0;
        res.on('data', (c) => {
          bytes += c.length;
          // A key set is kilobytes. An unbounded read is an unbounded read.
          if (bytes > 1024 * 512) {
            req.destroy(new Error('oidc: JWKS document is implausibly large'));
            return;
          }
          chunks.push(c);
        });
        res.on('end', () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
          } catch (err) {
            reject(new Error(`oidc: JWKS document is not JSON — ${err.message}`));
          }
        });
      }
    );
    req.on('timeout', () => req.destroy(new Error('oidc: JWKS fetch timed out')));
    req.on('error', reject);
    req.end(body ?? undefined);
  });
}

/**
 * A refetch budget, so an unknown `kid` cannot be used to drive egress.
 *
 * Returns a `spend()` that answers whether another fetch is allowed now.
 */
export function createRefetchBudget({
  windowMs = REFETCH_WINDOW_MS,
  max = REFETCH_MAX,
  now = () => Date.now(),
} = {}) {
  let windowStart = 0;
  let used = 0;
  return {
    spend() {
      const t = now();
      if (t - windowStart > windowMs) {
        windowStart = t;
        used = 0;
      }
      if (used >= max) return false;
      used += 1;
      return true;
    },
  };
}
