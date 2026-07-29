# Cloud Phase 15 — `maude cell up` for real + alligators as tenant-of-one

> SHIPPER: "the only phase that is not glue." TIMEBOXED — if the persistence
> spike (Containers ephemeral disk × stateful Hocuspocus+SQLite) proves slow or
> lossy, the pre-agreed fallback is Fly.io Machines (already named in DDR-193
> alternatives). Do not let this phase silently absorb the arc.

## Tasks

- [ ] T1 — build + push the cell image (`infra/cell/`) to a registry the account
  can pull from; containment boot-assert verified in the pushed artifact.
- [ ] T2 — `maude cell up <tenant>`: thin effects over `cellResources()` ordering
  (dns → worker-route → container → DO → r2-token → r2-prefix). Destroy is the
  tested `destroySweep` order. Every step idempotent; re-run is the repair path.
- [ ] T3 — **persistence spike** (timebox: 2 days): SQLite on ephemeral disk +
  R2 checkpoint/rehydrate cycle under kill -9; measure boot-from-R2 latency for
  a realistic doc set. Verdict written into the plan either way.
- [ ] T4 — wire reconciler `applyActions` to the real cell API (create/suspend/
  resume/destroy) — the last fictional seam becomes real.
- [ ] T5 — **alligators tenant-of-one**: onboard `~/git/alligators` (repo → cell,
  media → R2 prefix). Owner-driven dogfood BEFORE any billing UI touches it.
- [ ] T6 — convert workspace-up/cell verification steps that today print
  SKIPPED into real passes where the cell makes them possible.

## Acceptance criteria

- [ ] A cell provisions from one command, survives kill -9 with zero data loss,
  suspends and resumes via the reconciler.
- [ ] alligators syncs from the desktop against its cell; media lands in R2.
- [ ] Timebox honored: a failed spike produces a WRITTEN fallback decision, not
  an extended silence.

## Blocked on

Phase 11 entirely (Containers + R2 + zone). Everything here except T3's local
half waits for it.
