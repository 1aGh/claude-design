// Identity routes over the live worker surface — Cloud Phase 13.
//
// Same posture as worker.test.mjs: real SQLite behind the D1 binding shape,
// real Request/Response objects, no route mocked.

import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { isSameOriginPath } from './auth-routes.mjs';
import { d1FromSqlite } from './db.mjs';
import { verifyGrant } from './grants.mjs';
import { applySchema } from './migrate.mjs';
import { allCustomerFacingHtml, homePage } from './pages.mjs';
import { SCHEMA_SQL } from './schema.mjs';
import worker from './worker.mjs';

const PASSWORD = 'a-long-enough-password';

async function freshEnv(extra = {}) {
  const sqlite = new DatabaseSync(':memory:');
  const DB = d1FromSqlite(sqlite);
  await applySchema(DB, SCHEMA_SQL);
  return { env: { DB, GRANT_SIGNING_SECRET: 'grant-secret', ...extra }, sqlite };
}

function form(fields) {
  return new URLSearchParams(fields).toString();
}

async function signup(env, { email = 'alice@example.com', password = PASSWORD } = {}) {
  const res = await worker.fetch(
    new Request('https://cloud.test/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: form({ email, password, disclosure: 'yes' }),
    }),
    env
  );
  const cookie = res.headers.get('set-cookie') ?? '';
  return { res, session: /maude_session=([^;]+)/.exec(cookie)?.[1] };
}

test('signup sets a session, records consent, and lands signed in', async () => {
  const { env, sqlite } = await freshEnv();
  const { res, session } = await signup(env);
  assert.equal(res.status, 303);
  assert.ok(session, 'session cookie set');
  assert.match(res.headers.get('set-cookie'), /HttpOnly/);
  assert.match(res.headers.get('set-cookie'), /SameSite=Lax/);

  const row = sqlite.prepare('SELECT disclosure_accepted_at FROM accounts').get();
  assert.ok(row.disclosure_accepted_at > 0, 'consent recorded at the moment it was given');

  const who = await worker.fetch(
    new Request('https://cloud.test/auth/session', {
      headers: { cookie: `maude_session=${session}` },
    }),
    env
  );
  assert.equal((await who.json()).account.email, 'alice@example.com');
});

test('signup WITHOUT the disclosure tick is a 400 — consent is not assumed', async () => {
  const { env, sqlite } = await freshEnv();
  const res = await worker.fetch(
    new Request('https://cloud.test/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: form({ email: 'alice@example.com', password: PASSWORD }),
    }),
    env
  );
  assert.equal(res.status, 400);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM accounts').get().n, 0);
});

test('duplicate signup and bad password get the SAME neutral sentence', async () => {
  const { env } = await freshEnv();
  await signup(env);
  const dup = await worker.fetch(
    new Request('https://cloud.test/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: form({ email: 'alice@example.com', password: 'another-password-x', disclosure: 'yes' }),
    }),
    env
  );
  const text = await dup.text();
  assert.equal(dup.status, 400);
  assert.ok(!/already has an account/i.test(text), 'no existence oracle in the response');
});

test('login round-trips; logout revokes the row, not just the cookie', async () => {
  const { env } = await freshEnv();
  await signup(env);

  const login = await worker.fetch(
    new Request('https://cloud.test/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: form({ email: 'alice@example.com', password: PASSWORD }),
    }),
    env
  );
  assert.equal(login.status, 303);
  const session = /maude_session=([^;]+)/.exec(login.headers.get('set-cookie'))[1];

  await worker.fetch(
    new Request('https://cloud.test/auth/logout', {
      method: 'POST',
      headers: { cookie: `maude_session=${session}` },
    }),
    env
  );
  const after = await worker.fetch(
    new Request('https://cloud.test/auth/session', {
      headers: { cookie: `maude_session=${session}` },
    }),
    env
  );
  assert.equal(after.status, 401, 'the stolen cookie is dead server-side');
});

test('wrong password is 401 with one sentence — no existence oracle', async () => {
  const { env } = await freshEnv();
  const res = await worker.fetch(
    new Request('https://cloud.test/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: form({ email: 'ghost@example.com', password: 'whatever-it-is' }),
    }),
    env
  );
  assert.equal(res.status, 401);
});

// ------------------------------------------------------------------- google

test('unconfigured Google is an honest 503, not a broken redirect', async () => {
  const { env } = await freshEnv();
  const res = await worker.fetch(new Request('https://cloud.test/auth/google'), env);
  assert.equal(res.status, 503);
  const text = await res.text();
  assert.match(text, /not configured here yet/i);
});

test('configured Google redirects with PKCE S256 + state, and the signup page shows the button', async () => {
  const { env } = await freshEnv({ GOOGLE_CLIENT_ID: 'cid', GOOGLE_CLIENT_SECRET: 'cs' });
  const res = await worker.fetch(new Request('https://cloud.test/auth/google'), env);
  assert.equal(res.status, 303);
  const loc = new URL(res.headers.get('location'));
  assert.equal(loc.hostname, 'accounts.google.com');
  assert.equal(loc.searchParams.get('code_challenge_method'), 'S256');
  assert.ok(loc.searchParams.get('state'));
  assert.match(res.headers.get('set-cookie'), /maude_oauth=/);

  const page = await worker.fetch(new Request('https://cloud.test/signup'), env);
  assert.match(await page.text(), /Continue with Google/);
});

