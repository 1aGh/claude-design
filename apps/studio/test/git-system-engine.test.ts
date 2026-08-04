// The engine a CELL actually runs — Cloud Phase 27 D2.
//
// WHY THIS FILE EXISTS. `MAUDE_USE_SYSTEM_GIT=1` used to be an escape hatch
// nobody set, so `commitSystem` and the system-git halves of checkout / branch /
// discard / fold had no coverage at all while their isomorphic-git twins had
// plenty. D2 makes every cloud tenant's saves go through exactly those halves
// (studio-child.mjs pins it, because two git engines over one index is not a
// race a careful caller can avoid — it is two programs writing one file).
//
// Shipping that flip while its code path was the untested one would be trading a
// known bug for an unmeasured one. These are the same assertions the iso engine
// already gets, run against the engine the cloud uses.

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  gitCheckout,
  gitCommit,
  gitCreateBranch,
  gitDiscard,
  gitListBranches,
  gitStatus,
} from '../git/service.ts';

let dir: string;
let saved: string | undefined;

function run(args: string[], cwd: string) {
  const r = Bun.spawnSync(['git', ...args], { cwd });
  return { code: r.exitCode, stdout: r.stdout.toString(), stderr: r.stderr.toString() };
}

beforeEach(() => {
  saved = process.env.MAUDE_USE_SYSTEM_GIT;
  // The whole point: the flag is read LIVE, so it can be scoped to this file
  // instead of leaking into every other suite through a module-load const.
  process.env.MAUDE_USE_SYSTEM_GIT = '1';

  dir = mkdtempSync(join(tmpdir(), 'maude-system-git-'));
  run(['init', '-b', 'main'], dir);
  run(['config', 'user.name', 'Test'], dir);
  run(['config', 'user.email', 'test@example.com'], dir);
  mkdirSync(join(dir, '.design', 'ui'), { recursive: true });
  writeFileSync(join(dir, '.design', 'ui', 'Home.tsx'), 'export const v = 1;\n');
  run(['add', '-A'], dir);
  run(['commit', '-m', 'seed'], dir);
});

afterEach(() => {
  if (saved === undefined) {
    delete process.env.MAUDE_USE_SYSTEM_GIT;
  } else process.env.MAUDE_USE_SYSTEM_GIT = saved;
  rmSync(dir, { recursive: true, force: true });
});

describe('the system-git engine a cell runs on', () => {
  test('a save commits exactly the selected file and nothing else', async () => {
    writeFileSync(join(dir, '.design', 'ui', 'Home.tsx'), 'export const v = 2;\n');
    writeFileSync(join(dir, '.design', 'ui', 'Other.tsx'), 'export const other = 1;\n');

    const res = await gitCommit(dir, 'update home', ['.design/ui/Home.tsx'], {
      designPrefix: '.design',
    });
    expect(res.ok).toBe(true);

    // The other file is still uncommitted — "Save selected" must mean selected.
    const after = await gitStatus(dir, { designPrefix: '.design' });
    expect(after.files.map((f) => f.path)).toEqual(['.design/ui/Other.tsx']);
  });

  test('save-all commits every change in scope', async () => {
    writeFileSync(join(dir, '.design', 'ui', 'Home.tsx'), 'export const v = 3;\n');
    writeFileSync(join(dir, '.design', 'ui', 'New.tsx'), 'export const n = 1;\n');

    const res = await gitCommit(dir, 'save all', undefined, { designPrefix: '.design' });
    expect(res.ok).toBe(true);
    expect((await gitStatus(dir, { designPrefix: '.design' })).clean).toBe(true);
  });

  test('nothing to save is a refusal, not an empty commit', async () => {
    const before = run(['rev-list', '--count', 'HEAD'], dir).stdout.trim();
    const res = await gitCommit(dir, 'nothing', undefined, { designPrefix: '.design' });
    expect(res.ok).toBe(false);
    expect(run(['rev-list', '--count', 'HEAD'], dir).stdout.trim()).toBe(before);
  });

  test('discard restores a tracked file and deletes an untracked one', async () => {
    writeFileSync(join(dir, '.design', 'ui', 'Home.tsx'), 'wrecked\n');
    writeFileSync(join(dir, '.design', 'ui', 'Scratch.tsx'), 'temporary\n');

    const res = await gitDiscard(dir, ['.design/ui/Home.tsx', '.design/ui/Scratch.tsx'], {
      designPrefix: '.design',
    });
    expect(res.ok).toBe(true);
    expect(readFileSync(join(dir, '.design', 'ui', 'Home.tsx'), 'utf8')).toBe(
      'export const v = 1;\n'
    );
    expect(existsSync(join(dir, '.design', 'ui', 'Scratch.tsx'))).toBe(false);
  });

  test('a draft is created, switched to, and switched back', async () => {
    const made = await gitCreateBranch(dir, 'nav-redesign');
    expect(made.ok).toBe(true);
    expect(run(['rev-parse', '--abbrev-ref', 'HEAD'], dir).stdout.trim()).toBe('nav-redesign');

    const back = await gitCheckout(dir, 'main');
    expect(back.ok).toBe(true);
    expect(run(['rev-parse', '--abbrev-ref', 'HEAD'], dir).stdout.trim()).toBe('main');

    expect((await gitListBranches(dir)).map((b) => b.name).sort()).toEqual([
      'main',
      'nav-redesign',
    ]);
  });

  test('switching with unsaved changes says so instead of losing them', async () => {
    await gitCreateBranch(dir, 'draft');
    writeFileSync(join(dir, '.design', 'ui', 'Home.tsx'), 'export const v = 99;\n');
    await gitCommit(dir, 'draft edit', undefined, { designPrefix: '.design' });
    await gitCheckout(dir, 'main');

    // Now dirty on main in a way the switch would clobber.
    writeFileSync(join(dir, '.design', 'ui', 'Home.tsx'), 'export const v = 1000;\n');
    const res = await gitCheckout(dir, 'draft');
    expect(res.ok).toBe(false);
    expect(res.error).toContain('Save your changes');
    // The unsaved bytes are still there — the refusal is the point.
    expect(readFileSync(join(dir, '.design', 'ui', 'Home.tsx'), 'utf8')).toBe(
      'export const v = 1000;\n'
    );
  });
});
