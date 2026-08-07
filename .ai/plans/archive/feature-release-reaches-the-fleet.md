# Feature: a release reaches the fleet, and says which one it is

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports. **Phase 1 must land before the next release** — until it does, every release repeats the v0.57.0 failure.

## Description

Tagging a release is supposed to roll the cloud. It does not, reliably: v0.57.0
put a cell image tagged `v0.57.0` into production whose **hub layer was built
from v0.56.0**, so a hub route added after v0.56.0 is absent from the live fleet.
Every workflow was green.

This makes the rollout ordered instead of racing, makes "green" mean "the fleet
answers on the released version", and puts that version somewhere a person can
read it — in the studio, on the hub, in the cloud.

## User Story

As the person who cuts Maude releases, I want tagging to deploy the cloud and
*prove* it did, and I want to see the running version in the UI, so that I never
again have to probe production by hand to find out what is actually deployed.

## Problem

### The observed failure

Release commit lands on `main` (touching `apps/cells/wrangler.toml`) → branch run
starts 10:19:34, needs no wait because `maude-hub:latest` always resolves, builds
the cell from a **six-day-old** hub, pushes it as `maude-cell:v0.57.0`, deploys.
✅ Green.

Tag `v0.57.0` pushed → tag run starts 10:19:54, correctly resolves
`maude-hub:v0.57.0`, waits `40 × 15s = 10 min`. `hub-image.yml` builds
`linux/amd64,linux/arm64` under QEMU and takes **~16 min**. Tag run gives up
10:31:54. ❌ Failed — after the damage was deployed. Hub image ready 10:35:51.

### Why it is structural, not bad luck

**`hub-image.yml` runs only on tags** (`tags: ['v*.*.*']` + `workflow_dispatch`),
so `maude-hub:latest` is only ever rebuilt at release time.

**`cells-deploy.yml` derives from that `:latest` on any non-tag ref**, and its
`paths:` includes `apps/hub/**`. So a push changing the hub rebuilds the *cell*
from a hub image that cannot contain the change.

**The wait proves nothing.** `docker manifest inspect "$HUB"` tests
**existence**, not freshness. `:latest` always exists, so the wait is satisfied
instantly by the *previous* image. Adding branch triggers to `hub-image.yml`
would therefore create a second race rather than a fix.

**And the branch run cannot roll the fleet anyway — but can corrupt it.** It
pushes freshly-built bytes under whatever tag `wrangler.toml` already declares.
Per CLAUDE.md a byte-identical container config never restarts an instance, so
between releases that push **deploys nothing**. What it does do is produce two
different images under one tag — precisely the *"two cells can carry the same
tag and different bytes"* hazard `apps/hub/src/bundle-identity.mjs` was written
about, after a rollback went to a tag whose contents CI had overwritten.

### Two more, found on the way

**The documented release command does not push the tag.**
`.ai/release-guide.md:148-151` gets it right — `git tag -a` — and even warns:
*"A lightweight `git tag v${VER}` will silently stay local and
`build-binaries.yml` never fires."* But **`scripts/bump-version.sh:206` and
CLAUDE.md "Release flow" step 3 both print the lightweight form.** Two of the
three surfaces a releaser reads contradict the one that is correct. This bit
today: `main` pushed, tag stayed local, nothing deployed.

**Nothing verifies the outcome.** `cells-deploy` green means "image pushed,
Worker deployed" — the release guide says so and lists manual checks. Confirming
what the fleet runs took hand-probing production, and the first probe was
*misread*: `GET /api/documents` → 401 looks like "exists, needs auth" but is the
blanket answer for any unknown path. Only `POST` → 401 (vs 405 for a real route)
settled it. Nobody should need that trick.

## Solution

**Phase 1 — one path to the fleet.** A branch push stops building and pushing
cell images entirely; only a release tag does. That single change removes the
race, the stale-hub derivation, *and* the same-tag-different-bytes generator.
The branch trigger keeps its genuinely useful half — deploying the **Worker**
(data plane), which is not the image and does not carry a version tag.

