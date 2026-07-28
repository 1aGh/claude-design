// User login + user administration routes — Cloud Phase 2 Task 1 (DDR-192 §3).
//
// Two surfaces, deliberately separated:
//
//   /auth/*            UNAUTHENTICATED (login) or peer-token-authenticated
//                      (logout). This is the HUMAN sign-in path. A successful
//                      login mints a scoped, EXPIRING peer token on the
//                      existing HMAC spine — the thing a person used to copy
//                      out of a terminal by hand and keep forever.
//   /admin/api/users/* ADMIN BEARER only (gated by the caller, before we are
//                      reached). Operator surface: create, disable, delete.
//
// The DDR-053 admin Bearer is NOT a user credential and never becomes one:
// there is no route here that turns a user password into admin access.
//
// Offboarding is the property the phase's exit gate names — "offboarding one
// user touches nobody else's credentials" — so every mutation here revokes by
// `owner` (an exact match in tokens.mjs), never by prefix or label pattern.

import { randomBytes } from 'node:crypto';

import {
  createInvite,
  inviteUrl,
  listInvites,
  peekInvite,
  redeemInvite,
  revokeInvite,
} from './invites.mjs';

import {
  addToken,
  listTokensForOwner,
  removeToken,
  revokeTokensForOwner,
  verifyToken,
} from './tokens.mjs';
import {
  authenticate,
  createUser,
  getUser,
  listUsers,
  removeUser,
  setUserDisabled,
  setUserPassword,
  userCount,
} from './users.mjs';

/** Default peer-token lifetime: 30 days. Override with HUB_USER_TOKEN_TTL_HOURS. */
const DEFAULT_TTL_HOURS = 24 * 30;

export function userTokenTtlMs(env = process.env) {
  const raw = Number(env.HUB_USER_TOKEN_TTL_HOURS);
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_TTL_HOURS * 3600_000;
  // Clamp to a year. An unbounded TTL would quietly recreate the forever-token
  // this whole mechanism exists to retire.
  return Math.min(raw, 24 * 365) * 3600_000;
}

/** `u-<12hex>` — inside tokens.mjs's LABEL_REGEX, and not derived from the
 *  address (an email does not fit the label charset, and encoding one there
 *  would leak the user list to anyone who can read token labels). */
function mintLabel() {
  return `u-${randomBytes(6).toString('hex')}`;
}

/** Bearer value from an Authorization header, or null. */
export function bearerFrom(request) {
  const raw = request?.headers?.authorization;
  if (typeof raw !== 'string') return null;
  const m = raw.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}

/**
 * True when this hub must refuse the permissive dev path (empty token store +
 * no HUB_SECRET ⇒ any token authenticates).
 *
 * That path is a genuine convenience for a scratch hub on a laptop, and a
 * catastrophe the moment a hub has real users: it would let an unauthenticated
 * stranger read and write every document. So the moment ONE user exists — or
 * the operator declares workspace mode — it is off, permanently and without a
 * flag to turn back on.
 */
export function permissiveDevAuthDisabled(dataDir, env = process.env) {
  if (env.HUB_WORKSPACE_MODE === '1') return true;
  return userCount(dataDir) > 0;
}

/**
 * Handle `/auth/*`. Returns true when the request was handled.
 *
 * @param {object} ctx
 * @param {import('node:http').IncomingMessage} ctx.request
 * @param {import('node:http').ServerResponse} ctx.response
 * @param {string} ctx.path            pathname (already sliced of any prefix)
 * @param {string} ctx.method
 * @param {string} ctx.dataDir
 * @param {string} ctx.secret          HUB_SECRET (for verifyToken)
 * @param {(request: any) => boolean} [ctx.checkRateLimit]
 * @param {() => void} ctx.respondRateLimited
 * @param {(status: number, payload: unknown) => void} ctx.respondJson
 * @param {(request: any) => Promise<any>} ctx.readJsonBody
 * @param {(label: string) => number} ctx.kickLabel
 * @param {(event: { type: string, user: string, doc: string }) => void} ctx.pushActivity
 */
