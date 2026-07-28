// Fleet operations — Cloud Phase 9 Task 1/2.
//
// Operating N cells is a different problem from operating one, and the way it
// goes wrong is specific: an upgrade that rolls to everybody at once turns one
// bad image into a total outage, and a rollback nobody has rehearsed is a
// rollback that does not work.
//
// So the two things this file is actually about:
//
//   1. A CANARY THAT CANNOT BE SKIPPED. Waves are ordered, the canary is
//      always wave 0, and a wave never starts while the previous one is
//      unhealthy. `--force` does not exist here; if you want to skip the
//      canary you change the canary.
//   2. ROLLBACK IS A RE-PIN, NOT A REBUILD. Every cell records the version it
//      is on AND the one it came from, so going back is one write and a
//      restart rather than a build. A rollback that needs CI to be green is a
//      rollback that is unavailable exactly when you need it.
//
// "A bespoke cell is a bug" — `detectDrift` compares each cell against the
// template, because the cell somebody hand-fixed at 3am is the one that breaks
// the next upgrade.
//
// Pure, like reconcile.mjs: takes fleet state, returns a plan. The executor
// performs it. Which is what lets a rehearsed rollback be a test.

/** Health a cell must report before the next wave may start. */
const HEALTHY = 'healthy';

/**
 * @typedef {object} Cell
 * @property {string} id
 * @property {string} version        image tag it is pinned to
 * @property {string|null} previousVersion
 * @property {'healthy'|'degraded'|'down'|'unknown'} health
 * @property {boolean} canary
 * @property {number|null} lastRestoreDrill  ms epoch
 * @property {number|null} lastCheckpoint    ms epoch — last replication to R2
 * @property {object} [config]
 */

/**
 * Split the fleet into ordered upgrade waves.
 *
 * The canary is ALWAYS wave 0 and always alone. Batching it with others would
 * mean a bad image reaches several tenants before anyone looks, which is the
 * entire thing a canary exists to prevent.
 */
export function planWaves(cells, { batchSize = 5 } = {}) {
  const pending = cells.filter((c) => c.version !== undefined);
  const canaries = pending.filter((c) => c.canary);
  const rest = pending.filter((c) => !c.canary).sort((a, b) => a.id.localeCompare(b.id));

  const waves = [];
  if (canaries.length > 0) {
    // Even several canaries go one at a time: two simultaneous canaries make
    // "which change broke it" ambiguous.
    for (const c of canaries) waves.push({ kind: 'canary', cells: [c.id] });
  }
  for (let i = 0; i < rest.length; i += batchSize) {
    waves.push({ kind: 'batch', cells: rest.slice(i, i + batchSize).map((c) => c.id) });
  }
  return waves;
}

/**
 * The next action in an upgrade, given what has happened so far.
 *
 * Returns one of:
 *   `{ action: 'upgrade', cells, wave }`  — roll this wave
 *   `{ action: 'wait',    cells, wave }`  — a wave is still settling
 *   `{ action: 'halt',    reason, cells }`— something is unhealthy; STOP
 *   `{ action: 'done' }`
 *
 * `halt` is not `rollback`: stopping is automatic, undoing is a decision. An
 * upgrade that auto-reverts on the first blip will flap, and it will do so at
 * the worst moment.
 */
export function nextUpgradeStep(cells, targetVersion, { batchSize = 5 } = {}) {
  const byId = new Map(cells.map((c) => [c.id, c]));
  const waves = planWaves(cells, { batchSize });

  for (const [index, wave] of waves.entries()) {
    const members = wave.cells.map((id) => byId.get(id)).filter(Boolean);
    const upgraded = members.filter((c) => c.version === targetVersion);

    if (upgraded.length < members.length) {
      // Never start a wave while ANY earlier cell is unhealthy — including
      // cells not in this wave, because the canary's problem is the fleet's.
      const unhealthy = cells
        .filter((c) => c.version === targetVersion && c.health !== HEALTHY)
        .map((c) => c.id);
      if (unhealthy.length > 0) {
        return {
          action: 'halt',
          reason: 'a cell on the new version is not healthy',
          cells: unhealthy,
          wave: index,
        };
      }
      return { action: 'upgrade', cells: wave.cells, wave: index, kind: wave.kind };
    }

    const settling = upgraded.filter((c) => c.health === 'unknown').map((c) => c.id);
    if (settling.length > 0) {
      return { action: 'wait', cells: settling, wave: index, kind: wave.kind };
    }
    const broken = upgraded.filter((c) => c.health !== HEALTHY).map((c) => c.id);
    if (broken.length > 0) {
      return {
        action: 'halt',
        reason: 'the wave came up unhealthy',
        cells: broken,
        wave: index,
        kind: wave.kind,
      };
    }
  }
  return { action: 'done' };
}

/**
 * Roll a set of cells back to the version they came from.
 *
 * A re-pin, never a rebuild — a rollback that needs CI is unavailable exactly
 * when it is needed. A cell with no recorded previous version is REPORTED
 * rather than skipped: silently leaving one cell forward during a rollback is
 * how a fleet ends up in two states nobody can reason about.
 */
