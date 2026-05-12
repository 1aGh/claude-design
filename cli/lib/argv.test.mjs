import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseArgs } from './argv.mjs';

test('value flag with --key value', () => {
  const { flags, positional } = parseArgs(['--name', 'foo']);
  assert.equal(flags.name, 'foo');
  assert.deepEqual(positional, []);
});

test('value flag with --key=value', () => {
  const { flags } = parseArgs(['--name=foo']);
  assert.equal(flags.name, 'foo');
});

test('boolean flag declared in booleans set', () => {
  const { flags, positional } = parseArgs(['--force', 'pos1'], { booleans: ['force'] });
  assert.equal(flags.force, true);
  assert.deepEqual(positional, ['pos1']);
});

test('positional args collected', () => {
  const { positional } = parseArgs(['init', 'my-project']);
  assert.deepEqual(positional, ['init', 'my-project']);
});

test('-- separator dumps remaining as positional', () => {
  const { flags, positional } = parseArgs(['--name', 'foo', '--', '--not-a-flag', 'x']);
  assert.equal(flags.name, 'foo');
  assert.deepEqual(positional, ['--not-a-flag', 'x']);
});

test('short flag -p value', () => {
  const { flags } = parseArgs(['-p', '4399']);
  assert.equal(flags.p, '4399');
});

test('mixed flags + positionals', () => {
  const { flags, positional } = parseArgs(
    ['design', 'serve', '--port', '4399', '--root', '/tmp/x'],
    { booleans: [] }
  );
  assert.equal(flags.port, '4399');
  assert.equal(flags.root, '/tmp/x');
  assert.deepEqual(positional, ['design', 'serve']);
});
