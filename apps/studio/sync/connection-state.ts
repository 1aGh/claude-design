// Hub connection state machine — Phase 9 Task 8 (hub-down offline mode).
//
// The sync runtime owns one monitor for the whole linked session. Each
// HocuspocusProvider reports its WS status ('connected' | 'connecting' |
// 'disconnected'); the monitor aggregates them into a single hub-reachability
// view and drives the user-facing offline UX:
//
//   online        — hub reachable, edits flow live.
//   connecting    — WS dropped, inside the reconnect grace window. No banner yet
//                   (transient blips shouldn't flash UI).
//   offline       — still not reconnected after graceMs (default 30s). Local
//                   edits keep working + queue; yellow banner.
//   offline-long  — offline > escalateMs (default 24h). Red banner: "consider
//                   git commit && push as backup".
//
// On reconnect from any offline state the monitor emits a transient `flash:
// 'synced'` (green, flashMs default 3s) then settles back to online with
// queuedOps reset (the provider replays the buffered ops to the hub).
//
// Timers + clock are injectable so the state machine is fully unit-testable
// without real wall-clock waits.

export type ProviderStatus = 'connected' | 'connecting' | 'disconnected';
export type SyncState = 'online' | 'connecting' | 'offline' | 'offline-long';

/** DDR-102 — per-document sync state. `pending` until the first handshake
 *  settles; `connected` once synced/active; `auth-rejected` when the hub
 *  refused auth for this documentName (scope / invalid token / rate limit). */
export type DocSyncState = 'pending' | 'connected' | 'auth-rejected';

/** feature-sync-progress-modal — one row of the per-document list the Sync
 *  panel renders. `reason` is OUR OWN classification vocabulary (the
 *  AuthFailureClass strings), never hub-supplied text. */
export interface SyncDocItem {
  slug: string;
  state: DocSyncState;
  reason?: string;
}

export interface SyncStatusSnapshot {
  state: SyncState;
  /** Local edits made since the hub went unreachable (replayed on reconnect). */
  queuedOps: number;
  /** ms epoch of the last successful hub sync, or null if never synced.
   *  DDR-102: updated on REAL sync activity (noteSyncActivity), not just on
   *  offline→online transitions. */
  lastSyncAt: number | null;
  /** ms epoch the current offline streak began, or null when online. */
  offlineSince: number | null;
  /** Transient 'synced' signal (green flash) right after a reconnect. */
  flash: 'synced' | null;
  /** ms epoch this snapshot was produced. */
  updatedAt: number;
  /**
   * ms epoch this link's monitor was created — i.e. when this runtime started
   * trying. The one clock `connecting…` can honestly be measured against:
   * `updatedAt` moves on every emit (an auth-rejection storm refreshes it
   * forever), so "how long has nothing synced" needs a stamp that does NOT
   * reset while nothing is actually working. Absent in pre-existing payloads.
   */
  startedAt?: number;
  /** DDR-102 — per-doc rollup (additive; absent in pre-DDR-102 payloads). */
  docs?: { synced: number; pending: number; rejected: number };
  /** DDR-102 — slugs currently auth-rejected, capped at 20 (see docs.rejected
   *  for the true count). Treat as text, never HTML. */
  rejectedSlugs?: string[];
  /**
   * feature-sync-progress-modal — the per-document list behind `docs`, so the
   * Sync panel can render rows without a second fetch. Bounded at
   * MAX_SYNC_ITEMS with the INTERESTING states first (rejected, then pending,
   * then connected): the truncated tail is then always the already-summarised
   * happy case, and `itemsTruncated` says how many rows it holds. Slugs are
   * local canvas identifiers; `reason` is our own classification vocabulary.
   * Absent in pre-existing payloads.
   */
  items?: SyncDocItem[];
  /** Rows dropped by the MAX_SYNC_ITEMS cap (all `connected` by the sort). */
  itemsTruncated?: number;
  /**
   * Canvases this run brought DOWN from the project — documents that existed
   * only on the hub and are now real local files.
   *
   * This field was briefly `remoteGap`, "what the project has that this machine
   * does not". That name stopped being true the moment the pull landed: the
   * diff is computed before providers are built and recorded after, so it
   * enumerated exactly the documents that had just arrived. Observed live —
   * `_sync.json` naming two canvases that were sitting on disk.
   *
   * "What arrived this run" is both true and the more useful fact: it is what
   * the Synced state tells the user to go and open. Absent when the hub could
   * not be asked (old hub, offline) or when nothing was pulled. Names are
   * hub-controlled — treat as text, never HTML, and see the cap in `notePulled`.
   */
  pulled?: { names: string[]; count: number };
}