This also makes the `hub-image.yml` tag-only trigger a non-issue for the fleet:
if only tag runs build cells, and they derive from `maude-hub:<tag>`, `:latest`
never enters the fleet's supply chain. Fewer moving parts than fixing it.

**Phase 2 — a truthful version, and a gate that reads it.** The release version
reaches the running hub and studio, and `cells-deploy` refuses to go green until
a live cell answers with the version it just deployed.

**Phase 3 — show it.** A version chip in the studio status bar (which covers the
cloud for free — the cell serves the same client) and on the hub admin page.

### What the gate asserts, and why not only the hash

`bundle-identity.mjs` argues `/health` should report a **hash** because a tag is
not an identity. That argument is against a version *replacing* the hash — the
two already coexist at `server.mjs:1631-1636`.

It is tempting to conclude the gate should assert the hash alone. **That would
have missed today's bug entirely.** The stale hub layer staged its own bundles,
so its manifest was perfectly self-consistent: a *self-consistent wrong image*.
The hash catches "same tag, different bytes". Only the **version** catches "the
layer underneath is from the previous release".

So the gate asserts **both**, and they are not redundant — they fail on
different things. This is the DDR-worthy point of the whole change.

## Metadata

- **Type**: Bug Fix (Phase 1–2) + Enhancement (Phase 3)
- **Complexity**: Medium
- **App/Package**: `.github/workflows`, `scripts/`, `apps/hub`, `apps/studio`
- **Affected Systems**: release pipeline, cell image build, hub `/health` + admin, studio client
- **Dependencies**: none new

---

## Context References

### Must-Read Files

> Read all of these in parallel in one message during `/flow:execute`.

- `.github/workflows/cells-deploy.yml` — Why: the whole defect. `on:` (line ~40), "Resolve the hub image to derive from", the existence-only wait (~line 135), the existing tag-matches-release guard to mirror, and `concurrency` (~63) which must NOT be touched.
- `.github/workflows/hub-image.yml` — Why: tag-only trigger, and `Compute tags` deriving `VER` from `GITHUB_REF_NAME` (on a branch that would emit `maude-hub:vmain` — the trap in the rejected option).
- `infra/cell/Dockerfile` (lines 15-20, 60-65) — Why: `ARG HUB_IMAGE` / `FROM ${HUB_IMAGE}`, and the unpinned `cloudflared` `ADD` recorded under Out of Scope.
- `apps/hub/Dockerfile` (lines 43, 77, 99) — Why: the image copies `apps/hub/package.json` as its own `./package.json`, and `apps/studio/package.json` for the studio half. Both are `0.0.0` — that is why `/health` says `0.0.0`.
- `apps/hub/src/server.mjs` (`readOwnVersion` ~2221, `HUB_VERSION` 107, `/health` ~1632, `/admin/api/status` ~1226) — Why: every place the version is read or reported.
- `apps/hub/src/bundle-identity.mjs` (lines 1-30) — Why: the hash-not-version decision this extends. Also `TRACKED_ARTIFACTS` (~line 28), which is why `cloudflared` is invisible to it.
- `apps/studio/http.ts` (lines 1505-1545) — Why: `/_config`, the single payload the client already consumes.
- `apps/studio/whats-new.ts` (lines 45-60) — Why: the proven pattern for resolving the package root and reading a manifest (DDR-045 `paths.ts`).
- `scripts/check-version-parity.sh` (lines 14-30, 69-105) — Why: the manifest list to extend and the bespoke cases to mirror.
- `scripts/bump-version.sh` (line ~206) — Why: the wrong closing instruction.
- `.ai/release-guide.md` (lines 144-155, 186-206) — Why: the **correct** tag form to copy, and the manual fleet checks Phase 2 automates.

### Files to Create

- `scripts/test/workflow-invariants.test.mjs` — the falsifier (Task 1).
- `apps/studio/test/config-version.test.ts` — the version reaches `/_config`.

### Patterns to Follow

