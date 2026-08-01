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

## A0 — RESOLVED 2026-07-31

The fork this plan opened — *"is there an online Maude Studio in the browser?"* —
was answered in the owner review of `.design/ui/Cloud Self Service.tsx`: **yes,
read-only**, and the gallery is dropped entirely.

That work is **[Phase 25 — One project, two doors](./cloud-phase-25-one-project-two-doors.md)**,
deliberately a separate plan so this one stays finishable while that one is still
an argument. The narrower technical fork it inherits (where the customer's TSX is
built and executed) is Phase 25's own A0.

**Consequences for the items below**, applied in place: A2 loses its second half,
A4 and A5 are **deleted** (they existed to prop up a gallery that is going away),
and A1's copy now has a drawn version on canvas board **A1**.

Everything else in this plan is unaffected. Phase 24 is still *"the funnel is
honest and the fleet holds more than one customer"*.

---

## A — Truth in the funnel (no infrastructure, highest UX return)

> The audit's sharpest finding: **every page is honest and the journey lies.**
> A customer authorizes payment for "a home for your design projects" and then
> discovers, one door at a time, that they need a desktop computer, two
> installs and a **second paid subscription with Anthropic**. The string
> "Claude" appears in **zero** customer-facing cloud pages.

- [x] **A1 — state the bill of materials BEFORE the card.** The wizard
  (`apps/cloud/checkout-pages.mjs` `newProjectPage`) and the landing
  (`pages.mjs` `homePage`) must say, in the customer's words: this is made on
  a **computer** (not a phone or tablet), with the **free Maude app**, and the
  AI that makes designs runs on **your own Claude subscription (~$20/mo, paid
  to Anthropic, not to us)**. Frame it as the honest reason it stays private —
  which is already the disclosure's argument — not as a footnote.
  **Gotcha:** the vocabulary lint (`allCustomerFacingHtml`) forbids
  infrastructure words; "subscription" and "Claude" are product words and are
  fine. Add the new strings to the lint fixture.

- [x] **A2 — the connect page must stop instructing an impossible action.**
  `project-admin.mjs` `connectPage` tells the customer to sign in at their
  project's address with a "workspace email and password" **no customer is
  ever issued** — only a derived `PILOT_ADMIN_EMAIL` credential exists
  (`apps/cells/cell-do.mjs`). **Delete that card now**, without waiting for
  Phase 25: a page that instructs an impossible action is worse than a page with
  one door. The second door arrives with Phase 25 B5; canvas board **C2** draws
  the finished state.

