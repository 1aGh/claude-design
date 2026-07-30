// The one-time browser→app handoff — Cloud Phase 23 B3 / Phase 17.

import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';

import { verifyAccessToken } from '../hub/src/cloud-identity.mjs';
import { deriveCellSecret } from './cell-token.mjs';
import { d1FromSqlite } from './db.mjs';
import { applySchema } from './migrate.mjs';
import { SCHEMA_SQL } from './schema.mjs';
import worker from './worker.mjs';

const PASSWORD = 'a-long-enough-password';
const form = (f) => new URLSearchParams(f).toString();

async function freshEnv(extra = {}) {
  const sqlite = new DatabaseSync(':memory:');
  const DB = d1FromSqlite(sqlite);
  await applySchema(DB, SCHEMA_SQL);
  return { env: { DB, CELL_SECRET_MASTER: 'master', ...extra }, sqlite };
}

async function signedIn(env, email = 'owner@example.com') {
  const res = await worker.fetch(
    new Request('https://cloud.test/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: form({ email, password: PASSWORD, disclosure: 'yes' }),
    }),
    env
  );
  return /maude_session=([^;]+)/.exec(res.headers.get('set-cookie') ?? '')?.[1];
}

function seedProject(sqlite, { id = 'alligators', owner }) {
  sqlite
    .prepare(
      `INSERT INTO projects (id, account_id, name, state, state_since, created_at)
       VALUES (?, ?, 'Alligators', 'active', 1, 1)`
    )
    .run(id, owner);
}

const jpost = (path, body, headers = {}) =>
  new Request(`https://cloud.test${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

async function mintCode(env, session, project = 'alligators') {
  const res = await worker.fetch(
    new Request(`https://cloud.test/projects/${project}/handoff`, {
      method: 'POST',
      headers: { accept: 'application/json', cookie: `maude_session=${session}` },
    }),
    env
  );
  return { res, body: await res.json() };
}

test('mint needs a signed-in person; a stranger gets the same 404 as a ghost project', async () => {
  const { env, sqlite } = await freshEnv();
  const anon = await worker.fetch(
    new Request('https://cloud.test/projects/alligators/handoff', { method: 'POST' }),
    env
  );
  assert.equal(anon.status, 401);

  const session = await signedIn(env, 'stranger@example.com');
  const other = await signedIn(env, 'owner@example.com');
  const ownerId = sqlite
    .prepare('SELECT id FROM accounts WHERE email = ?')
    .get('owner@example.com').id;
  seedProject(sqlite, { owner: ownerId });
  const { res } = await mintCode(env, session);
  assert.equal(res.status, 404);
  const ghost = await mintCode(env, session, 'no-such-project');
  assert.equal(ghost.res.status, 404);
  assert.ok(other, 'owner session exists');
});

test('the full lane: mint → exchange → a verifiable project token; the code burns on first use', async () => {
  const { env, sqlite } = await freshEnv();
  const session = await signedIn(env);
  const ownerId = sqlite
    .prepare('SELECT id FROM accounts WHERE email = ?')
    .get('owner@example.com').id;
  seedProject(sqlite, { owner: ownerId });

  const { res, body } = await mintCode(env, session);
  assert.equal(res.status, 200);
  assert.match(body.code, /^mhc_[0-9a-f]{64}$/);
  assert.match(body.url, /^maude:\/\/open\/alligators\?code=mhc_/);

  const ex = await worker.fetch(jpost('/auth/handoff/exchange', { code: body.code }), env);
  assert.equal(ex.status, 200);
  const grant = await ex.json();
  assert.equal(grant.role, 'owner');
  assert.equal(grant.project, 'alligators');
  assert.equal(grant.url, 'https://alligators.cloud.maude.sh');

  // The token is the SAME thing /projects/open mints — the cell's own
  // verifier accepts it under the project-token purpose key.
  const key = await deriveCellSecret(env.CELL_SECRET_MASTER, 'alligators', 'project-token');
  const verdict = verifyAccessToken(grant.token, key, { tenantId: 'alligators' });
  assert.equal(verdict.ok, true);
  assert.equal(verdict.user.email, 'owner@example.com');
  assert.equal(verdict.user.role, 'owner');

  // Single use: the same code presented again is dead.
  const again = await worker.fetch(jpost('/auth/handoff/exchange', { code: body.code }), env);
  assert.equal(again.status, 400);
});