- **Workflow reasoning lives in the workflow.** Both files carry long comment blocks explaining *why* (token scope, concurrency, arch choice). Match that — a maintainer must not have to re-derive this race from the git log.
- **Manifests move together.** `check-version-parity.sh` already asserts 12 files with bespoke handling for `tauri.conf.json`, `Cargo.toml` and the `wrangler.toml` image tag. Two more package.jsons is the same shape.
- **Absent fields are the normal case.** A `version` in `/_config` must survive an older server, exactly as `cloud` / `canvasToken` already do.

---

## Design Decisions

### Rejected: make `hub-image.yml` build on branch pushes so `:latest` is fresh

It reads like the obvious fix and it does not work. The wait is
**existence-based**, and `:latest` always exists — so a branch cell build would
still derive from the previous hub, now racing a hub build instead of merely
lagging one. It also needs the `Compute tags` step rewritten, because
`GITHUB_REF_NAME` on `main` yields the tag `maude-hub:vmain`. Two new moving
parts in a pipeline whose failure mode is already "too many triggers racing".

Removing the branch image build makes the whole question moot.

### Rejected: gate the branch run on "is this commit tagged"

Requires `fetch-tags` (absent from the `actions/checkout` step) and races the
tag, which is pushed *after* the branch push arrives. A false negative silently
skips the release deploy — strictly worse than today, where the tag run at least
failed loudly.

### Accepted trade-off

An urgent **cell image** fix now requires a release rather than a push to main.
That is already the intended model — the workflow's own comment says *"THE TAG
IN `wrangler.toml` IS THE INSTRUCTION"* — and `bump-version.sh` makes a release
one command. `workflow_dispatch` (with its `hub_image` input) stays as the
deliberate manual escape hatch. Worker-only changes are unaffected.

### Version chip

| Surface | Where | Text |
| --- | --- | --- |
| Studio status bar | new slot beside the sync slot | `v0.57.0` |
| Hub admin | header, beside the hub name | `v0.57.0` + short bundle hash |
| Cloud | *nothing new* — the cell serves the same studio client | — |

Reuse the existing `st-sb-slot` chrome and token set. No new tokens, no new icons.

---

## Tasks

Execute in order. Tasks 1-3 are Phase 1 and must land before the next release.

### Task 1: ADD the falsifier — assert the invariants that were violated

- **Do**: `scripts/test/workflow-invariants.test.mjs` (node:test) parsing both workflow YAMLs, asserting: (a) no branch-push path can build or push a cell image; (b) the release-tag path derives from a version-pinned hub image, never `:latest`; (c) `scripts/bump-version.sh` and CLAUDE.md do not instruct a lightweight `git tag`. Write against the CURRENT files and **expect it to fail**.
- **Gotcha**: if any assertion passes today, say so rather than adjusting it — that part of the diagnosis was wrong.
- **Validate**: `node --test scripts/test/workflow-invariants.test.mjs` — red, for the documented reasons.

### Task 2: UPDATE `cells-deploy.yml` — only a release tag builds a cell image

- **Do**: make the image build + `wrangler containers push` steps conditional on `github.ref_type == 'tag'` (or split into two jobs). A branch push still runs the data-plane tests and `wrangler deploy`; it must not build, tag, or push an image. Write the reasoning into the file: the branch run could never roll the fleet (a byte-identical container config does not restart an instance) and could only ever produce two images under one tag.
- **Gotcha**: do **not** touch `concurrency: cells-deploy` / `cancel-in-progress: false` — it is deliberate, and flipping it makes *which* run wins nondeterministic rather than correct. Keep the existing "On a release tag, the declared cell image must BE the release" guard.
- **Validate**: Task 1's (a) and (b) go green.

### Task 3: FIX the two release instructions that contradict the release guide

- **Do**: `scripts/bump-version.sh:206` and CLAUDE.md "Release flow" step 3 must print the annotated form the guide already documents (`git tag -a "vX.Y.Z" -m "vX.Y.Z"`), or an explicit `git push origin main vX.Y.Z`. Copy the guide's wording; do not invent a third phrasing.
- **Gotcha**: grep every copy — `grep -rn "follow-tags\|git tag " --include='*.md' --include='*.sh' .`.
- **Validate**: Task 1's (c) goes green.

