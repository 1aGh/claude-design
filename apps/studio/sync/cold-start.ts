// Cold-start body resolution — the pure decision core of the conflict
// protocol (DDR-102; supersedes the v1.1 "hub-wins always" scoping).
//
// Both sync paths (agent.ts reconcile, migrate-seed.ts for the shared-doc
// cutover) feed their observed state into `decideColdStart` and execute the
// returned action. Keeping the table pure makes the full matrix unit-testable
// without Y.Docs or disk (mirrors codec.ts's pure-function style).
//
// The journal (journal.ts) is what separates a CLEAN catch-up from divergence:
// journalHash == hash(local) means every local byte was already reconciled
// through this machine — the hub being different just means it moved ahead, so
// overwriting disk is a fast-forward, not data loss. Any other combination of
// "both sides non-empty and different" is a conflict: the caller snapshots
// BOTH versions to `_history/<slug>/` and applies the newest-wins winner.
//
// Newest-wins compares the doc-side `syncMeta.bodyEditAt` stamp (codec.ts —
// written by every peer that applies a local body into the doc) against the
// local file mtime. Either side unknown (older peer never stamped; mtime
// unavailable) or equal → hub wins, exactly the v1.1 default — but now both
// sides are snapshotted first, so even a wrong pick costs one /design:rollback.

import { hashBytes } from './echo-guard.ts';

export type ColdStartAction =
  | 'noop'
  | 'materialize-hub'
  | 'seed-local-up'
  | 'fast-forward-hub'
  | 'recover-seed-dup'
  | 'conflict';

export interface ColdStartInput {
  /** Local body file content, or null when the file doesn't exist. */
  localBody: string | null;
  /** Body currently held by the doc (hub state after first sync). */
  docBody: string;
  /** Journal entry's bodyHash for this slug, or null when never checkpointed. */
  journalHash: string | null;
  /** Local body file mtime (ms epoch), or null when unavailable. */
  localMtimeMs: number | null;
  /** Doc-side syncMeta.bodyEditAt stamp (ms epoch), or null when no peer ever
   *  stamped (older peer interop) — falls back to hub-wins. */
  docBodyEditAtMs: number | null;
}

export interface ColdStartDecision {
  action: ColdStartAction;
  /** Set only for `conflict`. */
  winner?: 'local' | 'hub';
  /** Human-readable, logged + recorded in the conflict entry. */
  reason: string;
}

/** Trim-only-whitespace bodies count as empty (mirrors the agent's
 *  `localHtml.trim() !== ''` guard). */
function isEmptyBody(body: string | null): boolean {
  return body === null || body.trim() === '';
}

/**
 * True when `docBody` is exactly `localBody` repeated N≥2 times — the signature
 * of a concurrent cold-seed collision (F1): two peers each `seed-local-up`-ed
 * the SAME body into an empty hub before either's write propagated, so the CRDT
 * preserved both insertions and the Y.Text became `BODY` × N. We detect the
 * exact-repeat shape (not a fuzzy "contains") so a legitimate later edit — which
 * is never a clean integer-multiple repeat of the prior body — can't be
 * mis-read as a duplication and clobbered back. Exact equality (N==1) is the
 * caller's `noop`, handled before this is consulted.
 */
export function isExactRepeat(docBody: string, localBody: string): boolean {
  if (localBody.length === 0) return false;
  if (docBody.length <= localBody.length) return false;
  if (docBody.length % localBody.length !== 0) return false;
  const n = docBody.length / localBody.length;
  return docBody === localBody.repeat(n);
}

function commentId(c: unknown): string | null {
  if (c && typeof c === 'object' && typeof (c as { id?: unknown }).id === 'string') {
    return (c as { id: string }).id;
  }
  return null;
}

/**
 * Union-merge two comment snapshots by stable `id` (DDR-102): doc order first,
 * local-only entries appended. Comments carry stable ids, so union loses
 * nothing and needs no winner — same-id entries keep the doc's version.
 * Id-less entries dedupe by JSON identity (conservative). Shared by both
 * cold-start paths (agent reconcile + migrate-seed).
 */
