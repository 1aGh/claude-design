# Cloud Phase 22 — One account, one dashboard

> Raised by the owner while reviewing Phase 20: a customer with three projects
> has four accounts. `authenticate()` exists twice — once per cell, once in the
> control plane — because a cell is a hub and a hub was originally something one
> person self-hosted. Cloud inherited that shape without deciding on it.
>
> Decided in [DDR-204](../archive/decisions/DDR-204-one-account-one-dashboard-two-authorities.md):
> unify the surface and the identity, keep the authority split.

## Tasks

- [x] T1 — **cloud identity mode** in the hub: when the control plane is
  configured, the cell's own user store is bypassed and sign-in is delegated.
  `users.mjs` is untouched — one code path, two configurations, wired through
  `/auth/login` so it is the real path and not an isolated module.
- [x] T2 — **project access tokens**: `POST /projects/open` decides access
  (`project-access.mjs`, pure and tested over combinations) and mints a
  short-lived, project-scoped token. Interop between the two halves is pinned
  by its own test — they are written in different runtimes against different
  crypto APIs and agree only if somebody checks.
- [x] T3 — the cell validates that token instead of a local password, and
  verification is OFFLINE: the token is signed with a key the cell already
  holds, so an issued token survives a control-plane outage. Only obtaining a
  NEW one needs the control plane. That asymmetry is the whole reason the token
  is signed rather than looked up.
- [x] T4 — **one dashboard** at `cloud.maude.sh`: a signed-in person landing on
  `/` gets their projects, not a marketing page. Each project states what its
  situation MEANS rather than its internal state name, actions are filtered by
  what that person may actually do, and "download everything" is offered in
  every state including the unhappy ones. Server-rendered, no script — this is
  the page somebody opens because something is wrong. Live and verified.
  Per-project detail panels (people, billing, sharing) are linked but not built.
- [x] T5 — membership is a control-plane fact (`project_members`, schema v4),
  roles have one capability table, and the RULES for changing membership are
  decided and tested (`membership.mjs`): only an owner changes access, the
  owner cannot be removed or demoted here (that is a transfer), and a
  DEMOTION revokes as surely as a removal does. The invite/remove HTTP surface
  is built (`project-routes.mjs` + `people-page.mjs`), and the invitation now
  actually REACHES the person: `email.mjs` (Resend, one boundary, never
  throws) dispatches it, and `/invite/<id>` (`invites.mjs`) is the accept
  surface — the invite IS the account (one link signs a new person up and
  lands them in the project); an account created after the invite is routed
  to sign-in; a dead link (spent, expired, revoked, guessed) gets ONE neutral
  sentence. When the email cannot be sent, the owner is handed the link to
  share themselves rather than a failure.

  The honest limit is written into the module rather than discovered later: a
  project token is verified offline so a control-plane outage cannot lock
  anyone out, which means an issued token cannot be recalled. Removal is
  therefore only as fast as the token is short, the confirmation says so in
  hours, and it offers pausing the project as the immediate answer.
- [x] T6 — tests: a cloud-mode cell refuses a local password without touching
  the local store; a self-hosted hub is unaffected; a token survives an outage;
  a token for one project is refused by another; a tampered payload fails on
  the signature rather than the parse; a wrong-length signature is rejected
  rather than thrown. Plus the invite round trip (`invites.test.mjs`): create →
  email dispatched with the link → accept creates account + membership +
  session; a spent/expired/guessed link reads identically; declining the
  disclosure creates nothing. Removal-revocation is bounded by the token TTL
  by design (offline verification) — the confirmation page states it in hours.

## Not a JWT, deliberately

A JWT carries an algorithm field the verifier is then obliged to distrust —
`alg: none` and the RS256→HS256 confusion are both real classes of bug — and we
control both ends. One algorithm, no negotiation, nothing to downgrade.

## Acceptance criteria

- [x] A customer signs in ONCE and sees every project they have — `/` is the
  dashboard, live at cloud.maude.sh.
- [x] A self-hoster's experience is unchanged — same `/admin`, same users
  (cloud-identity mode is config-gated; tested off).
- [x] A cell serves its project with the control plane unreachable — offline
  token verification, tested.

## Retro (2026-07-30)

- The interop test between the two token halves earned its keep immediately —
  it caught the `btoa` non-ASCII crash before any Czech-named customer did.
- The invite-is-the-account shape removed a whole onboarding cliff for free;
  worth reusing for the platform-level `account_invites` (Phase 6) if that
  surface ever revives.
- Deliberately NOT built: notifying an existing account it was added directly
  (silent add). If that turns out to matter, it belongs in `email.mjs` as a
  second template, not as a second sending path.

## Supersedes in practice

The alligators pilot's per-cell derived password (DDR-199 §6). It keeps working
until this lands; it is not the shape of the product.
