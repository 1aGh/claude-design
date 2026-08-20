---
name: before-first-external-users
status: in-progress
created: 2026-08-20
decisions:
  - kg:maude/debate-v1-gate-set (round 4 — this block is the BINDING half of the deferral)
---

# Feature: Before first external users (binding debt from the v1.0.0 gate)

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports.

## Description

The five items round 4 traded out of the v1.0.0 gate **only because Maude has
zero external users today**. Per the backlog's own acceptance criteria, every
item here completes (or carries a recorded, dated waiver) BEFORE any release is
promoted to a real external population. Source: `feature-post-1.0-hardening-backlog.md`
§ "Before first external users".

## Metadata

- **Type**: Hardening / consent UX / security review
- **Complexity**: High (block), Medium per task
- **App/Package**: apps/studio (sync + client), apps/hub

## Tasks

### Task 1 — A7 notices reach a human (UI, not terminal)

The DDR-064 A7 shared-doc notice and the DDR-079 TSX-bodies notice are
`console.warn`s (`apps/studio/sync/index.ts` — `noticeSharedDocOnce` and the
`syncTsx` block) that a terminal-free desktop user never sees. Binding before
Increment 8 (after the relay deletion there is no two-doc fallback).

- [x] Add `notices[]` to `SyncStatusPayload` (`sync/status.ts`) — `{ id, text,
      severity }`, additive so old payload readers keep working (same rule as
      `cold-start-hub-wins`).
- [x] Reorder `start()` so the status store exists before the notice sites;
      route both warns through `store.notice(...)` (keep the console.warn too —
      the terminal is still a valid surface).
- [x] Render notices in `client/panels/SyncPanel.jsx` with per-notice dismiss
      persisted per (notice id, hub url) — a machine-local ack, mirroring the
      `mdcc-whatsnew-seen` convention.
- [x] Tests in the required sync lane (`test/sync-*.test.ts`): payload carries
      the notice; cell-pairing suppression still holds; dismiss round-trip.
- [x] Rebuild the committed client bundle release-minified (CLAUDE.md rule).

### Task 2 — Consent / first-upgrade dialog + UI toggles

`syncFiles` / `propagateDeletes` / `resolveFirstAnchor` have no UI control
anywhere in `client/` — every breaker remediation string tells the user to edit
`linkedHub.*` JSON (round-4 ADVOCATE finding).

- [x] Sync panel settings section: read-write toggles for the three keys via a
      server route that edits `.design/config.json` (config hot-reload exists —
      DDR-149).
- [x] First-upgrade consent dialog: when a project's hub link would turn on
      `sharedDoc`/`syncFiles`/`propagateDeletes` for the first time on this
      machine, ask once in the UI (accept / keep off), recording the answer.
- [x] Surface per-file doručenka rows in the Sync panel (aggregates-only
      today).
- [x] Adopt/detach desktop dialog (CLI-only today; DDR-177 posture — the
      target user never opens a terminal).

### Task 3 — `_trash/` retention + findable restore (F-6)

- [ ] Index: a `_trash/index.json` (or listing route) with source path, reason,
      timestamp per quarantined file.
- [ ] Retention: prune entries older than a configurable window (default ≥ 30
      days) — never silently on boot; report what was pruned.
- [ ] Restore: a Sync-panel list with one-click restore; product copy stops
      pointing at a hidden gitignored folder.

### Task 4 — OIDC AppSec pass

The hub browser-auth door (`handleOidc` + `oidc*.mjs`) needs its own AppSec
pass; a prior re-review found two "closed" blockers that weren't (grep green
while `/admin/api/oidc/*` 404'd). Until done, OIDC stays labeled **beta**.

- [ ] Full defender + adversarial review of the OIDC surface, findings tracked
      to closure with regression tests that FAIL first (memory: two tests once
      passed against the bug they guarded).
- [ ] Route-reachability assertions (the 404-while-grep-green class).
- [ ] Drop the beta label only when the pass is recorded.

### Task 5 — Hub-trust findings burn-down

From the inherited list: F-4 (READ judges scope on lexical path, class on
real), F-7/F-8/F-14 (`handleDelete` confirm semantics, seq echo,
`x-maude-expect-hash: none` ambiguity), F-11/F-12 (re-anchor storm recovery,
poke cooldown on reconnect), B6 (tombstone under degraded epoch), B11
(`settleOwnership` mutates `.gitignore`/index without asking in non-TTY), B13
(`parkedRemote` never expires), B14/B15 (DELETE precondition optional; session
tokens wildcard-scoped; scope prefix matching vs file paths).

- [ ] Each finding: fix + fail-first regression test, or a recorded rejection
      with rationale. Nothing exits the list silently.

## Validation

Per task: `bun test test/sync-*.test.ts` (required lane) + full studio suite
locally; Task 1/2 UI diffs additionally need the client bundle rebuild + a
desktop-e2e or `/design:smoke` pass per the smoke gate triggers. Tasks 4–5:
security fan-out (defender + adversarial) on the diff.

## Acceptance Criteria

- [ ] Every A7-class notice is visible in the product UI, not only the terminal
- [ ] All three sync toggles operable from the UI; first-upgrade consent asked once
- [ ] `_trash/` is discoverable, restorable, and pruned with a report
- [ ] OIDC pass recorded; beta label removed or retained by explicit decision
- [ ] Hub-trust list empty or every remaining item carries a recorded rejection
- [ ] Increment 8 (relay deletion) unblocks only after Task 1 ships in a release
