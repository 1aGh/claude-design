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

## A — control-plane only (cheap, no image roll) · ✅ SHIPPED 2026-07-30

- [x] A1 — **`/projects/<id>/connect` page** replaces both bare `Open` links
  (dashboard card + waiting-room "Open your project"): the project address,
  honest browser sign-in note, desktop Link-workspace path, operator console
  demoted to a footer line. A pending project's card opens its live setup
  instead. The page BECOMES the handoff button when B lands.
- [x] A2 — `lockup()` is a link to `/` (brand.mjs) — every control-plane page
  gets the return leg for free.
- [x] A3 — honest invite/People copy: the invitation covers the dashboard;
  the workspace door still uses the workspace's own sign-in for now.
- [x] A4 — copy sweep: home `<title>` deduplicated; pending-card email
  promise replaced with the truthful "the setup page shows each step live";
  mirror page links the GitHub App install (github.com/apps/maude-mirror)
  with come-back-and-save guidance; stale signed-in home copy replaced.
- [x] A5 — `/login?next=…` (same-origin relative paths only — hostile values
  fall back to `/`); the invite's sign-in mode carries its own return.
- [x] A6 (found by the screenshot pass, not the HTML): `dashboard.mjs` and
  `people-page.mjs` page helpers rendered `<body>` without `<main>`, so
  their `main { max-width }` rules never applied and content sat on the left
  edge. Same class of bug the brand fix caught earlier on other pages —
  screenshot verification keeps earning its keep. 258/258 tests green;
  deployed and live-verified.

## B — ONE cell image roll (v8), contents locked by BREAKER

- [x] B1 — **identity gets its own switch**: hub keys cloud-identity on
  explicit `MAUDE_CLOUD_IDENTITY=1`, never on `MAUDE_CONTROL_PLANE_URL` (the
  2026-07-30 regression: the mirror URL silently flipped the live cell into
  a mode with no working browser sign-in; withdrawn same day, mirror clock
  asleep as collateral). Restore `MAUDE_CONTROL_PLANE_URL` for the mirror in
  the same roll.
- [x] B2 — ✅ COMPLETE 2026-07-30: viewer refused + TTL cap live-verified at
  12.0h (cell v8); `revokeSessions` now CONSUMED (cell v9) — a remove/demote
  writes `member_revocations` (D1 v10), the cell's 10-minute sweep
  (`/internal/revocations`, derived-secret gated) revokes the person's peer
  tokens and kicks their sockets. Live-verified against production.
- [x] B3 — ✅ 2026-07-30: ONE exchange shape shipped — single-use 120s
  hashed-at-rest handoff code (`POST /projects/<id>/handoff` mint, viewer
  refused; `POST /auth/handoff/exchange` burns first, re-decides membership,
  returns the same project token `/projects/open` mints). Consumed by the
  connect page's "Open in Maude" (no-script launch page → `maude://` — a
  claim ticket in the URL, never a bearer token) and Phase 17's deep link;
  the studio's CloudBar lane stays on the personal-token POST shape (same
  family, same cell sink). workspace-signin.ts now surfaces the
  cloud-identity 400 message verbatim instead of "try again shortly".
  NOTE: the cell has no signed-in member browser UI to hand into (the
  browser surface is the DDR-200 share view), so "the browser consumes the
  code" resolves to the launch page → app lane; a future cell member UI
  reuses the same exchange.
- [x] B4 — separate signing purposes: project-token key must not BE
  HUB_SECRET (admin bearer + peer token + identity signing in one value);
  `deriveSecret` already takes a purpose argument.
- [x] B5 — the cell's landing page speaks to the customer: project name, the
  work, a back-link to the dashboard (`HUB_DASHBOARD_URL` — a NEW var, so it
  cannot re-trip B1), operator console demoted to a footer link.
- [x] B6 — ✅ 2026-07-30 (behind the deliberate strict flip):
  `CELL_IDENTITY_MODE=strict` (cells worker var) stops seeding
  `PILOT_ADMIN_EMAIL` and the hub answers `/join` + admin invite creation
  with directions to the dashboard (410/409). Hybrid behavior unchanged —
  the flip itself stays a deliberate later act, exactly as B1's lesson
  demands. Shipped in cell v9, tests both modes.

