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

import type { SyncStatusSnapshot } from './connection-state.ts';

export type ConflictKind = 'cold-start-hub-wins' | 'git-pull';

export interface SyncConflict {
  slug: string;
  kind: ConflictKind;
  at: number;
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
  addConflict(conflict: { slug: string; kind: ConflictKind }): void;
  /** Current payload (defensive copy). */
  get(): SyncStatusPayload;
}

const DEFAULT_MAX_CONFLICTS = 20;

export function createSyncStatusStore(opts: SyncStatusStoreOptions): SyncStatusStore {
  const now = opts.now ?? Date.now;
  const maxConflicts = opts.maxConflicts ?? DEFAULT_MAX_CONFLICTS;
  const conflicts: SyncConflict[] = [];

  let snapshot: SyncStatusSnapshot = {
    state: 'online',
    queuedOps: 0,
    lastSyncAt: null,
    offlineSince: null,
    flash: null,
    updatedAt: now(),
  };

  function payload(): SyncStatusPayload {
    return {
      ...snapshot,
      url: opts.url,
      canvases: opts.canvases,
      conflicts: conflicts.slice(),
      ...(opts.sharedDoc ? { sharedDoc: true } : {}),
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
    addConflict({ slug, kind }) {
      conflicts.push({ slug, kind, at: now() });
      if (conflicts.length > maxConflicts) conflicts.splice(0, conflicts.length - maxConflicts);
      flush();
    },
    get: payload,
  };
}
