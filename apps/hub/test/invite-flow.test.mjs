// Cloud Phase 6 Task 1 — the invite path end to end, against a real hub.
//
// The exit gate for this phase is a timed cold start by a real human. This is
// the machine-checkable half of it: link → account → signed in, in one POST,
// with no login form in the middle and no token in a URL a browser navigates
// away from.

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, test } from 'node:test';

import { closeInvites } from '../src/invites.mjs';
import { createHub } from '../src/server.mjs';
import { verifyToken } from '../src/tokens.mjs';
import { closeUsers } from '../src/users.mjs';

const BASE_PORT = Number.parseInt(process.env.HUB_INVITE_TEST_PORT ?? '14760', 10);
const SECRET = 'test-admin-secret';

let hub;
let dataDir;
let PORT;
let counter = 0;

beforeEach(async () => {
  PORT = BASE_PORT + counter++;
  dataDir = mkdtempSync(join(tmpdir(), 'maude-hub-invite-'));
  hub = createHub({
    port: PORT,
    dataDir,
    secret: SECRET,
    publicUrl: `https://acme.cloud.maude.sh`,
    verbose: false,
  }).server;
  await hub.listen();
});

afterEach(async () => {
  if (hub) await hub.destroy();
  if (dataDir) {
    closeUsers(dataDir);
    closeInvites(dataDir);
    rmSync(dataDir, { recursive: true, force: true });
  }
});

const base = () => `http://127.0.0.1:${PORT}`;
const admin = (extra = {}) => ({ Authorization: `Bearer ${SECRET}`, ...extra });
const postJson = (body, headers = {}) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...headers },
  body: JSON.stringify(body),
});

async function mintInvite(overrides = {}) {
  const res = await fetch(`${base()}/admin/api/invites`, postJson(overrides, admin()));
  assert.equal(res.status, 201);
  return res.json();
}

test('mint → look → redeem → signed in, with no login form in the middle', async () => {
  const { url, value, invite } = await mintInvite({ createdBy: 'alice@example.com' });
  assert.equal(url, `https://acme.cloud.maude.sh/join/${value}`);
  assert.ok(invite.expiresAt > Date.now());

  // The landing page LOOKS. Doing it repeatedly must not consume the invite —
  // a link preview bot following the URL is the ordinary case.
  for (let i = 0; i < 3; i++) {
    const look = await fetch(`${base()}/join/${value}`);
    assert.equal(look.status, 200, `look ${i + 1}`);
    const body = await look.json();
    assert.equal(body.ok, true);
    assert.equal(body.needsEmail, true);
  }

  const redeem = await fetch(
    `${base()}/join`,
    postJson({ token: value, email: 'newbie@example.com', password: 'a-perfectly-fine-password' })
  );
  assert.equal(redeem.status, 201);
  const session = await redeem.json();

  // Signed in immediately — the whole point. A redeem that ends at a login
  // form has reintroduced the form it exists to remove.
  assert.equal(session.user.email, 'newbie@example.com');
  assert.ok(session.expiresAt > Date.now());
  const match = verifyToken(dataDir, session.token, SECRET);
  assert.ok(match, 'the returned session must be a working credential');
  assert.equal(match.owner, 'newbie@example.com');

  // ...and they can sign in again later with the password they chose.
  const login = await fetch(
    `${base()}/auth/login`,
    postJson({ email: 'newbie@example.com', password: 'a-perfectly-fine-password' })
  );
  assert.equal(login.status, 200);
});

test('a used invite is refused, and the message tells the person what to do', async () => {
  const { value } = await mintInvite();
  await fetch(
    `${base()}/join`,
    postJson({ token: value, email: 'first@example.com', password: 'a-perfectly-fine-password' })
  );
  const second = await fetch(
    `${base()}/join`,
    postJson({ token: value, email: 'second@example.com', password: 'a-perfectly-fine-password' })
  );
  assert.equal(second.status, 410);
  const body = await second.json();
  assert.equal(body.reason, 'already-used');
  assert.match(body.error, /already been used/i);
  assert.match(body.error, /ask for a new link/i);
});

test('no string on the invite path uses developer vocabulary', async () => {
  // DDR-193 §5 — the persona is a teammate who has never used git. "Paste your
  // token" tells them the product is not for them.
  const { value } = await mintInvite();
  const surfaces = [
    await (await fetch(`${base()}/join/${value}`)).text(),
    await (await fetch(`${base()}/join/inv_definitely-not-real`)).text(),
    await (
      await fetch(`${base()}/join`, postJson({ token: value, email: 'x@y.com', password: 'short' }))
    ).text(),
  ];
  for (const text of surfaces) {
    const lower = text.toLowerCase();
    for (const word of ['repository', 'repo ', 'github', 'oauth', 'bearer', 'crdt']) {
      assert.ok(!lower.includes(word), `"${word}" must not appear: ${text.slice(0, 200)}`);
    }
  }
});

test('a weak password does NOT burn the invite', async () => {
  const { value } = await mintInvite();
  const weak = await fetch(
    `${base()}/join`,
    postJson({ token: value, email: 'slow@example.com', password: 'short' })
  );
  assert.equal(weak.status, 400);

  const retry = await fetch(
    `${base()}/join`,
    postJson({ token: value, email: 'slow@example.com', password: 'a-perfectly-fine-password' })
  );
  assert.equal(retry.status, 201, 'the invite must survive a rejected password');
});

test('minting requires the admin Bearer; joining does not', async () => {
  const unauth = await fetch(`${base()}/admin/api/invites`, postJson({}));
  assert.equal(unauth.status, 401);

  const { value } = await mintInvite();
  // The join path is deliberately unauthenticated — the invitee has no
  // credential yet; the link IS the credential.
  assert.equal((await fetch(`${base()}/join/${value}`)).status, 200);
});

test('a revoked invite stops working immediately', async () => {
  const { value, invite } = await mintInvite();
  const revoke = await fetch(
    `${base()}/admin/api/invites/revoke`,
    postJson({ id: invite.id }, admin())
  );
  assert.equal(revoke.status, 200);

  const look = await fetch(`${base()}/join/${value}`);
  assert.equal(look.status, 410);
  assert.equal((await look.json()).reason, 'revoked');

  const redeem = await fetch(
    `${base()}/join`,
    postJson({ token: value, email: 'late@example.com', password: 'a-perfectly-fine-password' })
  );
  assert.equal(redeem.status, 410);
});

test('the admin listing shows status and never anything redeemable', async () => {
  const { value, invite } = await mintInvite({ email: 'kim@example.com' });
  await fetch(
    `${base()}/join`,
    postJson({ token: value, email: 'kim@example.com', password: 'a-perfectly-fine-password' })
  );
  const res = await fetch(`${base()}/admin/api/invites`, { headers: admin() });
  const { invites } = await res.json();
  const listed = invites.find((i) => i.id === invite.id);
  assert.equal(listed.status, 'used');
  assert.equal(listed.redeemedBy, 'kim@example.com');
  const serialized = JSON.stringify(invites);
  assert.ok(!serialized.includes(value), 'the listing must never contain a usable invite');
});

test('redeeming an invite is rate-limited like every other credential path', async () => {
  const attempts = [];
  for (let i = 0; i < 12; i++) {
    attempts.push(
      (
        await fetch(
          `${base()}/join`,
          postJson({ token: 'inv_wrong', email: 'a@b.com', password: 'a-perfectly-fine-password' })
        )
      ).status
    );
  }
  assert.ok(attempts.includes(429), `expected a 429 among ${attempts.join(',')}`);
});
