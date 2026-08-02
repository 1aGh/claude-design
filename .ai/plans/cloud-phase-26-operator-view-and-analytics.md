# Cloud Phase 26 — Operator view (superadmin) + product analytics

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports — `apps/cloud` has a strong house style (pure logic vs route effects, DDR-196 §1; colocated `node --test` files; server-rendered no-script pages).

## Description

Maude Cloud has no operator surface. The owner runs the fleet from `wrangler d1 execute` and the Stripe dashboard. This phase adds:

1. **`/operator` — a superadmin board** on `cloud.maude.sh`: every project + account, fleet health, cost-model alarms, revenue (MRR as-the-plane-believes), and one safe management action (reconcile nudge). Read-mostly by design.
2. **Product analytics events across the whole cloud app** — Workers Analytics Engine, emitted server-side (pages ship no script, so the edge IS the only place events can come from), with active-users metrics on the operator board.
3. **Tenant content stats** (canvases / artboards / design systems / storage) — pushed by the cell's own `/health` body, captured by the hourly reconcile sweep, stored in Analytics Engine (never in control-plane D1).
4. **Render-sandbox economics** (Stage 4, added 2026-08-02) — build counts, cache hit ratio, durations, ceiling hits and cold-start times, so Cloud Phase 25's build sandbox is *measured* rather than predicted. The €3/cell model has never been given real figures; this is where that ends.

**Decisive prior-art found during planning:** `fleet.mjs` already contains `fleetBoard()` (rows + interpreted problems: unhealthy / never-drilled / stale-checkpoint / version-spread / config-drift) and `costAlarms()` (€3/cell model, R2-egress-must-be-zero rule) — both fully tested, **zero non-test callers**. The operator board is largely a route over logic that is already green.

## User Story

As the **owner/operator of Maude Cloud** I want one signed-in surface showing every project, its health, what it earns and what it costs, plus basic usage analytics, so that I can run the fleet and the business without `wrangler` one-liners and guesswork.

## Problem

- No cross-tenant view exists: `dashboard.mjs` is the CUSTOMER dashboard, `project-admin.mjs` is per-project self-administration.
- No analytics of any kind: no signup funnel, no active-users number, no idea which features are touched.
- No cost/revenue visibility: `costAlarms()` "has simply never been given real figures" (phase-0 doc), MRR lives only in Stripe's UI.

## Solution

Three sequential stages, each shippable alone. **Stage order is load-bearing** (debate verdict): the operator board first (pure win, no policy questions), analytics second **and only together with the privacy-notice revision** (see Legal gate), content stats last (needs a hub-image change that rides the normal fleet rollout).

### Debate verdict (builder/shipper/breaker, reduce pass)

| Fork | Decision | Why |
| ---- | -------- | --- |
| Event storage | **Workers Analytics Engine only** — no D1 events table, no rollup tables | `schema.sql` header promises "a total loss of this database costs a customer nothing"; per-request rows would break that blast-radius design AND contend with `edge.mjs spend()`'s writes on the login path. AE = Cloudflare = already a named subprocessor (no DPA change). |
| Content stats | Cell **pushes** counts in its `/health` body; reconcile captures → AE. Skip-able v1 tail. | Channel already exists (`provision.mjs probeCell()` fetches `/health` hourly); `countCanvases()` already exists in `apps/hub/src/export.mjs:188`. Older images just omit the key → three-valued **unknown ≠ 0**. |
| Operator gating | **`OPERATOR_ACCOUNT_IDS` env allowlist (account ids, not emails)** + cookie session ONLY + 404 for non-operators | No migration to the blast-radius table; revocable in seconds; account ids dodge OAuth email-claim variance/aliasing. Solo operator = list of one. |
| Management actions | Read-only + exactly ONE write: insert `jobs (reason='manual')` + audit entry with REQUIRED reason | Reconcile is already the only honest mechanism for state change. Suspend/comp/refund stay in Stripe — the designated subscription authority; the hourly sweep picks them up. |
| Cost metric | Static model via existing `costAlarms()`, rendered as **model-vs-actual ratio**, never a currency invoice | GraphQL Analytics API = an account-wide-read token in the secret store for a number near €0. `modelPerCellEur: 3` is a Phase-0 estimate; presenting it as "costs" would make a model look like an invoice. |
| Revenue metric | MRR derived from D1 `projects.plan × state` × `pricing.json`, labeled **"as the plane believes"**, deep link to Stripe | `schema.sql`: "subscription status lives in Stripe… this table is the memory between runs, not the authority." A silent D1-derived MRR would drift on every missed webhook. |

