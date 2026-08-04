// Cloud Phase 26 Stage 2 — the analytics effects layer.
//
// Two properties matter more than any figure this module produces: `track`
// must never fail a request, and it must never delay one. Analytics that can
// take the product down is worse than no analytics — so most of what follows
// is about the module misbehaving and the request surviving anyway.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  boardMetrics,
  DATASET,
  isSampled,
  queryEvents,
  totalContent,
  track,
} from './analytics.mjs';
import { d1FromSqlite } from './db.mjs';
import { MIGRATIONS } from './migrate.mjs';
import worker from './worker.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const SCHEMA = readFileSync(join(here, 'schema.sql'), 'utf8');

function sink() {
  const written = [];
  return {
    written,
    env: { EVENTS: { writeDataPoint: (dp) => written.push(dp) } },
  };
}

const deferred = () => {
  const waited = [];
  return { waited, ctx: { waitUntil: (p) => waited.push(p) } };
};

// -------------------------------------------------------------- never fails

describe('track can never fail a request', () => {
  it('no-ops when the binding is absent, which is every local test run', () => {
    // Without this, adding an event anywhere would redden every suite that
    // does not build a fake AE.
    assert.equal(track({}, null, { name: 'invite_created' }), false);
    assert.equal(track({ EVENTS: {} }, null, { name: 'invite_created' }), false);
    assert.equal(track(undefined, null, { name: 'invite_created' }), false);
  });

  it('swallows a throwing writeDataPoint', () => {
    const env = {
      EVENTS: {
        writeDataPoint() {
          throw new Error('AE is having a day');
        },
      },
    };
    const { ctx, waited } = deferred();
    assert.doesNotThrow(() => track(env, ctx, { name: 'invite_created' }));
    return Promise.all(waited); // and the deferred write settles rather than rejecting
  });

  it('drops an invalid event instead of throwing at the call site', () => {
    const { env, written } = sink();
    assert.equal(track(env, null, { name: 'not_a_real_event' }), false);
    assert.equal(track(env, null, { name: 'login', accountId: 'a@example.com' }), false);
    assert.equal(written.length, 0);
  });
});

describe('track never blocks a request', () => {
  it('hands the write to waitUntil rather than awaiting it', () => {
    const { env, written } = sink();
    const { ctx, waited } = deferred();
    assert.equal(
      track(env, ctx, { name: 'login', accountId: 'acct_1', props: { method: 'password' } }),
      true
    );
    assert.equal(waited.length, 1, 'the write was deferred');
    assert.ok(waited[0] instanceof Promise);
    // Already recorded — writeDataPoint is synchronous in Workers; waitUntil
    // is what keeps a future async sink off the response path.
    assert.equal(written.length, 1);
  });

  it('still records when there is no ctx — the cron has none', () => {
    const { env, written } = sink();
    assert.equal(track(env, null, { name: 'project_provisioned', projectId: 'x' }), true);
    assert.equal(written.length, 1);
  });

  it('writes the vocabulary’s datapoint shape, and no email anywhere in it', () => {
    const { env, written } = sink();
    track(env, null, {
      name: 'signup',
      accountId: 'acct_deadbeef',
      props: { method: 'google' },
    });
    const [dp] = written;
    assert.deepEqual(dp.indexes, ['signup']);
    assert.deepEqual(dp.blobs, ['acct_deadbeef', '', 'google']);
    assert.ok(!JSON.stringify(dp).includes('@'), 'no address may reach a datapoint');
  });
});

// -------------------------------------------------------------------- reads

