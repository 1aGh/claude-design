# DDR-199 — Tenant cells on Cloudflare: the data plane is its own Worker, and four platform facts that only deploying reveals

- **Date:** 2026-07-29
- **Status:** accepted
- **Scope:** `repo:maude`, `dept:dev`
- **Implements:** [DDR-193](./DDR-193-maude-cloud-tenant-cells-and-containment-invariant.md) · [DDR-195](./DDR-195-workspace-cell-enforcement-assets-and-autosave-history.md)
- **Builds on:** [DDR-198](./DDR-198-server-owned-git-history-in-the-hub.md)
- **Plan:** `.ai/plans/archive/cloud-phase-15-cell-up-alligators.md`

## Context

Cloud Phase 5 designed the cell and wrote its Dockerfile and entrypoint. Phase
15 tried to run one. **It had never been built, and could not be:** it
installed `better-sqlite3` under Bun — precisely the incompatibility that made
the hub runtime Node (DDR-052) — and its entrypoint invoked
`src/rehydrate.mjs`, a file that did not exist, so every cold start would have
refused to boot.

## Decisions

### 1. A cell is the hub image, not a second image

`infra/cell/Dockerfile` now derives `FROM ${HUB_IMAGE}` and adds only what
makes it a tenant: a build-time containment assertion, R2 rehydrate, tenant
scoping. One dependency tree instead of two, which removes the class of bug
where a cell and a hub disagree about what they are running.

### 2. The data plane is a SEPARATE Worker from the control plane

**`wrangler deploy` reconciles a script's routes and deletes any custom domain
not declared in its config.** Tenant hostnames are created per project at
provision time, so they can never live in a committed config — every
control-plane deploy would silently unroute every customer. This is not
hypothetical; it removed `alligators.cloud.maude.sh` mid-phase.

The split is also right on its own terms: the control plane holds billing,
identity and the platform master secret; a cell holds one tenant's work
(DDR-193). Deploying one must not be able to take down the other.

### 3. Tenant hostnames are Worker CUSTOM DOMAINS

Two shapes were deployed and both failed:

| Attempt | Why it failed |
| --- | --- |
| `*.cloud.maude.sh/*` route | free Universal SSL covers the apex + **one** level, so the third-level name is not on the certificate. The symptom is a TLS handshake failure with no HTTP status to read. |
| `cell-*.maude.sh/*` route | Cloudflare rejects it outright — a wildcard is allowed only at the **start** of a hostname pattern. |

A Worker custom domain provisions the DNS record **and** a certificate for any
hostname at any depth. So a cell's hostname is created per tenant at provision
time — which is what `cellResources()` already modelled (`dns` and
`worker-route` as per-cell resources, not global config).

Advanced Certificate Manager ($10/mo) would buy back a wildcard. Not worth a
recurring bill for a shape we can provision per tenant for nothing.

### 4. `startOptions.envVars` REPLACES the image's ENV

It does not merge. The cell booted, answered `/health`, and quietly had no
`MAUDE_REPO_DIR` and no workspace mode — no checkout, no history, no seed — and
nothing in any response said so. **Everything a cell needs is now listed
explicitly in `cellEnv()`, even when the Dockerfile also sets it.**

### 5. A container image rollout needs a DEPLOYED Worker version

A Worker with no routes and no triggers uploads a version but never *deploys*
one (`No targets deployed`), and a container rollout attaches to a deployment.
Every deploy printed `image = v1 → v2  SUCCESS` while the application kept
running v1 — for five attempts. `workers_dev = true` gives the script one
deployable target. `max_instances` is also the count the platform tries to keep
**scheduled**, not the count in use; three sat in `scheduling` forever.

### 6. Per-tenant secrets are DERIVED, not shared and not stored

`HUB_SECRET = HMAC(master, "maude-cell:hub-secret:<tenant>")`. One leaked cell
is not an operator credential for every other project; rotating the master
rotates every cell; no per-tenant secret store has to exist. The master never
enters a container. The same derivation gives each tenant its initial admin
password — an initial credential of exactly the status `workspace-up` prints.

### 7. A cell must be able to say what happened at boot

**A cell has no console.** Its stdout reaches nobody — `wrangler tail` shows the
Worker, not the container. The only way to answer "did the seed clone work?"
was to watch a bucket for ten minutes and infer. `/health` now reports the
workspace facts (checkout present, seed configured, storage configured, canvas
count): facts, not internals, safe on an unauthenticated endpoint — which is
the whole point, because when you need it, authentication is what is broken.

## Durability (the timeboxed spike, T3)

**Verdict: PASSED, on Cloudflare Containers. No fallback to Fly.io needed.**

The checkout rides in the **same backup generation** as the documents, as a
verified `git bundle`. Restoring documents from 03:00 beside a checkout from
02:00 would give a workspace whose documents reference canvases the checkout
does not have — corruption that reads as an app bug for weeks.

Measured locally against a real cell image: `kill -9` with **both volumes
deleted**, then a fresh cell — documents, users, git history and the sentinel
canvas all restored from object storage. Cold boot **383 ms** for a small doc
set, 686 ms with a seed configured.

Two isolation holes surfaced on the way:

- `MAUDE_BACKUP_PREFIX` was set for the restore half only, never exported. Every
  cell wrote its generations to the same unscoped keys.
- Media had no tenant scope at all — safe while every key was a content hash
  (same name ⇒ same bytes), unsafe the moment authored paths were admitted.

## Consequences

- `apps/cells` is a new Worker; `apps/cloud` no longer carries a DO.
- Cells are provisioned by creating a Worker custom domain, so `maude cell up`
  has a real API to call for its `dns` + `worker-route` steps.
- The R2 credential is currently account-scoped with per-tenant key prefixes,
  not the per-cell scoped token `cellResources()` names. Prefix isolation is
  enforced in code and tested; the scoped token remains open.

## Open

The alligators seed clone does not complete inside the deployed cell (health
reports `checkout: present, canvases: 0` — the signature of a failed clone
followed by a fresh `git init`). The same URL and token seed the same repo
correctly into a local cell, so this is environmental to the deployed
container. `/health` was extended precisely so the next attempt reads the
answer instead of guessing it; the seed OUTCOME still needs to be reported
there too.
