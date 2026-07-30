// Self-administration round trips — Cloud Phase 20 (+ Phase 19 settings).

import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { after, before, beforeEach, test } from 'node:test';

import { d1FromSqlite } from './db.mjs';
import { applySchema } from './migrate.mjs';
import { allProjectAdminHtml, exportGenerations, parseExportKey } from './project-admin.mjs';
import { SCHEMA_SQL } from './schema.mjs';
import worker from './worker.mjs';

const PASSWORD = 'a-long-enough-password';
const realFetch = globalThis.fetch;

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

/** An in-memory R2 binding — list + get over a Map. */
function fakeExports(objects = new Map()) {
  return {
    objects,
    async list({ prefix }) {
      return {
        objects: [...objects.entries()]
          .filter(([k]) => k.startsWith(prefix))
          .map(([key, body]) => ({ key, size: body.length })),
      };
    },
    async get(key) {
      return objects.has(key) ? { body: objects.get(key) } : null;
    },
  };
}

async function freshEnv(extra = {}) {
  const sqlite = new DatabaseSync(':memory:');
  const DB = d1FromSqlite(sqlite);
  await applySchema(DB, SCHEMA_SQL);
  return {
    env: {
      DB,
      CELL_SECRET_MASTER: 'master',
      STRIPE_SECRET_KEY: 'sk_test_x',
      CF_PROVISION_TOKEN: 'cf',
      CF_ACCOUNT_ID: 'acct',
      CF_ZONE_ID: 'zone',
      EXPORTS: fakeExports(),
      ...extra,
    },
    sqlite,
  };
}

function form(fields) {
  return new URLSearchParams(fields).toString();
}

async function ownerWithProject(env, sqlite) {
  const res = await worker.fetch(
    new Request('https://cloud.test/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: form({ email: 'owner@example.com', password: PASSWORD, disclosure: 'yes' }),
    }),
    env
  );
  const session = /maude_session=([^;]+)/.exec(res.headers.get('set-cookie'))?.[1];
  const ownerId = sqlite.prepare('SELECT id FROM accounts').get().id;
  sqlite
    .prepare(
      `INSERT INTO projects (id, account_id, name, state, state_since, subscription_id, created_at)
       VALUES ('alligators', ?, 'Brno Alligators', 'active', 1, 'sub_1', 1)`
    )
    .run(ownerId);
  return { session };
}

const get = (path, session) =>
  new Request(`https://cloud.test${path}`, {
    headers: session ? { cookie: `maude_session=${session}` } : {},
  });
