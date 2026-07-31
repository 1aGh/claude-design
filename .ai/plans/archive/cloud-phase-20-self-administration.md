# Cloud Phase 20 — Self-administration

> The dashboard as CONTROL plane. The audit log is customer-visible (DDR-193
> §4 — "you can see that we looked" is the control).

## Tasks

- [x] T1 — project dashboard: the dashboard card now carries every control —
  Open, Sharing, People (Phase 22), Billing, GitHub copy (mirror settings,
  `/projects/<id>/mirror`, validated by the tested `mirror.mjs` grammar, saved
  to the control plane where the cell's clock reads it), Activity, Download
  everything, Delete. Rename deliberately not built — nobody has asked, and a
  rename surface invites address-change expectations the hostname cannot keep.
- [x] T2 — billing: `/projects/<id>/billing` + Stripe-hosted portal handoff
  (built in Phase 14, owner-only, same-404-as-a-stranger).
- [x] T3 — **export anytime**: the cell produces the full bundle (git bundle +
  asset manifest + a plain-language README that states what is NOT included).
  See DDR-202.
- [x] T4 — delete project: `/projects/<id>/delete` refuses until a completed
  export exists (the DDR-193 §3 ordering, now customer-facing), then stops
  billing FIRST (a failed cancellation deletes nothing), purges, and detaches
  the address. The downloaded copy is named as the thing that stays theirs.
- [x] T5 — customer-visible audit log: `/projects/<id>/audit`, every entry in
  the customer's language (`AUDIT_COPY` — internal action names never reach
  the page), platform actions included, because "you can see that we looked"
  is the control (DDR-193 §4).
- [x] T6 — tests for the above: history round-trips through the bundle, the
  manifest names omissions, an empty project refuses rather than pretending,
  and a broken asset listing costs the manifest rather than the export.

## Acceptance criteria

- [x] A customer can run their whole relationship — members, billing, export,
  deletion — with no email to support and no terminal. Members (Phase 22),
  billing portal (Phase 14), export (`/download` triggers the cell's
  `/api/export` with an owner token the cell verifies offline, files served
  from R2 through the control plane with the storage namespace never exposed
  in a URL), deletion (export-gated), activity, mirror settings. 255 cloud
  tests + 318 hub tests green; deployed.

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
