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

- [ ] **A-1 — per-tenant R2 credentials. PREREQUISITE, not a task in this
  track.** Every cell holds a shared bucket-wide R2 key; isolation is app code
  only. That is already a blocker for a second paying customer; in a cell that
  builds untrusted source it is the first thing a build-time file read reaches.
  Either per-tenant credentials or presigned URLs minted by the control plane.
  **Nothing in Track A or B ships before this does.**
- [ ] **A1 — the build sandbox.** Bun.build runs against customer TSX with:
  an **import allowlist** (the runtime packages, `@maude/canvas-lib`, and
  relative paths that resolve *inside* the design root — nothing else), no
  access to cell secrets or env, a wall-clock and memory ceiling, and no
  network. A rejected import is a legible error in the UI, not a 500.
- [ ] **A2 — corpus-parity CI.** DDR-206's third criterion, made real: build the
  full canvas corpus (alligators + maude, 142 canvases) in the sandbox on every
  change to the pipeline, and fail on a one-sided failure or drift beyond the
  spike's measured envelope. Green for a full cycle before B ships.
- [ ] **A3 — the on-call story.** DDR-206's second criterion, and the one the
  amendment does not dissolve. What is monitored, what pages a human, what the
  kill switch is (per-tenant render disable, not fleet-wide), and what the
  incident runbook says. Write it before the origin exists, not after.
- [ ] **A4 — the execution origin.** The rendered canvas runs in a segregated
  origin per DDR-054, exactly as the desktop already does — the editing shell
  and the customer's code never share an origin, in the browser either.

## Track B — the browser door (gated on Track A)

- [ ] **B1 — auth at the cell.** `<project>.cloud.maude.sh` authenticates against
  the Maude account, not a workspace password. The chain already exists for the
  desktop (personal token → `POST /projects/open` → project token → cell
  `POST /auth/login {token}` → hub user token); this is the browser-session
  equivalent. Canvas board **C4**, left pane.
- [ ] **B2 — the refusal.** Signed in, not a member ⇒ a page that says so and
  names who to ask. Never a 404 and never a redirect that leaks membership.
- [ ] **B3 — render the project.** Per Track A. Canvas navigation, real
  canvases, the real design system.
- [ ] **B4 — edit by direct manipulation.** Move, resize, reorder, edit text,
  change tokens — the operations the studio already exposes without an agent.
  Every edit is a **shape-checked structured mutation** applied server-side, not
  a client-supplied TSX blob: the source of truth is `.tsx`, so a UI edit is a
  source transformation (`canvas-edit`), and that AST path has produced a real
  bug class before (the inline-edit DOM-leaf-text vs AST-mixed-source mismatch).
- [ ] **B5 — comments and annotations.** Both surfaces, one store. Supersedes
  the old C3.
- [ ] **B6 — what the browser cannot do, it says so.** No ACP panel, no
  `/design:*`, no agent. Where an agent-only capability would sit, the browser
  names the desktop rather than hiding the feature — a person must be able to
  learn why, not just find it missing.
- [ ] **B7 — export from the browser.** Same bundle the dashboard produces; a
  member must be able to leave with the work without installing anything.
- [ ] **B8 — the cell landing stops being a splash.** `renderLanding()` in
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
- [ ] **C2 — the desktop honours the model in its UI.** Server-side refusal
  landed with C1 and the client learns its role at boot, but a viewer still sees
  editing affordances the server will reject. Editing must be **absent, not
  hidden**, across the write surface (~42 endpoints). No A0 dependency — can
  start immediately.
- [ ] **C3 — the browser honours the same model.** Same role, same absences,
  same server refusals. Written once against the cell's answer, not twice
  against two clients' guesses.
- [ ] **C4 — the role matrix is stated and tested.** owner / member / viewer ×
  (read · edit · comment · annotate · export · invite · delete · mirror), as one
  table with one test suite that both surfaces run against. Comments are the one
  write a viewer holds, which is exactly where a scope bug undoes the model.
- [ ] **C5 — delete the gallery.** `view-<project>` routes, `apps/cells/share*`,
  the `maude share publish` verb, and every string that promises a gallery. A
  surface that stays half-alive is worse than one that never shipped.

## Track D — mirror gets the mode people expected

Today: `git push mirror HEAD:refs/heads/<branch>` from the cell's own repo — the
whole repository, full history, onto a disjoint branch. That is a **backup**, it
works, and it stays: it is what makes "you can leave" true.

- [ ] **D1 — design-sync.** Commit the `.design` tree into a folder of the
  customer's **own working repo**, on top of **their** history, as a pull
  request. Not a branch push — a normal diff a developer reviews. Canvas board
  **D3**.
- [ ] **D2 — the mode is a visible choice**, with each mode's consequence stated
  before Save. A customer pointing this at the repo their website lives in must
  know what lands next to it.
- [ ] **D3 — say what the backup contains.** It carries whatever the cell's repo
  holds, which depends on how the project started: seeded from an existing repo
  ⇒ everything; created by the wizard ⇒ only the design workspace.

## Track E — the self-hosted product

The hub already has accounts, invites with roles, tokens, export, backup, mirror
and an invite UI. `apps/hub/src/auth-routes.mjs:442` is the proof this was always
the intent: `POST /invites` returns 409 under `cloudIdentityStrict()` because
"the dashboard's People page is the one place members are added" — the hub owns
invites and *defers* in cloud mode.

- [ ] **E1 — the console is dressed as a product, not infra.** Peers, tokens,
  canvases, activity and settings are operator vocabulary. A self-hoster is also
  a *user*.
- [ ] **E2 — Track B lands for the self-hosted hub too.** Same code path, no
  control plane required. This is the whole reason B is worth building twice
  over. Note the sandbox is worth *more* here, not less: a self-hoster's cell
  runs on their own hardware, and A1's ceilings are what stop a runaway canvas
  taking their machine with it.
- [ ] **E3 — in platform mode the console hides what the dashboard owns.**
  Invites and users already 409 under strict identity; the UI should match rather
  than offer a button that fails.
- [ ] **E4 — do NOT port `apps/cloud`.** It is multi-tenant provisioning (D1, R2,
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

- [ ] A member who has never installed anything opens a link, signs in with
  their Maude account, sees the real project, moves something, comments,
  annotates, and downloads the work.
- [ ] The same person opens the same project in the desktop app and finds the
  same rights — nothing they could do in the tab is missing, nothing they could
  not do there is suddenly possible.
- [ ] A viewer finds editing **absent** on both surfaces, and the cell refuses
  it even when the client is patched, stale, or curl.
- [ ] A stranger with a valid account and no membership gets a refusal that does
  not tell them whether the project exists.
- [ ] A canvas that imports outside the design root fails to build with a
  legible message, and the failure reaches no secret.
- [ ] Corpus-parity CI has been green for a full cycle, and the on-call runbook
  exists with a per-tenant kill switch that has been exercised.
- [ ] `view-<project>` and `maude share publish` are gone, along with every
  string that referred to them.
- [ ] A self-hoster with no control plane gets the same browser door.
- [ ] The owner's own repo receives the current design as a reviewable pull
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
