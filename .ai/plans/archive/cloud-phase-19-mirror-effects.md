# Cloud Phase 19 — GitHub mirror: the effects layer

> `mirror.mjs` (validate/argv/classify/status) was tested; nothing called it.

## Tasks

- [x] T1 — GitHub App: installation token minting, short-lived, never stored
  raw. **Minted in the CONTROL PLANE, not the cell** — see DDR-201; the App key
  can mint for every installed repository, so a cell that held it would be a
  credential for every other tenant's GitHub.
- [x] T2 — push from the cell's checkout using `mirrorPushArgs` verbatim
  (imported, not copied). The SCHEDULE is wired (`cell-ops.mjs
  scheduleMirror`, armed by `startWorkspaceAgent`, cell image v7): a first
  tick ~90 s after boot, then hourly. The cell holds no mirror CONFIG either —
  each tick asks `GET /internal/mirror-config` with its derived secret, so
  connecting a repository needs no restart. A cell with no control plane
  (self-hosted) never ticks; a tick during a control-plane outage reads as
  "no mirror" and goes back to sleep.
- [x] T3 — settings surface (owner-only): `/projects/<id>/mirror` on the
  dashboard ("GitHub copy"), validated by the tested `mirror.mjs` grammar,
  saved to `projects.mirror_repo`/`mirror_branch` where the tick reads it.
  Built in the Phase 20 batch (project-admin.mjs).
- [x] T4 — tests: the token never logged or persisted raw; the argv comes from
  the tested builder; a rejected push sets `diverged` and NEVER retries into
  force; an invalid target reaches neither git nor the minting call.

## Acceptance criteria

- [x] A real workspace history lands in a real GitHub repo the customer owns.
  **Demonstrated live 2026-07-30:** the alligators cell's first tick minted a
  scoped token through `/internal/mirror-token` and pushed the full history to
  `1aGh/alligators-mirror` — 24 commits, HEAD matching the workspace
  (`feat(phase-7): integration & usage guide`), via the exact production code
  path (config read from the control plane, token never stored, argv from the
  tested builder).
- [x] A manufactured divergence stops with the "nothing was overwritten"
  message (tested).

## Decisions recorded

- [DDR-201](../archive/decisions/DDR-201-mirror-credential-boundary.md)

## Why this phase is left partial, deliberately

The credential boundary is the part that cannot be fixed later without a key
rotation and a conversation with every customer. It is done and tested. The
schedule and the settings form are mechanical and reversible, and doing them
first would have meant deciding where the key lives by accident.

## Retro (2026-07-30)

- The "cell holds no config" shape paid off immediately: connecting the
  mirror was one dashboard form + one D1 row, and the very next tick pushed —
  no restart, no env change, no image roll.
- The settings surface rode along in the Phase 20 admin batch
  (project-admin.mjs) — the two phases' remainders were one deploy.
- Left open (tracked in kg, not in this plan): the alligators cell showed
  short-uptime restarts around heavy git operations (export bundle, first
  mirror push) on `standard-1` — the push landed anyway, but the instance
  sizing / OOM question deserves its own look before more tenants join.
