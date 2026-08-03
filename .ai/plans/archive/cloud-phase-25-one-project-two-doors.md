# Cloud Phase 25 — One project, two doors

> Written from the **owner review of `.design/ui/Cloud Self Service.tsx`**
> (2026-07-31): 15 canvas comments plus the architecture questions that came out
> of them. Decisions recorded in kgai as
> `cloud-surface-topology-two-doors-no-gallery`,
> `self-hosted-is-the-hub-and-cloud-stays-open` and
> `mirror-two-modes-backup-and-design-sync`. The canvas is the visual spec —
> boards **C2 · C4 · D1 · D3 · E0** are the screens this phase builds.
>
> **Phase 24 makes what exists honest. This phase changes what exists.** They are
> deliberately separate: 24 is copy, small handlers and fleet plumbing, and must
> stay finishable while this one is still an argument.
>
> **Revised 2026-08-02 — A0 is decided and the scope grew.** The browser is no
> longer read-only: a member edits in it. What the browser never gets is the
> agent. See "A0 — decided" below for the verdict and what it costs.

## What was decided

1. **The read-only gallery is dropped.** `view-<project>.cloud.maude.sh`, the
   published-snapshot surface, and the `maude share publish` CLI verb all go.
2. **Roles become real, once.** A member's rights are the same wherever they
   sign in. One model, enforced at the cell — the browser and the desktop are
   both clients of it, neither is the authority.
3. **`<project>.cloud.maude.sh` becomes Maude Studio in the browser**, behind the
   same Maude account as the dashboard. Signed out ⇒ auth screen. Signed in
   without membership ⇒ a refusal, not a 404 that leaks whether the project
   exists.
4. **The browser edits; the agent does not live there.** Direct manipulation,
   comments and annotations in the tab. `/design:*` flows, the ACP panel and
   anything that spawns `claude` stay on the desktop — see A0 for why that split
   is not a limitation to be lifted later.
5. **The operator console stays, as infra only.** In platform mode it is not a
   second self-service surface and a customer never needs it.
6. **The self-hosted product is the hub**, which already carries accounts,
   invites, roles, export, backup and mirror. It is not a portable copy of the
   control plane. What it lacks is exactly item 3.
7. **Mirror grows a second mode**: design-sync into the customer's own repo,
   alongside today's whole-repo backup.

---

## A0 — decided (2026-08-02): sandbox the project in the cell

**Verdict: option (a) — ship the studio canvas pipeline into the cell**, inside a
sandbox, and serve it to the people who already have access to that project. The
browser gets direct-manipulation editing, comments and annotations. Agent flow
stays on the desktop.

### What forced the question

**Rendering a canvas means building and executing the customer's TSX.**
Read-only never removed that — it only removed writes. `canvas-build.ts` is
explicit that after the four externalised runtime packages, *"every other import
(npm packages, relative imports of sibling canvas components) goes through Bun's
default resolver"*. There is **no import allowlist**. On a laptop that is
correct and harmless: your code, your machine, your files. In a cell it is a
build-time read primitive pointed at a container that holds the derived cell
secret, the mirror token and — today — a **bucket-wide R2 credential**.

So the security question was never "may a viewer edit". It was "may our
infrastructure build a stranger's source". Both read-only and editing answer it
the same way, which is why they are one decision and not two.

### Standing against DDR-206's own reopen criteria — honestly

[DDR-206](../archive/decisions/DDR-206-browser-editing-decided-decline-again-with-a-priced-path.md)
declined browser editing on 2026-07-30 and named three conditions, ALL of which
it required. Where we actually stand:

| Criterion | Status |
| --- | --- |
| Paying tenants asking | **Not met.** The owner is choosing to build it; no customer asked. Recorded as such — this is a product bet, not demand. |
| An on-call story covering a code-exec origin | **Not met — this phase must produce it.** See A3. |
| Corpus-parity CI green a full cycle | **Largely evidenced, not yet running.** The Phase-21 spike built 136/136 canvases with median 0.6% JS drift. A2 turns that into CI. |

**What legitimately changed** is a parameter inside DDR-206's threat model, not
just the owner's appetite. Its unpriceable line was on-call for *an
anonymous-signup code-execution host*. The sandbox decided here is not that: it
executes **only a project's own source**, **only for authenticated members of
that project**, in **that project's own container**. Every principal is a named
account attached to a paying tenant. That is a materially smaller blast radius
than the surface DDR-206 priced, and it is the honest basis for amending it.

