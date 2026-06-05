# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

`Maude` — a Claude Code marketplace (defined by `.claude-plugin/marketplace.json`) shipping two plugins plus an npm-published CLI. Project was renamed from `md-claude` in v0.15.0; see [`docs/MIGRATING-MD-CLAUDE-TO-MAUDE.md`](docs/MIGRATING-MD-CLAUDE-TO-MAUDE.md).

- **`plugins/design`** — canvas-first iteration on TSX/JSX mocks under a project's `<designRoot>` (default `.design/`). Includes a zero-dep Node dev server (`apps/studio/server.mjs`) that injects an inspector overlay for Cmd+Click element selection and tracks active-canvas state over WebSocket.
- **`plugins/flow`** — generic agentic workflow loop with a second-brain `.ai/` workspace. Project-agnostic via `<project>` placeholders + per-repo `.ai/workflows.config.json` (schema at `plugins/flow/.claude-plugin/config.schema.json`).
- **`cli/`** — `maude` CLI (entry `cli/bin/maude.mjs`, subcommands in `cli/commands/`). Published as `@1agh/maude` on npm. Bins: `maude` (primary), `mdcc` (legacy alias — prints deprecation warning, drop in v0.17.x), `maude-safe`/`mdcc-safe` (per-call platform-detection fallback), `claude-design-server` (direct dev-server alias).

The npm package, the design plugin, and the flow plugin all share a single version — `package.json`, `plugins/design/.claude-plugin/plugin.json`, and `plugins/flow/.claude-plugin/plugin.json` must move together. CI enforces parity (`.github/workflows/version-parity.yml`).

## Common commands

```sh
# Run dev server against a target project (NOT this repo unless you're testing the server itself)
npm run start                          # serves $CLAUDE_PROJECT_DIR or cwd; needs a .design/ there
npm run dev                            # same, explicit port 4399
node apps/studio/server.mjs --root /path/to/target-repo

# CLI (after `npm i -g @1agh/maude` OR `npm run maude -- <args>` locally)
maude init [--name <project>] [--force] [--dry-run]    # scaffold .ai/ from plugins/flow/templates/ai-skeleton
maude config show | get <dotted.key> | set <key> <val>  # edits .ai/workflows.config.json
maude design serve [--port N] [--root <path>]          # boots the design dev server
# Legacy `mdcc <cmd>` still works (prints a deprecation warning) until v0.17.x.

# Version + release
scripts/bump-version.sh patch|minor|major|X.Y.Z       # bumps package.json + both plugin.json files
scripts/check-version-parity.sh                       # asserts all three match (run in CI too)
```

There is **no test suite, lint config, or build step** in this repo — the plugins are pure markdown commands/skills/agents plus a zero-dep Node server. Don't invent a `test` script. If you need to verify a CLI change, run `node cli/bin/maude.mjs <cmd>` directly.

## Architecture

### Marketplace layout

`.claude-plugin/marketplace.json` is the entry point Claude Code reads when a user runs `/plugin marketplace add 1aGh/maude`. It lists the two plugins and their source paths. Each plugin has its own `.claude-plugin/plugin.json` manifest plus `commands/`, `agents/`, and `skills/` directories — these are surfaced as slash commands, subagents, and auto-loaded skills inside Claude Code.

### Dev server runtime contract (`apps/studio/server.mjs`)

> **Runtime migration ahead — [DDR-009](.ai/decisions/DDR-009-bun-runtime-authoritative-for-dev-server.md) (2026-05-15):** Phase 3.4 ([`.ai/plans/archive/phase-3.4-architecture-refactor.md`](.ai/plans/archive/phase-3.4-architecture-refactor.md)) migrates this server to **Bun authoritatively** (`Bun.serve` + `Bun.file` + `Bun.write` + `Bun.spawn` + `bun:test`), distributed as per-platform `bun --compile` standalone binaries via npm `optionalDependencies` sub-packages (mirroring `@anthropic-ai/claude-code`). No Node fallback. **When writing new dev-server code, reach for `Bun.*` APIs instead of `node:http` / `node:fs.readFile` / `node:child_process.spawn`** — `node:path` and `node:url` stay (Bun supports them identically). Tests under `apps/studio/` use `bun:test`, not `node --test` (the `cli/` shim stays Node). The description below documents the current pre-migration state; update it once Task 7 of Phase 3.4 lands.

