# Cloud Phase 19 — GitHub mirror: the effects layer

> `mirror.mjs` (validate/argv/classify/status) is tested; nothing calls it.
> Depends on Phase 16 — a mirror without the server-owned checkout would have
> nothing truthful to push for browser-only tenants (BREAKER). Owner-only
> developer setting, structurally invisible to non-git members (USER-ADVOCATE).

## Tasks

- [ ] T1 — GitHub App ("Maude Mirror"): installation per target repo, contents:write
  only. Installation token minting in the cell (short-lived, never stored raw).
- [ ] T2 — scheduled push from the cell's checkout using `mirrorPushArgs` verbatim
  (the no-force assertion already exists; the live path must import, not copy).
- [ ] T3 — settings surface (owner-only): connect repo (`owner/name` — the
  validated form), branch (default `maude-workspace`), status row driven by
  `mirrorStatus` (diverged/unauthorized/missing get their exact tested sentences).
- [ ] T4 — tests: token never logged/persisted raw; push argv byte-equal to the
  tested builder; a rejected push sets `diverged` and NEVER retries into force.

## Acceptance criteria

- [ ] A real workspace history lands in a real GitHub repo the customer owns;
  a manufactured divergence stops with the "nothing was overwritten" message.
- [ ] Local half (App auth + push from a local checkout) is buildable NOW with
  the authenticated `gh`; the in-cell schedule gates on Phases 11/15/16.
