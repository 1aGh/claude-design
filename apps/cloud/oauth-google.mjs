// Google sign-in (buyer-side door) — Cloud Phase 13.
//
// Authorization-code + PKCE on the Worker. Decision layer: URL construction,
// state/PKCE material, callback validation and the ID-token claim extraction
// are pure and tested; the single fetch (code exchange) takes an injected
// fetch in tests.
//
// UNCONFIGURED IS HONEST: no client id/secret → `googleConfigured()` is false
// and the routes answer "not configured here yet" instead of a broken
// redirect. Same posture as the Stripe webhook's unset signing secret.
//
// The invitee NEVER meets this door (USER-ADVOCATE rule): Google is offered
// only on maude.sh's own signup/login pages.

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

export function googleConfigured(env) {
  return Boolean(env?.GOOGLE_CLIENT_ID && env?.GOOGLE_CLIENT_SECRET);
}

function b64url(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** PKCE verifier + S256 challenge + CSRF state, all random. */
export async function pkcePair() {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return {
    verifier,
    challenge: b64url(new Uint8Array(digest)),
    state: b64url(crypto.getRandomValues(new Uint8Array(16))),
  };
}

export function authorizationUrl({ clientId, redirectUri, challenge, state }) {
  const u = new URL(AUTH_URL);
  u.searchParams.set('client_id', clientId);
  u.searchParams.set('redirect_uri', redirectUri);
  u.searchParams.set('response_type', 'code');
  // Only what sign-in needs. Asking for more here is how a login button grows
  // into a data grab.
  u.searchParams.set('scope', 'openid email profile');
  u.searchParams.set('code_challenge', challenge);
  u.searchParams.set('code_challenge_method', 'S256');
  u.searchParams.set('state', state);
  return u.toString();
}

/**
 * Validate the callback against the state we set. Both legs come from the
 * request; the cookie leg is ours. A mismatch is a refusal, not a retry.
 */
export function validateCallback({ queryState, cookieState, code }) {
  if (!code) return { ok: false, reason: 'no-code' };
  if (!queryState || !cookieState || queryState !== cookieState) {
    return { ok: false, reason: 'state-mismatch' };
  }
  return { ok: true };
}

/**
 * Extract the claims sign-in needs from a Google ID token — WITHOUT verifying
 * its signature, which is safe here for exactly one reason: this token arrives
 * over TLS directly from Google's token endpoint in exchange for our
 * client_secret. It is never accepted from the browser. If that path ever
 * changes, signature verification stops being optional.
 */
export function claimsFromIdToken(idToken) {
  const parts = String(idToken ?? '').split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (!payload.sub) return null;
    return {
      sub: String(payload.sub),
      email: payload.email ?? null,
      emailVerified: payload.email_verified === true,
      name: payload.name ?? null,
    };
  } catch {
    return null;
  }
}

/** The one effect: exchange the code. `fetchImpl` injectable for tests. */
export async function exchangeCode(
  { code, verifier, clientId, clientSecret, redirectUri },
  fetchImpl = fetch
) {
  const res = await fetchImpl(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      code_verifier: verifier,
    }).toString(),
  });
  if (!res.ok) return { ok: false, status: res.status };
  const body = await res.json();
  const claims = claimsFromIdToken(body.id_token);
  if (!claims) return { ok: false, status: 502 };
  return { ok: true, claims };
}
