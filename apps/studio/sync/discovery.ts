// Continuous canvas discovery — the decision half.
//
// THE BUG THIS EXISTS TO END. `createSyncRuntime.start()` enumerated a project
// exactly once: `scanCanvases` for the local disk, `GET /api/documents` for the
// hub, then one provider per canvas. After that loop nothing could join the
// runtime. A canvas created a second later — by the person, by `/design:new`,
// by a peer, by `git checkout` — was invisible to sync until the whole runtime
// was cycled (the Resync button, or an app restart).
//
// That read as a one-way sync, and the asymmetry was an artifact of WHO
// restarts. A desktop app is relaunched constantly, so a canvas made there
// eventually got picked up; a cloud cell is a container that stays up for days,
// so a canvas made there never did — no provider, therefore no Hocuspocus
// document, therefore not even a NAME in the listing the desktop polls. The
// same missing mechanism, one end of it just failed more visibly.
//
// WHY A FULL RESCAN RATHER THAN A DELTA. `canvas-list-watch.ts` already emits
// `canvas-list-update` with a `rel` and a `slug`, and it would be easy to build
// a descriptor from them. That file's own comment forbids it, and it is right:
// those values are ATTACKER-CONTROLLED (an agent-authored or `git checkout`-
// authored filename), and a descriptor is a set of paths the runtime then reads
// and writes. So the event is treated as a NUDGE ONLY — the authoritative set is
// recomputed by the same `scanCanvases` boot uses, and this module just diffs
// the result. A rescan also gets rename, move, a flipped `syncable: false` and a
// newly-declared canvas group right, all of which a single-path delta gets wrong.

/** What changed between the runtime's current membership and a fresh scan. */
export interface CanvasSetDiff {
  /** Slugs present in the scan that the runtime has not attached. */
  added: string[];
  /** Slugs the runtime holds that the scan no longer offers. */
  removed: string[];
}

/**
 * Diff a fresh scan against what the runtime currently owns.
 *
 * `attached` is the runtime's live membership (agents + projections), NOT the
 * boot set — a canvas pulled down from the hub mid-session is attached and must
 * therefore not be re-added on the next rescan.
 *
 * PULLED CANVASES ARE NEVER "REMOVED" BY THIS. A canvas that arrived from the
 * hub may legitimately be absent from a local scan for a moment (its body is
 * written after the handshake), and dropping it would tear down the provider
 * that is in the middle of materialising it. The caller passes those slugs in
 * `keep` and they are excluded from `removed` — being on the hub is reason
 * enough to stay attached.
 */
export function diffCanvasSet(
  attached: Iterable<string>,
  scanned: Iterable<string>,
  keep: Iterable<string> = []
): CanvasSetDiff {
  const have = new Set(attached);
  const want = new Set(scanned);
  const pinned = new Set(keep);
  const added: string[] = [];
  const removed: string[] = [];
  for (const slug of want) if (!have.has(slug)) added.push(slug);
  for (const slug of have) if (!want.has(slug) && !pinned.has(slug)) removed.push(slug);
  added.sort();
  removed.sort();
  return { added, removed };
}

export interface RescanScheduler {
  /** Ask for a rescan. Coalesces every call inside the debounce window. */
  schedule(): void;
  /** Run now, awaiting any rescan already in flight. Test seam. */
  flush(): Promise<void>;
  stop(): void;
}

export interface RescanSchedulerOptions {
  debounceMs: number;
  run: () => Promise<void>;
  setTimer?: (cb: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimer?: (h: ReturnType<typeof setTimeout>) => void;
  /** Reported failures — never thrown, a rescan that failed must not kill sync. */
  onError?: (err: unknown) => void;
}

/**
 * Debounce + serialize the rescans.
 *
 * Both properties are load-bearing, for different reasons. DEBOUNCE: creating a
 * canvas writes a `.tsx` and then a `.meta.json`, and a `git checkout` touches
 * hundreds of files — one scan per quiet window, not per write. SERIALIZE: two
 * overlapping rescans would each diff against a membership the other is
 * changing, and both would try to adopt the same slug.
 *
 * Mirrors `canvas-list-watch.ts`'s own chain-and-debounce shape deliberately, so
 * the two watchers are reviewable side by side rather than being two different
 * answers to one question.
 */
export function createRescanScheduler(opts: RescanSchedulerOptions): RescanScheduler {
  const setTimer = opts.setTimer ?? ((cb, ms) => setTimeout(cb, ms));
  const clearTimer = opts.clearTimer ?? ((h) => clearTimeout(h));
  let pending: ReturnType<typeof setTimeout> | null = null;
  let chain: Promise<void> = Promise.resolve();
  let stopped = false;

  const runOnce = async (): Promise<void> => {
    if (stopped) return;
    try {
      await opts.run();
    } catch (err) {
      opts.onError?.(err);
    }
  };

  function enqueue(): Promise<void> {
    chain = chain.then(runOnce, runOnce);
    return chain;
  }

  return {
    schedule() {
      if (stopped) return;
      if (pending) clearTimer(pending);
      pending = setTimer(() => {
        pending = null;
        void enqueue();
      }, opts.debounceMs);
    },
    flush() {
      if (pending) {
        clearTimer(pending);
        pending = null;
      }
      return enqueue();
    },
    stop() {
      stopped = true;
      if (pending) clearTimer(pending);
      pending = null;
    },
  };
}
