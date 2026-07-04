// file-lock.test.ts — DDR-150 P2. The cross-process advisory lock that closes
// the race the in-process mutex couldn't see: the HTTP server, the /design:edit
// CLI, and the HMR watcher all editing the same comp file. Verifies mutual
// exclusion across "processes" (concurrent acquirers), stale-lock stealing (a
// crashed holder), and that an edit through the integrated withLock cleans up.

import { describe, expect, test } from 'bun:test';
import { utimes } from 'node:fs/promises';

import { acquireFileLock, editAttribute, lockPathFor } from '../canvas-edit.ts';
import { transpileCanvasSource } from '../canvas-pipeline.ts';

const tmp = (tag: string) => `/tmp/maude-lock-${tag}-${Math.random().toString(36).slice(2)}.tsx`;

describe('acquireFileLock', () => {
  test('acquires + releases; release is idempotent', async () => {
    const f = tmp('basic');
    const rel = await acquireFileLock(f);
    expect(await Bun.file(lockPathFor(f)).exists()).toBe(true);
    await rel();
    expect(await Bun.file(lockPathFor(f)).exists()).toBe(false);
    await rel(); // second release is a no-op, never throws
  });

  test('serialises a second (cross-process) contender until the first releases', async () => {
    const f = tmp('contend');
    const relA = await acquireFileLock(f);
    let bAcquired = false;
    const bPromise = acquireFileLock(f).then((rel) => {
      bAcquired = true;
      return rel;
    });
    // While A holds the lock, B must be blocked (it's polling the lockfile).
    await new Promise((r) => setTimeout(r, 80));
    expect(bAcquired).toBe(false);
    await relA();
    const relB = await bPromise; // B now wins the lock
    expect(bAcquired).toBe(true);
    await relB();
    expect(await Bun.file(lockPathFor(f)).exists()).toBe(false);
  });

  test('steals a STALE lock (holder crashed) instead of waiting forever', async () => {
    const f = tmp('stale');
    const lp = lockPathFor(f);
    await Bun.write(lp, '99999 0'); // a "held" lock from a dead pid
    const old = new Date(Date.now() - 60_000); // mtime 60s ago (> LOCK_STALE_MS)
    await utimes(lp, old, old);
    const start = Date.now();
    const rel = await acquireFileLock(f); // must steal it, not block
    expect(Date.now() - start).toBeLessThan(2000);
    await rel();
  });
});

describe('withLock integration', () => {
  test('an edit acquires + cleans up the cross-process lock', async () => {
    const f = tmp('edit');
    const src = 'function Demo() { return <div className="x">y</div>; }';
    await Bun.write(f, src);
    const { withIds } = transpileCanvasSource(f, src);
    const id = withIds.match(/data-cd-id="([0-9a-f]{8})"/)?.[1] as string;
    const r = await editAttribute(f, id, 'className', 'edited');
    expect(r.changed).toBe(true);
    expect(await Bun.file(f).text()).toContain('className="edited"');
    // The lockfile must be released after the edit — not left dangling.
    expect(await Bun.file(lockPathFor(f)).exists()).toBe(false);
  });

  test('concurrent edits to the same file both land (serialised, no lost write)', async () => {
    const f = tmp('concurrent');
    const src = 'function Demo() { return <div className="x" title="t">y</div>; }';
    await Bun.write(f, src);
    const { withIds } = transpileCanvasSource(f, src);
    const id = withIds.match(/data-cd-id="([0-9a-f]{8})"/)?.[1] as string;
    await Promise.all([
      editAttribute(f, id, 'className', 'cls-A'),
      editAttribute(f, id, 'title', 'title-B'),
    ]);
    const out = await Bun.file(f).text();
    expect(out).toContain('cls-A');
    expect(out).toContain('title-B'); // neither edit clobbered the other
  });
});
