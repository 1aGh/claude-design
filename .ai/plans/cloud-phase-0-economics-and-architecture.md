# Cloud Phase 0 — Economics, provider decision, pricing & phase index (READ FIRST — not executable)

The master reference for the **Maude Cloud arc**: the complete path from zero infrastructure to a paid production release on maude.sh. Execution order = the numbered files `cloud-phase-1-*.md` → `cloud-phase-10-*.md`. Each phase file is independently executable via `/flow:execute` and has a hard exit gate. Produced from two divergent debates (builder/shipper/breaker, then builder/shipper/breaker/user-advocate — DDR-130 reduce tier) plus a very-thorough architecture sweep.

## 1. Provider decision: Vercel control plane + Fly.io data plane (AWS = documented fallback)

**The user's question "all on Vercel?" has a hard technical answer: the data plane cannot run on Vercel.** A tenant cell is a long-lived stateful process set — Hocuspocus WebSocket server holding live Y.Docs in memory, SQLite on local disk, and a workspace-agent owning a persistent git checkout. Vercel Functions (incl. Fluid Compute, verified against the current platform docs) are request/response with max 800 s duration, no persistent local disk, and cannot act as a WebSocket *server*. The control plane (signup, Stripe, dashboard, provisioning API) fits Vercel perfectly.

**Decision:**

| Layer | Runs on | Why |
| --- | --- | --- |
| **Control plane** — maude.sh signup, dashboard, Stripe, provisioner API, reconciler cron | **Vercel** (existing site project) + Neon Postgres | Already home of the site; the DX you like; crons + functions are exactly this shape; no new platform |
| **Data plane** — tenant cells (hub + workspace-agent + volume) | **Fly.io Machines**, one app per tenant cell, `fra` region (EU) | Closest-to-Vercel DX (`fly deploy`, REST Machines API callable straight from Vercel functions); per-cell isolation is native; volumes for the git checkout; **auto-stop/auto-start = idle tenants cost ~pennies** (machine wakes on inbound connect, ~2 s — already documented in `site/content/docs/hub/pricing.mdx`); repo already ships `fly.toml.template` and the docs already recommend Fly |
| **Object storage** — assets + backups | **Cloudflare R2** (or Tigris via Fly) | S3-compatible (Part-1 S3 lane works unchanged), $0 egress (R2), ~$0.015/GB — egress is the AWS killer for media |

**Why not the AWS estate (the earlier draft):** an EC2 estate (t4g.medium + EBS ≈ $34/mo fixed) is cheaper *per cell* only once ~10+ cells are packed on one box, has no scale-to-zero, and makes you the sysadmin (patching, monitoring, Caddy, IaC) from tenant #1. It contradicts "I like working with Vercel" for zero benefit at pilot scale.

**When AWS wins (recorded as the scale-out path, not v1):** ≥ ~15 always-on tenants (density economics), or an enterprise customer demanding AWS residency/VPC peering. The cell is a compose stack either way — moving it later is mechanical. This goes into the Phase-1 umbrella DDR as the named alternative.

## 2. Unit economics (verify live numbers at Phase 8; directional here)

**Per project-cell (Fly, `fra`):**

| Item | Always-on | With auto-stop (typical) |
| --- | --- | --- |
| Machine shared-1x 1 GB (hub 256 MB + agent) | ~$5.70/mo | ~$2–3/mo |
| Volume 10 GB ($0.15/GB) | $1.50/mo | $1.50/mo |
| R2 storage 10 GB + zero egress | ~$0.20/mo | ~$0.20/mo |
| **Total per project** | **~$7.5/mo** | **~$4–5/mo** |

**Fixed (whole business):** Vercel Pro $20 (already paid for the site) + Neon $0→19 + domain/misc ≈ **€25–45/mo**.

**Margins at the proposed price (€19/project):** €19 − ~€6 infra − ~€0.55 Stripe (1.5% + €0.25 EU) ≈ **€12.5 gross/project (~65 %)**. Dedicated tier (€99, own dedicated machine ~€15 infra) ≈ 84 %.

**Break-even: 3–4 paying projects.** At 50 projects: MRR ~€950, infra ~€250–350, gross ~€650/mo. Storage add-on is nearly pure margin on R2.

## 3. Pricing table (proposal — final numbers are the owner's call, locked in Phase 8)

