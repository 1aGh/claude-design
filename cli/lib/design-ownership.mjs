// Two ownership modes for `.design/`, and nothing between them — DDR-228,
// Sync v2 Increment 4.5.
//
//   Mode A — repo-owned.  The folder is committed. Your git is the truth,
//                         collaboration is `git pull`, Maude is not involved.
//   Mode B — hub-owned.   The folder is GITIGNORED and mirrored by the hub.
//                         The hub's own history plus object storage is the
//                         truth, collaboration is live, and the local copy is
//                         a full working mirror rather than the original.
//
// The hybrid — linked AND committed — is the state this module exists to end.
// It looks harmless and is not: two systems own the same bytes with different
// merge rules, so a `git pull` and a sync pass can each undo the other, and
// which one wins depends on timing. Worse, it reads as extra safety ("it's in
// git AND in the cloud") right up until the two disagree.
//
// Transitions are one-shot, explicit, and confirmed. They are NOT a sync mode:
//
//   adopt  (A → B)  push what is here, then ignore + untrack it.
//   detach (B → A)  stop syncing, un-ignore, and let the person commit.
//
// ── What this module deliberately does not touch ────────────────────────────
//
// DDR-115's runtime-state lists govern what syncs INSIDE `.design/`, and the
// design-runtime `.gitignore` block (`gitignore-block.mjs`) governs which of
// those per-machine files git should skip. Both remain exactly as they are.
// This is a FIFTH, different concern: whether the design root as a WHOLE is
// the repo's business at all. Conflating them would mean a mode switch
// silently rewriting the taxonomy.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/** The marker pair around the whole-folder ignore, so it can be removed exactly. */
export const OWNERSHIP_BEGIN = '# maude:hub-owned:begin';
export const OWNERSHIP_END = '# maude:hub-owned:end';

/**
 * The block that makes a design root hub-owned.
 *
 * A trailing `/` so it matches the directory and everything under it, and an
 * explicit un-ignore of nothing — the block is deliberately one rule. A
 * cleverer block (ignore the folder but keep `config.json`) is the hybrid
 * wearing a disguise: `config.json` names the hub, so a committed one is how
 * a teammate discovers the project, and that is `maude design link`'s job.
 */
