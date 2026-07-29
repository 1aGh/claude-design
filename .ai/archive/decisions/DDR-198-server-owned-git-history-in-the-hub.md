# DDR-198 — Server-owned git history: the hub commits, and does it with the desktop's engine

- **Date:** 2026-07-29
- **Status:** accepted
- **Scope:** `repo:maude`, `dept:dev`
- **Implements:** [DDR-192](./DDR-192-cloud-vendor-boundary-and-tenant-isolation.md) §1 · [DDR-195](./DDR-195-workspace-cell-enforcement-assets-and-autosave-history.md) §3
- **Preserves:** [DDR-193](./DDR-193-containment-and-the-browser-surface.md) §2 (containment)
- **Plan:** `.ai/plans/archive/cloud-phase-16-server-owned-checkout.md`

## Context

Autosave-to-git ran only in the **client** (`apps/studio/sync/index.ts`). A
project opened from a phone, from a browser, or simply with no desktop attached
therefore kept **no history at all** — its only record was its current bytes,
one bad sync away from unrecoverable. Downstream, "mirror your workspace to
GitHub" (Phase 19) would have been a claim with nothing behind it: there was no
truthful history to push.

The hub image had no `git` binary, and `MAUDE_REPO_DIR` / `MAUDE_SEED_REPO`
were rendered into every deployment and read by nothing — the same
"looks configured, does nothing" shape as `MAUDE_ADMIN_*` before Phase 11.

## Decision

**1. The server commits.** A headless workspace agent (`apps/hub/src/workspace-agent.mjs`)
subscribes to the hub's own `afterStoreDocument`, projects each document onto a
checkout at `MAUDE_REPO_DIR`, and commits. Workspace mode only: a laptop hub
sits beside a developer who owns their own git, and a second committer writing
into their working tree would be a hostile surprise.

**2. One commit engine, not two.** The agent drives the *existing*
`createAutoCommit` from `apps/studio/sync/autocommit.ts` — same append-only
rule, same author≠committer contract, same quiescence batching — so a
server-made commit and a desktop-made commit are indistinguishable in the log.

To keep that single source, **`apps/hub`'s Docker build context widened to the
repo root** (`docker build -f apps/hub/Dockerfile .`). The bundler stage runs
Bun, which strips the TS at build time, so the Node runtime stage never sees
it. Rejected: a second copy of the rules that decide what git does. Those rules
are where "history is never rewritten" lives; two copies is how one of them
stops being true.

**3. Twins are allowed only with a drift test.** Two studio modules the hub
genuinely cannot import — the Y-type names and `mergeSharedMetaIntoLocal` —
exist as plain-JS twins (`workspace-files.mjs`, `meta-merge.mjs`), because
pulling `codec.ts` in would drag the studio's Context/collab graph into a
container whose whole posture is "it does not contain the things that render
tenant TSX". Each twin has a test that imports the REAL studio source and
asserts byte-equal output. **A twin is defensible only while it is provably
identical.**

**4. The working tree is the authority on paths.** A document name carries only
a lossy slug (`ui/Foo.tsx` → `ui-foo`), so the doc alone cannot say where a
canvas belongs. The agent indexes the checkout. An unknown slug lands **flat**
under the design root rather than in an invented directory — a flat file is
trivially moved by a desktop peer that knows the real path; a wrong directory
tree is not.

**5. Shutdown belongs to us.** `stopOnSignals: false` on the Hocuspocus server.
Its built-in handler calls `process.exit(0)`, which raced our flush and left
every shutdown **staged but not committed**. A cell is migrated mid-session as
the normal path, so this silently ate the last edits of most sessions.

**6. Assets are swept from the checkout, not uploaded to the hub.** The read
proxy has always existed; the write side was client-env-only. The cell is a
peer that *has* the bytes and *has* the credentials, so it mirrors
content-addressed assets into R2 on boot (HEAD-first, skip-if-present).
Rejected: making the hub an upload endpoint — that is an authenticated
disk-fill surface, and R2 bills for what lands in it.

## Containment

Untouched, and this is load-bearing. The agent moves a string from a Y.Text to
a file and runs `git`. It never imports, bundles, or evaluates a canvas, and
nothing it spawns could. The CI gate (`scripts/check-containment.sh`) stays
green.

## Consequences

- `MAUDE_SEED_REPO` is consumed and tested-as-consumed. A **failed** clone now
  removes the partial `.git`, because the "already initialized" guard otherwise
  turned one network failure into a permanently, silently empty workspace.
- `workspace-up` verification went from 2 real checks to 6 of 8.
- A root `.dockerignore` now exists — the widened context made
  `apps/hub/.dockerignore` inert, and the first build copied a stale local
  `node_modules` over a freshly-installed one.
- The hub image gained `git` **and** `ca-certificates`. Node carries its own CA
  bundle, so omitting the latter looked harmless while breaking every git clone.

## What we would do differently

Every bug that mattered here was found by running the image, not by reading it:
a crash-loop on a root-owned volume, a clone dying on a missing CA bundle, and
a commit lost to a library's default signal handler. The unit suite was green
and complete before the first container existed. **For anything that ships as
an image, "the tests pass" is the beginning of verification, not the end.**
