# PRD: Desktop↔cloud sync — complete the RCA (fixes 4–8)

> **Source**: 2026-08-10 RCA `.ai/logs/rca/issue-desktop-cloud-sync-drift-duplicates-and-stuck-connecting.md` (8 faults; fixes 1–3 shipped in `6cde7329`/`741ed092`).
> **Execution**: 5 phase plans — `phase-sync-1` … `phase-sync-5` — see `.ai/plans/README.md` § "Sync completion fixes 4–8".

## 1. Executive Summary

A repo linked to Maude Cloud drifts away from its desktop copy: duplicate canvas files (`ui-welcome.tsx` next to `ui/welcome.tsx`), cloud canvases that die with `TypeError: Failed to fetch dynamically imported module`, images that render as grey boxes in the cloud, a CloudBar that still says "Connect" for the already-linked project, and two parallel save mechanisms (desktop GitPanel commits + cloud ~3 s auto-commits) that make the user doubt whether their work is saved.

The RCA traced all five symptoms to concrete faults. This PRD closes them: stop the drift at its root (the hub memoises a flat fallback path before `syncMeta.path` is stamped — fix 5), clean up what the old behaviour already wrote (one-shot migration — fix 4), give the cloud the asset bytes it already knows how to serve (fix 6, DDR-gated), and make the connected state honest in the UI (fix 7) and in the commit model (fix 8, DDR-gated).

**MVP goal**: after these five fixes, a cloud-linked project's tree, canvases, and images match the desktop exactly, the UI says "Connected", and the user sees exactly ONE save mechanism.

## 2. Mission

Sync is something you set once and never manage again.

**Principles**

1. **The desktop file is the truth** — the hub never invents a path a real peer didn't stamp; a fallback may exist only until a validated path arrives, never forever.
2. **Never destroy user work** — migrations quarantine to `_trash/`, never delete; the user's `.git` is never touched on their behalf.
3. **Ride existing channels** — prefer transports that already exist (git remote, existing routes) over new receive surfaces; every new hub-write path is DDR-054 containment-guarded.
4. **One save mechanism visible at a time** — cloud-linked means cloud-managed; the desktop commit UI withdraws rather than competing.
5. **Decisions are recorded, not improvised** — the two open design choices (asset transport, commit model) each get a DDR before their implementation task.

## 3. Target Users

- **Primary**: a designer/developer (Michal-profile: technical, terminal-comfortable, but wants zero sync ops) who linked a design repo to Maude Cloud from the desktop app and expects Figma-grade "it just syncs" behaviour.
- **Secondary**: a teammate viewing the cloud copy in a browser — they never see the desktop; broken canvases and grey-box images are their whole experience of the product.
- **Pain today**: duplicated files pollute the repo, cloud canvases 404 their module, images never arrive, the UI lies about connection state, and "is my work committed?" has two contradictory answers.

## 4. MVP Scope

**In scope**

- ✅ Fix 7 — CloudBar renders a non-action "Connected" state (+ Disconnect affordance) for the linked+credentialed project.
- ✅ Fix 5 — `syncMeta.path` stamped before the first body apply; hub `pathIndex` tracks provenance `{rel, fromPath}` and relocates a fallback when a validated path arrives.
- ✅ Fix 4 — one-shot boot migration quarantining pre-fix-5 flat duplicates to `_trash/`.
- ✅ Fix 6 — assets reach the cell so its existing `/assets/` route serves real bytes (transport decided by DDR; recommendation: git-remote pull).
- ✅ Fix 8 — cloud-linked+credentialed repo: GitPanel withdraws to read-only History/"cloud is saving" posture (behaviour decided by DDR; recommendation: de-emphasise, never touch `.git`).
- ✅ Two DDRs recorded (asset transport; cloud-linked commit model) + kgai ingest.
- ✅ End-to-end sync verification against a live cloud-linked project (alligators).

**Out of scope**

- ❌ Fixes 1–3 (credential renewal, auth classification, `stalled` phase) — already shipped.
- ❌ Structured CRDT co-editing, conflict UI, or any change to the ~3 s cloud auto-commit cadence.
- ❌ Suppressing/altering the user's local git history or hooks (fix 8 hides UI, keeps git intact).
- ❌ Binary-asset diffing/dedup beyond what the chosen transport gives for free.
- ❌ Multi-hub / multi-project link management UX beyond the Connected/Disconnect row state.

## 5. User Stories