**What has not changed** is BREAKER's confidence-8 warning: one incident on a
code-execution host at two-person headcount is unrecoverable. A3 exists because
that warning survives the amendment.

### The containment invariant is NOT repealed — and that is checkable

DDR-193 §2 says *"no tenant-authored TSX is ever evaluated by vendor-operated
compute"*, and unlike most invariants here it is **enforced in three places**:
`scripts/check-containment.sh` at review time, `infra/cell/assert-containment.sh`
at image build, `infra/cell/entrypoint.sh` at boot. What they actually forbid is
a **browser** in the cell (playwright / puppeteer / chromium), because rendering
means running one.

**This sandbox needs no browser.** The split is exact:

- the **cell builds** — Bun.build parses and transforms source into a module;
- the **viewer's browser evaluates** — in a segregated origin, exactly as the
  desktop already does under DDR-054.

Build is not evaluation, and that is precisely the line DDR-193 §2 draws. So all
three guards stay **in force and unmodified**, and A1 must be designed to keep
them that way. `assert-containment.sh` says it best about itself: *"a guard you
had to loosen to keep your build green is a guard that will be loosened again."*
**If a future task needs one of them relaxed, the design has drifted — treat it
as a stop, not a chore.**

What DDR-193 §2 did not contemplate is that a *bundler* also touches the
filesystem. That is a genuinely new adjacent surface, and it is what A1 exists
to close.

### Rejected, and why

- **(b) Render on the desktop, publish the output.** The gallery we just deleted
  wearing a better UX — stale whenever nobody has the app open, and a project
  whose owner is on holiday shows nothing.
- **(c) Build in the viewer's browser.** Moves the risk into the viewer's tab
  rather than removing it, and makes the client the heaviest part of the system.
- **Agent flow in the browser.** Declined permanently, not deferred. Running
  `claude` on our infrastructure is unbounded tool access AND a licensing trap:
  a Pro/Max subscription drives the user's OWN CLI on their OWN machine
  (DDR-123). The desktop is not the lesser door for agent work; it is the only
  lawful one.

---

## Track A — the sandbox (everything else waits on this)

The cell has never rendered a canvas. It holds files, syncs Yjs, serves assets
and lists canvases; the only studio file `apps/hub/Dockerfile` borrows is
`apps/studio/sync/autocommit.ts`. This is net-new infrastructure, not a flag.

- [x] **A-1 — per-tenant R2 credentials. PREREQUISITE, not a task in this
  track.** *(Code-complete 2026-08-02.)* The control plane mints **R2
  temporary access credentials** per tenant (`/internal/cell-r2-credentials`,
  authed by the tenant-derived cell secret; `apps/cloud/r2-creds.mjs`) —
  scoped to one bucket + `tenants/<id>/` prefix, TTL 12 h. The cells Worker
  fetches them at container start and FAILS CLOSED (no creds + no legacy key
  ⇒ the cell refuses to start rather than boot empty); the hub refreshes its
  own credentials before expiry with its HUB_SECRET
  (`apps/hub/src/s3-creds.mjs` — backups, asset proxy, asset sweep and export
  all resolve per-operation now). The fleet-wide `MAUDE_R2_*` Worker secrets
  are a migration fallback only; deploy step deletes them. Tests:
  `r2-creds.test.mjs` (scoping + fail-closed + route auth),
  `cell-config.test.mjs` (env mapping), `s3-creds.test.mjs` (refresh).
- [x] **A1 — the build sandbox.** *(2026-08-02.)* The build runs in its own
  process under the bundled Bun — the desktop's OWN pipeline, so the artifact
  is identical (same `Bun.hash` cd-ids, same bundle) rather than esbuild's
  measured-close relative. Empty environment, wall-clock deadline, RSS ceiling,
  and an import allowlist confined to the runtime packages, `@maude/canvas-lib`
  and paths inside the design root. A rejected import is a sentence the author
  can act on. Original text: Bun.build runs against customer TSX with:
  an **import allowlist** (the runtime packages, `@maude/canvas-lib`, and
  relative paths that resolve *inside* the design root — nothing else), no
  access to cell secrets or env, a wall-clock and memory ceiling, and no
  network. A rejected import is a legible error in the UI, not a 500.
