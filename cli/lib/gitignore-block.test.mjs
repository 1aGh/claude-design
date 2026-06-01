// gitignore-block helper tests — Phase 9 Task 9 (DDR-056).

import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import {
  BEGIN_MARKER,
  END_MARKER,
  applyBlock,
  buildBlock,
  hasBlock,
  writeGitignoreBlock,
} from './gitignore-block.mjs';

function withRepo(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'maude-gitignore-'));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('buildBlock includes the runtime paths and is marker-wrapped', () => {
  const block = buildBlock('.design');
  assert.ok(block.startsWith(BEGIN_MARKER));
  assert.ok(block.trimEnd().endsWith(END_MARKER));
  for (const p of [
    '.design/_state/',
    '.design/_server.json',
    '.design/_active.json',
    '.design/_sync.json',
    '.design/_history/',
    '.design/_draw/',
    '.design/_chat/',
  ]) {
    assert.ok(block.includes(p), `missing ${p}`);
  }
  // Committed artifacts must NOT be ignored.
  assert.ok(!block.includes('.design/config.json'));
  assert.ok(!/\.design\/\*\.html/.test(block));
});

test('buildBlock honors a custom design root', () => {
  const block = buildBlock('design');
  assert.ok(block.includes('design/_server.json'));
  assert.ok(!block.includes('.design/_server.json'));
});

test('writeGitignoreBlock creates .gitignore when absent', () => {
  withRepo((dir) => {
    const { action, path } = writeGitignoreBlock(dir);
    assert.equal(action, 'created');
    const text = readFileSync(path, 'utf8');
    assert.ok(hasBlock(text));
  });
});

test('writeGitignoreBlock is idempotent — second run is unchanged', () => {
  withRepo((dir) => {
    writeGitignoreBlock(dir);
    const first = readFileSync(join(dir, '.gitignore'), 'utf8');
    const { action } = writeGitignoreBlock(dir);
    const second = readFileSync(join(dir, '.gitignore'), 'utf8');
    assert.equal(action, 'unchanged');
    assert.equal(first, second);
    // Exactly one block — no duplication.
    assert.equal(first.split(BEGIN_MARKER).length - 1, 1);
  });
});

test('writeGitignoreBlock preserves user content outside the markers', () => {
  withRepo((dir) => {
    const userContent = 'node_modules/\n*.log\n.env\n';
    writeFileSync(join(dir, '.gitignore'), userContent);
    writeGitignoreBlock(dir);
    const text = readFileSync(join(dir, '.gitignore'), 'utf8');
    assert.ok(text.includes('node_modules/'));
    assert.ok(text.includes('.env'));
    assert.ok(hasBlock(text));
  });
});

test('writeGitignoreBlock updates an existing block in place (no duplication)', () => {
  withRepo((dir) => {
    // Seed a stale block with a different design root.
    const stale = `keep-me\n${buildBlock('olddesign')}trailing\n`;
    writeFileSync(join(dir, '.gitignore'), stale);
    const { action } = writeGitignoreBlock(dir, { designRel: '.design' });
    assert.equal(action, 'updated');
    const text = readFileSync(join(dir, '.gitignore'), 'utf8');
    assert.equal(text.split(BEGIN_MARKER).length - 1, 1, 'still exactly one block');
    assert.ok(text.includes('.design/_server.json'));
    assert.ok(!text.includes('olddesign/_server.json'));
    assert.ok(text.includes('keep-me'));
    assert.ok(text.includes('trailing'));
  });
});

test('writeGitignoreBlock --dry-run does not touch disk', () => {
  withRepo((dir) => {
    const { action } = writeGitignoreBlock(dir, { dryRun: true });
    assert.equal(action, 'created');
    // File was not actually written.
    assert.throws(() => readFileSync(join(dir, '.gitignore'), 'utf8'));
  });
});

test('applyBlock appends to a file lacking a trailing newline cleanly', () => {
  const out = applyBlock('a\nb', buildBlock('.design'));
  assert.ok(out.includes('a\nb'));
  assert.ok(hasBlock(out));
  // No run-together: marker starts on its own line.
  assert.ok(out.includes(`\n${BEGIN_MARKER}`));
});

test('hasBlock detects both markers', () => {
  assert.ok(hasBlock(`x\n${BEGIN_MARKER}\ny\n${END_MARKER}\n`));
  assert.ok(!hasBlock('just user content'));
  assert.ok(!hasBlock(BEGIN_MARKER)); // begin without end
});
