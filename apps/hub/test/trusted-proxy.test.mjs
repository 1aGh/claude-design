// Cloud Phase 2 Task 2 — trusted proxies + persistent sliding-window limiting.
//
// Two failure modes this closes, both real:
//   • Ignoring X-Forwarded-For behind a proxy collapses every client into the
//     proxy's IP: one noisy tenant limits everyone, and login brute-force is
//     effectively unlimited per attacker.
//   • Honouring it blindly means an attacker sends a random XFF per request
//     and is never limited at all.
// The resolution is explicit trust, and the tests below are mostly about the
// ways trust can be got WRONG.

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, test } from 'node:test';

import {
  clientIpFor,
  isTrustedProxy,
  normalizeAddress,
  parseTrustedProxies,
} from '../src/client-ip.mjs';
import { createRateStore } from '../src/rate-store.mjs';

let dataDir;
beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), 'maude-hub-rate-'));
});
afterEach(() => {
  if (dataDir) rmSync(dataDir, { recursive: true, force: true });
});

const req = (remoteAddress, xff) => ({
  socket: { remoteAddress },
  headers: xff === undefined ? {} : { 'x-forwarded-for': xff },
});

// ------------------------------------------------------------- address parse

test('normalizeAddress unwraps IPv4-mapped, bracketed and zoned forms', () => {
  assert.equal(normalizeAddress('::ffff:203.0.113.7'), '203.0.113.7');
  assert.equal(normalizeAddress('[2001:db8::1]'), '2001:db8::1');
  assert.equal(normalizeAddress('fe80::1%en0'), 'fe80::1');
  assert.equal(normalizeAddress('  10.0.0.1 '), '10.0.0.1');
  assert.equal(normalizeAddress(undefined), '');
});

test('parseTrustedProxies DROPS bad entries instead of widening trust', () => {
  const warnings = [];
  const cidrs = parseTrustedProxies('10.0.0.0/8, not-an-ip, 192.168.1.1, 1.2.3.4/99', (m) =>
    warnings.push(m)
  );
  assert.equal(cidrs.length, 2, 'only the two valid entries survive');
  assert.equal(warnings.length, 2);
  // A typo must never become "trust everything".
  assert.equal(isTrustedProxy('203.0.113.9', cidrs), false);
  assert.deepEqual(parseTrustedProxies(''), []);
  assert.deepEqual(parseTrustedProxies(undefined), []);
});

test('CIDR matching is correct at the boundaries, v4 and v6', () => {
  const v4 = parseTrustedProxies('10.0.0.0/8,172.16.0.0/12,192.168.5.7');
  assert.equal(isTrustedProxy('10.255.255.255', v4), true);
  assert.equal(isTrustedProxy('11.0.0.0', v4), false);
  assert.equal(isTrustedProxy('172.31.255.255', v4), true);
  assert.equal(isTrustedProxy('172.32.0.0', v4), false);
  assert.equal(isTrustedProxy('192.168.5.7', v4), true, 'bare address = /32');
  assert.equal(isTrustedProxy('192.168.5.8', v4), false);
  assert.equal(isTrustedProxy('::ffff:10.1.2.3', v4), true, 'IPv4-mapped still matches v4');

  const v6 = parseTrustedProxies('2001:db8::/32,fd00::/8');
  assert.equal(isTrustedProxy('2001:db8:ffff::1', v6), true);
  assert.equal(isTrustedProxy('2001:db9::1', v6), false);
  assert.equal(isTrustedProxy('fd12:3456::1', v6), true);
  assert.equal(isTrustedProxy('fe80::1', v6), false);
  // Families do not cross-match.
  assert.equal(isTrustedProxy('10.0.0.1', v6), false);
  assert.equal(isTrustedProxy('2001:db8::1', v4), false);
});

// --------------------------------------------------------------- resolution

test('with NO trusted proxies configured, XFF is ignored entirely (DDR-053 §6)', () => {
  const none = parseTrustedProxies(undefined);
  assert.equal(clientIpFor(req('203.0.113.5', '1.2.3.4'), none), '203.0.113.5');
  // This is the safe default and the reason opting in has to be explicit.
});

test('a SPOOFED XFF from an untrusted peer is ignored', () => {
  const trusted = parseTrustedProxies('10.0.0.0/8');
  // The attacker connects directly and claims to be someone else.
  assert.equal(clientIpFor(req('203.0.113.5', '9.9.9.9'), trusted), '203.0.113.5');
  // ...and cannot escape their bucket by rotating the claim.
  assert.equal(clientIpFor(req('203.0.113.5', '8.8.8.8, 7.7.7.7'), trusted), '203.0.113.5');
});

test('behind a trusted proxy, the RIGHTMOST untrusted hop wins', () => {
  const trusted = parseTrustedProxies('10.0.0.0/8');
  // Real client → attacker-controlled prefix is to the LEFT; our proxy appended
  // the true client address on the right.
  assert.equal(
    clientIpFor(req('10.0.0.1', 'evil-claim-ignored, 198.51.100.9'), trusted),
    '198.51.100.9'
  );
  // Two of our own proxies chained: skip both, take the hop before them.
  assert.equal(clientIpFor(req('10.0.0.1', '198.51.100.9, 10.0.0.2'), trusted), '198.51.100.9');
  // A client who pre-seeds a fake leftmost hop still cannot win.
  assert.equal(
    clientIpFor(req('10.0.0.1', '1.1.1.1, 2.2.2.2, 198.51.100.9'), trusted),
    '198.51.100.9'
  );
});

