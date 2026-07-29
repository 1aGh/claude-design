# Cloud Phase 13 — One account, two doors (signup + the invitee who never sees maude.sh)

> BREAKER counted five credential systems (password, Google, invites, HUB_SECRET,
> peer tokens); USER-ADVOCATE ruled nobody logs in twice. This phase collapses
> them into ONE identity spine: a maude.sh account that MINTS short-lived scoped
> peer tokens for cells (DDR-192 §3 already specifies the mint).

## Shape

- **Buyer door:** email+password (existing scrypt stack, reused from apps/hub
  `users.mjs` — same code, control-plane D1 storage) AND **Google OAuth**
  (buyer-side only; OAuth on the Worker via PKCE, no client secret in a browser).
- **Invitee door:** magic-link ONLY. The invite link goes straight to the CELL,
  never to maude.sh. First magic link IS email verification. No password unless
  they later choose one. Vocabulary lint applies (no token/repository/oauth…).
- **Session → cell access:** control-plane session mints a scoped, expiring peer
  token per project (the DDR-194 token model, minted rather than pasted).
- **Disclosure inside signup** (DDR-193 §4): `disclosure_accepted_at` is already
  a column; the signup flow is what writes it.

## Tasks

- [x] T1 — port `users.mjs` hashing/validation to a control-plane `accounts` module
  over D1 (shared source, not a fork — extract the pure parts into a lib both import).
- [x] T2 — signup/login routes + session cookie (HttpOnly, SameSite=Lax, Secure).
- [x] T3 — Google OAuth (PKCE) → same accounts row (link by verified email; a
  Google sign-in to an existing password account with unverified email must NOT
  merge silently — that is an account-takeover primitive).
- [x] T4 — signup SPA pages (static assets on the Worker): signup, login, verify,
  disclosure. Copy through the banned-vocabulary lint.
- [x] T5 — peer-token mint endpoint (`POST /projects/:id/token`), scoped + expiring;
  revocation on member removal terminates live cell sessions (BREAKER's rule).
- [x] T6 — tests: auth flows, the no-silent-merge rule, mint scoping, copy lint.

## Acceptance criteria

- [x] A stranger can create an account — **verified LIVE** against the deployed
  Worker + real D1: signup 303 + session, correct login 303, wrong password 401,
  duplicate 400 with no existence oracle, missing-consent 400 with no row
  written, logout kills the session server-side (401 after).
- [x] Google door built end to end (PKCE S256, state cookie, no-silent-merge);
  **unconfigured reports 503 honestly** instead of a broken redirect. Client
  id/secret are the only owner-gated item.
- [x] Grant mint (`POST /api/projects/:id/token`) — HMAC, 10-minute expiry;
  not-yours and not-there are the SAME 404.
- [x] No fifth credential system: HUB_SECRET stays operator-only; the grant is a
  minted artifact of the one account, never a pasted credential.
- [~] Invitee magic-link path — the CELL half (apps/hub invites) exists; the
  control-plane side is Phase 14/17 work.

## Status: DONE + LIVE (2026-07-29)

`https://maude-cloud.maude1agh.workers.dev` — `/signup`, `/login`, `/auth/*`,
grant mint. 126 cloud tests green.

## Retro

- **Two live-only bugs, neither reachable from a test.** (1) Workers' WebCrypto
  hard-refuses PBKDF2 above 100k iterations, so the OWASP 600k floor is
  impossible in one call — the fix is CHAINING six 100k rounds (identical work,
  no weakening), and lowering the factor to fit the cap was the tempting wrong
  move. (2) The v2 migration never ran against live D1, so every signup 400'd on
  a missing column *behind a friendly error message* — the friendliness hid it.
- **The friendly-error rule needs a companion.** A neutral message to the user
  is right; a neutral message to the OPERATOR is not. The 400 said "check the
  address" while the real cause was schema drift. Errors now log their cause.
- **Migrations belong to the deploy, not to a human.** Workers have no boot
  hook, so `applySchema` now runs in the hourly cron BEFORE the sweep, and a
  failed migration stops the sweep rather than reconciling on unknown schema.
- **A minted deploy token beat the MCP multipart path.** Creating a scoped
  Cloudflare API token (Workers Scripts Write + D1 Write) let plain `wrangler
  deploy` work — far better than hand-rolling multipart uploads through the API.
  Stored untracked in `apps/cloud/.dev.vars.deploy`.

## Decisions to record

- The one-account model + no-silent-merge rule (DDR; supersedes nothing, extends DDR-194).
