# Cloud Phase 16 — Server-owned checkout: git into the cell, autocommit server-side

> Closes the open question `workspace-up-deploys-git-less-hub` (kgai, 2026-07-29)
> and implements DDR-192 §1, which every seat flagged as the real hole: today
> autocommit runs only in the CLIENT (`apps/studio/sync/index.ts`), the hub
> image has no git, so a hosted project has no history unless a desktop happens
> to be attached. BREAKER: without this, "GitHub mirror" ships as a false claim.

## Tasks

- [x] T1 — headless **workspace agent** in the cell: subscribes to the cell's own
  hub docs, drives the EXISTING `createAutoCommit` (import the studio module —
  it is runtime-agnostic Node/Bun TS) against the server-side checkout at
  `/data/workspace`. Author = the human who edited (from doc awareness/session),
  committer = the workspace bot — the exact contract the two-machine tests pin.
  → `apps/hub/src/workspace-{files,agent}.mjs` + the `afterStoreDocument` hook.
  Checkout is `MAUDE_REPO_DIR` (`/repo`), not `/data/workspace`: a separate
  volume from the documents, because the two have different recovery stories.
- [x] T2 — git in the hub image too (not only `infra/cell/`), so self-hosted
  `workspace-up` deployments get the same history. Alpine `git` + the agent.
  → plus `ca-certificates`, without which every seed clone failed; plus the
  repo-root build context that lets both images share ONE commit engine.
- [x] T3 — server-side **asset lane**: the cell mirrors incoming assets to its R2
  prefix using the tested `assets-s3.ts` (config from CELL env, closing the
  "client-env-only" gap found 2026-07-29). → `apps/hub/src/asset-lane.mjs`,
  sweeping the checkout on boot (skip-first via HEAD, content-addressed).
- [x] T4 — seed/rehydrate: `MAUDE_SEED_REPO` clone on first boot (the env var
  exists and is rendered; nothing consumes it — same class of bug as
  MAUDE_ADMIN_*; wire it and test that it is CONSUMED).
- [x] T5 — workspace-up verification steps `git-commit`, `s3-object`,
  `s3-no-expiry` become REAL passes against the deployed image.
- [x] T6 — tests: extend `two-machine-workspace.test.mjs` shape to the headless
  agent (edit lands → server commit exists with human author, no client running).

## Acceptance criteria

- [x] A browser-only/phone-only tenant's edits produce append-only server-side
  commits with correct attribution — no desktop required.
  → verified live: a Yjs peer with no studio anywhere produced
  `author: m.dovrtel <m.dovrtel@gmail.com> / committer: Maude Workspace`.
- [x] workspace-up verification: 6+/8 checks execute for real.
  → 6 execute (health, admin-claimed, user-signin, git-commit, s3-object,
  s3-no-expiry); canvas-roundtrip and restore-drill remain honest skips.
- [x] Containment untouched: the agent syncs/commits/stores — it never renders,
  bundles, or evaluates a canvas (CI gate must stay green).

## Decisions to record

- DDR — server-owned git history: the hub commits, one shared engine, the
  Docker context widened to keep it single-source, and the twin-with-drift-test
  pattern for the two studio modules the hub cannot import.

## Retro

- **Everything that mattered was found by RUNNING the image, not by reading it.**
  The unit suite was green and complete before a single container existed; then
  the first real boot crash-looped, the first real clone failed on a missing CA
  bundle, and the first real SIGTERM lost the commit. Three separate
  data-affecting bugs, zero of them visible from the source.
- **The worst bug was a library's default.** Hocuspocus registers its own
  SIGTERM handler that `process.exit(0)`s, racing ours mid-`git commit` and
  leaving every shutdown staged-but-uncommitted. A cell is migrated as the
  normal path, so this would have quietly eaten the last edits of most
  sessions. `stopOnSignals: false` now has its own test, because it is one
  config line that no other test would miss.
- **"Report, don't throw" has to be verified, not asserted.** `start()` was
  written to degrade gracefully and then threw from a `mkdirSync` outside the
  try — taking the whole hub down. The rule was in the comment; it was not in
  the code.
- **A red mark for a normal state trains people to ignore red marks.** A fresh
  workspace has no commits because nobody has edited anything. Reporting that
  as a failure was wrong; it is a skip with instructions.
- **`--dev-minio` rendered a bucket nobody created** — the same
  "looks configured, does nothing" shape as `MAUDE_ADMIN_*` and
  `MAUDE_SEED_REPO`. Third instance in this arc; worth watching for a fourth.

## Follow-ups

- **`infra/cell/Dockerfile` does not build** (pre-existing, found here):
  `better-sqlite3`'s postinstall fails under `oven/bun:1-alpine` — no build
  toolchain, and prebuild-install bails under Bun. The hub image solves this
  with a dedicated node stage; the cell image never had one because it has
  never been built. Belongs to **Phase 15**, which is the first phase that
  needs a running cell.
- `canvas-roundtrip` stays unautomated: it needs a Yjs client, and
  `@hocuspocus/provider` is not a CLI runtime dependency. Revisit if the CLI
  ever gains one for another reason — not worth the dependency on its own.
