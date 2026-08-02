// Design-sync — Cloud Phase 25 D1/D2/D3.
//
// This module decides what we do inside a repository we do NOT own, so the
// tests are mostly about restraint: which folder, which branch, and the
// ABSENCE of anything that could rewrite the customer's own history.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  backupContents,
  DEFAULT_DESIGN_FOLDER,
  DEFAULT_WORK_BRANCH,
  designSyncMessage,
  designSyncPullRequest,
  designSyncSteps,
  MIRROR_MODES,
  modeConsequence,
  validateDesignSync,
} from './design-sync.mjs';

test('the folder cannot be the repository root, or climb out of it', () => {
  for (const folder of ['.', '..', '../..', 'a/../../b', '.git', 'x/.git']) {
    const v = validateDesignSync({ folder });
    assert.equal(v.ok, false, `${folder} must be refused`);
  }
  // An absolute-LOOKING path is not one: leading slashes are stripped, so
  // "/etc" is the folder `etc` inside THEIR repository and nothing else. The
  // clone is a temporary directory; there is no filesystem path to reach.
  assert.equal(validateDesignSync({ folder: '/etc' }).target.folder, 'etc');
  const ok = validateDesignSync({ folder: 'design/maude' });
  assert.equal(ok.ok, true);
  assert.equal(ok.target.folder, 'design/maude');
  // Leading/trailing slashes are normalised rather than refused — a person
  // typing "/design/" means the obvious thing.
  assert.equal(validateDesignSync({ folder: '/design/' }).target.folder, 'design');
});

test('the work branch must differ from the base — we never commit onto theirs', () => {
  assert.equal(validateDesignSync({ baseBranch: 'main', workBranch: 'main' }).ok, false);
  const v = validateDesignSync({});
  assert.equal(v.target.baseBranch, 'main');
  assert.equal(v.target.workBranch, DEFAULT_WORK_BRANCH);
  assert.equal(v.target.folder, DEFAULT_DESIGN_FOLDER);
});

test('the steps stage ONLY the design folder and push ONLY the work branch', () => {
  const steps = designSyncSteps({
    folder: 'design',
    baseBranch: 'main',
    workBranch: 'maude/design-sync',
    message: 'design: sync',
  });
  const stage = steps.find((s) => s.name === 'stage');
  // `-- design` is the containment: git cannot reach outside the pathspec.
  assert.deepEqual(stage.args, ['add', '--all', '--', 'design']);

  const push = steps.find((s) => s.name === 'push');
  assert.equal(push.args[1], 'origin');
  assert.equal(push.args[2], 'maude/design-sync:refs/heads/maude/design-sync');
  // THE RULE: their base branch is never a push target, anywhere in the plan.
  for (const step of steps) {
    const joined = step.args.join(' ');
    assert.ok(
      !/:refs\/heads\/main\b/.test(joined),
      `no step may push to the base branch (${step.name})`
    );
  }
  // The lease is on OUR branch only — it stops us clobbering a concurrent sync
  // of our own, and cannot touch anything the customer wrote.
  assert.ok(push.args.includes('--force-with-lease'));
  assert.ok(!push.args.includes('--force'));
});

test('the commit and the pull request say where this came from and what it touches', () => {
  const msg = designSyncMessage({
    projectName: 'Brno Alligators',
    canvases: 12,
    when: new Date('2026-08-02'),
  });
  assert.match(msg, /^design: sync Brno Alligators \(12 canvases\)/);
  assert.match(msg, /2026-08-02/);

  const pr = designSyncPullRequest({
    projectName: 'Brno Alligators',
    folder: 'design',
    canvases: 1,
  });
  assert.match(pr.title, /Brno Alligators/);
  assert.match(pr.body, /1 canvas\b/);
  assert.match(pr.body, /Nothing outside `design\/` is touched/);
});

test('each mode states its consequence BEFORE Save (D2)', () => {
  assert.deepEqual([...MIRROR_MODES], ['backup', 'design-sync']);
  const sync = modeConsequence('design-sync', { repo: 'acme/site', folder: 'design' });
  assert.match(sync.what, /pull request on acme\/site/);
  assert.match(sync.touches, /nothing merges until you merge it/);

  const backup = modeConsequence('backup', { repo: 'acme/site' });
  assert.match(backup.what, /full history to a separate branch/);
  assert.match(backup.touches, /never touches your own branches/);
});

test('the backup describes what it ACTUALLY contains (D3)', () => {
  const seeded = backupContents({ seededFrom: '1aGh/alligators' });
  assert.match(seeded.summary, /Everything in 1aGh\/alligators/);
  const wizard = backupContents({ seededFrom: null });
  assert.match(wizard.summary, /design workspace and its full history/);
  // The honest difference: no promise of application code that isn't there.
  assert.ok(!/Everything/.test(wizard.summary));
});
