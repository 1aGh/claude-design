// Memory hygiene: FinalizationRegistry-backed iframe-state cleanup +
// periodic heap-watch. See plan Task 8 + DDR-009.
//
// FinalizationRegistry callbacks are not guaranteed — they are the safety net,
// not the primary path. The primary path is the explicit `iframe:closed` event
// emitted on the bus, which calls cleanupFn synchronously.

// #119 — these thresholds are read against `rss`, NOT `heapTotal`.
//
// The watch originally polled `process.memoryUsage().heapTotal`, which is a V8
// intuition that does not carry over: under Bun/JSC it barely moves for the
// allocations that actually grow this process. Measured while the server read
// 554 MB of chat transcripts, `rss` peaked at 1.29 GB while `heapTotal` peaked
// at 5 MB — three orders of magnitude apart. Neither threshold below was
// reachable, so the one guard written for a runaway-memory failure could never
// fire, and the `[mem]` line that would have named the problem never reached
// the log ring (and therefore never reached a bug report's `serverLogTail`).
// The bug it was meant to catch shipped past it in silence.
//
// `rss` is the number the user sees in Activity Monitor, which is also the
// number they report. Sized for a server whose steady state is a few hundred
// MB: WARN is "something is wrong", PANIC is "intervene before the machine
// starts swapping".
const RSS_WARN_BYTES = 1024 * 1024 * 1024; // 1 GB — log only
const RSS_PANIC_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB — log + force GC

/** Once past PANIC, back off exponentially instead of forcing a full GC on
 *  every tick forever. `Bun.gc(true)` is synchronous — it runs on the same
 *  single thread that serves the ACP socket and every HTTP route — so a
 *  permanently-crossed threshold must not become a permanent stutter. */
const PANIC_BACKOFF_MAX = 16;

let registry: FinalizationRegistry<{ id: string; cleanupFn: () => void }> | null = null;

function ensureRegistry(): FinalizationRegistry<{ id: string; cleanupFn: () => void }> {
  if (registry) return registry;
  registry = new FinalizationRegistry((held) => {
    try {
      held.cleanupFn();
    } catch (err) {
      console.error(`[mem] finalize callback for ${held.id} threw:`, err);
    }
  });
  return registry;
}

/**
 * Register a per-iframe cleanup function. The callback fires when the host
 * object is GC'd, OR when the caller explicitly invokes `cleanupFn`.
 */
export function registerIframe(id: string, host: object, cleanupFn: () => void) {
  ensureRegistry().register(host, { id, cleanupFn });
}

/**
 * Weak-ref'd map. Lookups deref to undefined when the entry has been GC'd.
 * Caller must null-check on every get().
 */
export class WeakMapById<T extends object> {
  private map = new Map<string, WeakRef<T>>();

  set(id: string, value: T) {
    this.map.set(id, new WeakRef(value));
  }

  get(id: string): T | undefined {
    const ref = this.map.get(id);
    if (!ref) return undefined;
    const value = ref.deref();
    if (!value) {
      this.map.delete(id);
      return undefined;
    }
    return value;
  }

  delete(id: string) {
    this.map.delete(id);
  }

  /** Sweep dead refs; returns the number of slots reclaimed. */
  sweep(): number {
    let n = 0;
    for (const [id, ref] of this.map) {
      if (!ref.deref()) {
        this.map.delete(id);
        n++;
      }
    }
    return n;
  }
}

let heapTimer: ReturnType<typeof setInterval> | null = null;

export function startHeapWatch(intervalMs = 60_000) {
  if (heapTimer) return;
  let ticksUntilPanic = 0;
  let panicBackoff = 1;
  heapTimer = setInterval(() => {
    const u = process.memoryUsage();
    const mb = (n: number) => (n / 1024 / 1024).toFixed(0);
    if (u.rss > RSS_PANIC_BYTES) {
      // ALWAYS log — the log line is the diagnostic that survives into a bug
      // report, and it must not be suppressed by the GC backoff below.
      console.warn(
        `[mem] rss ${mb(u.rss)}MB > panic threshold (heapUsed ${mb(u.heapUsed)}MB) — memory is not being reclaimed`
      );
      if (ticksUntilPanic > 0) {
        ticksUntilPanic--;
      } else {
        const gc = (globalThis as { Bun?: { gc?: (sync: boolean) => void } }).Bun?.gc;
        if (gc) gc(true);
        ticksUntilPanic = panicBackoff;
        panicBackoff = Math.min(panicBackoff * 2, PANIC_BACKOFF_MAX);
      }
    } else {
      ticksUntilPanic = 0;
      panicBackoff = 1;
      if (u.rss > RSS_WARN_BYTES) {
        console.warn(`[mem] rss ${mb(u.rss)}MB > warn threshold (heapUsed ${mb(u.heapUsed)}MB)`);
      }
    }
  }, intervalMs);
  // Don't keep the event loop alive just for the heap watch.
  const t = heapTimer as unknown as { unref?: () => void };
  t.unref?.();
}

export function stopHeapWatch() {
  if (heapTimer) clearInterval(heapTimer);
  heapTimer = null;
}