type TimerHandle = ReturnType<typeof setTimeout>;

export interface ConnectionMonitorOptions {
  /** ms disconnected before declaring offline. Default 30_000. */
  graceMs?: number;
  /** ms offline before escalating to offline-long. Default 24h. */
  escalateMs?: number;
  /** ms the green "synced" flash stays up after reconnect. Default 3_000. */
  flashMs?: number;
  now?: () => number;
  setTimer?: (cb: () => void, ms: number) => TimerHandle;
  clearTimer?: (h: TimerHandle) => void;
  /** Called on every observable state change (including flash set/clear). */
  onChange?: (snapshot: SyncStatusSnapshot) => void;
}

export interface ConnectionMonitor {
  /** Aggregate a single provider's status into the session view. */
  noteProviderStatus(providerId: string, status: ProviderStatus): void;
  /** A local edit happened — counts toward queuedOps while not online. */
  noteLocalEdit(): void;
  /** DDR-102 — record a document's sync state (pending/connected/auth-rejected).
   *  `reason` (feature-sync-progress-modal) is the classification for an
   *  auth-rejected doc — our own vocabulary, ignored for other states. */
  noteDocState(slug: string, state: DocSyncState, reason?: string): void;
  /**
   * Drop every trace of a slug — its doc state, its rejection reason and its
   * provider status.
   *
   * The counterpart to `noteDocState` for a canvas the runtime has RELEASED
   * (deleted on disk, or moved out of a synced group). Without it a released
   * canvas stays in the item list as a row that can never settle, and its stale
   * provider status keeps voting in the session's online/offline derivation.
   */
  forgetDoc(slug: string): void;
  /** DDR-102 — real sync activity for a slug (reconcile done, hub-pushed flush
   *  applied): bumps `lastSyncAt` to now. */
  noteSyncActivity(slug: string): void;
  /** Record the canvases this run pulled down from the project (see `pulled`). */
  notePulled(slugs: readonly string[]): void;
  /** Current snapshot (defensive copy). */
  snapshot(): SyncStatusSnapshot;
  /** Tear down timers. */
  stop(): void;
}

const DEFAULT_GRACE_MS = 30_000;
const DEFAULT_ESCALATE_MS = 24 * 60 * 60 * 1000;
const DEFAULT_FLASH_MS = 3_000;
/** Cap on rejectedSlugs in the snapshot (the rollup carries the true count). */
export const MAX_REJECTED_SLUGS = 20;
/**
 * Cap on the per-document `items` list. Every emit synchronously writes
 * `_sync.json` and fans out over WS, so the list must stay bounded no matter
 * how many canvases a project grows — 200 rows ≈ a few KB, and the sort keeps
 * everything a person must ACT on (rejected, pending) inside the cap.
 */
export const MAX_SYNC_ITEMS = 200;

/** Sort weight: the states a person must act on come first, so the cap only
 *  ever truncates the already-summarised happy tail. */
const ITEM_STATE_ORDER: Record<DocSyncState, number> = {
  'auth-rejected': 0,
  pending: 1,
  connected: 2,
};

