// `maude hub workspace-up` end-to-end via spawnSync — the properties that only
// hold on the REAL command surface, not on the planning layer under it.
//
// Both cases come from the first live AWS run of `workspace-up` (2026-08-20).

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const BIN = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'maude.mjs');

const { classifyDrillFailure } = await import('./hub-workspace.mjs');

function runCli(args, { cwd } = {}) {
  return spawnSync(process.execPath, [BIN, ...args], { cwd, encoding: 'utf8' });
}

function withDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'maude-workspace-'));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const BASE = [
  'hub',
  'workspace-up',
  '--domain',
  'design.acme.com',
  '--acme-email',
  'ops@acme.com',
  '--admin-email',
  'ops@acme.com',
];

// M3 — the recommended seed URL is
// `https://x-access-token:<PAT>@github.com/org/repo.git` (`seed-repo.mjs`
// accepts no other shape), and this command printed it unredacted, `--dry-run`
// included. On the live run the PAT landed in SSM command history, CloudTrail
// and a session transcript, and had to be revoked.
test('--dry-run never prints the seed URL credential', () => {
  withDir((dir) => {
    const r = runCli(
      [...BASE, '--dry-run', '--seed-repo', 'https://x-access-token:SECRET123@github.com/o/r.git'],
      { cwd: dir }
    );
    assert.equal(r.status, 0, r.stderr);
    const out = `${r.stdout}${r.stderr}`;
    assert.ok(!out.includes('SECRET123'), 'the token must not reach stdout or stderr');
    assert.match(out, /https:\/\/\*\*\*@github\.com\/o\/r\.git/);
  });
});

// M2 — `--admin-password` beat the existing `.env`, so the new value was
// written to disk while `seedFirstUser()` (first boot only) kept the old one.
// The verification step then reported `HTTP 401 — the first user cannot sign
// in`, and the only repair anyone found was `docker compose down -v`: on a
// live box, losing the project rather than fixing the password.
test('--admin-password on a re-run is refused, not silently written', () => {
  withDir((dir) => {
    const first = runCli([...BASE, '--dry-run', '--admin-password', 'first-password-ok'], {
      cwd: dir,
    });
    assert.equal(first.status, 0, first.stderr);

    // Stand in for a hub that has already booted once.
    writeFileSync(
      join(dir, '.env'),
      "MAUDE_ADMIN_EMAIL='ops@acme.com'\nMAUDE_ADMIN_PASSWORD='first-password-ok'\nHUB_SECRET='abc'\n",
      { mode: 0o600 }
    );

    const rerun = runCli([...BASE, '--admin-password', 'second-password-ok'], { cwd: dir });
    assert.notEqual(rerun.status, 0, 'a re-run with a new password must not report success');
    assert.match(`${rerun.stdout}${rerun.stderr}`, /already exists/i);
    // The file on disk must still describe the password the database holds.
    assert.match(readFileSync(join(dir, '.env'), 'utf8'), /first-password-ok/);
    assert.ok(!readFileSync(join(dir, '.env'), 'utf8').includes('second-password-ok'));
  });
});

test('a re-run WITHOUT --admin-password still proceeds past the password gate', () => {
  withDir((dir) => {
    writeFileSync(
      join(dir, '.env'),
      "MAUDE_ADMIN_EMAIL='ops@acme.com'\nMAUDE_ADMIN_PASSWORD='first-password-ok'\nHUB_SECRET='abc'\n",
      { mode: 0o600 }
    );
    const r = runCli([...BASE, '--dry-run'], { cwd: dir });
    assert.equal(r.status, 0, r.stderr);
    assert.ok(existsSync(join(dir, '.env')));
  });
});

// M1 — on the live AWS run `restore-drill` reported a flat red `failed` for
// something that was not a backup problem at all: the host clone had no
// `node_modules`, so `backup.mjs` died on `Cannot find module
// 'better-sqlite3'`, and the image ships the bundled server rather than
// `cli/bin/maude.mjs`, so there was no third place to try. An operator reading
// "the backup is broken" starts recovering from a problem they do not have.
test('a drill that could not RUN is skipped, not failed', () => {
  const verdict = classifyDrillFailure(
    "maude hub backup: Cannot find module 'better-sqlite3'\nRequire stack: /x/apps/hub/src/backup.mjs"
  );
  assert.equal(verdict.ok, false);
  assert.equal(verdict.skipped, true, 'unrunnable must not be reported as a failure');
  assert.match(verdict.note, /could not run/i);
});

test('a missing backup engine is skipped too', () => {
  const verdict = classifyDrillFailure(
    'maude hub: the backup engine (apps/hub/src/backup.mjs) was not found.'
  );
  assert.equal(verdict.skipped, true);
});

test('no generation yet is skipped and says when to retry', () => {
  const verdict = classifyDrillFailure('no complete backup generation exists');
  assert.equal(verdict.skipped, true);
  assert.match(verdict.note, /6h/);
});

// The drill doing its job must stay loud — this is the case the skips above
// must never swallow.
test('a REAL restore failure is still a failure', () => {
  const verdict = classifyDrillFailure('restored database has documents 0 — refusing to pass');
  assert.equal(verdict.ok, false);
  assert.ok(!verdict.skipped, 'an empty restore is a genuine failure, not a skip');
  assert.match(verdict.note, /provisioning drill failed/);
});
