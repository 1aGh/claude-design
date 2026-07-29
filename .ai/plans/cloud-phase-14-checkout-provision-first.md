# Cloud Phase 14 — Checkout that provisions first and charges after

> USER-ADVOCATE's finding: "pay → cell boots → empty project" is the worst five
> minutes in the journey, and paying for a cell that never boots is the worst
> possible first impression. Provision-first, charge-after (or auto-void).

## Tasks

- [ ] T1 — project-create wizard (name → tenant id via `validateTenantId`,
  RESERVED_IDS enforced at the UI too so the error arrives while typing).
- [ ] T2 — Stripe Checkout session over the tested `pricing.mjs` (sandbox price
  ids; live mode still throws — that stays). Metadata carries project id only.
- [ ] T3 — **provision-first ordering**: checkout success → project `pending` →
  reconciler drives `stepToward('active')` → cell healthy → subscription
  activated. If the cell fails to boot within the timebox, the subscription is
  auto-voided/refunded and the human gets a plain-language email, not a charge.
- [ ] T4 — waiting room: honest boot progress + "we'll email you when it's ready";
  empty-project first-run offers a real first move (open in desktop / invite).
- [ ] T5 — billing portal link (Stripe-hosted; we build no card UI).
- [ ] T6 — tests: ordering (charge cannot precede healthy), void-on-failure,
  reserved-id rejection, vocabulary lint on every customer-facing string.

## Acceptance criteria

- [ ] Test-card flow end-to-end against `wrangler dev` + sandbox Stripe.
- [ ] A manufactured provision failure produces a void, never a charge.
- [ ] Live run gated on Phases 11–12 (reported SKIPPED until then).
