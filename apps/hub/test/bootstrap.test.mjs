// bootstrap.mjs — single-use 24h admin claim key.

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import {
  bootstrapFilePath,
  issueBootstrap,
  maybeIssueOnBoot,
  readBootstrap,
  readConsumedBootstrap,
  verifyAndConsume,
} from '../src/bootstrap.mjs';
import { addToken } from '../src/tokens.mjs';

function withDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'maude-hub-bootstrap-'));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('issueBootstrap writes a 64-hex key with 24h expiry (no usedAt — that lives on bootstrap.used.json)', () => {
  withDir((dir) => {
    const now = 1_700_000_000_000;
    const rec = issueBootstrap(dir, { now });
    assert.match(rec.key, /^[0-9a-f]{64}$/);
    assert.equal(rec.issuedAt, now);
    assert.equal(rec.expiresAt, now + 24 * 60 * 60 * 1000);
    assert.equal(rec.usedAt, undefined, 'live record has no usedAt field');

    const onDisk = readBootstrap(dir);
    assert.deepEqual(onDisk, rec);
  });
});

test('bootstrap.json is written with 0600 permissions', () => {
  if (process.platform === 'win32') return;
  withDir((dir) => {
    issueBootstrap(dir);
    const mode = statSync(bootstrapFilePath(dir)).mode & 0o777;
    assert.equal(mode, 0o600);
  });
});

test('verifyAndConsume succeeds once, fails on replay; consumed marker is on bootstrap.used.json', () => {
  withDir((dir) => {
    const rec = issueBootstrap(dir);
    assert.equal(verifyAndConsume(dir, rec.key), true);
    assert.equal(verifyAndConsume(dir, rec.key), false, 'second use must fail');

    // Live file gone — atomically renamed to consumed.
    assert.equal(readBootstrap(dir), null, 'live bootstrap.json must be removed');
    const consumed = readConsumedBootstrap(dir);
    assert.equal(consumed.key, rec.key);
    assert.equal(typeof consumed.usedAt, 'number');
  });
});

test('verifyAndConsume rejects expired keys', () => {
  withDir((dir) => {
    const now = 1_700_000_000_000;
    issueBootstrap(dir, { now, ttlMs: 1000 });
    assert.equal(verifyAndConsume(dir, readBootstrap(dir).key, { now: now + 5000 }), false);
  });
});

test('verifyAndConsume rejects wrong / empty keys', () => {
  withDir((dir) => {
    issueBootstrap(dir);
    assert.equal(verifyAndConsume(dir, 'not-the-key'), false);
    assert.equal(verifyAndConsume(dir, ''), false);
    assert.equal(verifyAndConsume(dir, 'a'.repeat(64)), false);
  });
});

test('verifyAndConsume returns false when no bootstrap file exists', () => {
  withDir((dir) => {
    assert.equal(verifyAndConsume(dir, 'anything'), false);
  });
});

test('maybeIssueOnBoot issues when hub is empty + secret unset', () => {
  withDir((dir) => {
    const rec = maybeIssueOnBoot(dir, { secret: '' });
    assert.ok(rec, 'expected a new bootstrap record');
    assert.match(rec.key, /^[0-9a-f]{64}$/);
  });
});

test('maybeIssueOnBoot reuses a live record across reboots (idempotent)', () => {
  withDir((dir) => {
    const a = maybeIssueOnBoot(dir);
    const b = maybeIssueOnBoot(dir);
    assert.deepEqual(a, b, 'expected reuse, not regeneration');
  });
});

test('maybeIssueOnBoot REFUSES to regenerate after the prior key was consumed (DDR-053 §2)', () => {
  withDir((dir) => {
    const a = maybeIssueOnBoot(dir);
    verifyAndConsume(dir, a.key);
    const b = maybeIssueOnBoot(dir);
    assert.equal(b, null, 'no reissue post-consume — operator must use HUB_SECRET to recover');
  });
});

test('maybeIssueOnBoot REFUSES to regenerate after the prior key expired', () => {
  withDir((dir) => {
    const now = 1_700_000_000_000;
    maybeIssueOnBoot(dir, { now, ttlMs: 1000 });
    // Time passes beyond TTL but key was never consumed.
    const b = maybeIssueOnBoot(dir, { now: now + 5000 });
    assert.equal(b, null, 'no reissue post-expiry — operator must use HUB_SECRET');
  });
});

test('maybeIssueOnBoot returns null when tokens.json already populated', () => {
  withDir((dir) => {
    addToken(dir, { label: 'alice' });
    assert.equal(maybeIssueOnBoot(dir, { secret: '' }), null);
  });
});

test('maybeIssueOnBoot returns null when HUB_SECRET is set (hub already claimed)', () => {
  withDir((dir) => {
    assert.equal(maybeIssueOnBoot(dir, { secret: 'env-provided' }), null);
  });
});

test('readBootstrap tolerates a malformed file (returns null)', () => {
  withDir((dir) => {
    issueBootstrap(dir);
    writeFileSync(bootstrapFilePath(dir), 'not json', 'utf8');
    assert.equal(readBootstrap(dir), null);
  });
});
