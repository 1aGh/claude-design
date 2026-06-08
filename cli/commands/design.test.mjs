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
import { isPlausiblePlatformBinary, resolveServerBinary } from './design.mjs';

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

// Build an executable in a layout the allowlist accepts (`maude-<slug>/maude`)
// or rejects (anything else), under a throwaway dir.
function fakeBinary({ conforming = true } = {}) {
  const home = mkdtempSync(join(tmpdir(), 'maude-bin-'));
  const dir = join(home, conforming ? 'maude-darwin-arm64' : 'evil');
  mkdirSync(dir, { recursive: true });
  const bin = join(dir, 'maude');
  writeFileSync(bin, '#!/bin/sh\n');
  chmodSync(bin, 0o755);
  return { home, bin };
}

test('resolveServerBinary → null when MAUDE_FORCE_SOURCE=1 (maintainer override)', () => {
  const { home, bin } = fakeBinary();
  const root = fakePkgRoot({ sideChannelBin: bin }); // NOT a dev tree
  const prev = process.env.MAUDE_FORCE_SOURCE;
  try {
    process.env.MAUDE_FORCE_SOURCE = '1';
    assert.equal(resolveServerBinary({ pkgRoot: root }), null);
  } finally {
    if (prev === undefined) delete process.env.MAUDE_FORCE_SOURCE;
    else process.env.MAUDE_FORCE_SOURCE = prev;
    rmSync(root, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
});

test('resolveServerBinary → side-channel path on a production install (no packages/)', () => {
  const { home, bin } = fakeBinary(); // conforming maude-<slug>/maude layout
  const root = fakePkgRoot({ sideChannelBin: bin }); // production shape
  const prev = process.env.MAUDE_FORCE_SOURCE;
  try {
    delete process.env.MAUDE_FORCE_SOURCE;
    assert.equal(resolveServerBinary({ pkgRoot: root }), bin);
  } finally {
    if (prev !== undefined) process.env.MAUDE_FORCE_SOURCE = prev;
    rmSync(root, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
});

test('resolveServerBinary → REJECTS a side-channel pointing outside the maude-<slug>/ layout (DDR-084 allowlist)', () => {
  const { home, bin } = fakeBinary({ conforming: false }); // <tmp>/evil/maude
  const root = fakePkgRoot({ sideChannelBin: bin }); // production shape, no real platform pkg
  const prev = process.env.MAUDE_FORCE_SOURCE;
  try {
    delete process.env.MAUDE_FORCE_SOURCE;
    // Poisoned side-channel is ignored → falls through to lazyResolve, which finds
    // nothing in the fake root → null (server-up then boots source, not the planted bin).
    assert.equal(resolveServerBinary({ pkgRoot: root }), null);
  } finally {
    if (prev !== undefined) process.env.MAUDE_FORCE_SOURCE = prev;
    rmSync(root, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
});

test('isPlausiblePlatformBinary — accepts maude-<slug>/maude, rejects everything else', () => {
  assert.equal(isPlausiblePlatformBinary('/x/node_modules/@1agh/maude-darwin-arm64/maude'), true);
  assert.equal(isPlausiblePlatformBinary('/x/packages/maude-linux-x64-musl/maude'), true);
  assert.equal(isPlausiblePlatformBinary('/x/maude-win32-x64/maude.exe'), true);
  assert.equal(isPlausiblePlatformBinary('/tmp/evil/maude'), false); // parent not maude-<slug>
  assert.equal(isPlausiblePlatformBinary('/x/maude-darwin-arm64/evil'), false); // basename not maude
  assert.equal(isPlausiblePlatformBinary(''), false);
  assert.equal(isPlausiblePlatformBinary(null), false);
});

// DDR-095 — `maude studio` is a top-level alias for `maude design serve`. Both
// must resolve the same server-entry path. We prove parity by booting each
// against a temp dir with no .design/: the dev-server fails loud (exit 1) with
// an identical first-line signature, which only happens if `studio` routed
// through design-serve resolution (`apps/studio/server.{ts,mjs}` / the binary).
test('`maude studio` aliases `maude design serve` (identical boot resolution)', () => {
  const BIN_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'maude.mjs');
  function bootAgainstEmpty(argv) {
    const cwd = mkdtempSync(join(tmpdir(), 'maude-studio-'));
    try {
      const r = spawnSync(process.execPath, [BIN_PATH, ...argv, '--root', cwd], {
        encoding: 'utf8',
        timeout: 30000,
      });
      // Each invocation mkdtemp's its own root, and the diagnostic embeds that
      // path — mask it so we compare the path-independent signature (the test's
      // actual intent: same exit code + same error shape from both entrypoints).
      const firstErr = ((r.stderr || '').split('\n').find(Boolean) ?? '').replaceAll(cwd, '<root>');
      return { status: r.status, firstErr };
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  }
  const viaDesign = bootAgainstEmpty(['design', 'serve']);
  const viaStudio = bootAgainstEmpty(['studio']);
  // Both fail loud (no .design/) — same exit code, same first-line diagnostic.
  assert.notEqual(viaStudio.status, 0, `studio should not boot cleanly: ${viaStudio.firstErr}`);
  assert.equal(viaStudio.status, viaDesign.status);
  assert.equal(viaStudio.firstErr, viaDesign.firstErr);
});

test('`maude studio` is recognized (not an unknown command)', () => {
  const BIN_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'maude.mjs');
  const r = spawnSync(process.execPath, [BIN_PATH, 'studio', '--root', '/nonexistent-xyz'], {
    encoding: 'utf8',
    timeout: 30000,
  });
  assert.doesNotMatch(r.stderr || '', /unknown command/);
});
