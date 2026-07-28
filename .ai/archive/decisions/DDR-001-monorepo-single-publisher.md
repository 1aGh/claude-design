# DDR-001: Monorepo with a single npm publisher

> **Path update — [DDR-095](DDR-095-runtime-apps-extracted-to-top-level.md) (2026-06-05):** the dev-server now lives at `apps/studio/` (hub at `apps/hub/`), moved out of `plugins/design/`. This DDR's invariants still govern; only the path changed. Old `plugins/design/dev-server` references below are historical.

- **Date:** 2026-05-12
- **Status:** Accepted
- **Tags:** infra, monorepo, packaging, npm, pnpm
- **Related:** `.ai/plans/phase-1-contribute-infra-changesets.md` (Task 0), `package.json`, `pnpm-workspace.yaml`, `scripts/check-tarball-shape.sh`

## Context

Phase 2 (Fumadocs site) and Phase 4 (Pixi-based dev-server bundler) both need build-time dependencies in dedicated workspaces (Next.js for the docs site, esbuild + Pixi for the dev-server bundler). Without a workspace layout, every phase that needs heavyweight dev deps would either:

- Pollute the root `package.json` and risk those deps leaking into the published npm tarball, **or**
- Force a monorepo refactor mid-roadmap.

Doing the layout once, in Phase 1, means the rest of the roadmap can land cleanly.

## Decision

Adopt **pnpm workspaces** with the following invariant:

- The **root** (`@1agh/md-claude`) is the **sole npm publisher**. It carries the CLI, the design dev-server entry point (`plugins/design/dev-server/server.mjs` today; bundled `dist/server.bundle.mjs` from Phase 4), the flow plugin templates, and the flow config schema. The `files` whitelist in `package.json` enumerates exactly what ships — nothing else.
- **All other workspaces are `"private": true`** and never publish:
  - `site/` — Phase 2 docs site (Fumadocs / Next.js).
  - `plugins/design/dev-server/` — dev-server source + browser client. Only the bundled `dist/` makes it into the npm tarball; the workspace's own `package.json` does not.
  - `plugins/design/hub/` — reserved for Phase 9 (federated hub, v1.1). Empty stub so we don't restructure twice.
- The root package is listed in `pnpm-workspace.yaml` as `"."` so Changesets can resolve it as a workspace member (it is otherwise the only package Changesets cares about — every workspace `private: true` is silently ignored at publish time).
- `scripts/check-tarball-shape.sh` enforces the invariant in CI: the npm tarball must contain **zero** workspace `package.json` files and **zero** `node_modules/` entries. If a future change accidentally widens the published surface, this check fails loudly.

## Consequences

**Good:**

- One npm package, one version, one changelog — end users keep the simple install story (`npm i -g @1agh/md-claude`).
- Heavyweight dev deps (Next.js, Pixi, esbuild, Playwright) live in the workspace that uses them and never bloat the published tarball.
- Phase 2, 4, 9 land without touching the root layout again.
- Standard pnpm workspace tooling (`pnpm -r`, `pnpm --filter`, IDE support) just works.

**Trade-offs:**

- pnpm workspace knowledge is now part of the on-ramp for contributors. Documented in `CONTRIBUTING.md` (Repo layout) and `README.md` (Workspaces).
- The "root in workspaces list" pattern is a little non-idiomatic for pnpm — flagged with a comment in `pnpm-workspace.yaml`. The alternative (making changesets ignore workspaces) is messier.
- Listing every workspace in `files` whitelist is verbose; relying on the tarball-shape script is the safety net.

## Alternatives considered

- **Stay single-package, install dev deps at root.** Rejected: would pull Pixi, esbuild, Next.js into the root `node_modules` tree, risking accidental publish via dependency graph mistakes. The `files` whitelist mitigates but doesn't eliminate the surface.
- **Separate repos for site, dev-server, hub.** Rejected: cross-cutting changes (e.g. dev-server contract that the docs site documents) would need coordinated multi-repo PRs. md-claude is small enough that one repo is the right granularity.
- **Yarn / npm workspaces instead of pnpm.** Rejected: pnpm is the de-facto standard for fast, strict-deps workspaces; `package.json` already declared `"packageManager": "pnpm@..."`.
