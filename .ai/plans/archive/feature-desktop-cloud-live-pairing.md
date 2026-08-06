# Feature: desktop ↔ cloud live pairing

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports. This touches the CRDT sync layer — the highest data-loss-risk subsystem in the repo. The verification bar (property suite + live cross-surface run) is not optional.

## Description

In a Maude Cloud cell the desktop app and a browser opening the same project never meet: no shared cursors, and an edit made in one surface never reaches the other live. Both persist (to disk, via different paths) so nothing is lost — but "live multiplayer across desktop and cloud", the headline of the cloud product, does not exist. This feature unifies them onto **one durable Y.Doc per canvas** — the hub's Hocuspocus document the desktop already syncs to — so presence and edits cross both ways, with the hub remaining the sole committer.

## User Story

As a Maude Cloud user, I want the person editing a project in their browser and the person editing it in the desktop app to see each other's cursors and changes live, so that cloud collaboration works the same whether you opened the project in a tab or in the app.

## Problem

A cell holds **two disjoint Y.Doc worlds** (RCA `issue-desktop-never-joins-the-cells-collab-rooms.md`):

| | who connects here | where it lives |
| --- | --- | --- |
| **Hub Hocuspocus docs** | the **desktop** (`linkedHub` → cell URL) | hub process, SQLite-backed, durable |
| **Studio-child collab rooms** | **browsers** (`/_ws/collab/<slug>`, proxied) | studio-child process, in-memory |

The only link is one-way and non-live: the hub's `afterStoreDocument` → disk + autocommit. Presence is ephemeral room state and cannot cross a filesystem; a browser edit reaches the studio room + disk but never the hub doc, so a desktop peer subscribed to the hub doc sees nothing.

**Why it is this way (not an oversight):** the hub was the sync brain first (Phase 9, desktop↔hub). The browser-in-the-cloud surface (Phase 27) reuses the dev-server's OWN collab rooms — a second Yjs layer — and **DDR-209 / Phase 27 D2 deliberately forbids the studio child from syncing out** ("in a workspace cell the hub owns history and sync"; honouring `linkedHub` would dial out + start a second autocommit). So the two layers were left as islands on purpose.

## Solution

**Approach C — unify at the hub.** Make the browser's collab doc BE the hub's Hocuspocus doc (the durable one the desktop already uses), via the **shared-doc single-Y.Doc model (DDR-064)** — which is fully built but shipped OFF behind `MAUDE_SHARED_DOC` for caution + an unfinished cutover checklist, NOT a known bug.

Two variants; this plan implements **C2** first (smaller, reversible, reuses the working browser path) and records C1 as the cleaner long-term target:

- **C2 (this plan) — a loopback, commit-disabled shared-doc provider in the studio child.** The studio child runs a `HocuspocusProvider` to its OWN cell hub over **loopback** (`127.0.0.1:<hub-port>`), with `MAUDE_SHARED_DOC` ON so the browser room's Y.Doc IS the doc that syncs to the hub. This threads DDR-209's needle explicitly: **loopback-only ⇒ no dial-out to a third party; autocommit disabled ⇒ the hub stays the sole committer.** The browser (studio room) and the desktop (hub Hocuspocus) then converge on one Y.Doc via Yjs; presence crosses for free. Reuses today's working browser-browser rooms + the fs:any bridge unchanged.
- **C1 (not this plan) — re-home the browser collab onto the hub Hocuspocus directly** (the proxy stops forwarding `/_ws/collab` to the studio child; the hub serves it). Cleaner (no bridge, one doc, no second process in the loop) but requires re-homing the studio room's other lanes (comments/annotations/activity) onto the hub doc — a large structural change. Fold into a follow-up once C2 proves the model in production.

