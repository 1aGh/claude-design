// The invitation round trip — Cloud Phase 22.
//
// Same posture as auth-routes.test.mjs: real SQLite behind the D1 shape, real
// Request/Response through the live worker, no route mocked. The email
// provider is the one thing faked, because the test asserting "an email left
// the building" belongs to email.test.mjs — here it only matters that the
// invite works whether or not the send did.

import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';

import { d1FromSqlite } from './db.mjs';
import { allInviteHtml } from './invites.mjs';
import { applySchema } from './migrate.mjs';
import { SCHEMA_SQL } from './schema.mjs';
import worker from './worker.mjs';

const PASSWORD = 'a-long-enough-password';

async function freshEnv(extra = {}) {
  const sqlite = new DatabaseSync(':memory:');
  const DB = d1FromSqlite(sqlite);
  await applySchema(DB, SCHEMA_SQL);
  return { env: { DB, ...extra }, sqlite };
}

function form(fields) {
  return new URLSearchParams(fields).toString();
}

async function signup(env, { email = 'owner@example.com', password = PASSWORD } = {}) {
  const res = await worker.fetch(
    new Request('https://cloud.test/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: form({ email, password, disclosure: 'yes' }),
    }),
    env
  );
  return /maude_session=([^;]+)/.exec(res.headers.get('set-cookie') ?? '')?.[1];
}

/** An owner with a project, plus their session cookie. */
async function ownerWithProject(env, sqlite) {
  const session = await signup(env);
  const ownerId = sqlite.prepare('SELECT id FROM accounts ORDER BY created_at').get().id;
  sqlite
    .prepare(
      `INSERT INTO projects (id, account_id, name, state, state_since, created_at)
       VALUES ('alligators', ?, 'Brno Alligators', 'active', 1, 1)`
    )
    .run(ownerId);
  return { session, ownerId };
}

async function inviteSomeone(env, session, email = 'teammate@example.com') {
  const res = await worker.fetch(
    new Request('https://cloud.test/projects/alligators/people', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: `maude_session=${session}`,
      },
      body: form({ do: 'invite', email, role: 'member' }),
    }),
    env
  );
  return res;
}

test('inviting an unknown address writes an invite and dispatches the email', async () => {
  const { env, sqlite } = await freshEnv({ RESEND_API_KEY: 'k' });
  const sends = [];
  globalThis.__origFetch ??= globalThis.fetch;
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    if (String(input).includes('api.resend.com')) {
      sends.push(JSON.parse(init.body));
      return new Response(JSON.stringify({ id: 'em_1' }), { status: 200 });
    }
    return realFetch(input, init);
  };
  try {
    const { session } = await ownerWithProject(env, sqlite);
    const res = await inviteSomeone(env, session);
    assert.equal(res.status, 200);
    assert.match(await res.text(), /Invitation sent to teammate@example\.com/);

    const row = sqlite.prepare('SELECT * FROM project_invites').get();
    assert.equal(row.email, 'teammate@example.com');
    assert.equal(sends.length, 1);
    assert.deepEqual(sends[0].to, ['teammate@example.com']);
    assert.match(sends[0].text, new RegExp(`/invite/${row.id}`));
    assert.match(sends[0].subject, /owner@example\.com invited you to Brno Alligators/);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('when sending is not configured, the owner gets the link to share themselves', async () => {
  const { env, sqlite } = await freshEnv(); // no RESEND_API_KEY
  const { session } = await ownerWithProject(env, sqlite);
  const res = await inviteSomeone(env, session);
  const body = await res.text();
  const row = sqlite.prepare('SELECT * FROM project_invites').get();
  assert.match(body, /could not be sent/);
  assert.match(body, new RegExp(`/invite/${row.id}`));
});

test('the invite link signs a new person up AND lands them in the project', async () => {
  const { env, sqlite } = await freshEnv();
  const { session } = await ownerWithProject(env, sqlite);
  await inviteSomeone(env, session);
  const invite = sqlite.prepare('SELECT * FROM project_invites').get();

  // The page offers account creation for an address with no account.
  const pageRes = await worker.fetch(new Request(`https://cloud.test/invite/${invite.id}`), env);
  assert.equal(pageRes.status, 200);
  const page = await pageRes.text();
  assert.match(page, /Join Brno Alligators/);
  assert.match(page, /Choose a password/);

  const accept = await worker.fetch(
    new Request(`https://cloud.test/invite/${invite.id}`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: form({ password: PASSWORD, disclosure: 'yes' }),
    }),
    env
  );
  assert.equal(accept.status, 303);
  assert.match(accept.headers.get('set-cookie') ?? '', /maude_session=/);

  const member = sqlite
    .prepare(
      `SELECT m.role FROM project_members m JOIN accounts a ON a.id = m.account_id
        WHERE a.email = 'teammate@example.com' AND m.project_id = 'alligators'`
    )
    .get();
  assert.equal(member?.role, 'member');
  assert.ok(sqlite.prepare('SELECT redeemed_at FROM project_invites').get().redeemed_at > 0);
});

test('a redeemed link is dead, with ONE neutral sentence', async () => {
  const { env, sqlite } = await freshEnv();
  const { session } = await ownerWithProject(env, sqlite);
  await inviteSomeone(env, session);
  const invite = sqlite.prepare('SELECT * FROM project_invites').get();
  await worker.fetch(
    new Request(`https://cloud.test/invite/${invite.id}`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: form({ password: PASSWORD, disclosure: 'yes' }),
    }),
    env
  );

  const again = await worker.fetch(new Request(`https://cloud.test/invite/${invite.id}`), env);
  assert.equal(again.status, 404);
  const body = await again.text();
  assert.match(body, /not valid/);
  assert.ok(!/redeem|expired|revoked/i.test(body), 'the reason must not be disclosed');
});

