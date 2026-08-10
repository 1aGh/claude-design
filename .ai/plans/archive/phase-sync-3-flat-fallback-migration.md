# Phase sync-3: One-shot migration of the pre-fix-5 flat fallback files

> Part of [`feature-sync-completion-fixes-4-8.md`](./feature-sync-completion-fixes-4-8.md) (fix 4). **Depends on phase sync-2** — the recurrence must be closed before cleaning up what it wrote; otherwise the duplicates come right back.

## Description

Create a one-shot, idempotent boot migration that quarantines the flat duplicate canvas files the pre-fix-5 fallback (v0.58.2, `f2a38c46`) already wrote to disk.

## User Story

As a user with pre-existing duplicates I want the redundant flat copies quarantined (not deleted), so that my tree matches the cloud again and cleanup can never lose work.

## Problem

Two files resolve to one slug (`.design/ui-welcome.tsx` AND `.design/ui/welcome.tsx`) — the v0.58.2 fallback change landed with no migration of what the old flat rule wrote. Fix 5 (sync-2) stops NEW duplicates; the old ones are still on disk.

## Solution

`apps/studio/sync/migrate-flat-fallback.ts`, wired into sync boot once, before the first reconcile — mirroring the existing `migrate-seed.ts` one-shot pattern. Collisions detected via `canvasSlugFromRel` (the ONE authority — never re-derive slugging). Losers move to `_trash/` (the established gitignored quarantine, DDR-115), never deleted.

## Metadata

- **Type**: Bug Fix (data migration)
- **Complexity**: Medium
- **Depends on**: sync-2
- **Parallel with**: sync-4, sync-5
- **Affected Files**: `apps/studio/sync/migrate-flat-fallback.ts` (new), `apps/studio/sync/index.ts` (boot wiring), `apps/studio/test/sync-migrate-flat-fallback.test.ts` (new)

## Must-read before implementing (parallel, at start)

- `apps/studio/sync/migrate-seed.ts` (whole) — the one-shot boot migration pattern to mirror (idempotent, best-effort, logs what it moved, never throws into boot).
- `apps/studio/sync/canvas-path.ts` — `canvasSlugFromRel(rel, designRel)` for collision detection.
- `apps/studio/sync/index.ts` ~L1030-1065 — reconcile/migrate boot, where the hook goes.

---

## Tasks

### Task 1: CREATE `sync/migrate-flat-fallback.ts`

- **Do**: At sync boot, scan the design root for `<slug>.tsx` files sitting directly at `<designRoot>` (not in a canvas group) that slug-collide with an existing grouped file of the same slug. For each collision, move the design-root copy (+ its `.meta.json`/`.css` siblings) to `_trash/<slug>-flat-<ts>/`. Log one line per move.
- **Pattern**: `sync/migrate-seed.ts` — idempotent, best-effort, never throws into boot. Collision test via `canvasSlugFromRel`.
- **Gotcha**: only move when a grouped twin EXISTS (the design-root file is the redundant one). A design-root file with NO grouped twin is a genuinely-flat canvas — leave it (fix 5 + a future re-sync relocates it; deleting it would lose work). Idempotent: a second boot finds nothing to move.
- **Validate**: unit test (Task 3).

### Task 2: WIRE into sync boot

- **Do**: Call the migration from `apps/studio/sync/index.ts` boot, once, before the first reconcile.
- **Pattern**: the same call-site shape `migrate-seed.ts` uses.
- **Validate**: boot with a dirty fixture tree → migration runs once, sync proceeds normally.

### Task 3: ADD `test/sync-migrate-flat-fallback.test.ts`

- **Do**: Three cases — a collision pair → design-root copy trashed (with siblings), grouped kept; a lone flat file → untouched; second run → no-op.
- **Validate**: `cd apps/studio && bun test test/sync-migrate-flat-fallback.test.ts` green.

---

## Validation

1. **Static**: `pnpm lint`
2. **Tests**: `cd apps/studio && bun test test/sync-migrate-flat-fallback.test.ts` (+ full `bun test`) — guard `git status apps/studio/dist/` before AND after.
3. **Live check** (alligators project with real duplicates): boot → stray `ui-*.tsx` flat copies land in `_trash/<slug>-flat-<ts>/`, grouped twins intact, tree matches cloud; second boot is a no-op.

## Acceptance Criteria

- [x] Collision pairs migrated to `_trash/` (never deleted); `.meta.json`/`.css` siblings travel together ✅ 2026-08-10 (`sync/migrate-flat-fallback.ts`; annotations sidecar deliberately stays — keyed by flat slug, serves the surviving twin)
- [x] Lone flat canvases untouched; second run no-op; boot never throws from the migration ✅ (6 unit cases + boot-integration case in sync-path-pull)
- [x] One log line per move ✅
- [x] Tests green; touched-files lint clean; no two files resolve to one slug afterwards ✅ (13 pass sync-path-pull, 6 pass migrate tests; dist clean)

> Execution note: wired into `createSyncRuntime` BEFORE `scanCanvases` (a surviving twin would sync as its own document and re-seed the duplicate), and SKIPPED under cell pairing — a cell's checkout is the hub's to manage.
