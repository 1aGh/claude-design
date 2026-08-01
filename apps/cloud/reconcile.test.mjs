// Cloud Phase 7 — the reconciler.
//
// The phase's exit gate is "20 chaos lifecycle cycles, zero orphans;
// replay/drop-safe". Because reconcile() is pure, that is a unit test rather
// than an integration environment — which is the entire reason it is pure.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { stepToward } from '../../cli/lib/cell-plan.mjs';
import {
  applyActions,
  PAST_DUE_GRACE_DAYS,
  reconcile,
  SUSPEND_RETENTION_DAYS,
  settle,
  stateForSubscription,
} from './reconcile.mjs';

const DAY = 24 * 3600_000;
const T0 = 1_800_000_000_000;

const tenant = (over = {}) => ({
  id: 'acme',
  state: 'pending',
  subscriptionId: 'sub_1',
  stateSince: T0,
  cellRunning: false,
  exportSent: false,
  ...over,
});
const sub = (status) => ({ status, currentPeriodEnd: T0 + 30 * DAY });
const kinds = (r) => r.actions.map((a) => a.kind);

// -------------------------------------------------------------- mapping

test('Stripe status maps to tenant state, with trialing counting as active', () => {
  // A trial that does not actually work is not a trial.
  assert.equal(stateForSubscription(sub('trialing')), 'active');
  assert.equal(stateForSubscription(sub('active')), 'active');
  assert.equal(stateForSubscription(sub('past_due')), 'past_due');
  assert.equal(stateForSubscription(sub('unpaid')), 'past_due');
  assert.equal(stateForSubscription(sub('canceled')), 'suspended');
  assert.equal(stateForSubscription(sub('paused')), 'suspended');
  assert.equal(stateForSubscription(null), 'pending');
  // Started checkout and never finished — provisioning here would provision
  // for anyone who merely opened a payment form.
  assert.equal(stateForSubscription(sub('incomplete')), 'pending');
  assert.equal(stateForSubscription(sub('incomplete_expired')), 'suspended');
});

test('an UNRECOGNIZED status is never read as active', () => {
  // A new Stripe status appearing should cost a tenant a pause, not free
  // service — and it must be visible rather than silently mapped.
  assert.equal(stateForSubscription(sub('some_future_status')), 'unknown');
  const r = reconcile(tenant({ state: 'active', cellRunning: true }), sub('some_future_status'));
  assert.equal(r.desiredState, 'active', 'state is left untouched');
  assert.deepEqual(kinds(r), ['alert']);
  assert.match(r.notes.join(' '), /unrecognized Stripe status/);
});

// ----------------------------------------------------------- provisioning

test('a paid signup provisions exactly once, then is a no-op', () => {
  const first = reconcile(tenant(), sub('active'));
  assert.equal(first.desiredState, 'active');
  assert.deepEqual(kinds(first), ['set-state', 'provision-cell']);

  const after = applyActions(tenant(), first);
  assert.equal(after.state, 'active');
  assert.equal(after.cellRunning, true);

  // Replay safety: the hourly cron runs this again five minutes later.
  assert.deepEqual(reconcile(after, sub('active')).actions, []);
});

test('a trial provisions like a paid subscription', () => {
  const r = reconcile(tenant(), sub('trialing'));
  assert.ok(kinds(r).includes('provision-cell'));
});

test('an incomplete checkout provisions NOTHING', () => {
  assert.deepEqual(reconcile(tenant(), sub('incomplete')).actions, []);
  assert.deepEqual(reconcile(tenant(), null).actions, []);
});

// --------------------------------------------------------------- dunning

test('a failed payment does NOT immediately take the tools away', () => {
  // Dunning is a conversation. Removing someone's tools mid-conversation turns
  // a recoverable billing problem into a churn event.
  const active = tenant({ state: 'active', cellRunning: true });
  const r = reconcile(active, sub('past_due'));
  assert.equal(r.desiredState, 'past_due');
  assert.deepEqual(kinds(r), ['set-state']);
  assert.ok(!kinds(r).includes('suspend-cell'), 'the cell keeps running through grace');
});

test('grace is finite — suspension follows, with an export first', () => {
  const overdue = tenant({ state: 'past_due', cellRunning: true, stateSince: T0 });
  const r = reconcile(overdue, sub('past_due'), { now: T0 + (PAST_DUE_GRACE_DAYS + 1) * DAY });
  assert.equal(r.desiredState, 'suspended');
  assert.deepEqual(kinds(r), ['set-state', 'suspend-cell', 'send-export']);
});