export async function handleAuthRoutes(ctx) {
  const { path, method, dataDir, secret, respondJson, readJsonBody } = ctx;

  if (method === 'POST' && path === '/auth/login') {
    // Login is the brute-force surface. Rate-limit BEFORE touching scrypt, so
    // a flood costs the attacker a request and costs us nothing.
    if (ctx.checkRateLimit && !ctx.checkRateLimit(ctx.request)) {
      ctx.respondRateLimited();
      return true;
    }
    let body;
    try {
      body = await readJsonBody(ctx.request);
    } catch (err) {
      respondJson(400, { error: err.message });
      return true;
    }
    const result = authenticate(dataDir, body?.email, body?.password);
    if (!result.ok) {
      // ONE opaque message for every failure mode. The distinction between
      // "no such account", "wrong password" and "disabled" is a user-existence
      // oracle; it stays in the server log, never on the wire.
      console.warn(
        `[hub] login rejected (${result.reason}) for ${String(body?.email ?? '').slice(0, 120)}`
      );
      respondJson(401, { error: 'invalid email or password' });
      return true;
    }

    const user = result.user;
    const expiresAt = Date.now() + userTokenTtlMs();
    const minted = addToken(dataDir, {
      label: mintLabel(),
      scope: user.scope ?? '*',
      owner: user.email,
      expiresAt,
    });
    ctx.pushActivity?.({ type: 'login', user: user.email, doc: minted.label });
    respondJson(200, {
      token: minted.value,
      label: minted.label,
      scope: minted.scope ?? '*',
      expiresAt,
      user: { email: user.email, role: user.role },
    });
    return true;
  }

  if (method === 'POST' && path === '/auth/logout') {
    // Authenticated by the peer token being surrendered — no password, and
    // deliberately no way to log out anyone else.
    const presented = bearerFrom(ctx.request);
    const match = presented ? verifyToken(dataDir, presented, secret) : null;
    if (!match?.owner) {
      respondJson(401, { error: 'not a user session token' });
      return true;
    }
    try {
      removeToken(dataDir, match.label);
    } catch {
      /* already gone — logging out twice is not an error */
    }
    const kicked = ctx.kickLabel?.(match.label) ?? 0;
    ctx.pushActivity?.({ type: 'logout', user: match.owner, doc: match.label });
    respondJson(200, { ok: true, kicked });
    return true;
  }

  if (method === 'GET' && path === '/auth/session') {
    const presented = bearerFrom(ctx.request);
    const match = presented ? verifyToken(dataDir, presented, secret) : null;
    if (!match?.owner) {
      respondJson(401, { error: 'not a user session token' });
      return true;
    }
    const user = getUser(dataDir, match.owner);
    respondJson(200, {
      label: match.label,
      scope: match.scope ?? '*',
      expiresAt: match.expiresAt ?? null,
      user: user ? { email: user.email, role: user.role, disabled: user.disabled } : null,
    });
    return true;
  }

  // ---- Cloud Phase 6 — magic-link invites -------------------------------

  // GET /join/<token> — LOOK, never consume. A crawler, a link preview, or a
  // corporate mail scanner following the link must not be able to burn the
  // invite; that is otherwise a very ordinary way for one to arrive already
  // used. Redemption is the POST below.
  if (method === 'GET' && path.startsWith('/join/')) {
    const value = decodeURIComponent(path.slice('/join/'.length));
    const check = peekInvite(dataDir, value);
    if (!check.ok) {
      respondJson(410, { ok: false, reason: check.reason, error: inviteProblem(check.reason) });
      return true;
    }
    respondJson(200, {
      ok: true,
      // Plain words for the landing page. No token echo — the client already
      // has it, and echoing it puts it somewhere new.
      workspace: ctx.publicUrl ?? null,
      needsEmail: !check.invite.email,
      email: check.invite.email,
      expiresAt: check.invite.expiresAt,
    });
    return true;
  }

  // POST /join — redeem. A POST because a token in a URL the browser then
  // navigates away from lands in Referer headers and in every proxy log on the
  // way.
  if (method === 'POST' && path === '/join') {
    if (ctx.checkRateLimit && !ctx.checkRateLimit(ctx.request)) {
      ctx.respondRateLimited();
      return true;
    }
    let body;
    try {
      body = await readJsonBody(ctx.request);
    } catch (err) {
      respondJson(400, { ok: false, error: err.message });
      return true;
    }
    const result = redeemInvite(dataDir, {
      value: body?.token,
      email: body?.email,
      password: body?.password,
      createAccount: ({ email, password, role }) => createUser(dataDir, { email, password, role }),
    });
    if (!result.ok) {
      respondJson(result.reason === 'account-failed' ? 400 : 410, {
        ok: false,
        reason: result.reason,
        error: result.detail ?? inviteProblem(result.reason),
      });
      return true;
    }

    // Sign them straight in. The entire point is that they clicked a link and
    // are now working — a redeem that ends at a login form has reintroduced
    // the form it was built to remove.
    const expiresAt = Date.now() + userTokenTtlMs();
    const minted = addToken(dataDir, {
      label: mintLabel(),
      scope: '*',
      owner: result.user.email,
      expiresAt,
    });
    ctx.pushActivity?.({ type: 'invite-redeem', user: result.user.email, doc: result.invite.id });
    respondJson(201, {
      ok: true,
      token: minted.value,
      label: minted.label,
      expiresAt,
      user: { email: result.user.email, role: result.user.role },
    });
    return true;
  }

  return false;
}