- [x] **A1b — decide what a build costs to repeat.** *(2026-08-02.)* Cached by
  the content hash of the canvas AND every sibling it can import; counters
  (hit ratio, p50/p95, timeouts, memory kills) emitted from day one at
  `GET /api/studio/stats`. Original text: Cache built modules by
  content hash. Rebuild-per-page-view makes cost scale with **views**; a
  content-hash cache makes it scale with **edits** — an order of magnitude, and
  the difference between a €19 plan that works and one that does not. The same
  choice sets the ceilings' job: A1's wall-clock and memory limits are
  **economically** load-bearing, not only a security control, because a
  pathological import graph burns Active-CPU on our bill while the tenant pays a
  flat rate. Cloud Phase 26 Stage 4 measures whether this call was right (cache
  hit ratio, build p95, ceiling hits) — so emit those counters from day one
  rather than retrofitting them.
- [x] **A2 — corpus-parity CI.** *(2026-08-02.)* `scripts/corpus-parity.mjs`
  + `.github/workflows/corpus-parity.yml` build the whole corpus through the
  sandbox on every pipeline change. Found a real one on the first run (a DS
  specimen importing `lucide-react`, also silently broken on the desktop).
  70/70 green. Original text: DDR-206's third criterion, made real: build the
  full canvas corpus (alligators + maude, 142 canvases) in the sandbox on every
  change to the pipeline, and fail on a one-sided failure or drift beyond the
  spike's measured envelope. Green for a full cycle before B ships.
- [x] **A3 — the on-call story.** *(2026-08-02.)*
  `docs/ON-CALL-RENDER-ORIGIN.md`, written before the origin existed, with a
  per-tenant kill switch that was EXERCISED (a file on the volume pauses
  rendering with no restart; the project stays healthy). Original text: DDR-206's second criterion, and the one the
  amendment does not dissolve. What is monitored, what pages a human, what the
  kill switch is (per-tenant render disable, not fleet-wide), and what the
  incident runbook says. Write it before the origin exists, not after.
- [x] **A4 — the execution origin.** *(2026-08-02.)* Two origins: the shell
  (cookie session, never serves tenant code) and `canvas.<zone>/<tenant>/…`
  (short-lived read-only capability, no mutating route reachable). Original
  text: The rendered canvas runs in a segregated
  origin per DDR-054, exactly as the desktop already does — the editing shell
  and the customer's code never share an origin, in the browser either.

## Track B — the browser door (gated on Track A)

- [x] **B1 — auth at the cell.** `<project>.cloud.maude.sh` authenticates against
  the Maude account, not a workspace password. The chain already exists for the
  desktop (personal token → `POST /projects/open` → project token → cell
  `POST /auth/login {token}` → hub user token); this is the browser-session
  equivalent. Canvas board **C4**, left pane.
- [x] **B2 — the refusal.** Signed in, not a member ⇒ a page that says so and
  names who to ask. Never a 404 and never a redirect that leaks membership.
- [x] **B3 — render the project.** Per Track A. Canvas navigation, real
  canvases, the real design system.
- [x] **B4 — edit by direct manipulation.** Move, resize, reorder, edit text,
  change tokens — the operations the studio already exposes without an agent.
  Every edit is a **shape-checked structured mutation** applied server-side, not
  a client-supplied TSX blob: the source of truth is `.tsx`, so a UI edit is a
  source transformation (`canvas-edit`), and that AST path has produced a real
  bug class before (the inline-edit DOM-leaf-text vs AST-mixed-source mismatch).
- [x] **B5 — comments and annotations.** Both surfaces, one store. Supersedes
  the old C3.
- [x] **B6 — what the browser cannot do, it says so.** No ACP panel, no
  `/design:*`, no agent. Where an agent-only capability would sit, the browser
  names the desktop rather than hiding the feature — a person must be able to
  learn why, not just find it missing.
- [x] **B7 — export from the browser.** Same bundle the dashboard produces; a
  member must be able to leave with the work without installing anything.
- [x] **B8 — the cell landing stops being a splash.** `renderLanding()` in
  `apps/hub/src/server.mjs` currently sends the customer *back* to the dashboard
  in platform mode, and answers everything else with "Welcome to Hocuspocus!".
  It becomes the project.

