import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cmpSemver } from './update-check.mjs';

test('cmpSemver: equal versions return 0', () => {
  assert.equal(cmpSemver('0.18.2', '0.18.2'), 0);
  assert.equal(cmpSemver('1.0.0', '1.0.0'), 0);
});

test('cmpSemver: newer patch > older', () => {
  assert.ok(cmpSemver('0.18.3', '0.18.2') > 0);
  assert.ok(cmpSemver('0.18.2', '0.18.3') < 0);
});

test('cmpSemver: newer minor > older', () => {
  assert.ok(cmpSemver('0.19.0', '0.18.99') > 0);
  assert.ok(cmpSemver('0.18.99', '0.19.0') < 0);
});

test('cmpSemver: newer major > older', () => {
  assert.ok(cmpSemver('1.0.0', '0.99.99') > 0);
});

test('cmpSemver: prerelease tags stripped (compares core only)', () => {
  assert.equal(cmpSemver('0.18.2-beta.1', '0.18.2'), 0);
  assert.ok(cmpSemver('0.19.0-rc.0', '0.18.2') > 0);
});

test('cmpSemver: missing components default to 0', () => {
  assert.equal(cmpSemver('1', '1.0.0'), 0);
  assert.equal(cmpSemver('1.2', '1.2.0'), 0);
});
