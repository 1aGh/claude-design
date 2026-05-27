// DDR-053 §3 — scope-bound tokens. matchesScope helper + addToken default +
// onAuthenticate enforcement (the last via the surrounding admin-api flow,
// not here — kept this file pure-unit).

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import {
  addToken,
  assertValidLabel,
  matchesScope,
  rotateToken,
  verifyToken,
} from '../src/tokens.mjs';

function withDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'maude-hub-scope-'));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ----------------------------------------------------------------- matchesScope

test('matchesScope: wildcard ("*" or undefined) matches any documentName', () => {
  assert.equal(matchesScope('*', 'anything'), true);
  assert.equal(matchesScope(undefined, 'anything'), true);
  assert.equal(matchesScope('*', 'alice/x/y'), true);
});

test('matchesScope: exact label match passes', () => {
  assert.equal(matchesScope('alice', 'alice'), true);
});

test('matchesScope: prefix "alice/" passes; "alice2" does NOT (prevents prefix-confusion)', () => {
  assert.equal(matchesScope('alice', 'alice/canvas'), true);
  assert.equal(matchesScope('alice', 'alice/deep/path'), true);
  assert.equal(matchesScope('alice', 'alice2'), false, 'must not be a substring match');
  assert.equal(matchesScope('alice', 'alice2/canvas'), false);
});

test('matchesScope: mismatched label fails', () => {
  assert.equal(matchesScope('alice', 'bob'), false);
  assert.equal(matchesScope('alice', 'bob/x'), false);
});

// --------------------------------------------------------------- addToken default

test('addToken defaults scope = label (DDR-053 §3)', () => {
  withDir((dir) => {
    const rec = addToken(dir, { label: 'alice' });
    assert.equal(rec.scope, 'alice');
  });
});

test("addToken with scope: '*' opts into wildcard (admin-on-Yjs)", () => {
  withDir((dir) => {
    const rec = addToken(dir, { label: 'ops', scope: '*' });
    // Wildcard is stored as absence-of-scope; verifyToken normalizes back to '*'.
    assert.equal(rec.scope, undefined);
    const v = verifyToken(dir, rec.value, '');
    assert.equal(v.scope, '*');
  });
});

test('addToken with explicit scope preserves it through rotateToken', () => {
  withDir((dir) => {
    const _first = addToken(dir, { label: 'alice', scope: 'alice/canvas-only' });
    const rotated = rotateToken(dir, 'alice');
    assert.equal(rotated.scope, 'alice/canvas-only');
  });
});

test('rotateToken preserves wildcard scope across rotation', () => {
  withDir((dir) => {
    addToken(dir, { label: 'ops', scope: '*' });
    const rotated = rotateToken(dir, 'ops');
    const v = verifyToken(dir, rotated.value, '');
    assert.equal(v.scope, '*');
  });
});

// ---------------------------------------------------- legacy grandfathering

test('verifyToken on a pre-DDR token without scope field returns scope: "*"', () => {
  withDir((dir) => {
    // Simulate a tokens.json from before this DDR — no scope field.
    const tokensPath = join(dir, 'tokens.json');
    const legacy = {
      tokens: [{ label: 'oldtoken', value: 'mau_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', createdAt: 1 }],
    };
    writeFileSync(tokensPath, JSON.stringify(legacy), 'utf8');
    const v = verifyToken(dir, 'mau_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', '');
    assert.ok(v, 'legacy token should still verify');
    assert.equal(v.scope, '*', 'grandfathered as wildcard');
  });
});

// ----------------------------------------------------------- label validator

test('assertValidLabel: passes legal labels', () => {
  for (const ok of ['alice', 'a', 'Alice 1', 'alice.foo', 'alice-foo', 'A_B', 'x'.repeat(64)]) {
    assert.doesNotThrow(() => assertValidLabel(ok), `expected "${ok}" to pass`);
  }
});

test('assertValidLabel: rejects illegal labels', () => {
  for (const bad of [
    '',
    null,
    undefined,
    'x'.repeat(65),
    'with\nnewline',
    'with\tab',
    '<script>',
    'has/slash',
    'has spaces but also\rsmuggled',
    'quote"injection',
  ]) {
    assert.throws(() => assertValidLabel(bad), /label/, `expected "${bad}" to throw`);
  }
});
