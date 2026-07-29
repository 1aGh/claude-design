// Project access grants — Cloud Phase 13 (the peer-token mint, DDR-192 §3).
//
// A signed-in account MINTS a short-lived, project-scoped grant; the project's
// cell verifies it and mints its own peer session. The control plane never
// stores the grant and the cell never sees the account's session cookie —
// each side holds only what it needs to refuse.
//
// Format: `mcg_<payloadB64url>.<hmacB64url>` over `GRANT_SIGNING_SECRET`
// (shared with cells at provision time, per-deployment). HMAC because a grant
// is a high-entropy artifact we mint and verify ourselves — the scrypt-vs-HMAC
// reasoning from the hub's token store applies unchanged.

const GRANT_TTL_MS = 10 * 60_000; // one attach, not a standing credential

const encoder = new TextEncoder();

function b64url(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(str) {
  const b = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
}

async function hmac(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(message)));
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function mintGrant(
  { projectId, accountId, email },
  secret,
  { now = Date.now(), ttlMs = GRANT_TTL_MS } = {}
) {
  if (!secret) throw new Error('grant signing secret is not configured');
  if (!projectId || !accountId) throw new Error('a grant names a project and an account');
  const payload = b64url(
    encoder.encode(JSON.stringify({ p: projectId, a: accountId, e: email ?? null, x: now + ttlMs }))
  );
  const sig = b64url(await hmac(secret, payload));
  return `mcg_${payload}.${sig}`;
}

/** `{ ok, grant? , reason? }` — expiry is part of validity, not advice. */
export async function verifyGrant(token, secret, { now = Date.now() } = {}) {
  if (!secret) return { ok: false, reason: 'not-configured' };
  const m = /^mcg_([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.exec(String(token ?? ''));
  if (!m) return { ok: false, reason: 'malformed' };
  const expected = await hmac(secret, m[1]);
  if (!timingSafeEqual(fromB64url(m[2]), expected)) return { ok: false, reason: 'bad-signature' };
  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(fromB64url(m[1])));
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  if (typeof payload.x !== 'number' || payload.x <= now) return { ok: false, reason: 'expired' };
  return {
    ok: true,
    grant: { projectId: payload.p, accountId: payload.a, email: payload.e, expiresAt: payload.x },
  };
}
