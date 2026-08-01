// Cloud Phase 9 Task 3 — the Trust page's claims must be mechanically true.
//
// The page's own rule is "no aspirational statements", and a rule like that
// decays the moment nobody checks it. The specific way it decays is worse than
// vagueness: a mechanism gets refactored away, the sentence promising it stays,
// and the page becomes a set of claims nobody can back — which is exactly the
// thing a Trust page exists not to be.
//
// So every "Where the claims come from" row is checked against the file it
// names, and the load-bearing behaviours are re-asserted here rather than
// trusted to prose.

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { canTransition, lifecycleStates, stepToward } from '../../cli/lib/cell-plan.mjs';
import { reconcile } from './reconcile.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TRUST = join(REPO, 'site/content/docs/cloud/trust.mdx');
const page = readFileSync(TRUST, 'utf8');

test('every file the page cites actually exists', () => {
  // A citation to a deleted file is worse than no citation: it reads as
  // verifiable and is not.
  const cited = [...page.matchAll(/`([a-z0-9][\w./-]*\.(?:ts|mjs|sh|Dockerfile))`/gi)].map(
    (m) => m[1]
  );
  assert.ok(cited.length >= 5, `expected the claims table to cite files, found ${cited.length}`);
  for (const rel of new Set(cited)) {
    assert.ok(existsSync(join(REPO, rel)), `Trust page cites ${rel}, which does not exist`);
  }
  // `infra/cell/Dockerfile` is cited without an extension pattern match.
  assert.ok(existsSync(join(REPO, 'infra/cell/Dockerfile')));
});

