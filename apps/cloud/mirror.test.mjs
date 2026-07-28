// Cloud Phase 10 — the GitHub mirror.
//
// The mirror writes into a repository we do NOT own, so every test here is
// about not damaging it: no force, no merge, no guessing at a divergence, and
// no configuration that could point the push somewhere unintended.
//
// The divergence case is exercised against a REAL git remote rather than a
// string fixture, because "did we destroy their commit" is not a question a
// mocked runner can answer.

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import {
  classifyPushResult,
  DEFAULT_MIRROR_BRANCH,
  mirrorPushArgs,
  mirrorStatus,
  validateTarget,
} from './mirror.mjs';

const git = (args, cwd) =>
  new Promise((resolve) => {
    const child = spawn('git', args, {
      cwd,
      env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => {
      stdout += d;
    });
    child.stderr.on('data', (d) => {
      stderr += d;
    });
    child.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });

// ------------------------------------------------------------ target check

test('a target must be owner/name — never a URL', () => {
  // A full URL would let a misconfiguration point at another host entirely,
  // and the installation credential we hold is GitHub-scoped.
  assert.equal(validateTarget({ repo: 'acme/designs' }).ok, true);
  for (const repo of [
    'https://github.com/acme/designs',
    'git@github.com:acme/designs.git',
    'acme',
    'acme/designs/extra',
    '/etc/passwd',
    '',
    'acme/..',
  ]) {
    assert.equal(validateTarget({ repo }).ok, false, `${JSON.stringify(repo)} must be refused`);
  }
});

test('the default branch is a dedicated one, not main', () => {
  // Mirroring onto `main` of a repo with other content is the single easiest
  // way to make this destructive.
  const { target } = validateTarget({ repo: 'acme/designs' });
  assert.equal(target.branch, DEFAULT_MIRROR_BRANCH);
  assert.notEqual(target.branch, 'main');
});

test('a branch name that git or a CLI could reinterpret is refused', () => {
  for (const branch of ['--force', '-f', 'feature/../../etc', 'has space', 'a'.repeat(300), '']) {
    assert.equal(
      validateTarget({ repo: 'acme/designs', branch }).ok,
      false,
      `${JSON.stringify(branch)} must be refused`
    );
  }
  assert.equal(validateTarget({ repo: 'acme/designs', branch: 'release/2026' }).ok, true);
});

// ------------------------------------------------------------------ argv

test('the push argv contains NO force flag, in any spelling', () => {
  // Pinned as an argv assertion because the guarantee is an ABSENCE, and an
  // absence is what a later edit adds with nothing noticing.
  const args = mirrorPushArgs({ branch: 'maude-workspace' });
  assert.deepEqual(args, ['push', 'mirror', 'HEAD:refs/heads/maude-workspace']);
  for (const arg of args) {
    assert.ok(!/^--?f/.test(arg), `"${arg}" looks like a force flag`);
    assert.ok(!arg.startsWith('+'), `"${arg}" is a force refspec`);
  }
  assert.ok(!args.includes('--mirror'), '`git push --mirror` deletes remote refs');
});

// ------------------------------------------------------- real-remote proof

test('a diverged remote is NOT overwritten — proven against a real repo', async (t) => {
  const workspace = mkdtempSync(path.join(tmpdir(), 'maude-mirror-ws-'));
  const remote = mkdtempSync(path.join(tmpdir(), 'maude-mirror-remote-'));
  const theirs = mkdtempSync(path.join(tmpdir(), 'maude-mirror-theirs-'));
  t.after(() => {
    for (const d of [workspace, remote, theirs]) rmSync(d, { recursive: true, force: true });
  });

  await git(['init', '--bare', `--initial-branch=${DEFAULT_MIRROR_BRANCH}`], remote);

  // The customer already has a commit on that branch — something we did not put
  // there. This is the whole scenario.
  await git(['clone', remote, theirs], path.dirname(theirs));
  await git(['config', 'user.name', 'Customer'], theirs);
  await git(['config', 'user.email', 'customer@example.com'], theirs);
  writeFileSync(path.join(theirs, 'THEIRS.md'), 'work we must not destroy\n');
  await git(['add', '-A'], theirs);
  await git(['commit', '-m', 'their own commit'], theirs);
  await git(['push', 'origin', DEFAULT_MIRROR_BRANCH], theirs);

  // Our workspace has unrelated history.
  await git(['init', `--initial-branch=${DEFAULT_MIRROR_BRANCH}`], workspace);
  await git(['config', 'user.name', 'Maude Workspace'], workspace);
  await git(['config', 'user.email', 'workspace@maude.local'], workspace);
  writeFileSync(path.join(workspace, 'design.tsx'), 'export default () => null;\n');
  await git(['add', '-A'], workspace);
  await git(['commit', '-m', 'design: update Screen'], workspace);
  await git(['remote', 'add', 'mirror', remote], workspace);

  const res = await git(mirrorPushArgs({ branch: DEFAULT_MIRROR_BRANCH }), workspace);
  const verdict = classifyPushResult(res);

  assert.equal(verdict.ok, false);
  assert.equal(verdict.state, 'diverged');
  assert.match(verdict.message, /Nothing was overwritten/);
  // We do not offer to force, anywhere in what the customer reads.
  assert.ok(!/force/i.test(verdict.message));

  // And the proof: their commit is still the tip.
  const log = await git(['log', '--pretty=format:%s', DEFAULT_MIRROR_BRANCH], remote);
  assert.equal(log.stdout.split('\n')[0], 'their own commit');
});

test('a clean push succeeds and a repeat reports up-to-date', async (t) => {
  const workspace = mkdtempSync(path.join(tmpdir(), 'maude-mirror-ok-ws-'));
  const remote = mkdtempSync(path.join(tmpdir(), 'maude-mirror-ok-remote-'));
  t.after(() => {
    for (const d of [workspace, remote]) rmSync(d, { recursive: true, force: true });
  });

  await git(['init', '--bare', `--initial-branch=${DEFAULT_MIRROR_BRANCH}`], remote);
  await git(['init', `--initial-branch=${DEFAULT_MIRROR_BRANCH}`], workspace);
  await git(['config', 'user.name', 'Maude Workspace'], workspace);
  await git(['config', 'user.email', 'workspace@maude.local'], workspace);
  writeFileSync(path.join(workspace, 'design.tsx'), 'export default () => null;\n');
  await git(['add', '-A'], workspace);
  await git(['commit', '-m', 'design: update Screen'], workspace);
  await git(['remote', 'add', 'mirror', remote], workspace);

  const first = classifyPushResult(
    await git(mirrorPushArgs({ branch: DEFAULT_MIRROR_BRANCH }), workspace)
  );
  assert.equal(first.ok, true);
  assert.equal(first.state, 'pushed');

  const second = classifyPushResult(
    await git(mirrorPushArgs({ branch: DEFAULT_MIRROR_BRANCH }), workspace)
  );
  assert.equal(second.ok, true);
  assert.equal(second.state, 'up-to-date');
});

// ------------------------------------------------------------ classification

test('each failure gets the sentence that tells the customer what to do', () => {
  // These need different words: only two of them are the customer's to fix.
  assert.equal(
    classifyPushResult({ code: 1, stderr: 'Authentication failed' }).state,
    'unauthorized'
  );
  assert.match(
    classifyPushResult({ code: 1, stderr: 'Permission denied (publickey)' }).message,
    /Reconnect it in settings/
  );
  assert.equal(classifyPushResult({ code: 128, stderr: 'repository not found' }).state, 'missing');
  const unknown = classifyPushResult({ code: 1, stderr: 'something nobody predicted' });
  assert.equal(unknown.state, 'failed');
  // Even the unexplained case reassures about the thing that matters.
  assert.match(unknown.message, /workspace itself is unaffected/);
});

// ------------------------------------------------------------------ status

test('a mirror that is behind is a WARNING, not an incident', () => {
  // The workspace has the data. Escalating a copy's staleness to an error
  // trains people to ignore errors.
  const now = 1_800_000_000_000;
  assert.equal(mirrorStatus({ enabled: false }, { now }).state, 'off');
  assert.deepEqual(
    mirrorStatus({ enabled: true, lastSuccessAt: null }, { now }).state,
    'never-run'
  );

  const fresh = mirrorStatus({ enabled: true, lastSuccessAt: now - 60_000 }, { now });
  assert.equal(fresh.state, 'current');
  assert.equal(fresh.due, false);

  const stale = mirrorStatus({ enabled: true, lastSuccessAt: now - 3 * 3600_000 }, { now });
  assert.equal(stale.state, 'behind');
  assert.equal(stale.severity, 'warning');
  assert.equal(stale.due, true);
});

test('a diverged mirror is NOT retried silently forever', () => {
  // It needs a human decision, so the loop must stop and say so.
  const status = mirrorStatus(
    { enabled: true, lastSuccessAt: 1, lastState: 'diverged' },
    { now: 1_800_000_000_000 }
  );
  assert.equal(status.due, false);
  assert.equal(status.severity, 'warning');
  assert.match(status.message, /Nothing was overwritten/);
});

test('a broken connection stops retrying too', () => {
  const now = 1_800_000_000_000;
  for (const lastState of ['unauthorized', 'missing']) {
    const status = mirrorStatus({ enabled: true, lastSuccessAt: 1, lastState }, { now });
    assert.equal(status.due, false, `${lastState} must not retry`);
    assert.equal(status.severity, 'warning');
  }
});
