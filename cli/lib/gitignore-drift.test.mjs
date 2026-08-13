// Gitignore drift — the check that catches git dropping VERSIONED design work.
//
// The case that produced this file, verbatim from a real project: a
// hand-authored pre-markers block carrying `.design/*.annotations.svg`, copied
// from a v1.0 planning document that predates the DDR-115 correction. Not one
// annotation sidecar had ever been committed. Both UIs rendered the draw layer;
// no clone, backup or PR contained it; nothing said so.
//
// What is pinned here is mostly the NEGATIVE space. A detector that proposes
// deleting lines from somebody's hand-written `.gitignore` is only as good as
// its refusals, so most of these tests assert what it must NOT flag.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  describeGitignoreDrift,
  findGitignoreDrift,
  removeGitignoreDrift,
} from './gitignore-drift.mjs';

test('finds the real-world case: annotations ignored outside the markers', () => {
  const gitignore = [
    'node_modules/',
    '',
    '# design plugin dev-server runtime state',
    '.design/_active.json',
    '.design/_history/',
    '.design/*.annotations.svg',
    '.design/_chat/',
  ].join('\n');
  const drift = findGitignoreDrift(gitignore, '.design');
  assert.equal(drift.length, 1);
  assert.equal(drift[0].line, 6);
  assert.equal(drift[0].text, '.design/*.annotations.svg');
  assert.match(drift[0].what, /annotations/);
});

test('the runtime-state block is NOT drift — those paths are ignored by design', () => {
  // Every line the block writer itself emits must come back clean, or the check
  // would tell people to un-ignore their own `_history/` on every run.
  const gitignore = [
    '.design/_server.json',
    '.design/_active.json',
    '.design/_active.*.json',
    '.design/_sync.json',
    '.design/_history/',
    '.design/_trash/',
    '.design/_comments/',
    '.design/_canvas-state/',
    '.design/_untrusted/',
    '.design/assets/',
  ].join('\n');
  assert.deepEqual(findGitignoreDrift(gitignore, '.design'), []);
});

test('lines INSIDE the maude block are skipped — a generator bug is fixed by the generator', () => {
  const gitignore = [
    '# maude:begin',
    '.design/*.annotations.svg',
    '# maude:end',
    '.design/_history/',
  ].join('\n');
  assert.deepEqual(findGitignoreDrift(gitignore, '.design'), []);
});

test('a negation is the fix, not the fault', () => {
  const gitignore = ['.design/', '!.design/*.annotations.svg'].join('\n');
  assert.deepEqual(findGitignoreDrift(gitignore, '.design'), []);
});

test('comments and blank lines are not rules', () => {
  const gitignore = ['', '# .design/*.annotations.svg', '   ', '#.design/*.tsx'].join('\n');
  assert.deepEqual(findGitignoreDrift(gitignore, '.design'), []);
});

test('ignoring the WHOLE design root is a choice we do not second-guess', () => {
  // Somebody who ignores `.design/` outright has decided their design work is
  // not in this repo. That is coherent; flagging it would be nagging.
  for (const line of ['.design', '.design/', '/.design/']) {
    assert.deepEqual(findGitignoreDrift(line, '.design'), [], line);
  }
});

test('a repo-wide rule is out of scope — it is a decision about a whole codebase', () => {
  // `*.tsx` at the repo root is very possibly deliberate and is not ours to
  // reinterpret from inside a design-tool diagnostic.
  const gitignore = ['*.tsx', 'config.json', '*.meta.json'].join('\n');
  assert.deepEqual(findGitignoreDrift(gitignore, '.design'), []);
});

test('a non-default design root is honoured', () => {
  const gitignore = ['design/*.annotations.svg', '.design/*.annotations.svg'].join('\n');
  const drift = findGitignoreDrift(gitignore, 'design');
  assert.equal(drift.length, 1);
  assert.equal(drift[0].line, 1);
});

test('anchors and trailing slashes are the same rule to git', () => {
  const drift = findGitignoreDrift('/.design/system/', '.design');
  assert.equal(drift.length, 1);
  assert.match(drift[0].what, /design system/);
});

test('every versioned shape is covered, none of the runtime ones', () => {
  const versioned = [
    '.design/*.annotations.svg',
    '.design/*.meta.json',
    '.design/*.tsx',
    '.design/config.json',
    '.design/system/',
  ];
  assert.equal(findGitignoreDrift(versioned.join('\n'), '.design').length, versioned.length);
});

test('removal deletes exactly the reported lines, byte-for-byte otherwise', () => {
  const gitignore = [
    'node_modules/',
    '',
    '# my own comment',
    '.design/*.annotations.svg',
    '.design/_history/',
  ].join('\n');
  const drift = findGitignoreDrift(gitignore, '.design');
  const next = removeGitignoreDrift(gitignore, drift);
  assert.equal(
    next,
    ['node_modules/', '', '# my own comment', '.design/_history/'].join('\n'),
    'the user comment and the blank line survive'
  );
  // And the result is clean on a re-run — the fix converges.
  assert.deepEqual(findGitignoreDrift(next, '.design'), []);
});

test('removal with no drift is a byte-identical no-op', () => {
  const gitignore = 'node_modules/\n.design/_history/\n';
  assert.equal(removeGitignoreDrift(gitignore, []), gitignore);
  assert.equal(removeGitignoreDrift(gitignore, undefined), gitignore);
});

test('an absent or empty gitignore is not drift', () => {
  assert.deepEqual(findGitignoreDrift('', '.design'), []);
  assert.deepEqual(findGitignoreDrift(undefined, '.design'), []);
});

test('the description names the consequence, not just the rule', () => {
  const drift = findGitignoreDrift('.design/*.annotations.svg', '.design');
  const [line] = describeGitignoreDrift(drift);
  assert.match(line, /\.gitignore:1/);
  assert.match(line, /drops/);
  assert.match(line, /DDR-115/);
});
