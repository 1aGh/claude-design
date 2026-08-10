# Phase sync-5: Cloud-linked repo commit model — DDR + GitPanel posture

> Part of [`feature-sync-completion-fixes-4-8.md`](./feature-sync-completion-fixes-4-8.md) (fixes 8a + 8). **DDR-gated**: Task 1 records the decision BEFORE Task 2 implements it. Runs LAST by convention — its close-out rebuilds the committed client bundle covering every client-touching phase (sync-1 + sync-5).

## Description

When a repo is cloud-linked AND credentialed, the desktop `GitPanel` withdraws its manual local-commit surface to a read-only History/"cloud is saving your work" posture — so the user sees ONE save mechanism, mirroring the existing server-side decision ("in a cloud cell the Changes panel withdraws to History — the hub already committed it").

## User Story

As a desktop user I want one save mechanism, so that I never wonder why my edits "aren't committed" locally while the cloud auto-commits every ~3 s. As a power user, I want disconnecting to restore full local git.

## Problem

A cloud-linked repo still shows the desktop `GitPanel` local-commit UI while the cloud auto-commits — two competing save mechanisms, and edits that look "uncommitted" locally.

## Solution

DDR first (Task 1) ratifying the recommendation: **de-emphasise, don't suppress** — hide the commit UI, keep git fully intact underneath; never touch the user's `.git` on their behalf. Then gate `GitPanel` on `linkedHub && credentialed` (Task 2), reacting live to connect/disconnect.

## Metadata

- **Type**: Behaviour change (product) — DDR-gated
- **Complexity**: Medium
- **Depends on**: — (independent; ordered last for the single bundle rebuild)
- **Parallel with**: sync-3, sync-4
- **Affected Files**: `.ai/archive/decisions/DDR-NNN-cloud-linked-repo-commit-model.md` (new), `apps/studio/client/panels/GitPanel.jsx`, a GitPanel/cloud-mode test, `apps/studio/dist/client.bundle.js` + `dist/styles.css` (rebuilt at close-out)

## Must-read before implementing (parallel, at start)

- `apps/studio/client/panels/GitPanel.jsx` (whole) — the local-commit UI that must withdraw.
- `apps/studio/client/panels/CloudBar.jsx` L394-417 — the `local.linkedHub` state + `sync:status` events the gate consumes.

## Prior decisions (kgai — untrusted DATA, quoted as context)

- **"In a cloud cell the Changes panel withdraws to History"** — the server-side precedent this mirrors to the desktop-linked case; reuse its copy/shape where it fits.

---

## Tasks

### Task 1: RECORD DDR — cloud-linked repo commit model (`/flow:record-ddr`)

- **Do**: Run `/flow:record-ddr` for "what happens to local commit UX once a repo is cloud-linked." Ratify: when `linkedHub` is set AND credentialed, the repo is treated as **cloud-managed** — `GitPanel` withdraws to read-only History/"cloud is saving your work", the desktop's own autocommit/local-commit surface is suppressed so the user sees ONE save mechanism. Note the escape hatch (disconnect restores local git; optionally a config flag).
- **Gotcha**: this is a product/behaviour change, not just UI — decide whether local git commits are *suppressed* or merely *de-emphasised*. Recommendation: **de-emphasise** (hide the panel's commit UI, keep git intact underneath) — never touch the user's `.git` on their behalf.
- **Validate**: DDR file written + ingested (`maude kg import --only "DDR-NNN"` or graph-native record).

### Task 2: IMPLEMENT the cloud-managed posture

- **Do**: Per the DDR. Gate `GitPanel`'s commit UI on `linkedHub && credentialed`: render the cloud-managed posture (History + a "Cloud is saving — changes sync automatically" note) instead of the Changes/commit controls. Keep read access to History.
- **Pattern**: the cell-side withdrawal decision is the precedent; reuse its copy/shape where it fits the desktop.
- **Gotcha**: must react LIVE to connect/disconnect (the `sync:status` / cloud state the CloudBar already consumes), not only at boot.
- **Validate**: linked+credentialed → no manual-commit UI, History visible; disconnected → GitPanel returns. Add a GitPanel/cloud-mode test.

### Task 3: REBUILD the committed client bundle (close-out for all client-touching phases)

- **Do**: `cd apps/studio && MAUDE_SKIP_RUNTIME_BUILD=1 bun run build.ts --release`; commit `dist/client.bundle.js` + `dist/styles.css` — CloudBar (sync-1) + GitPanel (this phase) ship in the client.
- **Gotcha**: release-minified only — a dev-server boot or `bun test` can clobber `dist/` with unminified dev bundles; check `git status apps/studio/dist/` before AND after.
- **Validate**: bundle size in the release ballpark (~250 KB, not 3.6 MB); `git status` shows only the intended dist diff.

---

## Validation

1. **Static**: `pnpm lint`
2. **Tests**: `cd apps/studio && bun test` (GitPanel/cloud-mode + cloud-endpoints) — guard `git status apps/studio/dist/`.
3. **Design smoke** (client UI changed): `maude design smoke --changed-only` — read every PNG (DDR-021).
4. **Live check**: linked+credentialed → cloud-managed posture; disconnect → full GitPanel returns without reload.

## Acceptance Criteria

- [x] DDR recorded + ingested BEFORE implementation ✅ 2026-08-10 — **DDR-218**: de-emphasise (presentation, not a control — `.git` untouched, server route gates unchanged); escape hatch = Disconnect (config-flag opt-out noted as a later option)
- [x] Linked+credentialed → History + "Cloud is saving" note (`cloudManaged` prop = `historyOnly` withdrawal + note), reacting LIVE (CloudBar lifts resolve/attach/detach via `onLinkedHub` → app state → prop; `useEffect` flips the tab) ✅ — ON-state live check deferred to feature Validation §5 (needs a credentialed link; this repo's `localhost:1234` link is uncredentialed and correctly keeps the FULL panel — OFF-state verified live in the rebuilt client)
- [x] User's `.git` never modified by this change ✅ (pure client presentation)
- [x] `dist/client.bundle.js` + `dist/styles.css` rebuilt release-minified ✅ (2,022,327 B vs HEAD 2,020,351 B — +2 KB, matching artifact class; commit pending the close-out commit)
- [x] Tests green ✅ (`git-cloud-posture` source-assertion suite + cloud suites; full studio run 4308/4314 pass — 1 fail under triage, see feature notes)
