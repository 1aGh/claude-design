// The OIDC sign-in flow — Track C C3/C5.
//
// The flow is OURS: PKCE, state, nonce, subject→account, the mode switch.
// Only the signature decision is delegated (see oidc.mjs), and only the
// connection is guarded separately (see oidc-egress.mjs).
//
// ── THE RULE THIS FILE EXISTS TO HOLD ──────────────────────────────────────
//
// A verified subject with no linked account gets `pending` and NO SESSION —
// whether or not its email claim matches an existing account. Especially then.
//
// The first draft of this track said: "first successful sign-in for an email
// that already exists LINKS rather than creates". `users.mjs:63` is
// `email TEXT PRIMARY KEY` — email IS the account key — and `createUser`'s own
// docstring reads: "Throws on a duplicate address (callers map that to 409) so
// a signup can never silently overwrite an existing account's password."
//
// So auto-link did not defeat a missing guard. It routed around an existing
// one that has held since it was written, reaching the same outcome by
// ALIASING an identity onto the row rather than rewriting its hash. With the
// domain allowlist optional and no `email_verified` requirement, an attacker
// who can assert `admin@company.com` at a permissive issuer owned the admin
// account in one request, with no admin action anywhere.
//
// It read as plumbing, which is why it survived review — the draft's own
// Gotcha caught the SECOND-order case ("an IdP can reassign an address; sub is
// the stable subject") one line below the first-order one.
//
// Linking is therefore an explicit admin act in the People view
// (`linkOidcSub`), and this module never calls it.

import { createHash, randomBytes } from 'node:crypto';
import { createVerifier, usableEmailClaim } from './oidc.mjs';
import { assertSameOrigin, fetchGuarded } from './oidc-egress.mjs';
import { isRevoked } from './revocations.mjs';
import { getUserByOidcSub, recordPendingOidc } from './users.mjs';

/** The cookie carrying state/PKCE/nonce between /start and /callback. */
export const OIDC_TXN_COOKIE = 'maude_oidc_txn';
/** A sign-in attempt is short-lived by nature. */
export const TXN_TTL_MS = 10 * 60_000;

// ------------------------------------------------------------- mode switch

/**
 * Is OIDC accepted at all? (C5)
 *
 * EXPLICIT, never inferred from the presence of `HUB_OIDC_ISSUER`.
 * `cloud-identity.mjs` documents exactly this bug: keying a behavioural mode on
 * an env var that merely NAMES a dependency silently flipped a live cell into a
 * mode with no working browser sign-in. "An env var that names a dependency
 * must never double as consent to a behavioral mode."
 *
 * 'hybrid' → OIDC in addition to the password store.
 * 'strict' → OIDC only; password sign-in refused.
 */
export function oidcMode(env = process.env) {
  const raw = env.HUB_OIDC_MODE;
  return raw === 'hybrid' || raw === 'strict' ? raw : null;
}
export const oidcEnabled = (env = process.env) => oidcMode(env) !== null;
export const oidcStrict = (env = process.env) => oidcMode(env) === 'strict';

/**
 * Resolve and validate the OIDC configuration, or explain what is missing.
 *
 * The allowlist is REQUIRED whenever a mode is set. It is a filter and never a
 * grant — a permitted domain with no account still lands in pending — but
 * without it every subject at a public issuer can queue itself, and the queue
 * is the surface an operator reads before clicking "link".
 */
export function oidcConfig(env = process.env) {
  const mode = oidcMode(env);
  if (!mode) return { enabled: false, mode: null, errors: [] };
  const errors = [];
  const issuer = String(env.HUB_OIDC_ISSUER ?? '')
    .trim()
    .replace(/\/+$/, '');
  const clientId = String(env.HUB_OIDC_CLIENT_ID ?? '').trim();
  const clientSecret = String(env.HUB_OIDC_CLIENT_SECRET ?? '').trim();
  const domains = String(env.HUB_OIDC_ALLOWED_DOMAINS ?? '')
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);

  if (!issuer) errors.push('HUB_OIDC_ISSUER is required when HUB_OIDC_MODE is set');
  else if (!/^https:\/\//.test(issuer)) errors.push('HUB_OIDC_ISSUER must be https');
  if (!clientId) errors.push('HUB_OIDC_CLIENT_ID is required when HUB_OIDC_MODE is set');
  if (!clientSecret) errors.push('HUB_OIDC_CLIENT_SECRET is required when HUB_OIDC_MODE is set');
  if (domains.length === 0) {
    errors.push('HUB_OIDC_ALLOWED_DOMAINS is required when HUB_OIDC_MODE is set');
  }

  // TWO tri-state identity switches interacting untested is nine combinations
  // nobody has run. Refusing the overlap kills four of them permanently, in
  // one line, at boot rather than at 3am.
  if (env.MAUDE_CLOUD_IDENTITY === '1' || env.MAUDE_CLOUD_IDENTITY === 'strict') {
    errors.push(
      'MAUDE_CLOUD_IDENTITY and HUB_OIDC_MODE cannot both be set — this hub would have two ' +
        'identity authorities and no rule for which wins'
    );
  }

  return {
    enabled: true,
    mode,
    issuer,
    clientId,
    clientSecret,
    allowedDomains: domains,
    label: String(env.HUB_OIDC_LABEL ?? '').trim() || labelFromIssuer(issuer),
    errors,
  };
}

