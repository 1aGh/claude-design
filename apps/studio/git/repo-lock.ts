// One writer at a time on the workspace checkout — Cloud Phase 27 D2.
//
// THE PROBLEM THIS EXISTS FOR. A cell is two processes over one working tree.
// The hub commits autosaves, bundles backups and (at boot) clones the checkout;
// the studio writes canvas source and runs the browser's own git verbs —
// commit, discard, branch, checkout, fold, pull. Neither could see the other,
// and the phase's preserved dissent says exactly what that costs: "the 3 a.m.
// event is not a 500 — it is a tenant's canvas lost to a half-staged commit or
// a checkout under a live writer, in a cell whose /health still says 200."
//
// WHY GIT'S OWN LOCK WAS NOT ENOUGH, AND WHAT HAD TO CHANGE FIRST. `index.lock`
// only serializes processes that take it, and the studio did not: it runs
// isomorphic-git for the write paths, which keeps an in-PROCESS async lock and
// writes `.git/index` directly. Two engines, one index, no shared lock — so the
// first half of D2 is `MAUDE_USE_SYSTEM_GIT=1` in a cell (studio-child.mjs), and
// this file is the second half.
//
// WHY A SECOND LOCK ON TOP OF `index.lock`. Two reasons, and both matter:
//
//   1. `index.lock` FAILS rather than waits. Two commits racing gives one of
//      them "Unable to create '.git/index.lock': File exists" — loud, but a
//      failed autosave commit is a history that quietly stops. Here the loser
//      WAITS, which is what an autosave wants.
//   2. `index.lock` is held per git INVOCATION, and the dangerous unit is a
//      SEQUENCE: `add` then `commit` is two invocations, and a `checkout`
//      landing between them is precisely the half-staged commit. A lock the
//      caller holds across the whole sequence is the only thing that closes it.
//
// WHAT IT DELIBERATELY DOES NOT COVER. Ordinary file writes are not locked.
// They are atomic per file (tmp + rename everywhere in this codebase), so a
// `git add` racing a canvas write stages the old bytes or the new ones, never
// half of either, and the next quiescence commits the rest. Locking every
// keystroke-debounced write against a 3-second commit cycle would buy nothing
// and cost the editor its latency. What is locked is the operations that
// REWRITE the tree or the index — those are the ones that lose work.
//
// The hub's tree-rewriting operations (`seedRepo`, `restoreRepo`, rehydrate)
// are all cold-start, before the studio is serving — verified, not assumed:
// `restoreLatest` is called only from `rehydrate.mjs`, which the cell entrypoint
// runs as its own process before the hub starts, and `seedRepo` runs once in
// `startWorkspaceAgent` against an empty directory. That is why this is a lock
// and not a lock plus a quiesce RPC: there is no live hub operation for the
// studio to be quiesced FOR. If one is ever added, it needs the RPC too, and
// this comment is where to notice that.

import {
  closeSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  utimesSync,
  writeSync,
} from 'node:fs';
import path from 'node:path';

/** Where the lock lives. Inside `.git/` because it is git state, and beside
 *  `index.lock` because that is where anyone debugging a stuck repo looks. It
 *  is NOT named `index.lock` — faking git's own lock would make git itself
 *  refuse to run, which is a cure considerably worse than the disease. */
export const REPO_LOCK_FILE = 'maude-repo.lock';

/** Past this, a holder is assumed dead. Deliberately shorter than the 60 s
 *  `/health` staleness window: that one answers "should a human worry", this one
 *  answers "may I proceed", and waiting a minute to autosave is its own failure.
 *  Every operation under this lock is seconds at most; a clone is not (it runs
 *  before anything else exists to contend with it). */
export const STALE_LOCK_MS = 30_000;

/** How long a caller waits before giving up. Long enough to outlast any commit
 *  or checkout, short enough that a wedged holder surfaces as an error rather
 *  than a hang. */