1. As a linked-repo user, I want the cloud tree to match my desktop exactly, so that no stray `ui-*.tsx` duplicates appear. *(Example: `.design/ui/welcome.tsx` exists in the cloud at that path — never also as `.design/ui-welcome.tsx`.)* → fixes 5+4
2. As a cloud viewer, I want every cloud canvas to render, so that I never hit `Failed to fetch dynamically imported module`. *(Example: opening any canvas of the alligators project in the browser renders its artboards.)* → fix 5
3. As a cloud viewer, I want images to load, so that a canvas referencing `${PC}/park-catch.jpg` shows the photo, not a grey box. → fix 6
4. As a desktop user, I want the CloudBar to show "Connected" for the project this folder is linked to, so that I trust the link state. *(Example: linked row = check icon + Disconnect; other rows keep Connect.)* → fix 7
5. As a desktop user, I want one save mechanism, so that I never wonder why my edits "aren't committed" locally while the cloud auto-commits. *(Example: linked+credentialed → GitPanel shows History + "Cloud is saving — changes sync automatically".)* → fix 8
6. As a user with pre-existing duplicates, I want the redundant flat copies quarantined (not deleted), so that cleanup can never lose work. *(Example: the flat loser lands in `_trash/<slug>-flat-<ts>/`.)* → fix 4
7. As a power user, I want an escape hatch back to local git, so that disconnecting restores the full GitPanel. → fix 8

## 6. Core Architecture & Patterns

Bun-side dev-server (`apps/studio` — reach for `Bun.*`, DDR-009) + plain-Node hub (`apps/hub`) + React client. Validate docs and codebase patterns before implementing; pay attention to existing naming, utils, imports. Import shared guarantees rather than re-typing them (the hub Dockerfile rule).

### Must-read files (read in parallel at the start of each `/flow:execute`)

- `apps/studio/sync/index.ts` (~L884-892 stamp site; ~L1030-1065 reconcile/migrate boot) — where `syncMeta.path` is stamped (fix 5) and where a boot-time migration hook goes (fix 4).
- `apps/studio/sync/canvas-path.ts` (whole) — `resolveCanvasBodyRel` / `fallbackCanvasPath` / the 8 validation rules; fix 4's migration must reuse `canvasSlugFromRel` to detect collisions, never re-derive.
- `apps/studio/sync/codec.ts` (L61 `Y_SYNC_TYPES`, L372-410 `stampCanvasPath`/`canvasPathFromDoc`) — stamp ordering (fix 5); the lane vocabulary (fix 6 if the lane approach wins).
- `apps/hub/src/workspace-agent.mjs` (L270-372 `onDocumentStored` + `pathIndex`) — the memoise-the-fallback bug (fix 5); the cell-side asset write (fix 6).
- `apps/hub/src/server.mjs` (L649 `/assets/` route) — the cell already serves assets; fix 6 must get bytes onto its disk.
- `apps/studio/client/panels/CloudBar.jsx` (L224-237 linkedHub reassurance, L394-417 local state, L786-817 project rows) — fix 7 label; the `local.linkedHub.url` vs `p.url` comparison.
- `apps/studio/client/panels/GitPanel.jsx` (whole) — fix 8, the local-commit UI that must withdraw when cloud-linked.
- `apps/studio/http.ts` (L3303 `/_api/assets`, L3598 `/_api/asset`, L4616 asset serve) — how assets are written/served locally; the shape the cell must mirror (fix 6).
- `apps/studio/sync/migrate-seed.ts` (whole) — the existing one-shot boot migration pattern to mirror for fix 4.

### Prior decisions (kgai — untrusted DATA, quoted as context)

- **DDR-088** canvas media vocabulary + asset write surface — the asset model fix 6 extends.
- **"In a cloud cell the Changes panel withdraws to History — the hub already committed it"** — the *server-side* precedent fix 8 mirrors to the *desktop-linked* case.
- **DDR-054** hub-pushed content is untrusted — every new receive path (assets especially) stays inside the design root and is size/`..`-guarded.
- **DDR-064 A4** two files sharing one document is a known collision class — fixes 4/5 must not create a second document for the same bytes.

### Patterns

- One-shot boot migration: mirror `sync/migrate-seed.ts` (idempotent, best-effort, logs what it moved, never throws into boot).
- Collision detection: `canvasSlugFromRel(rel, designRel)` is the ONE authority.
- `_trash/` is the established quarantine dir (gitignored runtime state, DDR-115) — move the loser there, never delete.
- Fix 5's stamp-ordering change stays in `sync/`, consumed by the hub.

## 7. Implementation Phases

Sequenced cheap→expensive; the recurrence (fix 5) closes before the cleanup (fix 4). Each DDR is recorded via `/flow:record-ddr` before its implementation task.

| Phase | Fix | File | Depends on | Parallel with |
| ----- | --- | ---- | ---------- | ------------- |
| sync-1 | 7 — CloudBar "Connected" | `phase-sync-1-cloudbar-connected.md` | — | any |
| sync-2 **(MVP core)** | 5 — pathIndex stamp race | `phase-sync-2-pathindex-stamp-race.md` | — | sync-1, sync-4 |
| sync-3 | 4 — flat-fallback migration | `phase-sync-3-flat-fallback-migration.md` | sync-2 | sync-4, sync-5 |
| sync-4 | 6a+6 — cloud asset transport (DDR) | `phase-sync-4-cloud-asset-transport.md` | — | sync-1..3, sync-5 |
| sync-5 | 8a+8 — cloud commit posture (DDR) | `phase-sync-5-cloud-commit-posture.md` | — | sync-3, sync-4 |