test('degenerate XFF values fall back to the peer address', () => {
  const trusted = parseTrustedProxies('10.0.0.0/8');
  assert.equal(clientIpFor(req('10.0.0.1', ''), trusted), '10.0.0.1');
  assert.equal(clientIpFor(req('10.0.0.1', 'garbage, junk'), trusted), '10.0.0.1');
  assert.equal(clientIpFor(req('10.0.0.1'), trusted), '10.0.0.1');
  // Every hop is one of ours → nothing better than the peer address.
  assert.equal(clientIpFor(req('10.0.0.1', '10.0.0.2, 10.0.0.3'), trusted), '10.0.0.1');
  assert.equal(clientIpFor({ socket: {}, headers: {} }, trusted), '0.0.0.0');
});

test('an array-valued XFF header (duplicated header) is handled', () => {
  const trusted = parseTrustedProxies('10.0.0.0/8');
  const request = { socket: { remoteAddress: '10.0.0.1' }, headers: {} };
  request.headers['x-forwarded-for'] = ['1.1.1.1', '198.51.100.9'];
  assert.equal(clientIpFor(request, trusted), '198.51.100.9');
});

// ------------------------------------------------------------- rate store

test('the sliding window admits exactly `max` and then refuses', () => {
  const store = createRateStore(dataDir);
  const t0 = 1_000_000;
  for (let i = 0; i < 5; i++) {
    assert.equal(store.check('k', 5, 60_000, t0 + i), true, `attempt ${i + 1} should pass`);
  }
  assert.equal(store.check('k', 5, 60_000, t0 + 5), false, '6th must be refused');
  // A refused attempt is still counted — otherwise a caller could idle at the
  // ceiling forever, retrying for free.
  assert.equal(store.count('k', 60_000, t0 + 6), 6);
  store.close();
});

test('the window SLIDES — it is not a fixed window with a free reset at the edge', () => {
  const store = createRateStore(dataDir);
  const t0 = 2_000_000;
  // Spend 3 of a budget of 5 early in the window, and 2 more near its end.
  for (let i = 0; i < 3; i++) assert.equal(store.check('k', 5, 60_000, t0 + i), true);
  for (let i = 0; i < 2; i++) assert.equal(store.check('k', 5, 60_000, t0 + 59_000 + i), true);
  assert.equal(store.check('k', 5, 60_000, t0 + 59_500), false, 'budget spent');
  assert.equal(store.count('k', 60_000, t0 + 59_500), 6, '5 admitted + 1 refused, all counted');

  // Now cross what a FIXED window would treat as the boundary. A fixed window
  // anchored at t0 would hand the WHOLE budget back here. A sliding one returns
  // only what actually aged out: the three hits at t0, not the recent ones.
  const at = t0 + 60_500;
  assert.equal(store.count('k', 60_000, at), 3, 'only the recent hits are still in window');
  assert.equal(store.check('k', 5, 60_000, at), true);
  assert.equal(store.check('k', 5, 60_000, at + 1), true);
  assert.equal(
    store.check('k', 5, 60_000, at + 2),
    false,
    'a fixed window would have allowed 5 here; a sliding one allows 2'
  );
  store.close();
});

test('keys are independent', () => {
  const store = createRateStore(dataDir);
  for (let i = 0; i < 5; i++) store.check('a', 5, 60_000, 1000 + i);
  assert.equal(store.check('a', 5, 60_000, 1010), false);
  assert.equal(store.check('b', 5, 60_000, 1010), true, 'one key must not starve another');
  store.close();
});

test('the budget SURVIVES a restart — "crash the hub" is no longer a free reset', () => {
  const now = 3_000_000;
  const first = createRateStore(dataDir);
  assert.equal(first.persistent, true, 'this test is meaningless against the memory fallback');
  for (let i = 0; i < 5; i++) first.check('auth:203.0.113.5', 5, 60_000, now + i);
  assert.equal(first.check('auth:203.0.113.5', 5, 60_000, now + 5), false);
  first.close();

  // Same data dir, brand-new process worth of state.
  const second = createRateStore(dataDir);
  assert.equal(
    second.check('auth:203.0.113.5', 5, 60_000, now + 6),
    false,
    'the attacker must not get a fresh budget by restarting the hub'
  );
  // And an unrelated address is unaffected by the persisted counter.
  assert.equal(second.check('auth:198.51.100.1', 5, 60_000, now + 6), true);
  second.close();
});

test('reset clears one key or everything (operator escape hatch)', () => {
  const store = createRateStore(dataDir);
  for (let i = 0; i < 5; i++) store.check('a', 5, 60_000, 1000 + i);
  for (let i = 0; i < 5; i++) store.check('b', 5, 60_000, 1000 + i);
  store.reset('a');
  assert.equal(store.check('a', 5, 60_000, 1010), true);
  assert.equal(store.check('b', 5, 60_000, 1010), false);
  store.reset();
  assert.equal(store.check('b', 5, 60_000, 1010), true);
  store.close();
});

test('the memory fallback has the same semantics as the persistent store', () => {
  // Exercised when better-sqlite3 is unavailable or the dir is read-only —
  // degrading to non-persistent beats refusing to boot, but it must not
  // silently degrade to *not limiting*.
  const warnings = [];
  const store = createRateStore('/nonexistent-path-for-rate-store-test', {
    warn: (m) => warnings.push(m),
  });
  assert.equal(store.persistent, false);
  assert.equal(warnings.length, 1);
  for (let i = 0; i < 5; i++) assert.equal(store.check('k', 5, 60_000, 1000 + i), true);
  assert.equal(store.check('k', 5, 60_000, 1005), false);
  assert.equal(store.check('k', 5, 60_000, 61_002), true, 'window still slides');
  store.close();
});
