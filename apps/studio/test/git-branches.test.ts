// Phase 29 (E4) — drafts (branches). List / create / switch against a REAL local
// git repo via the default isomorphic-git engine (no network). The vocabulary
// mapping (draft=branch, "Shared version"=main) lives in the UI; this proves the
// plumbing + the dash-led / duplicate / dirty-tree guards.

import { afterEach, beforeEach, expect, test } from 'bun:test';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  gitCheckout,
  gitCreateBranch,
  gitFetchRemote,
  gitFoldDraft,
  gitListBranches,
  remoteAheadBehind,
} from '../git/service.ts';

let dir: string;

function shIn(cwd: string, args: string[]): void {
  const p = Bun.spawnSync(['git', ...args], {
    cwd,
    env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' },
  });
  if (p.exitCode !== 0) throw new Error(`git ${args.join(' ')}: ${p.stderr.toString()}`);
}
function sh(args: string[]): void {
  shIn(dir, args);
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

test('carries a last-commit time so the UI can sort by recents', async () => {
  const branches = await gitListBranches(dir);
  expect(typeof branches[0].updatedAt).toBe('number');
  expect(branches[0].updatedAt).toBeGreaterThan(0);
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

// ── remote drafts (phase: surface remote branches) ───────────────────────────

/** Stand up a bare "remote" with main + a teammate draft, clone it locally (system
 *  git, no network — a file:// remote), and return the clone dir. The clone has a
 *  LOCAL main plus refs/remotes/origin/{main,teammate-draft}. */
function cloneWithRemoteDraft(): { remote: string; clone: string } {
  const remote = mkdtempSync(join(tmpdir(), 'maude-remote-'));
  shIn(remote, ['init', '-q', '--bare']);
  sh(['remote', 'add', 'origin', remote]);
  const head = (
    Bun.spawnSync(['git', 'rev-parse', '--abbrev-ref', 'HEAD'], { cwd: dir }).stdout.toString() ||
    'main'
  ).trim();
  sh(['push', '-q', 'origin', head]);
  sh(['checkout', '-q', '-b', 'teammate-draft']);
  writeFileSync(join(dir, 'team.txt'), 'team work\n');
  sh(['add', '.']);
  sh(['commit', '-q', '-m', 'team work']);
  sh(['push', '-q', 'origin', 'teammate-draft']);
  sh(['checkout', '-q', head]); // leave the source repo back on the shared version
  const clone = mkdtempSync(join(tmpdir(), 'maude-clone-'));
  shIn(clone, ['clone', '-q', remote, '.']);
  return { remote, clone };
}

test('surfaces a remote-only draft and tags where=remote / where=both', async () => {
  const { clone } = cloneWithRemoteDraft();
  const branches = await gitListBranches(clone);
  const team = branches.find((b) => b.name === 'teammate-draft');
  const shared = branches.find((b) => ['main', 'master'].includes(b.name));
  expect(team?.where).toBe('remote'); // only on the remote in a fresh clone
  expect(team?.current).toBe(false);
  expect(shared?.where).toBe('both'); // checked out locally AND on the remote
  expect(shared?.current).toBe(true);
  rmSync(clone, { recursive: true, force: true });
});

test('switches onto a remote-only draft by creating a local tracking branch', async () => {
  const { clone } = cloneWithRemoteDraft();
  const res = await gitCheckout(clone, 'teammate-draft');
  expect(res.ok).toBe(true);
  const after = await gitListBranches(clone);
  const team = after.find((b) => b.name === 'teammate-draft');
  expect(team?.current).toBe(true);
  expect(team?.where).toBe('both'); // now local AND remote
  expect(existsSync(join(clone, 'team.txt'))).toBe(true); // the draft's content landed
  rmSync(clone, { recursive: true, force: true });
});

test('checkout of a never-fetched draft asks for a Refresh, not a raw error', async () => {
  const res = await gitCheckout(dir, 'ghost-remote-draft');
  expect(res.ok).toBe(false);
  expect(res.error).toMatch(/refresh/i);
});

test('fetch of an HTTPS remote without a token reports authRequired (iso engine)', async () => {
  // iso-git can't use a system credential helper, so a tokenless HTTPS refresh
  // short-circuits to authRequired BEFORE any network call. Pin iso for this
  // assertion (DDR-133: with system git available a tokenless fetch instead uses the
  // dev's credential helper — that path is covered by the git-lifecycle e2e).
  const prev = process.env.MAUDE_NO_SYSTEM_GIT;
  process.env.MAUDE_NO_SYSTEM_GIT = '1';
  try {
    sh(['remote', 'add', 'origin', 'https://github.com/example/repo.git']);
    const r = await gitFetchRemote(dir, undefined);
    expect(r.ok).toBe(false);
    expect(r.authRequired).toBe(true);
  } finally {
    if (prev === undefined) delete process.env.MAUDE_NO_SYSTEM_GIT;
    else process.env.MAUDE_NO_SYSTEM_GIT = prev;
  }
});

test('an ssh remote routes to system git, never the iso transport error', async () => {
  // iso-git speaks HTTP(S) only; an ssh remote must go through the git binary
  // (user's ssh-agent, no token). A .invalid host fails fast at DNS — no network.
  process.env.GIT_SSH_COMMAND =
    'ssh -o BatchMode=yes -o ConnectTimeout=2 -o StrictHostKeyChecking=no';
  sh(['remote', 'add', 'origin', 'git@nonexistent.invalid:team/app.git']);
  const r = await gitFetchRemote(dir, undefined);
  process.env.GIT_SSH_COMMAND = '';
  expect(r.ok).toBe(false);
  expect(r.authRequired).toBeFalsy(); // ssh failure is not a GitHub sign-in prompt
  expect(r.error || '').not.toMatch(/unrecognized transport/i); // didn't fall into iso
});

// ── transport-injection hardening (adversarial review of 75a2f0d) ────────────

test('SECURITY: refuses to fetch an `ext::` (command-executing) remote — no spawn, no RCE', async () => {
  // A poisoned .git/config remote url. `git fetch origin` would resolve this and
  // run the shell command; classifyRemoteUrl must refuse BEFORE any spawn.
  const sentinel = join(dir, 'PWNED');
  sh(['remote', 'add', 'origin', `ext::sh -c "touch ${sentinel}"`]);
  const r = await gitFetchRemote(dir, 'tok_should_not_be_used');
  expect(r.ok).toBe(false);
  expect(r.error).toMatch(/github\.com/i); // "can only refresh github.com…"
  expect(existsSync(sentinel)).toBe(false); // the payload NEVER executed
});

test('SECURITY: the unattended ahead/behind probe refuses an `ext::` remote (0/0, no spawn)', async () => {
  const sentinel = join(dir, 'PWNED2');
  sh(['remote', 'add', 'origin', `ext::sh -c "touch ${sentinel}"`]);
  const ab = await remoteAheadBehind(dir, 'tok_should_not_be_used');
  expect(ab).toEqual({ ahead: 0, behind: 0 });
  expect(existsSync(sentinel)).toBe(false);
});

test('SECURITY: refuses a file:// / local-path remote (local-read vector, no spawn)', async () => {
  sh(['remote', 'add', 'origin', 'file:///etc/passwd']);
  const r = await gitFetchRemote(dir, 'tok');
  expect(r.ok).toBe(false);
  expect(r.error).toMatch(/github\.com/i); // refused by policy, never handed to git
});

test('SECURITY: does not send the GitHub token to a non-GitHub HTTPS host', async () => {
  // A non-github HTTPS remote must NOT receive the keychain PAT (exfil/SSRF).
  sh(['remote', 'add', 'origin', 'https://evil.example.com/repo.git']);
  const r = await gitFetchRemote(dir, 'tok_secret');
  expect(r.ok).toBe(false);
  expect(r.error).toMatch(/github\.com/i); // refused, token never attached
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
