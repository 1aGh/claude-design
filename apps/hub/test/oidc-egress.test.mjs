// The JWKS egress guard — Track C C2.
//
// `jose` verifies signatures; it fetches whatever URL you hand it. So the
// network half is ours, and it is the half with the sharp edge: on the EC2
// deployment our own runbook recommends, an unpinned fetch reaches
// 169.254.169.254 and the S3 credentials behind it.
//
// The address tests below are the ones that matter. A hostname allowlist looks
// like a fix and is not — the name passes, then resolves to link-local on the
// connection the check never covered.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { assertSameOrigin, createRefetchBudget, isForbiddenAddress } from '../src/oidc-egress.mjs';

test('the instance metadata service is refused, in every spelling', () => {
  // The whole point. 169.254.169.254 is AWS, GCP and Azure metadata alike, and
  // it can be smuggled through several IPv6 encodings — all judged by bytes.
  assert.equal(isForbiddenAddress('169.254.169.254'), true);
  assert.equal(isForbiddenAddress('::ffff:169.254.169.254'), true, 'mapped, dotted');
  assert.equal(isForbiddenAddress('::ffff:a9fe:a9fe'), true, 'mapped, hex');
  assert.equal(isForbiddenAddress('64:ff9b::a9fe:a9fe'), true, 'NAT64');
  assert.equal(isForbiddenAddress('2002:a9fe:a9fe::'), true, '6to4');
  assert.equal(isForbiddenAddress('::a9fe:a9fe'), true, 'IPv4-compatible');
});

test('the wider IPv6 private/link-local ranges are refused', () => {
  for (const ip of ['fe80::1', 'fe9f::1', 'febf::1', 'fec0::1', 'ff02::1', '::ffff:7f00:1']) {
    assert.equal(isForbiddenAddress(ip), true, `${ip} must be refused`);
  }
});

test('loopback, RFC1918, CGNAT and unique-local are refused', () => {
  for (const ip of [
    '127.0.0.1',
    '0.0.0.0',
    '10.1.2.3',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '100.64.0.1',
    '::1',
    'fd00::1',
    'fc00::1',
  ]) {
    assert.equal(isForbiddenAddress(ip), true, `${ip} must be refused`);
  }
});

test('ordinary public addresses are allowed', () => {
  for (const ip of ['8.8.8.8', '104.18.0.1', '172.32.0.1', '2606:4700::1111']) {
    assert.equal(isForbiddenAddress(ip), false, `${ip} must be allowed`);
  }
});

test('a non-address refuses rather than guessing', () => {
  for (const junk of ['', null, undefined, 'localhost', 'not-an-ip']) {
    assert.equal(isForbiddenAddress(junk), true);
  }
});

test('jwks_uri must share the issuer origin and be https', () => {
  const iss = 'https://acme.eu.auth0.com';
  assert.equal(assertSameOrigin(iss, `${iss}/.well-known/jwks.json`).origin, iss);
  assert.throws(() => assertSameOrigin(iss, 'https://evil.example/jwks'), /does not match/);
  assert.throws(() => assertSameOrigin(iss, 'http://acme.eu.auth0.com/jwks'), /must be https/);
  // The classic near-miss: a host that merely STARTS with the issuer's host.
  assert.throws(
    () => assertSameOrigin(iss, 'https://acme.eu.auth0.com.evil.example/jwks'),
    /does not match/
  );
  assert.throws(() => assertSameOrigin(iss, 'not a url'), /not a URL/);
});

test('an unknown kid cannot drive unbounded refetching', () => {
  let t = 0;
  const budget = createRefetchBudget({ windowMs: 1000, max: 2, now: () => t });
  assert.equal(budget.spend(), true);
  assert.equal(budget.spend(), true);
  assert.equal(budget.spend(), false, 'the third fetch in the window is refused');
  t = 1001;
  assert.equal(budget.spend(), true, 'the window rolls');
});
