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

/**
 * True when this hub accepts control-plane project tokens.
 *
 * An EXPLICIT switch, never inferred (Phase 23 B1). The first wiring keyed
 * this on MAUDE_CONTROL_PLANE_URL && MAUDE_TENANT_ID — and adding the URL for
 * the MIRROR clock silently flipped the live cell into a mode with no working
 * browser sign-in. An env var that names a dependency must never double as
 * consent to a behavioral mode.
 *
 * Values: unset/'' → off. '1' → HYBRID: token exchange accepted IN ADDITION
 * to the local user store, so a workspace password keeps working while the
 * dashboard/desktop lanes migrate. 'strict' → tokens only (the DDR-204 end
 * state, once the browser handoff exists).
 */
export function cloudIdentityEnabled(env = process.env) {
  return env.MAUDE_CLOUD_IDENTITY === '1' || env.MAUDE_CLOUD_IDENTITY === 'strict';
}

/** Tokens-only — no local passwords. The end state, opt-in separately. */
export function cloudIdentityStrict(env = process.env) {
  return env.MAUDE_CLOUD_IDENTITY === 'strict';
}

/**
 * The key project tokens are verified against.
 *
 * Its OWN derived key (purpose `project-token`), never HUB_SECRET — HUB_SECRET
 * is already the admin bearer AND a wildcard peer token, and the admin console
 * asks operators to paste it into a browser. One value must not be all three
 * (Phase 23 B4 / the debate's BREAKER finding). Falls back to HUB_SECRET only
 * so pre-B4 tokens keep verifying during the rollout.
 */
export function projectTokenKey(env = process.env) {
  return env.MAUDE_PROJECT_TOKEN_KEY || env.HUB_SECRET || '';
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

  return {
    ok: true,
    user: { email: claims.email, role: claims.role ?? 'member' },
    // Surfaced so the exchanged peer token can be CAPPED to the project
    // token's own lifetime (Phase 23 B2).
    expiresAt: claims.exp,
    // Surfaced so the revocation registry can tell a token minted BEFORE a
    // removal from one minted after it (a re-add must just work).
    issuedAt: claims.iat,
  };
}

/**
 * Mint the claims for one person's access to one project.
 *
 * Exported so the control plane and the cell agree on the shape by sharing it
 * rather than by both being careful.
 */
export function accessClaims(
  { email, project, role = 'member' },
  { now = Date.now(), ttlMs = ACCESS_TOKEN_TTL_MS } = {}
) {
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
export function authenticateForMode(
  { email, password, token },
  { local, revoked, env = process.env, secret, now = Date.now() }
) {
  if (!cloudIdentityEnabled(env)) {
    return local(email, password);
  }

  if (token) {
    const key = secret ?? projectTokenKey(env);
    const verdict = verifyAccessToken(token, key, { now, tenantId: env.MAUDE_TENANT_ID });
    if (!verdict.ok) return { ok: false, reason: verdict.reason };
    // A viewer USED TO BE REFUSED HERE (Phase 23 B2 / the debate's BREAKER
    // finding), because peer tokens were write-capable and letting one in
    // would have been a silent promotion from "can look" to "can change" —
    // the People page's "cannot change anything" promise, quietly broken.
    //
    // Cloud Phase 25 C1 closes that properly instead of refusing: the session
    // this mints carries `readOnly`, Hocuspocus drops the peer's SyncStep2 and
    // Update messages, and every mutating HTTP route refuses. So the viewer
    // gets in and genuinely cannot write, which is what the role always meant
    // and what the invitation email has been promising since Phase 20.
    //
    // The old refusal also pointed at "the shared gallery link" — a surface
    // Phase 25 C4 deletes. It was already sending people nowhere.
    // A token minted BEFORE the person was removed or demoted is spent, even
    // though its signature and expiry are both still good. Offline
    // verification cannot recall a token, so the door has to remember
    // (validate 2026-07-30, attacker A2/A3) — otherwise the revocation sweep
    // ends sessions the holder simply re-opens.
    if (revoked?.(verdict.user.email, verdict.issuedAt)) {
      return {
        ok: false,
        reason: 'access-withdrawn',
        message: 'Your access to this project was removed. Ask whoever runs it to add you again.',
      };
    }
    // The exchanged session must die WITH the project token, not outlive it
    // by 30 days — "removal lands within 12 hours" is a written promise.
    return { ok: true, user: verdict.user, expiresAt: verdict.expiresAt };
  }

  // HYBRID keeps the local user store alive alongside tokens; STRICT is the
  // end state where a password is not a thing here at all.
  if (!cloudIdentityStrict(env)) return local(email, password);
  return LOCAL_PASSWORD_REFUSED;
}
