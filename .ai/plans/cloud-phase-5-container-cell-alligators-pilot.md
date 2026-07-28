# Cloud Phase 5 — Cloudflare Container cell + alligators pilot (tenant-of-one, no money)

Part of the Maude Cloud arc — read `cloud-phase-0-economics-and-architecture.md` first. Requires Phases 1–4. First phase that touches vendor-operated infrastructure.

## Description

Package the Phase-4 workspace stack as a **tenant cell on Cloudflare Containers** (GA 2026-04: up to 4 GiB RAM / 0.5 vCPU, thousands of instances/account, Active-CPU pricing, DO-managed lifecycle with scale-to-zero): one container per project (hub + workspace-agent processes), a Worker as ingress (`<project>.cloud.maude.sh` — Cloudflare DNS + Workers routes, WS proxied to the container's DO), state durably in **R2**, provisioned by `maude cell up`. Enforce the containment invariant with a boot-assert + CI grep gate, then onboard **~/git/alligators** (2.3 GB, 266 MB `.design/assets`) as tenant #1 — dogfood before any billing exists.

**The phase's load-bearing engineering question is persistence.** Container disk is ephemeral; R2 can be FUSE-mounted but is explicitly not SSD-like — and SQLite over a network-ish filesystem is a corruption risk. Task 1 is a spike that decides between: (A) local ephemeral disk as working set + continuous replication to R2 (litestream-style for the SQLite DBs, `git bundle`/pack push for `/repo`) + rehydrate-on-boot, vs (B) FUSE-R2 for cold data only (assets already live in R2 natively). Bias: **A** — the Phase-2 backup + Phase-3 journal spine already exists; rehydrate-on-boot is the same code path as the restore drill, exercised on every wake.

## Metadata

- **Type**: New Capability | **Complexity**: High
- **App/Package**: new `infra/cell/` (container image + Worker ingress + DO lifecycle + renderer), `cli` (`maude cell`), `apps/hub` (cell hardening)
- **Dependencies**: Phases 1–4; Cloudflare account (Workers Paid), R2 bucket, `cloud.maude.sh` zone on Cloudflare DNS

## Context References

### Must-Read Files

- `.ai/plans/cloud-phase-4-selfhost-skill.md` — the provisioning engine being re-targeted at Cloudflare
- `apps/hub/Dockerfile` + `docker-compose.yml.template` — the stack the cell image packages (hub is Node — runs fine in a Container; nothing ports to workerd)
- Cloudflare docs: Containers (lifecycle/architecture, FAQ — instance types, disk, FUSE-R2), Durable Objects (the container-managing DO + WS hibernation), Workers routes/custom hostnames — **verify live limits at execution start; the GA is recent (2026-04) and numbers move**
- `apps/hub/src/backup.mjs` (Phase 2) + `apps/studio/sync/` journal (Phase 3) — the replication/rehydrate spine Task 1 reuses
- `apps/studio/exporters/_runtime.ts` + `exporters/index.ts` (164-175) — surfaces that must be unreachable (containment)

## Tasks

### Task 1: SPIKE + DECIDE cell persistence strategy

- **Do**: Prototype both: (A) local-disk working set + litestream-style SQLite replication to R2 + `/repo` incremental push (bundle/packfiles) + rehydrate-on-boot; (B) FUSE-R2 mount. Measure: boot-to-ready time for a 2.3 GB repo, write latency under live editing, and **kill -9 / forced-migration corruption behavior** for each. Record the decision + numbers in a DDR addendum.
- **Gotcha**: SQLite on FUSE-R2 without proper locking semantics can corrupt silently — treat (B) as disqualified for hot DBs unless proven otherwise; Container instances can be migrated/restarted by the platform at any time, so rehydrate-on-boot is not an edge case, it's the normal path.
- **Validate**: 20× kill -9 during live editing → zero data loss (journal + replication converge every time).

### Task 2: CREATE cell image + Worker ingress + `maude cell up|status|suspend|resume|destroy|upgrade`

- **Do**: `infra/cell/`: one container class per project — image = hub + workspace-agent (from the Phase-4 stack; Caddy dropped — TLS + routing is the Worker/Cloudflare edge now), instance 1–2 GiB; DO per project manages lifecycle (scale-to-zero on idle, wake on inbound WS/HTTP); Worker ingress maps `<project>.cloud.maude.sh` → the project's DO → container. R2 prefix `tenants/<id>/` (assets natively + replication target from Task 1). Secrets via Worker/Container secrets (DDR-164 custody); R2 credentials per-cell scoped API tokens, never the account master key. `cli/commands/cell.mjs` drives the Cloudflare API (same code path Phase 7's control plane will call). Cell birth runs the DDR-053 bootstrap + Phase-4 round-trip verifier.
- **Gotcha**: WS through Worker → DO → container must preserve the Hocuspocus Auth message flow and survive DO hibernation semantics; clean SQLite flush on the container's stop signal (test it).
- **Validate**: `maude cell up test-cell` → live subdomain, round-trip verified; `destroy` leaves zero orphans (container/DO state, R2 prefix, hostname — scripted sweep); wake-from-idle < 5 s to first sync frame.

### Task 3: CREATE containment gate

- **Do**: `apps/hub/test/cell-containment.test.mjs` + boot-assert in the cell entrypoint: export/Chromium/eval surfaces unreachable; CI grep-gate for the invariant (extends the Phase-3 workspace-mode assert). Any regression = release blocker.
- **Validate**: test fails loudly if an export route becomes reachable in a cell build.

### Task 4: MIGRATE alligators as tenant #1

- **Do**: `maude cell up alligators` + seed from ~/git/alligators; assets (266 MB) migrate through the S3 lane to R2; desktop connects from a second machine via the Phase-3 sign-in flow.
- **Validate**: live at `alligators.cloud.maude.sh`; edits autosave; media resolves cross-machine; git history intact; survives a forced container restart mid-session.

### Task 5: ADD pilot hardening

- **Do**: per-cell instance-type caps, R2/egress + Active-CPU cost telemetry (Cloudflare GraphQL analytics → simple roll-up), weekly **automated** restore drill (rehydrate path on a schedule into a throwaway cell), rolling image bump procedure with alligators as permanent canary.
- **Validate**: restore into a fresh cell succeeds; image bump on the live alligators cell with zero data loss.

## Exit gate

- [ ] Persistence decision recorded with kill -9 evidence (20× clean)
- [ ] Alligators live + used for real work ≥ 2 weeks (dogfood period), incl. ≥ 1 forced restart with zero loss
- [ ] Weekly restore drill scheduled; containment test in CI; destroy leaves zero orphans
- [ ] Cost telemetry recorded (real $/cell/mo vs Phase-0 estimates — feeds Phase 8 pricing)
