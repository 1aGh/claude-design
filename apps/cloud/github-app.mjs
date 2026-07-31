// Minting a GitHub installation token — Cloud Phase 19.
//
// WHERE THE PRIVATE KEY LIVES, AND WHY IT IS HERE.
//
// The App's private key can mint a token for EVERY repository the App is
// installed on. Putting it in a cell would mean one compromised tenant's
// container is a credential for every other tenant's GitHub. So it stays in
// the control plane, and a cell that wants to push ASKS — presenting its own
// derived secret, and receiving a token scoped to the one repository that
// tenant has configured.
//
// The blast radius of a leaked cell is then exactly that cell's own mirror,
// for one hour, which is what it would have had anyway.
//
// WHAT NEVER HAPPENS HERE: the token is not stored, not logged, and not
// written to the response body of anything a customer can reach. It is minted
// on demand and handed to one caller.

/** Installation tokens are valid for an hour; we treat them as valid for less. */
export const TOKEN_TTL_MS = 50 * 60 * 1000;

function b64url(bytes) {
  let s = '';
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlText(text) {
  return b64url(new TextEncoder().encode(text));
}

/** PEM (PKCS#8) → the raw DER bytes WebCrypto wants. */
export function pemToDer(pem) {
  const body = String(pem)
    .replace(/-----BEGIN [^-]+-----/, '')
    .replace(/-----END [^-]+-----/, '')
    .replace(/\s+/g, '');
  const raw = atob(body);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out.buffer;
}

/**
 * The App JWT. RS256, ten minutes, issued by the App id.
 *
 * `iat` is backdated 60 s on purpose: GitHub rejects a token whose `iat` is in
 * the future, and a Worker's clock and GitHub's differ by more than zero.
 */
export async function appJwt(privateKeyPem, appId, nowMs) {
  const now = Math.floor(nowMs / 1000);
  const header = b64urlText(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = b64urlText(JSON.stringify({ iat: now - 60, exp: now + 540, iss: String(appId) }));
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToDer(privateKeyPem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(`${header}.${payload}`)
  );
  return `${header}.${payload}.${b64url(sig)}`;
}

/**
 * Mint an installation token scoped to named repositories — usually ONE
 * (`repository`); the bug-report intake passes TWO (`repositories`: the public
 * issue tracker + the private media store), which is still an explicit,
 * minimal enumeration, never the whole installation.
 *
 * Scoping is not decoration. Without `repositories`, the token can write to
 * every repo the installation covers — so a tenant who configured a mirror to
 * their own repo would hold a credential for every other repo the owner
 * installed the App on, including ones they have never heard of.
 *
 * @param {(url: string, init: object) => Promise<Response>} [fetchImpl]
 */
export async function mintInstallationToken(
  { privateKeyPem, appId, installationId, repository, repositories },
  { nowMs = Date.now(), fetchImpl = fetch } = {}
) {
  if (!privateKeyPem || !appId || !installationId) {
    throw new Error('the GitHub App is not configured');
  }
  const scoped = repositories ?? (repository ? [repository] : null);
  const jwt = await appJwt(privateKeyPem, appId, nowMs);
  const res = await fetchImpl(
    `https://api.github.com/app/installations/${encodeURIComponent(installationId)}/access_tokens`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${jwt}`,
        accept: 'application/vnd.github+json',
        'content-type': 'application/json',
        'user-agent': 'maude-cloud',
      },
      body: JSON.stringify(scoped ? { repositories: scoped } : {}),
    }
  );
  if (!res.ok) {
    // The body can name the App and the installation; neither belongs in a
    // message a tenant might see, so the status is all that crosses back.
    throw new Error(`GitHub refused to issue an installation token (HTTP ${res.status})`);
  }
  const body = await res.json();
  if (!body?.token) throw new Error('GitHub returned no token');
  return {
    token: body.token,
    expiresAt: Date.parse(body.expires_at ?? '') || nowMs + TOKEN_TTL_MS,
  };
}

/**
 * The push URL, with the token as the password.
 *
 * A token in a URL is a credential in a string that git may echo, so this is
 * built at the moment of use and never stored. `redactPushUrl` is what any
 * logging path must use.
 */
export function pushUrl(target, token) {
  return `https://x-access-token:${token}@github.com/${target}.git`;
}

/** The same URL with the credential removed. Every log line uses this. */
export function redactPushUrl(url) {
  return String(url).replace(/\/\/[^@/]*@/, '//***@');
}
