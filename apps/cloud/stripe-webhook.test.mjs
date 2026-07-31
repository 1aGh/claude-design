// Stripe webhook verification — Cloud Phase 12.

import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { test } from 'node:test';

import {
  parseSignatureHeader,
  projectRefFromEvent,
  verifyStripeSignature,
} from './stripe-webhook.mjs';

const SECRET = 'whsec_test_secret_value';
const NOW = 1_800_000_000_000;

/** Build a header exactly the way Stripe does. */
function sign(body, { secret = SECRET, at = NOW / 1000 } = {}) {
  const t = Math.floor(at);
  const sig = createHmac('sha256', secret).update(`${t}.${body}`).digest('hex');
  return `t=${t},v1=${sig}`;
}

test('a genuine signature verifies', async () => {
  const body = '{"type":"invoice.paid"}';
  const res = await verifyStripeSignature(body, sign(body), SECRET, { now: NOW });
  assert.deepEqual(res, { ok: true });
});

test('a REPLAYED webhook fails on age, even with a valid signature', async () => {
  // A valid signature on an old payload is a replay, not a webhook.
  const body = '{"type":"invoice.paid"}';
  const old = sign(body, { at: NOW / 1000 - 3600 });
  const res = await verifyStripeSignature(body, old, SECRET, { now: NOW });
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'timestamp-outside-tolerance');
});

test('a tampered body fails', async () => {
  const res = await verifyStripeSignature('{"amount":9999}', sign('{"amount":1}'), SECRET, {
    now: NOW,
  });
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'signature-mismatch');
});

test('the wrong secret fails', async () => {
  const body = '{}';
  const res = await verifyStripeSignature(body, sign(body, { secret: 'whsec_other' }), SECRET, {
    now: NOW,
  });
  assert.equal(res.ok, false);
});

test('NO configured secret refuses everything — never an open webhook', async () => {
  const body = '{}';
  const res = await verifyStripeSignature(body, sign(body), '', { now: NOW });
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'no-signing-secret-configured');
});

test('malformed headers are rejected, not crashed on', () => {
  for (const bad of [
    '',
    'nonsense',
    `t=abc,v1=${'f'.repeat(64)}`,
    't=123',
    `v1=${'a'.repeat(64)}`,
    't=1,v1=short',
    null,
    undefined,
  ]) {
    assert.equal(parseSignatureHeader(bad), null, `should reject: ${String(bad).slice(0, 30)}`);
  }
});

test('rotation window: any ONE valid v1 among several passes', async () => {
  const body = '{"ok":true}';
  const t = Math.floor(NOW / 1000);
  const good = createHmac('sha256', SECRET).update(`${t}.${body}`).digest('hex');
  const stale = 'a'.repeat(64);
  const header = `t=${t},v1=${stale},v1=${good}`;
  const res = await verifyStripeSignature(body, header, SECRET, { now: NOW });
  assert.equal(res.ok, true);
});

// ------------------------------------------------------- event → project ref

test('checkout.session.completed names the project via metadata', () => {
  const ref = projectRefFromEvent({
    type: 'checkout.session.completed',
    data: { object: { metadata: { project_id: 'alligators' } } },
  });
  assert.deepEqual(ref, { projectId: 'alligators', reason: 'webhook' });
});

test('subscription + invoice events name the SUBSCRIPTION, never an instruction', () => {
  const sub = projectRefFromEvent({
    type: 'customer.subscription.updated',
    data: { object: { id: 'sub_123' } },
  });
  assert.deepEqual(sub, { subscriptionId: 'sub_123', reason: 'webhook' });

  const inv = projectRefFromEvent({
    type: 'invoice.payment_failed',
    data: { object: { id: 'in_1', subscription: 'sub_456' } },
  });
  assert.deepEqual(inv, { subscriptionId: 'sub_456', reason: 'webhook' });
});

test('an unhandled event type maps to null (acked, not acted on)', () => {
  assert.equal(projectRefFromEvent({ type: 'charge.refunded', data: { object: {} } }), null);
  assert.equal(projectRefFromEvent(undefined), null);
});
