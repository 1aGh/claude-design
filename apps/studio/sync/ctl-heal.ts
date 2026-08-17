// Poke → `fs:any` → the existing HMR heal — Sync v2 Increment 2 (DDR-226 §6).
//
// This is the last hop of the fix, and it deliberately adds no new UI path: the
// studio already knows how to repoint a broken `<img>` when a media file lands
// (`canvas-hmr {mode:'asset'}`, DDR-224) and how to hot-swap a stylesheet. All
// that was ever missing in a container was the EVENT — `fs.watch` does not fire
// for the hub process's atomic tmp+rename writes, so the child never learned.
//
// So: the hub pokes, this asks the journal WHICH paths moved, and emits the
// `fs:any` the watcher owed us. Everything downstream is unchanged.
//
// WHY IT ASKS INSTEAD OF BEING TOLD. The poke carries a head and nothing else,
// on purpose (DDR-054 — a frame carrying a path would be a path the hub chose).
// The journal read is authenticated and scope-filtered, its rows are re-shaped
// on arrival (`journal-client.ts`), and this only ever emits a bus event for a
// path — it materializes nothing. A hostile hub's best case here is making the
// child re-read files it already has.
//
// A LOST POKE COSTS LATENCY, NEVER CORRECTNESS. The cursor only ever moves
// forward on a page we actually parsed, and the 20 s reconciler poll is still
// underneath. If the channel is down for an hour, the heal is late by an hour;
// nothing diverges.

import { fetchJournal } from './journal-client.ts';

/** Coalesce a burst of pokes into one journal read. */
const READ_DEBOUNCE_MS = 150;

export interface CtlHealerOptions {
  hubUrl: string;
  token: string;
  /** Emit the `fs:any` the container's watcher failed to (one per path). */
  emit: (rel: string) => void;
  fetchImpl?: typeof fetch;
  log?: Pick<Console, 'log' | 'warn'>;
  debounceMs?: number;
  setTimeoutImpl?: typeof setTimeout;
  clearTimeoutImpl?: typeof clearTimeout;
}

export interface CtlHealer {
  /** A poke arrived. `head` is the hub's hint; the journal is the answer. */
  onPoke(head: number): void;
  /** Read now (tests; boot). Resolves once the pass is done. */
  drain(): Promise<void>;
  stop(): void;
  /** Paths announced so far — the receiver half of the honesty counters. */
  healed(): number;
  /** Pokes whose head was at or below the cursor: pure noise, and expected. */
  ignored(): number;
}

/**
 * Turn pokes into heal events.
 *
 * The cursor starts at the FIRST head we are told about rather than at 0. A
 * child that has just booted has already read the checkout from disk — every
 * row before now describes a file it can already see, so replaying them would
 * be a reload storm on every cell wake for zero benefit. What matters is
 * everything AFTER the child started looking.
 */
export function createCtlHealer(opts: CtlHealerOptions): CtlHealer {
  const log = opts.log ?? console;
  const debounceMs = opts.debounceMs ?? READ_DEBOUNCE_MS;
  const setTimeoutImpl = opts.setTimeoutImpl ?? setTimeout;
  const clearTimeoutImpl = opts.clearTimeoutImpl ?? clearTimeout;

  let cursor: number | null = null;
  let epoch: string | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight: Promise<void> | null = null;
  let again = false;
  let stopped = false;
  let healed = 0;
  let ignored = 0;
  /**
   * Is there anything to read?
   *
   * Without this, `drain()` would fire a request every time it is called even
   * when nothing has moved — which on a quiet project is a poll we did not ask
   * for, against a route that is rate-limited. Only `schedule()` sets it, and
   * only a completed read clears it.
   */
  let dirty = false;

  async function readOnce(): Promise<void> {
    if (stopped || cursor === null || !dirty) return;
    dirty = false;
    const page = await fetchJournal({
      hubUrl: opts.hubUrl,
      token: opts.token,
      since: cursor,
      epoch,
      ...(opts.fetchImpl ? { fetchImpl: opts.fetchImpl } : {}),
    });
    // Unreachable / refused / unparseable — ask again on the next poke or the
    // next poll. Never advance the cursor on a page we did not read, and stay
    // dirty so the retry actually retries rather than short-circuiting.
    if (page === null) {
      dirty = true;
      return;
    }

    if (page.reanchor) {
      // The log no longer contains our cursor (an epoch rotation, or a
      // compaction past it). For the HEAL path specifically there is nothing to
      // replay — the child re-reads the tree from disk on demand anyway — so
      // the honest move is to jump to the new head and say so, rather than
      // pretend a page arrived.
      log.warn?.(
        `[sync/ctl] the hub asked us to re-anchor (${page.reason ?? 'cursor not in this log'}); heal cursor moves to ${page.head}.`
      );
      cursor = page.head;
      epoch = page.epoch;
      return;
    }

    epoch = page.epoch;
    for (const entry of page.entries) {
      // A tombstone is not a heal — Increment 6 owns deletion, and emitting
      // `fs:any` for a vanished path would make the canvas layer look for a
      // file that is deliberately gone.
      if (entry.deleted) continue;
      try {
        opts.emit(entry.path);
        healed += 1;
      } catch (err) {
        log.warn?.(`[sync/ctl] heal emit failed for ${entry.path}: ${(err as Error).message}`);
      }
    }
    // Advance only over what we actually consumed. `truncated` means the next
    // pass has more, and the poke that follows (or the next drain) takes it.
    const last = page.entries.at(-1);
    cursor = last ? last.seq : page.head;
    if (page.truncated) schedule();
  }

  function schedule(): void {
    if (stopped) return;
    dirty = true;
    if (timer !== null) return;
    timer = setTimeoutImpl(() => {
      timer = null;
      void drain();
    }, debounceMs);
    timer.unref?.();
  }

  async function drain(): Promise<void> {
    if (inFlight) {
      again = true;
      return inFlight;
    }
    inFlight = (async () => {
      try {
        await readOnce();
      } finally {
        inFlight = null;
        if (again) {
          again = false;
          void drain();
        }
      }
    })();
    return inFlight;
  }

  return {
    onPoke(head: number): void {
      if (stopped) return;
      if (cursor === null) {
        // First contact: adopt the hub's head as the baseline. Everything
        // before it is already on disk and already rendered.
        cursor = head;
        return;
      }
      if (head <= cursor) {
        ignored += 1;
        return;
      }
      schedule();
    },
    drain,
    stop(): void {
      stopped = true;
      if (timer !== null) {
        clearTimeoutImpl(timer);
        timer = null;
      }
    },
    healed: () => healed,
    ignored: () => ignored,
  };
}
