# DDR-200: File-tree move — path-derived canvas slug re-keyed server-side, no stable canvas id

- **Date:** 2026-07-29
- **Status:** Accepted
- **Tags:** dev-server, file-tree, canvas-lifecycle, slug, collab, security
- **Related:** [DDR-115](./DDR-115-per-user-camera-split-and-runtime-state-taxonomy.md) (the runtime-state taxonomy this feature is a fourth consumer of), [DDR-054](./DDR-054-linked-mode-trust-model-and-task-4-hardening.md) / [DDR-088](./DDR-088-canvas-media-vocabulary-and-asset-write-surface.md) (the canvas-origin trust boundary the two new routes sit outside of) · Plan: `.ai/plans/feature-file-tree-drag-drop-folders.md`

## Context

Every canvas's slug (`_history/<slug>/`, `_canvas-state/<slug>.json`, `_comments/<slug>.json`, `_state/<slug>.ydoc.bin`, `<slug>.annotations.svg`, `<slug>.edl.json`, the `_locator.json` key, the live collab room name) is derived **purely from its file path** (`canvasSlugFromRel()`: `/`→`-`, whitespace→`_`, lowercased). The file tree could create folders and open canvases, but could not move or rename one — dragging `ui/Foo.tsx` to `ui/app/Foo.tsx` by hand in a terminal silently disconnects every one of those artifacts from the canvas, because the new slug (`ui-app-foo`) shares nothing with the old one (`ui-foo`).

The delete path already had this bug in miniature: `deleteCanvas` hand-listed the sidecars it trashed and missed `_state/<slug>.ydoc.bin` and `<slug>.edl.json`. There was no single source of truth for "everything belonging to this canvas."

## Alternatives considered

- **A — stable canvas id in `.meta.json`, slug becomes a lookup, not a derivation.** The structurally "correct" fix: a move never needs to touch anything, because nothing is keyed by path. Rejected for scope — it re-keys ~10 subsystems (history, canvas-state, comments, collab persistence, annotations, footage EDL, the locator, `bin/slug.sh`, every `/design:*` command that reads `_history/<slug>/`) plus the hub sync protocol, which assumes the slug *is* the doc name. An order of magnitude more work than this feature, and every one of those call sites would need to learn to resolve id→path instead of deriving path→slug. Recorded here as the rejected alternative so a future arc doesn't have to re-derive why this one is smaller.
- **B — re-key server-side on move, keep the path-derived slug.** Accepted. `moveCanvas`/`moveFolder` (`apps/studio/api.ts`) rename the primary `.tsx` first, then relocate every sidecar under its new slug. Bounded, shippable in one feature, and the failure mode (a stale sidecar under the old slug) is recoverable rather than silent data loss.
- **C — do nothing; document "don't rename mid-project."** Rejected — the whole point of the feature is that a growing `.design/ui/` needs organizing, and the failure mode of ignoring it (orphaned history/comments/camera) is exactly what a real user hit that motivated this plan.

## Decision

We picked **B**. Concretely:

### 1. One canonical artifact inventory, not four hand-written sidecar lists

`apps/studio/canvas-artifacts.ts` exports `canvasArtifacts({ rel, paths })` → every on-disk artifact a canvas owns (primary `.tsx`, same-basename siblings `.meta.json`/`.css`/`.registry.json`, and every slug-keyed sidecar), plus `relocatedName()` (where an artifact lands after a move) and `locatorKeyFor()` (see point 3). `deleteCanvas` was refactored to consume it instead of its hand-rolled `moveIfExists` list — closing the `.ydoc.bin`/`.edl.json` gap as a side effect — and `moveCanvas`/`moveFolder` are the third and fourth consumers. This is the DDR-115 runtime-state taxonomy expressed in exactly one place instead of being re-derived per call site; when a future artifact class is added to DDR-115's IGNORED/VERSIONED split, this is the one file that needs to learn about it.

### 2. Non-atomicity is accepted, not solved

A crash mid-move leaves a partial state — this is explicitly not transactional. Two mitigations, not a fix: the primary `.tsx` renames **first**, so the tree is never wrong about *where the canvas lives* even if a sidecar relocation fails after it; and every successful relocation is logged to `_history/<toSlug>/_move.json` (fromRel/toRel/fromSlug/toSlug/moved[]/timestamp) for forensic recovery. A best-effort loop (`statp` → `rename`, swallow-and-continue on a missing sidecar) mirrors the existing `deleteCanvas` pattern rather than inventing a new failure model.

