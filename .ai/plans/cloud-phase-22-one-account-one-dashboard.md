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
- [ ] T2 — **project access tokens**: the control plane mints a short-lived,
  project-scoped token after checking membership. Same ask-don't-hold shape as
  the mirror credential (DDR-201), which is already built and tested.
- [x] T3 — the cell validates that token instead of a local password, and
  verification is OFFLINE: the token is signed with a key the cell already
  holds, so an issued token survives a control-plane outage. Only obtaining a
  NEW one needs the control plane. That asymmetry is the whole reason the token
  is signed rather than looked up.
- [ ] T4 — **one dashboard** at `cloud.maude.sh`: projects, members, billing,
  activity. Per-project detail fetched from the cell, so the customer never
  types a second URL and never learns that a "cell" exists.
- [ ] T5 — membership becomes control-plane-owned; removing a member revokes
  live sessions (which a per-cell user store made awkward).
- [~] T6 — tests: a cloud-mode cell refuses a local password without touching
  the local store; a self-hosted hub is unaffected; a token survives an outage;
  a token for one project is refused by another; a tampered payload fails on
  the signature rather than the parse; a wrong-length signature is rejected
  rather than thrown. Session-revocation-on-removal waits on T5.

## Not a JWT, deliberately

A JWT carries an algorithm field the verifier is then obliged to distrust —
`alg: none` and the RS256→HS256 confusion are both real classes of bug — and we
control both ends. One algorithm, no negotiation, nothing to downgrade.

## Acceptance criteria

- [ ] A customer signs in ONCE and sees every project they have.
- [ ] A self-hoster's experience is unchanged — same `/admin`, same users.
- [ ] A cell serves its project with the control plane unreachable.

## Supersedes in practice

The alligators pilot's per-cell derived password (DDR-199 §6). It keeps working
until this lands; it is not the shape of the product.
