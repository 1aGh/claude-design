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

## What was decided

1. **The read-only gallery is dropped.** `view-<project>.cloud.maude.sh`, the
   published-snapshot surface, and the `maude share publish` CLI verb all go.
2. **Read-only becomes a permission on the real project.** A viewer opens the
   actual project — in the app or in a browser — and can **look, comment,
   export**, nothing else.
3. **`<project>.cloud.maude.sh` becomes Maude Studio in the browser**, behind the
   same Maude account as the dashboard. Signed out ⇒ auth screen. Signed in
   without membership ⇒ a refusal, not a 404 that leaks whether the project
   exists.
4. **The operator console stays, as infra only.** In platform mode it is not a
   second self-service surface and a customer never needs it.
5. **The self-hosted product is the hub**, which already carries accounts,
   invites, roles, export, backup and mirror. It is not a portable copy of the
   control plane. What it lacks is exactly item 3.
6. **Mirror grows a second mode**: design-sync into the customer's own repo,
   alongside today's whole-repo backup.

## A0 — the fork that decides this phase's cost

**Rendering a canvas means building and executing the customer's TSX.**
Read-only does not remove that; it only removes writes. So "Studio in the
browser" needs a code-execution origin somewhere, which is precisely what
[DDR-206](../archive/decisions/DDR-206-browser-editing-declined.md) declined on
2026-07-30.

Two facts change the arithmetic since that DDR:

- **The cell has no build pipeline today.** `apps/hub/Dockerfile` borrows exactly
  one file from the studio — `apps/studio/sync/autocommit.ts`, the commit engine.
  The cell holds files, syncs Yjs, serves assets and lists canvases; it has never
  rendered one. So this is net-new infrastructure either way, not a flag.
- **Per-tenant isolation already exists.** One container per project. A tenant's
  code executing inside that tenant's own cell is a materially different risk
  from a shared eval origin, and
  [DDR-054](../archive/decisions/DDR-054-canvas-origin-segregation.md) already
  defines the untrusted-canvas-origin model the desktop uses.

- [ ] **A0 — pick the render path. Blocks tracks B and C; nothing else.**

  **(a) Ship the studio canvas pipeline into the cell.** *Recommended.* The cell
  gains Bun.build + the canvas runtime and serves the real project into a
  segregated origin, exactly as the desktop already does. Only option where "the
  browser shows the real project" is literally true. Cost: the cell image grows
  by the studio runtime; a code-execution origin per tenant; the on-call story
  DDR-206 named — but scoped to one tenant's own code in one tenant's own
  container.

  **(b) Render on the desktop, publish the output.** The app already builds
  canvases and could push rendered output for the browser to serve statically.
  No code execution in the cell. Cost: this is the gallery we just deleted
  wearing a better UX — it is stale whenever nobody has the app open, and a
  project whose owner is on holiday shows nothing.

  **(c) Build in the viewer's browser.** The customer's code executes in the
  viewer's tab, not our server. Cost: heaviest client, and it moves the risk
  rather than removing it.

  Re-read DDR-206's own reopen criteria before answering — it named three, and
  "paying tenants asking" is still not met.

---

## Track B — the browser door (gated on A0)

- [ ] **B1 — auth at the cell.** `<project>.cloud.maude.sh` authenticates against
  the Maude account, not a workspace password. The chain already exists for the
  desktop (personal token → `POST /projects/open` → project token → cell
  `POST /auth/login {token}` → hub user token); this is the browser-session
  equivalent. Canvas board **C4**, left pane.
- [ ] **B2 — the refusal.** Signed in, not a member ⇒ a page that says so and
  names who to ask. Never a 404 and never a redirect that leaks membership.
- [ ] **B3 — render the project read-only.** Per A0. Canvas navigation, real
  canvases, no write surface reachable — not hidden, *absent*.
- [ ] **B4 — export from the browser.** Same bundle the dashboard produces; a
  viewer must be able to leave with the work without installing anything.
- [ ] **B5 — the cell landing stops being a splash.** `renderLanding()` in
  `apps/hub/src/server.mjs` currently sends the customer *back* to the dashboard
  in platform mode. It becomes the project.

## Track C — read-only as a permission (gated on A0 only for the browser half)

- [ ] **C1 — the `viewer` role does something.** Today the role exists in invites
  and membership and nothing enforces it at the workspace. Enforce at the cell:
  a viewer's session cannot write files, cannot commit, cannot mutate Yjs.
- [ ] **C2 — read-only in the desktop app.** A viewer who attaches gets the
  project with editing absent. This is the half that does **not** depend on A0
  and can start immediately.
- [ ] **C3 — comments, for real.** The invite email has promised comments since
  Phase 20; [DDR-200](../archive/decisions/DDR-200-comments-declined.md) declined
  them. That decision is now reversed by the read-only model — a viewer who
  cannot edit and cannot comment cannot participate at all. Record the reversal
  as a DDR before building.
- [ ] **C4 — delete the gallery.** `view-<project>` routes, `apps/cells/share*`,
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
  over.
- [ ] **E3 — in platform mode the console hides what the dashboard owns.**
  Invites and users already 409 under strict identity; the UI should match rather
  than offer a button that fails.
- [ ] **E4 — do NOT port `apps/cloud`.** It is multi-tenant provisioning (D1, R2,
  Cloudflare DNS + container API, the reconcile cron) and Stripe. A self-hoster is
  their own single tenant and needs none of it. Recorded as
  `self-hosted-is-the-hub-and-cloud-stays-open`.

---

## Order, and why

**C2 first** — read-only in the desktop app is the only track with no gate, it is
half of what "viewer" means, and it makes the invite email honest sooner.

**A0 next**, because B and C3 both wait on it and it is the one decision an agent
cannot make.

**D independently** — design-sync touches nothing B or C touch, and it is the
item most likely to change how the owner uses Maude daily.

**E last**, because it is mostly the same code arriving somewhere else, and it
gets cheaper the more of B exists.

## What this phase does NOT do

- It does not make editing in the browser work. Read-only only.
- It does not touch billing, provisioning or the fleet — that is Phase 24.
- It does not move `apps/cloud` to a private repo. Decided against, with the
  carve-out that anti-abuse heuristics, if they are ever written, become a
  private module.

## Acceptance

- [ ] A viewer who has never installed anything opens a link, signs in with their
  Maude account, sees the real project, leaves a comment, downloads the work.
- [ ] A stranger with a valid account and no membership gets a refusal that does
  not tell them whether the project exists.
- [ ] `view-<project>` and `maude share publish` are gone, along with every
  string that referred to them.
- [ ] A self-hoster with no control plane gets the same browser door.
- [ ] The owner's own repo receives the current design as a reviewable pull
  request into a folder they chose.

## Decisions to record

- **A0's verdict** — as a DDR either way; it supersedes or amends DDR-206.
- **The DDR-200 reversal** — comments, and why the read-only model changes it.
- **The viewer permission boundary** — what "cannot edit" means at the cell, not
  in the UI.
- **Design-sync's write contract** — branch, path, PR vs. direct push, and what
  happens when the customer has edited the same path.
