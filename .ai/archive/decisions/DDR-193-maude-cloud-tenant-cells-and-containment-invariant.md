# DDR-193: Maude Cloud — one cell per project on Cloudflare, and the containment invariant

- **Date:** 2026-07-28
- **Status:** Accepted
- **Tags:** cloud, tenancy, cloudflare, containers, workers, r2, security, containment, gdpr, trust, pricing, lifecycle, umbrella
- **Related:** DDR-192 (sibling — the workspace-server half), [DDR-054](./DDR-054-linked-mode-trust-model-and-task-4-hardening.md) (trust model this productizes), [DDR-110](./DDR-110-three-lane-collaboration-model.md) (vocabulary amendment), [DDR-053](./DDR-053-hub-admin-auth-architecture.md), [DDR-063](./DDR-063-canvas-origin-split-default-on-tsx-sync-opt-in.md), [DDR-123](./DDR-123-acp-chat-runs-on-users-claude-cli-subscription.md) · Plan: `.ai/plans/cloud-phase-1-safety-gates.md` (Task 2), `.ai/plans/cloud-phase-0-economics-and-architecture.md`

## Context

Maude's published position has been explicit: **"There is no Maude SaaS tier."** Self-host or run it locally. The Cloud arc reverses that. Reversing a public promise is a decision in its own right and is recorded here rather than quietly shipped.

The arc's shape came out of two divergent debates (builder/shipper/breaker, then + user-advocate — DDR-130 reduce tier) plus a very-thorough architecture sweep, and a provider revision on 2026-07-28: **Cloudflare end-to-end**, one unified infrastructure, rather than the earlier Fly.io plan. DDR-192 records what happens to the *workspace*. This DDR records what happens to *tenancy* — the unit of isolation, the one invariant that must never break, the tenant lifecycle, and the operator-trust posture that makes "the vendor runs your workspace" an honest sentence.

## Decision

### 1. Provider: Cloudflare end-to-end. Unit of tenancy: one cell per project

| Layer | Runs on |
| --- | --- |
| Control plane (signup, dashboard, provisioner, reconciler) | **Workers** — Hono + D1 + Queues + Cron Triggers + static assets |
| Data plane (tenant cells: hub + workspace-agent) | **Cloudflare Containers**, one container per project, fronted by a Worker + per-project Durable Object at `<project>.cloud.maude.sh` |
| Object storage (assets, replication, backups) | **R2** — S3-compatible, $0 egress |
| DNS / TLS / WS routing | Cloudflare zone + Workers routes |
| Transactional e-mail | Resend (Worker secret) |

**Why Containers rather than Functions:** a cell is a long-lived **stateful process set** — a Hocuspocus WebSocket server with live Y.Docs in memory, SQLite on disk, and a workspace agent owning a persistent checkout. Request/response functions (including Vercel Fluid) cannot be a WebSocket server and have no persistent disk. Verified against current platform docs at the time of writing.

**Why one cell per project and not shared multi-tenancy:** isolation you can *point at*. A per-project container means a tenant's blast radius is their own container; there is no query in the system whose `WHERE tenant_id = ?` clause being wrong leaks another customer's design files. It also makes the Dedicated tier a configuration change rather than an architecture.

**Named fallbacks, recorded so they don't have to be re-derived:** Fly.io Machines (volumes instead of a persistence spike — the closest fallback if Containers limits bite), the AWS estate (enterprise residency / high always-on density), DO-native sync (rewriting Hocuspocus on Durable Objects — the true serverless endgame, a large rewrite, revisit post-GA).

**Accepted trade-offs:** Containers GA is ~3 months old, so each phase re-verifies limits and pricing at execution start. Container disk is **ephemeral** — durability is continuous replication to R2 plus rehydrate-on-boot, with the exact mechanism decided by the Phase-5 spike (bias: local disk as working set + replication, *not* SQLite over FUSE-R2, which is presumed disqualified for hot DBs until proven otherwise). Vendor concentration is real: a Cloudflare outage takes both planes down. The mitigation is not a second cloud — it is that **leaving is always possible**: the export bundle plus first-class self-host parity (Phase 4).

### 2. The containment invariant (the one line that must never break)

> **No tenant-authored TSX is ever evaluated by vendor-operated compute.**
> A cell runs **sync + git + asset storage** — nothing else. It never renders a canvas, never builds a bundle, never executes a canvas module, never runs a headless browser against tenant content.

Rendering and evaluation happen **only** on a member's own machine, in Maude Desktop, where DDR-063's canvas-origin split and DDR-054's trust model already contain them.

Why this is the invariant and not merely a guideline: every canvas is executable code the tenant wrote. The moment vendor compute evaluates it, the vendor has arbitrary code execution inside its own perimeter, on behalf of an anonymous signup, adjacent to other tenants' data and to the control plane's credentials. No sandbox promise survives that at a two-person operating scale.

**It is enforced, not asserted:** a **boot-assert** in the cell image (refuse to start if a render/build/browser surface is reachable) plus a **CI grep gate** on the cell's dependency and route surface. A test that only checks the happy path would let this rot in silence.