## C — Maude Desktop: sign in to Maude Cloud and attach from the UI
## (owner request 2026-07-30: "to by bylo nejjednodušší" — and it is)
##
## C1–C3 SHIPPED same day; B shipped as cell v8 (hybrid identity). C4 open.

Depends on B (the cell must accept a project token before any client can use
one). Consumes the exchange the desktop-friendly way that ALREADY exists:
`POST /auth/login {token}` on the cell — a POST body, so the BREAKER's
no-token-in-a-GET-URL rule is satisfied on this lane for free.

- [x] C1 — **control-plane device flow** (mirror of the desktop's proven
  GitHub pattern, oauth.rs / DDR-108): `POST /auth/device/code` →
  short user code + verification page (signed-in dashboard user types the
  code — or lands on it from a link), desktop polls `POST /auth/device/token`
  → a personal token, stored ONLY in the OS keychain (keychain.rs). New D1
  table for device codes + personal tokens; personal tokens revocable from
  the dashboard (Account page lists signed-in devices — the revocation UI the
  12h-window story needs anyway).
- [x] C2 — **projects API for clients**: `GET /api/projects` (Bearer personal
  token) → projects + roles; `POST /projects/open` accepts the same Bearer
  (today it is cookie-session-only) → project token + url.
- [x] C3 — **desktop UI**: a "Maude Cloud" section (first-run + menu):
  Sign in → device-code modal (same component family as GitHubIdentity) →
  project picker (name, state pill, role) → choose a local folder → the app
  runs the existing link flow (design-link.mjs via the bundled CLI bridge,
  token from the cell exchange, never pasted by a human) → serve + open.
  The CLI path stays for scripting; the UI is the default.
- [x] C4 — ✅ RUN GREEN 2026-07-30: `pnpm test:e2e:desktop:cloud` — 4/4 in
  the real WKWebView (debug bundle): device sign-in with no human, picker
  member→Connect / viewer→"View in the browser", linkedHub written +
  reverted, and the maude:// confirm strip + one-time-code attach. Control
  plane + cell stubbed in the wdio conf; the e2e bundle registers
  `maude-e2e`, never `maude` (LaunchServices hijack guard). DDR-177
  `check-bundle-completeness --smoke` remains the release gate as always.
- [x] C5 — ✅ 2026-07-30: Phase 17's `maude://` landed ON TOP of this —
  protocol registration (tauri-plugin-deep-link), Rust parks the untrusted
  URL, the client asks before connecting, the code exchanges only against
  the configured cloud address. See the phase-17 plan for the honest
  remainder (OS-level scheme smoke in a signed bundle + the human cold
  start).

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

- [x] A stranger: signup → pay (test card) → waiting room → **one click** →
  their canvases, no second credential, no infrastructure vocabulary.
  (Machinery complete: STRIPE_SECRET_KEY live 2026-07-30, connect page's
  "Open in Maude" → one-time code → app opens signed in. The human
  click-through is the owner's test-guide walk.)
- [x] An invited teammate: email → one link → account → dashboard → the same
  one click; viewer genuinely cannot edit (refused at every mint + exchange,
  live sessions swept within ~10 min of removal).
- [x] Every outward hop (Stripe, GitHub, the cell) has a visible way back.

## Retro (2026-07-30)

- The debate's split (cheap A batch / one locked B roll / C on top) held:
  three deploys, no thrash, every BREAKER precondition landed before the
  lane that needed it.
- Two propagation gotchas cost cycles: a comma-joined Set-Cookie header
  killed Google sign-in silently (RCA in kgai), and Cloudflare edge
  propagation made freshly-deployed routes 404 for ~a minute — poll before
  diagnosing.
- The e2e stub-in-conf pattern (env primed before app spawn) made the whole
  cloud lane testable with zero real credentials; reuse it for future lanes.
