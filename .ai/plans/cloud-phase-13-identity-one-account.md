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

- [ ] T1 — port `users.mjs` hashing/validation to a control-plane `accounts` module
  over D1 (shared source, not a fork — extract the pure parts into a lib both import).
- [ ] T2 — signup/login routes + session cookie (HttpOnly, SameSite=Lax, Secure).
- [ ] T3 — Google OAuth (PKCE) → same accounts row (link by verified email; a
  Google sign-in to an existing password account with unverified email must NOT
  merge silently — that is an account-takeover primitive).
- [ ] T4 — signup SPA pages (static assets on the Worker): signup, login, verify,
  disclosure. Copy through the banned-vocabulary lint.
- [ ] T5 — peer-token mint endpoint (`POST /projects/:id/token`), scoped + expiring;
  revocation on member removal terminates live cell sessions (BREAKER's rule).
- [ ] T6 — tests: auth flows, the no-silent-merge rule, mint scoping, copy lint.

## Acceptance criteria

- [ ] A stranger can create an account with either door (locally via `wrangler dev`;
  live gated on Phase 11/12 deploy).
- [ ] An invitee path exists that never renders a maude.sh page.
- [ ] No fifth credential system survives: HUB_SECRET stays operator-only,
  invites + peer tokens are MINTED artifacts of the one account.

## Decisions to record

- The one-account model + no-silent-merge rule (DDR; supersedes nothing, extends DDR-194).
