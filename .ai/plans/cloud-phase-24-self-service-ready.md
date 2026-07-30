# Cloud Phase 24 — Self-service ready: close the gap the audit measured

> Written from the **2026-07-31 production-readiness audit**
> (`.ai/logs/system-reviews/maude-cloud-production-readiness-2026-07-31.md`,
> kgai `maude-cloud-production-readiness-audit-2026-07-31`). Two independent
> reviewers — a plan-vs-code auditor over all 25 archived cloud phases, and a
> `flow:user-advocate` seat walking the surfaces as a non-technical club
> volunteer — plus live checks against production.
>
> **Verdict this phase exists to move:** the alligators pilot works with high
> confidence; a self-service SaaS a stranger can buy is **~25%**. The gap is
> not code quality. It is *paths nobody has walked*, *money that cannot be
> taken*, and *capacity for exactly one customer*.
>
> **No divergent debate was convened.** The divergence already happened today:
> two adversarial reviewers, and DDR-206 priced the one genuine fork
> (browser editing) less than 24 h ago. Re-running seats over the same
> question is theater — the stakes-gate says so.

## The fork this plan does NOT decide (A0)

The owner's stated target includes *"an online Maude Studio anyone with access
can connect to in the browser."* **DDR-206 declined that on 2026-07-30**, with
the path priced: build parity is solved (136/136 canvases, 0.6% median drift),
the binding constraint is on-call for a code-execution origin at two-person
headcount.

Everything below is planned against the **decided** state — desktop-only
editing, browser = read-only gallery. If the owner reverses DDR-206, Phase E
changes shape and the funnel copy in Phase A changes with it, so:

- [ ] **A0 — the owner says yes or no to reopening DDR-206, in writing.**
  Not a task an agent can do. Blocks nothing below; changes Phase E and
  ~6 strings in Phase A. Re-open criteria are in DDR-206 (all three, not any
  one): paying tenants asking, an on-call story for a code-exec origin, and
  corpus-parity CI green for a full cycle.

---

## A — Truth in the funnel (no infrastructure, highest UX return)

> The audit's sharpest finding: **every page is honest and the journey lies.**
> A customer authorizes payment for "a home for your design projects" and then
> discovers, one door at a time, that they need a desktop computer, two
> installs and a **second paid subscription with Anthropic**. The string
> "Claude" appears in **zero** customer-facing cloud pages.

- [ ] **A1 — state the bill of materials BEFORE the card.** The wizard
  (`apps/cloud/checkout-pages.mjs` `newProjectPage`) and the landing
  (`pages.mjs` `homePage`) must say, in the customer's words: this is made on
  a **computer** (not a phone or tablet), with the **free Maude app**, and the
  AI that makes designs runs on **your own Claude subscription (~$20/mo, paid
  to Anthropic, not to us)**. Frame it as the honest reason it stays private —
  which is already the disclosure's argument — not as a footnote.
  **Gotcha:** the vocabulary lint (`allCustomerFacingHtml`) forbids
  infrastructure words; "subscription" and "Claude" are product words and are
  fine. Add the new strings to the lint fixture.

- [ ] **A2 — the connect page must stop instructing an impossible action.**
  `project-admin.mjs` `connectPage` tells the customer to sign in at their
  project's address with a "workspace email and password" **no customer is
  ever issued** — only a derived `PILOT_ADMIN_EMAIL` credential exists
  (`apps/cells/cell-do.mjs`). Either delete the browser card, or replace it
  with what is true: the browser shows the shared gallery; the app edits.

- [ ] **A3 — a viewer must never meet raw JSON.** `handoff.mjs` returns
  `json()` for the viewer refusal even when the caller is a browser form POST
  (regression introduced 2026-07-30 in this very lane). Content-negotiate like
  the mint path already does, and make the page *link the gallery it names*.

- [ ] **A4 — surface the share gallery where a viewer can find it.** The
  invite email promises a viewer they can "look at the work"; the gallery
  (`view-<project>.cloud.maude.sh`) is linked from **nowhere** — not the
  dashboard card, not the ⋯ menu, not the project page. Add it, and show
  whether sharing is currently on or off.

- [ ] **A5 — publishing to the gallery must not require a terminal.** Today
  the only way to populate it is the `maude share publish` CLI verb. For the
  persona this arc is staked on, that is the same as "impossible". Add a
  publish action to the desktop app (the studio already knows the canvases and
  holds the credential). Until it exists, A4's copy must say who can publish
  and how, rather than implying the viewer can.

- [ ] **A6 — the export page's promise must be true for a non-technical
  leaver.** "It opens without Maude" describes a **git bundle**
  (`project-admin.mjs`). Either ship the assets in a form that opens by
  double-clicking, or change the sentence to say what it is and who can open
  it. The git-vocabulary exemption is defensible on the opt-in mirror page; it
  is not defensible on the one page a *leaving* customer must use.

- [ ] **A7 — Windows is unsigned.** The OS tells a volunteer that the club's
  new design tool is dangerous at the exact moment she is following our
  instructions. Either buy the code-signing certificate or say plainly, on the
  download surface, what she will see and that it is expected. (Cost decision,
  not an agent task — but the copy fallback is.)

---

## B — The fleet can hold more than one customer

> Three of these are latent **production-data** risks, not scaling niceties.

