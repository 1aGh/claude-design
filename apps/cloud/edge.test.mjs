// The plane's edge — validate 2026-07-30.
//
// These assert the LAYER, not the individual routes: that a header floor
// reaches every answer, that a route can tighten but not forget it, and that
// the expensive paths have a budget. The three findings that produced this
// module were symptoms of there being no such layer.

import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';

import { d1FromSqlite } from './db.mjs';
import { costOf, formActionPermits, harden, isHtml, sameSiteGate, spend } from './edge.mjs';
import { applySchema } from './migrate.mjs';
import { SCHEMA_SQL } from './schema.mjs';
import worker from './worker.mjs';

const form = (f) => new URLSearchParams(f).toString();

async function freshEnv(extra = {}) {
  const sqlite = new DatabaseSync(':memory:');
  const DB = d1FromSqlite(sqlite);
  await applySchema(DB, SCHEMA_SQL);
  return { env: { DB, CELL_SECRET_MASTER: 'master', ...extra }, sqlite };
}

// ------------------------------------------------------------------ headers

test('every answer carries the header floor — including the page with the password field', async () => {
  const { env } = await freshEnv();
  for (const path of ['/', '/login', '/signup']) {
    const res = await worker.fetch(new Request(`https://cloud.test${path}`), env);
    assert.equal(res.headers.get('x-frame-options'), 'DENY', `${path} must refuse framing`);
    assert.equal(res.headers.get('referrer-policy'), 'no-referrer', path);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff', path);
    assert.match(
      res.headers.get('content-security-policy') ?? '',
      /frame-ancestors 'none'/,
      `${path} must carry a CSP`
    );
  }
});

test('a route may TIGHTEN the floor and its value survives', () => {
  const strict = new Response('<p>hi</p>', {
    headers: {
      'content-type': 'text/html',
      'content-security-policy': "default-src 'none'",
    },
  });
  const out = harden(strict, { url: new URL('https://cloud.test/'), html: true });
  assert.equal(out.headers.get('content-security-policy'), "default-src 'none'");
  assert.equal(out.headers.get('x-frame-options'), 'DENY', 'and still gains what it omitted');
});

// The whole funnel ends at a form that hands off to Stripe. `form-action 'self'`
// blocked that hand-off in the browser while every server-side test stayed
// green — nobody could buy anything, and the page reported nothing. These pin
// both halves: the hand-off is possible, and the door is still narrow.
test('a form may hand off to Stripe — the redirect is part of form-action', () => {
  const csp = harden(new Response('<p>hi</p>', { headers: { 'content-type': 'text/html' } }), {
    url: new URL('https://cloud.test/'),
    html: true,
  }).headers.get('content-security-policy');

  assert.match(csp, /form-action [^;]*https:\/\/checkout\.stripe\.com/);
  assert.match(csp, /form-action [^;]*https:\/\/billing\.stripe\.com/);
  assert.ok(formActionPermits('https://checkout.stripe.com/c/pay/cs_test_1'));
  assert.ok(formActionPermits('https://billing.stripe.com/p/session/x'));
  assert.ok(formActionPermits('/projects/acme/setup'), 'our own paths, always');
});

test('form-action stays a narrow allowlist, not a hole', () => {
  const csp = harden(new Response('<p>hi</p>', { headers: { 'content-type': 'text/html' } }), {
    url: new URL('https://cloud.test/'),
    html: true,
  }).headers.get('content-security-policy');
  const directive = csp.match(/form-action ([^;]*)/)[1];

  assert.doesNotMatch(directive, /\*/, 'no wildcard host — the point is that the list is short');
  assert.doesNotMatch(directive, /unsafe/, 'nothing unsafe belongs in a form target');
  // The attack this directive exists to stop: an injected form posting the
  // session cookie somewhere we never chose.
  assert.equal(formActionPermits('https://evil.example/collect'), false);
  assert.equal(formActionPermits('https://checkout.stripe.com.evil.example/'), false);
  assert.equal(formActionPermits('//evil.example/collect'), false, 'protocol-relative is not ours');
});

test('HSTS is stamped on https and withheld on http', () => {
  const mk = () => new Response('{}', { headers: { 'content-type': 'application/json' } });
  assert.ok(
    harden(mk(), { url: new URL('https://cloud.test/') }).headers.get('strict-transport-security')
  );
  assert.equal(
    harden(mk(), { url: new URL('http://127.0.0.1:8787/') }).headers.get(
      'strict-transport-security'
    ),
    null,
    'a local http origin must not be pinned to https'
  );
});

