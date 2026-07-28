# DDR-196: The cloud arc's buildable half — decisions as pure functions, and where the vendor boundary actually falls

- **Date:** 2026-07-29
- **Status:** Accepted
- **Tags:** cloud, architecture, testing, provisioning, fleet-ops, billing, invites, mirror, trust, vendor-boundary
- **Related:** [DDR-192](./DDR-192-remote-workspace-server-architecture.md), [DDR-193](./DDR-193-maude-cloud-tenant-cells-and-containment-invariant.md) (both implemented here), [DDR-194](./DDR-194-hub-identity-and-durability-choices.md), [DDR-195](./DDR-195-workspace-cell-enforcement-assets-and-autosave-history.md), [DDR-053](./DDR-053-hub-admin-auth-architecture.md), [DDR-054](./DDR-054-linked-mode-trust-model-and-task-4-hardening.md), [DDR-119](./DDR-119-native-owns-the-workspace-web-is-a-repo-bound-companion.md) · Plans: `.ai/plans/archive/cloud-phase-{5,6,7,8,9,10}-*.md`

## Context

Phases 5–10 of the Maude Cloud arc all appeared blocked: Cloudflare Containers and R2 need a paid plan, and `cloud.maude.sh` needs a zone that does not exist. The first reading was that the arc stops at Phase 4.

That reading was wrong, and the way it was wrong is worth recording, because it will recur on every vendor-dependent arc this project takes on.

**What is blocked is DEPLOYING, not DECIDING.** A provisioner, a control plane, a fleet operator and a billing integration are mostly *decisions* — naming, isolation, ordering, state transitions, refusals — and decisions are functions of their inputs. The vendor is needed to execute them, not to determine them.

## Decision

### 1. Split every vendor-facing component into a pure decision layer and a thin effects layer

Applied consistently across the arc:

| Decisions (pure, tested) | Effects (needs the vendor) |
| --- | --- |
| `cli/lib/workspace-plan.mjs` | `cli/commands/hub-workspace.mjs` |
| `cli/lib/cell-plan.mjs` | `maude cell up` (unbuilt — needs the account) |
| `apps/cloud/reconcile.mjs` | the Worker + D1 + Queues |
| `apps/cloud/fleet.mjs` | the rollout executor |
| `apps/cloud/pricing.mjs` | Stripe Checkout + portal |
| `apps/cloud/mirror.mjs` (argv + classification) | the scheduled push |

This is not a testing convenience. **The failure modes of these systems live almost entirely in the decision layer:**