describe('queryEvents', () => {
  const connected = { CF_ACCOUNT_ID: 'acct-cf', CF_ANALYTICS_TOKEN: 'tok' };

  it('an unset token is a deployment state, not an error', () => {
    // The board renders "not connected" from this; a throw here would take
    // down the page an operator opens during an outage.
    return Promise.all([
      queryEvents({}, 'SELECT 1').then((r) =>
        assert.deepEqual(r, { ok: false, reason: 'not-connected' })
      ),
      queryEvents({ CF_ACCOUNT_ID: 'x' }, 'SELECT 1').then((r) => assert.equal(r.ok, false)),
      queryEvents({ CF_ANALYTICS_TOKEN: 'x' }, 'SELECT 1').then((r) => assert.equal(r.ok, false)),
    ]);
  });

  it('posts the SQL with the token, to the account’s own endpoint', async () => {
    let seen = null;
    await queryEvents(connected, 'SELECT 1', {
      fetchImpl: async (url, init) => {
        seen = { url, init };
        return new Response(JSON.stringify({ data: [{ n: 1 }] }), { status: 200 });
      },
    });
    assert.match(seen.url, /accounts\/acct-cf\/analytics_engine\/sql$/);
    assert.equal(seen.init.headers.authorization, 'Bearer tok');
    assert.equal(seen.init.body, 'SELECT 1');
  });

  it('turns an HTTP failure and a network failure into the same quiet refusal', async () => {
    const http = await queryEvents(connected, 'SELECT 1', {
      fetchImpl: async () => new Response('nope', { status: 403 }),
    });
    assert.deepEqual(http, { ok: false, reason: 'HTTP 403' });

    const dead = await queryEvents(connected, 'SELECT 1', {
      fetchImpl: async () => {
        throw new Error('connect ECONNREFUSED');
      },
    });
    assert.equal(dead.ok, false);
    assert.match(dead.reason, /ECONNREFUSED/);
  });

  it('queries the dataset the binding writes to', () => {
    assert.equal(DATASET, 'maude_cloud_events');
  });
});

describe('sampling is disclosed rather than hidden', () => {
  it('spots a sampled window', () => {
    // A count read off a sampled window is an ESTIMATE. A number that silently
    // changes meaning at scale is worse than one that says which it is.
    assert.equal(isSampled([{ _sample_interval: 1 }]), false);
    assert.equal(isSampled([{ _sample_interval: 1 }, { _sample_interval: 4 }]), true);
    assert.equal(isSampled([]), false);
    assert.equal(isSampled(undefined), false);
  });
});

describe('boardMetrics', () => {
  const connected = { CF_ACCOUNT_ID: 'a', CF_ANALYTICS_TOKEN: 't' };

  it('reports not-connected rather than zeroes when it cannot read', async () => {
    const m = await boardMetrics({});
    assert.equal(m.ok, false);
    assert.equal(m.reason, 'not-connected');
  });

  it('reads the active-account counts and the funnel', async () => {
    const answers = [
      { data: [{ dau: 3, wau: 8, mau: 20, _sample_interval: 1 }] },
      { data: [{ name: 'login', count: 40 }] },
      { data: [{ name: 'signup', count: 5 }] },
    ];
    let i = 0;
    const m = await boardMetrics(connected, {
      fetchImpl: async () => new Response(JSON.stringify(answers[i++]), { status: 200 }),
    });
    assert.equal(m.ok, true);
    assert.equal(m.dau, 3);
    assert.equal(m.mau, 20);
    assert.equal(m.signups, 5);
    // Nothing came back for completed checkouts, which is not the same as
    // zero having happened.
    assert.equal(m.checkouts, null);
    assert.deepEqual(m.byName, [{ name: 'login', count: 40 }]);
    assert.equal(m.sampled, false);
  });

  it('never emails anyone — the SQL groups by an account-id blob', async () => {
    const queries = [];
    await boardMetrics(connected, {
      fetchImpl: async (_url, init) => {
        queries.push(init.body);
        return new Response(JSON.stringify({ data: [] }), { status: 200 });
      },
    });
    const all = queries.join('\n');
    assert.match(all, /COUNT\(DISTINCT blob1\)/);
    assert.doesNotMatch(all, /email/i);
  });
});

// ------------------------------------------------------------ unknown ≠ zero

describe('totalContent keeps unknown out of the sums', () => {
  it('an empty map is null — nothing has reported, which is not "zero canvases"', () => {
    assert.equal(totalContent(null), null);
    assert.equal(totalContent(new Map()), null);
  });

  it('sums only what was actually reported', () => {
    const total = totalContent(
      new Map([
        ['a', { canvases: 10, artboards: 30, designSystems: 1, assetsBytes: 100 }],
        // This one predates the counter: it reported canvases and nothing else.
        ['b', { canvases: 5, artboards: null, designSystems: null, assetsBytes: null }],
      ])
    );
    assert.equal(total.canvases, 15);
    assert.equal(total.artboards, 30);
    assert.equal(total.assetsBytes, 100);
  });

  it('a measure no project reported stays null rather than becoming 0', () => {
    const total = totalContent(new Map([['a', { canvases: 3 }]]));
    assert.equal(total.canvases, 3);
    assert.equal(total.artboards, null);
    assert.equal(total.designSystems, null);
  });
});