const post = (path, session, fields = {}) =>
  new Request(`https://cloud.test${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      cookie: `maude_session=${session}`,
    },
    body: form(fields),
  });

function seedExport(env, stamp = '20260730T120000Z') {
  for (const name of ['repo.bundle', 'assets.json', 'MANIFEST.md']) {
    env.EXPORTS.objects.set(`tenants/alligators/exports/${stamp}/${name}`, `body-of-${name}`);
  }
}

// ------------------------------------------------------------------ download

test('preparing a copy asks the cell with an owner credential and lists the result', async () => {
  const { env, sqlite } = await freshEnv();
  const cellCalls = [];
  network.push([
    'alligators.cloud.maude.sh/api/export',
    async (url, init) => {
      cellCalls.push(init.headers.authorization);
      seedExport(env);
      return Response.json({ ok: true, stamp: '20260730T120000Z', prefix: 'tenants/alligators/exports/20260730T120000Z/', files: [] });
    },
  ]);
  const { session } = await ownerWithProject(env, sqlite);
  const res = await worker.fetch(post('/projects/alligators/download', session), env);
  const body = await res.text();
  assert.equal(res.status, 200);
  assert.match(body, /Your copy is ready below/);
  assert.match(body, /repo\.bundle/);
  assert.equal(cellCalls.length, 1);
  assert.match(cellCalls[0], /^Bearer .+\..+$/);
  assert.ok(sqlite.prepare('SELECT export_sent_at FROM projects').get().export_sent_at > 0);
});

test('a file downloads only inside the export prefix, only for the owner', async () => {
  const { env, sqlite } = await freshEnv();
  seedExport(env);
  const { session } = await ownerWithProject(env, sqlite);

  const good = await worker.fetch(
    get('/projects/alligators/download/file?g=20260730T120000Z&f=repo.bundle', session),
    env
  );
  assert.equal(good.status, 200);
  assert.match(good.headers.get('content-disposition'), /repo\.bundle/);

  // Traversal out of the export namespace is refused by shape, not by lookup.
  env.EXPORTS.objects.set('tenants/alligators/assets/photo.jpg', 'x');
  const escape = await worker.fetch(
    get('/projects/alligators/download/file?g=..%2F..%2Fassets&f=photo.jpg', session),
    env
  );
  assert.equal(escape.status, 404);

  // Another project's export cannot be addressed at all — the project id in
  // the key comes from the PATH, which access control already gated.
  env.EXPORTS.objects.set('tenants/other/exports/20260730T120000Z/repo.bundle', 'x');
  const cross = await worker.fetch(
    get('/projects/other/download/file?g=20260730T120000Z&f=repo.bundle', session),
    env
  );
  assert.equal(cross.status, 404);
});

// -------------------------------------------------------------------- delete

test('delete without an export is redirected to the download, and writes nothing', async () => {
  const { env, sqlite } = await freshEnv();
  const { session } = await ownerWithProject(env, sqlite);
  const page = await worker.fetch(get('/projects/alligators/delete', session), env);
  assert.match(await page.text(), /Download your copy first/);

  const attempt = await worker.fetch(post('/projects/alligators/delete', session, { sure: 'yes' }), env);
  assert.equal(attempt.status, 409);
  assert.equal(sqlite.prepare('SELECT state FROM projects').get().state, 'active');
});

test('delete with an export stops billing first, then purges, then detaches the address', async () => {
  const { env, sqlite } = await freshEnv();
  seedExport(env);
  const order = [];
  network.push([
    'api.stripe.com',
    async (url, init) => {
      order.push(`stripe:${init.method}`);
      return Response.json({ id: 'sub_1', status: 'canceled' });
    },
  ]);
  network.push([
    'api.cloudflare.com',
    async (url, init) => {
      order.push(`cf:${init.method ?? 'GET'}`);
      if ((init.method ?? 'GET') === 'GET') {
        return Response.json({ success: true, result: [{ id: 'dom1', hostname: 'alligators.cloud.maude.sh' }] });
      }
      return Response.json({ success: true, result: {} });
    },
  ]);
  const { session } = await ownerWithProject(env, sqlite);
  const res = await worker.fetch(post('/projects/alligators/delete', session, { sure: 'yes' }), env);
  assert.equal(res.status, 303);
  assert.equal(sqlite.prepare('SELECT state FROM projects').get().state, 'purged');
  assert.equal(order[0], 'stripe:DELETE', 'billing stops before anything else');
  assert.ok(order.includes('cf:DELETE'), 'the address was detached');
});

test('when billing cannot be stopped, NOTHING is deleted', async () => {
  const { env, sqlite } = await freshEnv();
  seedExport(env);
  network.push(['api.stripe.com', async () => new Response('down', { status: 500 })]);
  const { session } = await ownerWithProject(env, sqlite);
  const res = await worker.fetch(post('/projects/alligators/delete', session, { sure: 'yes' }), env);
  assert.equal(res.status, 502);
  assert.equal(sqlite.prepare('SELECT state FROM projects').get().state, 'active');
});

// --------------------------------------------------------------------- audit

test('the activity page shows entries in the customer’s language', async () => {
  const { env, sqlite } = await freshEnv();
  const { session } = await ownerWithProject(env, sqlite);
  sqlite
    .prepare(
      `INSERT INTO audit_log (id, project_id, at, actor, action) VALUES
       ('a1', 'alligators', 1753872000000, 'customer:owner@example.com', 'checkout.settled'),
       ('a2', 'alligators', 1753872100000, 'system', 'reconcile')`
    )
    .run();
  const res = await worker.fetch(get('/projects/alligators/audit', session), env);
  const body = await res.text();
  assert.match(body, /Project came up — billing began/);
  assert.match(body, /Routine platform check/);
  assert.ok(!/checkout\.settled/.test(body), 'internal action names stay internal');
});

// -------------------------------------------------------------------- mirror

test('the mirror settings save a validated target and the cell can then read it', async () => {
  const { env, sqlite } = await freshEnv();
  const { session } = await ownerWithProject(env, sqlite);
  const res = await worker.fetch(
    post('/projects/alligators/mirror', session, { do: 'save', repository: '1aGh/alligators-mirror', branch: 'main' }),
    env
  );
  assert.match(await res.text(), /The first push happens within the hour/);
  assert.equal(sqlite.prepare('SELECT mirror_repo FROM projects').get().mirror_repo, '1aGh/alligators-mirror');

  // The cell's side of the same fact: /internal/mirror-config with the derived secret.
  const { deriveCellSecret } = await import('./cell-token.mjs');
  const secret = await deriveCellSecret('master', 'alligators');
  const config = await worker.fetch(
    new Request('https://cloud.test/internal/mirror-config?tenant=alligators', {
      headers: { authorization: `Bearer ${secret}` },
    }),
    env
  );
  assert.deepEqual(await config.json(), { repository: '1aGh/alligators-mirror', branch: 'main' });

  // A wrong secret learns nothing.
  const refused = await worker.fetch(
    new Request('https://cloud.test/internal/mirror-config?tenant=alligators', {
      headers: { authorization: 'Bearer wrong' },
    }),
    env
  );
  assert.equal(refused.status, 401);
});

test('a URL pasted as the repository is refused with the sentence that fixes it', async () => {
  const { env, sqlite } = await freshEnv();
  const { session } = await ownerWithProject(env, sqlite);
  const res = await worker.fetch(
    post('/projects/alligators/mirror', session, { do: 'save', repository: 'https://github.com/x/y' }),
    env
  );
  assert.equal(res.status, 400);
  assert.match(await res.text(), /owner\/name/);
});

// --------------------------------------------------------------- pure pieces

test('parseExportKey accepts exactly the export namespace', () => {
  assert.ok(parseExportKey('tenants/alligators/exports/20260730T120000Z/repo.bundle', 'alligators'));
  assert.equal(parseExportKey('tenants/alligators/assets/x.jpg', 'alligators'), null);
  assert.equal(parseExportKey('tenants/other/exports/20260730T120000Z/repo.bundle', 'alligators'), null);
  assert.equal(parseExportKey('tenants/alligators/exports/../../secrets', 'alligators'), null);
});

test('exportGenerations groups by stamp, newest first', () => {
  const gens = exportGenerations(
    [
      { key: 'tenants/p/exports/20260729T000000Z/repo.bundle', size: 10 },
      { key: 'tenants/p/exports/20260730T000000Z/repo.bundle', size: 20 },
      { key: 'tenants/p/exports/20260730T000000Z/MANIFEST.md', size: 1 },
    ],
    'p'
  );
  assert.equal(gens.length, 2);
  assert.equal(gens[0].stamp, '20260730T000000Z');
  assert.equal(gens[0].bytes, 21);
});

// ------------------------------------------------------------------- strings

test('the admin pages ship no script and no vocabulary of ours', () => {
  const html = allProjectAdminHtml();
  assert.ok(!/<script/i.test(html));
  assert.ok(!/\son[a-z]+\s*=/i.test(html));
  for (const jargon of ['tenant', 'cell', 'token', 'container', 'provision', 'webhook', 'purge']) {
    assert.ok(!new RegExp(`\\b${jargon}(?!s\\/)`, 'i').test(html), `"${jargon}" leaked into the admin pages`);
  }
});

// ------------------------------------------------------------------ connect

test('Open leads to the connect page, which is honest about the two ways in', async () => {
  const { env, sqlite } = await freshEnv();
  const { session } = await ownerWithProject(env, sqlite);
  const res = await worker.fetch(get('/projects/alligators/connect', session), env);
  assert.equal(res.status, 200);
  const body = await res.text();
  assert.match(body, /Open Brno Alligators/);
  assert.match(body, /alligators\.cloud\.maude\.sh/);
  assert.match(body, /workspace email and password/);
  assert.match(body, /Link workspace/);

  const anon = await worker.fetch(get('/projects/alligators/connect'), env);
  assert.equal(anon.status, 303, 'a stranger is sent to sign in');
});
