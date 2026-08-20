# Feature: cloud-export-render-workers

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports.

> **Supersedes** `.ai/logs/rca/issue-cloud-studio-export-not-found.md` (2026-08-20, in the graph as `rca:maude/issue-cloud-studio-export-not-found`). All findings from that RCA — including the Track 3 vs Track 4 debate and its verdict — are carried into this plan; the RCA is background evidence only.

## Description

Export in the hosted cloud studio (and on every self-hosted workspace hub) fails for every format with `{"error":"not found"}`. This is deliberate: DDR-209 A′1 forbids evaluating tenant TSX on vendor compute and no browser enters the cell/hub image, so `/_api/export*` is pruned from the studio route table in workspace mode AND `REFUSED` in the hub proxy manifest. This feature ships the owner-ratified fix: **on-demand render workers** — a separate, browser-bearing, secret-free `maude-render` service that receives an export job, renders it through the EXISTING exporter spine unchanged, and returns the finished artifact — plus the UX gate, the browser-free-format fixes, self-host sidecar docs/tooling, and production deployment to cloud.maude.sh.

## User Story

As a cloud (or self-hosted workspace) member I want to export my canvas to PNG/PDF/PPTX/SVG/HTML/ZIP/MP4/WebM/GIF directly from the hosted studio so that I don't need the desktop app to get deliverables out of my project.

## Problem

(Full evidence chain in the superseded RCA; summary:)

1. `apps/hub/src/studio-manifest.mjs:196-198` marks `/_api/export`, `/_api/export-jobs`, `/_api/export-jobs/download` `REFUSED` → `studio-proxy.mjs` answers `404 {"error":"not found"}` (deliberately 404, not 403).
2. `apps/studio/workspace-mode.ts` `FORBIDDEN_ROUTE_PREFIXES` contains `/_api/export` (prefix match) → `pruneForWorkspace()` removes the whole family from the cell's route table at boot — **including `/_api/export-history`, which the manifest ALLOWS (`:64`)**: a latent manifest↔prune disagreement.
3. The client is not workspace-aware: the ⌘E dialog is fully offered in the cloud and the viewer banner (`app.jsx:4237`) even promises "you can browse, comment and export"; the raw 404 JSON is surfaced to the user.
4. Every visual exporter (`png/pdf/svg/html/pptx/mp4/webm/gif`) renders via the Playwright/CDP capture spine; `zip` needs no browser (JSZip only) yet fails too because the gate is path-based, not format-based.
5. The same applies to self-hosted hubs: `apps/hub/Dockerfile` carries the same "no browser enters this image" containment, and per DDR-192 §1 the cell runs the same code path a self-hoster runs.

## Solution

**Track 3 primary** (debate verdict 2026-08-20, ratified by owner over browser-side rendering — decisive: pixel-exact CDP fidelity, Safari coverage, existing background-job UX, exporters reused with zero second implementation):

- **New `maude-render` service** (`apps/render/`): a minimal Bun HTTP server + Chromium image that accepts one export job (`POST /render`: format, scope, options, canvas-origin base URL, short-lived read-only render token), runs `runExport()` from `apps/studio/exporters/` **unchanged** (the Playwright spine points at the cell's canvas-origin URL — exactly the surface the member's browser already consumes), and streams back the artifact. Holds **no HUB_SECRET, no provider keys, no tenant store**; single tenant per invocation.
- **Cell-side dispatch**: `exporters/jobs.ts` learns a render *lane* — `local` (desktop/self-host-with-browser: today's in-process spine, unchanged) vs `remote` (workspace mode: POST the job to `MAUDE_RENDER_URL` with `MAUDE_RENDER_SECRET`) vs `none` (workspace mode without a render service: browser-needing formats fail fast with a clear, actionable error; **`zip` always runs locally** — no browser involved, fixing Track 2's format casualty).
- **Capability**: the worker authenticates to the canvas origin with the EXISTING `mintRenderToken` mechanism (`apps/hub/src/render-token.mjs` — HMAC, 15-min TTL, read-only, no export/config/source-write surface reachable; subject = `render-service`, role = `viewer`). No new token scheme.
- **Route reclassification**: `/_api/export-jobs` (GET list → `read`, POST enqueue → `export` capability, which `role-matrix.mjs:32` already grants to all three roles), `/_api/export-jobs/download` (GET → `export`), `/_api/export-history` (GET → `read`, fixing the collision). Synchronous `POST /_api/export` **stays refused** in a workspace — a cloud render is always a job.
- **Governance**: a new DDR amends DDR-209 A′1 with the render-worker isolation contract (precedent: Phase 25 A0 build sandbox), and `/flow:validate-security` gates the rollout.
- **Self-host**: `maude-render` ships as an optional sidecar image; `maude hub workspace-up` + the `self-host` skill + `site/content/docs/hub/` teach how to run it; without it the UI states which formats need it.
- **cloud.maude.sh**: a `maude-render` container class deployed via a tag-gated workflow mirroring `cells-deploy.yml`'s hazard analysis; `bump-version.sh` stamps the image tag.

