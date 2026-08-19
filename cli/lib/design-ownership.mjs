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
import { existsSync, lstatSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/**
 * Write `.gitignore` only when it is a REGULAR FILE, and atomically.
 *
 * Git can carry a symlink named `.gitignore`, and a clone of a repo somebody
 * else influences is exactly the surface this module runs against. Following
 * one turns a mode switch into an arbitrary-path overwrite. Temp + rename
 * also means a crash mid-write cannot leave a repo with half an ignore file.
 */
function writeGitignoreSafely(path, contents) {
  if (existsSync(path) && !lstatSync(path).isFile()) {
    throw new Error(`${path} is not a regular file — refusing to write through it`);
  }
  const tmp = `${path}.maude-${process.pid}.tmp`;
  writeFileSync(tmp, contents, 'utf8');
  renameSync(tmp, path);
}

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

/**
 * The marker pair, matched as WHOLE LINES and only when well-formed.
 *
 * A substring test was not enough, and the gap had teeth: a `.gitignore` is a
 * committed file in a shared repo, which DDR-054 says peers can write. Put a
 * BEGIN marker near the top, an END marker at the bottom, and the victim's
 * real rules in between — `.env`, `*.pem`, `secrets/` — and the "update the
 * existing block" path would replace the whole span with our five lines. Every
 * one of those rules gone, staged, and on a cloud-managed repo mirrored
 * onward. So: line-anchored, exactly one pair, BEGIN before END, or this is
 * not our block and we do not touch it.
 *
 * @returns {{ ok: true, start: number, end: number } | { ok: false, reason: string }}
 */
export function findOwnershipBlock(contents) {
  if (typeof contents !== 'string') return { ok: false, reason: 'absent' };
  const lines = contents.split('\n');
  const begins = [];
  const ends = [];
  lines.forEach((line, i) => {
    if (line.trim() === OWNERSHIP_BEGIN) begins.push(i);
    if (line.trim() === OWNERSHIP_END) ends.push(i);
  });
  if (begins.length === 0 && ends.length === 0) return { ok: false, reason: 'absent' };
  if (begins.length !== 1 || ends.length !== 1) return { ok: false, reason: 'malformed' };
  if (ends[0] < begins[0]) return { ok: false, reason: 'malformed' };
  // A well-formed block is OURS, and ours has a fixed SHAPE: comment lines,
  // plus exactly one rule, and that rule is an anchored directory path. A line
  // count is not enough — a hostile block wrapping four of the victim's real
  // rules is the same length as the one we write.
  const inner = lines.slice(begins[0] + 1, ends[0]).filter((l) => l.trim().length > 0);
  const rules = inner.filter((l) => !l.trim().startsWith('#'));
  if (rules.length !== 1 || !/^\/[^/].*\/$/.test(rules[0].trim())) {
    return { ok: false, reason: 'malformed' };
  }
  return { ok: true, start: begins[0], end: ends[0] };
}

/** Is this repo already declared hub-owned, by a block we recognise? */
export function isHubOwned(gitignoreContents) {
  return findOwnershipBlock(gitignoreContents).ok === true;
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
  const found = findOwnershipBlock(contents);
  if (found.ok) {
    const lines = contents.split('\n');
    const replaced = [
      ...lines.slice(0, found.start),
      ...block.split('\n').slice(0, -1),
      ...lines.slice(found.end + 1),
    ];
    return { contents: replaced.join('\n'), action: 'updated' };
  }
  if (found.reason === 'malformed') {
    // REFUSE, never rewrite. Markers we did not write are somebody else's
    // content, and guessing at its extent is how a rewrite eats real rules.
    return { contents, action: 'refused-malformed' };
  }
  const base = contents.length === 0 || contents.endsWith('\n') ? contents : `${contents}\n`;
  return { contents: `${base}${base.length > 0 ? '\n' : ''}${block}`, action: 'added' };
}

/** Remove the block, idempotently. Returns `{ contents, action }`. */
export function removeOwnershipBlock(contents) {
  const found = findOwnershipBlock(contents);
  if (!found.ok) {
    return { contents, action: found.reason === 'malformed' ? 'refused-malformed' : 'absent' };
  }
  const lines = contents.split('\n');
  const kept = [...lines.slice(0, found.start), ...lines.slice(found.end + 1)];
  return { contents: kept.join('\n').replace(/\n{3,}/g, '\n\n'), action: 'removed' };
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
  // A `.gitignore` carrying markers we did not write is not ours to edit, and
  // untracking the design root against one would be acting on a state we
  // could not read. Refuse the whole transition, not just the write.
  if (action === 'refused-malformed') {
    return { action, untracked: 0, tracked, dryRun: false };
  }

  writeGitignoreSafely(gitignorePath, contents);
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
  if (dryRun || action === 'absent' || action === 'refused-malformed') return { action, dryRun };
  writeGitignoreSafely(gitignorePath, contents);
  execFileSync('git', ['add', '--', '.gitignore'], {
    cwd: repoRoot,
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  return { action, dryRun: false };
}
