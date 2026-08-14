// Acting on a tombstone — the peer-side half of the delete lane.
//
// The hub states that a canvas is gone (`tombstones.mjs`); this is what a peer
// does about it. One rule governs the whole file:
//
//   QUARANTINE, NEVER DELETE.
//
// This is the only code path where a HUB-SUPPLIED signal removes work from a
// person's disk, and the hub is untrusted to peers (DDR-054). Moving the bundle
// to `_trash/<slug>-deleted-<ts>/` is what makes that acceptable: a hub that is
// hostile, buggy, or simply confused about which project it is costs the user a
// trip to `_trash/`, never their work. The same posture, and the same directory,
// `migrate-flat-fallback.ts` already established for a peer-driven move.
//
// WHY THE SIDECARS TRAVEL AND THE HISTORY DOES NOT. The lanes that ARE the
// canvas — body, `.meta.json`, `.css`, `.annotations.svg` — move together, so
// what lands in `_trash/` is a restorable canvas rather than a body stripped of
// its annotations. `_history/<slug>/`, `_comments/`, `_canvas-state/` stay: they
// are per-machine runtime state (DDR-115), regenerated or irrelevant, and
// sweeping them would make a recoverable delete quietly lossy.

import { existsSync, mkdirSync, renameSync } from 'node:fs';
import path from 'node:path';

/**
 * Park ONE file in `_trash/<rel>-conflict-<ts>` — the file plane's LWW
 * loser's parking spot (feature-sync-file-plane), generalized out of
 * `quarantineCanvas` below: same posture (quarantine, never delete; never
 * throw — a failed quarantine costs the overwrite, not the sync runtime),
 * scoped to a single file rather than a canvas's lane bundle.
 *
 * Returns the design-root-relative destination, or null when nothing moved —
 * and the CALLER must treat null as "do not overwrite": a conflict loser
 * that could not be parked is a conflict loser that stays.
 */
export function quarantineFile(opts: {
  designRoot: string;
  /** Design-root-relative path of the file to park. */
  rel: string;
  now?: number;
  log?: (line: string) => void;
}): string | null {
  const { designRoot, rel } = opts;
  const log = opts.log ?? ((line: string) => console.log(line));
  const abs = path.join(designRoot, rel);
  if (!existsSync(abs)) return null;
  const trashedTo = `_trash/${rel}-conflict-${opts.now ?? Date.now()}`;
  const trashAbs = path.join(designRoot, trashedTo);
  try {
    mkdirSync(path.dirname(trashAbs), { recursive: true });
    renameSync(abs, trashAbs);
  } catch (err) {
    log(
      `[sync/files] could not park ${rel} in _trash/: ${(err as Error).message} — keeping the local copy`
    );
    return null;
  }
  log(`[sync/files] conflict on ${rel} — the local copy moved to ${trashedTo}`);
  return trashedTo;
}

export interface TombstoneMove {
  slug: string;
  /** Design-root-relative quarantine dir the canvas landed in. */
  trashedTo: string;
  /** Design-root-relative lanes that actually moved. */
  moved: string[];
}

/** The absolute paths that make up one canvas on disk. */
export interface CanvasLanes {
  html: string;
  meta?: string;
  css?: string;
  annotations?: string;
}

/**
 * Move one canvas's lanes into `_trash/`, best-effort.
 *
 * Returns the move, or null when there was nothing on disk to move (already
 * gone — the idempotent steady state once both peers have converged) or when the
 * quarantine directory could not be made. NEVER THROWS: a failed quarantine must
 * cost the deletion, not the sync runtime that called it.
 *
 * `now` is injectable so a test does not have to reason about wall-clock.
 */
export function quarantineCanvas(opts: {
  designRoot: string;
  slug: string;
  lanes: CanvasLanes;
  now?: number;
  log?: (line: string) => void;
}): TombstoneMove | null {
  const { designRoot, slug, lanes } = opts;
  const log = opts.log ?? ((line: string) => console.log(line));
  const present = [lanes.html, lanes.meta, lanes.css, lanes.annotations].filter(
    (p): p is string => !!p && existsSync(p)
  );
  if (present.length === 0) return null;

  const trashedTo = `_trash/${slug}-deleted-${opts.now ?? Date.now()}`;
  const trashAbs = path.join(designRoot, trashedTo);
  try {
    mkdirSync(trashAbs, { recursive: true });
  } catch (err) {
    log(
      `[sync/tombstone] could not quarantine ${slug}: ${(err as Error).message} — leaving it in place`
    );
    return null;
  }

  const moved: string[] = [];
  for (const abs of present) {
    try {
      renameSync(abs, path.join(trashAbs, path.basename(abs)));
      moved.push(path.relative(designRoot, abs));
    } catch (err) {
      // One stuck lane (an open handle on Windows, a permission quirk) must not
      // abandon the lanes that CAN move — a half-moved canvas is still gone from
      // the tree, and the remainder is named here so it can be found by hand.
      log(
        `[sync/tombstone] could not move ${path.basename(abs)} for ${slug}: ${(err as Error).message}`
      );
    }
  }
  if (moved.length === 0) return null;

  log(`[sync/tombstone] ${slug} was deleted in the project — moved to ${trashedTo}/`);
  return { slug, trashedTo, moved };
}
