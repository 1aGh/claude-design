# Cloud Phase 14 — Checkout that provisions first and charges after

> USER-ADVOCATE's finding: "pay → cell boots → empty project" is the worst five
> minutes in the journey, and paying for a cell that never boots is the worst
> possible first impression.

## Tasks

- [x] T1 — project-create wizard: `GET/POST /projects/new` (checkout-routes.mjs
  + checkout-pages.mjs, design-system chrome, no script). The id is derived
  from the name server-side (diacritics fold: "Zkušební tým" → "zkusebni-tym");
  reserved names and the `view-*` share namespace are refused (checkout.mjs).
- [x] T2 — Stripe Checkout session over the price catalog (pricing-core.mjs —
  the pure half of pricing.mjs, split so the Worker can bundle the JSON and
  never import node:fs). Subscription mode WITH the advertised 14-day trial:
  the card is collected and validated ("authorized") but nothing is charged at
  checkout — which is what makes the DDR-203 ordering possible in subscription
  mode. The project row is written on RETURN, not before checkout, so an
  abandoned checkout never squats an address. The waiting room
  (`/projects/<id>/setup`, meta-refresh, no script) probes the workspace
  itself and lets `decideCheckout` rule: healthy → the subscription is kept
  and converts at trial end ("charge"); failed/timeout → the subscription is
  cancelled at zero cost ("void") and the person is told plainly.
  Provisioning = attaching `<id>.cloud.maude.sh` to the data-plane Worker via
  the API (provision.mjs), idempotent, retried from the waiting room.
- [x] T3 — **provision-first ordering**: decided, and asserted as a rule rather
  than implemented as a branch. See DDR-203. A card is authorized, the
  workspace is built, and only a workspace that ANSWERS turns the authorization
  into a charge; a failure or a timeout voids it and explains.
- [x] T4 — waiting room: named steps (never an invented percentage) and the
  "your card has not been charged yet" reassurance on the screen itself.
  Rendering surface not built.
- [x] T5 — billing portal link: `/projects/<id>/billing` (owner-only, same 404
  as a stranger for anyone else) + POST `/billing/portal` → Stripe-hosted
  portal. Cards, invoices, plan changes and cancelling live at Stripe — it is
  the customer's billing relationship, held directly. (Doubles as Phase 20 T2.)
- [x] T6 — tests: the charge rule proven exhaustively over every payment ×
  provision combination, void-on-failure, void-on-timeout, idempotence against
  redelivered webhooks, and a vocabulary lint over every customer-facing string.

## Acceptance criteria

- [~] Test-card flow end to end. Everything is built, tested against a faked
  Stripe (24 route tests incl. the full happy path, the timeout-void, and
  void idempotence), deployed, and live at cloud.maude.sh — but the deployed
  Worker has NO `STRIPE_SECRET_KEY`, because a Stripe secret key is only
  obtainable from the dashboard by a human. **The one remaining step is the
  owner's (2 minutes):** Stripe dashboard → sandbox → Developers → API keys →
  copy the secret key → `cd apps/cloud && npx wrangler secret put
  STRIPE_SECRET_KEY` (and `STRIPE_WEBHOOK_SECRET` when the webhook endpoint
  is registered). Until then the wizard renders and refuses politely at the
  payment step.
- [x] A manufactured provision failure produces a void, never a charge —
  proven as a rule over all inputs, not just the happy path — and now also
  proven over the wire shape: the route test manufactures a timeout and
  asserts the subscription DELETE went out and never goes out twice.

## Retro (2026-07-30)

- Subscription-mode + advertised-trial turned out to be the clean concrete
  form of DDR-203 — no manual-capture PaymentIntent gymnastics, and the
  customer gets exactly what the pricing page promises.
- Writing the project row at RETURN (not at wizard submit) killed the
  abandoned-checkout-squats-an-address bug before it existed; the session's
  metadata carries everything the return needs.
- The waiting room re-deciding after settlement rendered an empty page once —
  `already-settled` deliberately carries no customer sentence. Render from the
  decision you just took, not from a re-read.

## Decisions recorded

- [DDR-203](../archive/decisions/DDR-203-provision-first-charge-after.md)

## Why the ordering came first

It is the product promise, and it is the thing that gets reversed by accident
while somebody is adding a feature. Deciding it inside the webhook handler —
where the effects will eventually live — would have made it a branch nobody
reviews rather than a rule with a name.

## Open

The wizard, the Checkout session, the authorize/capture/void calls, the email,
and the billing portal link. All mechanical, all testable against the rule that
now exists.

One coupling worth remembering: the 10-minute timeout is tied to real
cold-start measurements from Phase 15. If cold starts get slower, this moves
with them, or people are voided while their workspace is still building.
