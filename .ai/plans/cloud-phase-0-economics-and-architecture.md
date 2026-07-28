# Cloud Phase 0 — Economics, provider decision, pricing & phase index (READ FIRST — not executable)

The master reference for the **Maude Cloud arc**: the complete path from zero infrastructure to a paid production release on maude.sh. Execution order = the numbered files `cloud-phase-1-*.md` → `cloud-phase-10-*.md`. Each phase file is independently executable via `/flow:execute` and has a hard exit gate.

> ### Status as of 2026-07-29 — read this before trusting anything below
>
> **All ten phases have been executed and archived** (`.ai/plans/archive/`). Phases 1–4 are complete. Phases 5–10 are **CORE COMPLETE / PARTIAL**: their decision layers are written and tested, their deployment is blocked. **DDR-196** records why and how the split was made.
>
> **Nothing in this document has been measured.** §2's unit economics are still the pre-arc estimate — the Phase-5 gate that was supposed to replace them with telemetry never ran, because no cell has ever been deployed. §3's pricing table now exists as real objects in the **Stripe sandbox** (`apps/cloud/pricing.json`), but the numbers are unchanged and unsigned-off.
>
> **What blocks the rest**, unchanged and re-probed live on 2026-07-28: Workers Paid (Containers, Queues), R2 enablement, and a `cloud.maude.sh` zone. All three need a browser, payment details, or domain control. See `cloud-phase-0b-manual-prep.md`, which also records what an agent has already done (D1 provisioned + schema applied).
>
> Treat §2 as a hypothesis, §3 as a proposal, and §5 as history rather than instructions.

Produced from two divergent debates (builder/shipper/breaker, then builder/shipper/breaker/user-advocate — DDR-130 reduce tier) plus a very-thorough architecture sweep. Provider decision revised 2026-07-28 per the owner's call: **Cloudflare everywhere — one unified infra.**

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

## 2. Unit economics (STILL DIRECTIONAL — no telemetry was ever recorded)

> The Phase-5 gate was meant to replace this section with measurements from a live cell. **It did not run**: Containers need the paid plan, so no cell exists and every number below is the same estimate it was before any code was written. `apps/cloud/fleet.mjs` has the cost-alarm machinery ready (it alarms on the per-cell ratio against a €3 model, and on any R2 egress charge at all, which should be €0 by design) — it has simply never been given real figures.

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

## 3. Pricing table (proposal — final numbers are the owner's call, NOT YET locked)

> Now instantiated in the **Stripe sandbox** (`maude.sh sandbox`, `acct_1TyGz4BU24eXpQyl`) and resolvable through `apps/cloud/pricing.{json,mjs}`: Project €19/mo + €190/yr, Dedicated €99/mo, storage €5 per 50 GB block. Live-mode price ids are deliberately `null`, and `priceIdFor()` **throws** rather than falling back to a sandbox id — a silent fallback is how a real customer gets charged nothing, or a test charge lands on a real card. The numbers below are unchanged and still await sign-off.

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

## 5. Phase index — as executed

> Kept as written, with outcomes. The "Exit gate" column is what each phase was *asked* to prove; the Outcome column is what actually happened. Every phase file is archived under `.ai/plans/archive/` with its own closing section listing exactly what remains.

| File | Delivers | Exit gate |
| --- | --- | --- |
| `cloud-phase-0b-manual-prep.md` | **Human-only prep**: accounts (Cloudflare/Stripe/Resend/GitHub App), tokens, `wrangler`, MCP wiring, legal paperwork, pilot backup | its own readiness checklist — Phases 1–4 need only Steps 0 + 7 |
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


### Outcomes

| Phase | Outcome | What is still missing |
| --- | --- | --- |
| 0b prep | **partially executed by agent** | Workers Paid, R2, DNS delegation, live Stripe entity, Resend signup, legal artifacts |
| 1 safety gates | **COMPLETE** — DDR-192/193, the DDR-122 origin gate, doc namespace | — |
| 2 hub identity | **COMPLETE** — users, expiring tokens, trusted proxy, backups + a restore drill in CI | — |
| 3 workspace agent | **CORE COMPLETE** — containment enforced, S3/R2 lane, append-only autosave, sign-in | two-machine round-trip, 60 MB via R2, desktop e2e |
| 4 self-host skill | **CORE COMPLETE** — `maude hub workspace-up` renders + verifies | 6 of 8 verification steps need a Docker host |
| 5 cell | **CORE COMPLETE** — image, containment at the image layer, naming/isolation/teardown | persistence spike, `maude cell up`, alligators pilot |
| 6 invites | **CORE COMPLETE** — magic-link mint/peek/redeem/revoke | `maude://` deep link, desktop UI, one-click export |
| 7 control plane | **CORE COMPLETE** — the reconciler + D1 schema (applied to a live database) | the Worker, Queues, dashboard |
| 8 billing | **PARTIAL** — sandbox catalog + resolver | live prices, Checkout, portal, dunning |
| 9 fleet ops | **CORE COMPLETE** — canary rollout, rollback, board, cost alarms, Trust page (claim-audited) | dashboard UI, live telemetry, scheduled drills. **Tenant cap stays ≤ 3** |
| 10 GA | **PARTIAL** — the GitHub mirror | App registration, settings UI, self-serve signup, launch |

### The one thing to re-read before resuming

The arc's decisions are all recorded and tested; what has never happened is **any of it running against Cloudflare**. `cellConfig()` renders what the Containers API *should* accept and no Cloudflare API has ever seen it. Expect the first `maude cell up` to find shape and naming problems — a bounded surface, not a design question (DDR-196 says this in its consequences, deliberately).

Code that nothing runs also rots. If the account is still unpaid a release cycle or two from now, `infra/cell/` and `apps/cloud/*` want re-verifying rather than assuming.
