// OIDC is actually reachable — Track C B1.
//
// The review that caught the first cut found the entire OIDC surface imported
// by tests only: no route in server.mjs, a sign-in button pointing at a 404,
// and docs asserting a `strict` control nothing enforced. These pins assert the
// wiring exists, so it cannot silently come unwired again. They read source
// rather than booting a server — the console is the same house style as
// `admin-people.test.mjs`, and "does the entry point reference the handler" is
// a question about the file.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { ADMIN_HTML, ADMIN_JS } from '../src/admin-assets.mjs';
import * as browserAuth from '../src/browser-auth.mjs';

const src = (rel) => readFileSync(new URL(`../src/${rel}`, import.meta.url), 'utf8');

test('the OIDC door handler exists and is exported', () => {
  assert.equal(typeof browserAuth.handleOidc, 'function');
});

test('server.mjs registers both OIDC routes and gates boot on the config', () => {
  const server = src('server.mjs');
  assert.match(server, /handleOidc/, 'the handler is imported');
  assert.match(server, /'\/auth\/oidc\/start'/, 'the start route is registered');
  assert.match(server, /'\/auth\/oidc\/callback'/, 'the callback route is registered');
  assert.match(server, /assertStrictIsSurvivable/, 'strict mode is gated at boot');
  assert.match(server, /countLinkedOidc/, 'the gate counts linked accounts');
});

test('the sign-in button points at a route that now exists', () => {
  const door = src('studio-door.mjs');
  const m = door.match(/href="(\/auth\/oidc\/start)"/);
  assert.ok(m, 'the button renders the start URL');
  assert.match(src('server.mjs'), new RegExp(`'${m[1]}'`), 'and server.mjs handles it');
});

test('the admin console reaches the pending queue and can link', () => {
  assert.match(ADMIN_HTML, /id="card-oidc-pending"/);
  assert.ok(ADMIN_JS.includes("'/oidc/pending'"), 'the console loads the queue');
  assert.ok(ADMIN_JS.includes("'/oidc/link'"), 'and can link a subject');
});

test('linking keys on the SUBJECT, not the claimed email', () => {
  // Rendering "link to <claimed email>" would re-introduce the email→account
  // inference the sign-in path refuses to make. The admin types the address.
  assert.match(ADMIN_JS, /data-link="\$\{sub\}"/);
  assert.match(ADMIN_JS, /Type the account's email address/);
});

test('auth-routes handles the pending admin routes behind the bearer gate', () => {
  const auth = src('auth-routes.mjs');
  assert.match(auth, /'\/oidc\/pending'/);
  assert.match(auth, /'\/oidc\/link'/);
  assert.match(auth, /linkOidcSub/);
});

test('server.mjs actually DISPATCHES /oidc/* into the admin handler', () => {
  // The connective tissue, not just the endpoints in isolation. The first cut
  // of this test grepped the producer and the consumer independently and passed
  // while /admin/api/oidc/* 404'd — an unwired feature shown as a green check.
  // A "wiring" test that never asserts the producer→consumer link is worse than
  // none, so assert the router condition itself.
  const server = src('server.mjs');
  const block = server.slice(server.indexOf('user administration'));
  const cond = block.slice(0, block.indexOf('handleUserAdminRoutes'));
  for (const route of ["'/oidc/pending'", "'/oidc/link'", "'/oidc/pending/dismiss'"]) {
    assert.ok(cond.includes(route), `server.mjs does not route ${route} to the admin handler`);
  }
});