test('"designs are never executed by us" — the mechanism is wired, not just described', () => {
  const workspaceMode = readFileSync(join(REPO, 'apps/studio/workspace-mode.ts'), 'utf8');
  assert.match(workspaceMode, /assertContainment/);
  assert.match(readFileSync(join(REPO, 'apps/studio/server.ts'), 'utf8'), /assertContainment\(/);

  const entrypoint = readFileSync(join(REPO, 'infra/cell/entrypoint.sh'), 'utf8');
  assert.match(entrypoint, /containment/);

  const gate = readFileSync(join(REPO, 'scripts/check-containment.sh'), 'utf8');
  assert.match(gate, /FORBIDDEN_ROUTE_PREFIXES|_api\/export/);

  // ...and the CI job that runs the gate.
  const ci = readFileSync(join(REPO, '.github/workflows/quality.yml'), 'utf8');
  assert.match(ci, /check-containment\.sh/);
});

test('"no browser in the workspace image" — the image really does not install one', () => {
  const dockerfile = readFileSync(join(REPO, 'infra/cell/Dockerfile'), 'utf8');
  const installLines = dockerfile
    .split('\n')
    .filter((l) => /^\s*(RUN|COPY|ADD)\b/i.test(l))
    .join('\n')
    .toLowerCase();
  for (const browser of ['playwright', 'puppeteer', 'chromium', 'chrome', 'firefox']) {
    assert.ok(!installLines.includes(browser), `the cell image installs ${browser}`);
  }
});

test('"export before teardown" — purged is reachable ONLY through exported', () => {
  // The page states this as a state machine rather than a policy, so it has to
  // be one.
  for (const from of lifecycleStates()) {
    if (from === 'exported' || from === 'purged') continue;
    if (from === 'pending') {
      // The single stated exception: a project that never became active never
      // held anything to hand back.
      assert.equal(canTransition('pending', 'purged'), true);
      continue;
    }
    assert.equal(canTransition(from, 'purged'), false, `${from} → purged must be impossible`);
    // And no route around it, either.
    const route = [from];
    let cursor = from;
    for (let guard = 0; guard < 10 && cursor !== 'purged'; guard++) {
      cursor = stepToward(cursor, 'purged');
      route.push(cursor);
    }
    assert.equal(route[route.length - 2], 'exported', `route from ${from}: ${route.join(' → ')}`);
  }
});

test('"suspension retains data, and the clock does not outrank the guarantee"', () => {
  const held = {
    id: 'x',
    state: 'suspended',
    subscriptionId: 's',
    stateSince: 0,
    cellRunning: false,
    exportSent: false,
  };
  // Long past the retention window, with no export ever delivered.
  const r = reconcile(held, { status: 'canceled' }, { now: 365 * 24 * 3600_000 });
  assert.ok(
    !r.actions.some((a) => a.kind === 'set-state' && a.to === 'exported'),
    'must not advance toward purge without having handed the files over'
  );
  assert.ok(r.actions.some((a) => a.kind === 'send-export'));
});

// Cloud Phase 24 D4. Two claims on this page were true of the DECISION module
// and false of the running system: the export before teardown was computed and
// never performed, and "you can leave" sat next to a delete that left every
// byte in storage. Re-checked here against what the code now does.

test('"export before teardown" is PERFORMED, not merely computed', () => {
  const worker = readFileSync(join(REPO, 'apps/cloud/worker.mjs'), 'utf8');
  assert.match(worker, /performActions/, 'the reconciler must have an executor at all');
  // The ordering is the claim. `reconcile()` emits suspend-cell before
  // send-export; performing them in that order would tear the workspace down
  // and only then try to build the copy from it.
  const exportAt = worker.indexOf("kinds.has('send-export')");
  const suspendAt = worker.indexOf("kinds.has('suspend-cell')");
  assert.ok(exportAt > 0 && suspendAt > 0);
  assert.ok(exportAt < suspendAt, 'the copy must go out before the teardown');
});

test('"deleting erases the bytes" — the delete route really purges storage', () => {
  const admin = readFileSync(join(REPO, 'apps/cloud/project-admin.mjs'), 'utf8');
  assert.match(admin, /purgeTenantObjects/);
  // And the automatic path, which is what makes a cancellation countdown honest.
  const worker = readFileSync(join(REPO, 'apps/cloud/worker.mjs'), 'utf8');
  assert.match(worker, /purgeTenantObjects/);
  assert.ok(existsSync(join(REPO, 'apps/cloud/purge.mjs')));
});

test('the retention the customer is shown is the retention the reconciler enforces', async () => {
  // Two places that both "know" this number is how the screen and the platform
  // come to disagree — and shortening a published retention is a breach, not a
  // tweak.
  const { RETENTION_DAYS } = await import('./billing.mjs');
  const { SUSPEND_RETENTION_DAYS } = await import('./reconcile.mjs');
  assert.equal(RETENTION_DAYS, SUSPEND_RETENTION_DAYS);
  assert.match(page, new RegExp(`retained ${SUSPEND_RETENTION_DAYS} days`));
});

test('the legal pack the page now points at actually exists', () => {
  for (const rel of [
    'site/content/docs/legal/terms.mdx',
    'site/content/docs/legal/privacy.mdx',
    'site/content/docs/legal/dpa.mdx',
    'site/content/docs/cloud/pricing.mdx',
  ]) {
    assert.ok(existsSync(join(REPO, rel)), `the Trust page links ${rel}, which does not exist`);
  }
});

test('"backups are restorable" — the drill exists and runs in CI', () => {
  assert.ok(existsSync(join(REPO, 'scripts/hub-restore-drill.sh')));
  const ci = readFileSync(join(REPO, '.github/workflows/quality.yml'), 'utf8');
  assert.match(ci, /hub-restore-drill\.sh/);
  const backup = readFileSync(join(REPO, 'apps/hub/src/backup.mjs'), 'utf8');
  assert.match(backup, /verifyRestored|restoreDrill/);
});

test('"sessions expire and can be revoked" — both are implemented', () => {
  const tokens = readFileSync(join(REPO, 'apps/hub/src/tokens.mjs'), 'utf8');
  assert.match(tokens, /expires_at/);
  assert.match(tokens, /revokeTokensForOwner/);
});

test('"one project cannot read another" — prefix isolation is real', () => {
  const cellPlan = readFileSync(join(REPO, 'cli/lib/cell-plan.mjs'), 'utf8');
  assert.match(cellPlan, /keyBelongsToTenant/);
  assert.match(cellPlan, /r2Prefix/);
});

test('the page makes no promise about a mechanism that does not exist yet', () => {
  // Guard against the specific temptation: writing the reassuring sentence
  // first and building it later. These are the words that would signal it.
  for (const weasel of [
    'we plan to',
    'will soon',
    'is planned',
    'coming soon',
    'we intend to',
    'best effort',
  ]) {
    assert.ok(
      !page.toLowerCase().includes(weasel),
      `the Trust page says "${weasel}" — an aspirational claim has no place here`
    );
  }
});

test('the self-host alternative is stated, because it is what makes the rest testable', () => {
  // DDR-193 §6 — the self-host path stays first-class and the promise it
  // replaced was replaced openly.
  assert.match(page, /free forever to self-host/i);
  assert.match(page, /workspace-up/);
  assert.match(page, /\/docs\/hub\/pricing/);
});
