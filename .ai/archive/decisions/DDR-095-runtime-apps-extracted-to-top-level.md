# DDR-095: Runtime apps extracted out of `plugins/design/` into top-level `apps/`

- **Date:** 2026-06-05
- **Status:** Accepted (implemented — Plan A of the restructure+studio split)
- **Tags:** restructure, monorepo, dev-server, hub, studio, cli, paths, packaging, npm-files, ci, regression-prevention
- **Related:** [DDR-045](./DDR-045-real-disk-path-resolution-for-compiled-dev-server.md) (paths.ts walk-up), [DDR-062](./DDR-062-plugins-reach-executable-logic-via-maude.md) (`maude design <verb>` dispatcher), [DDR-084](./DDR-084-server-binary-resolution-for-dev-tooling-verbs.md) (compiled-binary resolution), [DDR-009](./DDR-009-bun-runtime-authoritative-for-dev-server.md) (Bun runtime + per-platform binaries), [DDR-001](./DDR-001-monorepo-single-publisher.md) (single npm publisher), [DDR-044](./DDR-044-marketplace-install-vs-npm-install-artifact-strategy.md) (npm vs marketplace artifact strategy), [DDR-025](./DDR-025-canvas-lib-single-source-in-dev-server.md) (canvas-lib single source). Plan: [`feature-runtime-restructure-apps-packages.md`](../plans/feature-runtime-restructure-apps-packages.md). Plan B (maude-DS UI rewrite) builds on the stable tree this produces.

## Context

The two runtime products — the canvas-browser **dev-server** (`@maude/dev-server`)
and the collab **hub** (`@maude/hub`) — physically lived under `plugins/design/`,
mixed with the Claude Code *plugin surface* (markdown commands / agents / skills /
hooks / templates). The package boundaries already existed (both are pnpm workspace
members); only the **directory location** conflated "plugin" (distributed via the
marketplace clone) with "runtime app" (distributed via npm + Docker). The incoming
`apps/desktop/` Tauri shell (phase-26) would have sat at top level while the
dev-server it wraps stayed buried — asymmetric. 251 path references made the
location a load-bearing constant scattered across code, docs, and CI.

## Decision

Move each runtime directory to a top-level `apps/` home, leaving `plugins/design/`
to hold **only** the plugin surface:

- `plugins/design/dev-server/` → **`apps/studio/`**
- `plugins/design/hub/` → **`apps/hub/`**

No behavior, UI, or API change. Whatever shipped before ships identically after.
Executed as a content-free `git mv` (one commit, clean R100 renames so
`git log --follow apps/studio/server.ts` preserves history) followed by a separate
reference-repoint commit.

### The CLI invariant (answers "studio je furt pustitelné přes CLI?")

`maude design serve` and every `maude design <verb>` behave **byte-for-byte
identically**. The CLI never hardcodes the *concept* of a plugin path — it resolves
from `pkgRoot` + a relative segment. Moving the directory works because we moved the
segment constants with it. The finite set of resolution sites repointed:

| Site | Old | New |
| ---- | --- | --- |
| `runServe` TS/MJS entry (`cli/commands/design.mjs`) | `plugins/design/dev-server/server.{ts,mjs}` | `apps/studio/server.{ts,mjs}` |
| `runBinDispatch` helper path | `plugins/design/dev-server/bin/<verb>.sh` | `apps/studio/bin/<verb>.sh` |
| `checkDevDeps` resolve paths | `…/dev-server` | `apps/studio` |
| `scenario-report` generator | `…/dev-server/bin/scenario-report.mjs` | `apps/studio/bin/scenario-report.mjs` |
| hub server entry (`cli/commands/hub.mjs` `findHubRoot`) | `plugins/design/hub` | `apps/hub` |
| `paths.ts` walk-up anchor | nested `plugins/design/dev-server` | nested `apps/studio` |
| npm shipping surface (`package.json` `files[]`) | `plugins/design/dev-server` | `apps/studio` |

`CLAUDE_PLUGIN_ROOT` stays the design *plugin* dir (`plugins/design`) — its true
meaning, still 2 levels under `pkgRoot` so the bin helpers' `$PLUGIN_ROOT/../../cli`
side-channel and `$PLUGIN_ROOT/../..` pkg-root math keep resolving. The helpers'
fallback `PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$SCRIPT_DIR/.." && pwd)}"` was
re-anchored from `$SCRIPT_DIR/../..` (old `…/dev-server/bin` → `plugins/design`) to
`$SCRIPT_DIR/..` (new `apps/studio/bin` → `apps/studio`, also 2-deep) so a direct
`bash server-up.sh` works too. The dev-server tree itself is always `$SCRIPT_DIR/..`.

### New `maude studio` alias

Added a top-level **`maude studio`** as a synonym for `maude design serve` — the verb
now matches the `apps/studio` home. It is an explicit alias arm in `cli/bin/maude.mjs`
(checked before the unknown-command branch, NOT a `COMMANDS` entry), prepending
`serve`. `maude design serve` keeps working unchanged (alias, not replacement), so no
existing docs/scripts/muscle-memory break. Documented in `maude help`, the `maude
design` usage block, and `site/content/docs/cli.mdx`; covered by a boot-parity test.

### Depth-sensitive path fixes (the real surface area)

The dir went from **3 levels deep** (`plugins/design/dev-server`) to **2**
(`apps/studio`). Every relative `../` walk anchored to the old depth had to change.
These are NOT literal-string references — they were invisible to a `grep
"plugins/design/dev-server"` sweep and only surfaced under live `serve` + the test
suite. Recorded here so the next mover knows to look for them:

- **Templates stayed under the plugin** (`plugins/design/templates/`). The dev-server
  reached them via `../templates` (1-up). Now `../../plugins/design/templates`:
  - `apps/studio/http.ts` `TEMPLATES_DIR` (loads `_shell.html` at runtime)
  - `apps/studio/canvas-create.ts` `import … '…/brief-board.tsx.template'` (build-time text import)
- **Plugin manifest** (`plugins/design/.claude-plugin/plugin.json`) read via `../`:
  now `../../plugins/design/.claude-plugin/plugin.json` in `build.ts` `readPluginVersion`
  + `whats-new.ts` `resolveMaudeVersion`.
- **Repo-root walks**: `build.ts` oxc-parser lookup `../../../node_modules` → `../../`;
  `test/phase-3.6-smoke.test.ts` `REPO_ROOT` `../../../..` → `../../..`.
- **`.gitignore`** had path-specific `plugins/design/dev-server/dist/*` + `bun.lock`
  patterns (no `*.md/json` extension, so invisible to the inventory grep) — repointed,
  else the compiled binaries + `bun.lock` would have stopped being ignored.
- **`biome.jsonc`** lint-scope: the studio's `dist/` was covered by `!**/plugins/**/dist`;
  added `!**/apps/**/dist` so the committed minified bundles aren't linted (7820 false
  "errors" before the fix).

### Marketplace-cache finding (Task 4 gotcha resolved)

The marketplace clone ships **only** the plugin markdown (`plugins/design/`); the
dev-server ships via **npm** (`package.json` `files`). There is therefore **no
marketplace-cache `dev-server/` anchor** to keep in sync — `paths.ts` resolves the
runtime purely from the npm package layout (binary at `@1agh/maude-<slug>/maude` →
walk up to `@1agh/maude/`, which ships `apps/studio/` via `files`). The pre-move
`paths.ts` comment about a `~/.claude/plugins/cache/…/dev-server/` mode was vestigial;
its comment was corrected, not its logic.

## Consequences

- `plugins/design/` now holds only the plugin surface (commands / agents / skills /
  hooks / templates / docs / CATEGORIES.md / dependencies*.json).
- npm tarball ships `apps/studio/**` (467 files, nested workspace `package.json`
  auto-excluded by npm — `check-tarball-shape.sh` regex widened to `apps/[^/]+`).
  `apps/hub/**` stays OUT (Docker-only); `hub-image.yml` build context is `apps/hub`.
- The hub Dockerfile is context-relative (no `plugins/design/hub` prefix) — only the
  workflow `context:`/`file:` changed.
- Verified green: `pnpm install` (4 members), biome (exit 0), `apps/studio` 1262/1262
  (bun), `apps/hub` 97/97 (node — Bun can't load `better-sqlite3`), `cli` 160/160,
  tsc TS6 = the 3 accepted DDR-026 baseline errors only, `check-runtime-bundles` 13/13,
  live `maude design serve` → `/_health` 200 + `POST /_api/canvas` 201, `maude studio`
  boot-parity.
- **Committed runtime bundles are authoritative (CLAUDE.md).** Booting the source
  dev-server during verification triggered its DDR-044 self-heal, which regenerated
  `dist/runtime/*.js` to env-sensitive dev output — restored to the committed bundles
  before commit. The lesson stands: rebuild `--release` (or `git checkout dist/`) after
  any source boot from this tree.

### Historical-narrative path-reference policy

The ~1314 `.ai/` references are mostly **historical record** (archived plans, closed
DDRs, logs, `STATE.md` History) — a path in a closed DDR/log describes the world AT
THAT TIME, so rewriting it falsifies the record. Only **operative/live** refs were
repointed: `workflows.config.json` `integrations.whatsNew.feed` →
`apps/studio/whats-new.json`, `.ai/docs/**`, `.ai/scenarios/**`, `STATE.md`
active-task pointer, plus all code/build/CI/plugin/site refs. The "no operative
reference remains" bar applies only to that live set; the deliberate keepers are the
two `// was …/dev-server depth` explanatory comments and the
`plugin-cli-reachability` regex (which still bans the legacy form).

### This DDR supersedes (for path only) the live-invariant DDRs

DDR-045, DDR-062, DDR-084, DDR-009, DDR-001 each encode a still-live invariant on the
old `plugins/design/dev-server` path. Their **narrative is left intact** (it was true
when written); **this DDR is the authoritative pointer** that the runtime now lives at
`apps/studio` (and the hub at `apps/hub`). When those DDRs and this one disagree on a
*path*, this one wins; on the *invariant* (e.g. "import from paths.ts, never compute
dirname locally"), they still govern.

## Deferred — `packages/*` extraction (Phase 2, NOT done here)

Extracting shared libs out of `apps/studio/` into `packages/*` so `apps/desktop`
(Tauri) and `apps/studio` can both consume them without reaching into each other:

- `packages/canvas-lib/` ← `canvas-lib.tsx` + resolver (`@maude/canvas-lib`)
- `packages/draw-engine/` ← `draw/` (consumed by `draw-build`/`draw-proof`)
- `packages/exporters/` ← `exporters/` (PNG/PDF/SVG/PPTX/shadcn)

**Why deferred:** each extraction rewrites every internal import + the
`runtime-bundle.ts` externalization list + the npm `files` surface again, multiplying
regression risk for no end-user benefit today. Revisit when `apps/desktop` actually
needs to import these standalone. Explicitly deferred, not silently dropped.
