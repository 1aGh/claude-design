// The checkout's durability lane — Cloud Phase 15 Task 3.
//
// A cell's disk is ephemeral by design: the platform migrates an instance
// whenever it likes, and that is the NORMAL path, not recovery. Since Cloud
// Phase 16 the checkout at MAUDE_REPO_DIR holds the tenant's history, so
// "ephemeral" would otherwise mean "the history lasts until the next
// migration" — which is worse than having no history, because it looks like
// having one.
//
// A GIT BUNDLE, NOT A TARBALL. `git bundle --all` is a single file that
// contains every ref and every object, verifiable before use (`git bundle
// verify`), and restorable with a plain `git clone`. A tarball of `.git`
// would carry the same bytes plus index/lock state that is meaningless on
// another machine, and nothing that can check it is intact.
//
// ONE GENERATION, BOTH ARTIFACTS. The bundle is written into the SAME backup
// generation as the SQLite snapshots. Restoring documents from 03:00 with a
// checkout from 02:00 would give a workspace whose documents reference
// canvases the checkout does not have — the kind of corruption that looks like
// a bug in the app for weeks. Consistency between the two is the whole reason
// this lives inside the backup generation instead of on its own schedule.
//
// Assets are NOT here. They are content-addressed and already in the bucket
// (asset-lane.mjs) — an immutable object keyed by its own hash needs no
// generation, and copying 300 MB of media into every snapshot would make the
// snapshot too expensive to take often.

import { existsSync } from 'node:fs';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/** The artifact's name inside a generation. */
export const REPO_BUNDLE = 'repo.bundle';

/**
 * True when the repo has at least one commit.
 *
 * `git bundle create --all` FAILS on a repo with no refs, and it fails in a
 * way that reads like a real error. A freshly provisioned cell legitimately
 * has nothing to preserve yet, so this distinguishes "nothing to do" from
 * "something went wrong".
 */
export async function hasCommits(repoDir, run) {
  if (!existsSync(join(repoDir, '.git'))) return false;
  const r = await run(['rev-list', '-n', '1', '--all'], { cwd: repoDir });
  return r.code === 0 && r.stdout.trim().length > 0;
}

/**
 * Produce a bundle of the whole checkout.
 *
 * @returns {Promise<{ state: 'ok', bytes: Buffer } | { state: 'empty'|'failed', reason?: string }>}
 */
export async function bundleRepo(repoDir, run, { tmpDir = '/tmp' } = {}) {
  if (!(await hasCommits(repoDir, run))) {
    return { state: 'empty', reason: 'the checkout has no commits yet' };
  }
  const scratch = join(tmpDir, `maude-repo-${process.pid}-${Date.now()}.bundle`);
  try {
    const made = await run(['bundle', 'create', scratch, '--all'], { cwd: repoDir });
    if (made.code !== 0) {
      return { state: 'failed', reason: `git bundle create: ${made.stderr.trim().slice(0, 300)}` };
    }
    return { state: 'ok', bytes: await readFile(scratch) };
  } catch (err) {
    return { state: 'failed', reason: err.message };
  } finally {
    await rm(scratch, { force: true });
  }
}

/**
 * Restore a checkout from bundle bytes.
 *
 * VERIFIED BEFORE USE. `git bundle verify` is cheap and it is the difference
 * between "the restore produced a working tree" and "the restore produced a
 * working tree containing what we backed up". A truncated upload clones into
 * something that looks fine and is missing objects.
 *
 * Refuses to restore over an existing checkout: a cell that rehydrates on top
 * of live work would replace it with an older copy, silently.
 */
export async function restoreRepo(repoDir, bytes, run, { tmpDir = '/tmp', force = false } = {}) {
  if (existsSync(join(repoDir, '.git')) && !force) {
    return { state: 'skipped', reason: 'the checkout already exists — refusing to restore over it' };
  }
  const scratch = join(tmpDir, `maude-restore-${process.pid}-${Date.now()}.bundle`);
  try {
    await writeFile(scratch, bytes);

    // CLONE FIRST, VERIFY SECOND — and the order is forced, not stylistic.
    // `git bundle verify` needs to run *inside a repository*; there is no repo
    // yet, so verifying before cloning fails with "need a repository to verify
    // a bundle" on a perfectly good bundle. Cloning is itself the first
    // integrity gate (index-pack rejects a truncated file), and the explicit
    // verify afterwards is what catches a bundle that unpacks but is missing
    // prerequisites.
    const cloned = await run(['clone', '--', scratch, repoDir], { cwd: tmpDir });
    if (cloned.code !== 0) {
      const err = `${cloned.stderr}`.trim();
      // A truncated or malformed bundle fails here, and that IS the corruption
      // case — report it as such rather than as a generic clone failure.
      const corrupt = /bundle|index-pack|pack\b|unexpected end/i.test(err);
      return {
        state: 'failed',
        reason: corrupt
          ? `the bundle is not intact: ${err.slice(0, 300)}`
          : `git clone: ${err.slice(0, 300)}`,
      };
    }
    const verified = await run(['bundle', 'verify', scratch], { cwd: repoDir });
    if (verified.code !== 0) {
      return {
        state: 'failed',
        reason: `the bundle is not intact: ${verified.stderr.trim().slice(0, 300)}`,
      };
    }
    // A bundle clone leaves `origin` pointing at a temp file that is about to
    // vanish. Leaving it would make every later `git remote -v` — and any
    // mirror setup (Phase 19) — describe a path that does not exist.
    await run(['remote', 'remove', 'origin'], { cwd: repoDir });
    return { state: 'restored' };
  } catch (err) {
    return { state: 'failed', reason: err.message };
  } finally {
    await rm(scratch, { force: true });
  }
}