test('isHtml only claims documents', () => {
  assert.equal(
    isHtml(new Response('', { headers: { 'content-type': 'text/html; charset=utf-8' } })),
    true
  );
  assert.equal(
    isHtml(new Response('', { headers: { 'content-type': 'application/json' } })),
    false
  );
});

// ---------------------------------------------------------------- same-site

test('the same-site gate refuses a sibling subdomain but never a non-browser client', () => {
  const url = new URL('https://cloud.test/projects/x/handoff');
  const mk = (site) =>
    new Request(url, { method: 'POST', headers: site ? { 'sec-fetch-site': site } : {} });
  assert.equal(sameSiteGate(mk('cross-site'), url), false);
  assert.equal(sameSiteGate(mk('same-site'), url), false, 'a workspace subdomain IS same-site');
  assert.equal(sameSiteGate(mk('same-origin'), url), true);
  assert.equal(sameSiteGate(mk(null), url), true, 'the app and the CLI send no such header');
  const get = new Request(url, { headers: { 'sec-fetch-site': 'cross-site' } });
  assert.equal(sameSiteGate(get, url), true, 'reads are not state changes');
});

test('the derived-secret lanes are exempt — they never trusted a cookie', () => {
  const url = new URL('https://cloud.test/internal/mirror-token');
  const req = new Request(url, { method: 'POST', headers: { 'sec-fetch-site': 'cross-site' } });
  assert.equal(sameSiteGate(req, url), true);
});

// ------------------------------------------------------------------ budgets

test('the expensive paths have a budget and everything else is exempt', () => {
  assert.equal(costOf('/auth/login', 'POST')?.cost, 'login');
  assert.equal(costOf('/auth/signup', 'POST')?.cost, 'signup');
  assert.equal(costOf('/auth/device/code', 'POST')?.cost, 'device');
  assert.equal(costOf('/auth/handoff/exchange', 'POST')?.cost, 'handoff');
  assert.equal(costOf('/auth/login', 'GET'), null, 'reading the page is free');
  assert.equal(costOf('/health', 'GET'), null);
});

test('a flood on login is refused BEFORE the password is ever verified', async () => {
  const { env } = await freshEnv();
  const attempt = () =>
    worker.fetch(
      new Request('https://cloud.test/auth/login', {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'cf-connecting-ip': '203.0.113.9',
        },
        body: form({ email: 'nobody@example.com', password: 'guessing' }),
      }),
      env
    );

  let sawLimit = false;
  for (let i = 0; i < 14; i++) {
    const res = await attempt();
    if (res.status === 429) {
      sawLimit = true;
      break;
    }
  }
  assert.ok(sawLimit, 'the budget must bite within a dozen attempts');

  // A DIFFERENT client is unaffected — the budget is per client, not global.
  const other = await worker.fetch(
    new Request('https://cloud.test/auth/login', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'cf-connecting-ip': '198.51.100.4',
      },
      body: form({ email: 'nobody@example.com', password: 'guessing' }),
    }),
    env
  );
  assert.equal(other.status, 401, 'one flood must not lock everybody out');
});

test('one path’s flood does not spend another path’s budget', async () => {
  const { env } = await freshEnv();
  const ip = { 'cf-connecting-ip': '203.0.113.10' };
  for (let i = 0; i < 12; i++) {
    await worker.fetch(
      new Request('https://cloud.test/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', ...ip },
        body: form({ email: 'a@b.co', password: 'x' }),
      }),
      env
    );
  }
  const device = await worker.fetch(
    new Request('https://cloud.test/auth/device/code', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...ip },
      body: JSON.stringify({ client: 'probe' }),
    }),
    env
  );
  assert.equal(device.status, 200, 'a separate cost class keeps its own budget');
});

test('an unreachable limiter fails OPEN — storage trouble must not lock the door', async () => {
  const broken = {
    DB: {
      prepare() {
        throw new Error('D1 unreachable');
      },
    },
  };
  const verdict = await spend(
    broken,
    new Request('https://cloud.test/'),
    costOf('/auth/login', 'POST')
  );
  assert.equal(verdict.ok, true);
  assert.equal(verdict.limiter, 'unavailable');
});

test('a native limiter binding is preferred and D1 is never touched', async () => {
  let d1Touched = false;
  const env = {
    RATE_LIMITER: { limit: async () => ({ success: false }) },
    DB: {
      prepare() {
        d1Touched = true;
        throw new Error('should not be reached');
      },
    },
  };
  const verdict = await spend(
    env,
    new Request('https://cloud.test/'),
    costOf('/auth/login', 'POST')
  );
  assert.equal(verdict.ok, false);
  assert.equal(verdict.limiter, 'binding');
  assert.equal(d1Touched, false);
});
