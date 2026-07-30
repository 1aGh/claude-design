// The wizard → Checkout → waiting room round trip — Cloud Phase 14 (DDR-203).
//
// Same posture as the other route suites: real SQLite behind the D1 shape,
// real Requests through the live worker. Stripe, the Cloudflare API, and the
// cell's /health are the network — they are faked at globalThis.fetch, and
// the fake records what was asked of it so the tests can assert the ORDER of
// effects, which is the whole point of this phase.

import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { after, before, beforeEach, test } from 'node:test';

import { allCheckoutHtml } from './checkout-pages.mjs';
import { d1FromSqlite } from './db.mjs';
import { applySchema } from './migrate.mjs';
import { loadPricing } from './pricing.mjs';
import { SCHEMA_SQL } from './schema.mjs';
import worker from './worker.mjs';

const PASSWORD = 'a-long-enough-password';
const realFetch = globalThis.fetch;

/** A scriptable network. Each key is a substring of the URL. */
let network;
before(() => {
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input?.url ?? input);
    for (const [needle, handler] of network) {
      if (url.includes(needle)) return handler(url, init);
    }
    return realFetch(input, init);
  };
});
after(() => {
  globalThis.fetch = realFetch;
});
beforeEach(() => {
  network = [];
});

async function freshEnv(extra = {}) {
  const sqlite = new DatabaseSync(':memory:');
  const DB = d1FromSqlite(sqlite);
  await applySchema(DB, SCHEMA_SQL);
  return {
    env: {
      DB,
      STRIPE_SECRET_KEY: 'sk_test_x',
      CF_PROVISION_TOKEN: 'cf-token',
      CF_ACCOUNT_ID: 'acct',
      CF_ZONE_ID: 'zone',
      ...extra,
    },
    sqlite,
  };
}

function form(fields) {
  return new URLSearchParams(fields).toString();
}

async function signedIn(env) {
  const res = await worker.fetch(
    new Request('https://cloud.test/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: form({ email: 'founder@example.com', password: PASSWORD, disclosure: 'yes' }),
    }),
    env
  );
  return /maude_session=([^;]+)/.exec(res.headers.get('set-cookie') ?? '')?.[1];
}

function post(path, session, fields) {
  return new Request(`https://cloud.test${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      cookie: `maude_session=${session}`,
    },
    body: form(fields),
  });
}

function get(path, session) {
  return new Request(`https://cloud.test${path}`, {
    headers: session ? { cookie: `maude_session=${session}` } : {},
  });
}

/** The standard Stripe fake for a happy checkout. Returns the recorded calls. */
function stripeHappy() {
  const calls = [];
  network.push([
    'api.stripe.com',
    async (url, init) => {
      const body = Object.fromEntries(new URLSearchParams(init.body ?? ''));
      calls.push({ url, method: init.method ?? 'GET', body });
      if (url.endsWith('/v1/customers')) {
        return Response.json({ id: 'cus_1' });
      }
      if (url.endsWith('/v1/checkout/sessions')) {
        return Response.json({ id: 'cs_test_1', url: 'https://checkout.stripe.com/pay/cs_test_1' });
      }
      if (url.includes('/v1/checkout/sessions/cs_test_1')) {
        return Response.json({
          id: 'cs_test_1',
          status: 'complete',
          customer: 'cus_1',
          subscription: 'sub_1',
          metadata: { project_id: 'zkusebni-tym', project_name: 'Zkušební tým', plan: 'project' },
        });
      }
      if (url.includes('/v1/subscriptions/sub_1') && init.method === 'DELETE') {
        return Response.json({ id: 'sub_1', status: 'canceled' });
      }
      if (url.includes('/v1/billing_portal/sessions')) {
        return Response.json({ url: 'https://billing.stripe.com/p/session_1' });
      }
      return Response.json({ error: { message: `unexpected ${url}` } }, { status: 500 });
    },
  ]);
  return calls;
}

function cloudflareOk() {
  const calls = [];
  network.push([
    'api.cloudflare.com',
    async (url, init) => {
      calls.push({ url, method: init.method });
      return Response.json({ success: true, result: {} });
    },
  ]);
  return calls;
}

function cellAnswers(healthy) {
  network.push([
    '.cloud.maude.sh/health',
    async () =>
      healthy
        ? Response.json({ ok: true })
        : new Response('no', { status: 503 }),
  ]);
}

async function throughCheckout(env, session) {
  await worker.fetch(
    post('/projects/new', session, { name: 'Zkušební tým', plan: 'project', interval: 'monthly' }),
    env
  );
  return worker.fetch(
    get('/checkout/return?project=zkusebni-tym&session_id=cs_test_1', session),
    env
  );
}

