// PBKDF2 password hashing — Cloud Phase 13.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { DUMMY_HASH, hashPassword, verifyPassword } from './passwords.mjs';

test('hash → verify round-trips; wrong password fails', async () => {
  const stored = await hashPassword('a-long-enough-password');
  assert.match(stored, /^pbkdf2\$600000\$[0-9a-f]{32}\$[0-9a-f]{64}$/);
  assert.equal(await verifyPassword('a-long-enough-password', stored), true);
  assert.equal(await verifyPassword('a-long-enough-passworD', stored), false);
});

test('two hashes of one password differ (salt), both verify', async () => {
  const a = await hashPassword('a-long-enough-password');
  const b = await hashPassword('a-long-enough-password');
  assert.notEqual(a, b);
  assert.equal(await verifyPassword('a-long-enough-password', b), true);
});

test('malformed stored values verify nothing and never throw', async () => {
  for (const bad of [
    '',
    'scrypt$1$2$3$s$h',
    'pbkdf2$notanumber$aa$bb',
    'pbkdf2$99999999999$aa$bb',
    null,
  ]) {
    assert.equal(await verifyPassword('whatever-password', bad), false, String(bad));
  }
});

test('short passwords are refused at hash time', async () => {
  await assert.rejects(() => hashPassword('short'));
});

test('the dummy hash burns cost but never matches', async () => {
  assert.equal(await verifyPassword('a-long-enough-password', DUMMY_HASH), false);
});

test('no single derive call exceeds the platform cap of 100k iterations', async (t) => {
  // The bug this pins: Workers' WebCrypto refuses >100k per call, so the OWASP
  // 600k floor has to be reached by CHAINING, not by one big call. Lowering
  // the work factor to fit the cap would weaken every password in the system.
  const seen = [];
  const realImport = crypto.subtle.deriveBits.bind(crypto.subtle);
  crypto.subtle.deriveBits = (algo, ...rest) => {
    seen.push(algo.iterations);
    return realImport(algo, ...rest);
  };
  t.after(() => {
    crypto.subtle.deriveBits = realImport;
  });

  const stored = await hashPassword('a-long-enough-password');
  assert.ok(seen.length >= 6, `expected chained rounds, saw ${seen.length}`);
  assert.ok(Math.max(...seen) <= 100_000, `a call requested ${Math.max(...seen)} iterations`);
  assert.equal(
    seen.reduce((a, b) => a + b, 0),
    600_000,
    'total work is still the OWASP floor'
  );
  assert.equal(await verifyPassword('a-long-enough-password', stored), true);
});