## Track C — one permission model, both surfaces

The rule this track exists to enforce: **a role means the same thing in the
browser and in the desktop app.** Two enforcement points would drift, and the
weaker one would become the way in.

- [x] **C1 — the `viewer` role does something.** *(Landed 2026-08-01.)* Enforced
  at the cell: a read-only session cannot write files, cannot commit, cannot
  mutate Yjs. `readOnlyAllowedPath` is pinned by a test so the allowlist cannot
  grow by accident.
- [x] **C2 — the desktop honours the model in its UI.** *(Landed 2026-08-02.)*
  Two halves: (1) the **local dev-server now refuses** project-mutating writes
  for a viewer session — default-deny wrapper over the whole route table +
  fetch fall-through with a short C1-style allowlist (`READ_ONLY_ALLOWED_WRITES`
  in `http.ts`; canvas-meta splits its viewport/layout lanes in-handler), so a
  viewer's clone can never silently diverge from the cell; (2) the **UI makes
  editing absent, not hidden** — `/_config.readOnly` → shell (menus, sidebar
  create/delete/move, Inspector/Layers/Assistant panels + dock tabs + shortcuts,
  GitPanel, comments actions, VIEW ONLY stamp with the why) and `?ro=1` → canvas
  iframe (tool palette filtered to browse/move/hand, context-menu allowlist,
  drag/resize/reorder chrome unmounted, inline edit + keyboard edit ops dead,
  meta layout-lane dropped). Comment writes stay absent until C3 puts them on
  the cell's allowlist. Tests: `test/read-only-gate.test.ts`,
  `test/use-tool-mode.test.tsx` (filter), `test/canvas-url.test.ts` (ro=1).
- [x] **C3 — the browser honours the same model.** Same role, same absences,
  same server refusals. Written once against the cell's answer, not twice
  against two clients' guesses.
- [x] **C4 — the role matrix is stated and tested.** owner / member / viewer ×
  (read · edit · comment · annotate · export · invite · delete · mirror), as one
  table with one test suite that both surfaces run against. Comments are the one
  write a viewer holds, which is exactly where a scope bug undoes the model.
- [x] **C5 — delete the gallery.** `view-<project>` routes, `apps/cells/share*`,
  the `maude share publish` verb, and every string that promises a gallery. A
  surface that stays half-alive is worse than one that never shipped.

## Track D — mirror gets the mode people expected

Today: `git push mirror HEAD:refs/heads/<branch>` from the cell's own repo — the
whole repository, full history, onto a disjoint branch. That is a **backup**, it
works, and it stays: it is what makes "you can leave" true.

- [x] **D1 — design-sync.** Commit the `.design` tree into a folder of the
  customer's **own working repo**, on top of **their** history, as a pull
  request. Not a branch push — a normal diff a developer reviews. Canvas board
  **D3**.
- [x] **D2 — the mode is a visible choice**, with each mode's consequence stated
  before Save. A customer pointing this at the repo their website lives in must
  know what lands next to it.
- [x] **D3 — say what the backup contains.** It carries whatever the cell's repo
  holds, which depends on how the project started: seeded from an existing repo
  ⇒ everything; created by the wizard ⇒ only the design workspace.

## Track E — the self-hosted product

The hub already has accounts, invites with roles, tokens, export, backup, mirror
and an invite UI. `apps/hub/src/auth-routes.mjs:442` is the proof this was always
the intent: `POST /invites` returns 409 under `cloudIdentityStrict()` because
"the dashboard's People page is the one place members are added" — the hub owns
invites and *defers* in cloud mode.

- [x] **E1 — the console is dressed as a product, not infra.** Peers, tokens,
  canvases, activity and settings are operator vocabulary. A self-hoster is also
  a *user*.
- [x] **E2 — Track B lands for the self-hosted hub too.** Same code path, no
  control plane required. This is the whole reason B is worth building twice
  over. Note the sandbox is worth *more* here, not less: a self-hoster's cell
  runs on their own hardware, and A1's ceilings are what stop a runaway canvas
  taking their machine with it.
- [x] **E3 — in platform mode the console hides what the dashboard owns.**
  Invites and users already 409 under strict identity; the UI should match rather
  than offer a button that fails.