export function unionCommentsById(docList: unknown[], localList: unknown[]): unknown[] {
  const out = [...docList];
  const seenIds = new Set<string>();
  const seenJson = new Set<string>();
  for (const c of docList) {
    const id = commentId(c);
    if (id !== null) seenIds.add(id);
    else seenJson.add(JSON.stringify(c));
  }
  for (const c of localList) {
    const id = commentId(c);
    const dup = id !== null ? seenIds.has(id) : seenJson.has(JSON.stringify(c));
    if (dup) continue;
    out.push(c);
    if (id !== null) seenIds.add(id);
    else seenJson.add(JSON.stringify(c));
  }
  return out;
}

export function decideColdStart(input: ColdStartInput): ColdStartDecision {
  const localEmpty = isEmptyBody(input.localBody);
  const docEmpty = isEmptyBody(input.docBody);

  if (localEmpty && docEmpty) {
    return { action: 'noop', reason: 'both sides empty — nothing to reconcile' };
  }

  if (localEmpty) {
    // Clean first sync: nothing local to lose.
    return { action: 'materialize-hub', reason: 'no local body — materializing hub state' };
  }

  if (docEmpty) {
    // DDR-064 empty-hub guard, now a named case: an empty hub doc means the hub
    // holds no body for this slug yet — NOT an authoritative "blank canvas".
    return {
      action: 'seed-local-up',
      reason: 'hub doc empty — seeding local body up (DDR-064 guard)',
    };
  }

  if (input.localBody === input.docBody) {
    // Caller records the journal so the NEXT boot sees a clean checkpoint.
    return { action: 'noop', reason: 'local and hub identical' };
  }

  // Concurrent cold-seed collision (F1): the hub body is our local body repeated
  // N≥2 times — two peers seeded the same canvas into an empty hub at the same
  // moment and the CRDT concatenated both insertions (un-buildable: two `export
  // default`). This is NOT divergence (it carries no new bytes — just a doubled
  // copy of ours), so it must NOT take the conflict/fast-forward path. Collapse
  // it back to one copy by re-applying local (the caller's `applyHtmlToDoc` diff
  // deletes the trailing duplicate). Idempotent across peers — the delete targets
  // the same CRDT items, so concurrent recoveries converge instead of fighting.
  if (
    input.localBody !== null &&
    !localEmpty &&
    !docEmpty &&
    isExactRepeat(input.docBody, input.localBody)
  ) {
    return {
      action: 'recover-seed-dup',
      reason:
        'hub body is local repeated — concurrent cold-seed duplication; collapsing to one copy',
    };
  }

  // Hash via hashBytes ONLY — the journal recorded its hashes through the same
  // fn (single source, echo-guard.ts), so this comparison is apples-to-apples.
  if (
    input.journalHash !== null &&
    input.localBody !== null &&
    input.journalHash === hashBytes(input.localBody)
  ) {
    // Everything local was already reconciled through this machine; the hub is
    // simply ahead. Overwrite WITHOUT snapshot/conflict — a clean fast-forward.
    return {
      action: 'fast-forward-hub',
      reason: 'local matches last-synced journal hash — hub is ahead, fast-forwarding',
    };
  }

  // Divergence: both sides non-empty, different, and local carries bytes this
  // machine never reconciled (journal stale or absent). Newest wins; unknown
  // or tied timestamps fall back to hub (v1.1 default, now recoverable).
  const local = input.localMtimeMs;
  const doc = input.docBodyEditAtMs;
  if (local !== null && doc !== null && local !== doc) {
    const winner = local > doc ? 'local' : 'hub';
    return {
      action: 'conflict',
      winner,
      reason: `diverged — newest wins: local mtime ${new Date(local).toISOString()} ${
        winner === 'local' ? '>' : '<'
      } doc bodyEditAt ${new Date(doc).toISOString()}`,
    };
  }
  return {
    action: 'conflict',
    winner: 'hub',
    reason:
      local === null || doc === null
        ? 'diverged — timestamp unknown on one side, falling back to hub-wins (recoverable: both sides snapshotted)'
        : 'diverged — timestamps tied, falling back to hub-wins (recoverable: both sides snapshotted)',
  };
}

/* ------------------------------------------------- annotations (per-lane) */

