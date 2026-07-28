# Cloud Phase 3 — Workspace agent + S3/R2 asset lane + desktop sign-in

Part of the Maude Cloud arc — read `cloud-phase-0-economics-and-architecture.md` first. Requires Phases 1–2.

## Description

The inversion that makes "remote Maude" real: a headless **workspace agent** owns a server-side git checkout and turns autosave into append-only commits; binary assets move to S3-compatible storage (R2) so heavy media stops bloating git; Maude Desktop gets the plain-words "Sign in to workspace" flow.

## Metadata

- **Type**: New Capability | **Complexity**: High
- **App/Package**: `apps/studio` (sync/workspace agent, assets), `apps/hub` (asset proxy), `apps/desktop` (sign-in)
- **Dependencies**: Phases 1–2 (namespace, users, backups). S3-compatible store (R2 prod / MinIO dev)

## Context References

### Must-Read Files

- `apps/studio/sync/agent.ts` (64, 529-536) + `fs-mirror.ts` + `projection.ts` — the autosave spine (debounces, fail-closed snapshots) the agent inherits verbatim
- `apps/studio/sync/cold-start.ts` (92-198) — decision table: empty remote ≠ authoritative blank (DDR-076); content-hash journal; comments id-union
- `apps/studio/sync/index.ts` (198-250, 365-372, 903-1018) — syncable set, accept-filter (assets excluded — the gap this phase closes), dual-lock
- `apps/studio/api.ts` (614-687, 1660-1783) — asset write path (caps, magic-byte sniff, dedupe) the S3 lane hooks into
- `apps/studio/sync/hub-link.ts` (43-109) — tokenless `/health` probe + link flow the desktop sign-in extends
- `apps/studio/exporters/index.ts` (164-175) — the self-SSRF export path that MUST be unreachable in workspace mode
- `cli/lib/gitignore-block.mjs` — managed gitignore block pattern (assets join it when S3 lane is on)

## Tasks

### Task 1: ADD server-side workspace agent (autosave = append-only commit)

