// The browser door's sign-in — Cloud Phase 25 B1/B2.
//
// The chain the desktop already walks, with the last leg changed from "hand
// the app a token" to "set a cookie on this hostname":
//
//   the person opens <project>.cloud.maude.sh
//     → no session ⇒ redirect to the control plane's browser handoff
//     → the control plane authenticates the MAUDE ACCOUNT and decides access
//       (owner / member / viewer all pass; a stranger meets B2's refusal)
//     → it redirects back here with a one-time code
//     → THIS module trades the code for a project token, server to server,
//       and stores it as an httpOnly cookie
//
// The code travels in a URL and the token never does — the same rule /join
// follows, for the same reason (Referer headers, proxy logs, shoulders).
//
// The cookie is the SAME peer token the desktop holds as a bearer, so the
// read-only capability (C1) and the expiry are decided once, in one place,
// for both surfaces. A separate browser session type would be a second place
// for the role model to drift, which is exactly what Track C exists to stop.

import { authenticateForMode } from './../cloud-identity.mjs';
import { isRevoked } from './../revocations.mjs';
import { isReadOnlyRole } from './../role-matrix.mjs';
import { addToken, removeToken, verifyToken } from './../tokens.mjs';
import { authenticate as localAuthenticate } from './../users.mjs';
import { servicePage } from './routes.mjs';

export const BROWSER_SESSION_COOKIE = 'maude_studio';

