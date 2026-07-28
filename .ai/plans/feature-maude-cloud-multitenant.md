# Feature: Maude Cloud — paid multi-tenant hosted Maude on AWS (maude.sh), Phases 5–11

Validate docs and codebase patterns before implementing. This is **Part 2** of the remote-Maude arc — it builds strictly on Part 1 (`feature-remote-workspace-server.md`, Phases 1–4) and must not start before Part 1's gates pass. Produced by a four-seat divergent debate (builder / shipper / breaker / user-advocate, reduce tier per DDR-130).

## Description

A **paid, vendor-operated Maude Cloud** sold on maude.sh: register → pay via Stripe → create a project → invite teammates; invitees download Maude Desktop, sign in via a magic link, and edit the projects assigned to them. Architecture: **"Landlord estate with tenant cells"** — one AWS estate host (EC2, eu-central-1) running one isolated cell per tenant (own hub + workspace-agent containers, own volume, own S3 prefix — the exact Part-1 compose stack), fronted by one Caddy with on-demand TLS on `*.cloud.maude.sh`. Multi-tenancy exists **only in the control plane** (accounts, Stripe, provisioning) which lives on the existing Vercel site + Postgres, driving the estate through a **pull-based agent + desired-state reconciler** (no AWS credentials on Vercel, no load-bearing webhooks). Pilot tenant: **~/git/alligators** (2.3 GB, 266 MB `.design/assets` — design-heavy, non-code), onboarded manually **before** any money moves.

## User Story

As a **designer or small team that doesn't want to self-host**, I want to pay for Maude Cloud on maude.sh, create a project, and invite my team by email, so that everyone edits together with autosave while Maude runs the infrastructure — and I can export or mirror everything to my own GitHub at any time.

## Problem

Part 1 gives teams a self-hostable workspace server, but non-technical buyers won't run a VPS. There is no hosted offer, no account/billing layer, no tenant lifecycle, and the public site currently promises "There is no Maude SaaS tier" — a stance this feature consciously reverses (openly, keeping self-host free and first-class).

## Solution — debate consensus + resolved forks

**Consensus (all four seats):** per-tenant cell isolation, never a shared Yjs process; GitHub custody option (a) — Maude-internal git on the tenant volume is authoritative, customer's GitHub is an *optional mirror* via a GitHub App **they** install; alligators pilot before Stripe; no browser editing and no server-side Chromium anywhere in the cloud; one-click full export (git bundle + assets tarball) shipped and verified **before** the first paid signup; eu-central-1 only.

