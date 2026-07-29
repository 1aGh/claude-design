// Identity routes — Cloud Phase 13. Split from worker.mjs so the router file
// stays a table of contents; every decision still lives in accounts.mjs /
// oauth-google.mjs / grants.mjs.
//
// Cookie posture: HttpOnly + Secure + SameSite=Lax + Path=/. Lax (not Strict)
// because the Google callback is a top-level cross-site navigation and the
// session cookie must survive it. CSRF exposure under Lax is POST-only, and
// every state-changing POST here either carries credentials in its body
// (signup/login) or only destroys the caller's own session (logout).

import {
  accountForGoogle,
  authenticate,
  createAccount,
  createSession,
  getAccountByEmail,
  revokeSession,
  sessionAccount,
} from './accounts.mjs';
import { audit, getProject } from './db.mjs';
import { mintGrant } from './grants.mjs';
import {
  authorizationUrl,
  exchangeCode,
  googleConfigured,
  pkcePair,
  validateCallback,
} from './oauth-google.mjs';
import { homePage, loginPage, messagePage, signupPage } from './pages.mjs';

const SESSION_COOKIE = 'maude_session';
const OAUTH_COOKIE = 'maude_oauth';

function html(body, status = 200, extraHeaders = {}) {
  return new Response(body, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'x-content-type-options': 'nosniff',
      ...extraHeaders,
    },
  });
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'x-content-type-options': 'nosniff' },
  });
}

function redirect(location, extraHeaders = {}) {
  return new Response(null, { status: 303, headers: { location, ...extraHeaders } });
}

function cookieValue(request, name) {
  const header = request.headers.get('cookie') ?? '';
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return rest.join('=');
  }
  return null;
}

function setCookie(name, value, { maxAge = 30 * 24 * 3600, httpOnly = true } = {}) {
  return `${name}=${value}; Path=/; Max-Age=${maxAge}; SameSite=Lax; Secure${httpOnly ? '; HttpOnly' : ''}`;
}

function clearCookie(name) {
  return `${name}=; Path=/; Max-Age=0; SameSite=Lax; Secure; HttpOnly`;
}

async function currentAccount(request, env) {
  const token = cookieValue(request, SESSION_COOKIE);
  return token ? sessionAccount(env.DB, token) : null;
}

/**
 * Route the identity surface. Returns a Response, or null when the path is
 * not ours (worker.mjs falls through to its own routes).
 */
