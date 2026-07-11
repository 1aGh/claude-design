/**
 * @file       media-commit-chain.ts — serialized accumulator chain for
 *             concurrent async media-intake commits.
 * @scope      apps/studio/media-commit-chain.ts
 * @purpose    Fixes the Phase-23 batch-drop data-loss bug: a Finder drop of
 *             N files fires N independent async completions (image decode /
 *             asset upload), each of which used to read a `strokesRef.current`
 *             mirror and call `commitStrokes(before, after)` on its own.
 *             `strokesRef` only catches up on the NEXT render, so two
 *             completions landing before a render commit both compute
 *             `before` from the same stale snapshot — the second commit's
 *             `setStrokesState` overwrites the first's, silently dropping it.
 *
 *             This chain fixes it by threading the PREVIOUS link's resulting
 *             array forward as the next link's `before` while links are
 *             in flight (Promise-chained, mirroring `editApplyChainRef` /
 *             `structuralWrite` in client/app.jsx). The subtle part is what
 *             happens once the queue drains: a naive "go idle, trust a fresh
 *             `getSnapshot()` again" reset raced in practice — `getSnapshot()`
 *             (`strokesRef.current`) only catches up on React's NEXT render,
 *             which can take longer than the handful of microtask ticks this
 *             chain itself needs to settle a link, so a fast-idling chain
 *             could hand the next link a `getSnapshot()` that hasn't caught
 *             up yet — reproducing the same loss one level down (confirmed
 *             empirically against a real dev server: see the Task 5 write-up).
 *             Instead, every idle read is RECONCILED against `remembered` (the
 *             last array this chain itself produced): anything in
 *             `remembered` whose key is missing from the fresh snapshot is
 *             assumed not-yet-rendered and is folded back in. This is correct
 *             regardless of render timing, and still lets an unrelated
 *             synchronous edit (pen/shape/drag, made while idle) through via
 *             the fresh snapshot itself.
 *
 *             Framework/DOM-free by design so the no-loss guarantee is
 *             testable without React or a real image decode/upload — see
 *             test/media-commit-chain.test.ts.
 */

export interface MediaCommitResult<T> {
  /** The chain's new accumulator value — what the NEXT queued link builds on. */
  after: readonly T[];
  /**
   * Override the `before` passed to `onCommit` (defaults to this link's
   * accumulator `before`). Lets a caller exclude an ephemeral, never-
   * separately-committed entry (e.g. an optimistic blob: preview) from the
   * undo record while still folding it into the accumulator correctly.
   */
  commitBefore?: readonly T[];
  label?: string;
}

export interface MediaCommitChain<T> {
  /**
   * Enqueue a synchronous mutation. `mutate` receives the current
   * accumulated `before` (the previous link's `after` while a link is still
   * in flight, or a reconciled `getSnapshot()` read once the queue has
   * drained) and returns a result, or `null` to skip (no-op, `before` passes
   * through unchanged). `onCommit` fires with `(before, after, label)` in
   * strict queue order, once per non-null mutation.
   */
  enqueue(
    mutate: (before: readonly T[]) => MediaCommitResult<T> | null,
    onCommit: (before: readonly T[], after: readonly T[], label?: string) => void
  ): Promise<readonly T[]>;
}

export function createMediaCommitChain<T>(
  getSnapshot: () => readonly T[],
  keyOf: (item: T) => string
): MediaCommitChain<T> {
  let pending: Promise<readonly T[]> | null = null;
  // The last array this chain itself produced. Never cleared — only ever
  // superseded by a fresh reconciled read once every id it carries shows up
  // in `getSnapshot()` too (see reconcile()).
  let remembered: readonly T[] | null = null;

  function reconcile(): readonly T[] {
    const fresh = getSnapshot();
    if (!remembered) return fresh;
    const freshKeys = new Set(fresh.map(keyOf));
    const notYetRendered = remembered.filter((item) => !freshKeys.has(keyOf(item)));
    return notYetRendered.length ? [...fresh, ...notYetRendered] : fresh;
  }

  const enqueue: MediaCommitChain<T>['enqueue'] = (mutate, onCommit) => {
    const seed = pending ?? Promise.resolve(reconcile());
    const link: Promise<readonly T[]> = seed.then((before) => {
      const result = mutate(before);
      if (!result) return before;
      onCommit(result.commitBefore ?? before, result.after, result.label);
      remembered = result.after;
      return result.after;
    });
    pending = link;
    void link.then(() => {
      if (pending === link) pending = null;
    });
    return link;
  };

  return { enqueue };
}
