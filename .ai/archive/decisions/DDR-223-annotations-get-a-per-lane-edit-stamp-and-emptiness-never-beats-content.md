# DDR-223 — Annotations get a per-lane edit stamp, and unstamped emptiness never beats content

- **Date:** 2026-08-14
- **Status:** accepted
- **Scope:** `repo:maude`, `dept:dev`
- **Extends:** [DDR-102](./DDR-102-hub-sync-cold-start-safety.md)
- **Related:** [DDR-177](./DDR-177-desktop-self-contained-runtime-and-bundle-completeness-gate.md) (the sibling asset-sweep fix shipped in the same cycle)

## Context

**The eraser.** Live-tested on alligators (2026-08-14): a sidecar committed with
two `<image>` strokes at 12:45 was the empty 72-byte wrapper on every peer two
minutes after the v0.60.4 fleet roll, and stayed empty through the user's
retest. Cold start resolved annotations by the BODY winner ("visually
coupled"), in both sync architectures (agent `reconcile`, shared-doc
`migrateSeed` + room `persistJson`). Two facts made that a data-loss machine:

1. **Annotation edits don't move the body's edit time.** A hub with a newer
   body and a stale annotations lane wins the body comparison and drags its
   stale annotations over the peer's newer strokes.
2. **The empty wrapper isn't `''`.** `strokesToSvg([])` serializes to
   `<svg … data-mdcc-annotations="1"></svg>` — a non-empty string carrying
   zero strokes — so every `!== ''` emptiness guard waved it through, and the
   constant-string shape also defeats the client's self-echo suppression
   (`recentSelfSvgsRef`), which is why the UIs kept rendering strokes whose
   durable record was already gone.

The user-visible symptom was one step removed: the strokes carry the
`assets/<sha8>` references `asset-pull` scans, so a freshly dropped image's
bytes never crossed machines — a broken-image frame in the right place, with
the right size, forever. Gallery-existing images "worked" (bytes already
everywhere) and artboard images were immune (their references live in the
`.tsx` body, which DDR-102 protects), which is exactly the confusing symptom
triangle that started the hunt.

## Decisions

### 1. `syncMeta.annotationsEditAt` — a per-lane newest-wins stamp

Every local→doc annotations apply stamps `annotationsEditAt` in the SAME
transaction (agent `applyFromFs`, projection `applyFromFs`, cold-start
local-wins seed, adopt, migrate-seed adopt) — the exact `bodyEditAt` pattern
from DDR-102, applied to the lane that never had one. Cold-start seeding
stamps with the FILE's mtime, not apply time, so stale content can't claim
freshness.

### 2. Cold start resolves annotations per-lane, not by the body winner

`decideAnnotationsColdStart` (cold-start.ts, pure, table-tested) replaces the
"follow the body winner" coupling in BOTH architectures. The body-winner
coupling survives only as the last-resort fallback when both sides are
non-empty and no stamp exists (pre-stamp interop). CSS keeps following the
body winner — it genuinely is edited with the body.

### 3. The load-bearing rule: unstamped emptiness never beats content

`isEmptyAnnotationsSvg` (codec.ts) recognizes the bare wrapper as empty. At
cold start, an empty side with no stamp (or an older stamp) LOSES to a side
with strokes, and the strokes are seeded up — healing the hub copy instead of
adopting its amnesia. A STAMPED emptiness that is provably newer is a
deliberate delete-all and is honored, including materializing the wrapper over
local strokes. Live delete-all propagation is untouched
(`writeAnnotationsIfChanged` still materializes the wrapper on doc updates);
only cold-start decisions treat the wrapper as emptiness.

## Alternatives rejected

- **Minimal fix only (prefer-non-empty, no stamp).** Leaves "delete all, then
  cold-start elsewhere" permanently resurrecting strokes. The stamp closes
  that from day one at trivial cost — one map key riding existing
  transactions.
- **Stamping in the collab registry too (`syncRoomAnnotations`).** Redundant:
  every room-side annotation write is preceded by `saveAnnotations` writing
  the sidecar file, and the file watcher's apply stamps it. One stamping
  surface per architecture, not two.
- **Treating the wrapper as empty in the LIVE write path.** Would break
  delete-all propagation — a legit "delete everything" must still materialize
  on peers. The empty-check is a cold-start concept only.

## Known residual

The constant-wrapper self-echo collision (`recentSelfSvgsRef` can misread a
peer's real delete-all echo as a self-echo, because every empty save produces
the same 72 bytes) survives this DDR. It is UI-state-only now — the durable
lane is protected — but worth a nonce or content-hash-plus-counter if it ever
bites visibly.

## Evidence

- `apps/studio/test/sync-annotations-cold-start.test.ts` — the decision table,
  the codec round-trip, and both eraser scenarios end-to-end (agent +
  migrate-seed).
- Git forensics: alligators `bd5ad43` (the 12:45 sidecar with strokes) vs. the
  15:36 wrapper across all six sidecars, mtime-correlated with the 13:10
  fleet roll.
