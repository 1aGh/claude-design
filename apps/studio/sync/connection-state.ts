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
  /** DDR-102 — per-doc rollup (additive; absent in pre-DDR-102 payloads). */
  docs?: { synced: number; pending: number; rejected: number };
  /** DDR-102 — slugs currently auth-rejected, capped at 20 (see docs.rejected
   *  for the true count). Treat as text, never HTML. */
  rejectedSlugs?: string[];
  /**
   * Documents the PROJECT has that this machine does not, and therefore does
   * not sync. Every other count here is drawn from the local canvas set, so
   * none of them can express this gap — a peer opens a provider per local
   * canvas and Yjs cannot enumerate the rest. Absent when the hub could not be
   * asked (old hub, offline). Treat names as text, never HTML.
   */
  remoteGap?: { hubOnly: string[]; sharedCount: number };
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
  /** DDR-102 — record a document's sync state (pending/connected/auth-rejected). */
  noteDocState(slug: string, state: DocSyncState): void;
  /** DDR-102 — real sync activity for a slug (reconcile done, hub-pushed flush
   *  applied): bumps `lastSyncAt` to now. */
  noteSyncActivity(slug: string): void;
  /** Record the hub-vs-local document gap (see `remoteGap`). */
  setRemoteGap(gap: { hubOnly: { name: string }[]; shared: string[] } | null): void;
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

  let state: SyncState = 'online';
  let queuedOps = 0;
  let lastSyncAt: number | null = null;
  let offlineSince: number | null = null;
  let flash: 'synced' | null = null;

  let graceTimer: TimerHandle | null = null;
  let escalateTimer: TimerHandle | null = null;
  let flashTimer: TimerHandle | null = null;
  let stopped = false;

  /** Hub-vs-local document gap, once the hub has been asked. */
  let remoteGap: SyncStatusSnapshot['remoteGap'];

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
    return {
      state,
      queuedOps,
      lastSyncAt,
      offlineSince,
      flash,
      updatedAt: now(),
      docs,
      rejectedSlugs,
      ...(remoteGap ? { remoteGap } : {}),
    };
  }

  /**
   * Record the hub-vs-local document gap.
   *
   * Capped like `rejectedSlugs`: this reaches a UI and a JSON file, and an
   * unbounded list of hub-chosen names is a hub-controlled payload size.
   * `null` clears it — an unreachable hub must not leave a stale alarm up.
   */
  function setRemoteGap(gap: { hubOnly: { name: string }[]; shared: string[] } | null): void {
    remoteGap = gap
      ? {
          hubOnly: gap.hubOnly.slice(0, MAX_REJECTED_SLUGS).map((d) => d.name),
          sharedCount: gap.shared.length,
        }
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
    lastSyncAt = now();
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
    // Already counting down or already offline — don't restart the clock.
    if (state !== 'online') return;
    state = 'connecting';
    if (graceTimer !== null) clearTimer(graceTimer);
    graceTimer = setTimer(() => {
      graceTimer = null;
      goOffline();
    }, graceMs);
    emit();
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

  return {
    noteProviderStatus(providerId, status) {
      if (stopped) return;
      providerStatuses.set(providerId, status);
      const agg = aggregate();
      if (agg === 'connected') {
        if (state !== 'online') goOnline();
        return;
      }
      // Aggregate is connecting or disconnected → start (or continue) the
      // grace countdown. Once offline/offline-long we stay there until a
      // provider reports 'connected' again.
      if (state === 'online') enterGrace();
    },

    noteLocalEdit() {
      if (stopped) return;
      // Only count edits made while the hub is unreachable — those are the
      // ones queued for replay. Edits while online flush immediately.
      if (state === 'online') return;
      queuedOps += 1;
      emit();
    },

    noteDocState(slug, docState) {
      if (stopped) return;
      if (docStates.get(slug) === docState) return;
      docStates.set(slug, docState);
      emit();
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

    setRemoteGap,

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