- [x] **E4 — do NOT port `apps/cloud`.** It is multi-tenant provisioning (D1, R2,
  Cloudflare DNS + container API, the reconcile cron) and Stripe. A self-hoster is
  their own single tenant and needs none of it. Recorded as
  `self-hosted-is-the-hub-and-cloud-stays-open`.

---

## Order, and why

**C2 first** — the desktop's UI half is the only track with no gate, it is what
makes the invite email honest, and it forces the role matrix (C4) to be written
down before a second surface starts reading it.

**A-1 next, on its own.** Per-tenant R2 credentials block a second paying
customer regardless of this phase; in a cell that builds untrusted source they
stop being a follow-up.

**Then Track A**, in order A1 → A2 → A3. A3 is not paperwork to be done last:
DDR-206's unpriceable line was on-call, and writing the runbook before the
origin exists is the only version of that promise that means anything.

**Then B**, which is mostly ordinary product work once the sandbox holds.

**D independently** — design-sync touches nothing A, B or C touch, and it is the
item most likely to change how the owner uses Maude daily.

**E last**, because it is mostly the same code arriving somewhere else, and it
gets cheaper the more of B exists.

## What this phase does NOT do

- **It does not put the agent in the browser.** Declined permanently (DDR-123,
  and A0's rejected-options list) — not deferred, not a smaller version later.
- It does not touch billing, provisioning or the fleet — that is Phase 24.
- It does not move `apps/cloud` to a private repo. Decided against, with the
  carve-out that anti-abuse heuristics, if they are ever written, become a
  private module.
- It does not open the sandbox to anonymous visitors. Membership is the
  precondition for a build to run at all, and that is load-bearing to A0's
  amendment of DDR-206 — not an incidental access-control choice.

## Acceptance

- [x] A member who has never installed anything opens a link, signs in with
  their Maude account, sees the real project, moves something, comments,
  annotates, and downloads the work.
- [x] The same person opens the same project in the desktop app and finds the
  same rights — nothing they could do in the tab is missing, nothing they could
  not do there is suddenly possible.
- [x] A viewer finds editing **absent** on both surfaces, and the cell refuses
  it even when the client is patched, stale, or curl.
- [x] A stranger with a valid account and no membership gets a refusal that does
  not tell them whether the project exists.
- [x] A canvas that imports outside the design root fails to build with a
  legible message, and the failure reaches no secret.
- [x] Corpus-parity CI has been green for a full cycle, and the on-call runbook
  exists with a per-tenant kill switch that has been exercised.
- [x] `view-<project>` and `maude share publish` are gone, along with every
  string that referred to them.
- [x] A self-hoster with no control plane gets the same browser door.
- [x] The owner's own repo receives the current design as a reviewable pull
  request into a folder they chose.

## Decisions to record

- **A0's verdict** — a DDR that AMENDS DDR-206: what changed in its threat model
  (members-only, own-source, own-container — not anonymous signup), which of its
  three criteria are met and which this phase must produce, and that "paying
  tenants asking" is explicitly waived as a product bet.
- **Agent-flow boundary** — why the browser never gets `/design:*` or ACP, on
  licensing grounds as much as security (DDR-123).
- **The DDR-200 reversal** — comments, and why this model changes it.
- **The permission model** — the role matrix as the single authority, enforced at
  the cell, with both surfaces as clients.
- **The sandbox contract** — import allowlist, resource ceilings, secret
  isolation, and what a rejected build looks like to a person.
- **Design-sync's write contract** — branch, path, PR vs. direct push, and what
  happens when the customer has edited the same path.

---

## Status — closed 2026-08-02

Every track landed. What is worth knowing afterwards:

**A1 chose identity over measured-similarity.** The Phase-21 spike measured
esbuild at 0.6% median drift from Bun.build and A2 was scoped to police that.
A1 instead runs the desktop's OWN pipeline under a Bun bundled in the cell
image, so the artifact is the same one — same `Bun.hash`-derived `data-cd-id`s
(which is what lets a comment anchored in the browser resolve in the app), same
bundle. Drift stopped being the risk; the SANDBOX became it, and A2 was
re-pointed at that: the allowlist and the ceilings refusing work that has always
been fine. It caught one on its first run.

**The containment invariant was amended in exactly one place, deliberately.**
The three browser guards (review, image build, boot) are untouched and still the
strongest line. What A0 amended is the studio's own route-level boot-assert,
which forbade serving a canvas shell at all — a proxy for "nothing here renders"
that A0 replaced with the real rule: the cell BUILDS, the viewer's browser
EVALUATES. `scripts/check-containment.sh` grew a fourth section asserting the
sandbox's bounds, so the new surface is guarded the same way the old one is.

**A4 uses a capability, not a cookie.** A segregated origin sends no cookie by
construction, so the canvas origin is authenticated by a short-lived, read-only,
stateless token in the URL. This repo's own `/join` decision says not to put
credentials in URLs; the distinction is that this one grants "read these bytes
for fifteen minutes" and reaches no mutating route at all.

**E1 is targeted, not a redesign.** The console's front door is now the studio
and its primary action opens it; peers/tokens/activity stay exactly as they
were. Calling that "dressed as a product" would be generous — it is the one
change that stops a self-hoster landing in operator vocabulary with no route to
the thing they installed.

**What is still true from A0's honest column:** no paying tenant asked for
this. It is a product bet, recorded as one.

## What production said that the diff did not (2026-08-02)

Three defects surfaced only by curling the live platform after v0.53.0 was
tagged. All three were green in every test, every gate and every review.

**A4's origin was documented and not implemented.** `apps/cells/worker.mjs`
described `canvas.<zone>/<tenant>/…` in its own header comment and routed
nothing. `canvas` is a valid tenant-id shape, so every canvas-origin request
resolved to a cell *named* "canvas" and served the generic landing page — 200,
styled, plausible. A feature that returns a working-looking page at exactly the
right address is invisible to every check that asks "did it respond".

**C5 deleted the gallery's routes, not its address.** `view-alligators.cloud
.maude.sh` was still serving the old share page in production, because a Worker
route and a Worker custom domain are different objects and only one of them is
in this repo. Deleted now — and the code refuses the whole `view-` namespace,
because an unguarded stale hostname is worse than a 404: it starts a NEW empty
cell at an old URL, with autosave ready to commit over it.

**The deploy path had never been run.** The cell image was a laptop, a docker
push and a wrangler command; the first CI run found two things that a manual
step had simply absorbed each time — a shared module the hub image never
staged, and a registry that does not take a docker login.

The pattern in all three: **the repo cannot tell you about an object that is
not in it.** A hostname, a route, a token scope. `cells-deploy.yml` exists so
that at least the deploy is one of the things the repo knows.

---

## Correction (2026-08-03): "closed" was premature

The Status section above says every track landed. That is true of the CODE and
false of the PRODUCT, and the difference cost a customer-facing outage.

**What is genuinely shipped and verified:** the npm package, the desktop app,
the hub image (so self-hosters have all of Track B), the control plane, and the
whole phase's behaviour verified against a locally-run v12 cell holding the
real alligators data — studio redirects a signed-out visitor, the canvas origin
refuses a bad capability token with a 401, the project renders.

**What is NOT verified in production:** the browser door, on the platform. The
fleet was rolled to v12 and `alligators.cloud.maude.sh` has been unreachable
since — container healthy, Durable Object unable to reach it, root cause
unestablished. See `.ai/archive/logs/rca/2026-08-03-alligators-cell-unreachable.md`.

**The acceptance list above must therefore be read as: passing locally against
real data, unproven on the platform.** Five of its production checks did pass
(the control plane, the storage posture, the gallery's address, the canvas
origin's refusal with no project); the ones that need a live cell did not run.

The lesson is the same one this phase kept re-learning and did not apply to
itself: **an object outside the repo — a hostname, a route, a token scope, a
container's port readiness — is outside every gate the repo has.** A phase is
closed when a customer's project answers, not when the tests do.

---

## Closed for real (2026-08-03): the cell dials out

The earlier "Correction" section said the code shipped and the product did not.
That is now resolved, and the resolution changed the architecture.

**The Durable-Object → container port link was the platform's single point of
failure**, and no configuration on our side could reach past it: a 15-line
Worker with a stock `Container` class and a stock `nginx:alpine` failed
identically. It broke account-wide while every container it had started kept
running, indexing, mirroring and checkpointing.

**So the cell stopped waiting to be reached and started dialling out.**
`cloudflared` runs inside the cell image (gated on `MAUDE_TUNNEL_TOKEN`, so a
self-hosted hub never starts it), the Worker proxies to the tunnel hostname,
and the Durable Object keeps the job it is good at — waking the cell on demand,
idling it after `sleepAfter` — while leaving the user-facing request path
entirely. Everything stays on Cloudflare; Tunnel is free; the idle economics
are unchanged.

**Verified live on alligators, 9/9** (`scripts/verify-cloud-production.sh`):
control plane, cell, per-tenant R2 credentials, the gallery's address gone, the
canvas origin refusing both an absent project and a bad capability token, and a
signed-out visitor landing on the Maude sign-in at the customer's own hostname.
Cold start through the tunnel: 2.4 s, then 0.5 s warm.

**Three defects that only traffic could find**, all now fixed:

1. The cell advertised its PROXY host in the sign-in return URL. Behind a
   tunnel that is an internal name, so a member signing in was sent to an
   address that is not their project. It reads `HUB_PUBLIC_URL` now; the Host
   header is a fallback for a hub that has none.
2. The browser lane redirected signed-out members to `/auth/login` — the form's
   POST target, which 404s on GET. **The browser door dead-ended at its last
   step, and the test pinning that path passed the whole time.** Corrected, with
   the reason written into the assertion.
3. A woken cell needs seconds for cloudflared to re-register; proxying inside
   that window returns Cloudflare's own 530, which reads to a customer exactly
   like the outage this seam exists to escape. The readiness wait moved onto the
   path that works: poll `/health` over the tunnel, then forward.

**The lesson this phase kept writing about itself, now paid in full:** an object
outside the repo — a hostname, a tag's CONTENTS, a container's readiness — is
outside every gate the repo has. The night's worst detour came from trusting a
"rollback" to a tag whose contents had been overwritten, and the last one from a
monitor that reported "up on v18" having checked only that something answered
200. Verify the thing, not that something replied.

---

## Honest close (2026-08-03): what landed, what was wrong, what Phase 26 takes over

The phase is closed as **partially superseded**. Marking it simply "done" would
repeat the mistake it ended on.

### Landed and verified in production (9/9, `scripts/verify-cloud-production.sh`)

| | |
| --- | --- |
| A-1 | per-tenant temporary R2 credentials — `/health` reports `per-tenant` |
| A1 · A1b · A2 | the build sandbox, its content-hash cache, corpus-parity CI |
| A3 | the on-call runbook + a per-tenant kill switch, exercised |
| A4 | the segregated canvas origin — refuses an absent project and a bad token |
| B1 · B2 | auth at the cell; a stranger and a ghost refused identically |
| C4 | one role matrix, both surfaces held to it |
| C5 | the read-only gallery deleted — routes, worker modules, CLI verb, **and its address** |
| D1–D3 | mirror design-sync as a pull request, with each mode stating its consequence |
| E1–E4 | the self-hosted console; the hub image ships the full door for self-hosters |
| — | **outbound tunnel ingress** — the cell dials out; the broken DO→port link is off the request path |

### SUPERSEDED by Phase 27 — the browser door's UI layer

**B3 · B4 · B5 · B6 · B7 and the client half of C3 shipped a hand-written
469-line studio instead of hosting the real one** (`apps/studio`, 15,073-line
client). The result was a different, poorer application — no Files/Layers/
Inspector, no menu bar, no search, no branch/LIVE status — and no project assets
at all, so every photograph rendered as a grey box.

These items are **not "done"**. They are replaced wholesale by
[Phase 27](./cloud-phase-27-one-studio-three-shells.md), which deletes
`apps/hub/src/canvas/studio-page.mjs` and runs the real studio server in the
cell behind an authenticating proxy.

**Why it happened, recorded so the shape is recognisable next time:** the plan
said "Maude Studio in the browser" and it was read as *build a browser studio*
rather than *host the studio in a browser* — even though `workspace-mode.ts`
already existed to make a cell run the studio's own code path precisely because
"a second implementation would drift", and this phase's own C2 had already built
the role-vouching contract the reimplementation walked past. **Two prior
decisions pointed at the right answer and neither was consulted before
building.**

### The release notes over-promised

`whats-new.json`'s "Open your project in a browser — nothing to install" shipped
in v0.53.0 describing a door that does not yet show the product it claims. The
entry is corrected in the same change as this close; the honest version says
what actually works today.
