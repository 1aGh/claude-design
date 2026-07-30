// Minting a cell-verifiable token — Cloud Phase 22, shared by Phase 20.
//
// Extracted from worker.mjs when the dashboard grew a second caller (the
// export trigger asks the cell on the owner's behalf). One signing path: the
// per-cell derived secret (DDR-199 §6) HMACs a UTF-8-encoded payload, and the
// cell verifies OFFLINE (apps/hub/src/cloud-identity.mjs). The interop test
// pins the two halves byte-for-byte.

/**
 * Derive a cell's own secret. Must match apps/cells/cell-do.mjs exactly — a
 * cell authenticates with the value that file gave it.
 */
export async function deriveCellSecret(master, tenantId, purpose = 'hub-secret') {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(master),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const mac = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`maude-cell:${purpose}:${tenantId}`)
  );
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** base64url over raw bytes. Never over a string — `btoa` throws above U+00FF. */
export function b64urlBytes(bytes) {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Sign a project access token for one person (or the platform acting for
 * them) on one project. Claims shape must match `accessClaims` in
 * apps/hub/src/cloud-identity.mjs.
 */
export async function mintProjectToken(
  { master, project, email, role, ttlMs = 12 * 60 * 60 * 1000 },
  { now = Date.now() } = {}
) {
  // Fail CLOSED on a missing binding (validate 2026-07-30, defender F4). An
  // empty master derives a publicly-computable key, so every token minted
  // under it would be forgeable for any tenant — and the cell, deriving the
  // same empty key, would happily verify the forgery. Refusing to mint turns
  // a silent total-compromise into a loud outage.
  if (typeof master !== 'string' || master.length === 0) {
    throw new Error('CELL_SECRET_MASTER is not configured — refusing to mint a project token');
  }
  // Its OWN signing purpose (Phase 23 B4): the hub-secret is already the
  // admin bearer and a wildcard peer token — one value must not be all three.
  const secret = await deriveCellSecret(master, project, 'project-token');
  const claims = { email, project, role, iat: now, exp: now + ttlMs };
  const payload = b64urlBytes(new TextEncoder().encode(JSON.stringify(claims)));
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return { token: `${payload}.${b64urlBytes(new Uint8Array(mac))}`, claims };
}

/** Constant-time compare — a timing oracle on a per-cell credential still counts. */
export function secretsMatch(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