test('a callback with mismatched state is refused', async () => {
  const { env } = await freshEnv({ GOOGLE_CLIENT_ID: 'cid', GOOGLE_CLIENT_SECRET: 'cs' });
  const res = await worker.fetch(
    new Request('https://cloud.test/auth/google/callback?code=x&state=attacker', {
      headers: { cookie: 'maude_oauth=legit.verifier' },
    }),
    env
  );
  assert.equal(res.status, 400);
});

function fakeIdToken(claims) {
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  return `h.${payload}.s`;
}

async function withGoogleExchange(claims, fn) {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ id_token: fakeIdToken(claims) }), {
      headers: { 'content-type': 'application/json' },
    });
  try {
    return await fn();
  } finally {
    globalThis.fetch = realFetch;
  }
}

test('a successful Google callback sets the session and clears the oauth jar as TWO Set-Cookie headers', async () => {
  // Regression (2026-07-30): the two cookies were comma-joined into ONE
  // header, so the browser read the whole string as one cookie whose trailing
  // Max-Age=0 deleted the session on arrival — Google sign-in bounced back to
  // the landing page signed out, with every server-side step "working".
  const { env } = await freshEnv({ GOOGLE_CLIENT_ID: 'cid', GOOGLE_CLIENT_SECRET: 'cs' });
  await withGoogleExchange(
    { sub: 'g-123', email: 'g@example.com', email_verified: true },
    async () => {
      const res = await worker.fetch(
        new Request('https://cloud.test/auth/google/callback?code=x&state=legit', {
          headers: { cookie: 'maude_oauth=legit.verifier' },
        }),
        env
      );
      assert.equal(res.status, 303);
      assert.equal(res.headers.get('location'), '/');
      const cookies = res.headers.getSetCookie();
      assert.equal(cookies.length, 2, 'session set + oauth clear must be separate headers');
      const session = cookies.find((c) => c.startsWith('maude_session='));
      assert.ok(session, 'session cookie present');
      assert.ok(!/Max-Age=0/.test(session), 'session cookie must not be born expired');
      const oauth = cookies.find((c) => c.startsWith('maude_oauth='));
      assert.match(oauth, /Max-Age=0/);
    }
  );
});

test('Google sign-in carries ?next through the oauth jar back to the return path', async () => {
  const { env } = await freshEnv({ GOOGLE_CLIENT_ID: 'cid', GOOGLE_CLIENT_SECRET: 'cs' });
  const start = await worker.fetch(
    new Request('https://cloud.test/auth/google?next=%2Finvite%2Fabc.def', { redirect: 'manual' }),
    env
  );
  const jar = /maude_oauth=([^;]+)/.exec(start.headers.get('set-cookie'))[1];
  assert.match(jar, /\.%2Finvite%2Fabc\.def$/, 'next rides the cookie, URI-encoded');

  const state = new URL(start.headers.get('location')).searchParams.get('state');
  await withGoogleExchange(
    { sub: 'g-456', email: 'n@example.com', email_verified: true },
    async () => {
      const res = await worker.fetch(
        new Request(`https://cloud.test/auth/google/callback?code=x&state=${state}`, {
          headers: { cookie: `maude_oauth=${jar}` },
        }),
        env
      );
      assert.equal(res.status, 303);
      assert.equal(res.headers.get('location'), '/invite/abc.def');
    }
  );
});

test('a hostile next in the oauth jar falls back to the dashboard', async () => {
  const { env } = await freshEnv({ GOOGLE_CLIENT_ID: 'cid', GOOGLE_CLIENT_SECRET: 'cs' });
  await withGoogleExchange(
    { sub: 'g-789', email: 'h@example.com', email_verified: true },
    async () => {
      const res = await worker.fetch(
        new Request('https://cloud.test/auth/google/callback?code=x&state=legit', {
          headers: { cookie: `maude_oauth=legit.verifier.${encodeURIComponent('//evil.example')}` },
        }),
        env
      );
      assert.equal(res.status, 303);
      assert.equal(res.headers.get('location'), '/');
    }
  );
});

// -------------------------------------------------------------------- grant