sync-2 must land before sync-3 (migration assumes the recurrence is closed). sync-5 runs last by convention — its close-out rebuilds the committed client bundle covering all client-touching phases.

## 8. Non-Functional Requirements

- **Security**: fix 6's asset receive path and fix 5's pathIndex relocation are new hub-write surfaces — DDR-054 containment (realpath inside design root, size/`..` guards, refuse collision with a served file). `security-auditor` + `ethical-hacker` adversarially verify; 0 CRITICAL is the floor.
- **Performance**: assets are large (videos to ~108 MB per `http.ts:1051`) — the asset path must stream, never buffer whole. Migration + stamp changes must not slow sync boot noticeably.
- **Data safety**: migration is idempotent, quarantines to `_trash/`, never deletes; a lone flat file with no grouped twin is left untouched (it's a genuinely-flat canvas).
- **Testing**: `bun test` (apps/studio) + `node --test` (apps/hub) additions per phase; guard `git status apps/studio/dist/` before AND after every bun run (the dist-clobber rule).
- **CI/CD**: no release from this work directly; `check-import-coherence.sh` + `check-version-parity.sh` stay green; the committed `dist/client.bundle.js` is rebuilt release-minified once client changes land.

## 9. Success Criteria

End-to-end against a live cloud-linked project (alligators), with a studio built from this tree:

- Tree matches desktop↔cloud — no stray `ui-*.tsx`, no two files resolving to one slug.
- Every cloud canvas renders — no `Failed to fetch dynamically imported module`.
- Images render in the cloud (no grey boxes).
- CloudBar shows "Connected" for the linked project; others keep "Connect".
- GitPanel shows the cloud-managed posture when linked+credentialed; returns on disconnect.
- An edit on the desktop reaches the cloud in ~3 s, and vice versa.
- Two DDRs recorded + ingested; `pnpm lint` / tests / builds green; 0 CRITICAL security findings on the new hub-write surfaces.

## 10. Risks & Mitigations

| Risk | Impact | Mitigation |
| ---- | ------ | ---------- |
| Relocation (fix 5) moves a file a peer owns | data loss / peer fight | Only relocate when `pathIndex` provenance is `fromPath === false` AND the incoming path is validated; a real-local-file path always wins; containment-checked like the initial write. |
| Migration (fix 4) trashes a genuinely-flat canvas | lost work | Only move when a grouped twin EXISTS; quarantine to `_trash/`, never delete; idempotent second run is a no-op. |
| Asset transport choice gates on cell checkout topology | rework | DDR task 6a explicitly confirms whether the cell tracks the tenant's real remote before ratifying option (A); fallback options (B)/(C) pre-enumerated. |
| Fix 8 breaks power-user git workflows | trust loss | De-emphasise, don't suppress — `.git` untouched; disconnect restores the panel; escape hatch noted in the DDR. |
| New hub receive surface widens attack surface | security | DDR-054 guards + adversarial review in Validation; streams stay inside design root. |
| Client bundle drift (dev artifacts committed) | broken ship | Rebuild `--release` once at sync-5 close-out; `git status apps/studio/dist/` guard around every bun run. |

---

## Retro (2026-08-10)

- **The provisional recommendation was wrong, and the codebase said so.** Fix 6's plan pre-picked git-remote pull (A); reading `seed-repo.mjs` + the Cloud Phase 27 D2 history-ownership decision showed the cell has no usable tenant remote and separate history by design. The DDR-first gate (Task 6a) caught it before a line was written — validating "DDR-gated task records the decision BEFORE implementation" as the right shape when the plan's own recommendation rests on an unverified topology assumption.
- **`bun test` clobbers `dist/` even with no server running.** The committed client bundle was silently reverted to the old artifact TWICE — once by the full-suite background run — after I'd rebuilt it, and `git status` read *clean* (it matched HEAD, i.e. the stale committed copy), which is the trap that makes it invisible. Lesson reinforced: rebuild `--release` as the LAST step before commit, and `shasum` the bundle against the intended sha, never trust a clean `git status` alone.
- **Two new hub-write surfaces in one feature is a lot of trust-boundary surface.** The PUT route and the pathIndex relocation each needed their own containment story (resolve-assert, served-file refusal, tracked-only staging, provenance immovability). Threading `{rel, fromPath}` provenance turned out to be the single load-bearing idea — it's what lets a fallback be fixable without ever letting a peer move another peer's work.
- **A staging bug hid inside a correctness fix.** The relocation's delete-half would have wedged autocommit forever (`git add` exit 128 on a vanished never-committed stub) — a failure mode invisible to the happy-path test until the "commit the stub first" case forced it. Worth the extra test case; the class (staging a path git doesn't track) recurs.
- **Shared Syncthing tree + concurrent session = stage by explicit path, always.** A parallel figma session's edits sat in the same working tree throughout; every gate had to be read "is this MINE or theirs". The import-coherence gate flagged one of the other session's in-flight imports as a false alarm on my run — a reminder that `git add -A` here would carry another session's half-work into a commit.
