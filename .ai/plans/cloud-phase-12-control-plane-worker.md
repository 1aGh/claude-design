# Cloud Phase 12 — Control-plane Worker (the effects layer over apps/cloud)

> The decision layers (`reconcile.mjs`, `fleet.mjs`, `pricing.mjs`, `schema.sql`)
> exist and are tested. This phase gives them the body they never had: a
> deployable Worker. SHIPPER's rule applies: **nothing else in this phase** —
> it ends with a live `/health` at `cloud.maude.sh` and nothing more ambitious.

## Tasks

- [ ] **T1 — `apps/cloud/wrangler.toml`**: Worker `maude-cloud`, D1 binding (create
  `maude-cloud` DB via MCP — D1 works on Free, so this is buildable NOW), Queues
  producer/consumer (deploy-gated on Phase 11), cron trigger (hourly reconcile),
  static assets dir for the signup SPA (Phase 13 fills it).
- [ ] **T2 — `apps/cloud/worker.mjs`**: Hono (or itty) entry. Routes this phase:
  `GET /health` (version + D1 reachability), `POST /webhooks/stripe`
  (signature verify → enqueue reconcile job — the webhook NEVER carries an
  instruction, DDR-196), cron handler → `reconcile()` over all projects.
  Effects layer must stay thin: every branch delegates to the tested decision
  modules; new logic goes THERE with a test, never inline in the worker.
- [ ] **T3 — D1 migration runner**: apply `schema.sql` idempotently
  (`schema_migrations` table already designed). Local: `wrangler d1 execute`
  against the real D1 instance (reachable on Free tier).
- [ ] **T4 — tests**: worker routes unit-tested with a D1-shaped stub for the
  BINDING only (never mocking Cloudflare's API semantics we haven't seen —
  DDR-196 rejected fictional mocks; a binding stub passes through to real
  SQLite, which D1 is).

## Acceptance criteria

- [ ] `wrangler deploy --dry-run` clean; unit tests green.
- [ ] D1 instance exists with schema applied (verifiable via MCP today).
- [ ] Deploy + live `/health` — **gated on Phase 11**; until then reported SKIPPED.

## Decisions to record

- Worker framework choice + the thin-effects rule as a lint/CI check if feasible.
