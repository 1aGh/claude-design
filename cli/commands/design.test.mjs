// `maude design <verb>` bin-dispatch (Phase C / DDR-062). The whitelisted
// dev-tooling verbs dispatch to the dev-server bash helpers, resolved from
// maude's OWN package root and run with CLAUDE_PLUGIN_ROOT set authoritatively
// for the child — so they work in a marketplace install where the plugin is
// copied alone and CLAUDE_PLUGIN_ROOT is unset in the parent env. These tests
// run from a temp cwd with CLAUDE_PLUGIN_ROOT scrubbed to prove resolution
// doesn't depend on either cwd or the env var.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { resolveServerBinary } from './design.mjs';

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

// resolveServerBinary — the dev-server boot-runtime resolver (DDR-084). server-up
// must boot the compiled platform binary on a production install (it embeds yjs +
// every dep; `bun server.ts` from source can't resolve them — the historic
// yjs-at-boot crash), but keep using SOURCE in the local dev tree so a maintainer's
// edits are live.
function fakePkgRoot({ devTree = false, sideChannelBin = null } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'maude-pkgroot-'));
  if (devTree) {
    mkdirSync(join(root, 'packages', 'maude-darwin-arm64'), { recursive: true });
    writeFileSync(join(root, 'packages', 'maude-darwin-arm64', 'package.json'), '{}');
  }
  if (sideChannelBin) {
    mkdirSync(join(root, 'cli'), { recursive: true });
    writeFileSync(join(root, 'cli', '.platform-binary-path'), sideChannelBin);
  }
  return root;
}

test('resolveServerBinary → null in the local dev tree (packages/ present) — boots source', () => {
  const root = fakePkgRoot({ devTree: true });
  try {
    delete process.env.MAUDE_FORCE_SOURCE;
    assert.equal(resolveServerBinary({ pkgRoot: root }), null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('resolveServerBinary → null when MAUDE_FORCE_SOURCE=1 (maintainer override)', () => {
  const fakeBin = mkdtempSync(join(tmpdir(), 'maude-bin-'));
  const binFile = join(fakeBin, 'maude');
  writeFileSync(binFile, '#!/bin/sh\n');
  chmodSync(binFile, 0o755);
  const root = fakePkgRoot({ sideChannelBin: binFile }); // NOT a dev tree
  const prev = process.env.MAUDE_FORCE_SOURCE;
  try {
    process.env.MAUDE_FORCE_SOURCE = '1';
    assert.equal(resolveServerBinary({ pkgRoot: root }), null);
  } finally {
    if (prev === undefined) delete process.env.MAUDE_FORCE_SOURCE;
    else process.env.MAUDE_FORCE_SOURCE = prev;
    rmSync(root, { recursive: true, force: true });
    rmSync(fakeBin, { recursive: true, force: true });
  }
});

test('resolveServerBinary → side-channel path on a production install (no packages/)', () => {
  const fakeBin = mkdtempSync(join(tmpdir(), 'maude-bin-'));
  const binFile = join(fakeBin, 'maude');
  writeFileSync(binFile, '#!/bin/sh\n');
  chmodSync(binFile, 0o755);
  const root = fakePkgRoot({ sideChannelBin: binFile }); // production shape
  const prev = process.env.MAUDE_FORCE_SOURCE;
  try {
    delete process.env.MAUDE_FORCE_SOURCE;
    assert.equal(resolveServerBinary({ pkgRoot: root }), binFile);
  } finally {
    if (prev !== undefined) process.env.MAUDE_FORCE_SOURCE = prev;
    rmSync(root, { recursive: true, force: true });
    rmSync(fakeBin, { recursive: true, force: true });
  }
});
