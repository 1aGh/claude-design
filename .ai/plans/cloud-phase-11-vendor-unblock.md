# Cloud Phase 11 — Vendor unblock (OWNER, ~15 minutes)

> Debate-resolved arc (2026-07-29, kgai `debate-cloud-selfservice-gap-arc`).
> **Every later phase's deploy step is downstream of this one.** All four seats
> agreed: this is the first move, and it is the only one an agent cannot make.

## Tasks (all owner — browser/payment)

- [ ] **Workers Paid** (~$5/mo) on the Cloudflare account — unlocks Containers + Queues.
- [ ] **Enable R2** in the dashboard (ToS acceptance).
- [ ] **Zone:** delegate `cloud.maude.sh` (or the whole `maude.sh`) to Cloudflare DNS.
- [ ] Record in this file: account id, zone id, R2 bucket name for the control plane.
- [ ] Confirm Stripe sandbox keys are still the ones in the MCP session (no action if so).

## Exit gate

`maude kg` note + this plan updated with the ids; a re-probe (`cloudflare-api` MCP)
shows Containers and R2 accepting instead of refusing.

## Not in scope

Live Stripe entity, Resend, legal artifacts — needed for GA, not for the
alligators pilot (phases 12–17 run entirely on sandbox + test mode).
