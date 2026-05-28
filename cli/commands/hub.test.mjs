// `maude hub token generate` CLI end-to-end via spawnSync — verifies stdout
// shape, file contents, and label-overwrite (rotation) idempotence.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { readTokens } from '../../plugins/design/hub/src/tokens.mjs';

const BIN = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'maude.mjs');

function runCli(args, { cwd } = {}) {
  return spawnSync(process.execPath, [BIN, ...args], {
    cwd: cwd ?? process.cwd(),
    encoding: 'utf8',
  });
}

function withDataDir(fn) {
  const dataDir = mkdtempSync(join(tmpdir(), 'maude-cli-hub-'));
  try {
    return fn(dataDir);
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
}

test('hub help prints subcommand summary on stdout', () => {
  const res = runCli(['hub', 'help']);
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout, /maude hub <serve\|token\|status>/);
  assert.match(res.stdout, /token generate --label NAME/);
});

test('hub token generate without --label exits 2', () => {
  const res = runCli(['hub', 'token', 'generate']);
  assert.equal(res.status, 2);
  assert.match(res.stderr, /--label <name> is required/);
});

test('hub token generate persists to the store + prints the connect command', () => {
  withDataDir((dataDir) => {
    const res = runCli(['hub', 'token', 'generate', '--label', 'alice', '--data', dataDir]);
    assert.equal(res.status, 0, res.stderr);
    assert.match(res.stdout, /label:\s+alice/);
    assert.match(res.stdout, /value:\s+mau_[0-9a-f]{32}/);
    assert.match(res.stdout, /maude design link/);

    const { tokens } = readTokens(dataDir);
    assert.equal(tokens.length, 1);
    assert.equal(tokens[0].label, 'alice');
    // The raw value is never persisted — only labels/metadata are listable.
    assert.equal(tokens[0].value, undefined);
  });
});

test('hub token generate --label is idempotent (overwrites in place)', () => {
  withDataDir((dataDir) => {
    runCli(['hub', 'token', 'generate', '--label', 'alice', '--data', dataDir]);
    runCli(['hub', 'token', 'generate', '--label', 'alice', '--data', dataDir]);

    assert.equal(readTokens(dataDir).tokens.length, 1);
  });
});

test('hub token generate --dev uses mau_dev_ prefix', () => {
  withDataDir((dataDir) => {
    const res = runCli(['hub', 'token', 'generate', '--label', 'dev', '--data', dataDir, '--dev']);
    assert.equal(res.status, 0, res.stderr);
    assert.match(res.stdout, /value:\s+mau_dev_[0-9a-f]{32}/);
  });
});

test('hub status against an unreachable URL exits 1 with diagnostic', () => {
  const res = runCli(['hub', 'status', 'http://127.0.0.1:1']);
  assert.equal(res.status, 1);
  assert.match(res.stderr, /cannot reach/);
});

test('hub serve|token|status are the only known subcommands', () => {
  const res = runCli(['hub', 'nope']);
  assert.equal(res.status, 2);
  assert.match(res.stderr, /unknown subcommand "nope"/);
});