### 3. The `_locator.json` slug shape is DIVERGENT on purpose, and kept in its own function

`_locator.json` keys use `locator.ts`'s `canvasSlug()` — posix, extension-less, **not** lowercased or dash-flattened — a different shape from `canvasSlugFromRel()`'s slug (`ui-foo` vs `ui/Foo`). `canvas-artifacts.ts` exports `locatorKeyFor()` as a function separate from the slug-keyed artifact list specifically so the two shapes can never be confused inside one loop — the plan called this out as "the single most likely bug in this feature," and keeping it a distinct named export is the guard against it.

### 4. Collab rooms are flushed and force-dropped, refused when pinned

`collab/registry.ts` gained `forceDrop(slug)` — flush + tear down a room **regardless of live connections** (unlike the existing `drop()`, which leaves an active room alone). `moveCanvas`/`moveFolder` refuse the move with 409 when `isPinned(slug)` (a DDR-064 shared-doc hub provider is attached), otherwise force-drop before renaming. **Hub consequence, stated plainly:** a renamed canvas is a **new hub doc name** — a peer who has the canvas open keeps syncing the OLD doc name until they pull the rename. This is not solved here; it is the natural consequence of the collab room being keyed by the same path-derived slug as everything else (see Alternative A).

### 5. The two new routes are privileged, not canvas-reachable

`POST /_api/fs-move` and `POST /_api/fs-mkdir` copy `/_api/canvas`'s guard stack verbatim (`sameOriginWrite` CSRF gate → `isLoopbackHost` DNS-rebinding gate) and are absent from **both** `CANVAS_SAFE_API` and `startCanvasServer`'s route map (DDR-054/DDR-088's dual-allowlist rule) — the untrusted canvas iframe must never reach a file-move/mkdir endpoint. `test/canvas-origin-gate.test.ts` asserts both paths 403 from the canvas origin.

### 6. Folder move reuses one native `rename()`, only sidecars loop per-canvas

`moveFolder` (the `moveCanvas` entry point auto-detects a non-`.tsx` source as a folder) enumerates every nested `.tsx` canvas *before* the rename, then does **one** `rename(srcDir, destDir)` — which relocates the primary + same-dir siblings of every nested canvas for free, since they live inside the moved directory. Only the slug-keyed sidecars (flat dirs like `_history/<slug>/`, not nested by folder structure) need their own per-canvas relocation loop afterward. Capped at 50 canvases per batch move (refused above that with a clear message) — the non-atomicity caveat above multiplies with N.

## Consequences

**Positive:**
- One inventory function is the only place that needs to learn about a new artifact class; `deleteCanvas` and `moveCanvas`/`moveFolder` can't drift out of sync with each other again.
- The delete path's pre-existing `.ydoc.bin`/`.edl.json` gap is closed as a side effect of the refactor, not a separate fix.
- A rename never silently orphans history, comments, the camera position, or annotations — the failure mode moved from "silent, undiscoverable" (hand-moving the file) to "recoverable via `_move.json`" (a bug in the move itself).

**Negative / trade-offs:**
- The move is not atomic; a crash mid-relocation is a real (if narrow) possibility, mitigated but not eliminated.
- A renamed canvas breaks a peer's hub sync until they pull — no cross-machine rename propagation exists yet.
- "Rename" (same dir, new basename) is deferred — `moveCanvas`'s `toRel` always inherits the source's basename; a same-dir rename needs a `toName` parameter this feature didn't add, per the plan's explicit permission to defer that specific case.

## Revisit when

- A second feature needs to resolve "this canvas" independent of its current path (e.g. true cross-machine rename propagation, or a stable share link) — that is Alternative A's trigger condition, not a nice-to-have.
- The 50-canvas folder-move batch cap is hit in practice by a real project's directory reorganization.

## Linked

- Plan: `.ai/plans/feature-file-tree-drag-drop-folders.md`
- Files: `apps/studio/canvas-artifacts.ts`, `apps/studio/canvas-slug.ts`, `apps/studio/api.ts` (`moveCanvas`/`moveFolder`/`createFolder`), `apps/studio/collab/registry.ts` (`forceDrop`), `apps/studio/inspect.ts` (`retarget`), `apps/studio/http.ts` (`/_api/fs-move`, `/_api/fs-mkdir`)
- Supersedes: none