test('an expired link and a guessed id read identically', async () => {
  const { env, sqlite } = await freshEnv();
  const { session } = await ownerWithProject(env, sqlite);
  await inviteSomeone(env, session);
  const invite = sqlite.prepare('SELECT * FROM project_invites').get();
  sqlite.prepare('UPDATE project_invites SET expires_at = 1 WHERE id = ?').run(invite.id);

  const expired = await worker.fetch(new Request(`https://cloud.test/invite/${invite.id}`), env);
  const guessed = await worker.fetch(
    new Request(`https://cloud.test/invite/${crypto.randomUUID()}`),
    env
  );
  assert.equal(expired.status, 404);
  assert.equal(guessed.status, 404);
  assert.equal(await expired.text(), await guessed.text());
});

test('an account created AFTER the invite is sent to sign in, not to sign up', async () => {
  // The direct-add path covers an address that already has an account at
  // invite time (no invite row is written at all — asserted elsewhere). This
  // is the other ordering: invited first, signed up independently later.
  const { env, sqlite } = await freshEnv();
  const { session } = await ownerWithProject(env, sqlite);
  await inviteSomeone(env, session);
  const invite = sqlite.prepare('SELECT * FROM project_invites').get();
  await signup(env, { email: 'teammate@example.com' });

  const res = await worker.fetch(new Request(`https://cloud.test/invite/${invite.id}`), env);
  const body = await res.text();
  assert.match(body, /already have a Maude account/);
  assert.ok(!/Choose a password/.test(body));

  // And a POST in that state creates nothing.
  const post = await worker.fetch(
    new Request(`https://cloud.test/invite/${invite.id}`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: form({ password: PASSWORD, disclosure: 'yes' }),
    }),
    env
  );
  assert.equal(post.status, 409);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM project_members').get().n, 0);
});

test('signed in as the invitee, one button joins', async () => {
  const { env, sqlite } = await freshEnv();
  const { session } = await ownerWithProject(env, sqlite);
  await inviteSomeone(env, session);
  const invite = sqlite.prepare('SELECT * FROM project_invites').get();
  const inviteeSession = await signup(env, { email: 'teammate@example.com' });

  const res = await worker.fetch(
    new Request(`https://cloud.test/invite/${invite.id}`, {
      headers: { cookie: `maude_session=${inviteeSession}` },
    }),
    env
  );
  assert.match(await res.text(), /Join the project/);

  const join = await worker.fetch(
    new Request(`https://cloud.test/invite/${invite.id}`, {
      method: 'POST',
      headers: { cookie: `maude_session=${inviteeSession}` },
    }),
    env
  );
  assert.equal(join.status, 303);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM project_members').get().n, 1);
});

test('declining the disclosure creates neither account nor membership', async () => {
  const { env, sqlite } = await freshEnv();
  const { session } = await ownerWithProject(env, sqlite);
  await inviteSomeone(env, session);
  const invite = sqlite.prepare('SELECT * FROM project_invites').get();

  const res = await worker.fetch(
    new Request(`https://cloud.test/invite/${invite.id}`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: form({ password: PASSWORD }),
    }),
    env
  );
  assert.equal(res.status, 400);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM accounts').get().n, 1); // just the owner
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM project_members').get().n, 0);
});

// ------------------------------------------------------------------- strings

test('the invite pages ship no script and escape what they interpolate', () => {
  const html = allInviteHtml();
  assert.ok(!/<script/i.test(html));
  assert.ok(!/\son[a-z]+\s*=/i.test(html));
});

test('the invite pages use no vocabulary of ours', () => {
  const html = allInviteHtml();
  for (const jargon of ['tenant', 'cell', 'token', 'revoke', 'session', 'container']) {
    assert.ok(!new RegExp(`\\b${jargon}`, 'i').test(html), `"${jargon}" leaked into the invite page`);
  }
});
