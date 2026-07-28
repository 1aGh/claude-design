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

- [ ] Two-machine round-trip: edit on A → autosave commit on server → "Get latest" on B
- [ ] 60 MB asset lands in R2/MinIO, resolves cross-machine, absent from git
- [ ] kill -9 recovery proven; force-push impossible by construction
- [ ] Export/Chromium unreachable in workspace mode (boot-assert)
- [ ] `desktop-e2e` `workspace-sign-in` green; `/flow:validate-security` pass
