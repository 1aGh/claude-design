# Cloud Phase 5 — Fly tenant cell + alligators pilot (tenant-of-one, no money)

Part of the Maude Cloud arc — read `cloud-phase-0-economics-and-architecture.md` first. Requires Phases 1–4. First phase that touches vendor-operated infrastructure.

## Description

Package the Phase-4 workspace stack as a **tenant cell on Fly.io Machines** (one Fly app per project: machine + volume + R2 prefix + `<project>.cloud.maude.sh`), provision it with `maude cell up`, enforce the containment invariant with a boot-assert + CI grep gate, and onboard **~/git/alligators** (2.3 GB, 266 MB `.design/assets`) as tenant #1 — dogfood before any billing exists.

## Metadata

- **Type**: New Capability | **Complexity**: High
- **App/Package**: new `infra/cell/` (cell template + renderer), `cli` (`maude cell`), `apps/hub` (cell hardening)
- **Dependencies**: Phases 1–4; Fly.io org + API token; Cloudflare R2 bucket; `*.cloud.maude.sh` DNS (Cloudflare, CNAME → Fly)

## Context References

### Must-Read Files

- `.ai/plans/cloud-phase-4-selfhost-skill.md` — the provisioning engine being re-targeted at Fly
- `apps/hub/fly.toml.template` — existing Fly template (single-hub); the cell extends it (hub + agent processes, volume mount, auto_stop)
- `site/content/docs/hub/pricing.mdx` — documents the auto_stop behavior (~2 s wake) the cell relies on
- Fly Machines API docs (REST) — cells are managed via API, not `flyctl`, so Phase 7's control plane can drive them from Vercel
- `apps/studio/exporters/_runtime.ts` + `exporters/index.ts` (164-175) — surfaces that must be unreachable (containment)

## Tasks

### Task 1: CREATE cell template + `maude cell up|status|suspend|resume|destroy|upgrade`

- **Do**: `infra/cell/`: one Fly app per project — machine (shared-1x 1 GB; hub + workspace-agent as processes; `auto_stop_machines` on, wake-on-connect), volume (10 GB default) mounted at `/data` + `/repo`, R2 prefix `tenants/<id>/`, secrets via Fly secrets (DDR-164 custody), subdomain cert. `cli/commands/cell.mjs` drives the Fly **Machines REST API** (token from env/0600 config; same code path Phase 7's control plane will call). Cell birth runs the DDR-053 bootstrap + Phase-4 round-trip verifier.
- **Gotcha**: volume + auto_stop interplay — the machine must flush SQLite + journal cleanly on stop signal (test it); R2 credentials are per-cell scoped API tokens, never the account master key.
- **Validate**: `maude cell up test-cell` → live subdomain, round-trip verified, `destroy` leaves zero orphans (machine, volume, DNS, R2 prefix — scripted sweep).

### Task 2: CREATE containment gate

- **Do**: `apps/hub/test/cell-containment.test.mjs` + boot-assert in the cell entrypoint: export/Chromium/eval surfaces unreachable; CI grep-gate for the invariant (extends the Phase-3 workspace-mode assert). Any regression = release blocker.
- **Validate**: test fails loudly if an export route becomes reachable in a cell build.

### Task 3: MIGRATE alligators as tenant #1

- **Do**: `maude cell up alligators` + seed from ~/git/alligators; assets (266 MB) migrate through the S3 lane to R2; desktop connects from a second machine via the Phase-3 sign-in flow.
- **Validate**: live at `alligators.cloud.maude.sh`; edits autosave; media resolves cross-machine; git history intact.

### Task 4: ADD pilot hardening

- **Do**: per-cell CPU/mem limits (Fly machine config), disk/egress alarms (Fly metrics → simple webhook), weekly **automated** restore drill (Phase-2 drill on a schedule, restoring into a throwaway cell), rolling image bump procedure with alligators as permanent canary.
- **Validate**: restore from R2 backup into a **fresh** cell succeeds; image bump on the live alligators cell with zero data loss.

## Exit gate

- [ ] Alligators live + used for real work ≥ 2 weeks (dogfood period)
- [ ] Restore-into-fresh-cell proven; weekly drill scheduled
- [ ] Containment test in CI; destroy leaves zero orphans
- [ ] Cost telemetry recorded (real $/cell/mo vs Phase-0 estimates — feeds Phase 8 pricing)
