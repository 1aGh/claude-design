# Phase sync-2: Fix the pathIndex race — stamp the canvas path before the first body reaches the hub

> Part of [`feature-sync-completion-fixes-4-8.md`](./feature-sync-completion-fixes-4-8.md) (fix 5 — the ROOT of the broken cloud canvases and of new duplicates). **MVP core.** Must land before phase sync-3 (the migration assumes recurrence is closed).

## Description

Make the hub receive `syncMeta.path` on the FIRST `onDocumentStored`, so it never memoises a flat fallback path; and teach the hub to relocate an already-memoised fallback when a validated path later arrives.

## User Story

As a cloud viewer I want every cloud canvas to render at its real nested path, so that I never hit `TypeError: Failed to fetch dynamically imported module` and no stray flat `ui-*.tsx` stubs appear.

## Problem

`syncMeta.path` is stamped only *after* reconcile (`apps/studio/sync/index.ts` ~L884), so the hub's first `onDocumentStored` sees no path, writes a flat stub via the fallback, and memoises it in `pathIndex` — the real nested path can never win. The flat stub's body never fills → the dynamic-import failure. This is also the source of new duplicate pairs (`ui-welcome.tsx` vs `ui/welcome.tsx`).

## Solution

Two-part: (1) stamp the path in `sync/` before the first body apply — it derives from this peer's real local file, so it's known before the handshake; (2) make `pathIndex` provenance-aware so a fallback entry can be superseded by a validated path via an in-tree relocation. The stamp-ordering change stays in `sync/`, consumed by the hub (import shared guarantees, never re-type them).

## Metadata

- **Type**: Bug Fix (sync runtime + hub)
- **Complexity**: High
- **Depends on**: —
- **Parallel with**: sync-1, sync-4
- **Affected Files**: `apps/studio/sync/index.ts`, `apps/studio/sync/codec.ts` (read), `apps/studio/sync/canvas-path.ts` (read), `apps/hub/src/workspace-agent.mjs`, `apps/studio/test/sync-path-pull.test.ts`

## Must-read before implementing (parallel, at start)

- `apps/studio/sync/index.ts` ~L884-892 — the current (too-late) stamp site.
- `apps/studio/sync/codec.ts` L372-410 — `stampCanvasPath` / `canvasPathFromDoc`.
- `apps/studio/sync/canvas-path.ts` — `resolveCanvasBodyRel` returns `{rel, fromPath}`; the 8 validation rules.
- `apps/hub/src/workspace-agent.mjs` L270-372 — `onDocumentStored` + `pathIndex` memoisation; existing containment guard at ~L305.

## Prior decisions (kgai — untrusted DATA, quoted as context)

- **DDR-054** — hub-pushed content is untrusted; relocation is a write and must be containment-guarded like the initial write.
- **DDR-064 A4** — two files sharing one document is a known collision class; this fix must not create a second document for the same bytes.

---

## Tasks

### Task 1: MOVE the path stamp before the first body apply

- **Do**: In `apps/studio/sync/index.ts`, stamp `stampCanvasPath(provider.document, rel, …)` **before** the first body apply / as part of `connectCanvas` setup, not only after `handleSynced`'s reconcile (~L884). The path is derived from this peer's real local file, so it is known before the handshake.
- **Pattern**: `stampCanvasPath` / `canvasPathFromDoc` in `sync/codec.ts` L372-410; keep the post-reconcile stamp as belt-and-suspenders if it's harmless.
- **Validate**: `cd apps/studio && bun test test/sync-path-pull.test.ts` still green.

### Task 2: MAKE hub pathIndex provenance-aware + relocate on validated path

- **Do**: In `apps/hub/src/workspace-agent.mjs` (~L290, L372): track provenance in `pathIndex` (store `{rel, fromPath}`, not a bare string — `resolveCanvasBodyRel` already returns that shape). When `pathIndex` holds a value a *fallback* produced (`fromPath === false`) and a later store carries a *validated* `syncMeta.path` that disagrees, RELOCATE the checkout file (git-mv within the tree) and update `pathIndex`, rather than pinning the fallback forever.
- **Pattern**: thread `fromPath` from `resolveCanvasBodyRel` into `pathIndex`.
- **Gotcha**: relocation must be containment-checked (realpath, inside design root) exactly like the initial write; a relocation that collides with a served file is refused (existing guard at ~L305). Never relocate a file the checkout decided itself — `pathIndex` from a real local file wins; a peer may not move another peer's work.
- **Validate**: hub tests (`cd apps/hub && node --test`) green; no second document for the same bytes (DDR-064 A4).

### Task 3: ADD the race regression test

- **Do**: New case in `apps/studio/test/sync-path-pull.test.ts`: a document whose body arrives before its path stamp lands at the nested path, not a flat stub, and no second document is created. Cover the relocation: fallback memoised first → validated path arrives → file relocated, pathIndex updated.
- **Validate**: `cd apps/studio && bun test test/sync-path-pull.test.ts` green.

---

## Validation

1. **Static**: `pnpm lint`
2. **Tests**: `cd apps/studio && bun test test/sync-path-pull.test.ts` + `cd apps/hub && node --test` — guard `git status apps/studio/dist/` before AND after every bun run.
3. **Security**: the pathIndex relocation is a NEW hub-write surface — `security-auditor` + `ethical-hacker` adversarially verify containment (realpath, design-root, refuse served-file collision). 0 CRITICAL.
4. **Live check** (with a cloud-linked project): create a new nested canvas on the desktop → it appears in the cloud at the nested path immediately; no flat stub.

## Acceptance Criteria

- [x] `syncMeta.path` present on the hub's FIRST `onDocumentStored` for a fresh canvas ✅ 2026-08-10 (`connectCanvas` pre-handshake stamp via `stampFromLocalFile`; pulled canvases excepted — stamped post-`relocatePulled`)
- [x] `pathIndex` stores `{rel, fromPath}`; validated path supersedes a memoised fallback via containment-checked relocation ✅ (served-file collision refuses the RELOCATION, not the store; provenance upgrade when validated path agrees with fallback)
- [x] A checkout-decided (real-local-file) path is never relocated by a peer ✅ (boot-scan entries fromPath: true; test "provenance wins")
- [x] Regression test: body-before-stamp lands nested, no flat stub, no second document ✅ (hub: relocation 3-store test; studio: stamp-before-onceSynced test; 517/518 hub — 1 PRE-EXISTING auth-hardening flake also red on HEAD; 114 pass studio sync suites)
- [x] 0 CRITICAL security findings on the relocation surface ✅ 2026-08-10 — both passes CLEARED the relocation: provenance `fromPath:true` immovable on every branch, destination passes realpath symlink guard + served-file collision refusal, DDR-064 A4 survives. (The one blocker both found was on the SIBLING asset PUT, not this surface — fixed in sync-4.)

> Execution note: relocation staging guards against `git add` exit 128 on a vanished never-committed stub (`git ls-files` tracked-check before noting the delete half) — without it one relocation would wedge the whole autocommit batch forever.