export function createConnectionMonitor(opts: ConnectionMonitorOptions = {}): ConnectionMonitor {
  const graceMs = opts.graceMs ?? DEFAULT_GRACE_MS;
  const escalateMs = opts.escalateMs ?? DEFAULT_ESCALATE_MS;
  const flashMs = opts.flashMs ?? DEFAULT_FLASH_MS;
  const now = opts.now ?? Date.now;
  const setTimer = opts.setTimer ?? ((cb, ms) => setTimeout(cb, ms));
  const clearTimer = opts.clearTimer ?? ((h) => clearTimeout(h));
  const onChange = opts.onChange;

  const providerStatuses = new Map<string, ProviderStatus>();
  // DDR-102 — per-doc states (pending/connected/auth-rejected).
  const docStates = new Map<string, DocSyncState>();
  // feature-sync-progress-modal — rejection classifications, keyed by slug.
  // Held separately from docStates so the state machine above is untouched;
  // dropped the moment a doc leaves auth-rejected (a re-probe that succeeds
  // must not leave a stale reason on a connected row).
  const docReasons = new Map<string, string>();

  // NOT born connected. The monitor used to start `online`, so from the instant
  // a link was created — before a socket, before a token was accepted, before a
  // byte moved — every surface reading `state` reported success. On a healthy
  // fast connect that was harmless (the truth arrived milliseconds later); on a
  // refused or unreachable one it was the whole bug: the user was shown the
  // intention and read it as the result. `connecting` is the honest seed, and
  // it is the state a link genuinely occupies until a provider says otherwise.
  let state: SyncState = 'connecting';
  let queuedOps = 0;
  let lastSyncAt: number | null = null;
  let offlineSince: number | null = null;
  let flash: 'synced' | null = null;
  /** When this monitor began trying — see `SyncStatusSnapshot.startedAt`. */
  const startedAt = now();

  let graceTimer: TimerHandle | null = null;
  let escalateTimer: TimerHandle | null = null;
  let flashTimer: TimerHandle | null = null;
  let stopped = false;

  /** Canvases pulled down from the project this run. */
  let pulled: SyncStatusSnapshot['pulled'];

  /**
   * Start the clock at construction, not at the first provider event.
   *
   * `enterGrace` is reachable ONLY from `noteProviderStatus`, so a link where
   * no provider ever reports — every provider rejected during boot, a hub that
   * never completes an upgrade — would have sat in `connecting` forever and
   * never reached the offline banner. Seeding `state` honestly is not enough on
   * its own; something has to be counting from the moment the link exists.
   */
  function armInitialGrace(): void {
    graceTimer = setTimer(() => {
      graceTimer = null;
      goOffline();
    }, graceMs);
  }

  function snapshot(): SyncStatusSnapshot {
    const docs = { synced: 0, pending: 0, rejected: 0 };
    const rejectedSlugs: string[] = [];
    for (const [slug, st] of docStates) {
      if (st === 'connected') docs.synced++;
      else if (st === 'auth-rejected') {
        docs.rejected++;
        if (rejectedSlugs.length < MAX_REJECTED_SLUGS) rejectedSlugs.push(slug);
      } else docs.pending++;
    }
    // The per-row list, actionable states first so the cap only ever drops
    // rows the aggregate counts already describe (see MAX_SYNC_ITEMS).
    const allItems: SyncDocItem[] = [...docStates]
      .map(([slug, st]) => {
        const reason = docReasons.get(slug);
        return reason ? { slug, state: st, reason } : { slug, state: st };
      })
      .sort(
        (a, b) =>
          ITEM_STATE_ORDER[a.state] - ITEM_STATE_ORDER[b.state] || a.slug.localeCompare(b.slug)
      );
    const items = allItems.slice(0, MAX_SYNC_ITEMS);
    const itemsTruncated = allItems.length - items.length;
    return {
      state,
      queuedOps,
      lastSyncAt,
      offlineSince,
      flash,
      updatedAt: now(),
      startedAt,
      docs,
      rejectedSlugs,
      items,
      ...(itemsTruncated > 0 ? { itemsTruncated } : {}),
      ...(pulled ? { pulled } : {}),
    };
  }

  /**
   * Record the canvases this run pulled down from the project.
   *
   * `names` is capped like `rejectedSlugs` — this reaches a UI and a JSON file,
   * and an unbounded list of hub-chosen names is a hub-controlled payload size.
   * `count` keeps the true total, so the cap never falsifies the number the
   * user is shown. An empty list clears the field rather than recording a zero:
   * a run that pulled nothing has nothing to say.
   */
  function notePulled(slugs: readonly string[]): void {
    // Every other mutator carries this guard; without it a late call could
    // write `_sync.json` and broadcast for a monitor that has been torn down.
    // Unreachable today (the sole caller checks `stopped` too) — kept so the
    // invariant does not depend on the caller remembering it.
    if (stopped) return;
    pulled = slugs.length
      ? { names: slugs.slice(0, MAX_REJECTED_SLUGS), count: slugs.length }
      : undefined;
    emit();
  }

  function emit(): void {
    onChange?.(snapshot());
  }

  function clearAllTimers(): void {
    if (graceTimer !== null) {
      clearTimer(graceTimer);
      graceTimer = null;
    }
    if (escalateTimer !== null) {
      clearTimer(escalateTimer);
      escalateTimer = null;
    }
  }

  /** Aggregate provider statuses: connected if ANY is connected, else
   *  connecting if ANY is connecting, else disconnected. An empty map (no
   *  providers yet) is treated as connecting (boot, pre-handshake). */
  function aggregate(): ProviderStatus {
    if (providerStatuses.size === 0) return 'connecting';
    let anyConnecting = false;
    for (const s of providerStatuses.values()) {
      if (s === 'connected') return 'connected';
      if (s === 'connecting') anyConnecting = true;
    }
    return anyConnecting ? 'connecting' : 'disconnected';
  }

  function goOnline(): void {
    const wasOffline = state === 'offline' || state === 'offline-long';
    clearAllTimers();
    state = 'online';
    // NOT `lastSyncAt = now()`.
    //
    // A SOCKET TRANSITION IS NOT A SYNC. This line used to stamp the
    // last-synced clock from the WS coming back — an event that, by itself,
    // has moved no document and settled no handshake. The field's own contract
    // one screen up already says otherwise ("updated on REAL sync activity
    // (noteSyncActivity), not just on offline→online transitions"); the code
    // simply did not honour it.
    //
    // It was not a cosmetic drift. Live on the reported project (issue #118):
    // `state:"online", docs:{synced:0,pending:85}` with `lastSyncAt` refreshed
    // to the exact millisecond of that transition — so the one number a reader
    // could have used to notice that nothing had synced in 15 minutes was
    // being refreshed BY the failure. `noteSyncActivity` is the only honest
    // source, and it is now the only one.
    offlineSince = null;
    queuedOps = 0;
    if (wasOffline) {
      flash = 'synced';
      if (flashTimer !== null) clearTimer(flashTimer);
      flashTimer = setTimer(() => {
        flashTimer = null;
        flash = null;
        if (!stopped) emit();
      }, flashMs);
    }
    emit();
  }

  function enterGrace(): void {
    // Already offline — stay there until a provider reports 'connected'.
    if (state === 'offline' || state === 'offline-long') return;
    // Already counting down — don't restart the clock. The guard used to be
    // `state !== 'online'`; the timer, not the state, is what says whether a
    // countdown is running, and with the `connecting` seed those are no longer
    // the same question.
    if (graceTimer !== null) return;
    state = 'connecting';
    graceTimer = setTimer(() => {
      graceTimer = null;
      goOffline();
    }, graceMs);
    // No emit here — the sole caller emits once for the whole update, so a
    // demotion that does not change `state` still reaches the readers.
  }

  function goOffline(): void {
    state = 'offline';
    offlineSince = now();
    if (escalateTimer !== null) clearTimer(escalateTimer);
    escalateTimer = setTimer(() => {
      escalateTimer = null;
      state = 'offline-long';
      emit();
    }, escalateMs);
    emit();
  }

  armInitialGrace();

  return {
    noteProviderStatus(providerId, status) {
      if (stopped) return;

      // EMIT ONLY ON A REAL CHANGE.
      //
      // Every emit is a synchronous `_sync.json` write plus a WS broadcast to
      // every open tab. Provider status is driven by the socket lifecycle,
      // which the hub controls, and there is one provider per canvas — 75+ in
      // the reported project. An unconditional emit here turns a flapping (or
      // deliberately hostile) hub into a sustained disk-write and fan-out loop
      // on the dev-server's main thread. The pre-existing code emitted only on
      // a transition; adding the demotion below must not cost that property.
      const prevStatus = providerStatuses.get(providerId);
      providerStatuses.set(providerId, status);
      let changed = prevStatus !== status;

      // A document whose socket is gone is not a synced document.
      //
      // `docs.synced` used to only ever RISE — nothing demoted a `connected`
      // doc, so a hub that died left the last count frozen on screen, which is
      // the most convincing form of the lie: it was true a moment ago. The
      // provider id IS the slug (`index.ts` passes `canvas.slug`), so the
      // monitor already knows which document just lost its socket.
      //
      // `auth-rejected` is deliberately NOT demoted. The hub gave an answer;
      // losing the socket afterwards does not turn that answer back into
      // "still trying", and letting it would hide a rotated credential behind
      // a spinner.
      if (status !== 'connected' && docStates.get(providerId) === 'connected') {
        docStates.set(providerId, 'pending');
        changed = true;
      }

      const agg = aggregate();
      if (agg === 'connected') {
        // goOnline() emits for the transition; otherwise only a real change
        // (this provider's status moved, or a document was demoted) is news.
        if (state !== 'online') goOnline();
        else if (changed) emit();
        return;
      }
      // Aggregate is connecting or disconnected → start (or continue) the
      // grace countdown. Once offline/offline-long we stay there until a
      // provider reports 'connected' again.
      const before = state;
      enterGrace();
      if (changed || state !== before) emit();
    },

    noteLocalEdit() {
      if (stopped) return;
      // Only count edits made while the hub is unreachable — those are the
      // ones queued for replay. Edits while online flush immediately.
      if (state === 'online') return;
      queuedOps += 1;
      emit();
    },

    noteDocState(slug, docState, reason) {
      if (stopped) return;
      // STATE-ONLY dedupe. This briefly compared `reason` too, which handed a
      // hostile hub an amplifier: the rejection text is hub-controlled, so
      // alternating it on an open socket forced a full emit — items rebuild +
      // synchronous `_sync.json` write + WS fanout — per frame (security
      // review 2026-08-11, sync-progress-modal defender). The reason is
      // LATCHED for the life of a rejection episode instead: the first
      // classification wins, leaving the rejected state clears the latch, and
      // a NEW episode records a fresh reason. Repeat frames stay a no-op.
      if (docStates.get(slug) === docState) return;
      docStates.set(slug, docState);
      if (docState !== 'auth-rejected') docReasons.delete(slug);
      else if (reason !== undefined) docReasons.set(slug, reason);
      emit();
    },

    forgetDoc(slug) {
      if (stopped) return;
      // A released canvas must leave the counters, not linger as a `pending` row
      // nothing will ever settle. `providerStatuses` is keyed by the same slug
      // (see `noteProviderStatus`'s `providerId`), so it is dropped here too —
      // otherwise a deleted canvas's last known status would keep voting in
      // `deriveState` forever and could hold the whole session in `offline`.
      const had = docStates.delete(slug);
      docReasons.delete(slug);
      const hadStatus = providerStatuses.delete(slug);
      if (had || hadStatus) emit();
    },

    noteSyncActivity(slug) {
      if (stopped) return;
      lastSyncAt = now();
      // Real sync traffic for a pending doc proves its handshake settled.
      // An auth-rejected doc stays rejected (activity for it can't happen,
      // but be defensive against ordering races).
      if (docStates.get(slug) === 'pending') docStates.set(slug, 'connected');
      emit();
    },

    notePulled,

    snapshot,

    stop() {
      stopped = true;
      clearAllTimers();
      if (flashTimer !== null) {
        clearTimer(flashTimer);
        flashTimer = null;
      }
    },
  };
}