export async function handleAuth(request, env) {
  const url = new URL(request.url);
  const { pathname } = url;
  const method = request.method;
  const google = googleConfigured(env);

  // ------------------------------------------------------------------ pages
  if (method === 'GET' && pathname === '/') {
    return html(homePage({ account: await currentAccount(request, env) }));
  }
  if (method === 'GET' && pathname === '/signup') {
    return html(signupPage({ googleEnabled: google }));
  }
  if (method === 'GET' && pathname === '/login') {
    return html(loginPage({ googleEnabled: google }));
  }

  // ----------------------------------------------------------------- signup
  if (method === 'POST' && pathname === '/auth/signup') {
    const form = await request.formData();
    const email = String(form.get('email') ?? '');
    const password = String(form.get('password') ?? '');
    const disclosure = form.get('disclosure') === 'yes';
    if (!disclosure) {
      return html(
        signupPage({
          googleEnabled: google,
          error: 'Please confirm you’ve read what Maude Cloud stores.',
        }),
        400
      );
    }
    try {
      const account = await createAccount(env.DB, { email, password });
      // Consent is recorded only when the box was actually ticked — and the
      // timestamp is the moment of signup, where the decision happened.
      await env.DB.prepare('UPDATE accounts SET disclosure_accepted_at = ? WHERE id = ?')
        .bind(Date.now(), account.id)
        .run();
      await audit(env.DB, {
        accountId: account.id,
        actor: `customer:${account.email}`,
        action: 'signup',
      });
      const session = await createSession(env.DB, account.id);
      return redirect('/', { 'set-cookie': setCookie(SESSION_COOKIE, session.token) });
    } catch (err) {
      // One neutral sentence for both "exists" and validation shapes the user
      // can fix; the distinction lives in logs, not in the response.
      const friendly =
        err.code === 'account-exists'
          ? 'That address can’t be used here. If it’s yours, try signing in.'
          : 'That didn’t work — check the address and use at least 12 characters.';
      return html(signupPage({ googleEnabled: google, error: friendly }), 400);
    }
  }

  // ------------------------------------------------------------------ login
  if (method === 'POST' && pathname === '/auth/login') {
    const form = await request.formData();
    const verdict = await authenticate(
      env.DB,
      String(form.get('email') ?? ''),
      String(form.get('password') ?? '')
    );
    if (!verdict.ok) {
      return html(
        loginPage({ googleEnabled: google, error: 'That email and password don’t match.' }),
        401
      );
    }
    const session = await createSession(env.DB, verdict.account.id);
    return redirect('/', { 'set-cookie': setCookie(SESSION_COOKIE, session.token) });
  }

  if (method === 'POST' && pathname === '/auth/logout') {
    const token = cookieValue(request, SESSION_COOKIE);
    if (token) await revokeSession(env.DB, token);
    return redirect('/', { 'set-cookie': clearCookie(SESSION_COOKIE) });
  }

  if (method === 'GET' && pathname === '/auth/session') {
    const account = await currentAccount(request, env);
    return account
      ? json({ ok: true, account: { email: account.email, name: account.name } })
      : json({ ok: false }, 401);
  }

  // ----------------------------------------------------------------- google
  if (method === 'GET' && pathname === '/auth/google') {
    if (!google) {
      return html(
        messagePage(
          'Sign-in is not ready',
          'Google sign-in is not configured here yet. Use email and password instead.'
        ),
        503
      );
    }
    const { verifier, challenge, state } = await pkcePair();
    const location = authorizationUrl({
      clientId: env.GOOGLE_CLIENT_ID,
      redirectUri: `${url.origin}/auth/google/callback`,
      challenge,
      state,
    });
    // Verifier+state ride a short-lived HttpOnly cookie — the only place the
    // browser can hold them without script access.
    return redirect(location, {
      'set-cookie': setCookie(OAUTH_COOKIE, `${state}.${verifier}`, { maxAge: 600 }),
    });
  }

  if (method === 'GET' && pathname === '/auth/google/callback') {
    if (!google) return json({ ok: false }, 503);
    const stored = cookieValue(request, OAUTH_COOKIE) ?? '';
    const [cookieState, verifier] = stored.split('.');
    const check = validateCallback({
      queryState: url.searchParams.get('state'),
      cookieState,
      code: url.searchParams.get('code'),
    });
    if (!check.ok) {
      return html(
        messagePage('Sign-in didn’t complete', 'Please try again from the sign-in page.'),
        400,
        { 'set-cookie': clearCookie(OAUTH_COOKIE) }
      );
    }
    const exchange = await exchangeCode({
      code: url.searchParams.get('code'),
      verifier,
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      redirectUri: `${url.origin}/auth/google/callback`,
    });
    if (!exchange.ok) {
      return html(
        messagePage(
          'Sign-in didn’t complete',
          'Google didn’t confirm the sign-in. Please try again.'
        ),
        502,
        { 'set-cookie': clearCookie(OAUTH_COOKIE) }
      );
    }
    const resolved = await accountForGoogle(env.DB, exchange.claims);
    if (resolved.action === 'refused') {
      const why =
        resolved.reason === 'unverified-password-account'
          ? 'An account with this address already exists. Sign in with its password first — then you can connect Google from settings.'
          : 'Google didn’t vouch for this address, so it can’t be used to sign in.';
      return html(messagePage('Sign-in didn’t complete', why), 409, {
        'set-cookie': clearCookie(OAUTH_COOKIE),
      });
    }
    if (resolved.action === 'created') {
      await audit(env.DB, {
        accountId: resolved.account.id,
        actor: `customer:${resolved.account.email}`,
        action: 'signup-google',
      });
    }
    const session = await createSession(env.DB, resolved.account.id);
    return redirect('/', {
      'set-cookie': [setCookie(SESSION_COOKIE, session.token), clearCookie(OAUTH_COOKIE)].join(
        ', '
      ),
    });
  }

  // ------------------------------------------------- project grant minting
  if (method === 'POST' && /^\/api\/projects\/[a-z0-9-]+\/token$/.test(pathname)) {
    const account = await currentAccount(request, env);
    if (!account) return json({ ok: false }, 401);
    const projectId = pathname.split('/')[3];
    const project = await getProject(env.DB, projectId);
    // Same 404 for "doesn't exist" and "isn't yours" — a probe learns nothing.
    if (!project || project.account_id !== account.id) return json({ ok: false }, 404);
    if (!env.GRANT_SIGNING_SECRET) return json({ ok: false, error: 'grants not configured' }, 503);
    const grant = await mintGrant(
      { projectId, accountId: account.id, email: account.email },
      env.GRANT_SIGNING_SECRET
    );
    await audit(env.DB, {
      accountId: account.id,
      projectId,
      actor: `customer:${account.email}`,
      action: 'grant-minted',
    });
    return json({ ok: true, grant });
  }

  return null;
}

export { getAccountByEmail }; // re-export for tests' convenience
