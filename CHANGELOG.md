# @1agh/md-claude

## 0.13.1

### Patch Changes

- Hotfix: repair v0.13.0 release pipeline.

  v0.13.0 half-published (3 of 7 platform sub-packages reached npm; the
  root `@1agh/md-claude` package never published). Root causes:

  - `plugins/design/dev-server/build.ts` produced
    `dist/mdcc-windows-x64.exe` but `build-binaries.yml` expected
    `mdcc-win32-x64.exe` (bun's target naming vs. Node's
    `process.platform`). `platformSlug()` now translates
    `windows-x64` → `win32-x64`.
  - `build-binaries.yml` used `container: alpine:3.20` for musl builds,
    but JS-based actions can't run in alpine on arm64 runners. Dropped
    the container; cross-compile musl from regular ubuntu via Bun's
    `--target=bun-linux-*-musl` (statically-linked output).
  - `pnpm install --frozen-lockfile` is fundamentally incompatible with
    the `optionalDependencies` bootstrap pattern (lockfile can't
    enumerate sub-packages that aren't on npm yet). Switched
    `build-binaries.yml > publish-main` and `quality.yml` to
    `--no-frozen-lockfile`.
  - `publish.yml` was a duplicate of `build-binaries.yml > publish-main`
    without the `needs: build-binaries` gate, so it raced ahead and
    always failed at install. Deleted.
  - `scripts/changesets-version.sh` only propagated the bumped version
    to plugin manifests; missed `packages/md-claude-*/package.json` and
    the `optionalDependencies` pins. Now delegates to
    `scripts/bump-version.sh "$NEW"` which covers every manifest.

  GitHub Release creation moved into `build-binaries.yml` (new
  `create-release` job runs first; `publish-main` populates notes after
  npm publish).

## 0.13.0

### Minor Changes

- b200e59: design plugin: stable element-id schema + canonical screenshot pipeline + shared bash helpers

  **New user-visible flags on `/design:screenshot`:**

  - `--screen <id>` — capture one artboard by `data-dc-screen` id (or legacy `data-dc-slot`)
  - `--element <id>` — capture one named region by `data-dc-element` id
  - `--all-screens` — loop over every artboard, write `<NNN>-screen-<id>.png` per artboard
  - existing `--full` / `--selector <css>` / `--area <name>` retained

  **Stable element-id schema in generated canvases:**

  - `DCArtboard` runtime now renders `data-dc-screen="<id>"` alongside the legacy `data-dc-slot` (same value). Backwards-compatible — existing canvases keep working.
  - `/design:new` / `/design:edit` envelope directive 15 instructs `frontend-design` to tag named regions (heroes, CTAs, list rows, form fields) with `data-dc-element="<kebab-id>"`. Stable handles for comments, screenshots, and critic verdicts across iterations.
  - Inspector (`server.mjs` `cssPath()` / `domPath()`) now prefers `[data-dc-element]` → `[data-dc-screen]` → `#id` → `:nth-child`. Cmd+Click on a tagged element yields a stable selector instead of fragile `:nth-child(3)`.

  **Canonical bash helpers under `plugins/design/dev-server/bin/`** (shipped via npm, called from slash commands and critics):

  - `screenshot.sh` — wraps `agent-browser` with `npx playwright` fallback; handles URL resolution, mount poll, per-screen loop, engine selection
  - `bootstrap-check.sh` — detects `.design/config.json` + DS folders; exit 0/10/11; modes: default / `--json` / `--shell-export`
  - `server-up.sh` — server lifecycle (PID + `/_health` check, respawn, 10s poll); stdout = port
  - `slug.sh` — single source of truth for `_history/<slug>/` path normalization

  **Bug fix:** `signature-moment-critic.md` previously referenced `[data-artboard-id]` — a selector that no runtime ever emitted, silently falling back to `--full` and losing per-artboard discipline. Renamed to `data-dc-screen` (sweep across the plugin).

  **Refactor:** inline `agent-browser navigate + screenshot` bash blocks removed from `commands/{screenshot,new,edit,setup-ds}.md`, `skills/design/SKILL.md`, `skills/design-system/SKILL.md`, `agents/design-critic.md`, `agents/signature-moment-critic.md`. All callers now invoke the helper.

  See DDR-007 (element-id schema) and DDR-008 (helper home) for the architectural rationale.

- 77478b0: design plugin: `design-system-keeper` agent + pattern-priors envelope + token-usage doctrine

  **New auto-routed audit agent — `design-system-keeper`:**

  Read-only agent (`tools: Read, Bash, Glob, Grep`) that runs between canvas generation and the critic panel. Two passes:

  - **Pattern-reinvention scan** — greps existing canvases + DS preview library for class shapes the new canvas should have lifted (catches `.pcard` re-deriving an existing `.dc-card`, etc.).
  - **Token-usage audit** — cross-checks every `var(--TOKEN)` against the DS README's `## Token usage guide` table to flag role mismatches (e.g. `--accent-active` used as a fill instead of body-text contrast).

  Findings are warnings by default; the agent self-promotes its own verdict to blocker when ≥ 5 token-usage mismatches OR ≥ 3 pattern reinventions stack on a single canvas (mass-drift signal).

  **New user-visible flag on `/design:new` and `/design:edit`:**

  - `--skip-ds-keeper` — opt out of the precheck for known-experimental canvases / debug runs.

  **Orchestrator integration:**

  - `/design:new` step 9.5 spawns ds-keeper in parallel with the critic panel (always, unless flag).
  - `/design:new` step 5/5a/5b — envelope template now carries a mandatory `## Pattern priors` section listing existing canvases (with their class roots) + DS preview components (with one-line role). Generator is instructed to lift before reinventing.
  - `/design:edit` step 7.5 — conditional precheck (fires when diff ≥ 10 lines OR new class root introduced; skipped on micro-edits).
  - `/design:edit` step 8a — DS-drift fast-path. When user feedback explicitly names DS drift (regex matches "design system" / "DS" / Czech "jiné barvy než DS"), routes a stripped panel `[ds-keeper, design-critic]` capped at 2 iterations. Skips 4–6 critic spawns per iter that would have been deterministic find-and-replace.

  **New DS doc convention — `## Token usage guide` section:**

  `md-claude`'s own DS at `.design/system/project/README.md` gains a Token usage guide table covering all four token families (accent, fg, bg, border) — for each token: "Use for" / "Don't use for". This is the audit source for ds-keeper's Pass B. Future DSes scaffolded by `/design:setup-ds` should follow the same pattern (inspiration-library template carry-over).

  **Pattern-lift discipline codified in CLAUDE.md:**

  New paragraph under § Design plugin: "Pattern priors come first — when working under a project DS that has existing canvases or preview components, those files ARE the design spec. Lift before invent."

  See [DDR-010](.ai/decisions/DDR-010-design-system-keeper-agent.md) and the [Docs Site retro](.ai/logs/system-reviews/docs-site-design-generation-review.md) for the rationale and the cost-saving math (~50–80k tokens per session in the typical "user has existing canvas to lift from" scenario).

- 61d9e9d: **Phase 3.4 — dev-server runtime + build pipeline + distribution overhaul.**

  The dev-server (`mdcc design serve`) is now built on Bun authoritatively (DDR-009), distributed as per-platform standalone binaries via npm `optionalDependencies` sub-packages (DDR-015), and runs on a 7-module TypeScript split of the former 1288-LOC `server.mjs` monolith (DDR-013). The shell client migrates from React 18 UMD via babel-standalone to React 19 from npm, bundled with `Bun.build` to a 66 KB gz IIFE (DDR-012). CSS moves to a `@layer reset, tokens, layout, shell, components, utilities` cascade processed by Lightning CSS at build time (DDR-014).

  **No breaking change for `mdcc` CLI surface.** `mdcc init` / `mdcc config` / `mdcc design serve` / `mdcc design init` all work as before — same flags, same output paths. End-user prereq drops from "Node 20+" to "nothing" once published with sub-packages, because postinstall hardlinks the matching platform binary in place. `mdcc-safe` bin is the `--ignore-scripts` fallback (slower but always works).

  Highlights:

  - `bun build --compile` produces ~57 MB standalone binary per platform (darwin-arm64 / darwin-x64 / linux-x64 / linux-arm64 / linux-x64-musl / linux-arm64-musl / win32-x64).
  - 7 sub-packages under `packages/md-claude-<slug>/`; `optionalDependencies` in the main tarball pin all 7 in lockstep. `scripts/bump-version.sh` + `scripts/check-version-parity.sh` extended.
  - `.github/workflows/build-binaries.yml` is the new release pipeline (fail-fast: false matrix, native runner per platform, npm provenance on every artifact, `publish-main` gated on all sub-packages being live).
  - Native `Bun.serve` WebSocket replaces the hand-rolled RFC-6455 upgrade (saves ~150 LOC + 1.7× WS throughput headroom for future collab features).
  - 7 `bun:test` smoke tests + `perf-harness.ts` measure the Phase 3.4 budgets (cold start < 100 ms HTTP, bundle gz < 80 KB, WS p50 < 1 ms).
  - CSS-only HMR live; full JSX HMR with react-refresh-runtime is deferred to Phase 3.5.

  Unblocks Phase 3.5 (DS-token-aware shell visual refresh) and Phase 4 (Pixi.js canvas v2 + infinite canvas).

  Per-platform sub-packages (new on npm): `@1agh/md-claude-darwin-arm64`, `@1agh/md-claude-darwin-x64`, `@1agh/md-claude-linux-x64`, `@1agh/md-claude-linux-arm64`, `@1agh/md-claude-linux-x64-musl`, `@1agh/md-claude-linux-arm64-musl`, `@1agh/md-claude-win32-x64`. End users should not install these directly — npm resolves the matching one automatically.

  See `.ai/decisions/DDR-{009,012,013,014,015,016}.md` for the full rationale set.

- e5eb043: **Phase 3.5 — dev-server shell refresh: shadcn-style menubar + CV-08 tree-panel + Help modal + paper-grid viewport.**

  The `mdcc design serve` chrome is rebuilt against the `project` DS (MDCC-DSN/01) mocks in `.design/ui/Canvas Viewport.html`. The action-button header (`tree · active · comments · open`) is replaced by a 30 px top **menubar** (`■ MDCC · File · Edit · View · Selection · Tools · Help · CV-stamp · file · N ARTBOARDS · ZOOM 100% · project SKU`) per CV-01/CV-08 spec — see [DDR-017](../.ai/decisions/DDR-017-dev-server-shell-menubar-single-canvas.md). The tabs row is gone — the dev-server is single-canvas; opening a file in the tree replaces the active one. The left sidebar becomes a four-section CV-08 tree (`PROJECT / DESIGN SYSTEM · / UI CANVASES / RUNTIME · GITIGNORED`) backed by a new `kind` discriminator in `_index-data` — see [DDR-018](../.ai/decisions/DDR-018-tree-groups-via-kind-discriminator.md).

  **Visual surfaces (CV-01 / CV-02 static lift)**

  - **Paper-grid viewport bg** — 24 px ink hairline grid on `--u-bg-1`; visible in empty state, covered by iframe once a canvas mounts.
  - **Wordmark watermark** — `mdcc-design-server` 40 px display + `CANVAS · MD-CLAUDE / v{version} / localhost:{port}` SKU sub-line; mounted in the empty state. Version baked at build time via a new `__MDCC_VERSION__` Bun `define`.
  - **Selection halo** — accent 2 px outline + 4 corner ticks around the active iframe when an element is selected (CV-02 lift).

  **Menubar + dropdown**

  - **View dropdown** (T): `Project Tree (T)`, `Comments Sidebar (⌘⇧M)`, `Design system view (S)` all toggleable; `Layers Panel`, `Inspector`, `Annotations`, `Presentation Mode`, `Zoom In/Out/Fit/Actual Size` rendered with `Phase N` tags (inert until those phases land).
  - **Help menu** opens `<HelpModal>` — modal containing the cheatsheet that used to live in the sidebar (Element selection · Tabs & canvas · Slash commands · Opt-out scope · Auto-critic loop · Pin-to-element flow · Comments). Esc / backdrop / × close. Triggered by `?` or `F1` too.
  - **State stamp** in `.mb-status`: cv-stamp (`IDLE / CANVAS / SYSTEM`) + file path + `● N ARTBOARDS · ZOOM 100% · MD-CLAUDE`.

  **Sidebar (CV-08)**

  - New `<Sidebar>` reads `kind`-tagged groups: PROJECT (`▾ .design` root files), DESIGN SYSTEM · (`MDCC-DSN/01` pill, `▾ system/project` with `README.md`, `SKILL.md`, `colors_and_type.css`, `▾ preview` with HTMLs), UI CANVASES (count pill, `▾ ui`), RUNTIME · GITIGNORED (count pill, muted treatment).
  - DS section header is **clickable** — opens the system view. (Replaces the dropped promoted "Design system view" row.)
  - Files-first ordering inside dirs (mock convention).
  - Non-HTML rows are inert (`aria-disabled="true"`, no-op click).

  **Keyboard surface**

  - `T` toggles sidebar visibility (visibility-hidden, state preserved).
  - `S` toggles SYSTEM view.
  - `⌘F` focuses search (re-opens sidebar if hidden).
  - `⌘⇧M` toggles comments rsidebar.
  - `?` / `F1` opens Help modal.
  - `Esc` closes modal / composer / focused pin.

  **Fixes**

  - **Body-grows scrollbar bug** — long selected-element selectors in the statusbar no longer push the grid wider than viewport. Root cause: `.app { grid-template-columns: 320px 1fr }` defaults to `minmax(auto, 1fr)`, so an unbreakable selector string expanded the track. Fix: `minmax(0, 1fr)` + `min-width: 0; overflow: hidden` on `.app` + `.statusbar`.
  - **View dropdown clipped** — earlier `.mb { overflow: hidden }` (added to clamp menubar status) clipped the dropdown (`position: absolute; top: 30px`). Removed; right-side clamp stays on `.mb-status` alone.

  **Server (`api.ts`)**

  - `buildIndexData` synthesizes PROJECT (`.md`/`.json`/`.txt`/`.yml`/`.yaml`/`.css` at `.design/` root) and RUNTIME (`_*` entries at root) groups in addition to the existing canvas groups.
  - DS canvas group widens its scan to `['.html', '.md', '.css', '.json']` so `README.md` / `SKILL.md` / `colors_and_type.css` appear alongside preview HTMLs.

  No `mdcc` CLI surface change. Phase 4 (Pixi canvas v2) lands on this refreshed shell.

## 0.12.0

### Minor Changes

- **design:** add `ux-research-agent` for unbiased discovery + strip brand precedents from the plugin.

  The design-system bootstrap questionnaire previously showed the same hardcoded option ladder (mood / signature / iconography / density / typography / voice) to every project regardless of domain, and plugin docs seeded the orchestrator with brand-name precedents (Linear/Figma/Stripe/Vercel/etc. in CLAUDE.md retros, `_MAPPING.md` fixed answers, agent examples) that got parrotted back into brief proposals.

  - New `design:ux-research-agent` with two modes — `discovery` (called from `/design:setup-ds` Round 0) and `ux-patterns` (called from `/design:new`). Runs 6–8 WebSearch queries across abstract source-type categories (awards / case-studies / indie portfolios / non-English regions / lateral industries / niche publications / heritage) and emits a payload the questionnaire consumes verbatim.
  - Discovery Q5/Q6/Q7/Q8 are now payload-sourced (were hardcoded "stable across projects"). Q9/Q11/Q12 keep their scaffold logic via effect-family classification in `_MAPPING.md`, but the answer pool is payload-generated per project.
  - Brand-precedent purge: removed brand-name lists from `CLAUDE.md`, `SKILL.md` retro examples, `_MAPPING.md` hardcoded answer tables, `/design:setup-ds` example invocation, and `brand-critic` / `typography-critic` prose. Runtime config at `plugins/design/agents/_ux-research-config.json` holds only the abstract WebSearch source-type categories.
  - Cache uses brief-hash exact match (sha8 of brief verbatim) so reworded briefs get fresh research instead of fuzzy-matched cache reuse.

## 0.11.0

### Minor Changes

- 25f7767: **Plugins: namespace `name:` frontmatter + rename `setup-onboard` → `init`.**

  - Every plugin command, skill, and agent now declares `name: <plugin>:<slug>` in its frontmatter (e.g. `flow:resume`, `design:edit`). Without the explicit prefix, Claude Code registers the bare slug — which collides with built-ins like `/resume` and loses the namespaced row in autocomplete. See [Claude Code issue #22063](https://github.com/anthropics/claude-code/issues/22063) and [DDR-006](./.ai/decisions/DDR-006-plugin-namespace-in-name-frontmatter.md).
  - `/flow:setup-onboard` → `/flow:init` and `/design:setup-onboard` → `/design:init`. Bare-verb `init` is the lone exception to the `<group>-<verb>` filename rule, mirroring Claude Code's built-in `/init`. The namespace prefix (`flow:` / `design:`) keeps them unambiguous against the built-in.
  - `/flow:help` and `/design:help` render templates updated to `/<name>` (the prefix is already in `name:`) to avoid double-prefix output.
  - Both `CATEGORIES.md` files updated with new naming convention, the `init` carve-out, and rename-history rows.

  **Downstream impact:** Users invoking the old slash names need to switch — `/flow:setup-onboard` → `/flow:init`, `/design:setup-onboard` → `/design:init`. No backwards-compat stubs; the slash names disappear cleanly because both plugins ship as a single version-pinned bundle.

## 0.9.0

### Minor Changes

- 3ea3774: **Inspiration library expansion** — 46 new reference specimens, bringing `plugins/design/templates/design-system-inspiration/` to **70 files** total (up from 24 in v0.8). Plus removes the `/design` compat stub on schedule.

  **Library additions (46 specimens):**

  - **`foundations/` (8)** — radii, elevation, borders, focus, opacity, selection, grid, iconography. Universal — every project pulls from these.
  - **`status/` (3)** — colors-status, components-status (badges + row indicators), skeletons. Active when `"status" ∈ activeFamilies` (default for almost every project).
  - **`audience-pro/` (6)** — dense list, toast-menu, keyboard primitives, command palette, shortcuts overlay, presence colors. For pro tools with keyboard-first density.
  - **`audience-consumer/` (5)** — marketing card, testimonial, feature grid, generous empty state, page banners. For consumer-facing surfaces.
  - **`audience-developer/` (6)** — terminal pane, log stream, diff view, code block (with syntax-tinted token palette), monospace table, type-mono usage. For developer tools.
  - **`platform-mobile/` (5)** — bottom sheet (3 snap states), pull-to-refresh, tab bar, segmented control, mobile UI kit index.
  - **`platform-desktop/` (2)** — resizable 3-pane layout, desktop UI kit index.
  - **`theme-both/` (1)** — dark + light side-by-side comparison (for `Q4 = both equal` projects).
  - **`patterns/` (6)** — form layouts (4 variants), error pages (404/500/offline/maintenance), onboarding (welcome + tour + coachmark), auth (sign-in / sign-up / reset), pricing tiers, data density (sparse / default / compact).
  - **`meta/` (4)** — tokens index (visual TOC), accessibility patterns (skip-link, sr-only, landmarks, focus trap, ARIA live), i18n (RTL flip, long-text overflow, pluralization, lang attribute), presence-multiplayer (forward-pointer to v1.1+ Yjs features).

  Every specimen carries the `<!-- SPECIMEN: … -->` comment header (DEMONSTRATES / COMPOSITION / COPY VOICE / WHEN SCAFFOLDED / NOTES) — the bootstrap-mode agent reads these as references to learn what each pattern is and how to generate a project-flavored equivalent.

  **Stub removal:**

  - `plugins/design/commands/design.md` — the v0.8 one-version compat stub redirecting `/design` → `/design:edit` — **removed** as scheduled. Calling `/design` no longer resolves; use `/design:edit` directly.
  - `site/content/docs/reference/design/design.mdx` — auto-generated reference page for the removed stub — also removed.
  - Cross-references updated in `plugins/design/CATEGORIES.md`, `plugins/design/commands/help.md`, `CLAUDE.md`, `site/content/docs/design/index.mdx`, `site/content/docs/design/categories.mdx` — the rename history table gains a final row for the v0.9 removal.

  Now-canonical command list: 11 (8 daily + 3 setup, no compat stub).

  **Scaffold sizes (updated):**

  | Project profile         | Approx file count (was → now)                                               |
  | ----------------------- | --------------------------------------------------------------------------- |
  | Consumer marketing      | ~12 → ~18 (foundations, status, audience-consumer, patterns)                |
  | Pro-tool SaaS           | ~22 → ~32 (foundations, status, audience-pro, platform-\*, universal, meta) |
  | Developer CLI dashboard | ~14 → ~22 (audience-developer + meta + foundations + status)                |
  | Consumer mobile         | ~16 → ~22 (platform-mobile + consumer + foundations)                        |
  | Enterprise admin        | ~20 → ~30 (audience-pro + theme-both + patterns + meta)                     |

  Skill `design-system` (bootstrap mode) reads `_MAPPING.md` to pick which subdirs apply per discovery — and now actually has the files to read.

## 0.8.0

### Minor Changes

- cd21658: The `design` plugin gains a bootstrap workflow that takes a project from cold-start to a usable design system in 8 questions. Plus a `<group>-<verb>` command categorization mirroring the flow plugin, an adaptive completeness-critic, and multi-DS support.

  **New slash commands**

  - **`/design:setup-onboard`** — project-level environment init (deps check, install hints, skeleton `.design/config.json`). Mirrors `/flow:setup-onboard`. Auto-invoked transparently when other commands hit a missing config.
  - **`/design:setup-ds <name> "[brief]"`** — dedicated entry point for creating a design system. Thin wrapper that loads skill `design-system` in bootstrap mode. Three internal modes (`first-bootstrap`, `additional-ds`, `re-bootstrap`).
  - **`/design:setup-docs`** — was `/design:docs`; moved to the `setup-*` group.
  - **`/design:help`** — grouped command index, mirror of `/flow:help`.

  **Renamed**

  - `/design "<feedback>"` → **`/design:edit "<feedback>"`**. The bare `/design` form is preserved as a one-version compat stub; will be removed in the next minor.
  - `/design:docs` → **`/design:setup-docs`**.

  **Skill `design-system` — dual-mode**

  - **READ mode** (default) — loads the active canvas's declared DS for iteration.
  - **BOOTSTRAP mode** — auto-invoked by `/design:setup-ds` and as a fallback by `/design:edit` / `/design:new` against fresh repos. Runs hard-deps pre-flight → 8-question discovery (2 `AskUserQuestion` rounds) → consults `_MAPPING.md` → generates project-flavored files using `plugins/design/templates/design-system-inspiration/` as reference → runs `design-system-completeness-critic` → prints next-step block.

  **`mdcc design init`** (new CLI subcommand)

  Non-interactive helper for CI / scripted contexts. `--no-discovery` scaffolds Core only with Recommended defaults; `--discovery-payload <path>` reads pre-computed answers for deterministic skill-driven scaffolds. Interactive bootstrap requires Claude Code — the CLI refuses with a hint.

  **Adaptive completeness-critic**

  New agent `plugins/design/agents/design-system-completeness-critic.md` validates `<designRoot>/system/<ds>/` against a **3-tier rule set**:

  - **Core** (blocker regardless of profile) — README + SKILL + tokens presence, one-accent rule, Core vars (`--accent`, `--bg-0..4`, `--fg-0..3`, motion var), minimum specimens (3/8/12 per profile), no D2 divergence (`system/<projectslug>/` is rejected).
  - **Conventional** (warning, gated by `activeFamilies[]` + `completenessProfile` `minimal | standard | strict`) — OKLCH usage, per-family specimens (status / presence / mono), `prefers-reduced-motion` guard, theme blocks.
  - **Free-form** (no check, acknowledged) — user extensions (`patterns/`, `voice/`, etc.) pass silently.

  Auto-runs at the end of the bootstrap flow; opt-in via `/design:critic --system-only [--ds=<name>] [--all-ds]`.

  **Multi-DS support**

  Projects can now declare multiple design systems under `<designRoot>/system/<name>/`. Each canvas's `.meta.json.designSystem` field names the DS it's built against. The completeness-critic, `flow:design-system-guard`, and the read-side of skill `design-system` all scope to that DS — tokens from one DS never blend into another. `/design:new --ds=<name>` validates the slug against `config.designSystems[]` and fails with a hint to `/design:setup-ds` on unknown DSes (no fallback prompt).

  **Schema additions** (`plugins/design/dev-server/config.schema.json`)

  - `extensions[]` — user-added subdirs the critic acknowledges but doesn't validate
  - `completenessProfile: minimal | standard | strict`
  - `activeFamilies[]` — `accent | status | presence | mono`
  - `designSystems[]` — multi-DS list with name/path/description
  - `defaultDesignSystem` — fallback when canvas meta has no DS field

  Plus `canvas-meta.schema.json` gains `designSystem` (kebab-case slug) + `opt_out_scope` (palette/aesthetic/full) fields.

  **Inspiration library** (skeleton — full expansion in a follow-up)

  New `plugins/design/templates/design-system-inspiration/` ships 24 reference files: `_README` + `_MAPPING` + Core 10 (templates for README, SKILL, INDEX, config, tokens CSS + 9 specimens) + Universal 6 (toggles, dialogs, tooltips, tables, callout, empty-state). Each specimen has a SPECIMEN comment header documenting which tokens it demonstrates and the copy voice it uses. Bootstrap mode reads these as **references**, then generates project-flavored equivalents — never copies verbatim, never with placeholder copy.

  **Categorization** (`plugins/design/CATEGORIES.md`)

  12 commands grouped into `daily` (8: edit, new, critic, browse, rollback, screenshot, handoff, help) + `setup-*` (3: setup-onboard, setup-ds, setup-docs). Plus the bare `/design` compat stub.

  **Site (docs.iagh.cz)**

  `/docs/design` is now a section: `index` (overview), `bootstrap` (cold-start narrative), `multi-ds` (multi-DS reference), `categories` (mirror of `CATEGORIES.md`). Plus the auto-generated reference pages regenerate from the renamed source files. The `mdcc design init` subcommand is documented in `/docs/cli`.

  **CLAUDE.md**

  New "Design system bootstrap" section documenting the 8 load-bearing rules so future sessions don't re-derive them: onboard-before-bootstrap, one-skill-owns-DS-work, three-bootstrap-sub-modes, inspiration-library-not-substrate, dynamic-scaffold-count, single-DS-dirname-is-literal-`project`, three-tier-compliance, daily-verb-is-edit.

  Refs: [`.ai/plans/design-system-init.md`](https://github.com/1aGh/md-claude/blob/main/.ai/plans/archive/design-system-init.md).

### Patch Changes

- a50c9f4: Docs site lands at [`site/`](https://github.com/1aGh/md-claude/tree/main/site) (Fumadocs + Next.js + Tailwind v4 + Orama search). Public URL pending Vercel wiring — see [DDR-005](https://github.com/1aGh/md-claude/blob/main/.ai/decisions/DDR-005-docs-site-stack-and-hosting.md).

  What's there:

  - **Guides** (hand-written): `getting-started`, `cli`, `flow`, `design`, `config`, plus drop-in recipes for Next.js, Expo, and pnpm monorepos.
  - **Reference** (auto-generated): one MDX page per `/flow:*` and `/design:*` command (37 today) sourced from plugin frontmatter; one typed `workflows.config.json` schema page sourced from `config.schema.json`. Two generators under `site/scripts/` run as the site's `prebuild` step — adding a new command auto-publishes its page on next deploy.
  - **LLM-readable output**: Fumadocs ships `/llms.txt`, `/llms-full.txt`, and raw `/llms.mdx/docs/<slug>` per page out of the box; this release adds a `/robots.txt` with an explicit allow for GPTBot / ClaudeBot / PerplexityBot / Google-Extended.

  Infra:

  - New private workspace `@md-claude/site` (not part of the npm tarball).
  - New `.github/workflows/site-deploy.yml` — builds + lints on every PR / push to `main` touching `site/**`. Deploy step is inert until a maintainer adds `VERCEL_TOKEN` / `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` repo secrets.
  - Root README trimmed 339 → 164 lines — flow + design command deep dives now live on the docs site; README stays focused on quickstart + contributor info.

  No change to the published `@1agh/md-claude` package contents — `patch` bump captures the infrastructure improvement without overstating user-facing API change.

## 0.7.0

### Minor Changes

- 89bf4e6: **flow:** rename `/flow:resume-task` → `/flow:resume`.

  Pairs cleanly with `/flow:pause` (no asymmetric `-task` suffix). The command file is now `plugins/flow/commands/resume.md`.

  **Breaking change for users with muscle memory** — the old slash name no longer resolves. Update any session notes, scripts, or muscle-memory cheat sheets that referenced `/flow:resume-task`. (Note: `flow:resume-task` was only available in v0.6.0 → v0.6.1; older versions used `/flow:resume-work` which was already phantom.)

  Also fixed two pre-existing phantom command references during the sweep:

  - `plugins/flow/commands/pause.md` — replaced bare `resume-work` mentions with `/flow:resume`.
  - `plugins/flow/commands/setup-prd.md` — replaced `pause-work` / `resume-work` with `/flow:pause` / `/flow:resume`.

## 0.6.1

### Patch Changes

- Remove the 11 Phase 13 backwards-compat stubs ahead of schedule.

  The stubs (`verify.md`, `onboard.md`, `create-prd.md`, `map-codebase.md`, `context.md`, `ddr.md`, `retro.md`, `execution-report.md`, `ai-health.md`, `discover.md`, `code-review.md`) shipped in v0.6.0 as a one-minor-version grace window for users typing the pre-rename slash names. The original plan was to remove them in v0.7.0.

  After ~one day on npm with no observed traffic to the old slash names, the stubs were removed early. Anyone still typing `/flow:ddr`, `/flow:onboard`, `/flow:verify`, etc. in v0.6.1+ will see a "command not found" instead of a redirect message; the new names are in `plugins/flow/CATEGORIES.md` (rename history table), DDR-004, and `/flow:help`.

  Decision is recorded in `.ai/decisions/DDR-004-flow-command-naming-prefix-convention.md` under "Compat-stub removal target (actual: v0.6.1)".

## 0.6.0

### Minor Changes

- 09bcb3b: Adopt pnpm workspaces and Changesets for the release flow. Add `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, GitHub PR + issue templates, Dependabot config, quality CI workflow, CODEOWNERS, and Dependabot auto-merge. No runtime change for `mdcc` or the plugins themselves.
- 9f9a8d8: Flow plugin command categorization — every non-daily `/flow:*` command now uses a `<group>-<verb>` prefix so autocomplete narrows by group.

  **Renamed commands** (old names ship as redirect stubs through v0.6.x; removed in v0.7.0):

  - `/flow:verify` → `/flow:utils-verify`
  - `/flow:onboard` → `/flow:setup-onboard`
  - `/flow:create-prd` → `/flow:setup-prd`
  - `/flow:map-codebase` → `/flow:setup-codebase-map`
  - `/flow:context` → `/flow:setup-context`
  - `/flow:ddr` → `/flow:record-ddr`
  - `/flow:retro` → `/flow:record-retro`
  - `/flow:execution-report` → `/flow:record-execution`
  - `/flow:ai-health` → `/flow:maintain-ai-health`
  - `/flow:discover` → `/flow:maintain-discover`
  - `/flow:code-review` → `/flow:review-code`

  **New:** `/flow:help` — auto-generated grouped command index that reads each command's `category:` frontmatter. `plugins/flow/CATEGORIES.md` is the canonical catalog of the 9 groups (`daily`, `utils`, `setup`, `validate`, `bug`, `record`, `maintain`, `review`, `release`). Rationale + research lives in DDR-004.

  Subdirectory namespacing for slash commands (`commands/bug/fix.md` → `/flow:bug:fix`) is **not supported by Claude Code** ([issue #2422](https://github.com/anthropics/claude-code/issues/2422), [open feature request #44678](https://github.com/anthropics/claude-code/issues/44678)). The strict `<group>-` prefix is the working substitute — typing `/flow:bug-` autocompletes only the bug-\* members.

- 453e66e: Add `integrations.changelog` to flow's config schema and ship two new commands:

  - `/flow:release-changelog` — provider-dispatched authoring (Changesets implemented end-to-end; `git-cliff`, `conventional`, and `custom` enum values stub to "not yet implemented" until their own follow-ups land).
  - `/flow:release` — walks a project-owned Markdown runbook at `integrations.changelog.releaseGuide` (default `.ai/release-guide.md`) step-by-step, never auto-runs, prompts `[run] / [skip] / [edit] / [abort]` per fenced bash block. Provider-agnostic by design — see DDR-003.

  Also: `/flow:validate` gains a non-blocking changelog-hygiene warning; `/flow:done` gains an overridable reminder; `/flow:onboard` auto-detects the provider from filesystem markers (`.changeset/config.json`, `cliff.toml`) and scaffolds the runbook; `mdcc init --provider <name>` propagates the choice into both the config file and the runbook stub. `/flow:execute` and `/flow:quick` no longer hardcode "changeset" — both reference `integrations.changelog.provider`.