export const DEFAULT_WAIT_MS = 15_000;

/** How often a holder refreshes its lock's mtime. Comfortably inside
 *  STALE_LOCK_MS, so a live holder is never mistaken for a dead one. */
export const HEARTBEAT_MS = 5_000;

export interface RepoLockOptions {
  /** Milliseconds to wait for the lock before throwing. */
  waitMs?: number;
  /** Test seam. */
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  log?: Pick<Console, 'warn' | 'log'>;
}

export interface LockHolder {
  pid: number;
  /** Who and what — `hub:autocommit`, `studio:checkout`. Read by a human. */
  holder: string;
  at: number;
  /** Distinguishes OUR lock from one a stale-steal handed to somebody else. */
  token: string;
}

function lockPathFor(repoRoot: string): string {
  return path.join(repoRoot, '.git', REPO_LOCK_FILE);
}

function readHolder(file: string): LockHolder | null {
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8'));
    return typeof parsed?.pid === 'number' ? (parsed as LockHolder) : null;
  } catch {
    // Unreadable or half-written: treat as an unknown holder rather than as
    // absent. Staleness still reaps it; guessing "nobody" would not.
    return null;
  }
}

/**
 * Is the process that wrote this lock still alive?
 *
 * Both contenders live in the same container (and on a desktop, the same
 * machine), so signal 0 is a real answer rather than a guess. An unknown pid is
 * treated as ALIVE — an unreadable lock file must not become a licence to
 * steal; that is what the staleness window is for.
 */
function holderAlive(holder: LockHolder | null): boolean {
  if (!holder) return true;
  try {
    process.kill(holder.pid, 0);
    return true;
  } catch (err) {
    // EPERM means it exists and belongs to another user — alive.
    return (err as NodeJS.ErrnoException)?.code === 'EPERM';
  }
}

/**
 * Take the lock, run `fn`, release it — even when `fn` throws.
 *
 * A repo with no `.git` yet runs UNLOCKED, on purpose: there is nothing to
 * serialize before the checkout exists, and the only code that runs then is the
 * boot-time seed, single-process by construction. Creating `.git` here to hold
 * a lock would make this function a repo initializer, which is the last thing
 * it should be.
 */
