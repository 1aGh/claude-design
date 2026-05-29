// `maude preflight` resolves the plugin manifest from the maude PACKAGE root,
// never the caller's cwd. This is the DDR-061 regression: in a marketplace
// install the plugin is copied alone (no sibling cli/), and bin scripts reach
// the check through the on-PATH `maude` binary — invoked from an arbitrary
// target-repo cwd. Spawning from a temp cwd that has no `plugins/` proves the
// resolution doesn't depend on cwd.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const BIN = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'maude.mjs');

function runFromTmp(args) {
  const cwd = mkdtempSync(join(tmpdir(), 'maude-preflight-'));
  try {
    return spawnSync(process.execPath, [BIN, 'preflight', ...args], { cwd, encoding: 'utf8' });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

test('preflight resolves the manifest from pkgRoot, not cwd (marketplace-layout regression)', () => {
  // cwd has no plugins/ — if resolution used cwd this would error "manifest not found".
  const res = runFromTmp(['--plugin', 'design', '--shell-export']);
  assert.equal(res.status === 0 || res.status === 1, true, res.stderr); // 0/1 = ran; 2 = bad args
  assert.match(res.stdout, /DEPS_PLUGIN="design"/);
});

test('preflight --json emits a structured envelope for the named plugin', () => {
  const res = runFromTmp(['--plugin', 'flow', '--json']);
  const env = JSON.parse(res.stdout);
  assert.equal(env.plugin, 'flow');
  assert.ok(Array.isArray(env.results));
  assert.ok(env.summary && typeof env.summary.total === 'number');
});

test('preflight without --plugin exits 2', () => {
  const res = runFromTmp([]);
  assert.equal(res.status, 2);
  assert.match(res.stderr, /--plugin/);
});
