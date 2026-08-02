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
  // Cloud Phase 24 A3: the refusal is a PAGE for a browser form POST. The
  // success path negotiated and the refusals did not, so pressing "Open in
  // Maude" as a viewer used to end on raw JSON. It also no longer sends
  // anybody to a gallery — Phase 25 C4 deletes it.
  const asBrowser = await worker.fetch(
    new Request('https://cloud.test/projects/alligators/handoff', {
      method: 'POST',
      headers: { cookie: `maude_session=${viewerSession}` },
    }),
    env
  );
  assert.equal(asBrowser.status, 403);
  assert.match(asBrowser.headers.get('content-type'), /text\/html/);
  const page = await asBrowser.text();
  assert.match(page, /member role/);
  assert.doesNotMatch(page, /gallery/i);
  assert.doesNotMatch(page, /^\s*\{/, 'a browser never meets raw JSON');
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
  // Cloud Phase 24 A7: one download address across the whole product.
  assert.match(html, /maude\.sh\/desktop/);
  assert.match(res.headers.get('content-security-policy'), /default-src 'none'/);
  // No script anywhere near a page that holds a live code.
  assert.doesNotMatch(html, /<script/i);
});

// ---- validate 2026-07-30: the security pass's findings, pinned ------------

test('F1 — a cross-site POST carrying the session cookie is refused', async () => {
  // SameSite=Lax is same-SITE: a workspace page at <project>.cloud.maude.sh
  // shares the registrable domain and ships the cookie. Fetch-Metadata is what
  // actually distinguishes it.
  const { env, sqlite } = await freshEnv();
  const session = await signedIn(env);
  const ownerId = sqlite
    .prepare('SELECT id FROM accounts WHERE email = ?')
    .get('owner@example.com').id;
  seedProject(sqlite, { owner: ownerId });

  for (const site of ['cross-site', 'same-site']) {
    const res = await worker.fetch(
      new Request('https://cloud.test/projects/alligators/handoff', {
        method: 'POST',
        headers: {
          accept: 'application/json',
          cookie: `maude_session=${session}`,
          'sec-fetch-site': site,
        },
      }),
      env
    );
    assert.equal(res.status, 403, `${site} must be refused`);
  }

  // The app and the CLI send no Sec-Fetch-Site at all — they must still work.
  const { res } = await mintCode(env, session);
  assert.equal(res.status, 200);
});

test('F1 — the derived-secret lanes are exempt (no cookie, no browser)', async () => {
  const { env } = await freshEnv();
  const res = await worker.fetch(
    new Request('https://cloud.test/internal/mirror-token', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'sec-fetch-site': 'cross-site' },
      body: JSON.stringify({ tenant: 'alligators' }),
    }),
    env
  );
  assert.notEqual(res.status, 403, 'the guard must not shadow the secret check');
  assert.equal(res.status, 401, 'it is refused on its OWN authentication');
});

test('F4 — an unset CELL_SECRET_MASTER refuses to mint rather than signing with an empty key', async () => {
  const sqlite = new DatabaseSync(':memory:');
  const DB = d1FromSqlite(sqlite);
  await applySchema(DB, SCHEMA_SQL);
  const env = { DB }; // no CELL_SECRET_MASTER
  const session = await signedIn(env);
  const ownerId = sqlite
    .prepare('SELECT id FROM accounts WHERE email = ?')
    .get('owner@example.com').id;
  seedProject(sqlite, { owner: ownerId });

  const { body } = await mintCode(env, session);
  const res = await worker.fetch(jpost('/auth/handoff/exchange', { code: body.code }), env);
  assert.equal(res.status, 503);
  const open = await worker.fetch(
    jpost(
      '/projects/open',
      { project: 'alligators' },
      {
        cookie: `maude_session=${session}`,
      }
    ),
    env
  );
  assert.equal(open.status, 503);
});

// ── the browser door (Cloud Phase 25 B1/B2) ────────────────────────────────

test('the browser lane admits a VIEWER; the app lane still refuses one', async () => {
  const { env, sqlite } = await freshEnv();
  const owner = await signedIn(env, 'owner@example.com');
  const viewer = await signedIn(env, 'viewer@example.com');
  const ownerId = sqlite
    .prepare("SELECT id FROM accounts WHERE email='owner@example.com'")
    .get().id;
  const viewerId = sqlite
    .prepare("SELECT id FROM accounts WHERE email='viewer@example.com'")
    .get().id;
  sqlite
    .prepare(
      "INSERT INTO projects (id, account_id, name, state, state_since, created_at) VALUES ('alligators', ?, 'A', 'active', 1, 1)"
    )
    .run(ownerId);
  sqlite
    .prepare(
      "INSERT INTO project_members (project_id, account_id, role, added_at) VALUES ('alligators', ?, 'viewer', 1)"
    )
    .run(viewerId);

  // App lane: refused, in words.
  const app = await worker.fetch(
    new Request('https://cloud.test/projects/alligators/handoff', {
      method: 'POST',
      headers: { cookie: `maude_session=${viewer}`, accept: 'application/json' },
    }),
    env
  );
  assert.equal(app.status, 403);

  // Browser lane: a redirect back to the cell WITH a code.
  const browser = await worker.fetch(
    new Request('https://cloud.test/projects/alligators/browser', {
      headers: { cookie: `maude_session=${viewer}` },
    }),
    env
  );
  assert.equal(browser.status, 302);
  const location = browser.headers.get('location');
  assert.match(location, /^https:\/\/alligators\.cloud\.maude\.sh\/auth\/browser\?code=mhc_/);

  // And the exchange mints a token whose role is viewer — the cell turns that
  // into a read-only session (C1), which is where the rule is enforced.
  const code = new URL(location).searchParams.get('code');
  const exchanged = await worker.fetch(
    new Request('https://cloud.test/auth/handoff/exchange', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code }),
    }),
    env
  );
  assert.equal(exchanged.status, 200);
  assert.equal((await exchanged.json()).role, 'viewer');
  void owner;
});

test('a stranger and a non-existent project are refused IDENTICALLY (no oracle)', async () => {
  const { env, sqlite } = await freshEnv();
  const ownerId =
    (await signedIn(env, 'owner@example.com')) &&
    sqlite.prepare("SELECT id FROM accounts WHERE email='owner@example.com'").get().id;
  sqlite
    .prepare(
      "INSERT INTO projects (id, account_id, name, state, state_since, created_at) VALUES ('real-one', ?, 'R', 'active', 1, 1)"
    )
    .run(ownerId);
  const stranger = await signedIn(env, 'stranger@example.com');
  const call = (id) =>
    worker.fetch(
      new Request(`https://cloud.test/projects/${id}/browser`, {
        headers: { cookie: `maude_session=${stranger}` },
      }),
      env
    );
  const existing = await call('real-one');
  const ghost = await call('not-a-project');
  assert.equal(existing.status, 302);
  assert.equal(ghost.status, 302);
  assert.match(existing.headers.get('location'), /\?denied=1$/);
  assert.match(ghost.headers.get('location'), /\?denied=1$/);
});

test('the browser lane sends a signed-OUT visitor to sign in, never to a code', async () => {
  const { env } = await freshEnv();
  const res = await worker.fetch(new Request('https://cloud.test/projects/x/browser'), env);
  assert.equal(res.status, 302);
  assert.match(res.headers.get('location'), /^\/auth\/login\?next=/);
});