// ----------------------------------------------------- through the real worker

describe('the edge is the only collector, and it is unobtrusive', () => {
  async function signedIn({ writeDataPoint } = {}) {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(SCHEMA);
    for (const m of MIGRATIONS) for (const stmt of m.statements) sqlite.exec(stmt);
    sqlite.exec(
      `INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES ${MIGRATIONS.map((m) => `(${m.version}, 0)`).join(',')}`
    );
    const written = [];
    const env = {
      DB: d1FromSqlite(sqlite),
      EVENTS: { writeDataPoint: writeDataPoint ?? ((dp) => written.push(dp)) },
    };
    const res = await worker.fetch(
      new Request('https://cloud.test/auth/signup', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          email: 'owner@example.com',
          password: 'a-very-long-password',
          disclosure: 'yes',
        }),
      }),
      env,
      { waitUntil: (p) => p }
    );
    const session = /maude_session=([^;]+)/.exec(res.headers.get('set-cookie'))?.[1];
    return { env, sqlite, session, written };
  }

  const navigation = (path, session) =>
    new Request(`https://cloud.test${path}`, {
      headers: { cookie: `maude_session=${session}`, accept: 'text/html' },
    });

  it('records the signup itself, with no address in the datapoint', async () => {
    const { written } = await signedIn();
    const signup = written.find((dp) => dp.indexes[0] === 'signup');
    assert.ok(signup, 'the funnel starts here or nowhere');
    assert.deepEqual(signup.blobs.slice(1), ['', 'password']);
    assert.match(signup.blobs[0], /^acct_/);
    assert.ok(!JSON.stringify(written).includes('owner@example.com'));
  });

  it('records a signed-in navigation as a route TEMPLATE', async () => {
    const { env, session, written } = await signedIn();
    written.length = 0;
    await worker.fetch(navigation('/', session), env, { waitUntil: (p) => p });
    const view = written.find((dp) => dp.indexes[0] === 'page_view');
    assert.ok(view);
    assert.equal(view.blobs[2], '/');
  });

  it('does NOT count a machine request as a page view', async () => {
    // The Bearer client API and the cell's /internal/* calls carry no cookie
    // and ask for JSON. Counting them would make every "active accounts"
    // figure a mix of people and cron jobs.
    const { env, session, written } = await signedIn();
    written.length = 0;
    await worker.fetch(
      new Request('https://cloud.test/health', {
        headers: { cookie: `maude_session=${session}` },
      }),
      env,
      { waitUntil: (p) => p }
    );
    assert.equal(written.filter((dp) => dp.indexes[0] === 'page_view').length, 0);
  });

  it('a signed-OUT visitor is not tracked at all', async () => {
    const { env, written } = await signedIn();
    written.length = 0;
    await worker.fetch(
      new Request('https://cloud.test/login', { headers: { accept: 'text/html' } }),
      env,
      { waitUntil: (p) => p }
    );
    assert.equal(written.length, 0);
  });

  it('the request succeeds even when the analytics sink throws on every call', async () => {
    // The property that decides whether this feature is allowed to exist.
    const { env, session } = await signedIn({
      writeDataPoint() {
        throw new Error('AE is down');
      },
    });
    const res = await worker.fetch(navigation('/', session), env, { waitUntil: (p) => p });
    assert.equal(res.status, 200);
    assert.match(await res.text(), /No projects yet/);
  });

  it('the request succeeds with no analytics binding at all', async () => {
    const { env, session } = await signedIn();
    // The shape every deployment without the binding is in, including every
    // `wrangler dev` and every local test suite in this repo.
    const unbound = { ...env, EVENTS: undefined };
    const res = await worker.fetch(navigation('/', session), unbound, { waitUntil: (p) => p });
    assert.equal(res.status, 200);
  });
});