### Task 4: ADD the release version to the two app manifests

- **Do**: extend `bump-version.sh` and `check-version-parity.sh` to move `apps/studio/package.json` and `apps/hub/package.json` with everything else (12 → 14).
- **Gotcha**: both are private workspace packages pinned at `0.0.0`. `grep -rn '"0.0.0"'` first — a lockfile or workspace-protocol reference could depend on the literal. This task is a **prerequisite** for Tasks 5-8: without it the gate asserts a constant and the chip reads `0.0.0`.
- **Validate**: `scripts/check-version-parity.sh`; `cd apps/studio && bun test`; `node --test apps/hub/test/*.test.mjs`.

### Task 5: ADD `releaseVersion` to the hub `/health`, beside the hash

- **Do**: report the release version as a **new field**, leaving hash reporting untouched. Extend the comment in `bundle-identity.mjs` (or `server.mjs`) to record why both exist and what each catches — see "What the gate asserts".
- **Gotcha**: `/health` is deliberately unauthenticated (it is what you read when auth is broken). A version is not a secret; add nothing else while in there.
- **Validate**: `node --test apps/hub/test/*.test.mjs`; locally `curl :8420/health | jq '{version, releaseVersion}'`.

### Task 6: ADD the post-deploy verification gate to `cells-deploy.yml`

- **Do**: after `wrangler deploy` on a tag run, poll a live cell's `/health` until `releaseVersion` equals the released tag **and** the reported bundle hash matches what this run recorded for the image it pushed. Fail with the last observed values in the message.
- **Pattern**: the manual checks in `.ai/release-guide.md:186-206` are the specification — automate exactly those.
- **Gotcha**: allow generously for cold start (the guide warns a first request can take **minutes** on a GB-scale project) — a flaky gate is a gate someone disables. Choose the probe host deliberately and comment why; a probe that can pass while tenants are broken is worse than none.
- **Validate**: the next real release. Locally, assert the polling logic against a stubbed responder.

### Task 7: ADD the version to `/_config` and the studio status bar

- **Do**: resolve the studio's own version (the manifest from Task 4) and add it to `/_config`; render a slot beside the sync slot with a `data-testid`.
- **Pattern**: `whats-new.ts` already resolves the package root and reads a manifest — reuse it, do not add a second resolution path (DDR-045).
- **Gotcha**: `/_config` reaches the browser in cloud mode. A version is fine; let nothing else ride along. Client reads must survive an older server omitting the field.
- **Validate**: `apps/studio/test/config-version.test.ts`; `pnpm lint`.

### Task 8: ADD the version to the hub admin page

- **Do**: show `releaseVersion` + the short bundle hash in the admin header.
- **Pattern**: `apps/hub/src/admin/` is vanilla JS — match it, introduce no framework.
- **Validate**: `node --test apps/hub/test/*.test.mjs`; load `/admin` locally.

### Task 9: REBUILD the committed client bundle — last, and once

- **Do**: `git status apps/studio/dist/` → `cd apps/studio && MAUDE_SKIP_RUNTIME_BUILD=1 bun run build.ts --release` → `git status apps/studio/dist/` again.
- **Gotcha**: only `client.bundle.js` (and `styles.css` if CSS changed) may differ. What is committed is what ships.
- **Validate**: bundle in the release size range (~2 MB, not ~14 MB).

---

## Out of Scope — recorded, not fixed

- **`infra/cell/Dockerfile:64` downloads `cloudflared` from `releases/latest`, unpinned.** Every cell image build can pick up a different binary, it is not in `TRACKED_ARTIFACTS` so `bundle-identity` cannot see it, and it makes "same tag, different bytes" possible independently of everything above. Pin it to a version + checksum in its own change.
- **`hub-image.yml` remains tag-only.** Correct once Task 2 lands (the fleet never derives from `:latest`), but it means `:latest` still lags for anyone pulling it by hand. Note it in the workflow comment.

---

## Validation