**Rejected — B (studio child dials its OWN external hub / the user's linkedHub):** reverses DDR-209 (dial-out + second autocommit). Off the table.

## Metadata

- **Type**: New Capability (completes cloud live-collaboration)
- **Complexity**: High
- **App/Package**: `apps/studio` (sync runtime), `apps/hub` (childEnv, loopback token), `apps/cells` (env wiring)
- **Affected Systems**: CRDT sync (Yjs/Hocuspocus), shared-doc projection, autocommit ownership, cell boot env
- **Dependencies**: none new — `yjs` + `@hocuspocus/provider` already present; the shared-doc machinery (`sync/projection.ts`, `sync/migrate-seed.ts`, `sync/origins.ts`, `sync/echo-guard.ts`) already exists

---

## Context References

### Must-Read Files

> Read all in parallel during `/flow:execute`.

- `.ai/archive/decisions/DDR-064-single-shared-collab-doc.md` — the shared-doc single-Y.Doc design + the **pre-cutover checklist** (the correctness spec this feature must close).
- `.ai/archive/decisions/DDR-209-*.md` (Phase 27 D2) — why the studio child must not sync out; the invariants C2 must preserve (no dial-out, hub sole committer).
- `.ai/archive/decisions/DDR-102-*.md` — cold-start divergence resolution (reused for first-connect reconcile).
- `apps/studio/sync/index.ts` (lines ~228-333) — the workspace-mode guard that hard-returns null (Task 1 lifts it narrowly); the `useSharedDoc` gate; the provider attach (~700-730).
- `apps/studio/sync/origins.ts` — the per-writer transaction origins (the loop-prevention discipline; C2 adds no new writer but must not break the filter).
- `apps/studio/sync/projection.ts` — doc→file / file→doc loop-free projection under shared-doc.
- `apps/studio/sync/migrate-seed.ts` — the one-time authoritative seed that avoids the `applyUpdate`-duplication trap on first connect.
- `apps/studio/sync/echo-guard.ts` — the write-hash fingerprint dropping our own fs.watch echo.
- `apps/hub/src/studio-child.mjs` (`childEnv`, ~114-190) — where the loopback hub URL + derived token get injected.
- `apps/hub/src/server.mjs` (Hocuspocus setup ~171-460, `afterStoreDocument` ~844) — the sole-committer path C2 must leave as the ONLY committer; the loopback port + token grammar (`onAuthenticate` / `matchesScope`).
- `apps/studio/hmr-broadcast.ts` (`createContainerWriteBridge`, shipped this session) — re-check for double-fire once the doc→disk projector becomes the writer under shared-doc.

### Files to Create

- `apps/studio/test/shared-doc-cell-pairing.test.ts` — the C2-specific convergence + invariant tests (see Validation).

### Existing tests to run/extend

- `apps/studio/test/shared-doc-convergence.test.ts` — commutativity / idempotency / round-trip + N-peer randomized stress (must stay green with the flag ON).
- `apps/studio/test/shared-doc-foundation.test.ts`, `shared-doc-projection.test.ts`, `shared-doc-migrate.test.ts` — the built-but-dormant suites; run them with the cell wiring.
- `apps/cells/*.test.mjs`, `apps/hub/test/*.test.mjs` — childEnv + boot invariants.

### Documentation

- Yjs shared-types + `applyUpdate` duplication trap — Why: the migrate-seed exists because `applyUpdate`-ing two independent docs duplicates `Y.Array` items; the cell first-connect must use the authoritative seed, never a naive merge.
- Hocuspocus provider `{ document }` attach — Why: shared-doc attaches the provider to an EXISTING doc (the room's), not a fresh one.

### Patterns to Follow

- The workspace-mode guard is a hard `return null` with a logged reason (`sync/index.ts:238`). The Task-1 exception must be equally explicit and logged — a narrow allow, not a silent widening: `loopback host AND autocommit-disabled` or it still refuses.
- Token derivation follows the `deriveSecret(CELL_SECRET_MASTER, tenant, purpose)` family (never a user credential) — the loopback provider's token is a derived cell credential.

---

## Tasks

Execute in order. Each task is atomic and testable. **Do not enable anything fleet-wide until Validation's convergence suite + live cross-surface run are green.**

### Task 1: UPDATE the workspace-mode sync guard to allow a loopback, commit-disabled provider

- **Do**: In `sync/index.ts`, replace the unconditional `MAUDE_WORKSPACE_MODE` `return null` with a narrow exception: permit a sync runtime IFF (a) the resolved hub URL is a **loopback host** (127.0.0.1/localhost/::1) AND (b) autocommit is **disabled** for this runtime (a new `opts`/env flag, default off). Any other workspace-mode `linkedHub` still refuses, with the same logged reason. Preserves DDR-209 literally: no dial-out (loopback), no second committer (autocommit off).
- **Pattern**: mirror the existing logged-refusal shape at `sync/index.ts:238`.
- **Gotcha**: the CI gate (DDR-054 §2a) and the scheme allowlist must still run; the loopback exception must not bypass them.
- **Validate**: unit test — workspace + loopback + autocommit-off ⇒ runtime starts; workspace + non-loopback ⇒ still null; workspace + loopback + autocommit-on ⇒ still null.

### Task 2: ADD the loopback hub URL + derived token to the studio child's env

- **Do**: In `apps/hub/src/studio-child.mjs` `childEnv`, when in workspace mode, inject `MAUDE_LINKED_HUB_URL=http://127.0.0.1:<hub-port>` (loopback), a derived provider token (`deriveSecret(CELL_SECRET_MASTER, tenant, 'loopback-sync')` or the existing project-token key the hub accepts), `MAUDE_SHARED_DOC=1`, and the autocommit-disable flag from Task 1. Mirror in `apps/cells` if env passes through there.
- **Pattern**: the existing conditional env spreads in `childEnv` (`HUB_PUBLIC_URL`, `MAUDE_TENANT_ID`, …).
- **Gotcha**: the hub's Hocuspocus `onAuthenticate` checks token scope vs `documentName` — the loopback token's scope must cover the project's canvas doc names (flat slugs today; namespaced if `workspaceId` set). Verify against `server.mjs` `matchesScope`.
- **Validate**: boot a cell in a test harness; the studio child's sync no longer declines `no-credential`; it connects to the loopback hub.

### Task 3: CONFIRM the hub remains the SOLE committer

- **Do**: Assert (test + code audit) that with C2 on, the studio child's sync runtime does NOT run `autocommit`/`pushMirror` — only the hub's `afterStoreDocument` commits. The studio child still writes `.tsx` on API edits (canvas-edit.ts) and the shared-doc projector writes doc→file; neither may `git commit`.
- **Gotcha**: DDR-209's core fear is a second autocommit. This task is the guard that it never happens.
- **Validate**: a test that runs a full edit cycle in the harness and asserts exactly one committer touched `.git`.

### Task 4: CLOSE the DDR-064 pre-cutover checklist items that are cell-relevant

- **Do**: From DDR-064's checklist: (a) slug-collision detection (A4); (b) pinned-room count cap (A6); (c) the one-time consent notice when `sharedDoc && linkedHub` first engages (A7) — in a cell this is implicit operator consent; record that; (d) verify `@hocuspocus/provider` version vs 2025 advisories; (e) `.html`-body gate (A1) is moot (TSX-only) — record the assumption; (f) cap/sanitize the comments hub→disk lane if not already.
- **Validate**: each item has a test or a recorded decision; none left as a bare TODO.

### Task 5: VERIFY the cold-start seed for the desktop↔browser first-connect

- **Do**: On first connect, the studio room (browser state) and the hub doc (desktop state) reconcile via the authoritative `migrate-seed` (hub-wins when the hub holds state; adopt local only when hub empty) inside `transact(fn, MIGRATION)` — never a naive `applyUpdate` (duplication trap). Confirm `migrate-seed.ts` applies to the loopback-provider path.
- **Validate**: `shared-doc-migrate.test.ts` extended for the cell topology — two non-empty docs converge to ONE authoritative state, no duplicated `Y.Array` items.

### Task 6: RE-CHECK the container-write-bridge interaction

- **Do**: The fs:any bridge shipped this session synthesises `fs:any` off `activity:suppress` because the container watcher misses atomic writes. Under shared-doc the doc→file **projector** may now be the writer (not only canvas-edit.ts). Determine whether the bridge still fires, double-fires, or should be gated off the projector path. Adjust so peers get exactly one reload per edit.
- **Validate**: the live HMR probe (`hmr-probe.mjs`) shows exactly one canvas-hmr message per edit under shared-doc.

---

## Validation

Zero-regression bar (the `no-break-exhaustive-verify` discipline — this is a CRDT change):

1. **Lint**: `pnpm lint`
2. **Tests**: `pnpm test && pnpm test:dev-server` — including the shared-doc suites exercised with the cell wiring.
3. **Convergence property suite (blocker)**: `apps/studio/test/shared-doc-convergence.test.ts` green with the flag ON — commutativity / idempotency / round-trip laws + the seeded N-peer randomized-delivery stress → all replicas byte-identical.
4. **New**: `shared-doc-cell-pairing.test.ts` — the C2 invariants: loopback-only guard, sole-committer, first-connect seed, presence crosses.
5. **Build**: `pnpm --filter @maude/site build` + a cell image build.
6. **Live cross-surface run (blocker, manual — the DDR-064 cutover gate):** on one real cell, a **desktop app** and a **browser** open the same project. Assert: (a) a cursor from each appears in the other; (b) an edit in the browser appears live in the desktop and vice-versa; (c) a **reload of either loses nothing**; (d) `git log` in the cell shows exactly ONE committer (the hub). Reuse `hmr-probe.mjs` + a second Hocuspocus client for the desktop side.
7. **Guard the mirror/autocommit**: confirm no second autocommit fired (Task 3 test + a live `git reflog` check on the cell).

---

## Acceptance Criteria

- [x] All tasks completed
- [x] `/flow:utils-verify` passes after each task
- [x] Convergence property suite green with the flag ON
- [x] **Live cross-surface run: presence + edits cross both ways, reload loses nothing, exactly one committer** — run 2026-08-06 against a local cloud-faithful cell (split shell/canvas origins via `apps/cells/dev-edge.mjs`, two browser accounts, the desktop app). Presence + edits crossed both ways; an annotation survived a full cell restart; `git log` shows exactly one committer, `Maude Workspace <workspace@maude.local>`, with the editor carried as the git AUTHOR. **The run was not a formality — it found two real bugs, both fixed before this box was ticked** (see below).
- [x] DDR-209 invariants preserved (loopback-only, hub sole committer) — asserted by test, not just by reading (`shared-doc-cell-pairing.test.ts`: the loopback matrix, the git-untouched edit cycle)
- [x] DDR-064 pre-cutover checklist items closed or recorded (A1 moot/recorded · A4 + A6 implemented + tested · A7 implemented · comments hub→disk lane capped · provider advisories clean) — see DDR-213's table
- [x] A DDR recorded for the C2 decision — [DDR-213](../archive/decisions/DDR-213-cell-pairs-with-itself-loopback-shared-doc.md), EXTENDS DDR-064 + DDR-209, C1 noted as the follow-up
- [x] No fleet-wide enablement: `CELL_LIVE_PAIRING` is a per-tenant allowlist, default off, set to `alligators` only

### Execution notes (2026-08-06)

- **Task 6's answer:** the container write bridge does **not** double-fire — it triggers off `activity:suppress`, which the projector never arms, so it never covered the projector at all. The real defect was the opposite: a doc-originated edit produced **no** `fs:any` in a container, so peers stayed stale. The projector now announces its own writes (cell-pairing only, delayed by the bridge's margin so a live watcher wins the race). Writing that test found a second, pre-existing bug: `reconcile()` re-wrote every canvas at cold start with bytes identical to disk — invisible until the write announced itself, then a spurious reload of every open canvas at boot. `writeAndAnnounce` now no-ops on identical bytes.
- **Scope taken beyond the plan, deliberately:** shared-doc is now a hard *condition* of pairing (not just an accompanying flag) — without it the loopback provider would open a second doc per canvas, which is strictly worse than not pairing; `.claudeignore` / `_untrusted/` markers are suppressed in a cell (they would land in the tenant's repo and be mirrored to their GitHub); `sync/limits.ts` was extracted to break an import cycle the new persistence cap would otherwise have closed.
- **Known consequence, not fixed here:** browser-originated edits are now attributed to the pairing token rather than to the member. The token is minted with no owner on purpose. Carrying the real editor across the loopback lane is follow-up work — and C1 fixes it for free. Recorded in DDR-213 § Consequences.
- **Pre-existing reds, untouched:** `pnpm lint` (control characters in `apps/studio/bin/_smart-frames.test.mjs`) and `apps/hub/test/auth-hardening.test.mjs` were both already failing on `main` — verified by stashing this change.

### The live cross-surface run (2026-08-06) — what it cost and what it caught

The deferred manual gate was the whole point, and it earned its keep: **the feature was code-complete, test-green and wrong in production in two ways**, neither reachable by the unit suites because both live in the seam between two processes.

1. **Paired edits were never committed.** `workspace-agent.mjs` staged for commit only the files the hub had itself written. Under pairing the studio child's projector writes the same bytes from the same doc and usually wins, so the hub wrote nothing, noted nothing, and never committed. "Exactly one committer" passed *vacuously* — there were ZERO. The tenant's work sat safely on the cell's disk and permanently out of its history, which is the one thing a cell owns on their behalf. Fixed by separating *what to write* from *what to commit* (a lane is committable when the doc carries it and disk has it, whoever wrote it) and letting git decide whether that is a real change.
2. **The annotations sidecar was written to a path nothing reads.** The hub derived it as a true sibling (`ui/Hello.annotations.svg`); the studio keys it by the flat slug at the design root (`ui-hello.annotations.svg`). So the hub committed a junk file — the one that would reach the tenant's GitHub mirror — while the real sidecar stayed untracked.

Both now have regression tests that were **verified to fail without the fix**. A third, smaller finding: the browser's Changes panel advertised Save/Publish and an "unsaved" count for work the hub had already committed, and told a cloud user to "save from your terminal"; the panel now withdraws to History wherever the server owns history.

**Process lesson worth carrying:** a manual acceptance criterion left unchecked because it "needs real infrastructure" is not a formality to tick later — it is the only test that runs the real topology. Standing up a faithful local stand-in (both origins, real capability cookies, a real desktop peer) cost about one session and converted three production bugs into three commits. Two near-misses in that session are also instructive: a `<title>` marker used to prove annotation persistence was silently stripped by the annotation sanitizer and nearly read as data loss, and a stray `bun test` run from the repo root clobbered `dist/` with 14 MB dev bundles three separate times — the CLAUDE.md `dist/` guard is not paranoia.

---

## Risks

- **CRDT data loss** is the headline risk — mitigated by the convergence property suite + the authoritative migrate-seed + the live reload-loses-nothing gate. Do not shortcut these.
- **A second autocommit** (DDR-209's fear) — Task 3 is the explicit guard; assert it, don't assume it.
- **shared-doc was never graduated** — treat the pre-cutover checklist as required, not optional; if an item reveals a real correctness gap (not just caution), stop and re-plan.
- **The bridge/projector double-write** (Task 6) — verify exactly-once reload, or peers flicker.
- **Scope creep into C1** — resist; C2 is the reversible pilot. C1 (re-home collab to the hub) is a separate, larger plan once C2 is proven in production.

---

## Retro

- **What worked:** the DDR-209/DDR-064 pre-cutover checklist gave `/flow:execute` a concrete, closeable list instead of an open-ended "make it safe" — every item in the plan's Task 4 mapped to a real test or a recorded decision, and none were left as a bare TODO. Writing `test/shared-doc-cell-pairing.test.ts` against the *invariants* (can the socket be steered / can a second committer appear / can two tenants' data merge) rather than the implementation meant it kept catching real bugs through two later rounds of edits (the `announceWrite` no-op-on-identical-bytes fix, the per-path timer coalescing fix) without needing to be rewritten.
- **What worked, unplanned:** the security fan-out (defender + attacker, `/flow:validate` step 4) earned its cost on this feature specifically — it's exactly the kind of "reopen one exception in a hard boundary" change where an implementer's own confidence is the least trustworthy signal. The attacker pass's chained finding (wildcard token + no network-origin binding + no expiry) was real and worth recording, even though the actual call — evaluate it against the `HUB_SECRET` precedent already accepted in this exact codebase — landed on "residual, not blocker." Worth doing that comparison explicitly next time a review finding's severity feels disproportionate to what's actually new: check whether the risk shape already exists elsewhere and is already accepted, rather than either rubber-stamping the finding or waving it away.
- **What worked, unplanned (2):** the 4-lens `/simplify` pass (reuse / simplification / efficiency / altitude) run in parallel found a genuine correctness-adjacent bug — three of the four lenses independently converged on the same `announceWrite` timer-coalescing gap from different angles (efficiency: wasted timer allocation; reuse: reimplements `createContainerWriteBridge`; altitude: should route through the existing mechanism). Cross-lens convergence on the same line is a strong signal worth trusting over any single lens's framing.
- **What to change next time:** `code-simplifier` (named in `/flow:done`'s own process text) isn't a registered subagent in this session — had to substitute the `/simplify` skill's own 4-agent fan-out. Worth flagging to whoever owns the flow plugin's subagent roster, since the substitution worked fine but cost a discovery round-trip.
- **What to change next time (2):** `apps/studio/bin/smoke.sh`'s `--changed-only` escalation pattern still matched the pre-rename `dev-server/` path, so since the actual move to `apps/studio/`, a dev-server-shaped change silently got the *narrow* screenshot sweep instead of the full one — caught only because this feature's first `--changed-only` run reported "nothing to screenshot" for a diff that plainly touched the dev server. Fixed in this same change, but it's worth an explicit repo-wide grep for other `dev-server/`-shaped path patterns left over from that move.
- **What to change next time (3):** `pnpm format --write` (a required `/flow:validate` gate) auto-fixes pre-existing formatting debt repo-wide as a side effect, including files outside the feature's scope (`apps/cells/worker.mjs` this run) — had to manually revert the out-of-scope fix to keep the commit scoped. A project convention question worth raising: should a stray pre-existing format fix ride along in the next commit that happens to touch that gate, or always be reverted and left for its own pass? This run chose "always revert," consistent with "stage only files relevant to the change."