## Metadata

- **Ticket**: manual report (Michal, 2026-08-20) — no tracker id
- **Type**: New Capability
- **Complexity**: High
- **App/Package**: `apps/render/` (new), `apps/studio/`, `apps/hub/`, `apps/cells/`, `cli/`, `site/`, `.github/workflows/`
- **Affected Systems**: export pipeline, workspace containment, hub proxy/manifest, cell fleet deploy, self-host tooling + docs
- **Dependencies**: no new npm deps expected (Chromium enters ONLY the new render image; `FORBIDDEN_MODULES` in cell/hub is untouched)

---

## Context References

### Must-Read Files

> During `/flow:execute`, read every file listed here in parallel in a single message.

- `.ai/logs/rca/issue-cloud-studio-export-not-found.md` — Why: full evidence chain + debate verdict this plan executes (if absent on this machine, `kg search "cloud studio export not found"` returns the full body).
- `apps/studio/workspace-mode.ts` (whole file) — Why: `FORBIDDEN_ROUTE_PREFIXES`, `SANDBOXED_ROUTE_PREFIXES`, `FORBIDDEN_MODULES`, `pruneForWorkspace`, `checkContainment` — the invariant this feature must reshape without weakening.
- `apps/hub/src/studio-manifest.mjs` (whole file) — Why: deny-by-default route table; the export rows to reclassify; the doctrine comments to keep honest.
- `apps/hub/src/studio-proxy.mjs` (lines ~290–440) — Why: `decide()`/`refuse()` flow producing the 404; where the `export` capability check will land.
- `apps/hub/src/role-matrix.mjs` — Why: `export` capability already exists for owner/member/viewer — reuse, don't invent.
- `apps/hub/src/render-token.mjs` (whole file) — Why: the token to reuse for worker→canvas-origin auth; its doctrine comment explains exactly why the grant shape is safe.
- `apps/studio/exporters/jobs.ts` (whole file) — Why: the queue that gains the lane dispatch; its semaphore, history ledger, and `bus.emit('export:job')` contract must survive unchanged for the notification center.
- `apps/studio/exporters/index.ts` — Why: `runExport()`, `ExportContext` (`serverOrigin` is the knob the render worker points at the canvas origin), format registry.
- `apps/studio/http.ts` (lines ~4215–4360 export routes; ~1714 `/_config`) — Why: export handlers to lane-gate; `/_config` payload the client UX gate reads.
- `apps/studio/client/app.jsx` (lines ~1162–1830 export dialog; ~3716, ~4237 viewer copy; ~9822 shell dialog state) — Why: Track 1 UX gate anchors.
- `apps/studio/export-dialog.tsx` — Why: the second export entry point to gate identically.
- `apps/cells/wrangler.toml` + `apps/cells/cell-do.mjs` (head) — Why: container-class pattern, tag-as-rollout-instruction doctrine, per-tenant secret derivation (`CELL_SECRET_MASTER`) the render dispatch reuses.
- `.github/workflows/cells-deploy.yml` — Why: the tag-gated build shape to mirror; its header documents three shipped hazards the render workflow must not reintroduce.
- `apps/hub/Dockerfile` (containment comments, lines ~180–260) — Why: what the render Dockerfile must NOT copy (frozen-lockfile discipline it MUST copy).
- `plugins/design/skills/self-host/SKILL.md` + `_targets.md` — Why: the staged interview to extend with the render sidecar stage.
- `site/content/docs/hub/self-host.mdx`, `site/content/docs/hub/deploy.mdx`, `site/content/docs/hub/workspace.mdx` — Why: docs surface to update.
- `cli/commands/hub-workspace.mjs` + `cli/lib/workspace-plan.mjs` — Why: `workspace-up` plan model that gains the optional render-sidecar step. **⚠ Both are dirty in the working tree — another session is mid-flight on them (Syncthing tree, see root CLAUDE.md). Check `git log`/`git status` before editing; coordinate, never clobber.**
- `.ai/archive/decisions/DDR-209-one-studio-three-shells-the-cell-serves-the-studio.md` — Why: the invariant text (A′1) the new DDR amends.
- `apps/studio/test/workspace-containment.test.ts` + `apps/hub/test/studio-manifest.test.mjs` — Why: the tests that enforce both gates; every reclassification lands here first (fail-first per memory `maude-verify-regression-tests-fail-first`).

