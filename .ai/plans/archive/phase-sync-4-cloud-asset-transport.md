# Phase sync-4: Cloud asset transport — DDR + implementation

> Part of [`feature-sync-completion-fixes-4-8.md`](./feature-sync-completion-fixes-4-8.md) (fixes 6a + 6). **DDR-gated**: Task 1 records the decision via `/flow:record-ddr` BEFORE Task 2 implements it. Recommended approach is pre-decided (git-remote pull) so execution runs in one pass.

## Description

Get tenant assets (`<designRoot>/assets/*`) onto the cell's disk so its existing `/assets/` route (`apps/hub/src/server.mjs:649`) serves real bytes instead of grey boxes.

## User Story

As a cloud viewer I want images to load, so that a canvas referencing `${PC}/park-catch.jpg` shows the photo, not a grey box.

## Problem

The sync lanes are `html`/`css`/`meta`/`syncMeta` only — there is no asset lane, so `<designRoot>/assets/*` never reaches the cell, while the cell's `/assets/` route already exists and serves bytes it doesn't have.

## Solution

DDR first (Task 1), then implement the ratified option (Task 2). Recommendation: **(A) git-remote pull** — assets are already git-tracked locally (RCA confirmed 30+ files in `.design/assets/`), so riding the channel they already live on is the least new surface.

## Metadata

- **Type**: New Capability (asset transport) — DDR-gated
- **Complexity**: High (binary transport considerations; new DDR-054 surface if B/C wins)
- **Depends on**: — (independent; parallel with sync-1..3, sync-5)
- **Affected Files**: `.ai/archive/decisions/DDR-NNN-cloud-asset-transport.md` (new), then per-DDR: `apps/hub/src/workspace-agent.mjs` / `apps/hub/src/server.mjs` / possibly `apps/studio/sync/codec.ts` (lane vocabulary) — plus a hub/cell test
- **Dependencies**: none for (A); a transport dep only if (B) wins — decided in the DDR

## Must-read before implementing (parallel, at start)

- `apps/hub/src/server.mjs` L649 — the existing `/assets/` route.
- `apps/hub/src/workspace-agent.mjs` — the cell-side checkout (`ensureRepo`) + where a cell write would land.
- `apps/studio/http.ts` L3303 `/_api/assets`, L3598 `/_api/asset`, L4616 asset serve — how assets are written/served locally; the shape the cell must mirror.
- `apps/studio/sync/codec.ts` L61 `Y_SYNC_TYPES` — the lane vocabulary (only relevant if (B) wins).

## Prior decisions (kgai — untrusted DATA, quoted as context)

- **DDR-088** — canvas media vocabulary + asset write surface; the asset model this fix extends.
- **DDR-054** — hub-pushed content is untrusted; every new receive path stays inside the design root and is size/`..`-guarded.

---

## Tasks

### Task 1: RECORD DDR — cloud asset transport (`/flow:record-ddr`)

- **Do**: Run `/flow:record-ddr` for "how tenant assets reach the cell." Enumerate the options and ratify the recommendation:
  - **(A) recommended — git-remote pull**: the cell already `ensureRepo`s a checkout; if the tenant's `assets/` are committed to their git remote, the cell obtains them by pulling that remote (or the desktop pushes assets as part of its existing git flow and the cell pulls). No new transport, no binary-over-Yjs. Assets ride the channel they already live on (git).
  - **(B) new content-addressed asset lane**: a side channel (not Yjs text) carrying `assets/<sha8>.<ext>` bytes desktop→hub, written into the cell checkout. Heavier; binary transport; new DDR-054 receive surface.
  - **(C) cell-side lazy fetch**: `/assets/` route 404 → cell fetches the blob from a tenant-scoped store on demand.
- **Decision driver**: assets are already git-tracked locally, so (A) is the least new surface and the most consistent with "the git remote is the project." **Confirm whether the cell checkout tracks the tenant's real remote or a hub-owned repo — that gates (A).**
- **Validate**: DDR file written + ingested (`maude kg import --only "DDR-NNN"` or graph-native record).

### Task 2: IMPLEMENT the chosen transport

- **Do**: Per the DDR. For (A): ensure `assets/` is in the synced git set and the cell pulls it on checkout/refresh; verify the existing `/assets/` route then serves real bytes. For (B)/(C): build the lane/fetch and wire the cell write, containment-guarded (DDR-054).
- **Gotcha**: assets are large (videos to ~108 MB per `http.ts:1051`) — whatever the path, it must STREAM, not buffer whole; and stay inside the design root.
- **Validate**: a cloud canvas referencing `${PC}/park-catch.jpg` renders the image in the cloud, not a grey box. Add a hub/cell test that an asset committed on the desktop side is present on the cell's `/assets/` route.

---

## Validation

1. **Static**: `pnpm lint`
2. **Tests**: `cd apps/hub && node --test` (+ `cd apps/studio && bun test` if codec touched) — guard `git status apps/studio/dist/` around bun runs.
3. **Security**: the asset receive path is a NEW hub-write surface — `security-auditor` + `ethical-hacker` adversarially verify containment (design root, size/`..` guards, streaming). 0 CRITICAL.
4. **Live check**: images render in the cloud copy of the alligators project.

## Acceptance Criteria

- [x] DDR recorded + ingested BEFORE implementation ✅ 2026-08-10 — **DDR-217**: the (A)-gating question answered NO (cell strips/removes the tenant remote post-seed; histories deliberately separate per Cloud Phase 27 D2), so (A) is REFUSED and the ratified option is a desktop→hub PUT on the existing authenticated asset route (checkout → sweepNew → bucket, the browser-upload precedent)
- [x] Assets reach the cell: `PUT /assets/<key>` (token-gated, `ASSET_KEY`-validated, workspace-only) writes the checkout the studio child serves; `onWritten` mirrors to the bucket ✅
- [x] Transport streams (temp+rename, hard cap mid-stream aborts + removes partial — no whole-file buffering); containment resolve-assert per DDR-054 ✅
- [x] Tests: hub PUT suite (success/401/413-no-partial/traversal-unreachable, 16 pass) + studio `sync-asset-push` (HEAD-first sweep, live-token read, 5 pass) ✅
- [x] Adversarial security pass ✅ 2026-08-10 — both defender + attacker found ONE blocker (symlink traversal on the PUT: lexical containment only), independently. FIXED: extracted `realpathOfDeepestExisting`/`isContainedReal` to shared `apps/hub/src/path-contain.mjs` (imported by both hub writers — no re-typed guarantee), realpath-contain the PUT destination; + rate-limit on authenticated PUT, per-process write budget (F2), per-request temp nonce (F3), atomic detach config write (F5). Regression tests added. Verdict PASS, 0 open CRITICAL. Report: `.ai/logs/security-reviews/sync-fixes-4-8-{defender,attacker}.md` (gitignored).
- [ ] Live check (images render in the alligators cloud copy) — deferred to feature-level Validation §5 (needs a credentialed live link) before merge to a release tag

> Execution note: desktop sweep (`sync/asset-push.ts`) fires after boot handshakes settle, never under cell pairing, sequential + HEAD-first, retried free next boot. Hub-side `MAX_PUT_BYTES` mirrors `MAUDE_ASSET_MAX_VIDEO_BYTES`.
