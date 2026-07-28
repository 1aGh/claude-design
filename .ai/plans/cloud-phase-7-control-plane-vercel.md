# Cloud Phase 7 — Control plane on Vercel (accounts, projects, invites, provisioner, reconciler)

Part of the Maude Cloud arc — read `cloud-phase-0-economics-and-architecture.md` first. Requires Phases 5–6. Billing still manual (no Stripe yet).

## Description

`apps/cloud` — a Next.js app on Vercel (same platform as the site) + Neon Postgres: accounts, organizations, **projects** (= cells), invites, and the tenant lifecycle driven through the Fly Machines API by a **desired-state reconciler** (Vercel cron). Webhooks/API calls only enqueue "reconcile now" — nothing is event-side-effect load-bearing.

## Metadata

- **Type**: New Capability | **Complexity**: High
- **App/Package**: new `apps/cloud` (Next.js App Router, Vercel), Neon Postgres, `infra/cell` (driven via Fly API)
- **Dependencies**: Phases 5–6. Vercel project + Neon; Fly API token as Vercel env secret; e-mail provider

## Context References

### Must-Read Files

- `cli/commands/cell.mjs` (Phase 5) — the Fly Machines API driver the reconciler reuses as a library (extract shared lib `infra/cell/lib.mjs`)
- `.design/ui/Studio Hub.tsx` + `CreateProject.tsx` — dashboard/create canvas priors; maude DS tokens
- `apps/hub/src/users.mjs` (Phase 2) — cell-level users; control-plane accounts are SEPARATE (cloud account ≠ cell user; the control plane provisions cell users via the cell admin API at invite time)
- Phase-1 umbrella DDR — tenant state machine `pending → active → past_due → suspended(30 d) → exported → purged`
- `vercel.ts` config conventions (`@vercel/config`) + Vercel cron (`CRON_SECRET` guard)

## Tasks

### Task 1: CREATE `apps/cloud` foundation

- **Do**: Next.js App Router on Vercel; Neon Postgres (accounts, orgs, projects, invites, jobs, audit); auth = email magic-link + GitHub OAuth reuse (DDR-108 vocabulary: "Sign in", never OAuth); UI per canvas priors, maude DS. CI vocabulary grep (banned: git words + `repo`/`repository`/`GitHub username`) on `apps/cloud` strings.
- **Validate**: unit + `agent-browser` smoke on preview deploy.

### Task 2: CREATE tenant state machine + job queue + reconciler

- **Do**: `projects` table carries the state machine; every transition dated + audited. Jobs table (`create|suspend|resume|destroy|upgrade`); a Vercel cron (hourly + on-demand trigger) runs the **reconciler**: desired state (from DB; later Stripe) vs actual (Fly API list) → converge via the Phase-5 cell lib; idempotent; partial-failure safe (re-run converges). Export-before-teardown enforced in the `destroy` path at the state-machine level — a purge without a completed export job is unrepresentable.
- **Gotcha**: Fly API rate limits — batch + backoff; reconciler must tolerate a cell mid-wake (auto_stop) without flapping.
- **Validate**: chaos suite — 20 create/suspend/resume/destroy cycles leave **zero orphans** (machines, volumes, DNS, R2 prefixes — scripted sweep); replayed + dropped job events converge.

### Task 3: WIRE invites + project creation end-to-end

- **Do**: Dashboard "New project" → job → cell birth → ready e-mail with the Phase-6 magic link. Invite by e-mail from the dashboard → control plane calls the cell admin API to mint the invite → magic-link e-mail. Cloud account ↔ cell user linkage recorded (GDPR: the controller/processor split from the Phase-1 DDR governs what the control plane stores about invitees — minimum: e-mail + linkage).
- **Validate**: e2e — create project + invite from the web UI, cold-start editing on a second machine, all self-serve.

## Exit gate

- [ ] Full self-serve loop (no Stripe): sign up → create project → invite → invitee edits — zero operator involvement
- [ ] Chaos suite green (zero orphans, replay/drop safe)
- [ ] `/flow:validate-security` on apps/cloud (auth + tenant boundary; severity floor medium)
- [ ] Vercel preview → production promotion flow documented
