// F6 — the aggregate byte budget on every downward lane (Sync v2 Increment 0,
// DDR-226 §9; the gap named in the Plane-B flip gate).
//
// Every pull lane already caps ONE file (`MAX_PULL_BYTES`) and the COUNT of
// files per pass (`MAX_PULLS_PER_PASS` / `MAX_FILES_PER_PASS`). Nothing capped
// the product. 200 files × 512 MB is 100 GB, and the hub decides both factors:
// a hostile or merely broken hub could fill a person's disk one "legitimate"
// pass at a time, and every individual transfer would pass every check.
//
// So the lanes share ONE budget object per pass. It is deliberately tiny and
// leaf (no imports): a counter, a ceiling, and a single loud line when it is
// reached — the "loud-cap convention" every other truncation in this codebase
// follows, because a silent stop reads as "sync is broken" with no cause.
//
// The per-pass ceiling is not a quota: the remainder is simply the next pass's
// work, exactly like the count caps. The CUMULATIVE per-hub accumulation quota
// (a real quota, which refuses rather than defers) is Increment 4's job.

/**
 * How many bytes one downward pass may land, across all files in that pass.
 *
 * 2 GiB is far above any real project's per-poll delta (a converged project
 * transfers zero) and far below "fills the disk while you are at lunch". A
 * fresh link of a large project takes several passes — which is already how
 * the count caps behave.
 */
export const MAX_PULL_BYTES_PER_PASS = 2 * 1024 * 1024 * 1024;

export interface PullBudget {
  /**
   * Charge `bytes` against the budget.
   *
   * Returns false when this transfer would exceed the ceiling — the caller
   * must NOT land it and should stop the pass (`exhausted()` is then true).
   * A charge that fits is committed, so `take` is not a pure predicate.
   */
  take: (bytes: number) => boolean;
  /** True once a `take` has been refused. */
  exhausted: () => boolean;
  /** Bytes committed so far this pass. */
  spent: () => number;
  /** Bytes still available. */
  remaining: () => number;
}

export interface PullBudgetOptions {
  /** Ceiling for this pass. Defaults to `MAX_PULL_BYTES_PER_PASS`. */
  maxBytes?: number;
  /** Log-line prefix — `sync/assets`, `sync/files`, … so the refusal names
   *  which lane hit the wall. */
  label: string;
  log?: Pick<Console, 'warn'>;
}

/**
 * One budget per pass. Never throws; refusing is a boolean, and the caller
 * reports it the way it reports every other cap.
 */
export function createPullBudget(opts: PullBudgetOptions): PullBudget {
  const max = opts.maxBytes ?? MAX_PULL_BYTES_PER_PASS;
  const log = opts.log ?? console;
  let spent = 0;
  let hitTheWall = false;

  return {
    take(bytes: number): boolean {
      // A negative/NaN size is a hub-supplied number: treat it as zero-cost
      // rather than as a credit (it can never REFUND budget).
      const cost = Number.isFinite(bytes) && bytes > 0 ? bytes : 0;
      if (spent + cost > max) {
        if (!hitTheWall) {
          hitTheWall = true;
          log.warn(
            `[${opts.label}] pass byte budget reached — ${spent} B landed, refusing a further ${cost} B (ceiling ${max} B, DDR-226 F6). The rest is the next pass's work.`
          );
        }
        return false;
      }
      spent += cost;
      return true;
    },
    exhausted: () => hitTheWall,
    spent: () => spent,
    remaining: () => Math.max(0, max - spent),
  };
}