export function buildOwnershipBlock(designRel = '.design') {
  const rel = designRel.replace(/^\.\//, '').replace(/\/+$/, '');
  return [
    OWNERSHIP_BEGIN,
    '# This project is hub-owned: the design folder is mirrored by your Maude hub,',
    '# not by git. Run `maude design detach` to take it back into the repo.',
    `/${rel}/`,
    OWNERSHIP_END,
    '',
  ].join('\n');
}

/** Is this repo already declared hub-owned? */
export function isHubOwned(gitignoreContents) {
  return typeof gitignoreContents === 'string' && gitignoreContents.includes(OWNERSHIP_BEGIN);
}

/**
 * Add the block, idempotently. Returns `{ contents, action }`.
 *
 * Appended at the END on purpose: gitignore is last-match-wins, so a rule that
 * has to hold cannot sit above a broader pattern that would re-include the
 * path. This is the same reasoning the store-layout note in CLAUDE.md records
 * for `.kgai/`, and it was learned the same way.
 */
export function applyOwnershipBlock(contents, designRel = '.design') {
  const block = buildOwnershipBlock(designRel);
  if (isHubOwned(contents)) {
    const re = new RegExp(`${OWNERSHIP_BEGIN}[\\s\\S]*?${OWNERSHIP_END}\\n?`, 'm');
    return { contents: contents.replace(re, block), action: 'updated' };
  }
  const base = contents.length === 0 || contents.endsWith('\n') ? contents : `${contents}\n`;
  return { contents: `${base}${base.length > 0 ? '\n' : ''}${block}`, action: 'added' };
}

/** Remove the block, idempotently. Returns `{ contents, action }`. */
export function removeOwnershipBlock(contents) {
  if (!isHubOwned(contents)) return { contents, action: 'absent' };
  const re = new RegExp(`\\n?${OWNERSHIP_BEGIN}[\\s\\S]*?${OWNERSHIP_END}\\n?`, 'm');
  return { contents: contents.replace(re, '\n').replace(/\n{3,}/g, '\n\n'), action: 'removed' };
}

/**
 * Is `dir` inside a git work tree at all?
 *
 * A design root outside a repo is perfectly ordinary — Maude does not require
 * git — and in that case the whole ownership question is moot: there is no
 * second owner to be in conflict with, so every transition here is a no-op
 * rather than an error.
 */
export function isGitRepo(dir) {
  try {
    const out = execFileSync('git', ['rev-parse', '--is-inside-work-tree'], {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out.trim() === 'true';
  } catch {
    return false;
  }
}

/**
 * Which paths under `designRel` git currently TRACKS.
 *
 * `git rm --cached` on an untracked path exits non-zero, and a mode switch
 * that fails halfway is worse than one that refuses — so the caller asks first
 * and acts on the answer. Empty list on any git failure: a repo git cannot
 * read is one this must not start mutating.
 */
export function trackedDesignPaths(repoRoot, designRel = '.design') {
  try {
    const out = execFileSync('git', ['ls-files', '-z', '--', designRel], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out.split('\0').filter((p) => p.length > 0);
  } catch {
    return [];
  }
}

/**
 * Is this design root inside a Syncthing-managed folder?
 *
 * Syncthing does not read `.gitignore`, so a hub-owned project inside a synced
 * tree rides TWO transports with different conflict rules — the exact
 * double-ownership this module exists to prevent, arriving through a door
 * gitignore cannot close. `~/git` is such a tree, so this is the maintainer's
 * own setup, not a hypothetical.
 */
export function syncthingFolderRoot(startDir) {
  let cur = resolve(startDir);
  for (;;) {
    if (existsSync(join(cur, '.stfolder'))) return cur;
    const up = dirname(cur);
    if (up === cur) return null;
    cur = up;
  }
}

/** The `.stignore` line that keeps Syncthing out of a hub-owned design root. */
export function stignoreLineFor(repoRoot, designRel, syncthingRoot) {
  const abs = join(resolve(repoRoot), designRel);
  const rel = abs.slice(resolve(syncthingRoot).length + 1);
  return `/${rel.split('\\').join('/')}`;
}

/**
 * Everything a caller needs to describe the current state without changing it.
 *
 * Read-only by design: both the CLI and the desktop dialog ask this first, so
 * the two surfaces cannot disagree about what mode a project is in.
 */
export function ownershipState(repoRoot, { designRel = '.design', linked = false } = {}) {
  const gitignorePath = resolve(repoRoot, '.gitignore');
  const contents = existsSync(gitignorePath) ? readFileSync(gitignorePath, 'utf8') : '';
  const ignored = isHubOwned(contents);
  const tracked = trackedDesignPaths(repoRoot, designRel);
  const stRoot = syncthingFolderRoot(repoRoot);
  const git = isGitRepo(repoRoot);

  // The hybrid is precisely: linked, and git still carries the folder. With no
  // repo there is no second owner, so a linked project is simply hub-owned.
  const mode = !git
    ? linked
      ? 'hub-owned'
      : 'repo-owned'
    : !linked
      ? 'repo-owned'
      : ignored && tracked.length === 0
        ? 'hub-owned'
        : 'hybrid';

  return {
    mode,
    git,
    ignored,
    trackedCount: tracked.length,
    tracked,
    syncthingRoot: stRoot,
    ...(stRoot ? { stignoreLine: stignoreLineFor(repoRoot, designRel, stRoot) } : {}),
  };
}

/**
 * A → B. Ignore the folder and stop tracking it. Returns what changed.
 *
 * The working tree is NOT touched — `--cached` removes the index entry and
 * leaves every byte on disk. That is the whole safety property: if this is the
 * wrong call, `maude design detach` puts it back with nothing lost, because
 * nothing was ever deleted.
 *
 * Staging is explicit and narrow (the removals plus `.gitignore`), never
 * `git add -A`: this runs in whatever state the person's tree happens to be
 * in, and a mode switch that sweeps up their unrelated work is a mode switch
 * nobody will trust again.
 */
export function adoptToHub(repoRoot, { designRel = '.design', dryRun = false } = {}) {
  if (!isGitRepo(repoRoot)) return { action: 'no-git', untracked: 0, tracked: [], dryRun };
  const gitignorePath = resolve(repoRoot, '.gitignore');
  const before = existsSync(gitignorePath) ? readFileSync(gitignorePath, 'utf8') : '';
  const { contents, action } = applyOwnershipBlock(before, designRel);
  const tracked = trackedDesignPaths(repoRoot, designRel);

  if (dryRun) return { action, untracked: tracked.length, tracked, dryRun: true };

  writeFileSync(gitignorePath, contents, 'utf8');
  if (tracked.length > 0) {
    // `-r --cached` in one call; `--ignore-unmatch` so a concurrent removal
    // between the listing and here is not a failed mode switch.
    execFileSync('git', ['rm', '-r', '--cached', '--quiet', '--ignore-unmatch', '--', designRel], {
      cwd: repoRoot,
      stdio: ['ignore', 'ignore', 'pipe'],
    });
  }
  execFileSync('git', ['add', '--', '.gitignore'], {
    cwd: repoRoot,
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  return { action, untracked: tracked.length, tracked, dryRun: false };
}

/**
 * B → A. Un-ignore the folder so the person can commit it again.
 *
 * Deliberately does NOT commit, and does not `git add` the design root: what
 * to commit and when is theirs. The bytes are already on disk in full — the
 * mirror is a complete copy, not a cache — so there is nothing to fetch and
 * nothing that can be lost by waiting.
 */
export function detachToRepo(repoRoot, { dryRun = false } = {}) {
  if (!isGitRepo(repoRoot)) return { action: 'no-git', dryRun };
  const gitignorePath = resolve(repoRoot, '.gitignore');
  if (!existsSync(gitignorePath)) return { action: 'absent', dryRun };
  const before = readFileSync(gitignorePath, 'utf8');
  const { contents, action } = removeOwnershipBlock(before);
  if (dryRun || action === 'absent') return { action, dryRun };
  writeFileSync(gitignorePath, contents, 'utf8');
  execFileSync('git', ['add', '--', '.gitignore'], {
    cwd: repoRoot,
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  return { action, dryRun: false };
}
