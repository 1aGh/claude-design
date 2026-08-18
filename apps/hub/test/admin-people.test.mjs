// The People view — Track B.
//
// `/admin/api/users*` and `/admin/api/invites` have existed and been tested
// since Cloud Phase 2, and NOTHING in the console called them: `grep users
// app.js` returned zero hits. A self-hoster's only way to add a teammate was to
// curl an undocumented admin API with HUB_SECRET, and the topbar's "Generate
// invite" was the peer-TOKEN generator — it asked for a label, not an address.
//
// These are source-level pins, in the house style of `admin-static.test.mjs`:
// the console is vanilla HTML + one script, so "does the UI call the route"
// is a question about the file.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ADMIN_HTML, ADMIN_JS } from '../src/admin-assets.mjs';

test('the nav offers People', () => {
  assert.match(ADMIN_HTML, /data-view="people"/);
  assert.match(ADMIN_HTML, /id="view-people"/);
});

test('every user + invite route the view needs is actually called', () => {
  // The regression this whole track exists to fix. Each of these was dead.
  for (const route of [
    '/users',
    '/users/disable',
    '/users/enable',
    '/users/password',
    '/invites',
  ]) {
    assert.ok(ADMIN_JS.includes(`'${route}'`), `the console never calls ${route}`);
  }
});

test('accounts render the live token count the route already returns', () => {
  // GET /users returns `tokenCount` per account — the number that answers "did
  // the offboard take effect". Adding a route to recompute it would be adding
  // a route to recompute something we are already given.
  assert.match(ADMIN_JS, /tokenCount/);
});

test('an invite is created for an EMAIL, not a label', () => {
  assert.match(ADMIN_HTML, /id="person-invite-email"[^>]*type="email"/);
});

test('the invite link is shown, never claimed to be sent', () => {
  // The hub has no SMTP and gains none. Saying "invite sent" would be a lie
  // the operator only discovers when the teammate never arrives.
  assert.match(ADMIN_HTML, /does not send email/i);
});

test('the peer TOKEN card no longer reads as an account invite', () => {
  // One is a terminal credential for a git peer, the other is a person's
  // account. Conflating them is what the view exists to end.
  assert.match(ADMIN_HTML, /Peer token/);
  assert.ok(
    !/Generate invite <span class="sku">HUB/.test(ADMIN_HTML),
    'the old label survived and still reads as an account invite'
  );
});

test('People hides under CLOUD strict identity — and only that one', () => {
  // Two flags are spelled `strict` and mean opposite things here:
  // identity.mode === 'strict' (cloud owns membership → hide People) versus
  // HUB_OIDC_MODE=strict (password login off → People is MORE necessary).
  assert.match(ADMIN_JS, /identity\?\.mode === 'strict'/);
  assert.match(ADMIN_JS, /data-view="people"/);
  assert.match(ADMIN_JS, /HUB_OIDC_MODE/, 'the collision must be documented where it bites');
});

test('the one-time reveal is reused, not reimplemented', () => {
  // A second "shown once" surface is a second place for that promise to drift.
  const invite = ADMIN_JS.slice(ADMIN_JS.indexOf('person-invite-form'));
  assert.match(invite.slice(0, 1500), /showInvite\(/);
});
