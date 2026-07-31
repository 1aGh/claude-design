// Project grants — Cloud Phase 13.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { mintGrant, verifyGrant } from './grants.mjs';

const S = 'shared-cell-secret';
const NOW = 1_800_000_000_000;

test('a grant round-trips with its scope intact', async () => {
  const g = await mintGrant({ projectId: 'alligators', accountId: 'acct_1', email: 'a@b.cz' }, S, {
    now: NOW,
  });
  const v = await verifyGrant(g, S, { now: NOW + 1000 });
  assert.equal(v.ok, true);
  assert.deepEqual(
    { p: v.grant.projectId, a: v.grant.accountId, e: v.grant.email },
    { p: 'alligators', a: 'acct_1', e: 'a@b.cz' }
  );
});

test('expiry is part of validity — ten minutes, not a standing credential', async () => {
  const g = await mintGrant({ projectId: 'p', accountId: 'a' }, S, { now: NOW });
  assert.equal((await verifyGrant(g, S, { now: NOW + 11 * 60_000 })).reason, 'expired');
});

test('a tampered payload dies on the signature', async () => {
  const g = await mintGrant({ projectId: 'p', accountId: 'a' }, S, { now: NOW });
  const [head, sig] = g.split('.');
  const forged = `${head.slice(0, -2)}xx.${sig}`;
  assert.equal((await verifyGrant(forged, S, { now: NOW })).ok, false);
});

test('the wrong secret verifies nothing; a missing one refuses honestly', async () => {
  const g = await mintGrant({ projectId: 'p', accountId: 'a' }, S, { now: NOW });
  assert.equal((await verifyGrant(g, 'other-secret', { now: NOW })).reason, 'bad-signature');
  assert.equal((await verifyGrant(g, '', { now: NOW })).reason, 'not-configured');
});
