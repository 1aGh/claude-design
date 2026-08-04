// Cloud Phase 27 D2 — one writer at a time on the workspace checkout.
//
// The lock is the thing standing between "two processes over one working tree"
// and the preserved dissent's 3 a.m. event, so the properties asserted here are
// the ones that make it a lock rather than a suggestion: mutual exclusion,
// release on throw, and a stale holder that unwedges itself without a human.

import { describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { REPO_LOCK_FILE, STALE_LOCK_MS, withRepoLock } from '../git/repo-lock.ts';

function makeRepo({ git = true } = {}): string {
  const root = mkdtempSync(join(tmpdir(), 'maude-repo-lock-'));
  if (git) mkdirSync(join(root, '.git'), { recursive: true });
  return root;
}

const lockFile = (root: string) => join(root, '.git', REPO_LOCK_FILE);
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

describe('repo lock', () => {
  test('two holders never overlap — the loser waits rather than failing', async () => {
    const root = makeRepo();
    try {
      const order: string[] = [];
      let concurrent = 0;
      let maxConcurrent = 0;

      const contend = (name: string) =>
        withRepoLock(root, name, async () => {
          concurrent += 1;
          maxConcurrent = Math.max(maxConcurrent, concurrent);
          order.push(`${name}:in`);
          await sleep(30);
          order.push(`${name}:out`);
          concurrent -= 1;
        });

      await Promise.all([contend('hub:autocommit'), contend('studio:checkout')]);

      // The point of the lock, stated twice: never two inside, and never an
      // interleaved in/in/out/out — the second entry follows the first exit.
      expect(maxConcurrent).toBe(1);
      expect(order[1]).toBe(order[0].replace(':in', ':out'));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('the lock is released when the operation throws', async () => {
    const root = makeRepo();
    try {
      await expect(
        withRepoLock(root, 'studio:commit', async () => {
          throw new Error('git exploded');
        })
      ).rejects.toThrow('git exploded');

      // Not merely "the file is gone" — the next caller gets in, which is the
      // property that matters. A lock leaked by a failed commit would stop
      // every autosave after it.
      let ran = false;
      await withRepoLock(root, 'hub:autocommit', async () => {
        ran = true;
      });
      expect(ran).toBe(true);
      expect(() => readFileSync(lockFile(root))).toThrow();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('a repo with no .git runs unlocked instead of creating one', async () => {
    const root = makeRepo({ git: false });
    try {
      let ran = false;
      await withRepoLock(root, 'hub:seed', async () => {
        ran = true;
      });
      expect(ran).toBe(true);
      // It must not have become a repo initializer on the way past.
      expect(() => readFileSync(join(root, '.git', REPO_LOCK_FILE))).toThrow();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('a stale lock is stolen — a cell that crashed mid-commit unwedges itself', async () => {
    const root = makeRepo();
    try {
      // A holder that still EXISTS as a process (this one) so the steal can only
      // be attributed to the age, not to the liveness check.
      writeFileSync(
        lockFile(root),
        JSON.stringify({ pid: process.pid, holder: 'hub:autocommit', at: 0, token: 'old' })
      );

      let ran = false;
      const warned: string[] = [];
      await withRepoLock(
        root,
        'studio:commit',
        async () => {
          ran = true;
        },
        {
          waitMs: 1000,
          // Age it past the window without waiting for it.
          now: () => Date.now() + STALE_LOCK_MS + 5_000,
          log: { warn: (m: string) => warned.push(m), log() {} },
        }
      );
      expect(ran).toBe(true);
      expect(warned.join(' ')).toContain('hub:autocommit');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('a lock whose process is gone is stolen without waiting out the window', async () => {
    const root = makeRepo();
    try {
      // pid 1 is tini in a cell and always alive, so a pid that cannot exist is
      // the honest fixture: 2^22 is above every default pid_max.
      writeFileSync(
        lockFile(root),
        JSON.stringify({ pid: 4194304, holder: 'studio:checkout', at: Date.now(), token: 'dead' })
      );

      let ran = false;
      await withRepoLock(
        root,
        'hub:autocommit',
        async () => {
          ran = true;
        },
        { waitMs: 500, log: { warn() {}, log() {} } }
      );
      expect(ran).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('giving up names the holder rather than hanging', async () => {
    const root = makeRepo();
    try {
      writeFileSync(
        lockFile(root),
        JSON.stringify({ pid: process.pid, holder: 'studio:fold', at: Date.now(), token: 'live' })
      );
      await expect(
        withRepoLock(root, 'hub:autocommit', async () => undefined, { waitMs: 120 })
      ).rejects.toThrow(/studio:fold/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('releasing never unlinks a lock that was stolen from us', async () => {
    // The one way a lock can be worse than no lock: a slow holder finishes,
    // unlinks, and pulls the lock out from under whoever legitimately took it
    // after the steal.
    const root = makeRepo();
    try {
      const finished = withRepoLock(root, 'hub:autocommit', async () => {
        // Simulate the steal: somebody reaped us and took it.
        writeFileSync(
          lockFile(root),
          JSON.stringify({
            pid: process.pid,
            holder: 'studio:checkout',
            at: Date.now(),
            token: 'theirs',
          })
        );
      });
      await finished;
      const after = JSON.parse(readFileSync(lockFile(root), 'utf8'));
      expect(after.holder).toBe('studio:checkout');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