export async function withRepoLock<T>(
  repoRoot: string,
  holder: string,
  fn: () => Promise<T>,
  opts: RepoLockOptions = {}
): Promise<T> {
  const {
    waitMs = DEFAULT_WAIT_MS,
    now = () => Date.now(),
    sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms)),
    log = console,
  } = opts;

  const gitDir = path.join(repoRoot, '.git');
  try {
    if (!statSync(gitDir).isDirectory()) return await fn();
  } catch {
    return await fn(); // no repo yet — see above
  }

  const file = lockPathFor(repoRoot);
  const token = `${process.pid}-${now()}-${Math.random().toString(36).slice(2, 10)}`;
  const deadline = now() + waitMs;
  let delay = 20;

  for (;;) {
    if (tryAcquire(file, holder, token, now)) break;

    const current = readHolder(file);
    const age = ageOf(file, now);
    // Steal only from a holder that is demonstrably gone, or one that has held
    // it past every plausible operation. A cell that crashed mid-commit must
    // not need a human to unwedge it.
    if (age !== null && (age > STALE_LOCK_MS || !holderAlive(current))) {
      // STEAL BY RENAME, NOT BY UNLINK — the steal has to be a
      // compare-and-swap or it is a second way to lose mutual exclusion.
      //
      // An unconditional `unlink` here loses it outright: two waiters both see
      // A as stale, the first unlinks and acquires, and the second — still
      // acting on its read of A — unlinks the FIRST's fresh lock and acquires
      // too. Both then run their critical section over one git index, which is
      // precisely the half-staged commit this lock exists to prevent,
      // reintroduced by its own recovery path.
      //
      // `rename` is the fix because it FAILS when the source is already gone:
      // exactly one waiter can move the stale file aside, and every other gets
      // ENOENT and goes back around the loop. Comparing the holder's token
      // before an unlink was tried first and rejected — it narrows the window
      // rather than closing it, and no honest test could tell it apart from the
      // unfixed version, which is how the weakness came to light.
      const sidecar = `${file}.stale-${token}`;
      try {
        renameSync(file, sidecar);
      } catch {
        continue; // another waiter won the steal; re-read and try again
      }
      log.warn?.(
        `[repo-lock] stole a ${Math.round(age / 1000)}s lock from ${safeLabel(current?.holder)}` +
          `${holderAlive(current) ? '' : ' (process gone)'}`
      );
      try {
        unlinkSync(sidecar);
      } catch {
        /* already gone — the lock path is free either way */
      }
      continue;
    }

    if (now() >= deadline) {
      throw new Error(
        `repo lock held by ${current?.holder ?? 'an unreadable holder'} (pid ${current?.pid ?? '?'}) ` +
          `for ${age === null ? '?' : Math.round(age / 1000)}s — ${holder} gave up after ${Math.round(waitMs / 1000)}s`
      );
    }
    await sleep(delay);
    delay = Math.min(delay * 2, 250);
  }

  // KEEP THE LOCK LOOKING ALIVE WHILE IT IS.
  //
  // The staleness test is the file's mtime, stamped once at acquisition, so
  // "held for 30 s" and "the holder died 30 s ago" were the same observation.
  // That was defensible when everything under this lock was a local `commit`;
  // D2 put `pull`, `fold` and `resolve` under it too, and those do NETWORK I/O
  // on a container's cold connection. Without this, the next waiter steals the
  // lock out from under a running merge.
  const beat = setInterval(() => {
    try {
      const held = readHolder(file);
      if (held?.token !== token) return; // not ours any more — nothing to refresh
      const stamp = new Date();
      utimesSync(file, stamp, stamp);
    } catch {
      /* the file is gone or unreadable; the release below is still correct */
    }
  }, HEARTBEAT_MS);
  beat.unref?.();

  try {
    return await fn();
  } finally {
    clearInterval(beat);
    release(file, token);
  }
}

/** Bound a holder label before it reaches a log line. `readHolder` parses
 *  attacker-plantable JSON, and an unescaped newline in a log is a forged log
 *  entry. */
function safeLabel(holder: string | undefined): string {
  if (!holder) return 'an unreadable holder';
  const clean = holder.replace(/[^\w:.-]/g, '').slice(0, 64);
  return clean || 'an unreadable holder';
}

/** `wx` is the whole mechanism: create-or-fail is atomic on every filesystem
 *  this runs on, which is what makes this a lock rather than a suggestion. */
function tryAcquire(file: string, holder: string, token: string, now: () => number): boolean {
  let fd: number | null = null;
  try {
    mkdirSync(path.dirname(file), { recursive: true });
    fd = openSync(file, 'wx');
    writeSync(
      fd,
      JSON.stringify({ pid: process.pid, holder, at: now(), token } satisfies LockHolder)
    );
    return true;
  } catch {
    return false;
  } finally {
    if (fd !== null) {
      try {
        closeSync(fd);
      } catch {
        /* nothing useful to do */
      }
    }
  }
}

function ageOf(file: string, now: () => number): number | null {
  try {
    return Math.max(0, now() - statSync(file).mtimeMs);
  } catch {
    return null; // vanished between attempts — not stale, just gone
  }
}

/**
 * Release, but only OUR lock.
 *
 * If a stale-steal already handed it to somebody else, unlinking here would
 * pull the lock out from under a live holder — the one way a lock can be worse
 * than no lock at all.
 */
function release(file: string, token: string): void {
  const current = readHolder(file);
  if (current && current.token !== token) return;
  try {
    unlinkSync(file);
  } catch {
    /* already gone */
  }
}
