// media-commit-chain — the Phase-23 batch-drop no-loss guarantee, isolated
// from React/DOM/real image decode timing so the race is testable
// deterministically (no real timers — every "completion" is a microtask-tick
// count, so the interleaving is exact and reproducible on every run).

import { describe, expect, test } from 'bun:test';

import { createMediaCommitChain } from '../media-commit-chain.ts';

interface Item {
  id: string;
}

const keyOf = (it: Item) => it.id;

/** Resolve after exactly `n` microtask ticks (0 = next tick). */
function afterTicks(n: number): Promise<void> {
  let p: Promise<void> = Promise.resolve();
  for (let i = 0; i < n; i++) p = p.then(() => undefined);
  return p;
}

describe('media-commit-chain / no-loss under concurrent completions', () => {
  test('a synchronous burst of N enqueues (worst case — zero timing gap) keeps all N', async () => {
    let snapshot: Item[] = [];
    const chain = createMediaCommitChain<Item>(() => snapshot, keyOf);
    const committed: Item[][] = [];
    const onCommit = (_before: readonly Item[], after: readonly Item[]) => {
      committed.push(after as Item[]);
      snapshot = after as Item[];
    };

    // All 8 fire back-to-back in the same synchronous tick — the exact shape
    // of use-canvas-media-drop's batch-dispatch loop calling onImage/onMedia
    // once per file, each kicking off its own independent async chain that
    // (in the old, buggy code) raced on a shared strokesRef.current read.
    const promises = Array.from({ length: 8 }, (_, i) =>
      chain.enqueue(
        (before) => ({ after: [...before, { id: `item-${i}` }], label: `add ${i}` }),
        onCommit
      )
    );
    await Promise.all(promises);

    const final = committed[committed.length - 1];
    expect(final.length).toBe(8);
    expect(new Set(final.map((it) => it.id)).size).toBe(8);
    for (let i = 0; i < 8; i++) {
      expect(final.some((it) => it.id === `item-${i}`)).toBe(true);
    }
  });

  test('staggered/shuffled resolution order still accumulates every item exactly once', async () => {
    let snapshot: Item[] = [];
    const chain = createMediaCommitChain<Item>(() => snapshot, keyOf);
    const committed: Item[][] = [];
    const onCommit = (_before: readonly Item[], after: readonly Item[]) => {
      committed.push(after as Item[]);
      snapshot = after as Item[];
    };

    // A fixed (non-random, so non-flaky) permutation of tick-depths — some
    // items resolve in the same tick as others, some land in between,
    // deliberately out of index order (index 4 resolves before index 0).
    const tickCounts = [4, 0, 6, 2, 7, 1, 5, 3];
    const promises = tickCounts.map((ticks, i) =>
      afterTicks(ticks).then(() =>
        chain.enqueue(
          (before) => ({ after: [...before, { id: `item-${i}` }], label: `add ${i}` }),
          onCommit
        )
      )
    );
    await Promise.all(promises);

    const final = committed[committed.length - 1];
    expect(final.length).toBe(8);
    expect(new Set(final.map((it) => it.id)).size).toBe(8);
  });

  test('skip (mutate returns null) leaves the accumulator untouched', async () => {
    let snapshot: Item[] = [];
    const chain = createMediaCommitChain<Item>(() => snapshot, keyOf);
    const committed: Item[][] = [];
    const onCommit = (_before: readonly Item[], after: readonly Item[]) => {
      committed.push(after as Item[]);
      snapshot = after as Item[];
    };

    await chain.enqueue((before) => ({ after: [...before, { id: 'a' }] }), onCommit);
    const skipped = await chain.enqueue(() => null, onCommit);
    expect(skipped.map((it) => it.id)).toEqual(['a']);
    expect(committed.length).toBe(1); // the skipped mutation never called onCommit
  });

  test('a lagging snapshot (render has not caught up yet) does not lose the prior commit', async () => {
    // This is the regression caught live against a real dev server (Task 5):
    // getSnapshot() (strokesRef.current in production) only catches up on
    // React's NEXT render, which can take longer than the handful of
    // microtask ticks this chain itself needs to settle a link and go idle.
    // `rendered` here deliberately never updates on its own — it models a
    // render that hasn't happened yet by the time the second file's upload
    // resolves and enqueues.
    const rendered: Item[] = [];
    const chain = createMediaCommitChain<Item>(() => rendered, keyOf);
    const commits: Array<{ after: readonly Item[] }> = [];
    const onCommit = (_before: readonly Item[], after: readonly Item[]) => {
      commits.push({ after });
    };

    await chain.enqueue((before) => ({ after: [...before, { id: 'video' }] }), onCommit);
    // The chain is idle now (its one link has settled) — `rendered` is still
    // [] (no render happened). The next enqueue must reconcile against what
    // THIS chain last produced, not trust the stale empty snapshot.
    const after = await chain.enqueue(
      (before) => ({ after: [...before, { id: 'audio' }] }),
      onCommit
    );

    expect(after.map((it) => it.id).sort()).toEqual(['audio', 'video']);
  });

  test('external edits made while idle (snapshot ahead of remembered) are preserved', async () => {
    let snapshot: Item[] = [{ id: 'external' }];
    const chain = createMediaCommitChain<Item>(() => snapshot, keyOf);
    const commits: Array<{ before: readonly Item[]; after: readonly Item[] }> = [];
    const onCommit = (before: readonly Item[], after: readonly Item[]) => {
      commits.push({ before, after });
    };

    await chain.enqueue((before) => ({ after: [...before, { id: 'a' }] }), onCommit);
    // Simulate a synchronous, non-chained edit that landed while idle (e.g. a
    // pen stroke committed directly, its render already caught up) — the
    // next chain link must see it via the fresh snapshot.
    snapshot = [...snapshot, { id: 'a' }, { id: 'pen-stroke' }];
    await chain.enqueue((before) => ({ after: [...before, { id: 'b' }] }), onCommit);

    const last = commits[commits.length - 1];
    expect(last.after.some((it) => it.id === 'pen-stroke')).toBe(true);
    expect(last.after.some((it) => it.id === 'b')).toBe(true);
  });

  test('a snapshot with a STALE VALUE for a chain-owned id (not just a missing one) does not revert it', async () => {
    // The real bug this closes: `fresh` (getSnapshot) can contain the SAME
    // id the chain just committed, but with a stale value — e.g. an image
    // stroke's optimistic (blob:) href is set via a separate, non-chain
    // setState, and `fresh` catches up to THAT before it catches up to the
    // chain's own later commit swapping it to the real href. Checking only
    // "is the id present" (the previous implementation) treated this as
    // "already rendered, trust fresh" and used the stale copy — silently
    // reverting the swap, which then gets filtered out entirely as
    // still-ephemeral at the persistence layer one level up. Confirmed live
    // against a real dev server: a single 3-file drop lost exactly one file
    // most of the time, always the one whose swap commit landed while
    // `fresh` still only reflected its pre-swap optimistic value.
    const snapshot: Item[] = [{ id: 'img-optimistic', href: 'blob:x' } as unknown as Item];
    const chain = createMediaCommitChain<Item>(() => snapshot, keyOf);
    const commits: Array<{ after: readonly Item[] }> = [];
    const onCommit = (_before: readonly Item[], after: readonly Item[]) => {
      commits.push({ after });
    };

    // The chain's own commit swaps the id to its real value...
    await chain.enqueue(
      (before) => ({
        after: before.map((it) =>
          it.id === 'img-optimistic' ? { ...it, href: 'assets/real.png' } : it
        ),
      }),
      onCommit
    );
    // ...but `snapshot` (fresh) hasn't re-rendered to reflect that swap yet
    // — it still shows the SAME id with the stale, optimistic href. This
    // models the render lag, not a delete/re-add.

    const after = await chain.enqueue(
      (before) => ({ after: [...before, { id: 'sibling' }] }),
      onCommit
    );

    const img = after.find((it) => it.id === 'img-optimistic') as unknown as { href: string };
    expect(img?.href).toBe('assets/real.png');
    expect(after.some((it) => it.id === 'sibling')).toBe(true);
  });

  test('commitBefore overrides the before passed to onCommit without affecting the accumulator', async () => {
    const snapshot: Item[] = [{ id: 'optimistic' }];
    const chain = createMediaCommitChain<Item>(() => snapshot, keyOf);
    const commits: Array<{ before: readonly Item[]; after: readonly Item[] }> = [];
    const onCommit = (before: readonly Item[], after: readonly Item[]) => {
      commits.push({ before, after });
    };

    // Mirrors createImageFromFile's swap: "before" (accumulator) still
    // contains the ephemeral optimistic entry, but the undo record's
    // `before` should exclude it (undo removes the image outright instead
    // of restoring a revoked blob: URL).
    const after = await chain.enqueue(
      (before) => ({
        after: before.map((it) => (it.id === 'optimistic' ? { id: 'real' } : it)),
        commitBefore: before.filter((it) => it.id !== 'optimistic'),
      }),
      onCommit
    );

    expect(after).toEqual([{ id: 'real' }]);
    expect(commits[0].before).toEqual([]);
    expect(commits[0].after).toEqual([{ id: 'real' }]);
  });
});