function labelFromIssuer(issuer) {
  try {
    return new URL(issuer).hostname;
  } catch {
    return 'your identity provider';
  }
}

/**
 * Boot check: entering `strict` with nobody able to sign in locks the operator
 * out of their own box, and the only way back is editing env on the host.
 */
export function assertStrictIsSurvivable(cfg, { linkedAccounts }) {
  if (cfg.mode !== 'strict') return;
  if (linkedAccounts > 0) return;
  throw new Error(
    'HUB_OIDC_MODE=strict refuses to start: no account is linked to an OIDC identity yet, so ' +
      'nobody could sign in. Link at least one account in People under hybrid mode first.'
  );
}

// ------------------------------------------------------------------- PKCE

export function createTransaction({ random = randomBytes } = {}) {
  const verifier = random(32).toString('base64url');
  return {
    state: random(16).toString('base64url'),
    nonce: random(16).toString('base64url'),
    codeVerifier: verifier,
    codeChallenge: createHash('sha256').update(verifier).digest('base64url'),
    createdAt: Date.now(),
  };
}

export function authorizeUrl(cfg, txn, redirectUri, authorizationEndpoint) {
  const u = new URL(authorizationEndpoint);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('client_id', cfg.clientId);
  u.searchParams.set('redirect_uri', redirectUri);
  u.searchParams.set('scope', 'openid email profile');
  u.searchParams.set('state', txn.state);
  u.searchParams.set('nonce', txn.nonce);
  u.searchParams.set('code_challenge', txn.codeChallenge);
  u.searchParams.set('code_challenge_method', 'S256');
  return u.toString();
}

// ------------------------------------------------------------- the decision

/**
 * What happens to a VERIFIED subject?
 *
 * Pure, and separated from the HTTP so the rule can be asserted without a
 * server. There are exactly three outcomes and none of them is "link".
 *
 * @returns {{action:'sign-in', user: object} | {action:'pending', reason: string} | {action:'refuse', reason: string}}
 */
export function decideOidcOutcome({ subject, linkedUser, emailAllowed, revoked = false }) {
  if (!subject) return { action: 'refuse', reason: 'the ID token carries no subject' };

  if (linkedUser) {
    if (linkedUser.disabled) {
      return { action: 'refuse', reason: 'this account is disabled' };
    }
    if (revoked) {
      return { action: 'refuse', reason: 'this account’s credentials were revoked' };
    }
    return { action: 'sign-in', user: linkedUser };
  }

  // NO LINK ⇒ PENDING. Note what is deliberately absent: any lookup by email.
  // Matching an IdP-asserted address to an existing account is the takeover.
  if (!emailAllowed) {
    return {
      action: 'pending',
      reason: 'this identity is not from an allowed domain and has no account here',
    };
  }
  return {
    action: 'pending',
    reason: 'this identity has no account here yet — an admin must link or create one',
  };
}

/**
 * Resolve a verified subject against the local store and record the outcome.
 *
 * The only writes it performs are to `oidc_pending`. It never creates a user
 * and never links one.
 */
export function resolveSubject(dataDir, verified, cfg) {
  const linkedUser = getUserByOidcSub(dataDir, verified.sub);
  const email = usableEmailClaim(verified, cfg.allowedDomains ?? []);
  const outcome = decideOidcOutcome({
    subject: verified.sub,
    linkedUser,
    emailAllowed: Boolean(email),
    revoked: linkedUser ? isRevoked(dataDir, linkedUser.email, Date.now()) : false,
  });
  if (outcome.action === 'pending') {
    // Recorded so an operator can SEE who is waiting — the queue is the People
    // view's half of this rule. The claimed address is display data.
    recordPendingOidc(dataDir, { sub: verified.sub, email });
  }
  return outcome;
}

/**
 * Trade the authorization code for tokens.
 *
 * Goes through the SAME guarded transport as the JWKS fetch — the token
 * endpoint comes out of the issuer's discovery document, so it is exactly as
 * operator-influenced and exactly as capable of naming link-local. The client
 * secret travels in the BODY, so it stays out of the issuer's access logs and
 * out of any Referer.
 */
export async function exchangeCode(
  cfg,
  { code, codeVerifier, redirectUri, tokenEndpoint },
  { fetchImpl = fetchGuarded } = {}
) {
  assertSameOrigin(cfg.issuer, tokenEndpoint);
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    code_verifier: codeVerifier,
  }).toString();
  const res = await fetchImpl(tokenEndpoint, { method: 'POST', body });
  const idToken = res?.id_token;
  if (typeof idToken !== 'string' || !idToken) {
    throw new Error('oidc: the token response carried no id_token');
  }
  return idToken;
}

/** Is this sign-in attempt still the one we started? */
export function readTransaction(raw, { now = Date.now() } = {}) {
  if (!raw) return null;
  let txn;
  try {
    txn = JSON.parse(Buffer.from(String(raw), 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!txn?.state || !txn?.codeVerifier) return null;
  if (!txn.createdAt || now - txn.createdAt > TXN_TTL_MS) return null;
  return txn;
}

export const encodeTransaction = (txn) =>
  Buffer.from(JSON.stringify(txn), 'utf8').toString('base64url');

export { createVerifier };