**If a future feature needs to break it** — server-side thumbnails, link previews, browser editing — then **Direction B (a structured, non-executable synced unit)** is that feature's *hard prerequisite*, not a stretch goal to be traded away under launch pressure. The invariant is not renegotiable in a sprint.

### 3. Tenant lifecycle, with export before teardown

```
pending → active → past_due → suspended (30 d, stopped, R2 state retained) → exported → purged
```

- Suspension **stops** a cell; it does not delete state. State is retained 30 days.
- **An export e-mail always fires before teardown.** There is no path from "customer stopped paying" to "customer's design files are gone" that does not pass through "customer was handed their files."
- One-click full export (project + media) is available **always**, including after cancellation — not as a retention lever, as the thing that makes the vendor-lock-in objection false.

### 4. Operator-trust posture

Productizes DDR-054's trust model for the case where the operator is *us*:

- **Encryption at rest.**
- **No standing access.** Operator access to tenant state is break-glass, and **customer-visible in an audit log**. "We could look but we don't" is not a control; "you can see that we looked" is.
- **DDR-054's disclosure moves inside signup** — what the hub sees and can do is shown to the person deciding, not buried in docs.
- **DPA + published subprocessor list + a written breach process** (Phase 9's trust surface).
- **Hard-delete SLA**, published.
- **EU jurisdiction** for hosting, with residency scope verified — not assumed — during the DPA work.
- **Controller/processor split for invitees.** An invited teammate signed nothing, yet their presence, cursor, and awareness data are personal data. Their relationship to the vendor is not the buyer's relationship to the vendor, and the paperwork must say so.

### 5. Vocabulary: `repo`, `repository`, and `GitHub username` are banned on purchase/create/invite paths (amends DDR-110)

The persona this product lives or dies by is the **invited teammate who has never used git** (user-advocate verdict). The product word is **project**. A signup, create, or invite flow that says "repository" has already told that person the product is not for them.

This is a lint-able rule on those paths, not a style preference. Git vocabulary remains correct and welcome in developer-facing surfaces (CLI, docs, the mirror settings).

### 6. The public "no SaaS tier" promise is openly replaced

The self-host cost table in `pricing.mdx` **stays intact and first-class**. The "There is no Maude SaaS tier" sentence is **openly replaced** — "we now also run that same box for you" — never silently deleted. Pricing is **per project** (never per seat: the invite is the product's core action, so charging for it would tax the thing the product is for). Proposed: Free self-host / €19 per project / €99 dedicated; final numbers are the owner's call, locked in Phase 8.

## Alternatives considered

- **Shared multi-tenant hub with row-level isolation.** Cheaper per tenant; rejected because isolation would rest on every query being right forever, and because a per-tenant container is the same code self-hosters run.
- **Vercel for the data plane.** Rejected on capability, not preference: no WebSocket server, no persistent disk, request/response lifetime. The docs site stays on Vercel; migrating it to Workers is an optional Phase-10 task, not a gate.
- **Fly.io Machines** (the pre-revision choice). Volumes would remove the persistence spike entirely. Rejected in favor of a single unified provider — one API, one credential surface, one bill — and recorded as the primary fallback.
- **Allow vendor-side rendering behind a sandbox.** Rejected. See §2: at this operating scale a sandbox promise is not a control the vendor can actually stand behind.
- **Per-seat pricing.** Rejected — see §5/§6.

## Consequences

**Positive**
- Isolation is structural and explainable in one sentence to a buyer.
- Break-even is ~2 paying projects; an idle cell costs approximately nothing under Active-CPU pricing.
- The containment invariant removes an entire class of vendor-side vulnerability *by construction*, which is the only kind of security a two-person team can actually maintain.
- Leaving is always possible, which is what makes the vendor-lock-in objection answerable.

**Negative / accepted**
- **The invariant costs features.** No server-side thumbnails, no link previews, no browser editing — indefinitely. This will be requested repeatedly and must be declined on the same grounds each time.
- **Vendor concentration**: one provider outage takes both planes down. Accepted, mitigated by export + self-host parity rather than by multi-cloud.
- **A young platform**: Containers GA is recent; limits and prices may move under us. Each phase re-verifies at execution start rather than trusting this document's numbers.
- **Reversing a public promise has a credibility cost.** Paid in the open (§6) rather than avoided.
- Being a data controller for people who never signed up is a real, ongoing obligation — not a checkbox.

## Implementation notes

Nothing in this DDR is code yet by design — it is the arc's paper gate. It binds Phases 5–10:

- **Phase 5** implements the cell and the containment boot-assert + CI grep gate, runs the persistence spike, and onboards `~/git/alligators` as tenant-of-one (dogfood before any billing exists).
- **Phase 7** implements the control plane; the reconciler is authoritative and webhooks only enqueue "reconcile now" — nothing is event-side-effect load-bearing.
- **Phase 8** implements §3's state machine in billing terms and §6's pricing page.
- **Phase 9** ships §4's trust surface and is the **gate for lifting the ≤ 3 tenant cap** — tenant #4 is not onboarded without it.
