// photo-bg-remove.sh --asset validation — fix-photo-editor-followup-debt Task
// 21. Drives the real bash script as a subprocess (mirrors annotate-write.test.ts's
// spawn-a-bin pattern) against a temp design root, asserting the strict
// `assets/<sha8>.<ext>` shape check (Task 1) rejects path traversal and
// injection-shaped values with exit 2, while a well-formed reference proceeds
// PAST validation (a missing on-disk asset then fails for a different, later
// reason — exit 1 — proving the regex, not the filesystem check, isn't what
// stopped it).

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BIN = new URL('../bin/photo-bg-remove.sh', import.meta.url).pathname;

let root: string;

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'photo-bg-remove-test-'));
  mkdirSync(join(root, '.design'), { recursive: true });
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

function run(asset: string): { code: number; err: string } {
  const proc = Bun.spawnSync(['bash', BIN, '--asset', asset, '--root', root]);
  return {
    code: proc.exitCode,
    err: new TextDecoder().decode(proc.stderr),
  };
}

describe('photo-bg-remove.sh --asset validation', () => {
  test('rejects path traversal', () => {
    const res = run('assets/../../../etc/passwd');
    expect(res.code).toBe(2);
    expect(res.err).toContain('must look like assets/<sha8>.<ext>');
  });

  test('rejects an injection-shaped value (quotes/braces breaking out of the JSX splice)', () => {
    const res = run('assets/aaaaaaaa.png" }; alert(1); ({ "y.png');
    expect(res.code).toBe(2);
  });

  test('rejects backtick-embedded values', () => {
    const res = run('assets/aaaaaaaa$(whoami).png');
    expect(res.code).toBe(2);
  });

  test('rejects uppercase hex (sha8 is always lowercase in this codebase)', () => {
    const res = run('assets/DEADBEEF.png');
    expect(res.code).toBe(2);
  });

  test('rejects a bare prefix with no hex body', () => {
    const res = run('assets/');
    expect(res.code).toBe(2);
  });

  test('a well-formed reference proceeds past validation (fails later, not with exit 2)', () => {
    const res = run('assets/deadbeef.png');
    expect(res.code).not.toBe(2);
    // No asset on disk under this temp root — fails at the existence check
    // (exit 1), proving the regex accepted the shape and let it through.
    expect(res.code).toBe(1);
    expect(res.err).toContain('asset not found');
  });
});
