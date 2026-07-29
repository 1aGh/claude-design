// Cloud Phase 14 — provision first, charge after.
//
// One rule, and it is the product promise: nobody is charged for a workspace
// that did not come up. These tests exist so the ordering cannot be reversed
// by accident while somebody is adding a feature.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  chargeIsPermitted,
  decideCheckout,
  PROVISION_TIMEOUT_MS,
  waitingRoom,
} from './provisioning.mjs';

const T0 = 1_700_000_000_000;
const attempt = (over = {}) => ({
  payment: 'authorized',
  provision: 'pending',
  authorizedAt: T0,
  ...over,
});

describe('a charge cannot precede a healthy workspace', () => {
  it('is stated as a rule, over every combination', () => {
    // Asserted exhaustively rather than through the decision function, so a
    // future branch in `decideCheckout` cannot quietly create a path that
    // charges without a healthy workspace.
    for (const payment of ['authorized', 'charged', 'voided']) {
      for (const provision of ['pending', 'healthy', 'failed']) {
        const permitted = chargeIsPermitted({ payment, provision });
        assert.equal(
          permitted,
          payment === 'authorized' && provision === 'healthy',
          `${payment} × ${provision}`
        );
      }
    }
  });

  it('charges only once the workspace answers', () => {
    assert.equal(decideCheckout(attempt({ provision: 'healthy' }), { now: T0 }).outcome, 'charge');
    assert.equal(decideCheckout(attempt(), { now: T0 }).outcome, 'waiting');
  });
});

describe('a failure costs the customer nothing', () => {
  it('voids on a provisioning failure', () => {
    const d = decideCheckout(attempt({ provision: 'failed' }), { now: T0 });
    assert.equal(d.outcome, 'void');
    // The thing they are actually worried about, said first.
    assert.match(d.tellCustomer, /you have not been charged/);
    assert.match(d.tellCustomer, /Nothing was taken from your card/);
  });

  it('voids when provisioning simply never finishes', () => {
    // The silent case. Without a timeout an authorization sits there, and the
    // person is left not knowing whether they paid.
    const d = decideCheckout(attempt(), { now: T0 + PROVISION_TIMEOUT_MS });
    assert.equal(d.outcome, 'void');
    assert.match(d.tellCustomer, /released the hold on your card/);
    assert.match(d.tellCustomer, /have not been charged/);
  });

  it('does not void one millisecond early', () => {
    assert.equal(decideCheckout(attempt(), { now: T0 + PROVISION_TIMEOUT_MS - 1 }).outcome, 'waiting');
  });
});

describe('webhooks arrive more than once', () => {
  it('a settled payment is never settled again', () => {
    // Stripe redelivers as a matter of course. A second delivery that charged
    // again would be the single worst bug this file can have.
    for (const payment of ['charged', 'voided']) {
      const d = decideCheckout(attempt({ payment, provision: 'healthy' }), { now: T0 });
      assert.equal(d.outcome, 'already-settled', payment);
      assert.equal(d.tellCustomer, null, 'and says nothing a second time');
    }
  });
});

describe('the waiting room is honest', () => {
  it('answers "have I been charged?" before anyone asks', () => {
    // That question arrives long before any email does, so the reassurance
    // belongs on the screen the person is already looking at.
    const w = waitingRoom(attempt(), { now: T0 });
    assert.equal(w.done, false);
    assert.match(w.note, /card has not been charged yet/);
  });

  it('names steps rather than inventing a percentage', () => {
    // A percentage made up from nothing is a lie that gets found out at 90%.
    const w = waitingRoom(attempt(), { now: T0 });
    assert.deepEqual(w.steps.map((s) => s.key), ['account', 'workspace', 'project', 'ready']);
    assert.ok(!('percent' in w));
  });

  it('ends on ready when the workspace is up', () => {
    const w = waitingRoom(attempt({ provision: 'healthy' }), { now: T0 });
    assert.equal(w.step, 'ready');
    assert.equal(w.done, true);
  });

  it('carries the failure sentence through to the screen', () => {
    const w = waitingRoom(attempt({ provision: 'failed' }), { now: T0 });
    assert.equal(w.done, true);
    assert.match(w.note, /not been charged/);
  });
});

describe('the customer-facing wording', () => {
  it('never uses our vocabulary for our problems', () => {
    const said = ['pending', 'healthy', 'failed']
      .map((provision) => decideCheckout(attempt({ provision }), { now: T0 + PROVISION_TIMEOUT_MS }))
      .map((d) => d.tellCustomer)
      .filter(Boolean)
      .join(' ');
    for (const jargon of ['tenant', 'cell', 'provision', 'reconcil', 'webhook', 'R2', 'container']) {
      assert.ok(!new RegExp(jargon, 'i').test(said), `"${jargon}" leaked into a customer message`);
    }
  });
});
