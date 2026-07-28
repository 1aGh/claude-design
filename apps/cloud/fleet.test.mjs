// Cloud Phase 9 Tasks 1-2 — fleet upgrade, rollback, board, cost alarms.
//
// The phase's exit gate is "one-command upgrade + a REHEARSED rollback, zero
// data loss". A rollback nobody has rehearsed is a rollback that does not work,
// so the rehearsal lives here where it runs on every commit.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  CHECKPOINT_MAX_AGE_MINUTES,
  costAlarms,
  DRILL_MAX_AGE_DAYS,
  detectDrift,
  fleetBoard,
  nextUpgradeStep,
  planRollback,
  planWaves,
} from './fleet.mjs';

const T0 = 1_800_000_000_000;
const cell = (id, over = {}) => ({
  id,
  version: 'v1',
  previousVersion: 'v0',
  health: 'healthy',
  canary: false,
  lastRestoreDrill: T0 - 3600_000,
  lastCheckpoint: T0 - 60_000,
  config: { memoryMib: 2048, scaleToZero: true },
  ...over,
});

const fleet = () => [
  cell('alligators', { canary: true }),
  cell('acme'),
  cell('beta'),
  cell('gamma'),
];

// ------------------------------------------------------------------ waves

test('the canary is wave 0 and is ALWAYS alone', () => {
  // Batching the canary with others means a bad image reaches several tenants
  // before anyone looks — the entire thing a canary exists to prevent.
  const waves = planWaves(fleet(), { batchSize: 2 });
  assert.deepEqual(waves[0], { kind: 'canary', cells: ['alligators'] });
  assert.deepEqual(waves.slice(1), [
    { kind: 'batch', cells: ['acme', 'beta'] },
    { kind: 'batch', cells: ['gamma'] },
  ]);
});

test('several canaries still go one at a time', () => {
  // Two simultaneous canaries make "which change broke it" ambiguous.
  const waves = planWaves([cell('a', { canary: true }), cell('b', { canary: true }), cell('c')]);
  assert.deepEqual(waves.slice(0, 2), [
    { kind: 'canary', cells: ['a'] },
    { kind: 'canary', cells: ['b'] },
  ]);
});

// ---------------------------------------------------------------- upgrade

test('an upgrade rolls the canary first and will not skip ahead', () => {
  const cells = fleet();
  const first = nextUpgradeStep(cells, 'v2', { batchSize: 2 });
  assert.equal(first.action, 'upgrade');
  assert.equal(first.kind, 'canary');
  assert.deepEqual(first.cells, ['alligators']);
});

test('a wave WAITS while the previous one is still settling', () => {
  const cells = fleet();
  cells[0] = cell('alligators', { canary: true, version: 'v2', health: 'unknown' });
  const step = nextUpgradeStep(cells, 'v2');
  assert.equal(step.action, 'wait');
  assert.deepEqual(step.cells, ['alligators']);
});

test('a healthy canary lets the first batch go', () => {
  const cells = fleet();
  cells[0] = cell('alligators', { canary: true, version: 'v2', health: 'healthy' });
  const step = nextUpgradeStep(cells, 'v2', { batchSize: 2 });
  assert.equal(step.action, 'upgrade');
  assert.equal(step.kind, 'batch');
  assert.deepEqual(step.cells, ['acme', 'beta']);
});

test('an UNHEALTHY canary HALTS the whole fleet — there is no --force', () => {
  // If you want to skip the canary you change the canary.
  const cells = fleet();
  cells[0] = cell('alligators', { canary: true, version: 'v2', health: 'degraded' });
  const step = nextUpgradeStep(cells, 'v2');
  assert.equal(step.action, 'halt');
  assert.deepEqual(step.cells, ['alligators']);
  assert.match(step.reason, /unhealthy/);
});

test('halting is NOT rolling back — stopping is automatic, undoing is a decision', () => {
  // An upgrade that auto-reverts on the first blip will flap, and it will do so
  // at the worst possible moment.
  const cells = fleet();
  cells[1] = cell('acme', { version: 'v2', health: 'down' });
  const step = nextUpgradeStep(cells, 'v2');
  assert.equal(step.action, 'halt');
  assert.ok(!('rollback' in step));
});

test('a fully-upgraded healthy fleet is done, and re-running changes nothing', () => {
  const cells = fleet().map((c) => ({ ...c, version: 'v2', health: 'healthy' }));
  assert.deepEqual(nextUpgradeStep(cells, 'v2'), { action: 'done' });
  assert.deepEqual(nextUpgradeStep(cells, 'v2'), { action: 'done' });
});

test('a full upgrade converges in a bounded number of steps', () => {
  // The rehearsal: drive the whole thing, one step at a time, as the operator's
  // one command would.
  let cells = fleet();
  const performed = [];
  for (let guard = 0; guard < 20; guard++) {
    const step = nextUpgradeStep(cells, 'v2', { batchSize: 2 });
    if (step.action === 'done') break;
    assert.notEqual(step.action, 'halt', `unexpected halt: ${JSON.stringify(step)}`);
    if (step.action === 'upgrade') {
      performed.push(step.cells);
      cells = cells.map((c) =>
        step.cells.includes(c.id)
          ? { ...c, previousVersion: c.version, version: 'v2', health: 'healthy' }
          : c
      );
    }
  }
  assert.deepEqual(performed, [['alligators'], ['acme', 'beta'], ['gamma']]);
  assert.deepEqual(nextUpgradeStep(cells, 'v2'), { action: 'done' });
});

// --------------------------------------------------------------- rollback

