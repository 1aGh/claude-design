// The doorbell's other button — the cell child telling its hub it wrote.
//
// Increment 3 shipped `POST /api/journal/report` and nothing that calls it. The
// asymmetry that left is the one a user actually feels:
//
//   desktop → cloud   a peer PUTs through the write door, the door hooks the
//                     journal synchronously, the hub pokes, peers pull. Seconds.
//   cloud → desktop   the cell's OWN studio child writes straight to the shared
//                     checkout. No door, no hook, no row — so the hub does not
//                     know, cannot poke, and the change waits for the 15-minute
//                     walk-import belt.
//
// Both halves "work"; only one is prompt, and that reads as "sync is broken"
// because a person drops an image in the cloud and it is not on their laptop
// ten minutes later. Observed live: `assets/2e32c88c.png` written at 14:45,
// journalled at 14:55 with `source: walk-import`.
//
// ── Why a nudge and not a report ───────────────────────────────────────────
//
// This carries PATHS ONLY. It cannot state a hash, a size, a class, or a
// deletion, because the hub re-stats and re-hashes its own disk for every path
// it is handed (`journal.recordWrite`). That is what makes it safe to accept
// from a process the hub supervises but does not trust to speak about content —
// and it is why being INCOMPLETE here is a latency bug and never a correctness
// one. `walk-import` remains the backstop it always was.
//
// ── Why `fs:any` is the right input ────────────────────────────────────────
//
// A cell's recursive `fs.watch` does not fire for atomic tmp+rename writes, so
// there is no watcher to subscribe to. But the studio already had to solve
// exactly this for hot-reload, and the answer it landed on is a single bus
// event: `createContainerWriteBridge` synthesises `fs:any` from the
// `activity:suppress` every API write path arms, and `announceWrite` does the
// same for the doc→file projector, which arms nothing. Between them they are
// the complete set of writes this process makes — which is the same
// completeness argument the HMR path already stakes itself on. Subscribing to
// their common output means this module needs no new instrumentation at any
// write site, and a future write path that remembers to hot-reload gets a
// journal row for free.
//
// ── The one thing it must not do ───────────────────────────────────────────
//
// `createCtlHealer` emits `fs:any` too, for paths the HUB just told us about.
// Nudging those back is harmless — same bytes, same hash, `recordWrite` is a
// no-op, no row, no poke, so it cannot loop — but it is a request per healed
// path for a fact the hub stated in the first place. `mute()` drops that echo
// at the source instead of paying for it.

import { isProjectFileShape, isRuntimeStateRel } from './file-membership.ts';

/** Collect a burst of writes into one request. */
const COALESCE_MS = 250;

/**
 * How long a healed path stays muted. Long enough to cover the healer's own
 * `fs:any` (immediate) and the coalesce window behind it; short enough that a
 * genuine local edit to a file we just pulled still nudges.
 */
const MUTE_MS = 1_500;

/** The route's own ceiling (`MAX_NUDGE_PATHS`). Batches split at it. */
const MAX_PATHS_PER_NUDGE = 64;

export interface CellWriteNudgeOptions {
  hubUrl: string;
  token: string;
  fetchImpl?: typeof fetch;
  log?: Pick<Console, 'log' | 'warn' | 'error'>;
  coalesceMs?: number;
  muteMs?: number;
  setTimeoutImpl?: typeof setTimeout;
  clearTimeoutImpl?: typeof clearTimeout;
  /** Injected in tests. Defaults to `Date.now`. */
  now?: () => number;
}

export interface CellWriteNudge {
  /** A path this process wrote. Filtered, coalesced, then named in a nudge. */
  note(rel: string): void;
  /** This path came FROM the hub — do not tell the hub about it. */
  mute(rel: string): void;
  /** Send whatever is pending now (boot, tests, shutdown). */
  flush(): Promise<void>;
  stop(): void;
  /** Requests that got a 2xx — the sender half of the honesty counters. */
  sent(): number;
  /** Paths named across all requests. */
  named(): number;
  /** Paths dropped as hub echoes. */
  muted(): number;
  /** Consecutive failed requests. Non-zero and climbing means the hub is gone. */
  failures(): number;
}

/**
 * Build the nudge sender.
 *
 * Never throws and never rejects: a hub that refuses the nudge costs the
 * freshness this module exists to buy, and nothing else. The child keeps
 * serving, the checkout keeps its bytes, and the reconciler still finds the
 * drift on its own belt.
 */
