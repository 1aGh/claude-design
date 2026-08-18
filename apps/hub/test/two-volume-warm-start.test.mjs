// The boot decision — Phase 0 F4 + Track A' A1.
//
// THE SHIPPED BUG, and it is live in production cells: `infra/cell/entrypoint.sh`
// decided warm-vs-cold with `[ -f /data/hub.db ]`. The cell has one volume, so
// that held. A workspace has TWO — `/data` and `/repo` — and `/data` intact
// with `/repo` lost reads as a warm start under that test: rehydrate is
// skipped, boot continues, and `seedRepo` clones MAUDE_SEED_REPO over a
// checkout that had merely gone missing. A green boot and a silent history
// loss. The Docker path was worse still: no entrypoint at all, so it never
// even asked.
//
// The row that matters most here is `refuse`. It is the one a later edit
// "simplifies" into a restore, and the reason it must not be is that neither
// automatic answer is safe: restoring the checkout alone pairs it with newer
// documents, restoring the whole generation discards them.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { decideBoot } from '../src/rehydrate.mjs';

const boot = (over) =>
  decideBoot({
    dataPopulated: false,
    repoPopulated: false,
    generationCount: 0,
    workspaceMode: true,
    ...over,
  });

test('a healthy restart proceeds', () => {
  assert.equal(boot({ dataPopulated: true, repoPopulated: true }).action, 'proceed');
});

test('REFUSES when the documents are present but the checkout is gone', () => {
  // The two-volume bug. Under the old shell test this was a warm start.
  const v = boot({ dataPopulated: true, repoPopulated: false, generationCount: 3 });
  assert.equal(v.action, 'refuse');
  assert.match(v.reason, /checkout is gone/);
});

test('the same shape proceeds for a plain hub, which has no checkout at all', () => {
  // A relay hub's `/repo` is empty on every boot; refusing there would break
  // the deployment that never had a checkout in the first place.
  assert.equal(
    boot({ dataPopulated: true, repoPopulated: false, workspaceMode: false }).action,
    'proceed'
  );
});

test('total loss with generations restores', () => {
  assert.equal(boot({ generationCount: 2 }).action, 'restore');
});

test('total loss with no generations seeds when a seed is configured', () => {
  assert.equal(boot({ seedConfigured: true }).action, 'seed');
});

test('a genuine first boot starts fresh', () => {
  assert.equal(boot({}).action, 'fresh');
});

test('an unreachable backup target proceeds rather than stopping the hub', () => {
  // Conditions gate machines: "the bucket did not answer" is not evidence that
  // anything was lost, and converting a storage blip into an outage is the
  // trade this whole track exists to avoid.
  const v = boot({ dataPopulated: true, repoPopulated: false, listFailed: true });
  assert.equal(v.action, 'proceed');
});

test('MAUDE_ALLOW_EMPTY_START overrides the refusal', () => {
  assert.equal(
    boot({ dataPopulated: true, repoPopulated: false, generationCount: 3, allowEmptyStart: true })
      .action,
    'proceed'
  );
});

test('seeding is never reachable while a generation exists', () => {
  // `seedRepo` gates on the SAME emptiness condition a restore fires on, so
  // restore-before-seed has to be a property of the table rather than an
  // ordering coincidence in the caller.
  for (const seedConfigured of [true, false]) {
    assert.equal(boot({ generationCount: 1, seedConfigured }).action, 'restore');
  }
});
