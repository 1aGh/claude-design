// Sync status surface — Phase 9 Task 8.
//
// Single source of truth for "what is the hub link doing right now", consumed
// by three readers:
//   1. `.design/_sync.json` on disk    — `maude design status` reads it.
//   2. the dev-server bus ('sync:status') — broadcast to browser tabs over WS
//      so the canvas chrome can render the offline/synced/escalation banner.
//   3. GET /_sync-status                — poll fallback for the browser banner.
//
// The store merges the ConnectionMonitor snapshot (online/offline/queuedOps/…)
// with a bounded list of recent conflict notifications (cold-start hub-wins,
// git-pull divergence). Writes are best-effort + atomic-ish (tmp + rename via
// the injected writer); a failed write never throws into the sync hot path.

import type { AssetPushProgress } from './asset-push.ts';
import type { SyncStatusSnapshot } from './connection-state.ts';

// `cold-start-hub-wins` stays in the union for OLD payload readers (additive
// evolution — the NoSyncablePayload discriminator pattern); new conflicts are
// recorded as `cold-start-diverged` with the DDR-102 winner + snapshot refs.
export type ConflictKind = 'cold-start-hub-wins' | 'cold-start-diverged' | 'git-pull';

export interface SyncConflict {
  slug: string;
  kind: ConflictKind;
  at: number;
  /** DDR-102 — which side the newest-wins resolution kept. */
  winner?: 'local' | 'hub';
  /** DDR-102 — ISO timestamps of the `_history/<slug>/` snapshots taken before
   *  resolution (`/design:rollback` recovery). */
  snapshots?: { local?: string; hub?: string };
  /** DDR-102 fail-closed (F1) — the local snapshot didn't land, so a hub-wins
   *  overwrite was refused (local kept). Surfaces the degraded `_history/` write. */
  snapshotFailed?: boolean;
}

export interface SyncStatusPayload extends SyncStatusSnapshot {
  /** Linked hub URL (informational; the token is never included). */
  url: string;
  /** Number of canvases the runtime is syncing. */
  canvases: number;
  /** Recent conflict notifications (most-recent-last, capped). */
  conflicts: SyncConflict[];
  /**
   * Phase 9.2 (DDR-064) — true when the unified single-shared-doc model is
   * active (MAUDE_SHARED_DOC). Lets `maude design status` + the browser banner
   * show which collaboration model is running. Absent/false = the two-doc path.
   */
  sharedDoc?: boolean;
  /**
   * feature-sync-progress-modal — the DDR-217 asset push's live progress
   * (additive; absent until the first push emit of a boot). Rides the same
   * payload as the doc counts so the Sync panel has one source, not two.
   */
  assets?: AssetPushProgress;
  /**
   * feature-sync-file-plane — Plane B's counts (additive; absent until the
   * first flag-on file pull of a boot). `conflicts` names losers parked in
   * `_trash/<rel>-conflict-<ts>` — the panel line points there, because a
   * conflict a person cannot find is silent loss with extra steps.
   */
  files?: FilePlaneStatus;
  /**
   * feature-before-first-external-users Task 1 — consent-class notices
   * (DDR-064 A7 shared-doc, DDR-079 TSX bodies). These lived only in
   * `console.warn`, which a terminal-free desktop user never sees — the same
   * disease the breaker `held` field cured one section up. Additive; absent
   * until the first notice of a boot. The client renders them in the Sync
   * panel and keeps a machine-local dismiss ack keyed on (id, hub url).
   */
  notices?: SyncNotice[];
}

export interface SyncNotice {
  /** Stable, human-readable key (`shared-doc`, `tsx-bodies`) — the dismiss
   *  ack and the once-per-boot dedupe both key on it. */
  id: string;
  /** One paragraph, in the user's terms — what now leaves this machine and
   *  which config key opts out. */
  text: string;
  severity: 'info' | 'warn';
  at: number;
}

