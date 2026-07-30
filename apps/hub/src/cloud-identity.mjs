// Cloud identity mode — Cloud Phase 22 Tasks 1–3 (DDR-204).
//
// A cell is a hub, and a hub has always had its own users — because a hub was
// originally something one person self-hosted. Cloud inherited that shape
// without deciding on it, and the result was two password stores for one
// human: a customer with three projects had four accounts.
//
// In CLOUD mode the cell has no users of its own. It accepts a short-lived,
// project-scoped token the control plane mints after checking that this person
// has access to this project. Same ask-don't-hold shape as the mirror
// credential (DDR-201) — the cell verifies, it never stores an identity.
//
// IN SELF-HOSTED MODE NOTHING CHANGES. `users.mjs` is untouched and remains
// the whole product for a self-hoster. One code path with two configurations,
// not two code paths — the moment they fork, the self-hosted one starts
// rotting, because nobody on the cloud side ever runs it.
//
// A CONTROL-PLANE OUTAGE MUST NOT LOCK ANYONE OUT OF THEIR OWN WORK.
// Verification is offline: the token is signed with a key the cell already
// holds, so an already-issued token keeps working while the control plane is
// unreachable. Only obtaining a NEW one needs it. That asymmetry is the whole
// reason the token is signed rather than looked up.

import { createHmac, timingSafeEqual } from 'node:crypto';

/** How long an access token is good for. */
export const ACCESS_TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

/** True when this hub takes its identity from a control plane. */
export function cloudIdentityEnabled(env = process.env) {
  return Boolean(env.MAUDE_CONTROL_PLANE_URL && env.MAUDE_TENANT_ID);
}

function b64url(buf) {
  return Buffer.from(buf).toString('base64url');
}

/**
 * Sign a project access token.
 *
 * Deliberately NOT a JWT. A JWT brings an algorithm field that the verifier is
 * then obliged to distrust (`alg: none` and the RS256→HS256 confusion are both
 * real classes of bug), and we control both ends. One algorithm, no
 * negotiation, nothing to downgrade.
 *
 * The signing key is derived from the same per-cell secret the control plane
 * already derives (DDR-199 §6), so no new secret has to exist or be
 * distributed.
 */
export function signAccessToken(payload, secret) {
  const body = b64url(JSON.stringify(payload));
  const mac = createHmac('sha256', secret).update(body).digest();
  return `${body}.${b64url(mac)}`;
}

/**
 * Verify a project access token, offline.
 *
 * Returns the claims or a REASON — never a bare false. A sign-in that fails
 * with "invalid" and no reason is the failure mode that produces support
 * tickets nobody can answer.
 */
export function verifyAccessToken(token, secret, { now = Date.now(), tenantId } = {}) {
  const parts = String(token ?? '').split('.');
  if (parts.length !== 2) return { ok: false, reason: 'malformed' };
  const [body, sig] = parts;

  const expected = createHmac('sha256', secret).update(body).digest();
  let offered;
  try {
    offered = Buffer.from(sig, 'base64url');
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  // Length-check before timingSafeEqual, which THROWS on a length mismatch —
  // and a thrown comparison is a comparison that did not happen.
  if (offered.length !== expected.length || !timingSafeEqual(offered, expected)) {
    return { ok: false, reason: 'bad-signature' };
  }

  let claims;
  try {
    claims = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return { ok: false, reason: 'malformed' };
  }

  // The audience check. Without it, a token minted for one project is a token
  // for every project that shares the master — which is every project.
  if (tenantId && claims.project !== tenantId) return { ok: false, reason: 'wrong-project' };
  if (!claims.email) return { ok: false, reason: 'malformed' };
  if (typeof claims.exp !== 'number' || claims.exp <= now) return { ok: false, reason: 'expired' };

  return { ok: true, user: { email: claims.email, role: claims.role ?? 'member' } };
}

/**
 * Mint the claims for one person's access to one project.
 *
 * Exported so the control plane and the cell agree on the shape by sharing it
 * rather than by both being careful.
 */
export function accessClaims({ email, project, role = 'member' }, { now = Date.now(), ttlMs = ACCESS_TOKEN_TTL_MS } = {}) {
  return { email, project, role, iat: now, exp: now + ttlMs };
}

/**
 * What a cloud-mode cell says when someone tries a local password.
 *
 * It must not read as "wrong password" — the password is not wrong, it is not
 * a thing that exists here — and it must say where to go instead.
 */
export const LOCAL_PASSWORD_REFUSED = {
  ok: false,
  reason: 'cloud-identity',
  message:
    'This project uses your Maude account. Sign in at the Maude dashboard and open the project from there.',
};

/**
 * Authenticate in whichever mode this hub is running.
 *
 * ONE function with two configurations. A separate cloud path would leave the
 * self-hosted one to rot, because nobody on the cloud side would ever run it.
 *
 * @param {object} deps
 * @param {(email: string, password: string) => object} deps.local  users.mjs authenticate, bound to its dataDir
 */
export function authenticateForMode({ email, password, token }, { local, env = process.env, secret, now = Date.now() }) {
  if (!cloudIdentityEnabled(env)) {
    return local(email, password);
  }
  // Cloud mode: a local password is not merely wrong, it is not a thing here.
  if (!token) return LOCAL_PASSWORD_REFUSED;
  const verdict = verifyAccessToken(token, secret, { now, tenantId: env.MAUDE_TENANT_ID });
  if (!verdict.ok) return { ok: false, reason: verdict.reason };
  return { ok: true, user: verdict.user };
}
