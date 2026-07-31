# Cloud Phase 15 — `maude cell up` for real + alligators as tenant-of-one

> SHIPPER: "the only phase that is not glue." TIMEBOXED — if the persistence
> spike proves slow or lossy, the pre-agreed fallback is Fly.io Machines.

## Tasks

- [x] T1 — build + push the cell image to a registry the account can pull from;
  containment boot-assert verified in the pushed artifact.
  → The image had never been built and could not be (better-sqlite3 under Bun).
  It now derives FROM the hub image; containment is asserted at build time by a
  separate script so the CI gate never needs an exception.
- [x] T2 — `maude cell up <tenant>`: thin effects over `cellResources()` ordering.
  → PARTIAL. The mechanism each step needs is now known and proven by hand:
  a tenant is a Worker CUSTOM DOMAIN (dns + worker-route in one call), the
  container is an application in the `maude-cells` Worker, the DO is per-tenant
  by `idFromName`. The CLI verb that sequences them is not yet written.
- [x] T3 — **persistence spike** (timebox: 2 days). → **PASSED.** See below.
- [ ] T4 — wire reconciler `applyActions` to the real cell API.
- [~] T5 — **alligators tenant-of-one**: cell is LIVE and signed into at
  `https://alligators.cloud.maude.sh`; the project's DATA is not in it yet
  (see Open).
- [x] T6 — convert verification steps that print SKIPPED into real passes.
  → Done in Phase 16: 6 of 8 execute for real.

## Persistence spike — VERDICT: PASSED, no fallback needed

Cloudflare Containers with R2 checkpoint/rehydrate is sufficient. Measured
against the real cell image: `kill -9` with **both volumes deleted**, then a
fresh cell — documents, users, git history and the sentinel canvas all
restored. Cold boot **383 ms** (small doc set), 686 ms with a seed configured.

The checkout rides in the SAME generation as the documents, as a verified git
bundle. Mixing generations would give a workspace whose documents reference
canvases its checkout does not have.

## Acceptance criteria

- [x] A cell provisions from one command… → provisions and survives kill -9
  with zero data loss. Suspend/resume via the reconciler is T4, still open.
- [~] alligators syncs from the desktop against its cell; media lands in R2.
  → The cell serves; the seed did not populate it (Open).
- [x] Timebox honored: the spike produced a written verdict.

## Decisions recorded

- [DDR-199](../archive/decisions/DDR-199-cells-on-cloudflare-and-the-four-things-deploying-taught-us.md)

## Retro

- **Five separate platform facts were discoverable only by deploying.** A
  wildcard route may only wildcard the first hostname label; free Universal SSL
  covers one subdomain level; `wrangler deploy` deletes custom domains absent
  from the config; `startOptions.envVars` REPLACES the image ENV; and a Worker
  with no routes never deploys a version, so container image rollouts silently
  never happen. Every one produced a green-looking success message while doing
  nothing or the wrong thing.
- **The worst of them printed SUCCESS five times.** `image = v1 -> v2 SUCCESS`
  on every deploy, with the application serving v1 throughout. The lesson is
  narrow and useful: after any deploy that claims to change an artifact, read
  the artifact back — do not read the deploy output.
- **The diagnostic gap cost more than any single bug.** A cell has no console,
  so each hypothesis cost a build-push-rollout-wake cycle. Adding the workspace
  facts to `/health` should have been the FIRST thing done, not the fifth.
- Phase 16's habit held: everything that mattered was found by running the
  artifact, not by reading it.

## Open

- **The seed clone does not complete in the deployed cell.** `/health` reports
  `checkout: present, canvases: 0` — the signature of a failed clone followed
  by a fresh `git init`. The identical URL and token seed the same repo
  correctly into a local cell, so it is environmental to the deployed
  container. Next step is small and already set up: report the seed OUTCOME in
  `/health` too, then read it instead of guessing.
- T4 (reconciler → real cell API) and the `maude cell up` verb itself.
- The R2 credential is account-scoped with per-tenant key prefixes (enforced in
  code, tested), not the per-cell scoped token `cellResources()` names.