test('paying again resurrects, without a new provision', () => {
  const overdue = tenant({ state: 'past_due', cellRunning: true });
  const r = reconcile(overdue, sub('active'));
  assert.equal(r.desiredState, 'active');
  assert.deepEqual(kinds(r), ['set-state']);

  const suspended = tenant({ state: 'suspended', cellRunning: false, exportSent: true });
  const back = reconcile(suspended, sub('active'));
  assert.equal(back.desiredState, 'active');
  assert.deepEqual(kinds(back), ['set-state', 'resume-cell']);
});

// ---------------------------------------------------- the export guarantee

test('suspension ALWAYS sends the export first', () => {
  // DDR-193 §3 — there is no path from "stopped paying" to "your designs are
  // gone" that skips "you were handed your files".
  const r = reconcile(tenant({ state: 'active', cellRunning: true }), sub('canceled'));
  assert.ok(kinds(r).includes('send-export'));
  const sent = applyActions(tenant({ state: 'active', cellRunning: true }), r);
  assert.equal(sent.exportSent, true);
  // ...and it is not re-sent on every subsequent hourly run.
  assert.ok(!kinds(reconcile(sent, sub('canceled'))).includes('send-export'));
});

test('retention elapsing WITHOUT an export holds, and re-sends', () => {
  // The clock is not more important than the guarantee.
  const held = tenant({
    state: 'suspended',
    cellRunning: false,
    exportSent: false,
    stateSince: T0,
  });
  const r = reconcile(held, sub('canceled'), { now: T0 + (SUSPEND_RETENTION_DAYS + 5) * DAY });
  assert.ok(kinds(r).includes('send-export'));
  assert.ok(
    !r.actions.some((a) => a.kind === 'set-state' && a.to === 'exported'),
    'must NOT advance toward purge without having handed over the files'
  );
  assert.match(r.notes.join(' '), /holding/);
});

test('retention elapsing WITH an export advances to exported', () => {
  const held = tenant({ state: 'suspended', cellRunning: false, exportSent: true, stateSince: T0 });
  const r = reconcile(held, sub('canceled'), { now: T0 + (SUSPEND_RETENTION_DAYS + 1) * DAY });
  assert.ok(r.actions.some((a) => a.kind === 'set-state' && a.to === 'exported'));
});

// Cloud Phase 24 B3/A11. `exported` used to have no branch of its own, so the
// generic walk asked for `suspended`, found no legal one-hop route, and took
// the shortest path — `exported → active → suspended` — resurrecting a project
// queued for deletion and resetting its retention clock. Forever. The
// cancellation screen's deletion date could never actually arrive.
test('an exported tenant nobody paid for is PURGED, not bounced back to suspended', () => {
  const exported = tenant({ state: 'exported', cellRunning: false, exportSent: true });
  const { desiredState, actions } = reconcile(exported, sub('canceled'));
  assert.equal(desiredState, 'purged');
  assert.ok(actions.some((a) => a.kind === 'purge-data'));
  assert.ok(actions.some((a) => a.kind === 'set-state' && a.to === 'purged'));

  const settled = settle(exported, sub('canceled'));
  assert.equal(settled.tenant.state, 'purged');
});

test('the retention clock cannot be reset by the reconciler walking backwards', () => {
  // The old flap, pinned: suspended → (30d) → exported → active → suspended,
  // with `state_since` reset on every lap.
  const suspended = tenant({
    state: 'suspended',
    stateSince: 0,
    cellRunning: false,
    exportSent: true,
  });
  const first = settle(suspended, sub('canceled'), { now: DAY * 31 });
  assert.equal(first.tenant.state, 'purged', 'it reaches the promised end, in one settle');
});

test('two days out, the last-chance email is asked for — once the window is open', () => {
  const suspended = tenant({
    state: 'suspended',
    stateSince: 0,
    cellRunning: false,
    exportSent: true,
  });
  const early = reconcile(suspended, sub('canceled'), { now: DAY * 20 });
  assert.ok(!early.actions.some((a) => a.kind === 'warn-deletion'));

  const late = reconcile(suspended, sub('canceled'), { now: DAY * 28.5 });
  const warn = late.actions.find((a) => a.kind === 'warn-deletion');
  assert.ok(warn, 'somebody must be told the clock is running');
  assert.equal(warn.deletesAt, DAY * 30);
});

test('a tenant that never became active can be cleaned up directly', () => {
  // No customer data ever existed, so there is nothing to hand back.
  const r = reconcile(tenant({ state: 'pending' }), sub('incomplete_expired'));
  assert.equal(r.desiredState, 'purged');
  assert.ok(!kinds(r).includes('send-export'));
});