### Security invariants (breaker verdicts — each becomes a test)

- **Cookie-session only.** The operator surface must NEVER use the `(await personalTokenAccount(env, request)) ?? (await currentAccount(request, env))` two-door pattern from `worker.mjs:77` — a leaked device PAT must not become a fleet key.
- **404, not 403** for non-operators (precedent: `worker.mjs` openProject — "404 for everything that is not sign in").
- **Own CSRF token on every operator POST.** `edge.mjs sameSiteGate` **fails open** when `Sec-Fetch-Site` is absent (line 150, "non-browser client") — so the gate alone protects nothing against a non-browser client that has stolen a cookie. Double-submit token (random value in an HttpOnly cookie + hidden form field, constant-time compare).
- **Operator cross-tenant READS are audited** — a fleet-wide list view IS the break-glass. `audit_log` actor `operator:<email>`, action `operator.board.viewed` etc. Rate: one entry per page view is fine at fleet size ≤ 50; revisit before it isn't.
- **The literal string "operator console" must never render on a customer surface** — `project-admin.test.mjs:498` asserts this (`assert.doesNotMatch(body, /operator console/i)`); a tenant hostname greeting a customer with an operator console was a real prior bug. New pages live under apex `/operator/*` only and reuse `appShell` — keep the trap test green.

### Legal gate (BLOCKER for Stage 2)

`site/content/docs/legal/privacy.mdx:31` states verbatim: *"We hold **no analytics, no tracking pixels, and no advertising identifiers**… The application sets exactly one cookie: your session."* Emitting account-keyed events makes that false on ship day (GDPR Art. 13 wants notice BEFORE processing). Stage 2 therefore ships the privacy revision **in the same change** as the first `writeDataPoint`, plus `privacy-claims.test.mjs` mirroring the existing `trust-claims.test.mjs` mechanism so the claim can never silently drift again. Events carry `account_id` (already a stored identifier covered by the DPA) — never email, never content.

## Metadata

- **Type**: New Capability
- **Complexity**: High
- **App/Package**: `apps/cloud` (primary), `apps/hub` (Stage 3 stats), `site` (privacy page)
- **Affected Systems**: control-plane Worker routes/edge/cron, D1 (reads only — NO new tables), Workers Analytics Engine (new binding), hub `/health`, privacy docs
- **Dependencies**: none new (AE is a platform binding; SQL API read uses `fetch`)

---

## Context References

### Must-Read Files

> During `/flow:execute`, read every file listed here in parallel in a single message.

- `apps/cloud/fleet.mjs` (lines 179–300) — Why: `fleetBoard()` + `costAlarms()` are the board's core, already written + tested, zero callers.
- `apps/cloud/schema.sql` — Why: the blast-radius header is the constraint the whole storage decision honors; table shapes for the D1 reads.
- `apps/cloud/worker.mjs` (route table + `scheduled()` at 435) — Why: where `/operator/*` routes and the cron stats pass land; the two-door auth pattern to AVOID.
- `apps/cloud/edge.mjs` — Why: `sameSiteGate` fail-open (line 150) motivates the CSRF task; `COST_RULES` if `/operator` needs a budget entry; `harden()` floor every new route inherits.
- `apps/cloud/auth-routes.mjs` (lines 100–110) — Why: `currentAccount()` is the ONLY auth door the operator surface may use.
- `apps/cloud/project-admin.mjs` (lines 380–420 route shape; 565–572 audit select) — Why: the house pattern for a signed-in page module + the audit under-rendering to fix (T4).
- `apps/cloud/dashboard.mjs` — Why: the pattern for an `appShell` page module (CSS block + pure page functions).
- `apps/cloud/brand.mjs` (line 418 `appShell`) — Why: the shell every signed-in page wears; nav `active` key contract.
- `apps/cloud/reconcile.mjs` — Why: pure-plan/executor split the stats sweep must follow; where the hourly sweep iterates projects.
- `apps/cloud/provision.mjs` (lines 75–96 `probeCell`) — Why: the existing hourly `/health` fetch Stage 3 piggybacks.
- `apps/cloud/pricing.mjs` + `pricing.json` — Why: plan → amount mapping for the MRR derivation.
- `apps/cloud/billing.mjs` (header) — Why: DDR-196 §1 pure/effects split explained in situ.
- `apps/hub/src/export.mjs` (lines 150–200) — Why: `countCanvases()` to reuse for the hub stats payload.
- `site/content/docs/legal/privacy.mdx` (lines 20–35) — Why: the exact sentences Stage 2 must revise.
- `apps/cloud/trust-claims.test.mjs` — Why: the claim-guard test pattern `privacy-claims.test.mjs` mirrors.

