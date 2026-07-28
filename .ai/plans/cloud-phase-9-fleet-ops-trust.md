# Cloud Phase 9 — Fleet operations + trust launch surface

Part of the Maude Cloud arc — read `cloud-phase-0-economics-and-architecture.md` first. Requires Phase 8. **Gate for lifting the ≤ 3 tenant cap** — you cannot responsibly onboard tenant #4 without this (breaker precondition).

## Description

Operating N cells as a fleet: version pinning, canary-first staged rollout, one-command rollback, health board, cost alarms — plus the public trust surface (DPA, subprocessors, breach process, audit-log UI) that makes "the vendor operates your workspace" honest and sellable.

## Metadata

- **Type**: New Capability | **Complexity**: Medium-High
- **App/Package**: `apps/cloud` (fleet board, audit UI), `infra/cell` (versioning), `site` (Trust page), legal docs
- **Dependencies**: Phase 8 (paying pilot tenants exist)

## Context References

### Must-Read Files

- `infra/cell/lib.mjs` + reconciler (Phase 7) — where version pinning + rollout waves land
- `.github/workflows/build-binaries.yml` + `hub-image.yml` — the release pipeline that produces the cell image (tag-driven); fleet rollout consumes these tags
- Phase-1 umbrella DDR — operator-trust posture being made public (break-glass, no-standing-access, disclosure)
- Phase-6 access-log implementation — the audit trail the UI surfaces

## Tasks

### Task 1: ADD fleet versioning + staged rollout

- **Do**: every cell pins an image tag in the DB; `maude fleet upgrade --to vX.Y.Z` rolls waves: alligators (permanent canary) → wait/health-check → remaining cells in batches; one-command rollback re-pins + restarts; upgrade never proceeds past a failing health check. Support runbook: "a bespoke cell is a bug" — drift detection compares every cell's config to the template.
- **Validate**: upgrade all cells with one command; **one rehearsed rollback** on a real (test) tenant with zero data loss.

### Task 2: ADD fleet health board + cost telemetry

- **Do**: `apps/cloud` operator view: per-cell state (machine status, last backup, last restore-drill, disk %, version), Fly cost roll-up vs Phase-0 model, budget alarms. Weekly automated restore drill across a sample of cells lands in CI/cron with visible status.
- **Validate**: board reflects a manufactured failure (stopped machine, stale backup) within one reconcile cycle.

### Task 3: FINISH public trust surface

- **Do**: maude.sh Trust page: DPA (processor terms), subprocessor list (Vercel, Fly, Cloudflare R2, Stripe, e-mail provider), breach process (72 h), data residency (EU), hard-delete SLA, break-glass policy + the customer-visible audit log (Phase 6) documented. The DDR-054 disclosure appears **inside signup**, not buried. Legal review by a human before publish.
- **Validate**: site builds; every claim on the Trust page maps to an implemented mechanism (checklist audit — no aspirational claims).

## Exit gate

- [ ] One-command fleet upgrade + rehearsed rollback, zero data loss
- [ ] Weekly restore drill green + visible on the board
- [ ] Trust page live; every claim mechanically true
- [ ] Tenant cap lifted only after all above pass
