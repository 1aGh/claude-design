// Central transaction-origin sentinels for the shared-doc path — Phase 9.2
// (DDR-064 Task 5).
//
// Once a SINGLE Y.Doc per canvas has multiple writers attached (the browser
// collab WS, the hub HocuspocusProvider, the disk projector, and — at cutover —
// the one-time migration seed), every writer MUST tag its transactions with a
// distinct origin and every consumer MUST filter its own, or a write echoes
// back into the system and loops. This module is the one place those origins
// are defined so the discipline is auditable in one read.
//
// Two of the origins are inherently PER-INSTANCE and are NOT exported here:
//
//   HUB       — the HocuspocusProvider applies hub updates tagged with its own
//               internal origin (the provider instance). Consumers detect "this
//               came from the hub" as "origin is neither a RoomConn nor one of
//               the sentinels below".
//   LOCAL_WS  — a browser edit arrives through the collab Room as a RoomConn
//               object (it has an `id` field — see room.ts). That object IS the
//               origin; the Room's own broadcaster already keys off it.
//
// The remaining origins are process-wide singletons (frozen so identity
// comparison `===` is stable and a consumer can't accidentally reconstruct an
// equal-but-different object):

export const ORIGINS = {
  /**
   * The disk projector materializing the doc to files (doc→file). The projector
   * writes FILES, not the doc, so this is not normally applied as a Y
   * transaction origin — it exists for symmetry + so any future doc-touching
   * projection step (e.g. a normalization write-back) is filterable.
   */
  DISK_PROJECTION: Object.freeze({ origin: 'disk-projection' as const }),
  /**
   * An external file edit (`/design:edit`, a human, a git pull) imported INTO
   * the doc as a minimal diff (file→doc). The projector tags its import with
   * this so its OWN doc.on('update') handler skips it — the file is already
   * current, re-projecting it back would be a redundant write.
   */
  FILE_IMPORT: Object.freeze({ origin: 'file-import' as const }),
  /**
   * The one-time authoritative clear-and-rebuild seed at per-canvas cutover
   * (Phase E migrate-seed). Distinct so the projector can choose to debounce or
   * suppress disk writes during the seed transaction (it's already on disk).
   */
  MIGRATION: Object.freeze({ origin: 'migration' as const }),
} as const;

export type OriginSentinel = (typeof ORIGINS)[keyof typeof ORIGINS];

/** True when `origin` is one of this module's projector/seed sentinels. */
export function isProjectorOrigin(origin: unknown): boolean {
  return (
    origin === ORIGINS.DISK_PROJECTION ||
    origin === ORIGINS.FILE_IMPORT ||
    origin === ORIGINS.MIGRATION
  );
}
