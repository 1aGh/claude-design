// The self-hosted sign-in page must SHOW the door it expects people to use.
//
// The AWS spike (2026-08-20, finding M5) deployed a hub with fully working
// OIDC and nobody could sign in with it: `/auth/oidc/start` redirected to the
// IdP correctly, but `/studio/signin` rendered email + password and nothing
// else, because `oidcButton()` was only ever called from `servicePage()` — the
// page whose own comment says "it is opened when something is already wrong".
//
// Under `strict` this is not cosmetic. `cloud-identity` refuses passwords
// there outright, so the rendered form could only ever fail, and the sole
// working entrance was a URL the UI never printed.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { signInPage } from '../src/browser-auth.mjs';

const OIDC_ENV = {
  HUB_OIDC_MODE: 'hybrid',
  HUB_OIDC_ISSUER: 'https://auth.studyfi.com/',
  HUB_OIDC_LABEL: '',
};

test('with no OIDC configured the page is password-only', () => {
  const html = signInPage(null, {});
  assert.ok(html.includes('name="password"'));
  assert.ok(!html.includes('/auth/oidc/start'));
});

test('hybrid shows the provider link BESIDE the password form', () => {
  const html = signInPage(null, OIDC_ENV);
  assert.ok(html.includes('href="/auth/oidc/start"'));
  assert.ok(html.includes('name="password"'));
  // The label falls back to the issuer hostname when none is configured.
  assert.ok(html.includes('auth.studyfi.com'));
});

test('strict shows the provider link and NO password form', () => {
  const html = signInPage(null, { ...OIDC_ENV, HUB_OIDC_MODE: 'strict' });
  assert.ok(html.includes('href="/auth/oidc/start"'));
  assert.ok(!html.includes('name="password"'));
});

test('an explicit label is used and is escaped', () => {
  const html = signInPage(null, { ...OIDC_ENV, HUB_OIDC_LABEL: '<b>Acme</b>' });
  assert.ok(html.includes('&lt;b&gt;Acme&lt;/b&gt;'));
  assert.ok(!html.includes('<b>Acme</b>'));
});

test('the error message still renders under strict, where there is no form', () => {
  const html = signInPage('Sign-in failed.', { ...OIDC_ENV, HUB_OIDC_MODE: 'strict' });
  assert.ok(html.includes('Sign-in failed.'));
});
