/**
 * Fixtures for the git-lifecycle UI scenario (DDR-133). Provides a REAL github-backed
 * clone (so push/pull/fetch/merge exercise the actual network path) plus a second
 * local git project to switch to.
 *
 * `primary`  — a fresh clone of iagh66/maude-git-smoke (a throwaway test repo with a
 *              `.design/`), reset to a clean `main`, local test branches pruned. The
 *              scenario runs through the real GitHub remote; the conf sets
 *              MAUDE_USE_SYSTEM_GIT=1 so push/pull/fetch use the developer's own git
 *              credential helper (the test app isn't signed into GitHub) — verified
 *              tokenless in the de-risk.
 * `secondary`— the offline make-git-fixture repo, the target of the switch-repos step.
 */
import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { makeGitFixture } from './make-git-fixture';

const REMOTE = 'https://github.com/iagh66/maude-git-smoke.git';

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  }).trim();
}

export function makeLifecycleFixture(): { primary: string; secondary: string } {
  const primary = join(tmpdir(), 'maude-e2e-lifecycle');
  rmSync(primary, { recursive: true, force: true });
  // FULL clone (no --depth): a shallow clone defaults to --single-branch, whose
  // fetch refspec is `main` only, so the "fetch remote branches" step would never
  // discover a teammate branch. The repo is tiny, so a full clone is cheap.
  execFileSync('git', ['clone', REMOTE, primary], {
    encoding: 'utf8',
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  });
  git(primary, 'checkout', 'main');
  git(primary, 'reset', '--hard', 'origin/main');
  // Prune any local test branches left by a prior run (start from a clean main).
  const locals = git(primary, 'for-each-ref', '--format=%(refname:short)', 'refs/heads')
    .split('\n')
    .map((b) => b.trim())
    .filter((b) => b && b !== 'main');
  for (const b of locals) {
    try {
      git(primary, 'branch', '-D', b);
    } catch {
      /* ignore */
    }
  }
  const secondary = makeGitFixture();
  return { primary, secondary };
}
