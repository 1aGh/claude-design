# Cloud Phase 20 — Self-administration

> The dashboard as CONTROL plane. The audit log is customer-visible (DDR-193
> §4 — "you can see that we looked" is the control).

## Tasks

- [ ] T1 — project dashboard: members, rename, share toggle, mirror settings.
- [ ] T2 — billing: Stripe-hosted portal link, plan/status from the reconciler.
- [x] T3 — **export anytime**: the cell produces the full bundle (git bundle +
  asset manifest + a plain-language README that states what is NOT included).
  See DDR-202.
- [~] T4 — delete project: the lifecycle machine already forbids reaching
  `purged` except through `exported` (DDR-193 §3, tested since Phase 5), and
  Phase 20 gives that state something real behind it. The customer-facing
  action that drives it is not built.
- [ ] T5 — customer-visible audit log page over `audit_log`.
- [x] T6 — tests for the above: history round-trips through the bundle, the
  manifest names omissions, an empty project refuses rather than pretending,
  and a broken asset listing costs the manifest rather than the export.

## Acceptance criteria

- [ ] A customer can run their whole relationship — members, billing, export,
  deletion — with no email to support and no terminal. **Not met.** The export
  exists and is complete; the surfaces do not.

## Decisions recorded

- [DDR-202](../archive/decisions/DDR-202-export-is-the-promise-the-rest-rests-on.md)

## Why the export came first, deliberately

A delete button with no working export behind it is a promise the product
cannot keep, and the lifecycle machine has required an export since Phase 5
without anything producing one. Building the buttons first would have meant
shipping a UI whose most consequential action was backed by nothing.

## Open

All of T1, T2, T5, and the customer-facing half of T4. These are mechanical
surfaces over machinery that now exists — which is the right order, but it does
mean this phase is not closed.