/** One plain sentence per failure. Never mentions tokens (DDR-193 §5). */
function inviteProblem(reason) {
  switch (reason) {
    case 'expired':
      return 'This invitation has expired. Ask whoever invited you for a new link.';
    case 'already-used':
      return 'This invitation has already been used. Ask for a new link, or sign in if you already have an account.';
    case 'revoked':
      return 'This invitation was cancelled. Ask whoever invited you for a new link.';
    case 'email-required':
      return 'Enter your email address.';
    default:
      return "That invitation link isn't valid. Check you copied all of it.";
  }
}

/**
 * Handle `/users*` under the admin API. The caller has ALREADY verified the
 * admin Bearer — this function must never be reachable without it.
 *
 * Returns true when handled.
 */
export async function handleUserAdminRoutes(ctx) {
  const { path, method, dataDir, respondJson, readJsonBody } = ctx;

  if (method === 'GET' && path === '/users') {
    const users = listUsers(dataDir).map((u) => ({
      ...u,
      // Surface how many live credentials each account holds — the number an
      // operator actually needs when deciding whether an offboard took effect.
      tokenCount: listTokensForOwner(dataDir, u.email).length,
    }));
    respondJson(200, { users });
    return true;
  }

  if (method === 'POST' && path === '/users') {
    let body;
    try {
      body = await readJsonBody(ctx.request);
    } catch (err) {
      respondJson(400, { error: err.message });
      return true;
    }
    try {
      const user = createUser(dataDir, {
        email: body?.email,
        password: body?.password,
        role: body?.role,
        scope: body?.scope,
      });
      ctx.pushActivity?.({ type: 'user-create', user: user.email, doc: user.role });
      respondJson(201, { user });
    } catch (err) {
      respondJson(/already exists/.test(err.message) ? 409 : 400, { error: err.message });
    }
    return true;
  }

  if (method === 'POST' && (path === '/users/disable' || path === '/users/enable')) {
    const disable = path === '/users/disable';
    let body;
    try {
      body = await readJsonBody(ctx.request);
    } catch (err) {
      respondJson(400, { error: err.message });
      return true;
    }
    const user = setUserDisabled(dataDir, body?.email, disable);
    if (!user) {
      respondJson(404, { error: 'no such user' });
      return true;
    }
    // Disabling revokes credentials and kicks live sessions. Flipping a flag
    // while an already-authenticated socket stays open would make "disabled"
    // mean "cannot log in again", which is not what an operator disabling an
    // account at 2am means by it.
    let revoked = [];
    let kicked = 0;
    if (disable) {
      revoked = revokeTokensForOwner(dataDir, user.email);
      for (const label of revoked) kicked += ctx.kickLabel?.(label) ?? 0;
    }
    ctx.pushActivity?.({
      type: disable ? 'user-disable' : 'user-enable',
      user: user.email,
      doc: `revoked ${revoked.length}, kicked ${kicked}`,
    });
    respondJson(200, { user, revoked: revoked.length, kicked });
    return true;
  }

  if (method === 'POST' && path === '/users/password') {
    let body;
    try {
      body = await readJsonBody(ctx.request);
    } catch (err) {
      respondJson(400, { error: err.message });
      return true;
    }
    let changed;
    try {
      changed = setUserPassword(dataDir, body?.email, body?.password);
    } catch (err) {
      respondJson(400, { error: err.message });
      return true;
    }
    if (!changed) {
      respondJson(404, { error: 'no such user' });
      return true;
    }
    // A password change invalidates existing sessions — the common reason to
    // change one is that the old credential may be compromised.
    const revoked = revokeTokensForOwner(dataDir, String(body.email).trim().toLowerCase());
    let kicked = 0;
    for (const label of revoked) kicked += ctx.kickLabel?.(label) ?? 0;
    ctx.pushActivity?.({
      type: 'user-password',
      user: String(body.email),
      doc: `revoked ${revoked.length}`,
    });
    respondJson(200, { ok: true, revoked: revoked.length, kicked });
    return true;
  }

  if (path === '/invites' || path.startsWith('/invites/')) {
    if (method === 'GET' && path === '/invites') {
      respondJson(200, { invites: listInvites(dataDir) });
      return true;
    }
    if (method === 'POST' && path === '/invites') {
      let body;
      try {
        body = await readJsonBody(ctx.request);
      } catch (err) {
        respondJson(400, { error: err.message });
        return true;
      }
      const invite = createInvite(dataDir, {
        email: body?.email,
        role: body?.role,
        ttlHours: body?.ttlHours,
        createdBy: body?.createdBy,
      });
      ctx.pushActivity?.({ type: 'invite-create', user: invite.email ?? '(open)', doc: invite.id });
      // The raw value exists ONLY in this response. It is never stored, never
      // logged, and never listed again.
      respondJson(201, {
        invite: {
          id: invite.id,
          email: invite.email,
          role: invite.role,
          expiresAt: invite.expiresAt,
        },
        url: ctx.publicUrl ? inviteUrl(ctx.publicUrl, invite.value) : null,
        value: invite.value,
      });
      return true;
    }
    if (method === 'POST' && path === '/invites/revoke') {
      let body;
      try {
        body = await readJsonBody(ctx.request);
      } catch (err) {
        respondJson(400, { error: err.message });
        return true;
      }
      const revoked = revokeInvite(dataDir, body?.id);
      if (!revoked) {
        respondJson(404, { error: 'no such open invitation' });
        return true;
      }
      ctx.pushActivity?.({ type: 'invite-revoke', user: '(admin)', doc: String(body?.id) });
      respondJson(200, { ok: true });
      return true;
    }
    respondJson(404, { error: 'not found' });
    return true;
  }

  if (method === 'POST' && path === '/users/delete') {
    let body;
    try {
      body = await readJsonBody(ctx.request);
    } catch (err) {
      respondJson(400, { error: err.message });
      return true;
    }
    const email = String(body?.email ?? '')
      .trim()
      .toLowerCase();
    const revoked = revokeTokensForOwner(dataDir, email);
    let kicked = 0;
    for (const label of revoked) kicked += ctx.kickLabel?.(label) ?? 0;
    const removed = removeUser(dataDir, email);
    if (!removed && revoked.length === 0) {
      respondJson(404, { error: 'no such user' });
      return true;
    }
    ctx.pushActivity?.({
      type: 'user-delete',
      user: email,
      doc: `revoked ${revoked.length}, kicked ${kicked}`,
    });
    respondJson(200, { ok: true, revoked: revoked.length, kicked });
    return true;
  }

  return false;
}
