# Cloud Phase 1 — Decisions + safety gates (DDRs, DDR-122 origin-gate, hub namespace)

Part of the Maude Cloud arc — read `cloud-phase-0-economics-and-architecture.md` first. Nothing else in the arc may start before this phase's gates pass (breaker precondition: "superseding DDRs written before code"; "flat slugs + autosave = silent data loss").

## Description

Record the architecture on paper before touching code, land the one open HIGH security fix the whole arc depends on, and give the hub a repo/branch document namespace.

## Metadata

- **Type**: Refactor + Decision records | **Complexity**: Medium
- **App/Package**: `.ai/archive/decisions/`, `apps/studio/sync` + `collab`, `apps/hub`
- **Dependencies**: none (arc entry point)

## Context References

### Must-Read Files

> Read in parallel in a single message during `/flow:execute`.

- `.ai/plans/cloud-phase-0-economics-and-architecture.md` — the decided architecture this phase records
- `.ai/archive/decisions/DDR-110-three-lane-collaboration-model.md`, `DDR-119*`, `DDR-109*`, `DDR-053*`, `DDR-054*`, `DDR-122*`, `DDR-123*`, `DDR-125*` — the decisions being superseded/amended/reaffirmed
- `apps/studio/sync/index.ts` (lines 568, 1083-1095) — flat-slug docName (`slugFor`) the namespace replaces
- `apps/studio/collab/` + DDR-122's "Follow-up: origin-gate canvas-injected doc ops" — the named-but-undone fix
- `apps/hub/src/server.mjs` (lines 181-246, 503-504) — `onAuthenticate` + the "no repo/branch concept" comment
- `apps/hub/src/tokens.mjs` (lines 242-246, 265) — prefix-scope semantics the namespace finally makes useful

## Tasks

### Task 1: CREATE umbrella DDR "Remote workspace server architecture"

- **Do**: Supersede/amend on the record: DDR-110 (S3 binary lane additive; server-owned checkout as workspace authority; vocabulary contract untouched), DDR-119 (server-owned checkout dissolves the "rewriting a dev's tree under their hands" hazard — the affirmative argument; no `$EDITOR` endpoint ever), DDR-053 (user identity will mint peer tokens; admin Bearer unchanged), DDR-123/125 reaffirmed + hard boundary **no chat surface in any browser UI**, DDR-079 terminal banner → UI disclosure.
- **Gotcha**: DDR numbering races on shared main — check the decisions dir AND uncommitted README index diff before numbering, re-check before commit.
- **Validate**: `/flow:record-ddr` (kg ingest fires automatically — repo is kgai-active).

### Task 2: CREATE umbrella DDR "Maude Cloud — tenant cells + containment invariant"

- **Do**: Record: Cloudflare end-to-end — Workers control plane + Containers data plane + R2 (Fly = named fallback if Containers limits bite; AWS estate = enterprise-residency alternative; per the Phase-0 cost math); **containment invariant** — *no tenant-authored TSX is ever evaluated by vendor-operated compute; cells run sync + git + asset storage only; if a future feature needs to break this, Direction B (structured non-executable synced unit) becomes its hard prerequisite*; operator-trust posture (encryption at rest, no-standing-access + break-glass with customer-visible audit, DDR-054 disclosure inside signup, DPA + subprocessors, hard-delete SLA, eu region); tenant state machine `pending → active → past_due → suspended(30 d) → exported → purged` with export-before-teardown guarantee; DDR-110 vocabulary amendment (**ban `repo`/`repository`/`GitHub username` on purchase/create/invite paths**); the open reversal of the public "no SaaS tier" promise; controller/processor split for invitees (GDPR — presence/awareness is personal data of people who signed nothing).
- **Validate**: `/flow:record-ddr`.

### Task 3: UPDATE sync — origin-gate canvas-injected doc ops (DDR-122 follow-up)

- **Do**: Implement the named open fix: Y.Doc ops originating in the canvas realm must not reach the hub-synced body doc unless they came through the shell's sanctioned edit path.
- **Pattern**: frozen origin sentinels in `apps/studio/collab/`; DDR-063 dual-lock.
- **Gotcha**: don't break legitimate `useCollab()` for same-machine boards. Run `git status apps/studio/dist/` before AND after `bun test` (dist-clobber gotcha).
- **Validate**: new `bun test` proving a canvas-realm-origin op is rejected; existing sync suite green.

### Task 4: UPDATE hub + sync — repo/branch document namespace

- **Do**: docName becomes `ws/<workspace-id>/<branch>/<slug>`; client passes repo/branch context on connect (phase-30 discovery note); hub groups `/admin/api/canvases` by it; token prefix-scopes (DDR-053) now mean "workspace-scoped" naturally. Feature flag `MAUDE_HUB_NAMESPACED=1` (default on in workspace mode, off for legacy hubs); legacy flat-slug shim.
- **Gotcha**: namespacing changes doc identity — cold-start must treat a fresh namespaced doc as "not seeded yet" (DDR-076), never clobber local files.
- **Validate**: `apps/hub/test/namespace.test.mjs` + full sync suite green.

## Exit gate

- [ ] Both DDRs recorded (before any later-phase code lands)
- [ ] Origin-gate test green; canvas-realm op provably rejected
- [ ] Namespace tests green incl. the fresh-doc-never-clobbers case
- [ ] `pnpm --filter @maude/site gen:roadmap` diff committed
