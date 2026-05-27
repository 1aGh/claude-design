// tokens.mjs unit tests — file read/write, addToken idempotence-on-label,
// verifyToken constant-time matching + HUB_SECRET fallback.

import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import {
  addToken,
  generateToken,
  readTokensFile,
  tokensFilePath,
  verifyToken,
  writeTokensFile,
} from '../src/tokens.mjs';

function withDataDir(fn) {
  const dataDir = mkdtempSync(join(tmpdir(), 'maude-hub-tokens-'));
  try {
    return fn(dataDir);
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
}

test('readTokensFile returns empty list when file missing', () => {
  withDataDir((dir) => {
    assert.deepEqual(readTokensFile(dir), { tokens: [] });
  });
});

test('readTokensFile tolerates malformed JSON (returns empty)', () => {
  withDataDir((dir) => {
    writeTokensFile(dir, { tokens: [{ label: 'a', value: 'x', createdAt: 1 }] });
    writeFileSync(tokensFilePath(dir), '{ not json', 'utf8');
    assert.deepEqual(readTokensFile(dir), { tokens: [] });
  });
});

test('generateToken produces a mau_<32hex> string by default', () => {
  const t = generateToken();
  assert.match(t, /^mau_[0-9a-f]{32}$/);
});

test('generateToken with dev=true uses the mau_dev_ prefix', () => {
  const t = generateToken({ dev: true });
  assert.match(t, /^mau_dev_[0-9a-f]{32}$/);
});

test('addToken creates a new record and persists to disk', () => {
  withDataDir((dir) => {
    const rec = addToken(dir, { label: 'alice' });
    assert.equal(rec.label, 'alice');
    assert.match(rec.value, /^mau_[0-9a-f]{32}$/);
    assert.equal(typeof rec.createdAt, 'number');

    const onDisk = JSON.parse(readFileSync(tokensFilePath(dir), 'utf8'));
    assert.equal(onDisk.tokens.length, 1);
    assert.equal(onDisk.tokens[0].label, 'alice');
  });
});

test('addToken with an existing label overwrites in place (rotation shape)', () => {
  withDataDir((dir) => {
    const first = addToken(dir, { label: 'alice' });
    const second = addToken(dir, { label: 'alice' });
    assert.notEqual(first.value, second.value);

    const onDisk = readTokensFile(dir);
    assert.equal(onDisk.tokens.length, 1);
    assert.equal(onDisk.tokens[0].value, second.value);
  });
});

test('addToken rejects empty / non-string labels', () => {
  withDataDir((dir) => {
    assert.throws(() => addToken(dir, { label: '' }), /label must be a non-empty string/);
    assert.throws(() => addToken(dir, {}), /label must be a non-empty string/);
  });
});

test('verifyToken returns the matched record from file', () => {
  withDataDir((dir) => {
    const rec = addToken(dir, { label: 'alice' });
    const hit = verifyToken(dir, rec.value, '');
    assert.ok(hit, 'expected a match');
    assert.equal(hit.label, 'alice');
    assert.equal(hit.source, 'file');
  });
});

test('verifyToken accepts HUB_SECRET fallback when no file match', () => {
  withDataDir((dir) => {
    const hit = verifyToken(dir, 'secret-shared', 'secret-shared');
    assert.ok(hit, 'expected env-secret match');
    assert.equal(hit.source, 'env');
    assert.equal(hit.label, 'env-secret');
  });
});

test('verifyToken returns null for unknown tokens', () => {
  withDataDir((dir) => {
    addToken(dir, { label: 'alice' });
    assert.equal(verifyToken(dir, 'mau_does_not_exist', 'other-secret'), null);
    assert.equal(verifyToken(dir, '', ''), null);
  });
});

test('verifyToken handles a tokens file with the wrong shape', () => {
  withDataDir((dir) => {
    writeFileSync(tokensFilePath(dir), JSON.stringify({ not_tokens: [] }), 'utf8');
    assert.equal(verifyToken(dir, 'anything', ''), null);
  });
});
