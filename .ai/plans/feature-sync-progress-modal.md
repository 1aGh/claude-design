# Feature: Sync progress modal — per-file sync state you can watch

> Requested 2026-08-11 after the sync fixes 4–8 shipped: "myslel jsem ze tam
> dodelame ten modal kde uvidim jednotlive soubory jak se synchronizuji a jejich
> progres." Today sync progress is a single aggregate line ("Connecting to X —
> 40/75 canvases…" in the CloudBar note + the status-bar HUB SYNC chip). This
> makes that legible per-file.

## User Story

As someone who just linked a project to Maude Cloud, I want to open a panel and
watch each canvas/asset move from queued → syncing → synced (and see which ones
were rejected or are stuck), so that "is my work actually up there?" has a
concrete, per-file answer instead of one aggregate number I have to trust.

## Problem

The per-canvas sync state already EXISTS server-side — the ConnectionMonitor
tracks `docStates: Map<slug, DocSyncState>` (`sync/connection-state.ts`), and the
`sync:status` / `_sync.json` payload already carries `docs: {synced, pending,
rejected}` + `rejectedSlugs` (`sync/status.ts`, `sync/presentation.ts`). But the
CLIENT only ever renders the aggregate: the CloudBar connect note
(`connectOutcomeNote`, one line) and the status-bar `HUB SYNC synced` chip. A
user watching a fresh link (75 canvases + now assets) sees "40/75" tick up with
no idea WHICH files, which are stuck, or whether an asset push is happening at
all. The RCA fixes (4–8) also added an ASSET push lane (DDR-217) whose progress
is completely invisible today.

## Solution (sketch — refine at /flow:plan execution)

A **Sync panel** (modal or right-dock, matching GitPanel's dock treatment)
opened from the status-bar HUB SYNC chip (and/or the CloudBar). It lists every
synced item with a live per-item state:

- **Canvases** — from the existing `docStates` map, surfaced per-slug:
  `queued → syncing → synced`, plus `rejected` (with the reason from
  `rejectedSlugs` + the DDR-102 classification) and `stalled` (the phase fix 3
  already added). Group by canvas group (ui / system / …).
- **Assets** — NEW: the asset push (DDR-217 + the 2026-08-11 addendum) currently
  reports only a server-side log line + the `AssetPushResult` (`pushed/skipped/
  failed`). Surface it: emit per-asset progress over the same `sync:status` bus
  (or a sibling `asset:status`) so the panel shows `N assets pushed, M skipped,
  K failed` and can expand to the failing paths.
- **Aggregate header** — the existing "40/75 synced · 3 rejected · 2 pending"
  line stays as the panel header (and the collapsed status-bar chip).

## Metadata

- **Type**: New Feature (UI surfacing of existing state + a new asset-progress lane)
- **Complexity**: Medium
- **App/Package**: `apps/studio` (client panel + a thin server-side asset-progress emit)
- **Depends on**: the sync fixes 4–8 (shipped 0.58.3) + the DDR-217 asset addendum (0.58.4) for the asset lane
- **Design**: dock/modal — reuse GitPanel's `st-rpanel` chrome + the sync-status vocabulary already in `presentation.ts` (queued/syncing/synced/stalled/rejected); do NOT invent new sync words

## Execution checklist (2026-08-11 — /flow:execute, direct from the sketch)

- [x] Task 1: Server — per-item `items` list (+ `itemsTruncated`, per-row rejection reason) in the monitor snapshot / `sync:status` payload, capped at `MAX_SYNC_ITEMS=200`, actionable states sorted first
- [x] Task 2: Server — `pushAssets` emits throttled `AssetPushProgress` (200 ms, failures + final always) → `store.updateAssets()` → same `sync:status` bus; state-only v1, no byte %
- [x] Task 3: Client — `SyncPanel.jsx` right-dock panel (GitPanel chrome, `syncPresentation` vocabulary, needs-attention + per-group canvas rows + asset lane, `role="status"` live region)
- [x] Task 4: Client — HUB SYNC chip is a toggle button (`data-testid="open-sync"`, `aria-pressed`, via `toggleRightPanel` so the one-panel-per-side invariant holds); dock tab gated on linked projects
- [x] Task 5: Tests (connection-state items, asset-push progress, status-store asset lane, sync-panel-surface source assertions) + What's New entry (`sync-panel-per-file`, with tour step)

Resolved open questions: **dock** (ne modal — GitPanel treatment, chip zůstává agregátem); **state-only** asset progress (byte % follow-up); rejected rows show the reason class, retry je follow-up.

## Sketch of tasks (to be expanded by /flow:plan)

1. **Server: per-item snapshot in `sync:status`.** The monitor already holds
   `docStates`; extend the `sync:status` payload (or a `/_sync-status` field)
   with a compact per-slug list `[{slug, state, reason?}]` (bounded — cap the
   list, aggregate the tail) so the client can render rows without a second
   fetch. Keep the existing aggregate fields for the chip.
2. **Server: asset push progress.** `pushAssets` (`sync/asset-push.ts`) currently
   returns a result at the end; make it emit incremental progress (per file, or
   batched every N) onto the sync bus so the panel can show assets moving. Cheap
   throttle — don't flood the WS on a 90-file DS.
3. **Client: the Sync panel.** A dock/modal listing canvas rows + asset rows with
   live state, grouped, with the aggregate header. Open from the HUB SYNC chip.
   Reuse `syncPresentation` vocabulary + the a11y `role="status"` live-region
   pattern the CloudBar note already uses.
4. **Client: wire the chip.** The status-bar HUB SYNC chip becomes a button that
   toggles the panel (like the Changes chip toggles GitPanel).
5. **Tests + a11y + a `whats-new` entry.** Source-assertion tests for the
   payload shape + panel gating (cloud-shell-surfaces style); a11y on the live
   region; a "watch your project sync, file by file" What's New entry.

## Open questions (resolve at plan/execution)

- **Modal vs dock?** The user said "modal", but a right-dock (GitPanel-style)
  matches the existing chrome and doesn't block the canvas. Decide at /flow:plan
  (likely dock, with the aggregate as the always-visible chip).
- **Per-file BYTE progress for assets?** Canvases are text (instantaneous once
  synced — a state, not a percent). Assets CAN have byte progress (streamed
  PUT), but wiring a progress bar per asset is more work; v1 could be
  state-only (queued/pushing/done/failed) and add byte % later.
- **Rejected/stalled affordances.** Should a rejected row offer "retry" or a
  reason tooltip? At minimum a reason; retry is a follow-up.

## Non-goals (v1)

- Changing sync behaviour — this is pure surfacing of existing state + an asset
  progress emit. No new sync semantics.
- History of past syncs — the panel shows the CURRENT session's state, not a log.
