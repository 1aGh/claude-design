# Cloud Phase 19 — GitHub mirror: the effects layer

> `mirror.mjs` (validate/argv/classify/status) was tested; nothing called it.

## Tasks

- [x] T1 — GitHub App: installation token minting, short-lived, never stored
  raw. **Minted in the CONTROL PLANE, not the cell** — see DDR-201; the App key
  can mint for every installed repository, so a cell that held it would be a
  credential for every other tenant's GitHub.
- [~] T2 — push from the cell's checkout using `mirrorPushArgs` verbatim
  (imported, not copied). The push path and its guarantees are built and
  tested; the SCHEDULE that calls it is not wired into the cell's runtime.
- [ ] T3 — settings surface (owner-only). A mirror is currently configured by
  writing `projects.mirror_repo` (schema v3).
- [x] T4 — tests: the token never logged or persisted raw; the argv comes from
  the tested builder; a rejected push sets `diverged` and NEVER retries into
  force; an invalid target reaches neither git nor the minting call.

## Acceptance criteria

- [ ] A real workspace history lands in a real GitHub repo the customer owns.
  NOT yet demonstrated end to end — the schedule is unwired.
- [x] A manufactured divergence stops with the "nothing was overwritten"
  message (tested).

## Decisions recorded

- [DDR-201](../archive/decisions/DDR-201-mirror-credential-boundary.md)

## Why this phase is left partial, deliberately

The credential boundary is the part that cannot be fixed later without a key
rotation and a conversation with every customer. It is done and tested. The
schedule and the settings form are mechanical and reversible, and doing them
first would have meant deciding where the key lives by accident.

## Open

- Wire the scheduled push into the cell (alongside the backup schedule) and
  demonstrate a real push end to end.
- Owner-only settings surface for connecting a repository.
- The alligators seed currently uses a hand-minted installation token. Once the
  cell can mint through this boundary, that becomes the same code path.
