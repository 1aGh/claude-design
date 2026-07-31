# DDR-207 — Four missing layers, not eleven bugs

- **Date:** 2026-07-30
- **Status:** accepted
- **Area:** cloud / security architecture (extends DDR-054, DDR-097, DDR-204)
- **Source:** the `/flow:validate` security pass (defender 6 blockers, attacker 9 + 5 chains) — reports in `.ai/logs/security-reviews/validate-2026-07-30-{defender,attacker}.md`

## The decision

The validate pass returned fifteen findings. They are not fifteen bugs. They
are **four missing layers**, and each one had already produced more than one
symptom before anybody noticed the shape. Patching the symptoms would have
left every layer still missing and the next symptom still ahead.

## 1. The plane had no edge (`apps/cloud/edge.mjs`)

The control plane quietly became the identity provider for the whole fleet
while keeping none of the hub's defenses. Three findings, one cause:

- **No CSP / X-Frame-Options / HSTS on the pages carrying the password field.**
  Not a decision — *drift*. Six separate `html()` helpers each carried their
  own header object, and the one surface nobody had revisited (`auth-routes.mjs`)
  was the one that never got any.
- **No rate limiting at all**, while `/auth/login` spends 6×100k PBKDF2
  iterations per unauthenticated request. The hub's own login carries the
  comment "rate-limit BEFORE touching scrypt"; the plane, which is becoming
  the *only* door, had nothing.
- **CSRF via the shared registrable domain.** `SameSite=Lax` is same-*site*.
  Every workspace lives at `<project>.cloud.maude.sh` and renders
  customer-authored canvas content (untrusted per DDR-054), so a workspace
  page ships the session cookie on a cross-origin POST to the dashboard.

**Decision:** one module through which every request passes — `sameSiteGate`
before the router, `costGate` before the expensive work, `harden` stamped on
the way out. A route may **tighten** what the edge applies (device-auth's
`default-src 'none'` survives untouched); it can no longer **forget** it, and
a new route inherits the floor for free.

The rate limiter **fails open** on unreachable storage, for the same reason
the hub's does: refusing every login because D1 hiccuped converts a small
outage into a total one. It prefers Cloudflare's native rate-limiting binding
when bound and falls back to a sliding D1 window — the fallback exists so the
plane is not *undefended* while that binding is unconfigured, which is exactly
the state that produced the finding.

## 2. The sweep knew things the door never asked (`apps/hub/src/revocations.mjs`)

Phase 23 B2 shipped a revocation sweep that deleted a removed member's hub
tokens — and nothing consulted the removal at `/auth/login`. The member
re-presented the project token they already held (offline-verified by design,
DDR-204, valid up to 12 h) and collected a fresh session every time the clock
killed one. **A ten-minute sweep therefore guaranteed access for the whole
token lifetime instead of ending it**, and the same loop defeated the explicit
member→viewer demotion refusal.

**Decision:** what the sweep *learns*, the door *reads*. The registry is the
cell's own memory of withdrawn access — persisted so it survives a restart,
compared against the token's `iat` so re-adding somebody just works, and
failing **open** on a corrupt file because a bad file must not lock a whole
workspace out while the TTL still bounds every token. Offline verification is
intact: an outage freezes the registry, it never empties it.

## 3. Nothing owned the vocabulary of our own secrets (`apps/studio/credential-grammar.ts`)

The diagnostic scrubber redacted every **vendor's** credentials — GitHub,
Anthropic, JWTs, Bearer headers — and none of **ours**. Two
independently-correct decisions composed into the leak: the project token
deliberately is not a JWT (one algorithm, nothing to downgrade), so it has
**two** dot-separated parts, and the scrubber's JWT rule correctly requires
**three**. A credential that looks exactly like a JWT to any reviewer sailed
through a bundle labelled "paths & secrets scrubbed". `\b(token|secret)` could
not match `HUB_SECRET=` either — `_` is a word character.

**Decision:** a registry of every grammar Maude itself mints, imported by every
consumer that must recognise one, with a test that walks the source for minted
prefixes and fails when one has no grammar. It found an unregistered sixth
(`mcg_`, the project grant) on its first run — which is the entire argument
for the layer.

## 4. Two surfaces asserted things nobody had checked

- **The `maude://` confirm named a project the server never verified.** The
  banner said "Connect this project to *X*?" while the exchange returned
  whatever the code actually opened. An attacker's code wrapped in a link
  naming something familiar would borrow the victim's consent and point
  `linkedHub` — a **versioned** file — at the attacker's workspace.
- **`/activate` prefilled the code and named nothing.** `client_name` was
  stored and never displayed, so the page asked for consent to an unnamed
  thing while its own warning said "only enter a code you are looking at".

**Decision:** a consent surface must name what is being consented to, and a
claim made in the UI must be checked by whoever can actually check it. The
claimed project now travels with the exchange and a mismatch is refused; the
activate page names the app and when it asked, or names nothing and asks
plainly.

## What this costs

One extra module in the request path (two `Headers` copies and, on five paths,
one D1 read + write). Measured against the failure it replaces — a removed
member with twelve hours of access, or an unauthenticated PBKDF2 amplifier —
that is not a trade worth agonising over.

## Rejected

- **Patching the six `html()` helpers.** It fixes today's six and guarantees
  the seventh helper arrives without headers.
- **Making the revocation window shorter.** It reduces the number the promise
  quotes without making the promise true; the holder still re-opens what the
  sweep closes.
- **One more regex in the scrubber.** It catches the token we happen to be
  looking at and misses the next grammar, exactly as it already had.
- **`SameSite=Strict`.** It would break the Google callback, which is a
  top-level cross-site navigation — the reason `Lax` was chosen originally.
  Fetch-Metadata distinguishes what `Strict` would only blunt.

## Follow-ups recorded, not silently dropped

- `strict` identity mode is **still not active anywhere**: every provisioned
  cell runs hybrid, so B6's retirements are correct code with no live effect.
  `/health` now reports the real posture (`identity.mode`, `identity.localDoor`,
  `identity.seeded`) so the fleet's state is legible instead of asserted. The
  flip needs the browser handoff (B3 covers the app lane only) — and the rate
  limiting above, because strict makes the plane a single point of failure.
- The bug-report intake's issue body now emits the trusted JSON block **first**
  with the reporter's prose quoted as untrusted underneath. The
  excessive-agency concern about an unattended autofix agent holding push
  credentials on a publishing repo belongs to that feature's own plan, not
  here.