- **Do**: Headless mode of the existing sync agent (`MAUDE_WORKSPACE_MODE=1`; no browser open, no exports): owns `/repo`, connects to the colocated hub as a peer (outbound WS — studio's loopback bind untouched), projects docs→disk on the existing 800 ms debounce, then quiescence-debounced `git add <touched> && git commit` (author = editing user's identity from presence; committer = workspace bot). **Never force-push.** On mirror-remote rejection: stop, snapshot, set a plain-words "someone else saved first" flag clients render. Server-local content-hash journal.
- **Pattern**: DDR-076 fail-closed snapshots — if the pre-overwrite snapshot doesn't land, refuse the destructive write.
- **Gotcha**: boot must **refuse** if export/Chromium routes are reachable in workspace mode (the containment invariant's first enforcement point).
- **Validate**: compose integration test — two clients edit → append-only commits with correct authorship; `kill -9` mid-autosave → no corruption, journal recovers.

### Task 2: ADD S3/R2 asset lane

- **Do**: `apps/studio/assets-s3.ts`: with `assets.s3` configured, `saveAsset` also PUTs to the bucket under `assets/<sha8>.<ext>` (content-addressed = idempotent); workspace agent adds a managed `assets/` gitignore block. Hub gains **authenticated** `GET /assets/<sha8>` proxy (peer token; streams; never presigned-URL-in-canvas — canvas CSP stays `img-src 'self'`). Desktop/studio: local miss + `linkedHub` → fetch from hub, cache locally. `maude hub asset-check`: every `assets/` reference in the repo resolves in the bucket (dangling-pointer integrity); never-GC documented; bucket lifecycle rules must be OFF for `assets/`.
- **Gotcha**: DDR-148's "video rides git and hub sync" line is wrong in code today — this task makes cross-machine media actually true; fix that DDR line in passing.
- **Validate**: `apps/studio/test/assets-s3.test.ts` (MinIO); 60 MB video → bucket not git; second machine resolves via hub proxy.

### Task 3: UPDATE desktop — "Sign in to workspace" + disclosure UI

- **Do**: URL paste → tokenless `/health` probe → login (system browser to hub login page → loopback token bridge, mirroring DDR-108/114 custody) → token to `~/.config/maude/hubs.json` (0600) / keychain on native; `linkedHub` written. Promote Onboarding "Door C" to first-class. Replace the DDR-079 *terminal* banner with a UI disclosure panel: who operates this workspace + what they can see (DDR-054 made visible).
- **Pattern**: `GitHubIdentity.tsx` plain-words vocabulary ("Sign in", "Connected" — never OAuth/token). DDR-110 contract everywhere.
- **Validate**: `desktop-e2e` scenario `workspace-sign-in` (DOM-driven, data-testid convention).

## Exit gate

- [x] **Export/Chromium unreachable in workspace mode (boot-assert)** — `apps/studio/workspace-mode.ts` + `scripts/check-containment.sh` in `quality.yml`. Verified live, not only in tests: with `MAUDE_WORKSPACE_MODE=1` the server first REFUSED to start against the real route table, naming 13 offending routes; with pruning it boots and `/_health` is 200 while `/_api/export`, `/_api/export-jobs`, `/_api/photo-edit`, `/_canvas-shell.html`, `/_canvas-runtime/*` and `/_ws/acp` all 404. Normal mode untouched (export still 405 — route present; canvas shell 200).
- [x] **Force-push impossible by construction** — `sync/autocommit.ts`. Tested against a real git repo + a real bare remote: a rejected push is reported, the other party's commit is still the remote tip afterwards, and the absence of any force flag is pinned as an argv assertion.
- [x] **Asset lane absent from git** — `assets-s3.ts` mirrors content-addressed assets to the bucket; `buildBlock({ s3Assets: true })` adds `<designRoot>/assets/` to the managed gitignore only when a bucket is configured. `maude hub asset-check` proves no reference dangles (found and fixed a real classification bug in the process — see DDR-195).
- [x] **Sign-in flow** — `sync/workspace-signin.ts` + `/_api/workspace/sign-in`, verified live against a running Phase-2 hub: wrong password and unknown user return byte-identical messages, an unreachable address is distinguished, correct credentials mint and store a session. The disclosure panel (DDR-192 §6) ships as data with the copy under test.
- [x] **Security review of the changed surface** — done inline (session constraint). The sign-in handler receives a password, so it is MAIN-ORIGIN + loopback + CSRF gated and the canvas-origin gate test now asserts it 403s *at the gate* rather than 405-ing from the handler.

**Deferred — need infrastructure or the desktop app, both blocked (see `cloud-phase-0b-manual-prep.md`):**

- [x] **Two-machine round-trip and kill -9 recovery — CLOSED 2026-07-29.** `apps/hub/test/two-machine-workspace.test.mjs`, 5 tests against a REAL hub over a real socket, with real files and a real git repository: an edit on A reaches B and lands on B's disk; the workspace commits it attributed to the human with the bot as committer; a second edit appends and the earlier state is still reachable; a severed connection mid-session loses nothing committed (`git fsck` clean, the pre-crash commit intact) and the in-flight edit is recovered from the hub's doc on wake; three peers converge.

  **The deferral was wrong, and the reason is worth keeping.** This was closed as "needs a compose harness running two studio processes". It does not: a hub, two peers and a git repo are all local, and Node 24 strips TypeScript natively, so the studio's own `sync/autocommit.ts` and `sync/codec.ts` import straight into a Node test. The cross-runtime boundary noted in `two-client-sync.test.mjs` applies to *running the hub under Bun*, not to importing studio modules under Node. The only item here that genuinely needed a vendor was 60 MB through R2 — a storage account, not a second machine.

  Mutation-checked rather than assumed: sabotaging `autocommit.ts` to credit the bot instead of the human turned two of the five red.
- [ ] 60 MB asset through R2 specifically — the code path is exercised against a live in-process S3-shaped server and is target-pluggable by design, but **R2 is not enabled on the account** (`10042 — Please enable R2 through the Cloudflare Dashboard`).
- [ ] `desktop-e2e workspace-sign-in` — the flow logic and its HTTP surface are done and live-verified; the Tauri UI that calls them is not built, so there is nothing for a DOM-driven scenario to drive yet.

**Status: CORE COMPLETE** (2026-07-28). Suites at close: `apps/studio` 3195/3195, `apps/hub` 198/198, `cli` 216/216. Decisions: **DDR-195**; DDR-148 corrected in place.

## Retro

- **Two live checks each found something no test could have.** Booting workspace mode against the real route table (the vocabulary was right; only reality proved the wiring) and running `asset-check` against this repo's own `.design/` (the real asset corpus has `<sha8>-<label>.mp4` and `<sha8>.photo.json` shapes; every fixture had the tidy one, so `verifyAssetBytes` would have refused legitimate assets). The pattern is clear enough to generalize: **run the new tool against the repo's own real data before believing the fixtures.**
- **"Prune, then assert over what survived" is the shape worth reusing.** It turns the boot-assert into a post-condition on the pruning rather than a second opinion that can drift. Any future invariant with both an enforcement point and a filter should be wired the same way.
- **Testing copy as copy paid off.** The no-jargon assertion on the disclosure and sign-in strings is the only thing standing between the target persona and a flow that says "bearer token". Worth doing on every invite-path surface in Phase 6.
- **The plan named MinIO as the test substrate; making the target pluggable removed the dependency with no loss of coverage** — same lesson as Phase 2. Plans should specify the property, not the substrate.
- **What `--quick` cost here:** the two-machine and desktop-e2e gates are genuinely undone, not skipped-and-forgotten. They are listed above as deferred with the reason, so Phase 5 (which needs a live cell anyway) is the natural place to close them.