/** Read one cookie from a Node request. */
export function cookieValue(request, name) {
  const raw = request.headers?.cookie;
  if (!raw) return null;
  for (const part of String(raw).split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return null;
}

function setSessionCookie(response, token, maxAgeSeconds) {
  response.setHeader('set-cookie', [
    `${BROWSER_SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`,
  ]);
}

function clearSessionCookie(response) {
  response.setHeader('set-cookie', [
    `${BROWSER_SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
  ]);
}

function redirect(response, location) {
  response.writeHead(302, { location, 'cache-control': 'no-store' });
  response.end();
}

function page(response, status, title, message, action) {
  response.writeHead(status, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  response.end(servicePage(title, message, action ? { action } : {}));
}

/**
 * @returns {Promise<boolean>} true when handled.
 */
export async function handleBrowserAuth({
  request,
  response,
  path,
  method,
  dataDir,
  secret,
  env = process.env,
  fetchImpl = fetch,
}) {
  if (path === '/auth/browser/signout') {
    const existing = cookieValue(request, BROWSER_SESSION_COOKIE);
    const match = existing ? verifyToken(dataDir, existing, secret) : null;
    if (match?.label) {
      try {
        removeToken(dataDir, match.label);
      } catch {
        /* already gone — signing out twice is not an error */
      }
    }
    clearSessionCookie(response);
    redirect(response, '/');
    return true;
  }

  // ---- the SELF-HOSTED door (Cloud Phase 25 E2) --------------------------
  //
  // A self-hosted hub has no control plane to bounce off; it has its own
  // users. Same cookie, same token store, same read-only capability — only the
  // question ("who are you?") is answered here instead of there. Writing it as
  // a second door rather than a second SYSTEM is what keeps E2 honest: the
  // studio, the sandbox and the role model are all the same code.
  if (path === '/studio/signin') {
    if (method === 'GET') {
      response.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
      });
      response.end(signInPage());
      return true;
    }
    if (method === 'POST') {
      const form = await readForm(request);
      const result = authenticateForMode(
        { email: form.get('email'), password: form.get('password') },
        { local: (email, password) => localAuthenticate(dataDir, email, password) }
      );
      if (!result.ok) {
        response.writeHead(401, {
          'content-type': 'text/html; charset=utf-8',
          'cache-control': 'no-store',
        });
        // ONE opaque message — the distinction between "no such user" and
        // "wrong password" is an account-existence oracle.
        response.end(signInPage('That email and password did not match.'));
        return true;
      }
      const user = result.user;
      const ttlMs = 12 * 3600_000;
      const minted = addToken(dataDir, {
        label: `studio-${Math.random().toString(36).slice(2, 10)}`,
        scope: user.scope ?? '*',
        owner: user.email,
        expiresAt: Date.now() + ttlMs,
        readOnly: isReadOnlyRole(user.role),
      });
      setSessionCookie(response, minted.value, ttlMs / 1000);
      redirect(response, '/studio');
      return true;
    }
    page(response, 405, 'Not here', 'Open the project from the start page.');
    return true;
  }

  if (path !== '/auth/browser') return false;
  if (method !== 'GET') {
    page(response, 405, 'Not here', 'Open the project from your dashboard.');
    return true;
  }

  const url = new URL(request.url, 'http://cell.invalid');
  const code = url.searchParams.get('code');
  const denied = url.searchParams.get('denied');
  if (denied) {
    // B2 — the refusal travels back from the control plane as a reason, never
    // as a 404: the person must learn what to do, and must NOT learn whether
    // the project exists.
    page(
      response,
      403,
      'You do not have access',
      'This project is not shared with your Maude account. If you think it should be, ask whoever runs it to invite you.',
      env.HUB_DASHBOARD_URL ? { href: env.HUB_DASHBOARD_URL, label: 'Go to your dashboard' } : null
    );
    return true;
  }
  if (!code) {
    page(response, 400, 'Something is missing', 'Open the project from your dashboard.');
    return true;
  }

  const controlPlane = env.MAUDE_CONTROL_PLANE_URL ?? 'https://cloud.maude.sh';
  let exchanged = null;
  try {
    const res = await fetchImpl(`${controlPlane}/auth/handoff/exchange`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code }),
      signal: AbortSignal.timeout(15_000),
    });
    exchanged = await res.json();
    if (!res.ok || !exchanged?.token) throw new Error(exchanged?.error ?? `HTTP ${res.status}`);
  } catch (err) {
    console.warn(`[hub] browser sign-in exchange failed: ${err.message}`);
    page(
      response,
      400,
      'That link has expired',
      'Sign-in links are good for a couple of minutes. Open the project from your dashboard again.',
      env.HUB_DASHBOARD_URL ? { href: env.HUB_DASHBOARD_URL, label: 'Go to your dashboard' } : null
    );
    return true;
  }

  // Same verification the desktop's /auth/login does — including the
  // revocation registry, so a removed member cannot ride a token they still
  // hold (Phase 23 B2's lesson, re-applied to the new door rather than
  // re-implemented).
  const result = authenticateForMode(
    { token: exchanged.token },
    { revoked: (email, issuedAt) => isRevoked(dataDir, email, issuedAt) }
  );
  if (!result.ok) {
    page(response, 403, 'You do not have access', 'Ask whoever runs this project to invite you.');
    return true;
  }

  const user = result.user;
  const ttlMs = Math.max(
    60_000,
    Math.min(result.expiresAt ?? Date.now() + 12 * 3600_000, Date.now() + 12 * 3600_000) -
      Date.now()
  );
  const minted = addToken(dataDir, {
    label: `studio-${Math.random().toString(36).slice(2, 10)}`,
    scope: user.scope ?? '*',
    owner: user.email,
    expiresAt: Date.now() + ttlMs,
    // The capability is decided ONCE, from the role the control plane vouched
    // for — the same line as /auth/login (C1).
    readOnly: isReadOnlyRole(user.role),
  });
  setSessionCookie(response, minted.value, ttlMs / 1000);
  redirect(response, '/studio');
  return true;
}

async function readForm(request, max = 8 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > max) break;
    chunks.push(chunk);
  }
  return new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
}

function signInPage(error = null) {
  const esc = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sign in</title>
<style>
  body { margin:0; min-height:100vh; display:grid; place-items:center; background:#0e1014; color:#e9ecf3;
         font:15px/1.6 -apple-system, system-ui, sans-serif; padding:24px; }
  form { width:min(22rem, 100%); }
  h1 { font-size:1.3rem; margin:0 0 1rem; }
  label { display:block; font-size:12px; color:#828b9e; margin:12px 0 4px; }
  input { width:100%; padding:9px 11px; border-radius:9px; border:1px solid #262c38;
          background:#14171d; color:inherit; font:inherit; }
  button { margin-top:16px; width:100%; padding:10px; border:0; border-radius:9px;
           background:#7a86f8; color:#0f1020; font:inherit; font-weight:650; cursor:pointer; }
  .err { color:#f0a3a3; font-size:13px; margin-top:10px; }
</style></head>
<body><form method="post" action="/studio/signin">
  <h1>Sign in to this workspace</h1>
  <label for="email">Email</label><input id="email" name="email" type="email" autocomplete="username" required autofocus>
  <label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" required>
  <button type="submit">Sign in</button>
  ${error ? `<p class="err">${esc(error)}</p>` : ''}
</form></body></html>`;
}