// ------------------------------------------------------------------- wizard

test('the wizard requires sign-in and renders the catalog', async () => {
  const { env } = await freshEnv();
  const anon = await worker.fetch(get('/projects/new'), env);
  assert.equal(anon.status, 303);
  assert.equal(anon.headers.get('location'), '/login');

  const session = await signedIn(env);
  const res = await worker.fetch(get('/projects/new', session), env);
  const body = await res.text();
  assert.match(body, /Start a project/);
  assert.match(body, /Cloud Project/);
  assert.match(body, /14 days are free/);
});

test('submitting the wizard creates NO project row — only a Checkout redirect', async () => {
  const { env, sqlite } = await freshEnv();
  const calls = stripeHappy();
  const session = await signedIn(env);
  const res = await worker.fetch(
    post('/projects/new', session, { name: 'Zkušební tým', plan: 'project', interval: 'monthly' }),
    env
  );
  assert.equal(res.status, 303);
  assert.match(res.headers.get('location'), /checkout\.stripe\.com/);
  // An abandoned checkout must not squat the address.
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM projects').get().n, 0);
  // The session asked Stripe for a TRIAL — nothing chargeable today.
  const created = calls.find((c) => c.url.endsWith('/v1/checkout/sessions'));
  assert.equal(created.body['subscription_data[trial_period_days]'], '14');
  assert.equal(created.body.payment_method_collection, 'always');
});

test('a taken address is refused with a sentence, not an exception', async () => {
  const { env, sqlite } = await freshEnv();
  stripeHappy();
  const session = await signedIn(env);
  const owner = sqlite.prepare('SELECT id FROM accounts').get().id;
  sqlite
    .prepare(
      `INSERT INTO projects (id, account_id, name, state, state_since, created_at)
       VALUES ('zkusebni-tym', ?, 'X', 'active', 1, 1)`
    )
    .run(owner);
  const res = await worker.fetch(
    post('/projects/new', session, { name: 'Zkušební tým', plan: 'project', interval: 'monthly' }),
    env
  );
  assert.equal(res.status, 409);
  assert.match(await res.text(), /already someone/);
});

// ------------------------------------------------------------------- return

test('the return writes the project + attempt and routes the address', async () => {
  const { env, sqlite } = await freshEnv();
  stripeHappy();
  const cf = cloudflareOk();
  const session = await signedIn(env);
  const res = await throughCheckout(env, session);
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('location'), '/projects/zkusebni-tym/setup');

  const project = sqlite.prepare('SELECT * FROM projects').get();
  assert.equal(project.id, 'zkusebni-tym');
  assert.equal(project.state, 'pending');
  assert.equal(project.subscription_id, 'sub_1');
  const attempt = sqlite.prepare('SELECT * FROM checkout_attempts').get();
  assert.equal(attempt.payment, 'authorized');
  assert.equal(cf.length, 1, 'the hostname was routed');
});

test("a session that is not this customer's writes nothing", async () => {
  const { env, sqlite } = await freshEnv();
  network.push([
    'api.stripe.com',
    async (url) =>
      url.includes('/v1/checkout/sessions/cs_test_1')
        ? Response.json({
            id: 'cs_test_1',
            status: 'complete',
            customer: 'cus_SOMEBODY_ELSE',
            subscription: 'sub_1',
            metadata: { project_id: 'zkusebni-tym' },
          })
        : Response.json({ id: 'cus_1' }),
  ]);
  cloudflareOk();
  const session = await signedIn(env);
  const res = await worker.fetch(
    get('/checkout/return?project=zkusebni-tym&session_id=cs_test_1', session),
    env
  );
  assert.equal(res.status, 404);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM projects').get().n, 0);
});

// ------------------------------------------------------------- waiting room

test('a healthy workspace settles the promise: charged, active, told plainly', async () => {
  const { env, sqlite } = await freshEnv();
  stripeHappy();
  cloudflareOk();
  cellAnswers(true);
  const session = await signedIn(env);
  await throughCheckout(env, session);

  const res = await worker.fetch(get('/projects/zkusebni-tym/setup', session), env);
  const body = await res.text();
  assert.match(body, /is ready/);
  assert.match(body, /Open your project/);
  assert.equal(sqlite.prepare('SELECT payment FROM checkout_attempts').get().payment, 'charged');
  assert.equal(sqlite.prepare('SELECT state FROM projects').get().state, 'active');
});

