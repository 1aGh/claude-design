# Cloud Phase 7 — Control plane on Cloudflare Workers (accounts, projects, invites, provisioner, reconciler)

Part of the Maude Cloud arc — read `cloud-phase-0-economics-and-architecture.md` first. Requires Phases 5–6. Billing still manual (no Stripe yet).

## Description

`apps/cloud` — the control plane as a Cloudflare Worker: **Hono API + D1** (accounts, orgs, projects, invites, jobs, audit) + **Queues** (job execution) + **Cron Triggers** (hourly reconciler) + a static dashboard (Vite React, maude DS) served from Workers static assets. One infra with the data plane: the provisioner calls the same Cloudflare API the Phase-5 `maude cell` CLI uses. Webhooks/API calls only enqueue "reconcile now" — nothing is event-side-effect load-bearing.

(Alternative recorded, not chosen: Next.js via `@opennextjs/cloudflare` — heavier, and a control plane doesn't need SSR. Decide finally at execution start; the API/D1/Queues shape is identical either way.)

## Metadata

- **Type**: New Capability | **Complexity**: High
- **App/Package**: new `apps/cloud` (Worker: Hono + D1 + Queues + static dashboard), `infra/cell` (driven via shared lib)
- **Dependencies**: Phases 5–6. Cloudflare Workers Paid; D1; Queues; e-mail provider (Resend) API key as Worker secret

## Context References

### Must-Read Files

- `cli/commands/cell.mjs` + `infra/cell/` (Phase 5) — the Cloudflare API driver; extract shared lib `infra/cell/lib.mjs` the Worker imports
- `.design/ui/Studio Hub.tsx` + `CreateProject.tsx` — dashboard/create canvas priors; maude DS tokens
- `apps/hub/src/users.mjs` (Phase 2) — cell-level users; control-plane accounts are SEPARATE (cloud account ≠ cell user; the control plane provisions cell users via the cell admin API at invite time)
- Phase-1 umbrella DDR — tenant state machine `pending → active → past_due → suspended(30 d) → exported → purged`
- Cloudflare docs: D1 (limits/consistency), Queues (at-least-once semantics — handlers must be idempotent), Cron Triggers, Workers static assets

## Tasks

### Task 1: CREATE `apps/cloud` foundation

- **Do**: Worker (Hono) + D1 schema (accounts, orgs, projects, invites, jobs, audit); auth = email magic-link + GitHub OAuth reuse (DDR-108 vocabulary: "Sign in", never OAuth); session cookies (HttpOnly, SameSite=Lax) + CSRF on mutations — the DDR-053 Bearer-only stance stays true for machine/cell APIs, browser dashboard uses cookies (record the split in the Phase-1 DDR if not already). Dashboard = static Vite React per canvas priors, maude DS. CI vocabulary grep (banned: git words + `repo`/`repository`/`GitHub username`) on `apps/cloud` strings.
- **Validate**: unit (vitest + workerd pool) + `agent-browser` smoke on a preview deployment (workers.dev preview URL).

### Task 2: CREATE tenant state machine + job queue + reconciler

- **Do**: `projects` table carries the state machine; every transition dated + audited. Jobs (`create|suspend|resume|destroy|upgrade`) go through **Queues** (at-least-once ⇒ handlers idempotent by design); a **Cron Trigger** (hourly + on-demand enqueue) runs the reconciler: desired state (from D1; later Stripe) vs actual (Cloudflare API list) → converge via `infra/cell/lib.mjs`; partial-failure safe (re-run converges). Export-before-teardown enforced at the state-machine level — a purge without a completed export job is unrepresentable.
- **Gotcha**: Cloudflare API rate limits — batch + backoff; reconciler must tolerate a cell mid-wake (scale-to-zero) without flapping; D1 has no long transactions — design idempotent steps, not multi-statement atomicity.
- **Validate**: chaos suite — 20 create/suspend/resume/destroy cycles leave **zero orphans** (containers/DO state, hostnames, R2 prefixes — scripted sweep); replayed + dropped queue messages converge.

### Task 3: WIRE invites + project creation end-to-end

- **Do**: Dashboard "New project" → job → cell birth → ready e-mail (Resend) with the Phase-6 magic link. Invite by e-mail from the dashboard → control plane calls the cell admin API to mint the invite → magic-link e-mail. Cloud account ↔ cell user linkage recorded (GDPR: the controller/processor split from the Phase-1 DDR governs what the control plane stores about invitees — minimum: e-mail + linkage).
- **Validate**: e2e — create project + invite from the web UI, cold-start editing on a second machine, all self-serve.

## Exit gate

- [ ] Full self-serve loop (no Stripe): sign up → create project → invite → invitee edits — zero operator involvement
- [ ] Chaos suite green (zero orphans, replay/drop safe)
- [ ] `/flow:validate-security` on apps/cloud (auth + tenant boundary; severity floor medium)
- [ ] Preview → production promotion flow documented (wrangler environments)
