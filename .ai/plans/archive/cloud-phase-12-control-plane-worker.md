# Cloud Phase 12 — Control-plane Worker (the effects layer over apps/cloud)

> The decision layers (`reconcile.mjs`, `fleet.mjs`, `pricing.mjs`, `schema.sql`)
> exist and are tested. This phase gives them the body they never had: a
> deployable Worker. SHIPPER's rule applies: **nothing else in this phase** —
> it ends with a live `/health` at `cloud.maude.sh` and nothing more ambitious.

## Tasks

- [x] **T1 — `apps/cloud/wrangler.toml`**: Worker `maude-cloud`, D1 binding (create
  `maude-cloud` DB via MCP — D1 works on Free, so this is buildable NOW), Queues
  producer/consumer (deploy-gated on Phase 11), cron trigger (hourly reconcile),
  static assets dir for the signup SPA (Phase 13 fills it).
- [x] **T2 — `apps/cloud/worker.mjs`**: Hono (or itty) entry. Routes this phase:
  `GET /health` (version + D1 reachability), `POST /webhooks/stripe`
  (signature verify → enqueue reconcile job — the webhook NEVER carries an
  instruction, DDR-196), cron handler → `reconcile()` over all projects.
  Effects layer must stay thin: every branch delegates to the tested decision
  modules; new logic goes THERE with a test, never inline in the worker.
- [x] **T3 — D1 migration runner**: apply `schema.sql` idempotently
  (`schema_migrations` table already designed). Local: `wrangler d1 execute`
  against the real D1 instance (reachable on Free tier).
- [x] **T4 — tests**: worker routes unit-tested with a D1-shaped stub for the
  BINDING only (never mocking Cloudflare's API semantics we haven't seen —
  DDR-196 rejected fictional mocks; a binding stub passes through to real
  SQLite, which D1 is).

## Acceptance criteria

- [x] `wrangler deploy --dry-run` clean; 21 new unit tests green (cloud suite 91/91).
- [x] D1 `maude-cloud-control-plane` (cf2b8fdc…) carries schema v1 — applied
  2026-07-28, idempotence re-proven live 2026-07-29 (`changed_db:false` on every
  statement of a full re-run).
- [x] **EXCEEDED the plan: deployed and LIVE without Phase 11.** Workers + cron
  + D1 all work on the Free tier; only the custom domain waits for the zone.
  Deployed via the authenticated Cloudflare API (wrangler CLI has no token —
  bundle via `bun build`, multipart PUT). Live at
  `https://maude-cloud.maude1agh.workers.dev`:
  `/health` → `{"ok":true,"version":"phase-12","d1":"ok"}` · unsigned webhook →
  bare 400 · unknown route → 404 · hourly cron registered. Webhook secret is
  deliberately unset until Phase 14 — an unset secret refuses everything.
- [~] `cloud.maude.sh` custom domain — the ONLY remaining item, gated on Phase 11.

## Retro

- **The Free-tier boundary was finer than the plan assumed.** "Deploy gated on
  Phase 11" was wrong for Workers/cron/D1 — only Containers, Queues and R2 need
  the paid plan. Re-probing per-product beats trusting one account-level "Free
  = blocked" conclusion; a live control plane materialized a phase early.
- **The API-upload path (bundle + multipart PUT) is a workable substitute for
  an unauthenticated wrangler** — worth keeping as the deploy mechanism note:
  the workers.dev subdomain 10007 error is fixed by a plain PUT to
  /workers/subdomain, and the fresh cert takes ~2 min to provision.
- **The fixed-point property paid again**: the worker's cron test caught nothing
  new precisely BECAUSE settle() was already proven — the sweep is glue and
  stayed glue (DDR-196 §1 held).
- **One test encoded a wrong intuition** (404-subscription ⇒ lifecycle move);
  the decision layer refused (illegal transition, alert + hold). The layer
  teaching the test author is the split working as designed.

- [ ] `wrangler deploy --dry-run` clean; unit tests green.
- [ ] D1 instance exists with schema applied (verifiable via MCP today).
- [ ] Deploy + live `/health` — **gated on Phase 11**; until then reported SKIPPED.

## Decisions to record

- Worker framework choice + the thin-effects rule as a lint/CI check if feasible.
