// `maude design <verb>` bin-dispatch (Phase C / DDR-062). The whitelisted
// dev-tooling verbs dispatch to the dev-server bash helpers, resolved from
// maude's OWN package root and run with CLAUDE_PLUGIN_ROOT set authoritatively
// for the child — so they work in a marketplace install where the plugin is
// copied alone and CLAUDE_PLUGIN_ROOT is unset in the parent env. These tests
// run from a temp cwd with CLAUDE_PLUGIN_ROOT scrubbed to prove resolution
// doesn't depend on either cwd or the env var.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const BIN = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'maude.mjs');

function runDesign(args) {
  const cwd = mkdtempSync(join(tmpdir(), 'maude-design-'));
  const env = { ...process.env };
  env.CLAUDE_PLUGIN_ROOT = undefined; // prove maude sets it itself
  try {
    return spawnSync(process.execPath, [BIN, 'design', ...args], { cwd, encoding: 'utf8', env });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

test('slug verb resolves from pkgRoot with CLAUDE_PLUGIN_ROOT unset + cwd elsewhere', () => {
  const res = runDesign(['slug', 'Some Canvas Name']);
  assert.equal(res.status, 0, res.stderr);
  assert.equal(res.stdout.trim(), 'some_canvas_name'); // clean stdout — no maude banner
});

test('slug stdout is capturable (command-substitution idiom)', () => {
  const res = runDesign(['slug', 'Foo/Bar Baz.tsx']);
  assert.equal(res.status, 0, res.stderr);
  // Exactly one line of output so `$(maude design slug …)` captures cleanly.
  assert.equal(res.stdout.trim().split('\n').length, 1);
  assert.equal(res.stdout.trim(), 'foo-bar_baz');
});

test('unknown verb exits 2', () => {
  const res = runDesign(['frobnicate']);
  assert.equal(res.status, 2);
  assert.match(res.stderr, /unknown subcommand/);
});

test('design help lists the dev-tooling verbs', () => {
  const res = runDesign(['help']);
  assert.equal(res.status, 0, res.stderr);
  for (const verb of ['screenshot', 'server-up', 'prep', 'slug', 'smoke', 'visual-sanity']) {
    assert.match(res.stdout, new RegExp(verb), `usage should mention ${verb}`);
  }
});