export function planRollback(cells, { only } = {}) {
  const target = only ? cells.filter((c) => only.includes(c.id)) : cells;
  const plan = [];
  const problems = [];
  for (const cell of target) {
    if (!cell.previousVersion) {
      problems.push({ id: cell.id, problem: 'no recorded previous version — cannot roll back' });
      continue;
    }
    if (cell.previousVersion === cell.version) continue;
    plan.push({ id: cell.id, from: cell.version, to: cell.previousVersion });
  }
  return { plan, problems };
}

/**
 * Compare each cell against the template. "A bespoke cell is a bug."
 *
 * The cell somebody hand-fixed at 3am is the one that breaks the next upgrade,
 * and it breaks it silently, so drift has to be visible before the upgrade
 * rather than discovered during it.
 */
export function detectDrift(cells, template) {
  const drifted = [];
  for (const cell of cells) {
    const differences = [];
    for (const [key, expected] of Object.entries(template)) {
      const actual = cell.config?.[key];
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        differences.push({ key, expected, actual: actual ?? null });
      }
    }
    if (differences.length > 0) drifted.push({ id: cell.id, differences });
  }
  return drifted;
}

/** A restore drill older than this is treated as not having happened. */
export const DRILL_MAX_AGE_DAYS = 7;
/** A replication checkpoint older than this means the cell is not durable. */
export const CHECKPOINT_MAX_AGE_MINUTES = 30;

/**
 * The operator board, as data.
 *
 * `problems` is what makes it a board rather than a table: a list of rows an
 * operator has to interpret is one they stop reading. A stale RESTORE DRILL is
 * a first-class problem here, not a footnote — a fleet whose backups are
 * untested is a fleet with no backups, and it looks identical to a healthy one.
 */
export function fleetBoard(cells, { now = Date.now(), template } = {}) {
  const problems = [];
  const rows = cells.map((cell) => {
    const drillAgeDays =
      cell.lastRestoreDrill === null || cell.lastRestoreDrill === undefined
        ? null
        : (now - cell.lastRestoreDrill) / 86_400_000;
    const checkpointAgeMinutes =
      cell.lastCheckpoint === null || cell.lastCheckpoint === undefined
        ? null
        : (now - cell.lastCheckpoint) / 60_000;

    if (cell.health !== HEALTHY) {
      problems.push({ id: cell.id, kind: 'unhealthy', detail: `health is ${cell.health}` });
    }
    if (drillAgeDays === null) {
      problems.push({
        id: cell.id,
        kind: 'never-drilled',
        detail: 'no restore drill has ever run',
      });
    } else if (drillAgeDays > DRILL_MAX_AGE_DAYS) {
      problems.push({
        id: cell.id,
        kind: 'stale-drill',
        detail: `last restore drill was ${Math.floor(drillAgeDays)}d ago`,
      });
    }
    if (checkpointAgeMinutes === null) {
      problems.push({ id: cell.id, kind: 'no-checkpoint', detail: 'never replicated' });
    } else if (checkpointAgeMinutes > CHECKPOINT_MAX_AGE_MINUTES) {
      problems.push({
        id: cell.id,
        kind: 'stale-checkpoint',
        detail: `last replication was ${Math.floor(checkpointAgeMinutes)}m ago`,
      });
    }

    return {
      id: cell.id,
      version: cell.version,
      health: cell.health,
      canary: !!cell.canary,
      drillAgeDays: drillAgeDays === null ? null : Math.floor(drillAgeDays),
      checkpointAgeMinutes: checkpointAgeMinutes === null ? null : Math.floor(checkpointAgeMinutes),
    };
  });

  const versions = [...new Set(cells.map((c) => c.version))].sort();
  if (versions.length > 1) {
    problems.push({
      id: '(fleet)',
      kind: 'version-spread',
      detail: `cells are on ${versions.length} versions: ${versions.join(', ')}`,
    });
  }
  if (template) {
    for (const d of detectDrift(cells, template)) {
      problems.push({
        id: d.id,
        kind: 'config-drift',
        detail: d.differences.map((x) => x.key).join(', '),
      });
    }
  }

  return { rows, versions, problems, ok: problems.length === 0 };
}

/**
 * Compare observed spend against the Phase-0 model.
 *
 * Alarms on the RATIO, not the absolute: "€40 this month" means nothing without
 * knowing there are 20 cells. A per-cell cost several times the model is the
 * signal that the economics are wrong, and it is worth knowing long before the
 * invoice.
 */
export function costAlarms(actual, { cells, modelPerCellEur = 3, toleranceRatio = 2 } = {}) {
  const alarms = [];
  const total = Object.values(actual).reduce((sum, v) => sum + v, 0);
  const perCell = cells > 0 ? total / cells : total;
  if (cells > 0 && perCell > modelPerCellEur * toleranceRatio) {
    alarms.push({
      kind: 'per-cell-cost',
      detail: `€${perCell.toFixed(2)}/cell vs a €${modelPerCellEur} model (${(perCell / modelPerCellEur).toFixed(1)}×)`,
    });
  }
  // R2 egress being non-zero at all is worth saying out loud: the provider
  // choice (DDR-193 §1) is partly *because* egress is free, so a bill for it
  // means something is routing around the design.
  if ((actual.r2Egress ?? 0) > 0) {
    alarms.push({
      kind: 'unexpected-egress',
      detail: `R2 egress should be €0 — billed €${actual.r2Egress}`,
    });
  }
  return { total, perCell, alarms, ok: alarms.length === 0 };
}
