# DDR-203 — Provision first, charge after: nobody pays for a workspace that did not come up

- **Date:** 2026-07-29
- **Status:** accepted
- **Scope:** `repo:maude`, `dept:dev`
- **Plan:** `.ai/plans/cloud-phase-14-checkout-provision-first.md`

## Context

The default ordering of every checkout integration is *payment succeeded →
charge → provision*, because charging is the easy part and booting is the part
that can fail. It produces the worst five minutes in the journey: somebody
pays, waits, and lands in an empty project — or pays for a workspace that never
boots at all.

## Decision

**A card is authorized, the workspace is built, and only a workspace that
answers turns the authorization into a charge.**

If provisioning fails, or simply never finishes inside the window, the
authorization is voided and the person is told in plain language. They are
never charged for something that did not work.

### Three cases, and the silent one matters most

| provision | outcome |
| --- | --- |
| `healthy` | charge |
| `failed` | void + explain |
| never finishes | void after 10 minutes + explain |

The third is the one an ordering usually forgets. Without a timeout an
authorization sits there indefinitely and the person is left not knowing
whether they paid — which is worse than a clean failure, because there is
nothing to act on.

### The rule is asserted, not just implemented

`chargeIsPermitted()` exists separately from `decideCheckout()` and is tested
exhaustively over every `payment × provision` combination. A test that only
drives the decision function proves the decision function; this proves the
**rule**, including against branches a future feature might add. The ordering
is the product promise, so it must be impossible to reverse by accident while
someone is adding something else — which is exactly what happens to an ordering
that lives as an `if` inside an effects handler (DDR-196 §1).

### Idempotence is the first branch, not the last

A settled payment is never settled again. Stripe redelivers webhooks as a
matter of course, and a second delivery that charged a second time would be the
single worst bug this module can have — so it is checked before anything else,
where it cannot be bypassed by a later condition.

### The waiting room answers the real question

Named steps, never an invented percentage — a percentage made up from nothing
is a lie that gets found out at 90%. And the reassurance that **the card has
not been charged yet** is on the waiting screen itself, not only in a failure
email: that question arrives long before any email does.

Every customer-facing string is lint-tested against our own vocabulary
(`tenant`, `cell`, `provision`, `webhook`, `container`). Our words for our
problems are not the customer's problem.

## Consequences

- Checkout needs an authorization-then-capture flow rather than an immediate
  charge. That is a Stripe configuration choice this module now requires rather
  than assumes.
- The provisioning timeout (10 minutes) is coupled to real cold-start
  measurements from Phase 15, where a first boot that clones a ~280 MB project
  took minutes on a small instance. If cold starts get slower, this must move
  with them, or people will be voided while their workspace is still building.

## Not built

The wizard, the Stripe Checkout session itself, the void/capture calls and the
email. The ordering was the part that had to be decided and provable first;
the effects that carry it out are mechanical and testable against it.
