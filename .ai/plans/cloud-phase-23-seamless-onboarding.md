# Cloud Phase 23 — Seamless onboarding: the door actually opens

> Resolved by an adversarial debate (2026-07-30, reduce tier: USER-ADVOCATE ·
> BREAKER · SHIPPER — kgai `debate-seamless-onboarding-self-service`).
> Unanimous verdict: **not seamless.** The worst moment, verified LIVE, not
> inferred: a paying customer clicks "Open your project" and lands on a page
> titled "Studio Hub · self-hosted sync · Yjs + Hocuspocus" whose only button
> asks them to paste HUB_SECRET — a platform operator secret that by design
> never reaches a customer. No project name, no way back, no credential that
> could exist for them.
>
> The owner's ask: one self-service admin, or at least clean two-way linking.
> The debate's answer: the dashboard already IS the one admin (DDR-204) — the
> break is the LAST DOOR, and the fix splits into a cheap control-plane batch
> (A, ship first) and ONE batched cell image roll (B, v8) whose contents are
> defined by BREAKER's non-negotiables. Merging the hub console into the
> dashboard was rejected again: proxying privileged per-cell APIs through the
> control plane reopens the DDR-193 containment boundary.

## A — control-plane only (cheap, no image roll)

- [ ] A1 — **`/projects/<id>/connect` page** replaces both bare `Open` links
  (`dashboard.mjs:110`, `checkout-pages.mjs` "Open your project"): states the
  project address, hands over the real connect path (desktop app / `maude
  design link <url> --token=…`), offers the operator console as secondary.
  The page is honest about today; it BECOMES the handoff button when B lands.
- [ ] A2 — `lockup()` links to `/` (brand.mjs) — every control-plane page gets
  the return leg for free; drop hand-rolled crumbs where redundant.
- [ ] A3 — honest invite/People copy: control-plane membership does not yet
  reach the workspace door; say so rather than dead-ending a teammate.
- [ ] A4 — copy sweep: home `<title>` reads "Maude Cloud — Maude Cloud";
  pending-state card promises "We will email you when it is ready" but no
  such email exists — either send it (email.mjs has the boundary) or change
  the promise. Mirror page: link the GitHub App install URL, and note the
  way back.
- [ ] A5 — invite sign-in round trip: `/login?next=/invite/<id>` so an
  existing-account invitee doesn't have to re-find the email link.

## B — ONE cell image roll (v8), contents locked by BREAKER

- [ ] B1 — **identity gets its own switch**: hub keys cloud-identity on
  explicit `MAUDE_CLOUD_IDENTITY=1`, never on `MAUDE_CONTROL_PLANE_URL` (the
  2026-07-30 regression: the mirror URL silently flipped the live cell into
  a mode with no working browser sign-in; withdrawn same day, mirror clock
  asleep as collateral). Restore `MAUDE_CONTROL_PLANE_URL` for the mirror in
  the same roll.
- [ ] B2 — **role must bite on the cell before identity flips**: the exchanged
  peer token is wildcard-scoped and 30-day; a dashboard *viewer* would become
  a full editor, and the People page's "viewer can change nothing" +
  "removal lands within 12 hours" promises would both be false. Enforce
  viewer (or refuse to mint for it), cap exchanged-token TTL to the project
  token's, and actually consume `revokeSessions`.
- [ ] B3 — **browser handoff as ONE exchange shape**: short-lived one-time
  code, POST/redirect — never a bearer token in a GET URL (the repo's own
  /join decision) — consumed identically by the browser, workspace-signin.ts
  (which today swallows the cloud-identity 400 into "try again shortly"),
  and Phase 17's `maude://`. Three handoff shapes is the unrecoverable
  mistake.
- [ ] B4 — separate signing purposes: project-token key must not BE
  HUB_SECRET (admin bearer + peer token + identity signing in one value);
  `deriveSecret` already takes a purpose argument.
- [ ] B5 — the cell's landing page speaks to the customer: project name, the
  work, a back-link to the dashboard (`HUB_DASHBOARD_URL` — a NEW var, so it
  cannot re-trip B1), operator console demoted to a footer link.
- [ ] B6 — members reach the door: cloud-mode cells take identity from the
  control plane (B1–B3), so `PILOT_ADMIN_EMAIL` seeding and the hub's own
  magic-link invite (`createUser` with a password cloud mode never accepts)
  are retired for cloud cells.

## Preserved dissent (verbatim stakes, inert)

- USER-ADVOCATE (conf 10): the handoff is "the one thing to ship before
  anyone else signs up" — every paying customer hits the wall on the first
  click after payment.
- BREAKER (conf 8): "turning on cloud identity silently converts every
  dashboard viewer into a full editor holding a 30-day, unrevocable
  credential" — B2 is a precondition, not a follow-up.
- SHIPPER (conf 8): "the actual customer-visible lie is two anchor tags and
  one missing page" — don't spend the expensive lever (an image roll) before
  the two links stop lying.

## Acceptance

- [ ] A stranger: signup → pay (test card) → waiting room → **one click** →
  their canvases, no second credential, no infrastructure vocabulary.
- [ ] An invited teammate: email → one link → account → dashboard → the same
  one click; viewer genuinely cannot edit.
- [ ] Every outward hop (Stripe, GitHub, the cell) has a visible way back.