export function createCellWriteNudge(opts: CellWriteNudgeOptions): CellWriteNudge {
  const log = opts.log ?? console;
  const coalesceMs = opts.coalesceMs ?? COALESCE_MS;
  const muteMs = opts.muteMs ?? MUTE_MS;
  const setTimeoutImpl = opts.setTimeoutImpl ?? setTimeout;
  const clearTimeoutImpl = opts.clearTimeoutImpl ?? clearTimeout;
  const now = opts.now ?? Date.now;
  const doFetch = opts.fetchImpl ?? fetch;
  const url = `${opts.hubUrl.replace(/\/+$/, '')}/api/journal/report`;

  const pending = new Set<string>();
  const mutedUntil = new Map<string, number>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight: Promise<void> | null = null;
  let stopped = false;
  let sent = 0;
  let named = 0;
  let muted = 0;
  let failures = 0;
  /** Log the first failure at error, the rest at debug — one hub outage is one line. */
  let warnedFailure = false;

  function sweepMutes(at: number): void {
    for (const [rel, until] of mutedUntil) {
      if (until <= at) mutedUntil.delete(rel);
    }
  }

  async function postOnce(paths: string[]): Promise<boolean> {
    try {
      const res = await doFetch(url, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${opts.token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ paths }),
      });
      // The answer is `{ noted }` and deliberately says nothing about what
      // landed (it would be an existence oracle over the checkout). So the ONLY
      // thing worth reading here is the status.
      return res.ok;
    } catch {
      return false;
    }
  }

  async function drain(): Promise<void> {
    if (stopped || pending.size === 0) return;
    const batch = [...pending];
    pending.clear();
    for (let i = 0; i < batch.length; i += MAX_PATHS_PER_NUDGE) {
      const slice = batch.slice(i, i + MAX_PATHS_PER_NUDGE);
      const ok = await postOnce(slice);
      if (ok) {
        sent += 1;
        named += slice.length;
        failures = 0;
        warnedFailure = false;
        continue;
      }
      failures += 1;
      if (!warnedFailure) {
        warnedFailure = true;
        log.warn?.(
          `[sync/nudge] could not tell the hub about ${slice.length} write(s) — it will find them on the walk-import belt instead. Changes made here reach peers late until this recovers.`
        );
      }
      // A dropped nudge is latency, not loss: `walk-import` still finds the
      // drift. Re-queueing a failed batch forever would turn a hub restart into
      // an unbounded retry storm against a route that is rate-limited, so the
      // paths go and the backstop takes it from here.
    }
  }

  function schedule(): void {
    if (stopped || timer !== null) return;
    timer = setTimeoutImpl(() => {
      timer = null;
      void flush();
    }, coalesceMs);
    timer.unref?.();
  }

  async function flush(): Promise<void> {
    if (inFlight) return inFlight;
    inFlight = drain().finally(() => {
      inFlight = null;
    });
    return inFlight;
  }

  return {
    note(rel: string): void {
      if (stopped || typeof rel !== 'string' || rel.length === 0) return;
      // Separators are NOT normalised here. Every `fs:any` producer already
      // emits forward slashes (`fs-watch`, both halves of `hmr-broadcast`,
      // `announceWrite`, the healer's journal rows), so there is nothing left to
      // fix — and rewriting anyway would be actively wrong on POSIX, where
      // `a\b.css` is one legal filename and `a/b.css` is a different file. Let
      // the classifier judge what arrives, exactly as the hub will.
      //
      // Cheap and pure. The hub's classifier is still the authority on
      // membership; this only keeps the obvious noise off the wire, and
      // `_state/` alone would otherwise be most of the traffic on a busy canvas.
      if (!isProjectFileShape(rel) || isRuntimeStateRel(rel)) return;
      const at = now();
      const until = mutedUntil.get(rel);
      if (until !== undefined && until > at) {
        mutedUntil.delete(rel);
        muted += 1;
        return;
      }
      pending.add(rel);
      schedule();
    },

    mute(rel: string): void {
      if (stopped || typeof rel !== 'string' || rel.length === 0) return;
      const at = now();
      sweepMutes(at);
      mutedUntil.set(rel, at + muteMs);
    },

    flush,

    stop(): void {
      stopped = true;
      if (timer !== null) {
        clearTimeoutImpl(timer);
        timer = null;
      }
      pending.clear();
      mutedUntil.clear();
    },

    sent: () => sent,
    named: () => named,
    muted: () => muted,
    failures: () => failures,
  };
}
