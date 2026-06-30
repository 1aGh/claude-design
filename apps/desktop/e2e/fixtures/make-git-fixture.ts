/**
 * Build a deterministic multi-branch git repo fixture for the branch-switcher
 * scenario (DDR-133). The RepoBranchSwitcher only renders for a git repo, and the
 * fix we're proving is "list all branches fast via system git + git-native labels +
 * no phantom origin row" — so the fixture needs LOCAL + REMOTE-tracking refs, a
 * non-default current branch, and an `origin/HEAD` symbolic ref (the phantom source).
 *
 * Created fresh under the OS temp dir each run (wiped + recreated) so the repo state
 * is identical every time. The dir contains a `.design/` (copied from the static
 * fixture) so the dev-server boots, AND a `.git/` with the branch graph below.
 *
 * Branch graph (what gitListBranches should return):
 *   main                  → both    (local + origin/main)             → "default branch"
 *   feat/local-work       → local
 *   feat/nav-redesign     → local, CURRENT (HEAD)                     → "your branch" + Merge CTA
 *   feat/teammate-draft   → remote  (origin only, no local)           → "remote · not downloaded yet"
 *   origin/HEAD           → symbolic → MUST NOT appear as a "origin" row (the bug we fixed)
 */

import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: '0',
      GIT_AUTHOR_NAME: 'Maude E2E',
      GIT_AUTHOR_EMAIL: 'e2e@maude.local',
      GIT_COMMITTER_NAME: 'Maude E2E',
      GIT_COMMITTER_EMAIL: 'e2e@maude.local',
    },
  }).trim();
}

/** Create (or recreate) the fixture repo and return its absolute path. */
export function makeGitFixture(): string {
  const root = join(tmpdir(), 'maude-e2e-git-fixture');
  rmSync(root, { recursive: true, force: true });
  mkdirSync(root, { recursive: true });

  // A bootable .design/ project (copied from the static fixture).
  cpSync(join(HERE, 'project', '.design'), join(root, '.design'), { recursive: true });

  git(root, 'init', '-b', 'main');
  git(root, 'add', '-A');
  git(root, 'commit', '-m', 'fixture: initial design project');
  const mainSha = git(root, 'rev-parse', 'HEAD');

  // A second local branch off main.
  git(root, 'branch', 'feat/local-work');

  // The CURRENT branch is a feature branch (not main) so the switcher shows the
  // "your branch" row + the "Merge this branch → main" CTA.
  git(root, 'checkout', '-b', 'feat/nav-redesign');
  // one extra commit so it's genuinely ahead of main (realistic draft)
  git(root, 'commit', '--allow-empty', '-m', 'fixture: wip on nav-redesign');

  // Remote-tracking refs WITHOUT any network or configured remote URL: hand-written
  // refs/remotes/origin/* only. Deliberately NO `git remote add` — an unattended
  // remote ahead/behind probe must classify the remote as 'none' and never spawn a
  // `git fetch` (keeps the e2e fully offline + deterministic). The switcher still
  // tags these as `where: remote` because they live under refs/remotes/origin on disk.
  git(root, 'update-ref', 'refs/remotes/origin/main', mainSha); // → main becomes "both"
  git(root, 'update-ref', 'refs/remotes/origin/feat/teammate-draft', mainSha); // remote-only draft
  // origin/HEAD symbolic ref — `%(refname:short)` collapses it to bare "origin";
  // the fix must filter it so NO phantom "origin" row appears.
  git(root, 'symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/main');

  return root;
}