- a tenant id that escapes its R2 prefix (one missing trailing slash separates two customers' data);
- a destroy that removes data before routing, leaving a live endpoint serving a half-deleted project;
- a reconciler that purges a tenant who was never handed their files;
- an upgrade that rolls past an unhealthy canary;
- a live-mode price id that silently falls back to the sandbox;
- a mirror push that force-overwrites a customer's own commits.

Every one of those is a pure function, and every one is now a test that runs on a laptop with no account at all.

**The corollary that makes this honest:** the effects layer must be *thin and boring*. If it accumulates logic, the split has failed and the untested surface is growing again.

### 2. An unrun check reports SKIPPED, never passed

`maude hub workspace-up` executes two of its eight verification steps today; the rest report `skipped` with a reason. The tempting shortcut — run the easy checks, print a green summary — is how a verification suite becomes decorative.

Same rule stated as a general one: **a gate that cannot run must say so in the same output where a passing gate would say "ok".** A missing line reads as absence of a problem.

### 3. Guarantees are encoded in machines, not in policies

Three of the arc's promises are now structural rather than procedural:

- **Export before teardown** — `purged` is reachable *only* through `exported` in the lifecycle machine, and `stepToward` proves no route around it from any starting state. `pending` is the single exception, because a project that never activated never held anything.
- **Containment** — a cell refuses to boot if a rendering surface is reachable, the image contains no browser, and CI fails if either protection is removed.
- **Never force-push** — asserted as the *absence* of a flag in argv, in both the autosave path and the mirror path. Absence is precisely what a later edit adds with nothing noticing.

A policy is a sentence somebody can forget. A machine is a thing that refuses.

### 4. Copy is testable, and on the invite path it is load-bearing

The persona this product lives or dies by is the invited teammate who has never used git (DDR-193 §5). So the invite and sign-in paths assert their *words*: no `token`, `repository`, `github`, `oauth`, `bearer`, `crdt`. A flow that says "paste your bearer token" has already told that person the product is not for them, and no amount of correct mechanism fixes it.

The Trust page goes further: `trust-claims.test.mjs` verifies every cited file exists, re-asserts each load-bearing behaviour, and fails on aspirational language. **A trust page whose claims nobody checks is the exact thing a trust page exists not to be.**

### 5. The vendor boundary, stated once so it is not rediscovered

Blocked, and genuinely un-agentable — they need a browser, payment details, or domain control:

1. **Workers Paid** — Containers and Queues.
2. **R2 enablement** — a dashboard action with ToS acceptance.
3. **`cloud.maude.sh` on Cloudflare DNS** — no zone exists on the account.

Not blocked, and used: **Stripe sandbox** (the full Phase-0 §3 catalog is live there), **D1 and Workers scripts** (reachable, empty), **`gh`** (authenticated).

## Alternatives considered

- **Stop at Phase 4 and wait.** Rejected — it mistakes "cannot deploy" for "cannot build", and would have left the highest-risk decisions (tenant isolation, the purge machine, the canary gate) unwritten and unexamined until the moment they run against real customers.
- **Build the effects layers against mocks of the Cloudflare API.** Rejected: a mock of an API nobody has called is a fiction, and testing against it produces confidence rather than knowledge. The decision layers test against nothing at all, which is honest, and the effects layers wait for the real thing.
- **Mark unrun verification steps as passing until implemented.** Rejected — see §2.
- **Write the Trust page as prose and review it manually before launch.** Rejected: manual review happens once and the code changes weekly.

## Consequences

**Positive**
- Six phases' worth of the hardest decisions are written, tested, and reviewable now rather than under launch pressure.
- The day the account is paid, what remains is executable plumbing against a decided design.
- Three of the arc's four promises to customers are structural.
- The pattern generalizes: the next vendor-dependent arc starts by asking which half is decisions.

**Negative / accepted**
- **Untested-against-reality risk is real and concentrated.** `cellConfig` renders what the Containers API *should* accept, and no Cloudflare API has ever seen it. The first `maude cell up` will find things. That is a known, bounded surface — naming and shape — not a design question.
- **Code exists that nothing runs yet.** `infra/cell/` and `apps/cloud/*` have no production caller. Unused code rots; if the account is not paid within a release cycle or two, this needs re-verifying rather than assuming.
- **Phases 5–10 are closed as CORE COMPLETE, not complete.** Each archived plan lists exactly what remains and why. That distinction has to survive: a later reader who sees six archived plans could reasonably conclude the arc shipped.
- The Stripe catalog is a **sandbox** and its numbers are a proposal awaiting sign-off; `pricing.mjs` throws rather than falling back in live mode, which is the mitigation.

## Implementation notes

`infra/cell/{Dockerfile,entrypoint.sh}`, `cli/lib/cell-plan.mjs`, `apps/hub/src/invites.mjs`, `apps/cloud/{reconcile,fleet,pricing,mirror,trust-claims}.mjs`, `site/content/docs/cloud/trust.mdx`, `scripts/check-containment.sh` (extended to the cell image).

**Three tests found real defects rather than confirming the code:**

1. The reconciler's **fixed-point** test found that `pending → past_due` and `suspended → past_due` are not legal single hops, and the reconciler was flapping on an alert forever — the hourly cron would have cycled a tenant's cell indefinitely. Fixed by `stepToward()`: walk the shortest legal path one hop at a time.
2. `maude hub asset-check`, run against **this repo's own design root**, found that `sha8FromAssetPath` misclassified the real corpus shapes (`<sha8>-label.mp4`, `<sha8>.photo.json`) — the mirror would have refused legitimate assets. Every fixture had the tidy shape.
3. The Trust page's **citation check** caught a bare `users.mjs` reference that would have read as verifiable and was not.

The pattern in all three: **run the new thing against real data, not fixtures.** Fixtures are written by the same person who wrote the assumption.