- [ ] **B1 — per-tenant config is Worker-GLOBAL.** `cellEnv()`
  (`apps/cells/cell-do.mjs`) reads `MAUDE_SEED_REPO`, `PROJECT_NAME` and
  `PILOT_ADMIN_EMAIL` from the shared cells-Worker environment. **A new
  tenant's first boot could clone the pilot's repository.** This is the single
  most dangerous finding in the audit and it blocks customer number two
  absolutely. The DO knows its `tenantId`; per-tenant values must come from
  the control plane (or DO storage seeded at provision), never from a global.

- [ ] **B2 — raise the instance ceiling.** `apps/cells/wrangler.toml`
  `max_instances = 1`, annotated "the tenant-of-one pilot". A second
  concurrent tenant cannot get a container; their waiting room times out and
  **voids the sale**. Raise deliberately, with the cost per instance written
  down next to the number (Phase 0 §2 economics were never measured — measure
  now or state the guess).

- [ ] **B3 — wire the reconciler's actions.** `runOne()` computes
  `suspend-cell` / `resume-cell` / `send-export` and lands them in job detail
  and the audit log only — the comment says "become real in Phase 15", and
  phase 15 T4 is still unchecked. **A tenant who stops paying keeps a serving
  cell**, and the export-before-purge email never sends itself.

- [ ] **B4 — delete must purge the bytes.** `project-admin.mjs` stops billing,
  sets `state='purged'` and detaches the domain, but `tenants/<id>/` stays in
  R2 forever. For a product whose whole pitch is "you can leave", keeping the
  data after a delete is the one thing that must not be true. Purge job +
  audit entry + a test.

- [ ] **B5 — the identity mode is still hybrid everywhere.** `/health` now
  reports the truth (`identity.mode/localDoor/seeded`, DDR-207) and the truth
  is: nobody is in `strict`, so B6's retirements are correct code with no live
  effect. Flipping needs the browser handoff (B3 of phase 23 covered the app
  lane only) — which A2 may make moot by deleting the browser lane entirely.
  Decide with A2, not separately.

---

## C — Somebody actually walks the path

> The production `audit_log` contains **no project-creation event**. Alligators
> was provisioned by hand. The self-service wizard has never run end to end.

- [ ] **C1 — provision a second project through the wizard, as a stranger.**
  Fresh account, Stripe test card, no manual steps, no operator intervention.
  This is the first real exercise of checkout → provision → waiting room →
  first open. Expect it to fail; that is the point. Blocked by B1 + B2.

- [ ] **C2 — Google sign-in for people who are not us.** The consent screen is
  still in **Testing** mode (phase 11 step 4), so only allow-listed accounts
  can use the button we just made a first-class front door. Publish it, or
  hide the button until it is published.

- [ ] **C3 — the timed non-technical cold start.** One club member, phone plus
  laptop, no help, no terminal, stopwatch running. Named as make-or-break by
  phase 6 *and* phase 17 *and* phase 10, and never run. **Owner gate — an
  agent cannot do this one.** Run it AFTER Phase A, or it only measures
  problems we already know about.

- [ ] **C4 — the stranger test.** Phase 10's own unchecked gate: somebody with
  no relationship to the project completes signup → pay → create, unaided.

---

## D — Live money (last, deliberately)

> Everything above is worthless if the funnel takes real money before it
> works, and harmless if it does not.

- [ ] **D1 — live Stripe entity + prices.** `pricing.json` live ids are all
  `null`; `pricing-core.mjs` throws in live mode by design. The key in use is
  `rk_test_` and the prices report `livemode: false`.
- [ ] **D2 — Stripe Tax.** An EU VAT product with no `automatic_tax` anywhere
  in `checkout.mjs`. Not optional; it is a legal obligation, not a feature.
- [ ] **D3 — dunning proven with test clocks** — the past-due → suspend →
  export → purge ladder, which B3 makes real for the first time.
- [ ] **D4 — legal pack**: ToS, DPA, privacy, and the trust page's claims
  re-checked against what the code now does (`trust-claims.test.mjs` exists —
  extend it).
- [ ] **D5 — a public pricing page.** `site/content/docs/cloud/` contains only
  `trust.mdx`. Nobody can find out what it costs without starting a checkout.

---

## E — Gated on A0

- [ ] **E1 — if DDR-206 is reopened**: the spike's measured path becomes a
  build (separate registered domain, per-project origins, credential-free eval
  origin, and the on-call story that is the actual blocker). Re-plan then; do
  not pre-build.
- [ ] **E2 — if DDR-206 stands**: make the desktop requirement a *feature* of
  the funnel rather than a surprise — A1 already does the honest half; the
  aspirational half is a landing page that sells "your designs never leave
  your computer" instead of apologising for it.

---

## Order, and why

`A` first: it is pure copy and small handlers, needs no infrastructure, and
fixes the finding most likely to produce a refund request. `B` next because
B1 is a data-integrity risk that makes customer #2 unsafe, not merely
impossible. `C` only after A+B, or the human test measures problems we already
know how to fix. `D` last, because taking real money before C passes is the
one irreversible step in this plan.

## Acceptance

- [ ] A stranger completes signup → pay → project → first design **unaided**,
  and the funnel told them the full cost before the card.
- [ ] Two projects run concurrently, provisioned by the wizard, with no shared
  seed and no manual step.
- [ ] A non-payer's cell actually suspends; a deleted project's bytes are
  actually gone.
- [ ] The timed club-member cold start is RUN and its time recorded.
- [ ] No customer-facing page instructs an action the customer cannot perform.

## Decisions to record

- The A0 verdict (reopen DDR-206 or affirm it) — as a DDR either way.
- B1's per-tenant config channel — it changes the provisioning contract.
- B2's instance ceiling + the cost-per-instance number behind it.
- B4's purge semantics (what "deleted" means, and after how long).
