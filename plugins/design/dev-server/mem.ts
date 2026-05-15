// Memory hygiene: FinalizationRegistry-backed iframe-state cleanup +
// periodic heap-watch. See plan Task 8 + DDR-009.
//
// FinalizationRegistry callbacks are not guaranteed — they are the safety net,
// not the primary path. The primary path is the explicit `iframe:closed` event
// emitted on the bus, which calls cleanupFn synchronously.

const HEAP_WARN_BYTES = 256 * 1024 * 1024; // 256 MB — log only
const HEAP_PANIC_BYTES = 384 * 1024 * 1024; // 384 MB — force GC

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
  heapTimer = setInterval(() => {
    const u = process.memoryUsage();
    if (u.heapTotal > HEAP_PANIC_BYTES) {
      console.warn(
        `[mem] heap ${(u.heapTotal / 1024 / 1024).toFixed(0)}MB > panic threshold — forcing GC`
      );
      // Bun.gc(true) is sync; Node has no equivalent without --expose-gc.
      const gc = (globalThis as { Bun?: { gc?: (sync: boolean) => void } }).Bun?.gc;
      if (gc) gc(true);
    } else if (u.heapTotal > HEAP_WARN_BYTES) {
      console.warn(`[mem] heap ${(u.heapTotal / 1024 / 1024).toFixed(0)}MB > warn threshold`);
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
