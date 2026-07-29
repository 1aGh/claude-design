# Cloud Phase 16 — Server-owned checkout: git into the cell, autocommit server-side

> Closes the open question `workspace-up-deploys-git-less-hub` (kgai, 2026-07-29)
> and implements DDR-192 §1, which every seat flagged as the real hole: today
> autocommit runs only in the CLIENT (`apps/studio/sync/index.ts`), the hub
> image has no git, so a hosted project has no history unless a desktop happens
> to be attached. BREAKER: without this, "GitHub mirror" ships as a false claim.

## Tasks

- [ ] T1 — headless **workspace agent** in the cell: subscribes to the cell's own
  hub docs, drives the EXISTING `createAutoCommit` (import the studio module —
  it is runtime-agnostic Node/Bun TS) against the server-side checkout at
  `/data/workspace`. Author = the human who edited (from doc awareness/session),
  committer = the workspace bot — the exact contract the two-machine tests pin.
- [ ] T2 — git in the hub image too (not only `infra/cell/`), so self-hosted
  `workspace-up` deployments get the same history. Alpine `git` + the agent.
- [ ] T3 — server-side **asset lane**: the cell mirrors incoming assets to its R2
  prefix using the tested `assets-s3.ts` (config from CELL env, closing the
  "client-env-only" gap found 2026-07-29).
- [ ] T4 — seed/rehydrate: `MAUDE_SEED_REPO` clone on first boot (the env var
  exists and is rendered; nothing consumes it — same class of bug as
  MAUDE_ADMIN_*; wire it and test that it is CONSUMED).
- [ ] T5 — workspace-up verification steps `git-commit`, `s3-object`,
  `s3-no-expiry` become REAL passes against the deployed image.
- [ ] T6 — tests: extend `two-machine-workspace.test.mjs` shape to the headless
  agent (edit lands → server commit exists with human author, no client running).

## Acceptance criteria

- [ ] A browser-only/phone-only tenant's edits produce append-only server-side
  commits with correct attribution — no desktop required.
- [ ] workspace-up verification: 6+/8 checks execute for real.
- [ ] Containment untouched: the agent syncs/commits/stores — it never renders,
  bundles, or evaluates a canvas (CI gate must stay green).