The server is zero-dep (`node:http` + `node:crypto` for WS handshake) and resolves the **target repo root** in this order: `--root <path>` arg → `$CLAUDE_PROJECT_DIR` → `process.cwd()`. It deliberately never uses `__dirname` for the project root, because the plugin can be installed centrally (npm global) and serve any repo.

**Path resolution rule ([DDR-045](.ai/decisions/DDR-045-real-disk-path-resolution-for-compiled-dev-server.md)):** every dev-server module that needs a filesystem-relative path MUST import from `apps/studio/paths.ts` (`DEV_SERVER_ROOT`, `DIST_DIR`, `CLIENT_DIR`, `RUNTIME_BUNDLES_DIR`). NEVER compute `dirname(fileURLToPath(import.meta.url))` locally — inside `bun --compile` standalone binaries that resolves to the virtual `/$bunfs/root` and every `existsSync` against it silently returns false. Two production releases (v0.18.0 and v0.18.1) shipped broken because of this bug; the lesson is in DDR-045.

It writes three runtime files into `<designRoot>/` that the orchestrator (`/design` slash command) relies on:

| File | Role |
| ---- | ---- |
| `_server.json` | `{ pid, port, url, started }` — orchestrator uses this to detect a live instance instead of starting a duplicate. |
| `_active.json` | `{ active, open_tabs, selected, last_change }` — the injected inspector pushes the user's currently-selected element here over WebSocket so `/design:edit "<feedback>"` can scope edits. |
| `_history/<slug>/` | Auto-snapshot stack per canvas, consumed by `/design:rollback`. |

These files are user-facing runtime state — when changing the server, keep the schemas backwards-compatible or update both producer and the consuming commands (`plugins/design/commands/*.md`) in the same change.