test('a viewer cannot mint — no silent escalation through the handoff lane', async () => {
  const { env, sqlite } = await freshEnv();
  const ownerSession = await signedIn(env, 'owner@example.com');
  const viewerSession = await signedIn(env, 'viewer@example.com');
  const ownerId = sqlite
    .prepare('SELECT id FROM accounts WHERE email = ?')
    .get('owner@example.com').id;
  const viewerId = sqlite
    .prepare('SELECT id FROM accounts WHERE email = ?')
    .get('viewer@example.com').id;
  seedProject(sqlite, { owner: ownerId });
  sqlite
    .prepare(
      "INSERT INTO project_members (project_id, account_id, role, added_at) VALUES ('alligators', ?, 'viewer', 1)"
    )
    .run(viewerId);

  const { res, body } = await mintCode(env, viewerSession);
  assert.equal(res.status, 403);
  assert.match(body.error, /member role/);
  assert.ok(ownerSession);
});

test('a removal inside the code window kills the exchange', async () => {
  const { env, sqlite } = await freshEnv();
  const ownerSession = await signedIn(env, 'owner@example.com');
  const memberSession = await signedIn(env, 'member@example.com');
  const ownerId = sqlite
    .prepare('SELECT id FROM accounts WHERE email = ?')
    .get('owner@example.com').id;
  const memberId = sqlite
    .prepare('SELECT id FROM accounts WHERE email = ?')
    .get('member@example.com').id;
  seedProject(sqlite, { owner: ownerId });
  sqlite
    .prepare(
      "INSERT INTO project_members (project_id, account_id, role, added_at) VALUES ('alligators', ?, 'member', 1)"
    )
    .run(memberId);

  const { body } = await mintCode(env, memberSession);
  assert.match(body.code, /^mhc_/);
  sqlite.prepare('DELETE FROM project_members WHERE account_id = ?').run(memberId);

  const ex = await worker.fetch(jpost('/auth/handoff/exchange', { code: body.code }), env);
  assert.equal(ex.status, 400);
  assert.ok(ownerSession);
});

test('an expired code is refused, and garbage is refused cheaply', async () => {
  const { env, sqlite } = await freshEnv();
  const session = await signedIn(env);
  const ownerId = sqlite
    .prepare('SELECT id FROM accounts WHERE email = ?')
    .get('owner@example.com').id;
  seedProject(sqlite, { owner: ownerId });
  const { body } = await mintCode(env, session);
  sqlite.prepare('UPDATE handoff_codes SET expires_at = 1').run();
  const ex = await worker.fetch(jpost('/auth/handoff/exchange', { code: body.code }), env);
  assert.equal(ex.status, 400);
  const junk = await worker.fetch(jpost('/auth/handoff/exchange', { code: 'not-a-code' }), env);
  assert.equal(junk.status, 400);
});

test('the browser form POST answers with the no-script launch page carrying the maude:// link', async () => {
  const { env, sqlite } = await freshEnv();
  const session = await signedIn(env);
  const ownerId = sqlite
    .prepare('SELECT id FROM accounts WHERE email = ?')
    .get('owner@example.com').id;
  seedProject(sqlite, { owner: ownerId });
  const res = await worker.fetch(
    new Request('https://cloud.test/projects/alligators/handoff', {
      method: 'POST',
      headers: { cookie: `maude_session=${session}` },
    }),
    env
  );
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /maude:\/\/open\/alligators\?code=mhc_/);
  assert.match(html, /Download Maude/);
  assert.match(res.headers.get('content-security-policy'), /default-src 'none'/);
  // No script anywhere near a page that holds a live code.
  assert.doesNotMatch(html, /<script/i);
});