export interface FilePlaneStatus {
  /** Plane files present and equal after the last pass — the steady state. */
  synced: number;
  /** Cumulative files landed this boot. */
  pulled: number;
  /** Cumulative conflicts this boot (either winner); losers are in _trash/. */
  conflicts: number;
  /** Sync v2 — cumulative files sent UP this boot. The v1 lane had no push
   *  half of its own, so this is absent on a journal-less hub. */
  pushed?: number;
  /**
   * A BREAKER IS HOLDING, and this is how anyone finds out.
   *
   * The breakers shipped with their state living only in a `console.warn` and
   * a return field nothing read — so a hold was permanent, invisible, and had
   * no exit. That is worse than DDR-214's "a status surface that lies": the
   * surface was simply absent, while the release leaned on these controls as
   * its justification for shipping deletion without a soak.
   *
   * `kind` says which one, `paths` says what is waiting, and `answer` names
   * the config key that releases it — a hold a person cannot resolve is not a
   * safety control, it is a stall.
   */
  held?: {
    kind: 'delete-out' | 'delete-in' | 'first-anchor' | 'reanchor';
    count: number;
    paths: string[];
    /** One sentence, in the user's terms, about what is waiting and why. */
    detail: string;
  }[];
  /**
   * THE DORUČENKA (DDR-226 §7) — per-path delivery state.
   *
   * The counts above are what the old lane reported, and they are exactly
   * what could not answer the question three days of dogfood kept asking:
   * "where is THIS file". A total says how many are fine; it cannot point at
   * the one that is not.
   *
   * The counts stay beside it deliberately. A panel derived from the same
   * source it displays cannot be cross-checked, and DDR-214's whole lesson is
   * that a status surface has to be falsifiable — so the raw counters remain
   * as the thing to disagree with.
   */
  delivery?: Record<string, string>;
}

export interface SyncStatusStoreOptions {
  url: string;
  canvases: number;
  /** Phase 9.2 (DDR-064) — surfaced in the payload so readers show the model. */
  sharedDoc?: boolean;
  /** Persist the JSON payload (best-effort). */
  write: (payload: SyncStatusPayload) => void;
  /** Broadcast the payload to browser tabs (best-effort). */
  broadcast?: (payload: SyncStatusPayload) => void;
  /** Max conflict notifications retained. Default 20. */
  maxConflicts?: number;
  now?: () => number;
}

export interface SyncStatusStore {
  /** Merge a fresh ConnectionMonitor snapshot + persist + broadcast. */
  update(snapshot: SyncStatusSnapshot): void;
  /** Record a conflict notification + persist + broadcast. */
  addConflict(conflict: Omit<SyncConflict, 'at'>): void;
  /** feature-sync-progress-modal — merge asset-push progress + persist +
   *  broadcast. Kept in the store (not the monitor): assets are a push lane,
   *  not a connection, and the monitor's state machine must not learn them. */
  updateAssets(progress: AssetPushProgress): void;
  /** feature-sync-file-plane — merge Plane B counts + persist + broadcast.
   *  Same reasoning as `updateAssets`: a lane, not a connection. */
  updateFiles(files: FilePlaneStatus): void;
  /** Record a consent-class notice (A7) + persist + broadcast. Idempotent by
   *  `id` — the notice sites fire once per boot, and a repeat is a no-op
   *  rather than a duplicate row. */
  notice(notice: Omit<SyncNotice, 'at'>): void;
  /** Current payload (defensive copy). */
  get(): SyncStatusPayload;
}

const DEFAULT_MAX_CONFLICTS = 20;

export function createSyncStatusStore(opts: SyncStatusStoreOptions): SyncStatusStore {
  const now = opts.now ?? Date.now;
  const maxConflicts = opts.maxConflicts ?? DEFAULT_MAX_CONFLICTS;
  const conflicts: SyncConflict[] = [];

  let snapshot: SyncStatusSnapshot = {
    // Same reason the monitor is seeded `connecting` (see connection-state.ts):
    // this is the payload a reader gets BEFORE the first monitor snapshot lands,
    // so seeding it `online` re-introduced the born-connected lie one layer out.
    state: 'connecting',
    queuedOps: 0,
    lastSyncAt: null,
    offlineSince: null,
    flash: null,
    updatedAt: now(),
  };

  let assets: AssetPushProgress | undefined;
  let files: FilePlaneStatus | undefined;
  const notices: SyncNotice[] = [];

  function payload(): SyncStatusPayload {
    return {
      ...snapshot,
      url: opts.url,
      canvases: opts.canvases,
      conflicts: conflicts.slice(),
      ...(opts.sharedDoc ? { sharedDoc: true } : {}),
      ...(assets ? { assets } : {}),
      ...(files ? { files } : {}),
      ...(notices.length ? { notices: notices.slice() } : {}),
    };
  }

  function flush(): void {
    const p = payload();
    try {
      opts.write(p);
    } catch {
      /* best-effort — never throw into the sync hot path */
    }
    try {
      opts.broadcast?.(p);
    } catch {
      /* best-effort */
    }
  }

  return {
    update(next) {
      snapshot = next;
      flush();
    },
    addConflict(conflict) {
      conflicts.push({ ...conflict, at: now() });
      if (conflicts.length > maxConflicts) conflicts.splice(0, conflicts.length - maxConflicts);
      flush();
    },
    updateAssets(progress) {
      assets = progress;
      flush();
    },
    updateFiles(next) {
      files = next;
      flush();
    },
    notice(next) {
      if (notices.some((n) => n.id === next.id)) return;
      notices.push({ ...next, at: now() });
      flush();
    },
    get: payload,
  };
}
