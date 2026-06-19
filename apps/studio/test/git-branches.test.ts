// Phase 29 (E4) — drafts (branches). List / create / switch against a REAL local
// git repo via the default isomorphic-git engine (no network). The vocabulary
// mapping (draft=branch, "Shared version"=main) lives in the UI; this proves the
// plumbing + the dash-led / duplicate / dirty-tree guards.

import { afterEach, beforeEach, expect, test } from 'bun:test';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { gitCheckout, gitCreateBranch, gitFoldDraft, gitListBranches } from '../git/service.ts';

let dir: string;

function sh(args: string[]): void {
  const p = Bun.spawnSync(['git', ...args], {
    cwd: dir,
    env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' },
  });
  if (p.exitCode !== 0) throw new Error(`git ${args.join(' ')}: ${p.stderr.toString()}`);
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'maude-drafts-'));
  sh(['init', '-q']);
  sh(['config', 'user.email', 't@t.dev']);
  sh(['config', 'user.name', 'Tester']);
  writeFileSync(join(dir, 'a.txt'), 'hello\n');
  sh(['add', '.']);
  sh(['commit', '-q', '-m', 'init']);
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

test('lists the default branch as current', async () => {
  const branches = await gitListBranches(dir);
  expect(branches.length).toBe(1);
  expect(branches[0].current).toBe(true);
  expect(['main', 'master']).toContain(branches[0].name);
});

test('creates a new draft off HEAD and switches to it', async () => {
  const res = await gitCreateBranch(dir, 'nav-redesign');
  expect(res.ok).toBe(true);
  expect(res.branch).toBe('nav-redesign');
  const branches = await gitListBranches(dir);
  const cur = branches.find((b) => b.current);
  expect(cur?.name).toBe('nav-redesign');
  expect(branches.map((b) => b.name).sort()).toContain('nav-redesign');
});

test('switches back to the shared version', async () => {
  const before = await gitListBranches(dir);
  const shared = before[0].name; // main/master
  await gitCreateBranch(dir, 'pricing-experiment');
  const res = await gitCheckout(dir, shared);
  expect(res.ok).toBe(true);
  const cur = (await gitListBranches(dir)).find((b) => b.current);
  expect(cur?.name).toBe(shared);
});

test('rejects a dash-led / malformed draft name (argv-injection guard)', async () => {
  const r1 = await gitCreateBranch(dir, '--upload-pack=evil');
  expect(r1.ok).toBe(false);
  const r2 = await gitCreateBranch(dir, 'has spaces');
  expect(r2.ok).toBe(false);
});

test('fold: rejects a draft that does not exist', async () => {
  const r = await gitFoldDraft(dir, 'ghost', undefined, {});
  expect(r.ok).toBe(false);
  expect(r.error).toMatch(/doesn't exist/i);
});

test('fold: rejects folding the Shared version into itself', async () => {
  const shared = (await gitListBranches(dir)).find((b) => b.current)?.name as string;
  const r = await gitFoldDraft(dir, shared, undefined, {});
  expect(r.ok).toBe(false);
  expect(r.error).toMatch(/already the Shared version/i);
});

test('fold: merges the draft into the Shared version locally; a tokenless publish leaves the draft intact', async () => {
  const shared = (await gitListBranches(dir)).find((b) => b.current)?.name as string;
  await gitCreateBranch(dir, 'nav'); // checks out 'nav'
  writeFileSync(join(dir, 'b.txt'), 'draft work\n');
  sh(['add', '.']);
  sh(['commit', '-q', '-m', 'draft work']);
  const r = await gitFoldDraft(dir, 'nav', undefined, {});
  // No token/remote → the publish step returns authRequired, so the draft is NOT removed…
  expect(r.ok).toBe(false);
  expect(r.authRequired).toBe(true);
  // …but the merge landed: the Shared version (now checked out) contains the draft's file…
  expect(existsSync(join(dir, 'b.txt'))).toBe(true);
  expect((await gitListBranches(dir)).find((b) => b.current)?.name).toBe(shared);
  // …and the draft still exists (not deleted on a failed publish).
  expect((await gitListBranches(dir)).some((b) => b.name === 'nav')).toBe(true);
});

test('rejects creating a draft that already exists', async () => {
  await gitCreateBranch(dir, 'dupe');
  // back to a fresh ref first so create (which checks out) has a clean base
  const shared = (await gitListBranches(dir)).find((b) => !b.current);
  if (shared) await gitCheckout(dir, shared.name);
  const r = await gitCreateBranch(dir, 'dupe');
  expect(r.ok).toBe(false);
  expect(r.error).toMatch(/already exists/i);
});