test('a workspace still booting keeps waiting — with the not-charged answer on screen', async () => {
  const { env, sqlite } = await freshEnv();
  stripeHappy();
  cloudflareOk();
  cellAnswers(false);
  const session = await signedIn(env);
  await throughCheckout(env, session);

  const res = await worker.fetch(get('/projects/zkusebni-tym/setup', session), env);
  const body = await res.text();
  assert.match(body, /has not been charged/);
  assert.match(body, /http-equiv="refresh"/);
  assert.equal(sqlite.prepare('SELECT payment FROM checkout_attempts').get().payment, 'authorized');
});

test('a timeout VOIDS: the subscription is cancelled and the person is told', async () => {
  const { env, sqlite } = await freshEnv();
  const stripeCalls = stripeHappy();
  cloudflareOk();
  cellAnswers(false);
  const session = await signedIn(env);
  await throughCheckout(env, session);
  // Age the authorization past the window.
  sqlite.prepare('UPDATE checkout_attempts SET authorized_at = 1').run();

  const res = await worker.fetch(get('/projects/zkusebni-tym/setup', session), env);
  const body = await res.text();
  assert.match(body, /released|not been charged/);
  assert.equal(sqlite.prepare('SELECT payment FROM checkout_attempts').get().payment, 'voided');
  assert.equal(sqlite.prepare('SELECT state FROM projects').get().state, 'suspended');
  const cancel = stripeCalls.find((c) => c.method === 'DELETE');
  assert.match(cancel.url, /\/v1\/subscriptions\/sub_1/);
});

test('a settled attempt is never settled again — the void is idempotent', async () => {
  const { env, sqlite } = await freshEnv();
  const stripeCalls = stripeHappy();
  cloudflareOk();
  cellAnswers(false);
  const session = await signedIn(env);
  await throughCheckout(env, session);
  sqlite.prepare('UPDATE checkout_attempts SET authorized_at = 1').run();
  await worker.fetch(get('/projects/zkusebni-tym/setup', session), env);
  const cancelsAfterFirst = stripeCalls.filter((c) => c.method === 'DELETE').length;
  await worker.fetch(get('/projects/zkusebni-tym/setup', session), env);
  assert.equal(
    stripeCalls.filter((c) => c.method === 'DELETE').length,
    cancelsAfterFirst,
    'the second visit must not cancel again'
  );
});

// ---------------------------------------------------------------- billing

test('billing shows the situation and hands the owner to the portal', async () => {
  const { env, sqlite } = await freshEnv();
  const stripeCalls = stripeHappy();
  cloudflareOk();
  cellAnswers(true);
  const session = await signedIn(env);
  await throughCheckout(env, session);

  const pageRes = await worker.fetch(get('/projects/zkusebni-tym/billing', session), env);
  assert.match(await pageRes.text(), /Manage billing at Stripe/);

  const portal = await worker.fetch(post('/projects/zkusebni-tym/billing/portal', session, {}), env);
  assert.equal(portal.status, 303);
  assert.match(portal.headers.get('location'), /billing\.stripe\.com/);
  const created = stripeCalls.find((c) => c.url.includes('billing_portal'));
  assert.equal(created.body.customer, 'cus_1');
});

test('billing is the owner’s alone — a member sees the same 404 as a stranger', async () => {
  const { env, sqlite } = await freshEnv();
  stripeHappy();
  cloudflareOk();
  cellAnswers(true);
  const session = await signedIn(env);
  await throughCheckout(env, session);

  const other = await worker.fetch(
    new Request('https://cloud.test/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: form({ email: 'member@example.com', password: PASSWORD, disclosure: 'yes' }),
    }),
    env
  );
  const memberSession = /maude_session=([^;]+)/.exec(other.headers.get('set-cookie'))?.[1];
  const memberId = sqlite.prepare("SELECT id FROM accounts WHERE email = 'member@example.com'").get().id;
  sqlite
    .prepare("INSERT INTO project_members (project_id, account_id, role, added_at) VALUES ('zkusebni-tym', ?, 'member', 1)")
    .run(memberId);

  const res = await worker.fetch(get('/projects/zkusebni-tym/billing', memberSession), env);
  assert.equal(res.status, 404);
});

// ---------------------------------------------------------------- strings

test('the checkout pages ship no script and no vocabulary of ours', () => {
  const html = allCheckoutHtml({ pricing: loadPricing() });
  assert.ok(!/<script/i.test(html));
  assert.ok(!/\son[a-z]+\s*=/i.test(html));
  for (const jargon of ['tenant', 'cell', 'provision', 'webhook', 'container']) {
    assert.ok(!new RegExp(`\\b${jargon}`, 'i').test(html), `"${jargon}" leaked into checkout`);
  }
});