The model is **per project** (per the owner's decision): one price = one project = one isolated cell. Seats are never billed — the invite is the product's core action (user-advocate verdict).

| | **Self-host & Local** | **Cloud Project** | **Dedicated** |
| --- | --- | --- | --- |
| **Price** | **Free forever** | **€19 / project / month** (annual €190 ≈ 2 months free) | **€99 / project / month** |
| Maude Desktop + all plugins | ✅ | ✅ | ✅ |
| Self-hosted hub (your box, ~$5/mo table stays published) | ✅ | — | — |
| Hosted workspace, autosave + full version history | — | ✅ | ✅ |
| Members / invitees | your hub = your rules | **Unlimited** (magic-link invite) | Unlimited |
| Media storage included | your disk | 10 GB (then **+€5/mo per +50 GB**) | 100 GB |
| AI (ACP) via each member's own Claude subscription | ✅ | ✅ | ✅ |
| Hosting region | yours | EU (Frankfurt) | Region of choice |
| One-click full export (project + media) | ✅ (it's git) | ✅ always, even after cancel | ✅ |
| Mirror to your GitHub | ✅ (native) | ✅ (from GA, optional toggle) | ✅ + priority |
| Isolation | your infra | Own isolated instance per project | **Dedicated machine + custom domain** (design.yourbrand.com) |
| Support | community | e-mail | priority + onboarding call |
| Trial | — | 14 days, card required | contact |

Positioning guard (advocate + breaker): the self-host cost table in `pricing.mdx` stays intact and first-class; the "There is no Maude SaaS tier" sentence is **openly replaced** ("we now also run that same box for you"), never silently deleted. Vocabulary: `repo`, `repository`, `GitHub username` are banned on all purchase/create/invite paths (DDR-110 amendment); the product word is **project**.

## 4. Architecture summary (one paragraph)

Buyer signs up on maude.sh (Vercel + Neon + Stripe), creates a **project** → the control plane calls the Fly Machines API to birth an isolated **cell** (hub + workspace-agent + volume + R2 prefix — the exact self-host compose stack from Phases 1–4) at `<project>.cloud.maude.sh`, minting its DDR-053 bootstrap. Autosave = the Part-1 workspace agent (append-only commits, never force-push). Members join via magic-link → `maude://` deep-link into Maude Desktop; **editing is desktop-only, ACP runs on each member's own Claude subscription** (hard boundary: no chat/editing surface in any browser; **containment invariant: no tenant-authored TSX is ever evaluated by vendor-operated compute** — boot-assert + CI grep gate). Stripe subscription state is the single truth; an hourly reconciler on Vercel cron re-derives desired cell state (webhooks only enqueue "reconcile now" — never load-bearing). Tenant lifecycle: `pending → active → past_due → suspended (stopped, volume 30 d) → exported → purged`, export e-mail always fires before teardown.

## 5. Phase index — run in this order

| File | Delivers | Exit gate |
| --- | --- | --- |
| `cloud-phase-1-safety-gates.md` | Umbrella DDRs, DDR-122 origin-gate fix, hub repo/branch namespace | DDRs recorded; origin-gate test green; namespace tests green |
| `cloud-phase-2-hub-identity-durability.md` | Hub user model + login + expiring per-user tokens, trusted proxy, backup + restore drill | login/expiry/revoke tests; restore drill passes |
| `cloud-phase-3-workspace-agent-s3.md` | Server-owned checkout autosave agent, S3/R2 asset lane, desktop sign-in | two-client autosave round-trip; 60 MB asset via R2; kill -9 recovery |
| `cloud-phase-4-selfhost-skill.md` | `maude hub workspace-up` + `/design:hub-workspace` (self-host stays first-class) | full up→verify→destroy cycle green |
| `cloud-phase-5-fly-cell-alligators-pilot.md` | Cell on Fly Machines + `maude cell up`, containment test, **alligators as tenant-of-one** | alligators live; restore into fresh cell; containment green |
| `cloud-phase-6-invites-onboarding.md` | Magic-link invite deep-link, AI-less first-class state, disclosure + audit, one-click export | real non-technical invitee: cold e-mail → edit **< 5 min**; export opens locally |
| `cloud-phase-7-control-plane-vercel.md` | apps/cloud on Vercel+Neon: accounts, projects, invites, Fly provisioner + reconciler | 20 chaos lifecycle cycles, zero orphans; replay/drop-safe |
| `cloud-phase-8-stripe-pricing.md` | Stripe (Checkout, Tax, trial, dunning/lapse/resurrect) + pricing page from §3 | test-clock lapse+resurrect; live €1 purchase unattended; ≤3 tenants cap |
| `cloud-phase-9-fleet-ops-trust.md` | Version pinning, canary rollout, rollback, health board, Trust/DPA page | 1-command fleet upgrade + rehearsed rollback; weekly restore drill in CI |
| `cloud-phase-10-ga-launch-github-mirror.md` | Self-serve GA, GitHub App mirror, docs + launch | stranger completes signup→pay→invite→mirror→export unaided |

Deferred (recorded, not planned): read-only share links (must not break containment), browser editing (Direction B prerequisite), AWS estate / per-tenant Fargate+KMS (enterprise/scale), SSO per org.
