import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertLocalCodexTarget,
  canonicalizeCodexProjectArguments,
  codexProjectDirectory,
  hasCodexPermissionOverride,
  hasCodexRemoteTarget,
} from './codex.mjs';

test('resolves Codex working-directory flags before the trust decision', () => {
  assert.equal(codexProjectDirectory(['-C', '../target']), '../target');
  assert.equal(codexProjectDirectory(['exec', '--cd', '/target']), '/target');
  assert.equal(codexProjectDirectory(['--cd=/target', 'prompt']), '/target');
  assert.equal(codexProjectDirectory(['-C/target', 'prompt']), '/target');
});

test('does not interpret command arguments after -- as a Codex project override', () => {
  assert.equal(codexProjectDirectory(['exec', '--', 'tool', '-C', '/target']), null);
});

test('detects remote Codex targets before applying local project authority', () => {
  assert.equal(hasCodexRemoteTarget(['--remote', 'unix:///tmp/codex.sock']), true);
  assert.equal(hasCodexRemoteTarget(['--remote=ws://localhost:4500']), true);
  assert.equal(hasCodexRemoteTarget(['cloud', 'exec', 'task']), true);
  assert.equal(hasCodexRemoteTarget(['exec', '--', 'tool', '--remote', 'value']), false);
  assert.throws(
    () => assertLocalCodexTarget(['--remote', 'unix:///tmp/codex.sock']),
    /remote Codex session/i
  );
  assert.throws(() => assertLocalCodexTarget(['cloud', 'exec', 'task']), /remote Codex session/i);
});

test('replaces the authorized Codex directory operand with its canonical path', () => {
  assert.deepEqual(
    canonicalizeCodexProjectArguments(['exec', '--cd', '../mutable', '--json'], '/real/target'),
    ['-C', '/real/target', 'exec', '--json']
  );
  assert.deepEqual(canonicalizeCodexProjectArguments(['-C../mutable'], '/real/target'), [
    '-C',
    '/real/target',
  ]);
  assert.throws(
    () => canonicalizeCodexProjectArguments(['-C', 'one', '--cd=two'], '/real/target'),
    /multiple Codex working-directory overrides/i
  );
});

test('detects sandbox options that could disable the projected deny profile', () => {
  assert.equal(hasCodexPermissionOverride(['-s', 'danger-full-access']), true);
  assert.equal(hasCodexPermissionOverride(['--sandbox=read-only']), true);
  assert.equal(hasCodexPermissionOverride(['-c', 'sandbox_mode="danger-full-access"']), true);
  assert.equal(hasCodexPermissionOverride(['-c', ' harmless = true']), true);
  assert.equal(hasCodexPermissionOverride(['--profile', 'legacy']), true);
  assert.equal(hasCodexPermissionOverride(['-p', 'legacy']), true);
  assert.equal(hasCodexPermissionOverride(['-plegacy']), true);
  assert.equal(hasCodexPermissionOverride(['-sworkspace-write']), true);
  assert.equal(hasCodexPermissionOverride(['-Plegacy']), true);
  assert.equal(hasCodexPermissionOverride(['-cdefault_permissions="legacy"']), true);
  assert.equal(hasCodexPermissionOverride(['--yolo']), true);
  assert.equal(hasCodexPermissionOverride(['--model', 'gpt-5.6-sol']), false);
});