**The central trust decision (breaker's reframe, adopted):** Part 1's "no vendor-operated instance until Direction B" gate is replaced — Direction B exists nowhere as a spec, making the gate unfalsifiable. The replacement is a **written, testable containment invariant**:

> **No tenant-authored TSX is ever evaluated by vendor-operated compute.** Cells run sync + git + asset storage only. Boot-assert + grep-gate in CI, extending Part 1's workspace-mode export-refusal. If any future phase (share-link thumbnails, browser editing) needs to break this, Direction B (structured non-executable synced unit) returns as its hard prerequisite.

Isolation solves cross-tenant blast radius; it does **not** solve custody — the vendor operates every cell and can technically see tenant IP + presence (DDR-054). That is handled by posture, not denial: encryption at rest, no-standing-access policy with break-glass + customer-visible audit trail, the DDR-054 disclosure **inside the signup flow**, DPA + subprocessor list, hard-delete SLA.

**Fork resolutions:**
- **Topology — shipper's "Landlord" over builder's per-tenant Fargate.** One EC2 estate (t4g.medium, EBS + S3) holds dozens of 256 MB cells; the existing compose/Caddyfile templates ARE the cell — one artifact for self-hosters and cloud. Builder's fleet machinery is adopted where it's cheap (desired-state reconciler, tenant state machine, canary upgrades, IaC for the estate itself); Fargate-per-tenant remains the named scale-out/enterprise path ("your own box, same compose"). Declared honestly per breaker: the shared estate Caddy is vendor-operated ingress that terminates TLS for all cells.
- **Billing — advocate's shape.** Flat per project/month, **unlimited invitees** (per-seat taxes the invite — the one action the product exists for), generous included storage (~5 GB) + storage blocks above it (alligators proves storage, not seats, is the cost driver). Stripe Checkout + hosted Customer Portal + **Stripe Tax** (EU VAT, VAT-ID capture, CZK/EUR display). 14-day trial **with card** (idle unreapable free cells are a real cost — shipper). Concrete price points in this plan are placeholders; the final numbers are the owner's call.
- **Control-plane store:** Vercel/Neon Postgres (not Aurora) in v1.
- **Vocabulary (advocate, adopted as a DDR amendment):** the DDR-110 forbidden-words list extends with `repo`, `repository`, `GitHub username` on all purchase/create/invite paths. The product word is **project**; GitHub appears only as an opt-in "Also keep a copy in your GitHub" toggle in settings.

## Metadata

- **Ticket**: — (tracker: github; create epic issue at execution start)
- **Type**: New Capability
- **Complexity**: High
- **App/Package**: new `infra/` (estate IaC + estate-agent), new `apps/cloud` (control-plane API + signup UI on the Vercel site), `apps/hub` (cell hardening), `cli` (`maude estate`), `site/` (pricing/trust/docs), `apps/desktop` (magic-link invite deep-link)
- **Affected Systems**: tenant lifecycle, billing, fleet upgrades, legal/trust surface, onboarding
- **Dependencies**: Part 1 Phases 1–4 **complete** (esp. per-user identity, workspace agent, S3 lane, restore drill); AWS account (eu-central-1); Stripe account; Neon/Vercel Postgres; GitHub App registration (Phase 11)

---

## Context References

### Must-Read Files

> During `/flow:execute`, read every file listed here in parallel in a single message.

- `.ai/plans/feature-remote-workspace-server.md` — Why: Part 1 is the cell; its gates are prerequisites; its Task numbering is referenced below
- `apps/hub/docker-compose.yml.template`, `Caddyfile.template`, `apps/hub/Dockerfile` — Why: the tenant cell IS this stack; estate provisioning renders it per tenant
- `apps/hub/src/{server.mjs,tokens.mjs,admin-auth.mjs,bootstrap.mjs}` — Why: cell birth = DDR-053 bootstrap minting; control plane's only reach into a cell
- `apps/studio/sync/hub-link.ts` + Part 1 Task 9 (desktop sign-in) — Why: the invite deep-link flow extends this
- `site/content/docs/hub/pricing.mdx` — Why: the public "no SaaS tier" sentence this feature openly reverses
- `.design/ui/{Studio Hub,Onboarding,CreateProject,GitHubIdentity,LiveCollab}.tsx` — Why: Tier-0 canvas priors for signup/create/invite surfaces
- `.ai/archive/decisions/DDR-110*`, `DDR-054*`, `DDR-053*`, `DDR-108*`, `DDR-114*`, `DDR-162*`, `DDR-164*` — Why: vocabulary contract (amended here), operator posture, auth spine, GitHub App precedent, key custody
- `cli/commands/hub.mjs` — Why: `maude estate` joins this CLI surface

### Files to Create

- `.ai/archive/decisions/DDR-XXX-maude-cloud-tenant-cells-and-containment-invariant.md` — umbrella DDR: Landlord estate, containment invariant (replaces the Direction-B gate), operator-trust posture, vocabulary amendment, pricing-promise reversal, controller/processor split for invitees
- `infra/` — estate IaC (minimal: EC2 + EBS + S3 + Route53 wildcard + IAM), `estate-agent/` (pull-based provisioner daemon), cell template renderer
- `apps/cloud/` — control-plane API (accounts, orgs, projects, invites, tenant state machine, job queue, reconciler) + signup/billing UI wired into the Vercel site
- `cli/commands/estate.mjs` — `maude estate up|status|suspend|resume|destroy|upgrade <tenant>`
- `apps/hub/test/cell-containment.test.mjs` — the containment invariant boot-assert + grep gate
- `site/content/{trust,pricing}` updates + DPA/subprocessor documents

### Patterns to Follow

- **Desired-state reconciliation, never event side-effects** (breaker): Stripe subscription state is the single truth; the reconciler re-derives desired cell state hourly; webhooks only enqueue "reconcile now". Chaos tests replay/drop events.
- **Pull-based provisioning** (shipper): Vercel writes a job row; the estate-agent polls outbound. No inbound admin surface on the estate, no AWS keys on Vercel.
- **DDR-053 bootstrap** for cell birth; **DDR-164 custody** for every control-plane secret; **DDR-108/114 GitHub App** shape for the Phase-11 mirror (installation token, repo-scoped, held by the cell, never the control plane).
- **Tenant state machine** (breaker): `pending → active → past_due → suspended (cell stopped, volume retained 30 d) → exported → purged`, every transition dated + audited; export email fires **before** teardown, always.

---

## Design Decisions

### Debate outcome (recorded)

Builder ("Tenant Cells": per-tenant Fargate + CloudFormation + Step Functions + Aurora, ~$10–13/tenant) vs shipper ("Landlord": one EC2 estate + compose cells + Vercel control plane, ~$25/mo total at pilot scale) — resolved for **Landlord** on unit economics, template reuse, and one-artifact parity with self-hosters; builder's reconciler/state-machine/canary discipline and per-tenant-IAM ambition are retained (IAM/KMS-per-tenant returns when cells move to Fargate at scale). Breaker's containment invariant replaces the unfalsifiable Direction-B gate and is the load-bearing security decision of this plan. Advocate's invitee-first onboarding (magic link, AI-less first-class state, no GitHub words) is adopted as hard acceptance criteria — the invited zero-git teammate is the persona this product lives or dies by. ACP note: AI in the cloud still runs on **each user's own** Claude subscription via desktop (ToS); the AI-less state must be a dignified product, not an error state.

### UI surfaces

Signup/create/invite reuse the existing canvases (CreateProject, Onboarding, GitHubIdentity vocabulary); the cloud dashboard extends Studio Hub's console patterns. All new copy obeys DDR-110 + the new `repo`/`GitHub` ban on purchase paths.

---

## Tasks — numbered phases (Part 1 = Phases 1–4; execute strictly in order)

### Phase 5 — Paper before AWS (decisions, legal, positioning)

- **T1 CREATE umbrella DDR** (containment invariant + Landlord topology + operator-trust posture + vocabulary amendment + controller/processor decision for invitees + the pricing-promise reversal). Check DDR numbering race (decisions dir + uncommitted README index).
- **T2 CREATE tenant state machine + retention SLA spec** (in the DDR or a sibling doc): all transitions, retention windows, export-before-teardown guarantee.
- **T3 UPDATE site positioning**: `pricing.mdx` rewrite — self-host stays free/first-class with its cost table intact; cloud added beneath as "we run that same box for you"; Trust page skeleton (DPA, subprocessors: AWS/Stripe/Vercel; eu-central-1; break-glass policy).
- **Validate**: DDR recorded via `/flow:record-ddr` (kg ingest fires); site builds; no forbidden vocabulary on new pages.

### Phase 6 — Estate foundation + alligators tenant-of-one (no money)

- **T4 CREATE `infra/` estate IaC** (minimal): EC2 t4g.medium eu-central-1, EBS, S3 bucket, Route53 `*.cloud.maude.sh`, security groups; estate bootstrap script installs Docker + Caddy (on-demand TLS) + estate-agent skeleton.
- **T5 CREATE cell renderer + `maude estate up <tenant>`**: renders the Part-1 compose stack per tenant (own volume, own S3 prefix, own subdomain, DDR-053 bootstrap), per-cell CPU/memory limits, containment boot-assert (T6 test wired in).
- **T6 CREATE `cell-containment.test.mjs`**: boot-assert that export/Chromium/eval surfaces are unreachable in a cell; CI grep-gate.
- **T7 MIGRATE alligators**: onboard ~/git/alligators as tenant 1 (2.3 GB; 266 MB assets → S3 lane), desktop connects from a second machine.
- **Gate**: alligators live at its subdomain; assets round-trip S3; **restore from S3 backup into a fresh cell** succeeds; containment test green.

### Phase 7 — Pilot hardening + the invitee persona (still no money)

- **T8 ADD estate ops basics**: rolling image bump (alligators = canary), disk/egress alarms, weekly **automated** restore drill (upgrades Part 1's manual drill).
- **T9 ADD magic-link invite**: control-plane-less v0 (link minted by cell admin) → `maude://` deep-link into freshly installed desktop → signed in, project open. No account form, no token paste, no GitHub anywhere.
- **T10 ADD AI-less first-class state**: chat panel copy "AI here runs on your own Claude subscription — connect it, or keep designing"; edit/comment/presence/whiteboard/export all fully functional without `claude`.
- **T11 ADD trust mechanics in-product**: DDR-054 disclosure panel (Part 1 Task 9) extended with operator identity; break-glass access log visible to the tenant; **one-click export** (git bundle + assets tarball via signed URL) — verified by opening the export as a working local Maude project.
- **Gate (timed, real human)**: a genuinely non-technical Alligators member, cold email invite, own machine → first edit **< 5 minutes**, no terminal, no GitHub account; export bundle verified.

### Phase 8 — Control plane (accounts, orgs, lifecycle — billing still manual)

- **T12 CREATE `apps/cloud` control plane**: Neon Postgres; accounts (email/password + GitHub OAuth reuse), orgs, projects, invites; tenant state machine implemented; job queue table.
- **T13 CREATE estate-agent reconciler**: polls jobs + re-derives desired state hourly; executes create/suspend/resume/destroy; idempotent; reports cell health back.
- **T14 UPDATE maude.sh**: signup + dashboard UI (create project, invite by email, project list) per the canvas priors; vocabulary gate in CI.
- **Gate**: 20 chaos create/suspend/resume/destroy cycles leave **zero orphaned** volumes/DNS/S3 prefixes; reconciler survives replayed + dropped events; invitee flow now fully self-serve end-to-end.

### Phase 9 — Stripe (first paying tenants, capped ≤ 3)

- **T15 ADD Stripe**: Checkout + Customer Portal + Stripe Tax (VAT-ID capture, CZK/EUR display), flat per-project plan + storage blocks (final prices = owner's decision), 14-day trial with card.
- **T16 WIRE billing → lifecycle**: webhook enqueues reconcile; dunning → `past_due` → `suspended` (cell stopped, volume 30 d) → export email **before** any purge; resurrect on payment restores identical data.
- **T17 TEST with Stripe test clocks**: full lapse + resurrect + purge-with-export paths; a real ~€1 live purchase provisions unattended.
- **Gate**: test-clock suite green; live purchase → working cell with zero manual steps; tenant cap of 3 enforced until Phase 10 passes.

### Phase 10 — Fleet operations + trust launch surface

- **T18 ADD fleet ops**: per-cell version pinning, one-command staged rollout (canary → waves), one-command rollback, health board, cost/budget alarms, support runbook ("a bespoke cell is a bug").
- **T19 FINISH trust surface**: Trust page live (DPA, subprocessors, breach process, hard-delete SLA), audit-log UI polished, DDR-054 disclosure **inside signup**.
- **Gate**: upgrade all cells with one command + one rehearsed rollback, zero data loss; weekly restore drill green in CI; legal pack reviewed.

### Phase 11 — Self-serve GA + GitHub mirror

- **T20 OPEN self-serve signup** (remove tenant cap) — gated on Phase 10.
- **T21 ADD GitHub App mirror**: customer installs the App on their org; cell holds the repo-scoped installation token (never the control plane); settings toggle "Also keep a copy in your GitHub"; mirror is push-only, never authoritative (DDR-162 PR-flow vocabulary for review handoff).
- **T22 UPDATE docs + launch**: cloud docs section, migration guide self-host ↔ cloud (both directions — the export bundle is the bridge).
- **Gate**: a stranger can sign up, pay, invite, mirror to their GitHub, and later export + leave — with no human in the loop.

### Recorded, NOT in this plan

- **R1** Read-only share links (stateless render service — must not break the containment invariant; if it needs TSX evaluation, Direction B first).
- **R2** Browser editing (inherits Part 1 R1 + containment invariant).
- **R3** Per-tenant Fargate cells + per-tenant KMS/IAM (enterprise tier / scale-out).
- **R4** SSO for tenant members (SAML/OIDC per org).

---

## Validation

1. **Lint/Tests/Build**: repo quality gates (`workflows.config.json` → `quality.*`); new `apps/cloud` + `infra/` get their own test suites
2. **Containment**: `cell-containment.test.mjs` in CI from Phase 6 onward — any regression is a release blocker
3. **Chaos**: Phase 8 lifecycle chaos suite; Phase 9 Stripe test-clock suite
4. **Security**: `/flow:validate-security` on every phase touching auth/billing/tenant boundaries (5, 8, 9, 11) — severity floor medium, includeAi (prompt-injection: canvas content in cells is untrusted data)
5. **Restore**: weekly automated restore drill green before Phases 9+ ship
6. **Human gates**: Phase 7 timed invitee test; Phase 11 stranger test
7. **Vocabulary**: CI grep for forbidden words (`repo`, `GitHub username`, git verbs) on signup/invite/billing surfaces

## Scenario Coverage

| Scenario | Covers | Status |
|----------|--------|--------|
| `cloud-invite-cold-start` (desktop-e2e) | magic link → deep-link → editing, no accounts | 🆕 new |
| `cloud-lifecycle-chaos` (integration) | create/suspend/resume/destroy idempotency | 🆕 new |
| `cloud-billing-lapse` (Stripe test clock) | dunning → suspend → export email → resurrect | 🆕 new |
| `cloud-export-roundtrip` | export bundle opens as local Maude project | 🆕 new |

## Acceptance Criteria

- [ ] Part 1 (Phases 1–4) complete before Phase 5 starts
- [ ] Containment-invariant DDR exists before any AWS resource (Phase 5 before 6)
- [ ] Alligators tenant live + restore-verified before any control-plane code (6 before 8)
- [ ] Real non-technical invitee timed < 5 min before money moves (7 before 9)
- [ ] One-click export verified before first paid signup (7 before 9)
- [ ] No load-bearing webhook: reconciler survives replay/drop chaos (8 gate)
- [ ] Tenant cap ≤ 3 until fleet ops pass (9 → 10 gate)
- [ ] Self-host pricing table + free path intact on the site; "no SaaS tier" sentence coherently replaced, never silently deleted
- [ ] No browser surface contains chat/ACP; no cell evaluates tenant TSX (grep + boot gates)
- [ ] EU region only; DPA + subprocessor list published before GA
- [ ] Roadmap regen diff committed with the plan