export interface AnnotationsColdStartInput {
  /** Local `.annotations.svg` content, or null when the file doesn't exist. */
  local: string | null;
  /** Annotations currently held by the doc (`''` when the lane is unset). */
  doc: string;
  /** True when the value carries zero strokes — callers pass
   *  `isEmptyAnnotationsSvg` (codec.ts) so this table stays Y-free. */
  isEmpty: (svg: string | null) => boolean;
  /** Local annotations file mtime (ms epoch), or null when unavailable. */
  localMtimeMs: number | null;
  /** Doc-side syncMeta.annotationsEditAt stamp, or null when no peer ever
   *  stamped (pre-stamp interop). */
  docEditAtMs: number | null;
  /** The body lane's resolved winner — the legacy coupling, used only as the
   *  fallback when both sides are non-empty and neither is stamped. */
  bodyWinner: 'local' | 'hub';
}

export interface AnnotationsColdStartDecision {
  winner: 'local' | 'hub' | 'none';
  reason: string;
}

/**
 * Per-lane cold-start resolution for annotations (extends DDR-102 to the
 * annotations lane; the 2026-08-14 annotations eraser).
 *
 * Annotations used to blindly follow the body winner — but annotation edits
 * don't move the body's edit time, so a hub with a newer body and a STALE
 * (empty-wrapper) annotations lane erased newer local strokes on every cold
 * start, and with the strokes went the `assets/<sha8>` references the asset
 * pull scans. The one load-bearing rule here: **unstamped emptiness never
 * beats content.** A STAMPED emptiness that is provably newer is a deliberate
 * delete-all and is honored; everything else prefers the side with strokes.
 */
export function decideAnnotationsColdStart(
  input: AnnotationsColdStartInput
): AnnotationsColdStartDecision {
  const { local, doc, isEmpty, localMtimeMs, docEditAtMs, bodyWinner } = input;
  const localEmpty = isEmpty(local);
  const docEmpty = isEmpty(doc === '' ? null : doc);

  if (localEmpty && docEmpty) return { winner: 'none', reason: 'both sides empty' };

  if (docEmpty && !localEmpty) {
    // A stamped hub emptiness NEWER than the local file is a deliberate
    // delete-all made while this peer was offline — honor it.
    if (docEditAtMs !== null && localMtimeMs !== null && docEditAtMs > localMtimeMs) {
      return {
        winner: 'hub',
        reason: `hub delete-all is newer than local strokes (annotationsEditAt ${new Date(docEditAtMs).toISOString()} > local mtime ${new Date(localMtimeMs).toISOString()})`,
      };
    }
    return {
      winner: 'local',
      reason:
        'hub annotations are empty but local has strokes — keeping local + seeding it up (unstamped emptiness never beats content)',
    };
  }

  if (!docEmpty && localEmpty) {
    // Symmetric: a local delete-all (empty wrapper on disk) newer than the
    // doc's stamp is honored; an absent/stale local file materializes the hub.
    if (
      local !== null &&
      localMtimeMs !== null &&
      docEditAtMs !== null &&
      localMtimeMs > docEditAtMs
    ) {
      return {
        winner: 'local',
        reason: `local delete-all is newer than hub strokes (local mtime ${new Date(localMtimeMs).toISOString()} > annotationsEditAt ${new Date(docEditAtMs).toISOString()})`,
      };
    }
    return { winner: 'hub', reason: 'local annotations empty/absent — materializing hub strokes' };
  }

  // Both non-empty.
  if (doc === local) return { winner: 'none', reason: 'both sides equal' };
  if (docEditAtMs !== null && localMtimeMs !== null && docEditAtMs !== localMtimeMs) {
    const winner = localMtimeMs > docEditAtMs ? 'local' : 'hub';
    return {
      winner,
      reason: `diverged — newest wins: local mtime ${new Date(localMtimeMs).toISOString()} ${
        winner === 'local' ? '>' : '<'
      } doc annotationsEditAt ${new Date(docEditAtMs).toISOString()}`,
    };
  }
  return {
    winner: bodyWinner,
    reason: `diverged — no per-lane stamp on one side, following the body winner (${bodyWinner})`,
  };
}
