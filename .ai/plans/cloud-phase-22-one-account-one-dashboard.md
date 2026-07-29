# Cloud Phase 22 — One account, one dashboard

> Raised by the owner while reviewing Phase 20: a customer with three projects
> has four accounts. `authenticate()` exists twice — once per cell, once in the
> control plane — because a cell is a hub and a hub was originally something one
> person self-hosted. Cloud inherited that shape without deciding on it.
>
> Decided in [DDR-204](../archive/decisions/DDR-204-one-account-one-dashboard-two-authorities.md):
> unify the surface and the identity, keep the authority split.

## Tasks

- [ ] T1 — **cloud identity mode** in the hub: when the control plane is
  configured, the cell's own user store is bypassed and sign-in is delegated.
  `users.mjs` stays intact for self-hosted hubs — one code path, two
  configurations, not two code paths.
- [ ] T2 — **project access tokens**: the control plane mints a short-lived,
  project-scoped token after checking membership. Same ask-don't-hold shape as
  the mirror credential (DDR-201), which is already built and tested.
- [ ] T3 — the cell validates that token instead of a local password. An
  ALREADY-ESTABLISHED session must keep working while the control plane is
  unreachable — a control-plane outage must never mean nobody can reach their
  own designs.
- [ ] T4 — **one dashboard** at `cloud.maude.sh`: projects, members, billing,
  activity. Per-project detail fetched from the cell, so the customer never
  types a second URL and never learns that a "cell" exists.
- [ ] T5 — membership becomes control-plane-owned; removing a member revokes
  live sessions (which a per-cell user store made awkward).
- [ ] T6 — tests: a cloud-mode cell refuses a local password; a self-hosted hub
  is byte-for-byte unaffected; an established session survives a control-plane
  outage; removal actually ends a live session.

## Acceptance criteria

- [ ] A customer signs in ONCE and sees every project they have.
- [ ] A self-hoster's experience is unchanged — same `/admin`, same users.
- [ ] A cell serves its project with the control plane unreachable.

## Supersedes in practice

The alligators pilot's per-cell derived password (DDR-199 §6). It keeps working
until this lands; it is not the shape of the product.