test('grant mint: owner gets one, a stranger and a guest both get the SAME 404', async () => {
  const { env, sqlite } = await freshEnv();
  const { session } = await signup(env);
  const acctId = sqlite.prepare('SELECT id FROM accounts').get().id;
  sqlite
    .prepare(
      "INSERT INTO projects (id, account_id, name, state, state_since, created_at) VALUES ('alligators', ?, 'Alligators', 'active', 1, 1)"
    )
    .run(acctId);

  const mine = await worker.fetch(
    new Request('https://cloud.test/api/projects/alligators/token', {
      method: 'POST',
      headers: { cookie: `maude_session=${session}` },
    }),
    env
  );
  const body = await mine.json();
  assert.equal(body.ok, true);
  const verdict = await verifyGrant(body.grant, 'grant-secret');
  assert.equal(verdict.ok, true);
  assert.equal(verdict.grant.projectId, 'alligators');

  // A second account probing someone else's project id...
  const { session: other } = await signup(env, { email: 'mallory@example.com' });
  const notMine = await worker.fetch(
    new Request('https://cloud.test/api/projects/alligators/token', {
      method: 'POST',
      headers: { cookie: `maude_session=${other}` },
    }),
    env
  );
  // ...and the same account probing a nonexistent one:
  const ghost = await worker.fetch(
    new Request('https://cloud.test/api/projects/ghost/token', {
      method: 'POST',
      headers: { cookie: `maude_session=${session}` },
    }),
    env
  );
  assert.equal(notMine.status, 404);
  assert.equal(ghost.status, 404, 'not-yours and not-there are indistinguishable');

  const anon = await worker.fetch(
    new Request('https://cloud.test/api/projects/alligators/token', { method: 'POST' }),
    env
  );
  assert.equal(anon.status, 401);
});

// --------------------------------------------------------------- vocabulary

test('customer-facing copy never says token/repository/oauth/bearer/crdt/git', () => {
  const text = allCustomerFacingHtml().toLowerCase();
  for (const banned of [
    'token',
    'repository',
    'repositories',
    ' oauth',
    'bearer',
    'crdt',
    ' git ',
  ]) {
    assert.ok(!text.includes(banned), `banned word reached the customer: "${banned.trim()}"`);
  }
});

// Cloud Phase 24 A1. The audit's sharpest finding: every page was honest and
// the journey lied. "Claude" appeared in ZERO customer-facing cloud pages, so
// the second subscription was a discovery, not a disclosure.
test('the landing states the full bill of materials before anyone reaches a card', () => {
  const html = homePage({ googleEnabled: true });
  assert.match(html, /your own Claude subscription/);
  assert.match(html, /Anthropic/);
  assert.match(html, /not a phone/);
  assert.match(html, /free Maude app/i);
  // …and it is framed as the reason the work stays private, not as a caveat.
  assert.match(html, /only ever drawn on your machine/);
});

test('phase-12 routes still answer (health + webhook refusal)', async () => {
  const { env } = await freshEnv({ STRIPE_WEBHOOK_SECRET: 'whsec_x' });
  const health = await worker.fetch(new Request('https://cloud.test/health'), env);
  assert.equal((await health.json()).ok, true);
  const hook = await worker.fetch(
    new Request('https://cloud.test/webhooks/stripe', { method: 'POST', body: '{}' }),
    env
  );
  assert.equal(hook.status, 400);
});

test('F3 — a backslash authority is not a same-origin path (open-redirect)', async () => {
  // `/\evil.example` passes a naive "one leading slash" test, but WHATWG URL
  // parsing turns `\` into `/`, so the browser reads it as https://evil.example/.
  for (const bad of ['/\\evil.example', '//evil.example', '/\\\\evil.example', '/ok\\path']) {
    assert.equal(isSameOriginPath(bad), false, `${bad} must be refused`);
  }
  for (const good of ['/', '/account', '/invite/abc.def', '/projects/x/people?q=1']) {
    assert.equal(isSameOriginPath(good), true, `${good} must be allowed`);
  }
});

test('F3 — the login redirect never leaves the origin', async () => {
  const { env } = await freshEnv();
  await signup(env);
  const res = await worker.fetch(
    new Request('https://cloud.test/auth/login?next=%2F%5Cevil.example', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: form({ email: 'alice@example.com', password: PASSWORD }),
    }),
    env
  );
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('location'), '/', 'a hostile next falls back to the dashboard');
});

// Cloud Phase 26 follow-up — the shell gate needs a caller.
//
// `appShell` will render the Fleet nav when told to, and for a while only
// `operator-pages.mjs` ever told it: the operator surface could be reached
// only by typing its URL. These two assert the door exists on the dashboard
// and that it is still the allowlist, not the session, that opens it.
test('a signed-in operator gets the way into the fleet from the dashboard', async () => {
  const { env, sqlite } = await freshEnv();
  const { session } = await signup(env);
  const { id } = sqlite.prepare('SELECT id FROM accounts').get();
  env.OPERATOR_ACCOUNT_IDS = id;

  const res = await worker.fetch(
    new Request('https://cloud.test/', { headers: { cookie: `maude_session=${session}` } }),
    env
  );
  const body = await res.text();
  assert.equal(res.status, 200);
  assert.match(body, /href="\/operator"/);
  assert.match(body, /Fleet/);
});

test('a signed-in customer gets no hint the fleet exists', async () => {
  // The default is an EMPTY allowlist, which is also the deployed default —
  // so this is the same page every customer renders.
  const { env } = await freshEnv();
  const { session } = await signup(env);

  const res = await worker.fetch(
    new Request('https://cloud.test/', { headers: { cookie: `maude_session=${session}` } }),
    env
  );
  const body = await res.text();
  assert.equal(res.status, 200);
  assert.doesNotMatch(body, /\/operator/);
  assert.doesNotMatch(body, /Fleet/);
});
