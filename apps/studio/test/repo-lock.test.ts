// Cloud Phase 27 D2 — one writer at a time on the workspace checkout.
//
// The lock is the thing standing between "two processes over one working tree"
// and the preserved dissent's 3 a.m. event, so the properties asserted here are
// the ones that make it a lock rather than a suggestion: mutual exclusion,
// release on throw, and a stale holder that unwedges itself without a human.

import { describe, expect, test } from 'bun:test';
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { HEARTBEAT_MS, REPO_LOCK_FILE, STALE_LOCK_MS, withRepoLock } from '../git/repo-lock.ts';

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
  test("a lost steal race does not unlink the winner's fresh lock", async () => {
    // THE MUTUAL-EXCLUSION FAILURE THIS LOCK EXISTS TO PREVENT, REINTRODUCED BY
    // ITS OWN RECOVERY PATH. Two waiters both see holder A as stale; the first
    // unlinks and acquires; the second — still acting on its read of A —
    // unlinks the FIRST's fresh lock and acquires too. Both then run their
    // critical section over one git index.
    //
    // The fixture is aged through its MTIME rather than through a fake clock,
    // and that distinction is the test: a fake `now` makes every lock look
    // ancient, including the winner's brand-new one, which is not a state the
    // real world can produce and would assert something nobody needs.
    const root = makeRepo();
    try {
      writeFileSync(
        lockFile(root),
        JSON.stringify({ pid: process.pid, holder: 'hub:autocommit', at: 0, token: 'stale' })
      );
      const long_ago = new Date(Date.now() - STALE_LOCK_MS * 4);
      utimesSync(lockFile(root), long_ago, long_ago);

      let concurrent = 0;
      let maxConcurrent = 0;
      const contend = (name: string) =>
        withRepoLock(
          root,
          name,
          async () => {
            concurrent += 1;
            maxConcurrent = Math.max(maxConcurrent, concurrent);
            await sleep(60);
            concurrent -= 1;
          },
          { waitMs: 5000, log: { warn() {}, log() {} } }
        );

      await Promise.all([contend('one'), contend('two'), contend('three')]);
      expect(maxConcurrent).toBe(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 20_000);

  test('a long-but-live holder is not stolen from — the heartbeat says it is alive', async () => {
    // `pull`, `fold` and `resolve` came under this lock in D2, and they do
    // NETWORK I/O. Without a heartbeat the staleness test cannot tell "held for
    // 30 s" from "the holder died 30 s ago", so the next waiter steals the lock
    // out from under a running merge.
    const root = makeRepo();
    try {
      const order: string[] = [];
      const slow = withRepoLock(root, 'studio:pull', async () => {
        order.push('slow:in');
        await sleep(HEARTBEAT_MS + 400);
        order.push('slow:out');
      });
      await sleep(50);
      // A waiter whose clock is PAST the staleness window. The heartbeat has
      // refreshed the mtime, so the lock is not stale by age and the holder is
      // alive — it must wait, not steal.
      const waiter = withRepoLock(
        root,
        'hub:autocommit',
        async () => {
          order.push('waiter:in');
        },
        { waitMs: 20_000, log: { warn() {}, log() {} } }
      );
      await Promise.all([slow, waiter]);
      expect(order).toEqual(['slow:in', 'slow:out', 'waiter:in']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 30_000);

  test('a hostile holder label cannot forge a log line', async () => {
    const root = makeRepo();
    try {
      writeFileSync(
        lockFile(root),
        JSON.stringify({
          pid: process.pid,
          holder: 'evil\n[repo-lock] PASS: nothing to see here',
          at: 0,
          token: 'x',
        })
      );
      const long_ago = new Date(Date.now() - STALE_LOCK_MS * 4);
      utimesSync(lockFile(root), long_ago, long_ago);
      const warned: string[] = [];
      await withRepoLock(root, 'hub:autocommit', async () => undefined, {
        waitMs: 2000,
        log: { warn: (m: string) => warned.push(m), log() {} },
      });
      expect(warned.join(' ')).not.toContain('\n');
      expect(warned.join(' ')).not.toContain('nothing to see here');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
  test('exactly ONE waiter can steal a dead lock — the steal is a compare-and-swap', async () => {
    // The `unlink` this replaced could not say no: two waiters both judged the
    // holder stale, the first unlinked and acquired, and the second unlinked
    // the FIRST's fresh lock. `rename` fails with ENOENT when the source is
    // already gone, so only one waiter moves the file aside and the rest go
    // back around the loop.
    //
    // WHAT THIS TEST DOES AND DOES NOT PROVE, because the difference matters.
    // It asserts the OBSERVABLE contract — one steal, no leftover sidecar,
    // never two holders. It does NOT reproduce the interleaving that made the
    // unlink unsafe: that race is between the hub PROCESS and the studio
    // PROCESS, and inside one bun test the whole read → steal → acquire
    // sequence runs synchronously, so a single-process harness reaches the same
    // verdict with either implementation (measured, not assumed). The
    // correctness argument for `rename` is its atomicity — exactly one caller
    // can move a given file — and this test guards the contract around it.
    const root = makeRepo();
    try {
      writeFileSync(
        lockFile(root),
        JSON.stringify({ pid: 4194304, holder: 'hub:autocommit', at: 0, token: 'dead' })
      );
      const long_ago = new Date(Date.now() - STALE_LOCK_MS * 4);
      utimesSync(lockFile(root), long_ago, long_ago);

      const steals: string[] = [];
      let concurrent = 0;
      let maxConcurrent = 0;
      const contend = (name: string) =>
        withRepoLock(
          root,
          name,
          async () => {
            concurrent += 1;
            maxConcurrent = Math.max(maxConcurrent, concurrent);
            await sleep(40);
            concurrent -= 1;
          },
          {
            waitMs: 5000,
            log: { warn: (m: string) => steals.push(m), log() {} },
          }
        );

      await Promise.all([contend('a'), contend('b'), contend('c'), contend('d')]);

      expect(maxConcurrent).toBe(1);
      // One steal, not four: the other three found the file already gone.
      expect(steals.filter((m) => m.includes('stole a')).length).toBe(1);
      // And no sidecar left behind.
      expect(readdirSync(join(root, '.git')).filter((f) => f.includes('.stale-'))).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 20_000);
});