test('the REHEARSED rollback: re-pin, never rebuild', () => {
  // A rollback that needs CI to be green is unavailable exactly when needed.
  const cells = fleet().map((c) => ({ ...c, version: 'v2', previousVersion: 'v1' }));
  const { plan, problems } = planRollback(cells);
  assert.deepEqual(problems, []);
  assert.deepEqual(
    plan.map((p) => [p.id, p.from, p.to]),
    [
      ['alligators', 'v2', 'v1'],
      ['acme', 'v2', 'v1'],
      ['beta', 'v2', 'v1'],
      ['gamma', 'v2', 'v1'],
    ]
  );
});

test('a cell with no recorded previous version is REPORTED, never skipped', () => {
  // Silently leaving one cell forward during a rollback is how a fleet ends up
  // in two states nobody can reason about.
  const cells = [
    cell('acme', { version: 'v2' }),
    cell('orphan', { version: 'v2', previousVersion: null }),
  ];
  const { plan, problems } = planRollback(cells);
  assert.deepEqual(
    plan.map((p) => p.id),
    ['acme']
  );
  assert.equal(problems.length, 1);
  assert.equal(problems[0].id, 'orphan');
  assert.match(problems[0].problem, /cannot roll back/);
});

test('rollback can target a subset, and is a no-op where nothing changed', () => {
  const cells = fleet().map((c) => ({ ...c, version: 'v2', previousVersion: 'v1' }));
  const { plan } = planRollback(cells, { only: ['acme'] });
  assert.deepEqual(
    plan.map((p) => p.id),
    ['acme']
  );

  const alreadyBack = [cell('acme', { version: 'v1', previousVersion: 'v1' })];
  assert.deepEqual(planRollback(alreadyBack).plan, []);
});

// ------------------------------------------------------------------ drift

test('a hand-fixed cell is visible BEFORE the upgrade, not during it', () => {
  // "A bespoke cell is a bug." The cell somebody patched at 3am is the one that
  // breaks the next upgrade, silently.
  const template = { memoryMib: 2048, scaleToZero: true };
  const cells = [cell('acme'), cell('bespoke', { config: { memoryMib: 4096, scaleToZero: true } })];
  const drift = detectDrift(cells, template);
  assert.equal(drift.length, 1);
  assert.equal(drift[0].id, 'bespoke');
  assert.deepEqual(drift[0].differences, [{ key: 'memoryMib', expected: 2048, actual: 4096 }]);
});

test('a MISSING config key counts as drift, not as agreement', () => {
  const drift = detectDrift([cell('bare', { config: {} })], { memoryMib: 2048 });
  assert.deepEqual(drift[0].differences, [{ key: 'memoryMib', expected: 2048, actual: null }]);
});

// ------------------------------------------------------------------ board

test('a healthy fleet reports no problems', () => {
  const board = fleetBoard(fleet(), { now: T0, template: { memoryMib: 2048, scaleToZero: true } });
  assert.equal(board.ok, true);
  assert.deepEqual(board.problems, []);
  assert.deepEqual(board.versions, ['v1']);
});

test('a STALE RESTORE DRILL is a first-class problem, not a footnote', () => {
  // A fleet whose backups are untested is a fleet with no backups, and it looks
  // identical to a healthy one.
  const cells = [
    cell('stale', { lastRestoreDrill: T0 - (DRILL_MAX_AGE_DAYS + 1) * 86_400_000 }),
    cell('never', { lastRestoreDrill: null }),
  ];
  const board = fleetBoard(cells, { now: T0 });
  const kinds = board.problems.map((p) => p.kind);
  assert.ok(kinds.includes('stale-drill'));
  assert.ok(kinds.includes('never-drilled'));
  assert.equal(board.ok, false);
});

test('a stopped machine and a stale checkpoint both surface', () => {
  // The plan's validation: "the board reflects a manufactured failure within
  // one reconcile cycle."
  const cells = [
    cell('down', { health: 'down' }),
    cell('lagging', { lastCheckpoint: T0 - (CHECKPOINT_MAX_AGE_MINUTES + 5) * 60_000 }),
    cell('never', { lastCheckpoint: null }),
  ];
  const board = fleetBoard(cells, { now: T0 });
  const kinds = board.problems.map((p) => p.kind);
  assert.ok(kinds.includes('unhealthy'));
  assert.ok(kinds.includes('stale-checkpoint'));
  assert.ok(kinds.includes('no-checkpoint'));
});

test('a split-version fleet is called out as one problem, not N rows', () => {
  const cells = [cell('a'), cell('b', { version: 'v2' })];
  const board = fleetBoard(cells, { now: T0 });
  const spread = board.problems.find((p) => p.kind === 'version-spread');
  assert.ok(spread);
  assert.match(spread.detail, /v1, v2/);
});

// ------------------------------------------------------------------- cost

test('cost alarms fire on the RATIO, not the absolute', () => {
  // "€40 this month" means nothing without knowing there are 20 cells.
  const cheap = costAlarms({ compute: 40, r2: 5 }, { cells: 20 });
  assert.equal(cheap.ok, true, 'a big total across many cells is fine');

  const expensive = costAlarms({ compute: 40, r2: 5 }, { cells: 2 });
  assert.equal(expensive.ok, false);
  assert.match(expensive.alarms[0].detail, /vs a €3 model/);
});

test('ANY R2 egress charge is an alarm — it should be zero by design', () => {
  // The provider choice is partly because egress is free (DDR-193 §1), so a
  // bill for it means something is routing around the design.
  const res = costAlarms({ compute: 3, r2Egress: 0.01 }, { cells: 1 });
  assert.ok(res.alarms.some((a) => a.kind === 'unexpected-egress'));
});