1. **Lint**: `pnpm lint`
2. **Tests**: `cd apps/studio && bun test` (never from the repo root) + `node --test apps/hub/test/*.test.mjs` + `node --test scripts/test/*.test.mjs`
3. **Parity**: `scripts/check-version-parity.sh` (now 14 manifests)
4. **Build**: `pnpm --filter @maude/site build`
5. **The real test — the next release.** `cells-deploy` must go green *because*
   a live cell answered with the new version and the matching hash, and
   `/health` + the studio chip must agree with the tag. If Task 6 passes while
   production is stale, Task 6 is wrong.

---

## Scenario Coverage

No new desktop E2E scenario. The version chip is a static label; the substantive
behaviour is CI, covered by Task 1's invariant test and by Task 6 proving itself
on a real release. Add the chip's `data-testid` so a future scenario can reach it.

---

## Acceptance Criteria

- [x] All tasks completed
- [x] Task 1's falsifier is green **because the workflows changed**, not because the assertions were softened
- [x] No branch push can build, tag, or push a cell image
- [x] The release tag path never derives from `maude-hub:latest`
- [x] `cells-deploy` green ⇒ a live cell answers with the released version **and** the recorded hash — asserted against a stubbed responder (`scripts/test/verify-fleet-release.test.mjs`); the real proof is the next release
- [x] All three release surfaces (guide, `bump-version.sh`, CLAUDE.md) agree, and the tag they describe actually reaches origin — README.md was a fourth, also fixed
- [x] `/health`, `/_config`, the studio chip and the hub admin report the same version; hash reporting is unchanged
- [x] `dist/` diff contains only the intended artifacts, verified before and after
- [x] DDR recorded: version and hash are complementary gates, and what each one catches — in the graph, `d_2152229760ff703da58e2d03`, shaping `cells-deploy` / `hub` / `release`

---

## Retro

- **The falsifier earned its keep twice, in opposite directions.** Writing Task 1
  against the current files first meant two assertions came back GREEN — the tag
  run already pinned `maude-hub:<tag>` correctly. That narrowed the diagnosis to
  the branch run rather than confirming the whole story, which is exactly what a
  falsifier is for. Keep the "write it red, and report what passes" instruction
  in plans; the temptation to quietly re-tune a passing assertion is real.

- **A pre-existing gate caught a defect this plan would have shipped.**
  `/_config` is an EXPLICIT client-side projection, not a spread, so adding
  `version` server-side left the chip permanently unrendered.
  `test/config-projection.test.ts` — written after `cloud` and `canvasToken`
  shipped broken the same way — failed and named it. Task 7's plan text said
  "add it to `/_config`" and nothing more; a plan that touches `/_config` should
  name the projection as a second edit site, because the server half looks
  complete on its own.

- **The plan's measured numbers were right and its budget was not.** The Problem
  section documented the hub build at ~16 min and the wait at 10 min, but no task
  said "raise the wait" — so the tag run would have kept failing after the
  `:latest` fix landed. When a plan measures a timeout in its diagnosis, the fix
  for it belongs in a task, not only in the prose.

- **`--changed-only` silently no-op'd the smoke gate.** It diffs COMMITTED canvas
  changes since the last smoke SHA; all the work was uncommitted, so it reported
  "nothing changed" instead of escalating on the `apps/studio/**` trigger. The
  escalation rule in `/flow:execute` still names `dev-server/**`, a path that no
  longer exists. Worth a follow-up: teach the escalation the current path, and
  make an uncommitted working tree escalate rather than pass.

- **Concurrent sessions in this Syncthing tree committed my working-tree edits.**
  `apps/studio/client/app.jsx`, `dist/styles.css` and the kgai log were swept
  into two commits from another session mid-run. Nothing was lost and everything
  was verified present in HEAD, but it is exactly the hazard CLAUDE.md's
  import-coherence note warns about. Verify content in HEAD after committing —
  don't assume your commit is the one that carried your change.

- **Scope found on the way:** README.md was a FOURTH release surface printing the
  lightweight tag (the plan named three). Grepping every copy, as the Task 3
  gotcha instructed, is what surfaced it.
