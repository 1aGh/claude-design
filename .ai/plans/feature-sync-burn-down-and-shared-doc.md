# Feature: Sync v2 burn-down + the shared-doc epilogue

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports.

> **Provenance.** Split out of [`feature-sync-journal-file-plane.md`](archive/feature-sync-journal-file-plane.md)
> on 2026-08-18, at that plan's close. Increments 0–4.5 and 6 shipped there; the two
> increments left are the ones whose precondition is **time**, not code — they delete
> working code, and the strangler rule that governed the whole arc says nothing is
> deleted until its replacement has soaked a release. Keeping them in the parent plan
> would have meant either holding a finished arc open indefinitely or breaking the one
> rule that made it safe.

## Description

Two deletions, each gated on a real soak:

- **Increment 5 — burn-down.** The old transfer engines are now dead weight: the
  journal file plane carries everything they carried, in one lane, with one decision
  function. Removing them is worth roughly −900 lines of core sync and, more
  importantly, ends the jurisdiction overlap that produced most of the v0.60.x bug week.
- **Increments 7–8 — the shared-doc epilogue.** `MAUDE_SHARED_DOC` default ON, then
  one release later the deletion of `agent.ts` and the two-doc relay (~800 lines). This
  touches the DOC plane, which the journal arc deliberately left alone.

## Problem

The parent arc replaced seven sync mechanisms with two, but replacing is not the same
as removing: the old lanes are still compiled, still shipped, still running for
flag-off projects, and still able to write the same files the new lane writes. Every
one of them is a second opinion about a file's fate that nobody consults on purpose.

The reason they are still here is sound and temporary. A strangler migration keeps the
old path until the new one has proven itself on real trees, because the failure mode of
deleting too early is silent data loss with no rollback. That proof is a released
version in real use, which is exactly what a plan cannot assert about itself.

## Solution

Delete on evidence, in two waves, each after its replacement has shipped and soaked.

## Preconditions (BINDING — this plan does not start until they hold)

1. A release carrying Increments 4/4.5/6 has shipped and soaked at least one release
   cycle in real use — not a green test suite, a released version people ran.
2. The poke-miss counter measured ≈ 0 in that window. It is what decides whether the
   20 s poll may relax to 60 s; without the measurement the poll stays where it is.
3. No open regression attributable to the file plane, the deletion lane, or the mode
   model.

## Metadata

- **Type**: Refactor (deletion)
- **Complexity**: Medium — mechanically simple, gated on evidence rather than effort
- **App/Package**: `apps/studio` (sync/), `apps/hub`
- **Dependencies**: none new; this only removes

---

## Tasks

### Task 1: Increment 5 — burn-down (M)

- **Do**: DELETE `asset-pull.ts`, `asset-sweep.ts` + `asset-push-worker.ts` as a transfer
  engine, ~450 lines of `asset-push.ts` (the transport core survives inside the door
  client), the fast-push wiring + `requestFastPull` + `REFERENCE_FILE_RE`, the
  `announceWrite` inference bridge, and the probe route (keeping a checkout-only compat
  shim for the legacy window). Hub `asset-lane.mjs`'s sweeper becomes a ~150-line
  journal-driven write-behind covering ALL file-lane classes, which also closes the
  `system/**/assets/*` durability hole. `assets.mjs` PUT branches delegate to the one
  door. Poll 20 s → 60 s **only if** precondition 2 holds.
- **Keep**: the legacy pull/push client, ≥ 2 releases, for journal-less self-hosted hubs
  (Open decision 4).
- **Validate**: `apps/desktop/scripts/check-bundle-completeness.mjs <built .app> --smoke`
  (no sweep child left behind); new-desktop-vs-old-hub e2e still pushes and pulls
  through the legacy client; store-drift alert — any post-boot bucket-fallback serving
  is an alarm, not a fallback.
- **Rollback**: each deletion is its own revert commit; the cell-side legacy sweep stays
  reachable for one release via the `workflow_dispatch` runbook.

### Task 2: Increment 7 — shared-doc default ON (M)

- **Do**: desktop `MAUDE_SHARED_DOC` defaults ON (the DDR-064 cutover), re-verifying the
  desktop-specific items on the DDR-213 checklist. **No deletion in this release** — both
  paths coexist so the flip is a config flip back.
- **Validate**: real-tree link + the full cold-start matrix against the single applier;
  `maude design perf` before and after.
- **Rollback**: config flip.

### Task 3: Increment 8 — delete the two-doc relay (M)

- **Do**: one release after Task 2 soaks, DELETE `agent.ts`, the two-doc relay observers
  and the agent-origin `queuedOps` wiring (~800 lines). Cold-start callers: 1.
- **Validate**: same matrix as Task 2, plus the perf smoke.
- **Rollback**: revert the deletion commit.

---

## Validation

Per increment, same ladder as the parent arc:

1. **Lint**: `pnpm lint`
2. **Tests**: `pnpm test && pnpm test:dev-server` — check `git status apps/studio/dist/` before AND after
3. **Build**: `pnpm --filter @maude/site build`
4. **Parity/tarball**: `bash scripts/check-version-parity.sh`, `bash scripts/check-tarball-shape.sh`
5. **Real-tree acceptance**: fresh link alligators → alligators-mirror, byte parity of the VERSIONED set
6. **Desktop self-containment**: `check-bundle-completeness.mjs --smoke` + `check-client-boots.mjs` against the built `.app`
7. **Fleet verify**: `.ai/release-guide.md` § "Verify the fleet actually rolled"

## Acceptance Criteria

- [ ] Preconditions 1–3 documented as MET, with the release version and the measured poke-miss figure, before Task 1 starts
- [ ] After Task 1: net LOC of `apps/studio/sync/` + the hub sync files is **negative vs the v0.60.7 baseline** (target ≈ −900 core)
- [ ] Poll relaxed to 60 s **only** on the measurement, never on the assumption
- [ ] Legacy pull/push client still present and exercised by an old-hub e2e
- [ ] After Task 2: both doc paths coexist; nothing deleted
- [ ] After Task 3: one cold-start applier, one code path, perf no worse than before
- [ ] `pnpm --filter @maude/site gen:roadmap` regenerated at each plan-status change
