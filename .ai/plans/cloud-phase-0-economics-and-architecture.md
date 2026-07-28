# Cloud Phase 0 — Economics, provider decision, pricing & phase index (READ FIRST — not executable)

The master reference for the **Maude Cloud arc**: the complete path from zero infrastructure to a paid production release on maude.sh. Execution order = the numbered files `cloud-phase-1-*.md` → `cloud-phase-10-*.md`. Each phase file is independently executable via `/flow:execute` and has a hard exit gate. Produced from two divergent debates (builder/shipper/breaker, then builder/shipper/breaker/user-advocate — DDR-130 reduce tier) plus a very-thorough architecture sweep. Provider decision revised 2026-07-28 per the owner's call: **Cloudflare everywhere — one unified infra.**

## 1. Provider decision: Cloudflare end-to-end

**Why not pure Vercel (the owner's earlier question):** a tenant cell is a long-lived stateful process set — Hocuspocus WebSocket server with live Y.Docs in memory, SQLite on disk, a workspace-agent owning a persistent git checkout. Vercel Functions (incl. Fluid) are request/response, max 800 s, no persistent disk, and cannot act as a WebSocket server. Verified against current platform docs.

**Why Cloudflare works now (verified 2026-07-28):** [Containers reached GA 2026-04](https://developers.cloudflare.com/changelog/post/2026-04-13-containers-sandbox-ga/) — up to 4 GiB RAM / 0.5 vCPU per instance, thousands of concurrent instances per account, **Active-CPU pricing** (billed for CPU cycles actually consumed, not wall-clock — an idle cell costs ~nothing), DO-managed lifecycle with scale-to-zero, and R2 mountable as a FUSE volume (explicitly *not* SSD-like — see the Phase-5 persistence spike). [Durable Objects](https://developers.cloudflare.com/durable-objects/) add SQLite-backed storage (1 → 10 GB per object) and WebSocket hibernation (idle connections aren't billed for duration).

| Layer | Runs on | Why |
| --- | --- | --- |
| **Control plane** — maude.sh signup, dashboard, provisioner API, reconciler | **Workers** (Hono + D1 + Queues + Cron Triggers) + static dashboard assets | One platform with the data plane; the provisioner calls the same Cloudflare API the CLI uses; no cross-cloud credentials anywhere |
| **Data plane** — tenant cells (hub + workspace-agent) | **Cloudflare Containers**, one per project; a Worker + per-project Durable Object as ingress/lifecycle (`<project>.cloud.maude.sh`) | Per-cell isolation native; scale-to-zero via Active-CPU pricing; wake-on-connect; the Node hub runs unmodified in a container (nothing ports to workerd) |
| **Object storage** — assets + replication/backups | **R2** | S3-compatible (Part-1 S3 lane unchanged), **$0 egress**, ~$0.015/GB; also the cell's durability target (persistence spike, Phase 5 Task 1) |
| **DNS/TLS/WS routing** | Cloudflare zone `cloud.maude.sh` + Workers routes | No Caddy, no cert management — the edge does it |
| **E-mail** (invites, billing) | Resend (API key as Worker secret) | CF has no transactional-send product; smallest clean dependency |

**Trade-offs accepted (named honestly):** Containers GA is ~3 months old — limits/pricing may move (each phase re-verifies at execution start); container disk is **ephemeral**, so cell durability = continuous replication to R2 + rehydrate-on-boot (Phase 5 Task 1 spike decides the exact mechanism; SQLite-on-FUSE is presumed disqualified for hot DBs until proven safe); vendor concentration — Cloudflare outage = both planes down (mitigated by the export bundle + self-host parity: any tenant can leave to the Phase-4 self-host stack, which stays first-class). The docs site stays on Vercel until the arc ships; migrating it to Workers is an optional Phase-10 task, not a gate.

**Recorded alternatives (not v1):** Fly.io Machines (the pre-revision choice — volumes instead of the persistence spike; closest fallback if Containers limits bite), AWS estate (enterprise residency / ≥15 always-on density), DO-native sync (rewrite Hocuspocus on Durable Objects — the true serverless endgame, big rewrite, revisit post-GA).

## 2. Unit economics (directional — Phase 5 gate records real telemetry; verify prices at Phase 8)

**Per project-cell (Cloudflare):**

| Item | Always-on estimate | Typical (scale-to-zero, ~8 h active/day) |
| --- | --- | --- |
| Container Active-CPU + memory (1–2 GiB instance, sync workload = mostly idle) | ~$3–5/mo | **~$1–2/mo** |
| R2 storage 10 GB (assets + replication) | ~$0.20/mo | ~$0.20/mo |
| R2 egress | **$0** | **$0** |
| DO requests/duration (ingress, hibernating WS) | ~$0.10–0.50/mo | ~$0.10/mo |
| **Total per project** | **~$4–6/mo** | **~$1.5–3/mo** |

**Fixed (whole business):** Workers Paid $5/mo + D1/Queues included tiers + Resend $0–20 + domain ≈ **€10–30/mo** (Vercel Pro continues only for the existing docs site until its optional migration).

**Margins at the proposed price (€19/project):** €19 − ~€3 infra − ~€0.55 Stripe (1.5% + €0.25 EU) ≈ **€15.5 gross/project (~80 %)**. Dedicated tier (€99, pinned larger instance ~€10 infra) ≈ 89 %.

**Break-even: ~2 paying projects.** At 50 projects: MRR ~€950, infra ~€100–200, gross ~€780/mo. Storage add-on is nearly pure margin on R2.

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
| Hosting region | yours | EU jurisdiction (Cloudflare; EU data residency via regional services — verify scope in Phase 9's DPA work) | Region pinning + custom terms |
| One-click full export (project + media) | ✅ (it's git) | ✅ always, even after cancel | ✅ |
| Mirror to your GitHub | ✅ (native) | ✅ (from GA, optional toggle) | ✅ + priority |
| Isolation | your infra | Own isolated instance per project | **Dedicated pinned instance + custom domain** (design.yourbrand.com) |
| Support | community | e-mail | priority + onboarding call |
| Trial | — | 14 days, card required | contact |

Positioning guard (advocate + breaker): the self-host cost table in `pricing.mdx` stays intact and first-class; the "There is no Maude SaaS tier" sentence is **openly replaced** ("we now also run that same box for you"), never silently deleted. Vocabulary: `repo`, `repository`, `GitHub username` are banned on all purchase/create/invite paths (DDR-110 amendment); the product word is **project**.

## 4. Architecture summary (one paragraph)

Buyer signs up on maude.sh (Workers + D1 + Stripe), creates a **project** → the control plane (via Queues + the shared cell lib) births an isolated **cell**: a Cloudflare Container running the exact self-host stack from Phases 1–4 (hub + workspace-agent), fronted by a per-project Durable Object + Worker ingress at `<project>.cloud.maude.sh`, with durability = continuous replication to R2 + rehydrate-on-boot, minting its DDR-053 bootstrap. Autosave = the Part-1 workspace agent (append-only commits, never force-push). Members join via magic-link → `maude://` deep-link into Maude Desktop; **editing is desktop-only, ACP runs on each member's own Claude subscription** (hard boundary: no chat/editing surface in any browser; **containment invariant: no tenant-authored TSX is ever evaluated by vendor-operated compute** — boot-assert + CI grep gate). Stripe subscription state is the single truth; an hourly Cron-Trigger reconciler re-derives desired cell state (webhooks only enqueue "reconcile now" — never load-bearing). Tenant lifecycle: `pending → active → past_due → suspended (stopped, R2 state retained 30 d) → exported → purged`, export e-mail always fires before teardown.

## 5. Phase index — run in this order

| File | Delivers | Exit gate |
| --- | --- | --- |
| `cloud-phase-1-safety-gates.md` | Umbrella DDRs, DDR-122 origin-gate fix, hub repo/branch namespace | DDRs recorded; origin-gate test green; namespace tests green |
| `cloud-phase-2-hub-identity-durability.md` | Hub user model + login + expiring per-user tokens, trusted proxy, backup + restore drill | login/expiry/revoke tests; restore drill passes |
| `cloud-phase-3-workspace-agent-s3.md` | Server-owned checkout autosave agent, S3/R2 asset lane, desktop sign-in | two-client autosave round-trip; 60 MB asset via R2; kill -9 recovery |
| `cloud-phase-4-selfhost-skill.md` | `maude hub workspace-up` + `/design:hub-workspace` (self-host stays first-class) | full up→verify→destroy cycle green |
| `cloud-phase-5-container-cell-alligators-pilot.md` | Cell on Cloudflare Containers (+ persistence spike) + `maude cell up`, containment test, **alligators as tenant-of-one** | persistence kill -9 evidence; alligators live; restore into fresh cell; containment green |
| `cloud-phase-6-invites-onboarding.md` | Magic-link invite deep-link, AI-less first-class state, disclosure + audit, one-click export | real non-technical invitee: cold e-mail → edit **< 5 min**; export opens locally |
| `cloud-phase-7-control-plane-workers.md` | apps/cloud on Workers (Hono + D1 + Queues): accounts, projects, invites, provisioner + reconciler | 20 chaos lifecycle cycles, zero orphans; replay/drop-safe |
| `cloud-phase-8-stripe-pricing.md` | Stripe (Checkout, Tax, trial, dunning/lapse/resurrect) + pricing page from §3 | test-clock lapse+resurrect; live €1 purchase unattended; ≤3 tenants cap |
| `cloud-phase-9-fleet-ops-trust.md` | Version pinning, canary rollout, rollback, health board, Trust/DPA page | 1-command fleet upgrade + rehearsed rollback; weekly restore drill in CI |
| `cloud-phase-10-ga-launch-github-mirror.md` | Self-serve GA, GitHub App mirror, docs + launch (optional: docs-site migration to Workers) | stranger completes signup→pay→invite→mirror→export unaided |

Deferred (recorded, not planned): read-only share links (must not break containment), browser editing (Direction B prerequisite), Fly/AWS alternatives (fallback/enterprise), DO-native sync rewrite, SSO per org.
