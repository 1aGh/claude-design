# DDR-101: Command catalog is a shared `.mjs` single-source with build-time parity assertion

- **Date:** 2026-06-11
- **Status:** Accepted (implemented — `phase-17-docs-site-infographics.md`, Task 6)
- **Tags:** docs-site, command-reference, source-of-truth, build-script, diagrams, drift-guard
- **Related:** [DDR-004](./DDR-004-flow-command-naming-prefix-convention.md) (the `<group>-<verb>` / `category:` frontmatter convention the catalog mirrors). Plan: [`phase-17-docs-site-infographics.md`](../plans/phase-17-docs-site-infographics.md) (Risk #1).

## Context

Phase-17 adds a `CommandTree` docs diagram that renders the `/flow:*` + `/design:*` catalog grouped by category. The same catalog already drives `site/scripts/build-command-reference.mjs`, which generates one MDX page per command + a grouped sidebar `meta.json`. If the diagram hand-authored its own tree while the build script re-parsed frontmatter independently, the two would silently drift (Risk #1). The plan **mandated** wiring both to one source and **explicitly rejected** a `// TODO: wire to build-command-reference` snapshot escape hatch.

Constraint that shaped the solution: the prebuild runs `node scripts/build-command-reference.mjs` with **no TS loader**, so the build script cannot `import` a `.ts` file. The plan's "one consolidated `diagram-data.ts`" therefore can't be the literal single file the node script reads.

## Decision

1. **The command catalog lives in `site/lib/command-catalog.mjs`** — plain ESM (`// @ts-check` + JSDoc types), the one place the per-command `category` + group ordering is declared. Both consumers import it: `build-command-reference.mjs` (node) directly, and `site/lib/diagram-data.ts` (which re-exports it so React components keep a single import surface — the plan's "one consolidated data file" intent is preserved at the component layer). `.mjs` not `.ts` is forced by the node-import constraint, not preference.

2. **`build-command-reference.mjs` asserts catalog ↔ on-disk `.md` parity and fails the build loud on drift.** Before generating, it diffs the catalog's command set against `plugins/<plugin>/commands/*.md`; a command on disk but absent from the catalog (or vice-versa) throws with a remediation message naming `command-catalog.mjs`. The catalog owns STRUCTURE (which commands, what category, group order); each `.md` still owns CONTENT (description / argument-hint / body summary). `isDaily` is derived (`category === 'daily'`) — no separate daily list to drift.

3. **The ENOENT skip is preserved.** When `plugins/` isn't present (Vercel uploads only `site/`), the parity check's `readdir` ENOENT is caught and the plugin is skipped, falling back to the committed reference pages — unchanged from the prior script.

## Consequences

- Adding a command now requires a `command-catalog.mjs` entry **or the build fails** — the drift guard converts a silent-divergence risk into a hard, early, well-messaged error. This is the point.
- Verified faithful: the rewrite regenerated all 46 pages with **byte-identical `meta.json`** vs the prior script (the one intended output change is a richer per-page `(daily)` annotation now that the category drives it, not a stale hardcoded daily list).
- The `.mjs` JSDoc types flow to the `.ts` consumers via `allowJs`; `diagram-data.ts` re-declares the catalog's TS shapes locally (JSDoc `@typedef`s aren't importable as TS types).
- Pattern to reuse: when a node build script and a TS component must share data, put the data in `.mjs` and re-export from `.ts` — don't duplicate, and don't reach for a TS loader in the prebuild.