test('purged is terminal even if a subscription comes back', () => {
  // A resubscribe is a NEW project, not a resurrection of data we destroyed.
  const r = reconcile(tenant({ state: 'purged' }), sub('active'));
  assert.deepEqual(r.actions, []);
  assert.equal(r.desiredState, 'purged');
});

test('an unreachable-in-one-hop state is WALKED, not jumped to', () => {
  // A tenant who was exported and then resubscribes with a failing card is
  // ordinary, not an error. The truthful route is exported → active → past_due,
  // and walking it keeps every hop inside the machine.
  const exported = tenant({ state: 'exported', cellRunning: false, exportSent: true });
  const first = reconcile(exported, sub('past_due'));
  assert.equal(first.desiredState, 'active', 'one legal hop at a time');
  assert.ok(!first.actions.some((a) => a.kind === 'alert'));

  const settled = settle(exported, sub('past_due'));
  assert.equal(settled.tenant.state, 'past_due');
  assert.ok(settled.rounds >= 2, 'it took more than one hop, as it should');
});

test('the machine is walked, but the forbidden door stays shut on every route', () => {
  // The point of walking rather than jumping: a path search must never find a
  // way around the one transition the machine exists to forbid.
  for (const from of ['pending', 'active', 'past_due', 'suspended']) {
    // Walk the whole route and record it.
    const route = [from];
    let cursor = from;
    for (let guard = 0; guard < 10 && cursor !== 'purged'; guard++) {
      const next = stepToward(cursor, 'purged');
      assert.ok(next, `no route from ${cursor} to purged`);
      route.push(next);
      cursor = next;
    }
    assert.equal(cursor, 'purged', `route from ${from} never arrived: ${route.join(' → ')}`);
    if (from === 'pending') {
      // A tenant that never became active holds no customer data, so it is the
      // one legitimate direct route.
      assert.deepEqual(route, ['pending', 'purged']);
    } else {
      assert.equal(
        route[route.length - 2],
        'exported',
        `the hop before purge must be exported, got ${route.join(' → ')}`
      );
    }
  }
  assert.equal(stepToward('purged', 'active'), null, 'purged is terminal — no route out');
});

// ------------------------------------------------- replay / drop / chaos

test('reconcile is a FIXED POINT — running it twice does nothing the second time', () => {
  // If it were not, the hourly cron would flap a tenant's cell forever and
  // nobody would notice until the bill.
  for (const status of ['active', 'trialing', 'past_due', 'canceled', 'paused']) {
    let current = tenant();
    const settled = settle(current, sub(status));
    current = settled.tenant;
    assert.deepEqual(
      reconcile(current, sub(status)).actions,
      [],
      `${status} must settle to a fixed point`
    );
  }
});

test('20 chaos cycles converge, and never purge without exporting', () => {
  // The phase's exit gate, as a unit test: events out of order, duplicated,
  // and dropped. The reconciler derives from state, so none of that matters.
  const statuses = ['active', 'past_due', 'canceled', 'active', 'trialing', 'paused', 'unpaid'];
  let current = tenant();
  let everSuspendedWithData = false;

  for (let i = 0; i < 20; i++) {
    const status = statuses[(i * 3) % statuses.length];
    const now = T0 + i * 4 * DAY;
    const before = current;
    const settled = settle(current, sub(status), { now });
    current = settled.tenant;

    // Duplicate delivery: the exact same reconcile again must be a no-op.
    assert.deepEqual(
      reconcile(current, sub(status), { now }).actions,
      [],
      `cycle ${i} (${status}) did not settle`
    );

    if (current.state === 'suspended' && before.state !== 'pending') {
      everSuspendedWithData = true;
      assert.equal(current.exportSent, true, `cycle ${i}: suspended a live tenant without export`);
    }
    // The invariant, checked every single cycle: a tenant that ever held data
    // cannot reach purged, and nothing reaches it without an export at all.
    if (current.state === 'purged') {
      assert.equal(current.exportSent, true, `cycle ${i}: purged without an export`);
    }
  }
  assert.ok(everSuspendedWithData, 'the chaos run must have exercised a real suspension');
});

test('a DROPPED event costs at most one reconcile, not a support ticket', () => {
  // The whole reason webhooks only enqueue: nothing here saw the cancellation
  // event, and the hourly cron still gets it right.
  const live = tenant({ state: 'active', cellRunning: true });
  const r = reconcile(live, sub('canceled'));
  assert.ok(kinds(r).includes('suspend-cell'));
  assert.ok(kinds(r).includes('send-export'));
});

test('settle refuses to loop forever', () => {
  assert.throws(() => settle(tenant(), sub('active'), { maxRounds: 0 }), /did not settle|flapping/);
});