- [x] **A3 — a viewer must never meet raw JSON.** `handoff.mjs` returns
  `json()` for the viewer refusal even when the caller is a browser form POST
  (regression introduced 2026-07-30 in this very lane). Content-negotiate like
  the mint path already does. (It no longer needs to link a gallery — there
  isn't one.)

- [ ] ~~**A4 — surface the share gallery**~~ — **deleted.** The gallery is being
  removed (Phase 25 C4). Linking it better would have been work spent on a
  surface that is going away.

- [ ] ~~**A5 — publishing without a terminal**~~ — **deleted.** Same reason.
  Replaced by read-only on the real project (Phase 25 C1–C2), which needs no
  publish step at all.

- [x] **A6 — the export page's promise must be true for a non-technical
  leaver.** "It opens without Maude" describes a **git bundle**
  (`project-admin.mjs`). Either ship the assets in a form that opens by
  double-clicking, or change the sentence to say what it is and who can open
  it. The git-vocabulary exemption is defensible on the opt-in mirror page; it
  is not defensible on the one page a *leaving* customer must use.
  **Also:** the delete page's "download your copy first" gate currently *tells*
  the customer to go and find the download page. Give it the button
  (canvas board **E1**) — a gate that sends somebody hunting for the thing it
  just demanded is a gate that gets abandoned.

- [x] **A7 — Windows is unsigned.** The OS tells a volunteer that the club's
  new design tool is dangerous at the exact moment she is following our
  instructions. Either buy the code-signing certificate or say plainly, on the
  download surface, what she will see and that it is expected. (Cost decision,
  not an agent task — but the copy fallback is.) Every "download" link in the
  product points at **one address**, `maude.sh/desktop` — not a release list,
  not a GitHub page.

> Added by the 2026-07-31 canvas review. A8–A11 are the same kind of work as
> A1–A7 — the funnel telling the truth — so they live here rather than in
> Phase 25.

- [x] **A8 — the legal pack exists and is linked before the card.** There is no
  Terms page, no privacy notice and no DPA anywhere: not on maude.sh, not in the
  product. They go on maude.sh and get linked from the wizard, directly above the
  button that takes payment details. Canvas board **B2**. Blocks A9 and D4.

- [ ] **A9 — publish the Google consent screen.** Self-serve: Cloud console →
  APIs & Services → OAuth consent screen → *Publish app*. Because the app asks
  only for `email` and `profile` — non-sensitive scopes — it goes live with **no
  verification review**. What it needs first is a privacy-policy URL and a terms
  URL on a domain we own, i.e. **A8**. Until then, the Google button we just made
  the front door works only for allow-listed accounts.

- [x] **A10 — billing answers billing questions on the billing page.** Today it
  is a state card and a door to Stripe's portal. Add, per canvas board **D2**:
  the **invoice list** with a PDF per row (Stripe stays the source and still owns
  everything that *changes*); **billing details** — company, address, VAT id — as
  its own section, which is also what Stripe Tax needs (D2 below); and **Cancel
  subscription** as a first-class action here rather than a thing found inside
  somebody else's product.

- [x] **A12 — the two people-page defects the canvas review caught.**
  (a) **Role is a free-text-looking field.** `people-page.mjs` `roleSelect()`
  renders a bare select whose options are single words. Make it a dropdown that
  shows *what each role means at the moment of choosing* — "Owner: everything,
  including billing" / "Member: can change the designs" / "Viewer: can look,
  comment and download, cannot change anything". The inviter should not have to
  already know the vocabulary. Canvas board **D1**.
  (b) **The join page offers only a password.** `invites.mjs` `invitePage()` in
  `create` mode asks a first-time visitor to invent 12 characters, while the
  dashboard's own front door offers one click. Put **Continue with Google**
  above the password field — this is the single worst place in the funnel to
  drop the easy option, because it is the invitee's first contact with Maude.
  Depends on **A9** (the consent screen must be published for it to work for
  anyone outside the allow-list).

- [x] **A11 — the cancel ladder, with every date on screen before the click.**
  Canvas board **E0** draws all four screens: confirm (works until *X*, pauses
  then, deleted *X+7*, download offered on the same screen) · cancelled-but-still-
  running with a one-button restart · paused with the countdown · the two emails
  (paused / two days left). **The retention number is not decided** — 7 days is a
  proposal. It needs its own DDR, because once published, shortening it is a
  breach of a promise the trust page rests on. Depends on **B4** — the ladder is
  worthless until deletion actually deletes.

---

## B — The fleet can hold more than one customer

> Three of these are latent **production-data** risks, not scaling niceties.

- [x] **B1 — per-tenant config is Worker-GLOBAL.** `cellEnv()`
  (`apps/cells/cell-do.mjs`) reads `MAUDE_SEED_REPO`, `PROJECT_NAME` and
  `PILOT_ADMIN_EMAIL` from the shared cells-Worker environment. **A new
  tenant's first boot could clone the pilot's repository.** This is the single
  most dangerous finding in the audit and it blocks customer number two
  absolutely. The DO knows its `tenantId`; per-tenant values must come from
  the control plane (or DO storage seeded at provision), never from a global.

- [x] **B2 — raise the instance ceiling.** `apps/cells/wrangler.toml`
  `max_instances = 1`, annotated "the tenant-of-one pilot". A second
  concurrent tenant cannot get a container; their waiting room times out and
  **voids the sale**. Raise deliberately, with the cost per instance written
  down next to the number (Phase 0 §2 economics were never measured — measure
  now or state the guess).

- [x] **B3 — wire the reconciler's actions.** `runOne()` computes
  `suspend-cell` / `resume-cell` / `send-export` and lands them in job detail
  and the audit log only — the comment says "become real in Phase 15", and
  phase 15 T4 is still unchecked. **A tenant who stops paying keeps a serving
  cell**, and the export-before-purge email never sends itself.

- [x] **B4 — delete must purge the bytes.** `project-admin.mjs` stops billing,
  sets `state='purged'` and detaches the domain, but `tenants/<id>/` stays in
  R2 forever. For a product whose whole pitch is "you can leave", keeping the
  data after a delete is the one thing that must not be true. Purge job +
  audit entry + a test. **A11's cancel ladder depends on this** — a countdown to
  a deletion that never happens is a lie with a timestamp on it.

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
- [x] **D2 — Stripe Tax.** An EU VAT product with no `automatic_tax` anywhere
  in `checkout.mjs`. Not optional; it is a legal obligation, not a feature.
- [ ] **D3 — dunning proven with test clocks** — the past-due → suspend →
  export → purge ladder, which B3 makes real for the first time.
- [ ] **D4 — legal pack**: ToS, DPA, privacy, and the trust page's claims
  re-checked against what the code now does (`trust-claims.test.mjs` exists —
  extend it).
- [x] **D5 — a public pricing page.** `site/content/docs/cloud/` contains only
  `trust.mdx`. Nobody can find out what it costs without starting a checkout.

---

## E — Moved

The old E existed to hold whichever way A0 fell. A0 fell, so E is now its own
plan: **[Phase 25 — One project, two doors](./cloud-phase-25-one-project-two-doors.md)**.

One thing from it stays here, because it is funnel copy and not a build:

- [ ] **E1 — sell the desktop requirement instead of apologising for it.** A1
  does the honest half. The aspirational half is a landing page whose argument is
  "your designs never leave your computer" — which is the same sentence, told as
  the reason to buy.

---

## Order, and why

`A` first: it is pure copy and small handlers, needs no infrastructure, and
fixes the finding most likely to produce a refund request. `B` next because
B1 is a data-integrity risk that makes customer #2 unsafe, not merely
impossible. `C` only after A+B, or the human test measures problems we already
know how to fix. `D` last, because taking real money before C passes is the
one irreversible step in this plan.

**Phase 25 runs in parallel, not after.** Its only overlap with this plan is A2's
deleted card and the connect page's eventual second door; everything else is
disjoint. Its unblocked track (read-only in the desktop app) can start today.

## Acceptance

- [~] A stranger completes signup → pay → project → first design **unaided**,
  and the funnel told them the full cost before the card.
  **Partly.** C1 walked signup → wizard → Stripe → payment → provision → first
  open on 2026-08-01, and the funnel now states the bill of materials before
  the card (verified in the live UI, not in a test). But it was walked by an
  agent, and one click needed a human: Stripe's agentic-commerce control asks
  the buyer to confirm they are not an AI, and that assertion is not mine to
  make. **Unaided by a real stranger is C4 and is still open.**
- [x] Two projects run concurrently, provisioned by the wizard, with no shared
  seed and no manual step.
  Two cells served at once; the second resolved its OWN config
  (`projectName: "C1 Stranger Test"`, `seedRepo: null`, its own owner) and
  booted with `canvases: 0` — it did not clone the pilot's 65. The manual step
  that remained on the day (the domain) was the `CF_PROVISION_TOKEN`
  permission, since fixed and re-verified through the Worker's own path.
- [x] A non-payer's cell actually suspends; a deleted project's bytes are
  actually gone.
  Proven end to end against a real Stripe test clock: trial → past_due →
  (grace) → suspended + export + email → warning → purged, with
  `do.send-export → ok` before any teardown and another tenant's objects
  untouched. Delete-through-product purged the C1 project's bytes and detached
  its address.
- [ ] The timed club-member cold start is RUN and its time recorded.
  **Not done — owner gate (C3).** Deliberately not simulated: the measurement
  IS a non-technical human with a stopwatch.
- [x] No customer-facing page instructs an action the customer cannot perform.
  The impossible connect card and its operator-console footnote are gone; the
  export page says what the file is and who opens it; the delete gate carries
  the button it demands; the viewer refusal no longer points at a gallery that
  is being deleted; and an empty project can now actually be deleted, which it
  could not before C1 found it.

## Decisions to record

- ~~The A0 verdict~~ — **resolved 2026-07-31**: browser Studio, read-only, gallery
  dropped. The DDR belongs with Phase 25's A0, which decides the render path.
- **A11's retention number** — how long after a project pauses its data is
  deleted, and what is promised on screen before the click.
  **Implemented as 30, not 7** — see the execution note below.
- B1's per-tenant config channel — it changes the provisioning contract.
- B2's instance ceiling + the cost-per-instance number behind it.
- B4's purge semantics (what "deleted" means, and after how long).

---

## Execution note — 2026-07-31

Tracks **A** and **B** are done, plus the two D items that are code rather than
money (D2, D5) and the code half of D4. Everything left is an owner gate.

### The retention number: 30 days, not 7

A11 proposed seven days. **It shipped as thirty**, because seven would have been
a *shortening of an already-published promise* — the exact breach A11's own
warning names. The Trust page has published "data is retained 30 days" since
Phase 9 and `reconcile.mjs` has enforced `SUSPEND_RETENTION_DAYS = 30` for as
long. `billing.mjs` now imports that constant rather than restating it, and
`trust-claims.test.mjs` asserts the screen and the reconciler cannot drift
apart. Moving it in either direction is now a DDR, which is what A11 asked for.

### B4's purge semantics, as built

**Delete means everything, immediately — including the prepared exports.** No
second retention window hides under the first. The confirmation screen says so
before the click, and the gate still requires a copy to exist first. The
automatic path (retention elapsed) purges too.

### A bug the plan did not know about, found in B3

`exported` had no branch in `reconcile()`, so the generic path-walk asked for
`suspended`, found no legal one-hop route, and took the shortest path —
`exported → active → suspended` — **resurrecting a project queued for deletion
and resetting its retention clock, every lap, forever.** The deletion the Trust
page and the cancellation screen both promise could never have happened. Fixed
and pinned by two tests.

### Also done, unasked, because the work required it

- `apps/cells` had **no tests and no CI**. `cellEnv` — the mapping where a
  mistake means one tenant reading another's data — was untested. The pure half
  is now `apps/cells/cell-config.mjs` (the container import made the module
  unloadable under Node), it has 11 tests, and `quality.yml` runs them.
- The connect page's pointer at the workspace's operator console went with A2's
  card: it is behind the same credential no customer is issued.
- The people page's stale sentence about "the workspace's own sign-in" — the
  thing A2 deleted — is gone.

### Left, and why

| Item | Why it is not done |
| --- | --- |
| **A7** (certificate) | A purchase. The copy fallback shipped: `maude.sh/desktop` now says what SmartScreen will show and that it is expected. |
| **A9** | Google Cloud console, owner's account. **Now unblocked** — the privacy and terms URLs it needs exist at `maude.sh/privacy` and `maude.sh/terms`. |
| **B5** | A decision, not a task, and A2 changed its inputs: the browser lane is deleted until Phase 25 B5 rebuilds it behind the Maude account. Decide when that lands. |
| **C1–C4** | Human walks. C3 and C4 are explicitly owner gates; C1 and C2 need live infrastructure and a published consent screen. |
| **D1, D3** | Live money. D1 is the one irreversible step in the plan and is gated on C; D3 needs Stripe test clocks against a real account. |
| **D4** | The pack is written and linked (A8) and the code-checkable claims are pinned. What remains is not code: the registered entity details and a counsel review, both hard gates on D1. |
| **E1** | An aspirational landing page. A1 did the honest half; this is a marketing rewrite, not a defect. |

---

## Retro — 2026-08-01

**Unit tests said nothing about the four worst defects.** 359 green tests, and
every one of these took a real request to find: email had been 403-ing on every
send for two days; the deploy workflow had been red so long that a genuine
failure hid inside it; the funnel quoted €19 and charged €22.99; a brand-new
project could never be deleted. A payment integration proven against a faked
`globalThis.fetch` is proven against our own idea of the provider. **Probe the
live thing with the exact payload the code builds, before a human walks it.**

**"Nobody has tried" and "it cannot work" look identical from a database.** The
audit read an empty `audit_log` as an unwalked path. C1 found the wizard could
not complete a checkout at all — Stripe's Managed Payments needed a product tax
code no product had. The absence of evidence was evidence, and reading it as
laziness cost a phase's worth of assumption.

**I got the tax question wrong twice before measuring it.** First "Stripe Tax is
inert without registrations", then "switch it off until an accountant answers".
Both plausible, both wrong; the third answer came from one API call. When a
claim is cheap to test and expensive to be wrong about, test it in the same
breath as making it — and prefer superseding a recorded decision over quietly
leaving a wrong fact in the graph.

**The plan's own proposal contradicted a published promise.** A11 asked for a
7-day retention window; the Trust page has said 30 since Phase 9. Shipping 7
would have been the exact breach A11's own note warned about. **Grep the
published surfaces for a number before implementing a plan's number.**

**Two commits went wrong through the shared index, not through the code.**
`~/git` is a Syncthing tree with concurrent sessions, and an index entry I did
not stage rode along in a commit and reverted a file. CLAUDE.md already says to
verify content AFTER committing; I skipped it once and it cost a red CI run and
a follow-up commit. `bun test` also clobbered `apps/studio/dist/` twice. **Both
rules were already written down. The failure was not knowing them, it was not
running them.**

**For `/plan` next time:** when a phase's acceptance criteria include a human
walk, schedule the *machine-checkable* half of that walk first — it found five
defects here that the human would otherwise have hit live, and it cost minutes.

