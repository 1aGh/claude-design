# Cloud Phase 14 — Checkout that provisions first and charges after

> USER-ADVOCATE's finding: "pay → cell boots → empty project" is the worst five
> minutes in the journey, and paying for a cell that never boots is the worst
> possible first impression.

## Tasks

- [ ] T1 — project-create wizard.
- [ ] T2 — Stripe Checkout session over the tested `pricing.mjs`.
- [x] T3 — **provision-first ordering**: decided, and asserted as a rule rather
  than implemented as a branch. See DDR-203. A card is authorized, the
  workspace is built, and only a workspace that ANSWERS turns the authorization
  into a charge; a failure or a timeout voids it and explains.
- [x] T4 — waiting room: named steps (never an invented percentage) and the
  "your card has not been charged yet" reassurance on the screen itself.
  Rendering surface not built.
- [ ] T5 — billing portal link.
- [x] T6 — tests: the charge rule proven exhaustively over every payment ×
  provision combination, void-on-failure, void-on-timeout, idempotence against
  redelivered webhooks, and a vocabulary lint over every customer-facing string.

## Acceptance criteria

- [ ] Test-card flow end to end. NOT run — the Checkout session and the
  void/capture calls are not built.
- [x] A manufactured provision failure produces a void, never a charge —
  proven as a rule over all inputs, not just the happy path.

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