### Files to Create

- `apps/cloud/operator.mjs` — pure logic: gating predicate, board assembly (wraps `fleetBoard`/`costAlarms`), MRR derivation, CSRF token mint/verify.
- `apps/cloud/operator.test.mjs` — colocated tests.
- `apps/cloud/operator-pages.mjs` — server-rendered pages (overview, projects, accounts, project detail, events) via `appShell`.
- `apps/cloud/operator-pages.test.mjs` — page-render tests incl. the "operator console" leak trap.
- `apps/cloud/events.mjs` — pure: typed event vocabulary + shape validation (mirrors `pricing-core.mjs` style).
- `apps/cloud/events.test.mjs` — vocabulary tests.
- `apps/cloud/analytics.mjs` — route-effect: `track(env, ctx, event)` → `writeDataPoint` via `ctx.waitUntil`; AE SQL API reader for the board.
- `apps/cloud/analytics.test.mjs` — waitUntil/no-blocking + SQL query-shape tests.
- `apps/cloud/privacy-claims.test.mjs` — asserts privacy.mdx sentences match what the code actually does.

### Design canvases

| Canvas | Status | Tags | Notes |
| ------ | ------ | ---- | ----- |
| `.design/ui/Cloud Self Service.tsx` | `draft` | cloud, self-service, user-flow, onboarding, billing | The full customer journey board (15 screens, 5 stages) — the operator view is deliberately NOT on it (it's the owner's surface, not the customer's). Use it to keep vocabulary consistent (project, never cell/repo) and to see which customer moments exist → those are the analytics events. No operator mockup exists; the board is plain `appShell` tables, dashboard.mjs-style — a `/design:new` mockup is optional, not blocking. |

### Documentation

- [Workers Analytics Engine — writeDataPoint + limits](https://developers.cloudflare.com/analytics/analytics-engine/) — Why: binding config, blobs/doubles/indexes shape, sampling behavior at volume.
- [Analytics Engine SQL API](https://developers.cloudflare.com/analytics/analytics-engine/sql-api/) — Why: the board's DAU/WAU queries run over REST; token scope = Account Analytics Read only.
- `.ai/plans/archive/cloud-phase-0-economics-and-architecture.md` §3 — Why: the €3/cell model + fixed-cost figures the cost tiles cite.
- `.ai/plans/archive/cloud-phase-9-fleet-ops-trust.md` — Why: fleetBoard/costAlarms intent; "dashboard UI, live telemetry" was its declared leftover — this phase IS that leftover.

### Patterns to Follow

```js
// House auth read (auth-routes.mjs:105) — the ONLY door for /operator:
const account = await currentAccount(request, env);   // cookie session
// NEVER: (await personalTokenAccount(env, request)) ?? (await currentAccount(...))

// House page module (dashboard.mjs): CSS const + pure page fns + appShell:
export function operatorOverviewPage({ account, board, alarms, mrr, metrics }) {
  return appShell({ title: 'Operator', account, active: 'operator', css: CSS, body: ... });
}

// House pure/effects split (billing.mjs header, DDR-196 §1):
// operator.mjs takes rows and returns view-models; worker.mjs does the fetching.

// House operator audit (schema.sql:119-124): actor 'operator:<email>', reason REQUIRED.
```

---

## Design Decisions

### Components / blocks reused

| Screen / block | Source | Notes |
| -------------- | ------ | ----- |
| Signed-in shell + nav | `apps/cloud/brand.mjs appShell` | add `operator` nav key, rendered ONLY when `isOperator()` |
| Table + state-pill styling | `apps/cloud/dashboard.mjs` / `people-page.mjs` CSS | lift the existing class shapes; no new design vocabulary |
| KPI tile | new, minimal | plain `<dl>` tiles in operator CSS; numbers in the DS mono role |

No icons, no client JS — the no-script rule is load-bearing (a board that needs JS can't report an outage during one).

---

## Tasks

Execute in order. Stage boundaries are shippable checkpoints.

### Stage 1 — Operator board (read-only + one nudge)

#### Task 1: CREATE `operator.mjs` + tests (pure logic)

- **Do**: `isOperator(env, account)` — splits `env.OPERATOR_ACCOUNT_IDS` (comma, trim), matches `account.id` exactly. `assembleBoard({ projects, template, now })` — maps D1 project rows into `fleet.mjs` `Cell` shape, returns `{ board: fleetBoard(...), alarms: costAlarms(...) }`. `deriveMrr(projects, pricing)` — active+past_due × plan amount, per-plan breakdown, labeled object `{ believedMonthlyMinor, byPlan, caveat: 'as-the-plane-believes' }`. `mintCsrf()` / `verifyCsrf(cookie, field)` — random 128-bit, constant-time compare (`crypto.subtle` or byte loop).
- **Pattern**: `pricing-core.mjs` (pure, exhaustively tested), `fleet.mjs` (takes state, returns plan).
- **Gotcha**: `fleetBoard` expects `lastCheckpoint`/`lastRestoreDrill` in ms epoch and `health` — derive `health` from `cell_running` + `state` honestly (`unknown` when the plane has no probe result, never default to healthy).
- **Validate**: `cd apps/cloud && node --test operator.test.mjs`

#### Task 2: CREATE `operator-pages.mjs` + tests

- **Do**: pages — `/operator` overview (KPI tiles: accounts, projects by state, MRR-believed + Stripe deep link, cost model-vs-actual ratio + alarms, fleet problems list), `/operator/projects` (all projects: state, plan, owner email, version, last_checkpoint, cell_running; per-row → detail), `/operator/accounts` (accounts + project counts + created_at), `/operator/projects/<id>` (detail: project row, jobs tail, audit tail WITH reason column, reconcile-nudge form with REQUIRED reason textarea + CSRF field).
- **Pattern**: `dashboard.mjs` (CSS + gallery), `project-admin.mjs auditPage` (tail rendering).
- **Gotcha**: `project-admin.test.mjs:498` — customer surfaces must never match `/operator console/i`; keep the phrase off shared shell strings. Numbers use the mono role per the DS.
- **Validate**: `node --test operator-pages.test.mjs`

#### Task 3: UPDATE `worker.mjs` — routes + gate + nudge

- **Do**: route block `if (url.pathname === '/operator' || url.pathname.startsWith('/operator/'))` placed with the other signed-in surfaces. Resolution: `currentAccount` ONLY → not signed in → redirect `/login`; signed in but `!isOperator` → **404** (body identical to the generic not-found). GET pages audit `operator.board.viewed` / `operator.project.viewed` (actor `operator:<email>`, project_id where applicable) via `ctx.waitUntil`. POST `/operator/projects/<id>/reconcile`: verify CSRF + non-empty reason → insert `jobs (id, project_id, reason='manual', created_at)` + `audit_log` entry (reason REQUIRED) → redirect back.
- **Pattern**: the `adminSurface` delegation shape at `worker.mjs:237-241`.
- **Gotcha**: do NOT touch the `/health`, `/internal/*`, `/webhooks/*` fast paths; keep `/operator` AFTER the session read at `worker.mjs:219` so it reuses the one session fetch.
- **Validate**: `node --test worker.test.mjs operator*.test.mjs` — new cases: non-operator 404, PAT-bearer 404 (no two-door), CSRF-missing 403, nudge writes jobs+audit, customer pages still never match `/operator console/i`.

#### Task 4: UPDATE `project-admin.mjs` — audit page honesty (breaker demand)

- **Do**: add `reason` to the audit SELECT (line 567-ish) and render it (em-dash when null); extend `AUDIT_COPY` with the new operator actions (`operator.board.viewed`, `operator.project.viewed`, `operator.reconcile.nudged`) so a customer never sees a raw action key.
- **Pattern**: existing `AUDIT_COPY` map.
- **Gotcha**: append-only table — display change only, no schema change.
- **Validate**: `node --test project-admin.test.mjs`

#### Task 5: UPDATE `wrangler.toml` + docs

- **Do**: document `OPERATOR_ACCOUNT_IDS` in `[vars]` with a comment (empty default = surface fully disabled → every `/operator` hit is 404); note that setting it is a deploy-time act, deliberately.
- **Validate**: `wrangler deploy --dry-run` clean.

### Stage 2 — Analytics events (privacy revision FIRST, same change)

#### Task 6: UPDATE `site/content/docs/legal/privacy.mdx` + CREATE `apps/cloud/privacy-claims.test.mjs`

- **Do**: replace the "no analytics" sentence with the truth: first-party, server-side operational analytics on Cloudflare (already a listed subprocessor); add a "What we hold" row — *Usage events (account id, action name, timestamp) · improving and operating the service · 90 days* (AE default retention; state whatever AE actually gives). Explicitly keep: no tracking pixels, no advertising identifiers, no third-party analytics, no cookies beyond the session. `privacy-claims.test.mjs` greps the mdx for the load-bearing sentences (mirror `trust-claims.test.mjs` mechanics) so code and claim can't drift apart.
- **Gotcha**: this task MERGES WITH or PRECEDES task 8 in the same commit — never ship `writeDataPoint` ahead of the notice.
- **Validate**: `node --test privacy-claims.test.mjs`

#### Task 7: CREATE `events.mjs` + tests (pure vocabulary)

- **Do**: typed vocabulary, one object per event: `signup`, `login` (method: password|google), `login_failed`, `checkout_started`, `checkout_completed`, `project_provisioned`, `project_opened`, `invite_created`, `invite_redeemed`, `billing_portal_opened`, `cancel_requested`, `export_downloaded`, `delete_requested`, `report_submitted`, `page_view`. `validateEvent()` rejects unknown names/fields; `toDataPoint(event)` maps to AE shape — `indexes: [name]`, `blobs: [accountId ?? '', projectId ?? '', prop1 ?? '']`, `doubles: [1]`. NO email, NO content, NO free-text user input in any blob.
- **Pattern**: `pricing-core.mjs` — data + pure functions + exhaustive tests.
- **Validate**: `node --test events.test.mjs`

#### Task 8: CREATE `analytics.mjs` + UPDATE `wrangler.toml` + instrument routes

- **Do**: `[[analytics_engine_datasets]] binding = "EVENTS", dataset = "maude_cloud_events"`. `track(env, ctx, event)` — validate, `env.EVENTS?.writeDataPoint(toDataPoint(event))` inside `ctx.waitUntil`, never awaited inline, no-op when binding absent (local tests). Auto `page_view` for signed-in GET HTML responses at the single point in `worker.mjs` where the session was read (no per-route edits); explicit `track()` calls at the ~14 product moments (auth-routes, checkout-routes, provisioning, invites, project-admin export/delete, billing, report).
- **Gotcha**: `ctx` must be threaded to modules that don't have it today — pass `ctx` alongside `env` in the route delegations, don't invent globals. Failure of `track` must never fail the request.
- **Validate**: `node --test analytics.test.mjs worker.test.mjs` — cases: event fires via waitUntil, request succeeds when binding absent/throws, no email in any blob.

#### Task 9: Operator events page (AE SQL API read)

- **Do**: `analytics.mjs` gains `queryEvents(env, sql)` → `fetch('https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/analytics_engine/sql', { headers: { authorization: 'Bearer ' + env.CF_ANALYTICS_TOKEN } })`. Board queries: DAU/WAU/MAU (distinct accountId blob per window), events-by-name last 7 d, signups + checkouts last 30 d. `/operator/events` page + DAU tile on the overview. When `CF_ANALYTICS_TOKEN` unset → tiles render "analytics not connected", never an error page. Document the secret (`wrangler secret put CF_ANALYTICS_TOKEN`, token scope = Account Analytics Read ONLY).
- **Gotcha**: AE sampling: fine at this volume, but render counts as `~n` when AE reports `_sample_interval > 1`.
- **Validate**: `node --test analytics.test.mjs operator-pages.test.mjs`

### Stage 3 — Tenant content stats (unknown ≠ 0)

#### Task 10: UPDATE `apps/hub` `/health` — aggregate stats payload

- **Do**: extend the health handler's JSON with `stats: { canvases, artboards, designSystems, assetsBytes }` — reuse `countCanvases()` (`export.mjs:188`, move/export it rather than duplicating), `designSystems` = dirs under `<designRoot>/system/`, `artboards` = count of `<DCArtboard` occurrences across canvas `.tsx` (approximation, cheap grep), `assetsBytes` from the assets dir stat. Cache the computation ~5 min (health is polled) — counts only, never names.
- **Pattern**: hub house style in `apps/hub/src/server.mjs`; check hub's own tests layout before writing.
- **Gotcha**: this rides the NORMAL fleet canary rollout (fleet.mjs waves) — no forced upgrade; old images simply omit `stats`.
- **Validate**: hub test suite (`cd apps/hub && npm test` or the repo's hub test command — verify which exists before relying on it).

#### Task 11: UPDATE `reconcile.mjs`/`worker.mjs scheduled()` — capture stats → AE

- **Do**: where the hourly sweep already probes cells (`probeCell` path), parse `body.stats`; when present, `track()` a `tenant_stats` datapoint (blobs: projectId; doubles: canvases, artboards, designSystems, assetsBytes). When absent → emit nothing (unknown stays unknown).
- **Gotcha**: `probeCell` currently discards the body after the ok check — extend the return, don't add a second fetch. Keep the pure/effects split: parsing pure + tested, the fetch in the executor.
- **Validate**: `node --test reconcile.test.mjs provisioning.test.mjs`

#### Task 12: Operator board renders content stats

- **Do**: per-project columns on `/operator/projects` + totals tile on the overview, sourced from the latest `tenant_stats` AE rows; render `—` (unknown) for cells that never reported, NEVER `0`.
- **Validate**: `node --test operator-pages.test.mjs`

### Stage 4 — the render sandbox's economics (measures Cloud Phase 25 A0)

Phase 25 puts a **build sandbox in the cell** so the browser can show and edit a
project. The cost review said it should not move pricing — a canvas build is a
sub-second Active-CPU burst, and Cloudflare bills cycles rather than wall-clock,
so an open-but-idle tab costs nothing. But that verdict rests on the same €3/cell
model this plan already describes as *"never given real figures"* — the Phase-5
measurement gate did not run. **This stage is how that stops being a guess.**

Three things decide whether the sandbox stays cheap, and all three are
measurable rather than arguable:

1. **Cache hit ratio.** Rebuild per page-view ⇒ cost scales with VIEWS. Cache by
   content hash ⇒ cost scales with EDITS. That is an order-of-magnitude
   difference and the single biggest lever; it is also the number that says
   whether Phase 25 A1 picked the right caching strategy.
2. **Pathological builds.** A canvas with a huge import graph burns Active-CPU
   on OUR bill while the tenant pays a flat €19. Per-tenant blast radius, but
   the money lands here — which is why A1's wall-clock and memory ceilings are
   economically load-bearing, not only a security control. Ceiling hits are the
   signal, and they are the same signal as abuse.
3. **Cold start.** The studio runtime makes the cell image bigger. A cold start
   measured ~8 s before the sandbox existed; the 0.5 vCPU ceiling means the
   first render is a UX cost long before it is a money cost.

**Gated on Phase 25 A1 existing** — there is nothing to measure before the
sandbox does. The board columns may land earlier and render `—`; per this
plan's own rule, unknown is never `0`.

#### Task 13: UPDATE `apps/hub` `/health` — render-sandbox counters

- **Do**: extend the Stage-3 `stats` payload with `render: { builds, cacheHits, cacheMisses, rejectedImports, timeouts, memoryKills, durationMsP50, durationMsP95, durationMsMax, cpuMsTotal, largestGraphBytes }`, aggregated over a rolling 1 h window in memory. Counts and durations only — never a canvas name, never a path, never the rejected specifier's text (the specifier is tenant-authored content; a count of rejections is the operational fact, the string is not).
- **Pattern**: same channel and shape discipline as Task 10 — the cell already computes `stats`; this is another key beside it, not a second endpoint.
- **Gotcha**: the window is in memory, so a cell restart resets it. Report `windowStartedAt` alongside so the sweep can tell "quiet hour" from "just rebooted" — a zero that means "no data" must not be read as a zero that means "no builds". Rides the normal canary rollout; older images omit `render` entirely.
- **Validate**: hub test suite.

#### Task 14: UPDATE the sweep — capture render counters → AE

- **Do**: in the same `probeCell` pass Task 11 extends, parse `body.stats.render`; when present emit a `tenant_render` datapoint (blobs: projectId; doubles: the counters above). Absent ⇒ emit nothing.
- **Gotcha**: do NOT derive a cache-hit RATIO in the cell or the sweep — store the two counts and divide at read time. A ratio computed over a window that reset is a confident lie; two counts and a window start can be judged.
- **Validate**: `node --test reconcile.test.mjs analytics.test.mjs`

#### Task 15: The cost tile learns to say WHY

- **Do**: `costAlarms()` today reports one number per cell against `modelPerCellEur: 3`. Split the operator overview's presentation into **sync** vs **build** so an over-model cell is attributable, and add a per-project render column set (builds, cache-hit %, p95 duration, ceiling hits) to `/operator/projects`. Add an alarm for ceiling hits above a threshold — that is the pathological-canvas signal and it is worth a page, not a chart nobody opens.
- **Gotcha**: keep the DDR-level framing this plan already committed to — the number is a **model-vs-actual ratio, never an invoice**. `modelPerCellEur: 3` is a Phase-0 estimate; once real figures exist for a full cycle, revisit the constant deliberately and record the change, rather than quietly tuning it until the alarm stops.
- **Validate**: `node --test operator-pages.test.mjs fleet.test.mjs`

#### Task 16: Cold start is a tracked number, not an anecdote

- **Do**: the sweep already knows when it woke a sleeping cell. Record wake events with their time-to-`/health`-ok as a `tenant_wake` datapoint (blobs: projectId; doubles: coldStartMs), and put p95 on the overview. Baseline it BEFORE the sandbox ships so the image-growth regression has something to be a regression against.
- **Gotcha**: this is the one metric worth capturing even if Phase 25 slips — it is the cheapest early warning that the cell image is getting heavy, and today the only figure anyone has is a single ~8 s observation.
- **Validate**: `node --test reconcile.test.mjs`

---

## Validation

1. **Unit**: `cd apps/cloud && npm test` (node --test, all colocated suites) — zero regressions.
2. **Hub**: hub test suite for Task 10.
3. **Deploy sanity**: `cd apps/cloud && wrangler deploy --dry-run` clean (binding + vars parse).
4. **Repo gates**: run the `quality` gates from `.ai/workflows.config.json` (`/flow:validate` route) — lint/tests/build.
5. **Security cases (must exist as tests, not manual checks)**: non-operator 404 · PAT-bearer 404 · CSRF-missing rejection · operator reads audited · no email in AE blobs · customer surfaces never match `/operator console/i` · `privacy-claims.test.mjs` green.
6. **Manual**: signed-in operator walkthrough on a preview deploy — overview, projects, detail, nudge (writes jobs + audit), events page with and without `CF_ANALYTICS_TOKEN`.

> Cross-platform scenario-runner / a11y fan-out is N/A here (server-rendered no-script admin surface, no `.ai/scenarios` for cloud). A11y still applies statically: semantic tables, labels on the reason textarea, contrast via existing DS tokens.

---

## Acceptance Criteria

- [ ] Stage 1: `/operator` live behind `OPERATOR_ACCOUNT_IDS`, cookie-only, 404 otherwise; fleetBoard + costAlarms + MRR-believed rendered; reconcile nudge writes jobs + audited reason
- [ ] Audit page renders `reason`; new operator actions have `AUDIT_COPY` entries
- [ ] Stage 2: privacy.mdx revised in the SAME change as the first emitted event; `privacy-claims.test.mjs` guards it
- [ ] Events vocabulary pure + tested; `track()` never blocks or fails a request; ~14 product moments instrumented
- [ ] DAU/WAU on the board via AE SQL API; graceful "not connected" state
- [ ] Stage 3: content stats flow cell → health → AE; unknown renders as `—`, never `0`
- [ ] Stage 4: cache-hit ratio, build p95, ceiling hits and cold-start p95 are visible per project; the cost tile attributes an over-model cell to sync or to builds
- [ ] Stage 4: no tenant-authored string reaches AE from the render counters — counts and durations only, rejected specifiers never quoted
- [ ] Stage 4: a cell that restarted mid-window is distinguishable from a cell that simply built nothing (`windowStartedAt` reported, zero never read as "no builds")
- [ ] Cold-start p95 has a pre-sandbox baseline recorded, so the image-growth regression has something to be measured against
- [ ] All security-invariant tests listed in Validation §5 exist and pass
- [ ] No DDR-worthy decision left unrecorded (candidates: operator gating model; AE-not-D1 storage; privacy-claim guard mechanism; revisiting `modelPerCellEur` once real figures exist)