**Canvas-origin routes live in TWO allowlists — keep them in sync.** A route reachable from the (untrusted, DDR-054) canvas iframe must be added to BOTH `CANVAS_SAFE_API` (`http.ts`, gates the `fetch` fall-through) AND the `startCanvasServer` `routes` map (`server.ts`). Bun matches `routes` before `fetch`, so listing it only in `CANVAS_SAFE_API` makes the route **404 from the canvas origin** (the bug that bit Phase 23's `/_api/asset`). Guard it with a `GET → 405` assertion in `test/canvas-origin-gate.test.ts`. Conversely, a privileged route (file-write, export, `/_config`) must be in NEITHER. See [DDR-088](.ai/decisions/DDR-088-canvas-media-vocabulary-and-asset-write-surface.md).

The server fails loud if launched from a directory without `.design/` rather than serving an empty UI — preserve this behaviour, it's load-bearing for debugging "wrong project root" cases.

The shared canvas library (`DesignCanvas`, `DCSection`, `DCArtboard`, helpers, hooks) lives at **`apps/studio/canvas-lib.tsx`** — single source, ships with the dev-server install. Canvases import it via the virtual specifier `@maude/canvas-lib`, which the dev-server's Bun.build plugin resolves to that file. (Pre-v0.15.0 canvases used `@mdcc/canvas-lib` — the legacy specifier is no longer supported; update existing canvas imports if you upgrade from before the rename.) Edit there; the http-layer file-watcher broadcasts a hard reload to every open canvas iframe on change. Per [DDR-025](.ai/decisions/DDR-025-canvas-lib-single-source-in-dev-server.md), there is no project-side copy — downstream projects that still carry a legacy `<designRoot>/_lib/canvas-lib.tsx` get a one-shot deprecation warning at boot and the file is ignored.

The **draw geometry engine** (`apps/studio/draw/`) is the "draw as code" layer behind `/design:draw` + `draw-agent` ([DDR-070](.ai/decisions/DDR-070-svg-generation-geometry-engine.md)): pure-TS `primitives` → `geometry` (PCHIP splines / A* connector routing / optical corrections) → `palette` (WCAG + OKLCH) → `layout` (`diagram()`, label solver) → `serialize` (one node tree → SVG string **and** JSX, the DDR-067 single-source invariant) → `optimize` (SVGO — the one new dep, [DDR-071](.ai/decisions/DDR-071-svgo-dependency.md)). React-free root (DDR-067); disk paths via `paths.ts` (DDR-045); reached at runtime through the `draw-build` / `draw-proof` / `svg-optimize` verbs. The `DrawProof` canvas-lib export renders a mark across the 16/24/48/256 × {light, dark, single-color flatten} verify ladder.

### Dev-server helpers (`apps/studio/bin/`)

> **Invoked via `maude design <verb>`, never a raw bin path ([DDR-062](.ai/decisions/DDR-062-plugins-reach-executable-logic-via-maude.md)).** Plugin markdown calls `maude design screenshot` / `server-up` / `prep` / `slug` / `bootstrap-check` / `runtime-health` / `smoke` / `canvas-edit` / `handoff` / `asset-sweep` / `visual-sanity` / `draw-build` / `draw-proof` / `svg-optimize` — the on-PATH `maude` binary dispatches to the bundled `.sh` of the same name, resolving it from maude's own package root and setting `CLAUDE_PLUGIN_ROOT` authoritatively for the child (stdout/stderr/exit-code pass straight through, so `$(…)` capture + non-zero gating are preserved). The scripts below are still the single source of truth; the table's "Callers" column lists the slash commands, which reach them through `maude design <verb>`. `cli/lib/plugin-cli-reachability.test.mjs` bans direct `bash "$CLAUDE_PLUGIN_ROOT/dev-server/bin/*.sh"` invocations in plugin markdown. (`check-runtime-bundles.sh` + `_*-playwright.mjs` stay direct — CI / internal-only, not on the whitelist.)

Single source of truth for the bash recipes that used to be duplicated across `/design:new`, `/design:edit`, `/design:screenshot`, `/design:setup-ds`, and every critic agent:

| Helper | Purpose | Callers |
| ------ | ------- | ------- |
| `screenshot.sh` | Capture screenshots — `--full` / `--screen <id>` / `--element <id>` / `--selector <css>` / `--all-screens`. agent-browser primary, `npx playwright` fallback. | `/design:screenshot`, `/design:new` step 9 (per-artboard reality check), `/design:edit` steps 3.5 + 7, design-system bootstrap visual sanity, design + signature-moment critics. |
| `bootstrap-check.sh` | Detect `.design/config.json` + DS folders. Exits 0 / 10 / 11. Modes: default / `--json` / `--shell-export`. | `/design:new`, `/design:edit` pre-flight (step 0). |
| `server-up.sh` | PID + `/_health` check, respawn on stale, poll 10 s, stdout = port. | `/design:new`, `/design:edit`, `/design:screenshot` server lifecycle (step 2). |
| `runtime-health.sh` | HEAD-probe every `/_canvas-runtime/*.js` URL, compare body size to on-disk pre-built in `dist/runtime/`. `--restart` auto-kills + respawns when a defective dynamic Bun.build is detected. Catches the class of "parse-clean, fails-at-module-eval" bug (`ReferenceError: AcceleratedAnimation is not defined`) that bypassed step-9 reality checks before 2026-05-27. | `/design:new` step 2, `/design:edit` step 2, `/design:smoke` step 1a. |
| `slug.sh` | Normalize `<active-relative-path>` → kebab slug for `_history/<slug>/`. | `/design:edit` step 3 + anywhere `_history/<slug>/` is computed. |
| `prep.sh` | One-shot pre-flight: reads `.design/config.json` + `_active.json` + `_preflight.json` + `_server.json` in a single pass, emits one JSON/shell-export blob (config + active-canvas + deps + server-probe). Replaces the 4–8 sequential jq/read calls each command ran in step 0/1. Modes: `--json` (default) / `--shell-export` / `--shape new\|edit\|setup-ds`. Server-start stays with `server-up.sh` (prep only probes); DS-presence 0/10/11 gate stays with `bootstrap-check.sh`. | `/design:new` step 1, `/design:edit` step 1 (+ slug for step 3), `/design:setup-ds` step 1. |
| `draw-build.sh` | Run an agent-authored engine build script under Bun with the draw engine importable via the injected `MAUDE_DRAW_ENGINE` path (resolved next to the bin dir — DDR-045/DDR-070). How `draw-agent` "draws as code": builds `DrawPrimitive`s → emits optimized SVG (`--out`) and/or the JSX form (stdout). | `draw-agent` (Phase 25). |
| `draw-proof.sh` | Generate a throwaway proof canvas under `<designRoot>/_draw/<slug>.proof.tsx` (mounts the mark through canvas-lib `DrawProof`: 16/24/48/256 × {light, dark, single-color flatten}), screenshot every artboard, print the dir. The render/verify surface for the draw rubric. | `/design:draw`, `draw-agent`, `draw-critic` (Phase 25). |
| `svg-optimize.sh` | CLI front for `draw/optimize.ts` (SVGO multipass + parse/validity gate — DDR-071). Reads a file or stdin; exit 1 on invalid SVG. | `/design:draw`, `draw-agent` (Phase 25). |
| `_screenshot-playwright.mjs` | Element-scoped playwright fallback shim (called by `screenshot.sh` only). | `screenshot.sh` when `agent-browser` is unavailable. |
| `_svg-optimize.mjs` | Internal bun shim behind `svg-optimize.sh` (imports `../draw/optimize.ts`). | `svg-optimize.sh` only. |

When the CLI needs anything else at runtime on end-user machines, add it here and remember to add the directory to `package.json` `files` (the helpers ship via npm, not via the plugin marketplace).

### Plugin command naming

Two conventions apply to every command, skill, and agent under `plugins/{flow,design}/`. See [DDR-004](./.ai/decisions/DDR-004-flow-command-naming-prefix-convention.md) (group-prefix filename) and [DDR-006](./.ai/decisions/DDR-006-plugin-namespace-in-name-frontmatter.md) (plugin-namespace in `name:`).

**1. `name:` frontmatter MUST be `<plugin>:<slug>`.** Every file declares its fully-qualified slash name in the `name:` field — e.g. `name: flow:resume`, `name: design:edit`, `name: flow:a11y-auditor`. **Without the explicit `<plugin>:` prefix**, Claude Code registers the bare slug and collides with built-ins like `/resume` or `/init` — see Claude Code [issue #22063](https://github.com/anthropics/claude-code/issues/22063). This is load-bearing — forgetting the prefix is a silent regression. Both `/flow:help` and `/design:help` parse `name:` and render `/<name>` directly (no template-side prefix).

**2. Non-daily filenames use `<group>-<verb>`.** Daily verbs (called every feature cycle) stay terse — `plan`, `execute`, `done`, `validate`, etc. Everything else gets a group prefix matching the command's `category:` field — `bug-fix`, `setup-prd`, `record-ddr`, `maintain-clean`. Categories are catalogued in [`plugins/flow/CATEGORIES.md`](./plugins/flow/CATEGORIES.md) and [`plugins/design/CATEGORIES.md`](./plugins/design/CATEGORIES.md). The strict prefix substitutes for the subdirectory namespacing that Claude Code [doesn't support](https://github.com/anthropics/claude-code/issues/2422) (closed not-planned; [#44678](https://github.com/anthropics/claude-code/issues/44678) is the open feature request) — typing `/flow:bug-` autocompletes only `bug-*` members.

**Lone exception:** `init` (both `/flow:init` and `/design:init`) is a bare-verb that mirrors Claude Code's built-in `/init`. The plugin-namespace prefix (`flow:` / `design:`) keeps them unambiguous against the built-in, so the filename doesn't need a `setup-` group prefix. Documented in both `CATEGORIES.md` files. No other bare-verb exceptions without a DDR.

When adding a new command/skill/agent: pick the group from `CATEGORIES.md`, name the file `<group>-<verb>.md`, and set frontmatter `name: <plugin>:<filename-sans-md>`, `category:`, `description:`.

### Flow plugin: `<project>` placeholder convention

Every flow command/skill is project-agnostic. They read `.ai/workflows.config.json` to resolve a `<project>` placeholder and feature toggles (`boundaries.*`, `motion.*`, `responsive.*`, `skills.*`, `integrations.*`). When adding or editing flow content under `plugins/flow/`, **do not hardcode this repo's specifics** — the same plugin runs against arbitrary downstream repos. Reach for the config; if a knob doesn't exist, extend `plugins/flow/.claude-plugin/config.schema.json` rather than hardcoding.

### `.ai/` skeleton vs. this repo's own `.ai/`

`plugins/flow/templates/ai-skeleton/` is the template that `maude init` copies into a target project. This repo also has its own `.ai/` directory at the root — that's Maude *dogfooding* flow on itself (see README "Local development" section). **The two are independent.** Edits to `plugins/flow/templates/ai-skeleton/` only affect future `maude init` runs in other repos; edits to this repo's own root `.ai/` only affect work on this repo.

`cli/commands/init.mjs` does string templating during the copy: it replaces `PROJECT_NAME` and rewrites the `$schema` ref in `workflows.config.json` from a relative path to an absolute GitHub raw URL (because after npm install the schema is no longer at a stable relative location). When changing the skeleton, keep this rewrite in mind for any files added to the `TEMPLATED` list.

### Published npm surface

`package.json` `files` is intentionally minimal — only `cli/`, `apps/studio/`, `plugins/design/templates/`, `plugins/flow/templates/`, the flow config schema, the per-plugin `dependencies.json` + `dependencies.schema.json`, `LICENSE`, and `README.md` ship to npm. The plugin commands/agents/skills/**hooks** (`plugins/*/commands/`, `plugins/*/hooks/`, etc.) are **NOT** published via npm — they reach users through the Claude Code plugin marketplace mechanism (`/plugin install`). When adding a new top-level directory that the CLI needs **at npm runtime**, add it to `files` or `maude` will break for end users. (Dep manifests ARE in `files` because `cli/lib/preflight.mjs` reads them at runtime; `hooks/hooks.json` is NOT, because only Claude Code's plugin loader consumes it, from the marketplace clone.)

### Dependency manifests + config health (`maude doctor`)

Phase A ([DDR-058](.ai/decisions/DDR-058-maude-doctor-deps-config-quality.md)) added one umbrella diagnostic. `maude doctor` (`cli/commands/doctor.mjs`) reports, in one report: missing dependencies (per-plugin, sourced from `plugins/<plugin>/dependencies.json` via `cli/lib/preflight.mjs`), `.ai/workflows.config.json` schema errors (`cli/lib/config-lint.mjs`, Ajv 2020-12), stack drift, and missing quality-gate declarations (`cli/lib/stack-detect.mjs`). `--fix` is never silent (per-dep install prompt; config edits are additive and never overwrite a user value). **Slash commands call the libs directly — no `maude doctor` CLI roundtrip.** There is deliberately **no `maude quality run` / `maude config validate` / `maude config diff`** subcommand (see the `feedback-no-redundant-tooling-over-pnpm` memory).

**Quality gates** live in `workflows.config.json` → top-level `quality` (flat `gate → shell-command` map; `additionalProperties: {type: string}`, free-form names). Flow commands read it via `jq` + `eval` per the `flow:quality-gates` skill — `/flow:utils-verify` + `/flow:quick` run `format`+`lint`; `/flow:validate` runs `format → lint → typecheck → tests → build` then any custom gates; `.ai/release-guide.md` pre-flight runs all. The gate set is **per-project, user-owned** — never bake opinionated defaults into the flow plugin or the `ai-skeleton` template (skeleton has no `quality` block; `maude doctor --fix` fills it from detection). This repo's own block mirrors `quality.yml` (lint/tests/build + parity/tarball/tokens/site-content drift); `typecheck` is intentionally absent because `quality.yml` runs no `tsc` step (the DDR-026 baseline is accepted, so a tsc gate would be permanently red).

## Design plugin

Design-system bootstrap, canvas iteration, and research-agent rules are owned by the plugin itself. When the user invokes `/design:*` or asks about design work, **load the plugin's own docs as the authoritative source** — do not rely on (or extrapolate from) summaries in this CLAUDE.md.

Entry points (load these when relevant, in this order):
- `plugins/design/skills/design-system/SKILL.md` — the canonical bootstrap + iteration spec (modes, sub-modes, 3-stage discovery, scaffold flow)
- `plugins/design/skills/design-system/_pastier-probe-templates.md` — Pastier probe templates fed to `ux-research-agent` during Stage 2 (5 input-field-driven probes: A. Ulice / B. Zrcadlo+Charakter / C. OST / D. Kmen / E. Confidence)
- `plugins/design/agents/ux-research-agent.md` — domain research subagent (consumes the full `vision-brief.json` from Stage 1; emits `recommendations[]` with per-decision confidence for Stage 3)
- `plugins/design/commands/{init,setup-ds,setup-docs,new,edit,help}.md` — slash-command flows
- `plugins/design/agents/*-critic.md` — critic panel definitions (grouped as "4 kola značky" in the post-scaffold reporting block — see SKILL.md § "Post-scaffold gate")
- `plugins/design/CATEGORIES.md` — command catalog and naming convention

When working on a brief the user provided via `/design:setup-ds` or `/design:new`: pass their input **verbatim** to the skill / agent. Do not paraphrase, polish, or augment the brief with "vibe references". Do not propose option ladders that name specific products (brand-name suggestions at the brief-capture stage are the bias source the research agent exists to eliminate). The plugin's own docs handle option generation via the `design:ux-research-agent` — your job is to invoke the right slash command with the user's input intact.

**Pattern priors come first.** When working under a project DS that has existing canvases or preview components, those files ARE the design spec, not the generic DS readme. Before scaffolding new compositional elements (cards, panels, modals, snippets), grep the existing canvas set and preview library for similar shapes. Lifting is the default; reinventing is the exception and needs a one-line comment explaining why a prior didn't fit. Applies to `/design:new` (envelope construction) and `/design:edit` (when adding new components). The `design-system-keeper` agent enforces this — see `plugins/design/agents/design-system-keeper.md` and DDR-010.

**Templates carry no visual priors.** Per [DDR-043](.ai/decisions/DDR-043-bias-free-design-plugin-templates.md) every visible value in `plugins/design/templates/design-system-inspiration/core/*.tpl` is a discovery-driven `{{placeholder}}`. The only hardcoded values are the `prefers-reduced-motion` 1 ms collapse (a11y invariant) and the token NAME contract (`--bg-0..4`, `--fg-0..3`, `--accent*`, `--dur-*`, …). The completeness-critic gates `accentStrategy` + `colorSpace` against `config.json` declarations, defaulting to `single` + `oklch` for backwards compatibility. The CLI `--no-discovery` mode emits a deliberately unfinished neutral-skeleton (grayscale, square, no shadows, system fonts) so users don't unconsciously ship the default aesthetic. When adding a new dimension that would otherwise hardcode a visual choice, route it through the discovery payload + `ux-research-agent.md` `recommendations[]` block, not through the template.

**Bootstrap gates harden over time — defer to the spec.** `/design:setup-ds`'s aspiration silent-pass bar is `≥ 4.0` (raised from 3.5 per [DDR-057](.ai/decisions/DDR-057-aspiration-pass-bar-raised-to-4.md); a `3.0–4.0` "hezké ale ne wow" score still completes but surfaces the signature-moment-critic's top-2 lifts), and reconciliation asserts a **per-in-scope-platform** showcase set derived from Q3 (an absent mobile/tablet showcase is the same hard-fail as a `pending` one) with a 3–4 sub-agent fan-out ceiling. These are spec rules in `plugins/design/skills/design-system/SKILL.md`, not repo conventions — pointer only; the spec is authoritative.

## Release flow

1. `scripts/bump-version.sh patch` (or `minor`/`major`/explicit `X.Y.Z`) — updates all three version fields together.
2. `scripts/check-version-parity.sh` — sanity check (also runs in CI on PRs touching `package.json` or the design plugin manifest; note the workflow does not currently watch the flow plugin manifest, so don't bypass the local script).
3. `git commit -am "chore: release vX.Y.Z" && git tag vX.Y.Z && git push --follow-tags`.
4. The `v*` tag triggers `.github/workflows/build-binaries.yml` (job `publish-main`), which re-runs parity, asserts the tag matches `package.json`, and publishes to npm with `--access public --provenance`. The same `v*` tag also triggers `.github/workflows/hub-image.yml`, which builds + pushes the multi-arch `ghcr.io/1agh/maude-hub` Docker image.

Never bump versions by hand or with `npm version` — the script is the single source of truth for keeping all three manifests in lockstep.

**The hub release image installs frozen — never add a fresh-resolution Dockerfile.** `apps/hub/Dockerfile` builds with `bun install --frozen-lockfile` against the committed `apps/hub/bun.lock` and copies the resolved `node_modules` into the runtime stage (no second install). This is load-bearing: the image is the one component DDR-054 designates "untrusted to peers," so a fresh `bun install` / `npm install <range>` at build time would let a poisoned transitive land in every self-hoster's hub (DDR-056-adjacent security finding). Bump hub deps via the lockfile, never by re-resolving in the Dockerfile.

**Runtime bundles (`apps/studio/dist/runtime/*.js`) are committed and authoritative for the release.** Both CI jobs (per-platform `build-binaries` matrix + `publish-main`) set `MAUDE_SKIP_RUNTIME_BUILD=1` on the build step, so `pnpm build` reuses the on-disk bundles verbatim instead of regenerating them. Reason: Bun.build's output for `motion`/`motion/react` is environment-sensitive — v0.22.0 shipped a 13 kB `motion_react.js` (working size 155 kB+) because Ubuntu CI's `pnpm build` overwrote the good local bundle with broken regen output. Whatever you commit is what ships. To regenerate locally before a release: `cd apps/studio && bun run build.ts` (dev mode) or `bun run build:binary` (release/minified). The `check-runtime-bundles.sh` step in CI validates every `dist/runtime/*.js` against the per-slug floor in `.min-sizes.json` — if a maintainer commits a bad bundle, the release fails loud before `npm publish`.

## Site roadmap regen

`site/lib/roadmap.json` is auto-generated from `.ai/plans/*.md` + `.ai/plans/archive/*.md` + `.ai/state/STATE.md` by `site/scripts/build-roadmap.mjs`. It feeds the public `/roadmap` page. Like `stats.json` it IS committed because Vercel uploads only `site/` and cannot see the `.ai/` sibling.

**Whenever** you edit `.ai/state/STATE.md` History, archive a plan into `.ai/plans/archive/`, or add a new plan under `.ai/plans/`, run:

```
pnpm --filter @maude/site gen:roadmap
```

and include the resulting `site/lib/roadmap.json` diff in the same commit. This is the auto-update mechanism for `/flow:done` and any ad-hoc plan moves, no plugin-command hook needed — the rule lives here so it stays in context.

## In-app What's New feed

`apps/studio/whats-new.json` is the **single source of truth** for the "What's New" notices the Maude UI surfaces — the menubar `✦ New` badge, the first-run toast, and the panel (`GET /_api/whats-new`). It ships with the dev-server (already in `package.json` `files`) and describes **Maude's own product** updates, resolved from the maude package root via `paths.ts` (NOT the served project) so every user of the canvas browser sees it. Schema: `apps/studio/whats-new.schema.json`; plan + DDRs in `.ai/plans/feature-in-app-whats-new-tour.md`.

**On `/flow:done`** (closing a user-visible feature), append an entry via the repo-internal **`whats-new-entry`** skill (`.claude/skills/whats-new-entry/`), wired through `integrations.whatsNew` in `.ai/workflows.config.json` — the same "rule in an always-loaded file" convention as the roadmap regen above. Entries are written **pending** (`version: null`); `scripts/bump-version.sh` stamps them with the release version + date at release time via `scripts/stamp-whats-new.mjs`. The client decides what's unseen by comparing the installed version against the `mdcc-whatsnew-seen` localStorage marker.

After editing the client surfaces (`client/whats-new*.{jsx,js}`, `client/app.jsx`, `client/styles/4-components.css`), **rebuild the committed bundle release-minified** — `cd apps/studio && MAUDE_SKIP_RUNTIME_BUILD=1 bun run build.ts --release` — and commit `dist/client.bundle.js` + `dist/styles.css`. Never boot the source dev-server from this tree without rebuilding `--release` afterward: its first-launch self-heal regenerates **unminified dev** bundles (3.6 MB vs the 250 KB release artifact), and whatever is committed is what ships.

## Working on plugin internals locally

For testing edits to plugin commands/skills/agents, the README's "Local development" section is the canonical recipe: point the marketplace at the local working tree (`/plugin marketplace add /absolute/path/to/maude`), then `/plugin marketplace update maude` + `/reload-plugins` after each edit. **Test in a scratch project** (`cd /tmp/scratch && claude`) rather than from this repo's directory — otherwise this repo's own `.ai/` workspace tangles with the plugin you're testing.

For dev-server code changes specifically: kill the running server (`lsof -i :<port>` → `kill`) and let the next `/design` invocation auto-restart it; the orchestrator checks `<designRoot>/_server.json` and respawns when stale.

## Known issues

- **Fixed in v0.18.0** (Phase 19 — fill version at release). `/design:browse` on a fresh marketplace-cache install used to 404 on `/_client/client.bundle.js`+`styles.css` (gitignored, absent from the git clone) and 500 on `/_canvas-runtime/*` (no `node_modules/react`). The dev-server now self-heals at boot — runs `bun install --production` + `bun run build.ts` on the first launch and writes `_server.json` only after artifacts exist. Opt out for read-only filesystems with `MAUDE_NO_AUTOBUILD=1` (server exits 1 with remediation). `client.bundle.js` + `styles.css` are now also committed to git so the build step is only needed when source changes. Full retro + decision in `.ai/logs/system-reviews/maude-dev-server-bootstrap-review.md` and `.ai/decisions/DDR-044-marketplace-install-vs-npm-install-artifact-strategy.md`. Remove this entry one release cycle after v0.18.0 ships.