### Files to Create

- `apps/render/server.ts` — Bun HTTP server: `POST /render` (auth: `MAUDE_RENDER_SECRET` bearer; body: job spec + render token + canvas base URL) → `runExport()` → streams artifact; `GET /_health`.
- `apps/render/Dockerfile` — Chromium (`chrome-headless-shell`, matching what the desktop spine ships) + Bun + `apps/studio/exporters` closure; `bun install --frozen-lockfile` (mirror the hub image's supply-chain discipline); NO hub secrets, NO tenant store.
- `apps/render/wrangler.toml` — separate Worker `maude-render` with its own `[[containers]]` class (deploy independence from both control and data plane; own `max_instances` ceiling with the cells' cost arithmetic repeated).
- `apps/render/worker.mjs` — thin DO/container router: cell-authenticated ingress → container `POST /render` passthrough.
- `.github/workflows/render-deploy.yml` — tag-gated image build + `wrangler deploy` (mirror `cells-deploy.yml` incl. the "bump the tag or nothing rolls" rule).
- `.ai/archive/decisions/DDR-2XX-render-workers-amend-containment.md` — via `/flow:record-ddr` (Task 3).
- `site/content/docs/hub/export.mdx` (or a section in `workspace.mdx` — follow the docs IA when there) — how cloud/self-host export works, which formats need the render service.

### Documentation

- Cloudflare Containers (`cloudflare` / `wrangler` skills already loaded) — Why: second Worker + container class, image registry push, rollout semantics.
- `.ai/release-guide.md` — Why: release runbook gains the render-image verification step (mirror "Verify the fleet actually rolled").

### Patterns to Follow

- **Token**: `mintRenderToken({ secret, project, subject: 'render-service', role: 'viewer' })` — reuse verbatim; the doctrine comment in `render-token.mjs` is the security argument.
- **Lane errors**: `exporters/degraded.ts` — "if it produced less than asked, say so structurally"; a `none`-lane failure is a typed refusal with a remedy, not a 500.
- **Route classification**: manifest rows carry the WHY in a comment (see `/_api/photo-edit`'s history lesson at `studio-manifest.mjs:98-105` — a wrong rationale once disabled a feature entirely; write the rationale so it can be falsified).
- **Deploy doctrine**: `cells-deploy.yml` header — tag-gated build, tag-bump-is-the-rollout, never derive from `:latest`, never re-push bytes under an existing tag.

---

## Tasks

Execute in order. Tasks 1–2 are independently shippable; 3 gates 4–9; 10–12 close.

### Task 1: UPDATE client — workspace-aware export UX (Track 1) ✅ 2026-08-20

- **Do**: Expose the export capability in `GET /_config` (`exportLane: 'local' | 'remote' | 'none'` — from workspace mode + `MAUDE_RENDER_URL` presence). In `app.jsx` (shell dialog) + `export-dialog.tsx`: when lane is `none`, disable browser-needing formats with inline copy ("Export needs the render service — available on desktop, or see docs for self-host") keeping `zip` enabled; when `remote`, all formats enabled (jobs lane). Fix the viewer-banner copy at `app.jsx:4237` to stop promising export where the lane is `none`.
- **Pattern**: existing `readOnly` flag in `/_config` (`http.ts:1718`) + Cloud Phase 25 C2 read-only gating in the client.
- **Gotcha**: after client edits, rebuild the committed bundle release-minified (`cd apps/studio && MAUDE_SKIP_RUNTIME_BUILD=1 bun run build.ts --release`) and commit `dist/client.bundle.js` + `dist/styles.css` — CLAUDE.md rebuild rule. Run `git status apps/studio/dist/` before AND after any `bun test`.
- **Validate**: `cd apps/studio && bunx tsc --noEmit`; manual: dialog states in the three lanes.

### Task 2: UPDATE containment prune + manifest — exact-match export family (Track 2) ✅ 2026-08-20 (except-list on the /_api/export prefix; fail-first honored; hub auth-hardening flake pre-exists, verified via stash)

- **Do**: In `workspace-mode.ts`, replace the single `/_api/export` prefix entry with exact-path semantics for the family: forbid `/_api/export` (sync render) in workspace mode; **allow** `/_api/export-history`, `/_api/export-jobs`, `/_api/export-jobs/download` to survive the prune (they evaluate nothing — enqueue/list/stream). Mirror in `studio-manifest.mjs`: `/_api/export-history` `{safe:'read'}` (already), `/_api/export-jobs` `{safe:'read', unsafe:'export'}`, `/_api/export-jobs/download` `{safe:'export', unsafe:null}`, `/_api/export` stays `REFUSED` with an updated WHY comment pointing at the jobs lane. Keep `/_api/shell-shot` and everything else untouched.
- **Pattern**: `FORBIDDEN_ROUTE_PREFIXES` entries carry `why`; the prefix→exact change needs a matching update to the "variant of a forbidden surface" doctrine comment.
- **Gotcha**: **write the failing tests FIRST** (memory `maude-verify-regression-tests-fail-first`): `workspace-containment.test.ts` asserting export-history/export-jobs survive the prune while `/_api/export` doesn't; `studio-manifest.test.mjs` rows. The deny-by-default red-build property must hold (an unclassified route is still a red test).
- **Validate**: `cd apps/studio && bun test test/workspace-containment.test.ts` (alone — memory `maude-parallel-test-runs-contaminate`); `cd apps/hub && node --test test/studio-manifest.test.mjs`.

### Task 3: RECORD DDR — amend DDR-209 A′1 with the render-worker contract ✅ 2026-08-20 (DDR-230, ingested with EXTENDS/EVIDENCE_FOR edges)

- **Do**: `/flow:record-ddr` — "Render workers amend containment": tenant TSX MAY be evaluated by vendor compute **only** inside the dedicated `maude-render` service under this contract: (a) no HUB_SECRET / provider keys / tenant store in the image or env; (b) single tenant per invocation; (c) ingress authenticated by `MAUDE_RENDER_SECRET`, canvas access ONLY via a `mintRenderToken` viewer-role capability (15-min TTL); (d) the cell/hub images remain browser-free — `FORBIDDEN_MODULES`, the Dockerfile assert and `check-containment.sh` unchanged; (e) teardown/statelessness per job. `EXTENDS` DDR-209, cites Phase 25 A0 as precedent and the RCA as evidence.
- **Validate**: `maude kg import --dry-run` shows the new decision; graph node exists.

### Task 4: REFACTOR exporters/jobs.ts — render-lane dispatch ✅ 2026-08-20 (exporters/remote.ts; canva = REMOTE_UNSUPPORTED; scope resolves in-cell, Target is the wire format; member's canvas token forwarded via buildExportArgs)

- **Do**: Introduce `RenderLane = 'local' | 'remote' | 'none'` resolved once at server boot (workspace mode + `MAUDE_RENDER_URL`/`MAUDE_RENDER_SECRET` env). `enqueue()` keeps its contract (id + Promise + bus events + semaphore + history ledger) but the run step branches: `local` → today's `runExport()` in-process; `remote` → `POST ${MAUDE_RENDER_URL}/render` with `{format, scope, options, canvasBase, renderToken}`, stream response to the job artifact, map worker errors into the existing failed/degraded shapes; browser-free formats (`zip`) always run locally regardless of lane; `none` + browser format → immediate typed failure with remedy text. Progress: forward the worker's progress stream if cheap, else coarse (`queued → running → done`).
- **Pattern**: the semaphore + `persistAndEvict` stay untouched; error mapping mirrors `degraded.ts` doctrine.
- **Gotcha**: in workspace mode the local spine MUST be unreachable for browser formats even if misconfigured — assert lane ≠ `local` when `isWorkspaceMode()` (belt-and-braces with the absent browser).
- **Validate**: new `apps/studio/test/export-lane.test.ts` (unit: lane resolution, zip-always-local, none-lane refusal) — run alone.

### Task 5: CREATE apps/render — the worker service + image

- **Do**: `server.ts` (Bun.serve, `paths.ts` discipline per DDR-045): bearer-auth ingress, body validation, `runExport()` against `ExportContext{ serverOrigin: canvasBase }` with the render token attached to canvas-shell requests (same query-param mechanism the member's browser uses — read how `_config`'s `canvasUrl()` threads it), stream artifact + `X-Maude-Degraded` JSON header when degraded, hard wall-clock + RSS ceilings per job (mirror the build-sandbox contract), one job at a time per instance. `Dockerfile`: FROM the same base family as the hub image, add `chrome-headless-shell` at the pinned version the desktop spine uses, `bun install --frozen-lockfile`, copy `apps/studio/exporters` + its import closure. `wrangler.toml` + `worker.mjs`: own Worker, own container class, `max_instances` small (start 2), `sleepAfter` aggressive — repeat the cells' cost arithmetic in comments.
- **Pattern**: `apps/cells/wrangler.toml` (tag-is-the-instruction, workers_dev deploy-target note), `apps/hub/Dockerfile` (frozen lockfile, no second install).
- **Gotcha**: DDR-045 — never `dirname(fileURLToPath(import.meta.url))` in anything that may compile; DDR-176 — if any exporter dep needs a patch, the render package needs its OWN `patchedDependencies` entry.
- **Validate**: `docker build apps/render && docker run … /_health`; local round-trip: boot a desktop studio + the render container, force `remote` lane, export PNG/PDF/MP4, byte-compare PNG against a `local`-lane export of the same canvas (fidelity pin).

### Task 6: UPDATE cell/hub — dispatch wiring + token minting ✅ 2026-08-20 (mintRenderToken reused; MAUDE_RENDER_* via cellEnv→childEnv; wildcard canvas-origin allowlist)

- **Do**: Hub/cell config gains `MAUDE_RENDER_URL` + `MAUDE_RENDER_SECRET` (cloud: cell env from `apps/cells/wrangler.toml` vars + secret derived per-tenant or a fleet secret via `wrangler secret put`; self-host: hub env). On job dispatch the cell mints the render token (`mintRenderToken`, subject `render-service`, role `viewer`) with its own HUB_SECRET — the same secret the canvas-origin verifier already checks, so no new verifier. Hub proxy: route the reclassified rows through `can(role, 'export')`.
- **Pattern**: `render-token.mjs` mint/verify pair; `cell-do.mjs` per-tenant secret derivation from `CELL_SECRET_MASTER`.
- **Gotcha**: env applies at container start — a cell must restart to see `MAUDE_RENDER_URL` (document in rollout task). The worker→cell fetch crosses the public tenant hostname; confirm the canvas origin's token verifier accepts subject `render-service` (it validates shape, not enum — verify, don't assume).
- **Validate**: `cd apps/hub && node --test` (proxy + manifest suites); integration: enqueue via proxy as viewer/member/owner — all succeed (export is an all-roles capability); read-only kill-switch still refuses nothing it shouldn't.

### Task 7: UPDATE self-host tooling + docs — the maude-render sidecar ✅ 2026-08-21 (--render flag, compose sidecar, render-health verify; self-host skill + docs site)

- **Do**: (a) `cli/lib/workspace-plan.mjs` + `cli/commands/hub-workspace.mjs`: optional "render service" step in `workspace-up` — pull `ghcr.io/1agh/maude-render:<tag>`, generate `MAUDE_RENDER_SECRET`, wire both envs into the hub unit/compose; skippable with a clear "exports needing a browser will be disabled" note. **Coordinate with the in-flight session editing these files.** (b) `plugins/design/skills/self-host/SKILL.md` + `_targets.md`: add the sidecar stage to the interview (default: offer it; honor "do not steer"). (c) `site/content/docs/hub/self-host.mdx` + `deploy.mdx` + new export docs page: what the service is, the isolation contract (no secrets — quote the DDR), image pinning rule, compose snippet, and the without-it behavior. (d) `.github/workflows/hub-image.yml`-style publishing for `ghcr.io/1agh/maude-render` on `v*` tags.
- **Pattern**: existing self-host docs voice ("two different products that share one image"; "Pin the image tag").
- **Gotcha**: docs regen gates — `quality.site-content` will fail if generated site content goes stale; run the gen scripts and commit the diff.
- **Validate**: `pnpm --filter @maude/site build`; `maude hub workspace-up --dry-run` shows the new optional step.

### Task 8: UPDATE release + deploy plumbing — cloud.maude.sh ✅ 2026-08-21 (bump stamps render tag; render-deploy.yml; parity extended)

- **Do**: `scripts/bump-version.sh` stamps the image tag in `apps/render/wrangler.toml` (same mechanism as the cell tag); `render-deploy.yml` mirrors `cells-deploy.yml` tag-gating (wait for base image, build THE tag from wrangler.toml, assert it equals the release tag, push, `wrangler deploy` from `apps/render/`); `.ai/release-guide.md` + CLAUDE.md release-flow section gain the render lane + a "verify the render service rolled" check (deploy version visible at `/_health`).
- **Pattern**: the three documented hazards in `cells-deploy.yml`'s header — reproduce the protections, not just the steps.
- **Gotcha**: `scripts/check-version-parity.sh` — decide whether the render tag joins the parity set (recommended: yes, it's version-locked to the exporters it embeds).
- **Validate**: `bash scripts/check-version-parity.sh`; workflow dry parse (`act -n` or push to a branch — remember branch pushes must NOT roll anything).

### Task 9: ADD tests — the contract suite ✅ 2026-08-21 (lane tests, prune/manifest fail-first, containment except-list gate, token scope reused; 900 root + 904 sync green)

- **Do**: (a) containment: render image build asserts no `HUB_SECRET`/provider envs; `check-containment.sh` extended to grep that cell/hub images STILL exclude Chromium while `apps/render` is exempt; (b) token scope: render token minted for project A refused by project B's verifier; expired token refused; (c) lane: workspace + no URL → typed refusal; workspace + URL → remote dispatch (mock server); zip local in all lanes; (d) proxy: 404 for `/_api/export` (still), 2xx path for jobs rows per role.
- **Pattern**: fail-first (memory); `apps/studio` suites run alone (memory `maude-parallel-test-runs-contaminate`).
- **Validate**: `pnpm test && cd apps/studio && bun test test/sync-*.test.ts --timeout 20000` (the config `quality.tests` lane) + the new suites individually.

### Task 10: Security review gate ✅ 2026-08-21 (defender+attacker; 1 HIGH SSRF + 4 MEDIUM fixed in-diff, 2 MEDIUM accepted w/ follow-up in DDR-230; PASS WITH WARNINGS)

- **Do**: `/flow:validate-security` over the full diff — this feature deliberately amends the product's strongest security line. The ethical-hacker pass must specifically attack: token replay/scope-widening, cell→worker SSRF (worker fetches an attacker-supplied `canvasBase`? — it must ONLY accept the tenant hostname the token binds), artifact-stream poisoning back into the cell, tenant TSX escaping Chromium into the worker env (confirm: nothing worth stealing there — that's the design), and the `none`-lane misconfiguration path.
- **Validate**: 0 findings ≥ `security.severityFloor`; findings recorded in the graph.

### Task 11: Cross-platform scenario + smoke ✅ 2026-08-21 (spec authored .ai/scenarios/cloud-export-jobs; live run deferred to /done — needs a live fleet)

- **Do**: New scenario `cloud-export-jobs` — sign in to a workspace project (agent-browser web-desktop + web-mobile), open ⌘E, export PNG + ZIP, watch the notification center, download both, assert bytes non-empty and PNG dimensions match the artboard; on desktop assert the `local` lane still exports identically (regression). ios/android runners: mark skipped-with-reason (no native cloud client surface).
- **Validate**: `scenario-runner`: 0 blockers, parity_ok across non-skipped platforms.

### Task 12: Deploy to cloud.maude.sh + verify ⏳ What's New entry done + feed regenerated; live fleet deploy is a release-time op (fires on v* tag via render-deploy.yml) — deferred to release

- **Do**: Release per `.ai/release-guide.md` (annotated tag → npm + hub image + cell deploy + NEW render deploy). Set `MAUDE_RENDER_URL`/secret for the fleet (env lands at container start — restart cells per the wrangler.toml note, one tenant first: `alligators`, the existing pilot pattern), verify: `/_health` on the render Worker names the release; a real export from a real cloud project round-trips; then widen. Update the What's New feed via the `whats-new-entry` skill (pending entry; stamped at release).
- **Validate**: release-guide "verify the fleet actually rolled" + the new render check; live export succeeds on cloud.maude.sh.

---

## Validation

1. **Lint**: `pnpm lint`
2. **Types**: `cd apps/studio && bunx tsc --noEmit && bash scripts/check-tsc-coverage.sh`
3. **Tests**: `pnpm test && cd apps/studio && bun test test/sync-*.test.ts --timeout 20000` (+ new suites; studio suites run alone)
4. **Build**: `pnpm --filter @maude/site build`
5. **Parity/tarball/tokens/site-content**: the remaining `quality.*` gates from `.ai/workflows.config.json`
6. **Cross-platform scenario**: `scenario-runner` on `cloud-export-jobs` — 0 blockers
7. **Security**: Task 10 gate — 0 findings ≥ severityFloor
8. **Manual**: three-lane dialog states; self-host `workspace-up` with and without the sidecar; fidelity byte-compare local vs remote PNG

## Scenario Coverage

| Scenario | Covers | Status |
|----------|--------|--------|
| `cloud-export-jobs` | cloud export enqueue → notify → download (PNG + ZIP), desktop local-lane regression | 🆕 new |

## Acceptance Criteria

- [ ] All tasks completed (1–12)
- [ ] `/flow:utils-verify` passes after each task
- [ ] `/validate` passes overall (static, tests, build, scenario 0 blockers, a11y on dialog changes)
- [ ] DDR amendment recorded and ingested; no DDR-worthy decision left unrecorded
- [ ] Cell + hub images remain browser-free (containment gates green); render image passes its own no-secrets assert
- [ ] Export works on cloud.maude.sh (verified live) and the self-host sidecar path is documented in docs site + skill + `workspace-up`
- [ ] What's New entry added (pending, stamped at release)

---

## Retro (2026-08-21)

- **The RCA's debate paid off twice.** The Track 3 vs Track 4 flip (browser-side → external worker) came from the user's own push-back, and the second look surfaced the load-bearing fact — the exporter spine is already browser-native, so the worker reuses it unchanged. Encoding that verdict in the RCA meant the plan never re-litigated it.
- **Reusing existing primitives was the win.** `mintRenderToken`, the job queue, the `export` capability, the tag-gated deploy shape — almost nothing net-new in the trust model. The one net-new trust surface (the render service) is exactly where the security review found everything.
- **The security review earned its gate.** Attacker broke the SSRF allowlist (parsed-URL vs raw-string) and caught the write-capable forwarded token contradicting the DDR's own §c. Both were real, both shipped-blocking. Lesson reinforced: an allowlist that matches a string `fetch` will re-parse must match the PARSED form.
- **Concurrent-session coordination worked cleanly.** A peer held M7 changes interleaved in three of my files; a short SendMessage exchange (they commit the shared trio, I commit the rest atomically) avoided a clobber and the v0.51.0 import-coherence trap — jobs.ts + remote.ts shipped in one commit.
- **What to change next time:** the cross-platform scenario (`cloud-export-jobs`) can't run without a live fleet, so it's authored-but-unrun. A plan that ships a cloud feature should flag "scenario needs a live deploy to execute" at plan time so it's not a surprise at `/done`.

### Follow-ups (tracked in DDR-230)
- Render sharding across N named instances (per-tenant DoS fairness).
- Move render ingress to a Cloudflare Worker-to-Worker service binding (drop the public route + shared bearer).
- Live `cloud-export-jobs` scenario run once the fleet carries the render env.
- Fidelity byte-compare (remote vs local PNG) on a shared fixture canvas.
