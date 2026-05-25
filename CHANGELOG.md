# @1agh/maude

## 0.17.2

### Patch Changes

- 4ad09d6: **fix(dev-server): work around Bun 1.3.4+ `--compile` NAPI embedding regression**

  Every `@1agh/maude-<slug>` binary published since v0.17.0 crashed on startup
  with `Cannot find native binding ... oxc-parser/src-js/bindings.js:575`. Root
  cause: Bun 1.3.4 introduced a regression in `bun build --compile` that no
  longer embeds NAPI-RS platform sub-package bindings (the
  `@oxc-parser/binding-<slug>/parser.<slug>.node` asset). Bun 1.3.3 worked;
  1.3.4 through 1.3.14 (the version `setup-bun@v2` shipped to CI) all break the
  same way. Confirmed via bisect.

  The fix is a build-layer workaround that keeps oxc-parser intact (no parser
  swap, no perf regression, no edits to `canvas-pipeline.ts` /
  `canvas-edit.ts` / `canvas-lib-inline.ts` / `handoff.ts`):

  - `build.ts:writeCompileEntry(target)` generates two thin files per `--target`
    under `dist/.compile-entries/` (gitignored): an `init-oxc-<slug>.ts` leaf
    module that embeds the matching platform binding as an asset via
    `with { type: 'file' }` and sets `NAPI_RS_NATIVE_LIBRARY_PATH` from the
    resolved virtual path, then a `server-<slug>.ts` entry that imports the
    init module BEFORE `../../server.ts`.
  - NAPI-RS's `bindings.js` honors `NAPI_RS_NATIVE_LIBRARY_PATH` before its
    broken platform-detection switch, so the env-var setup bypasses the
    regression entirely.
  - All 7 `@oxc-parser/binding-<slug>` packages are now direct devDependencies
    of `plugins/design/dev-server/` so pnpm symlinks them at workspace level
    (Bun's bundler can't otherwise resolve them — pnpm hides them inside
    oxc-parser's nested node_modules as transitive optionalDependencies).
  - New `test/compile-entry.test.ts` (6 tests, 62 expectations) locks the
    generator's contract: per-target file paths, init-before-server import
    order, POSIX path separators, idempotence.

  See DDR-042 for the full options matrix (why not babel, why not subprocess,
  why not external + ship). Upstream Bun issue filed (draft in
  `.ai/dev-logs/upstream-bun-issue-draft.md`) — when fixed upstream, the entry
  stub generation can be removed.

- a6c76b0: **fix(cli): make `maude design serve` work when postinstall was skipped**

  `runServe` now resolves the platform binary lazily when the side-channel file
  (`cli/.platform-binary-path`) is absent — looks up the sibling `@1agh/maude-<slug>` package via filesystem + `require.resolve`, then caches the result.
  Postinstall becomes an optimization, not a correctness requirement, so global
  installs under Bun (no postinstall by default), `npm --ignore-scripts`, pnpm
  strict-scripts, and Docker layer rebuilds work the same as a vanilla
  `npm i -g @1agh/maude`.

  When no binary is available **and** we're not in a local source checkout
  (`packages/maude-darwin-arm64/` marker), the dispatcher hard-fails with an
  actionable hint (clean reinstall recipe + `npm rebuild` alternative) instead of
  falling through to `bun run server.ts` and crashing on missing `magic-string`
  or `oxc-parser` native bindings — those `node_modules` are not in the
  published tarball.

  In a local dev tree the source fallback is preserved, but a pre-flight check
  verifies `magic-string` and `oxc-parser` are resolvable first and surfaces a
  `pnpm install` hint instead of a cryptic stack trace if they're not (catches
  the npm optional-deps native-binding bug, npm#4828).

  Adds `MAUDE_FORCE_SOURCE=1` env override so maintainers hacking on
  `plugins/design/dev-server/` can skip the binary and run from source.

## 0.17.1

### Patch Changes

- 4a0d6ab: Fix: `bun build --compile` of the dev-server standalone binary failed for all 7 platforms in v0.17.0 because `exporters/pptx.ts` did `await import('playwright')` directly. Bun's compile is greedy and pulled in `chromium-bidi/lib/cjs/bidiMapper/BidiMapper` + `cdp/CdpConnection`, which it can't resolve at compile time.

  The other five exporters (png/pdf/svg/html/canva) already avoid this by spawning `bin/_*-playwright.mjs` as a `node` subprocess. PPTX was the anomaly: it ran a one-shot `chromium.launch()` inline to enumerate `[data-dc-screen]` IDs for canvas-as-separate merge.

  Fix: extract the enumeration into `bin/_enumerate-artboards-playwright.mjs` (new shim that prints one ID per line on stdout) and spawn it via `Bun.spawn(['node', ...])`. Matches the existing subprocess pattern, keeps playwright + chromium-bidi out of the compiled binary graph.

  Locally verified: `bun run build.ts --release` succeeds (162ms compile, 293 modules), 334/334 dev-server tests pass, biome clean.

## 0.17.0

### Minor Changes

- 63bb9fb: Video pipeline infrastructure (phase 15.1) — Remotion workspace under `scripts/video/final/` with nested deps + TikTok-style captioning pipeline + animation libraries + golden-frame regression harness + scaffolder + CSS motion guard + VHS tape discipline + visual QA workflow.

  What ships:

  - **`scripts/video/final/`** standalone Remotion workspace (own `package.json`, `tsconfig.json`, `remotion.config.ts`, Studio entry). Remotion + React deps move out of repo root.
  - **Cherry-picked TikTok captioning** at `src/lib/captioned-clip/` (`Page.tsx` + `SubtitlePage.tsx` + `<CaptionedClip>` wrapper) backed by `@remotion/install-whisper-cpp` + `sub.mjs` build-time pipeline. Caption JSON is editable for Whisper mistranscriptions.
  - **Animation libraries** re-exported through `src/lib/animated/` (`remotion-bits` + `remotion-animated`) — `<AnimatedText>`, `<Animated by={[Fade, Move, Scale]}>` etc. on one import surface.
  - **Reusable capture wrappers** at `src/lib/capture-frames/` — `<TerminalFrame src=...>` (VHS-captured terminal in shadowed inset) + `<BrowserChrome src=... urlBar=...>` (Playwright capture in mock browser chrome with traffic lights + URL bar).
  - **Golden-frame regression harness** (`__tests__/frame-regression.test.ts`) via `@remotion/renderer` `renderStill()` + `pixelmatch`. 18 baseline PNGs cover 6 compositions × 3 frames each.
  - **Visual QA workflow** — `pnpm run qa` renders a composition, extracts 12 evenly-spaced JPGs, builds a 4×3 contact sheet. Agent-readable paths (`QA_FRAME <path>`) + human-eyeballable PNG. Mandatory before delivering a final cut.
  - **CSS motion guard** (`scripts/check-css-motion.sh`) catches `transition:` / `animation:` in inline styles — the documented Remotion footgun that produces broken frames.
  - **VHS tape discipline** — `tapes/_TEMPLATE.tape` canonical template with 1280×720 canvas + Hide+clear+Show pattern baked in; `scripts/check-tape-discipline.sh` lints `tapes/*.tape` for both gotchas. Run via `pnpm run lint:tape`.
  - **`/flow:video-new-scene` scaffolder** — `<scene-id> <duration> "<caption>"` → generates scene folder + Root.tsx composition entry + storyboard row. Idempotent (`--force` to overwrite).
  - **Music manifest scaffold** at `scripts/video/music/MANIFEST.md` — placeholder structure + curation guidelines (Pixabay / FMA / Mixkit), license URL mandatory per track.
  - **DDR-036** records the architectural decisions + the three real-assembly gotchas (VHS Hide buffer leak, Playwright viewport mismatch, why per-scene goldens can't regress captures).
  - **Phase 15.5 plan** banner injection so it picks up the new infrastructure.

  Out of scope / deferred:

  - Real CC0 music track curation (manifest is placeholder).
  - Whisper.cpp model download smoke (~466 MB) — captioning tested with hand-crafted Caption JSON.
  - GitHub Actions video-render workflow (user explicitly opted out; deferred design in plan).
  - Phase 15.5 task-list rewrite (banner is enough; the user already rewrote it on a separate track).

  Infrastructure-only release — no user-facing CLI / dev-server / plugin behavior change.

- 799d939: Phase 6.5 — Canvas export (UI-first, multi-format, scope-aware). One export dialog covers seven formats × four scopes from the canvas UI plus a matching CLI subcommand.

  What ships:

  - **`/design:export` slash command** and **`maude design export`** CLI subcommand — same flag surface (`--format`, `--scope`, `--out`).
  - **In-canvas Export dialog** (`plugins/design/dev-server/export-dialog.tsx`) wired into canvas-shell and the floating chrome.
  - **Seven formats**: PNG, PDF, SVG, HTML (self-contained), PPTX, Canva (handoff PPTX + MCP-ready prompt file per [feedback-mcp-prompt-over-oauth-scaffolding](../memory/feedback-mcp-prompt-over-oauth-scaffolding.md)), ZIP bundle.
  - **Four scopes**: active artboard, active screen, active canvas, all canvases in current DS.
  - **Exporter pipeline** under `plugins/design/dev-server/exporters/` — playwright-driven PNG/PDF/SVG/HTML/PPTX renderers + scope resolver + browser-bundle reuse + history recorder.
  - **Server API** `POST /export` on the dev-server (`http.ts` + `api.ts`) with history persisted under `<designRoot>/_history/_exports/`.
  - **DDRs**: DDR-038 SVG via foreignObject, DDR-039 PPTX via pptxgenjs (superseded), DDR-040 Canva via PPTX + MCP prompt, DDR-041 v2 mature-libraries world reset.
  - **Tests**: 7 bun:test suites under `plugins/design/dev-server/test/exporters/` covering scope resolution, endpoint contract, history, Canva handoff, PPTX render. 334/334 green.

  User-visible: new commands, new dev-server dialog, new on-disk artifacts under `_history/_exports/`. No breaking changes to existing canvas / dev-server APIs.

### Patch Changes

- 799d939: Dev-server floating chrome: unify menubar / statusbar / tool-palette / annotations toolbar onto the `mb-dropdown` brand stamp and block the native context menu over canvas surfaces.

  - Right-click on canvas / iframe / floating chrome now always opens `.dc-context-menu` instead of the browser's native menu (which was leaking on top of, or instead of, our menu).
  - Inputs, textareas, and `contentEditable` elements keep the native context menu so copy / paste still works.
  - Visual: floating chrome surfaces share the same SKU-stamped dropdown skin (`annotations-context-toolbar`, `annotations-layer`, `canvas-lib`, `context-menu`, `tool-palette`, `inspect.ts`, `server.mjs`).

## 0.16.0

### Minor Changes

- 462e95b: design: in-place FigJam-style comments — pins, composer, thread popover, @mention autocomplete

  The comment composer + chip strip moved off the shell BottomBar and into the canvas iframe itself. Clicking an element in the Comment tool now opens a small DS-styled composer bubble anchored to the click point; pins render as 24×24 accent-fill badges at the target element's top-right corner; clicking a pin opens a thread popover with replies, resolve / reopen / delete, and an `@`-trigger autocomplete fed by the local repo's `git shortlog`.

  Schema additions (back-compatible — legacy comments default-fill on read, persist on next write):

  - `Comment.author` — defaults to `git config user.name` at create time
  - `Comment.thread: Reply[]` — `{ id, author, body, created }`
  - `Comment.mentions: string[]` — `@handle` tokens parsed across body + thread

  New HTTP endpoints (Bun runtime, per DDR-009):

  - `POST /_api/comments/<id>/reply` — append to thread, fold @mentions into the union
  - `GET /_api/git-committers` — committer list for the @mention popup, cached 60 s server-side

  Architecture: the overlay renders as a `position: fixed` sibling of `.dc-canvas` (NOT portaled into `.dc-world`) so its z-index actually competes with `SelectionHalos`. Pins stay 24 px at every zoom level, FigJam-style. See [DDR-034](.ai/decisions/DDR-034-comments-overlay-screen-coord-fixed-position.md) for the architectural rationale.

  A11y: comment pin is a `<button>` with `aria-label`; thread popover is `role="dialog"` with focus management + Esc-to-close + focus-restore to the originating pin; mention popup uses the WAI-ARIA combobox-with-listbox pattern.

- c9278b2: **Project renamed `md-claude` → Maude.** Atomic rebrand across the npm package, GitHub repo, Claude Code marketplace, CLI binary, dev-server runtime, docs site, and self-dogfooding directories. See [`docs/MIGRATING-MD-CLAUDE-TO-MAUDE.md`](../docs/MIGRATING-MD-CLAUDE-TO-MAUDE.md) and [DDR-032](../.ai/decisions/DDR-032-rename-md-claude-to-maude.md).

  User-visible changes:

  - **npm**: `@1agh/md-claude` → `@1agh/maude`; 7 per-platform sub-packages renamed in lockstep (`@1agh/maude-<slug>`). The old package was unpublished within npm's 72h grace window — `npm i -g @1agh/md-claude` now 404s.
  - **GitHub**: repo `1aGh/md-claude` → `1aGh/maude` (GitHub 301-redirects raw URL fetches; marketplace install needs to be re-added by hand because the marketplace `name:` field changed).
  - **CLI**: primary bin is `maude` (`maude init`, `maude config`, `maude design serve`). The legacy `mdcc` bin still ships as a deprecation-warning shim and will be removed in v0.17.x. Same for `mdcc-safe` → `maude-safe`. `MD_CLAUDE_SKIP_POSTINSTALL` env var renamed to `MAUDE_SKIP_POSTINSTALL` (old name accepted one cycle).
  - **Marketplace install syntax**: `flow@md-claude` → `flow@maude`, `design@md-claude` → `design@maude`.
  - **Canvas-lib virtual specifier**: `@mdcc/canvas-lib` → `@maude/canvas-lib`. TSX canvases must update their import statements; the dev-server resolver no longer matches the old name.
  - **Workspace scopes** (internal pnpm): `@md-claude/site`, `@md-claude/dev-server`, `@md-claude/hub` → `@maude/*`.
  - **Docs site canonical host**: `maude.iagh.cz` (DNS + Vercel wiring is a post-merge maintainer task).

  Intentionally preserved as internal namespaces (DDR-032 sub-decision 2): CSS class identifiers `.mdcc-*`, CSS custom properties `--mdcc-*`, the `site/components/mdcc/` path, the `~/.config/mdcc/` XDG config directory, and `site/app/mdcc-tokens.css`.

- 591f9a8: flow: Add security review subagents — defender (`security-auditor`) for OWASP-class static scans + attacker (`ethical-hacker`) for adversarial threat modeling including AI/MCP attack surface (prompt injection, MCP tool poisoning, confused-deputy, the trifecta). New skill `security-rules` (67 hard-stops across classic + AI-era), new command `/flow:validate-security`, and hooks into `/flow:validate` (step 6.5), `/flow:review-code`, `/flow:done`. New config: top-level `security.{severityFloor,scope,includeAi}` + `skills.securityRules.enabled` (defaults sane; downstream projects get it for free via `mdcc init`).
- 2c90eb1: **`/design:setup-ds` rewritten as 3-stage discovery (Vision → Research → Refinement).** Replaces the v1 12-question fixed dotazník (3 rounds — Identity / Brand / Pro-designer) with a conversational small-step flow that moves from abstract to concrete the way a human designer talks to a stakeholder. See [DDR-033](../.ai/decisions/DDR-033-three-stage-discovery.md) for full reasoning.

  User-visible changes:

  - **Stage 0 — Scope gate.** One picker (`market` / `internal` / `personal` / `oss`) up front, steers Stage 1 wording + post-scaffold aspiration target. The only hardcoded picker in the whole flow.
  - **Stage 1 — Vision.** 11 conversational free-text prompts in 3 batches (PŘÍPRAVA · PROSTOR · DUŠE), emitted as plain prose chat messages with one example per prompt. `skip` is always a valid answer. Output = rich `vision-brief.json`. Pastier's framework (Zrcadlo · Facka · Ulice · Kmen · Zkratka · Charakter · OST) templates the prompts but is invisible in the UI.
  - **Stage 2 — Research.** `ux-research-agent` now receives the full vision-brief (was: one-liner). Returns the existing `discovery` payload plus a new `recommendations` block with `{recommendation, alternatives[], confidence, rationale}` per design decision (palette / typography / signature_treatment / majak_3_codes / density / voice). Pastier probe templates live at `plugins/design/skills/design-system/_pastier-probe-templates.md`.
  - **Stage 3 — Refinement.** Adaptive 0–N AskUserQuestion picks driven by confidence: `≥ 0.85` SKIP / `0.60–0.85` ASK with pre-pick / `< 0.60` ASK without pre-pick. Maják 3-code combination is always a Stage 3 Q. **Zero hardcoded fallback ladders** — if research fails entirely, flow STOPS (re-run / abort), no degradation.
  - **`<brief>` argument shortcut.** Rich `/design:setup-ds <name> "<paragraph>"` invocations pre-fill matching vision-brief fields and skip those Stage 1 prompts (each skip printed inline so user can correct).
  - **`--quick` semantics.** Now collapses Stage 1 to 4 prompts (P1 + P5 + P8 + P10) instead of skipping pre-DDR-033 Round 3.
  - **Post-scaffold critic panel rebranded as "4 kola značky"** (rename only, no agent-code changes): **Kolo 1 — Srozumitelnost** (completeness + a11y), **Kolo 2 — Atraktivita** (graphic-design + signature-moment), **Kolo 3 — Konzistence** (typography + brand + copy). Pastier's fourth kolo (Frekvence) is dropped — outside DS surface.

  Re-bootstrap of existing DSes is lossy on Stage 1 fields (existing DSes don't carry `vision-brief.json`); skill infers from README + tokens + `_layout.css`, user confirms / corrects in a single chat message before Stage 2 runs. `--force` always re-runs Stage 2.

  v1 reference preserved at `plugins/design/skills/design-system/_DISCOVERY-v1.md` for a transition window.

### Patch Changes

- ce72771: flow: Brownfield testing onboarding — three opt-in/advisory additions to make the flow plugin friendlier on existing repos with no test runner or thin coverage. (1) `flow:test-coverage` subagent gains `path <glob>` and `branch` scope modes alongside the existing `diff` default — unblocks brownfield audits like "audit `apps/api/auth/`" without abusing the diff mode; path/branch reports are framed as advisory (no "blockers" count). (2) `/flow:init` Step 2c surfaces a stack-appropriate test-runner recommendation when detection returns `tests=unknown` (vitest for Next/Vite, jest for Expo, pytest, go-test, cargo-test, JUnit) — recommendation only, no scaffolding. (3) `/flow:done` Step 7a refreshes `.ai/state/coverage-baseline.json` on the configured `baselineBranch` (default `main`) when `skills.coverageTrend.enabled` — pairs with the coverage-trend warning already in `/flow:validate` Step 2a. All three are opt-in / advisory by design; the testing-rules iron law still owns greenfield TDD discipline.
- 38de33e: chore: Set up agentic video pipeline toolchain in `scripts/video/` (repo-only, not published to npm). Installs Remotion 4 + VHS 0.11 + Playwright 1.60 + ffmpeg 8.1 and proves they integrate via `pnpm run video:smoke` — a ~13s stitched proof clip (VHS terminal scene + Playwright dev-server canvas + Remotion smoke card, normalized + concatenated). Adds `scripts/video/README.md` runbook + DDR-031 documenting the toolchain choice (rejects custom bash pipeline; ~50–60% less code than the original hand-rolled ladder). Refactors the follow-up plan (`.ai/plans/phase-15.5-marketing-demo-video-30s.md`) to consume the new declarative stack. No user-visible behavior change — this lands the infrastructure the next phase needs to author the 30s marketing demo.

> Renamed from `@1agh/md-claude` in v0.15.0. See [`docs/MIGRATING-MD-CLAUDE-TO-MAUDE.md`](docs/MIGRATING-MD-CLAUDE-TO-MAUDE.md). Historic entries below reference the old name as a matter of record.

## 0.15.0

### Major Changes

- **Project renamed `md-claude` → Maude.** Atomic rebrand across npm, GitHub repo, marketplace, CLI, dev-server, site, docs, and self-dogfooding directories. See [DDR-032](.ai/decisions/DDR-032-rename-md-claude-to-maude.md) and the [migration guide](docs/MIGRATING-MD-CLAUDE-TO-MAUDE.md).
- **npm**: `@1agh/md-claude` → `@1agh/maude` (old package unpublished within 72h window). 7 per-platform sub-packages renamed in lockstep (`@1agh/maude-<slug>`).
- **GitHub**: repo `1aGh/md-claude` → `1aGh/maude` (301 redirect preserved).
- **CLI**: primary bin is now `maude` (`maude init`, `maude config`, `maude design serve`). The legacy `mdcc` bin still works as a deprecation-warning alias and will be dropped in v0.17.x. `MD_CLAUDE_SKIP_POSTINSTALL` env var renamed to `MAUDE_SKIP_POSTINSTALL` (old name accepted for one cycle).
- **Marketplace**: `/plugin marketplace add 1aGh/md-claude` → `/plugin marketplace add 1aGh/maude`. Plugin install syntax changed: `flow@md-claude` → `flow@maude`, `design@md-claude` → `design@maude`.
- **Workspace scopes**: internal pnpm workspaces `@md-claude/site`, `@md-claude/dev-server`, `@md-claude/hub` renamed to `@maude/*`.
- **Domain**: docs site canonical host moved to `maude.iagh.cz` (DNS + Vercel wiring done in post-merge step).
- **Canvas-lib virtual specifier renamed**: `@mdcc/canvas-lib` → `@maude/canvas-lib`. Any TSX canvas under a downstream `.design/` directory must update its `from "@mdcc/canvas-lib"` imports to `from "@maude/canvas-lib"` — the dev-server resolver no longer matches the old name.
- **Intentionally preserved as internal namespaces** (per DDR-032 sub-decision 2): CSS class identifiers `.mdcc-*`, CSS custom properties `--mdcc-*`, `site/components/mdcc/` paths, and the `~/.config/mdcc/` XDG config path.

## 0.14.0

### Minor Changes

- b069b9d: **Design plugin — dev-server sidebar restructure: sidecar nesting, per-DS folders, section toggles.**

  - **VS Code-style sidecar grouping.** `.tsx` canvases are the primary tree rows; `.meta.json` / `.css` / `.registry.json` siblings collapse under a disclosure chevron. Multi-extension match keeps `Foo.meta.json` correctly grouped with `Foo.tsx`. Canvas extensions are stripped in row labels, menubar status, and comments-panel group headers.
  - **Per-DS folders inside DESIGN SYSTEM section.** Every entry in `cfg.designSystems` renders as its own folder (`project`, `beta`, …) regardless of single- vs. multi-DS. Folder name opens SystemView for that DS; chevron toggles disclosure. Server emits `dsFolders[]` on the DS group so the client knows which dirs are DS roots.
  - **Every section is expandable.** `PROJECT`, `DESIGN SYSTEM`, `UI CANVASES`, and `RUNTIME` headers are all unified `section-toggle` buttons. Per-section open/collapsed state persists in one `mdcc-sections-expanded` localStorage key. Defaults: working sections (Project, UI canvases) open; meta sections (DS, Runtime) collapsed.
  - **View › Show hidden files (`H` shortcut).** Off by default — hides sidecars, the RUNTIME section, orphan project files, and DS-level docs (`README.md`, `SKILL.md`, `colors_and_type.css`). On reveals everything plus per-canvas chevrons for sidecar disclosure.
  - **DS pill counts DSes** (`pillFromDsCount`), replacing the hardcoded `MDCC-DSN/01` SKU stamp from the CV-08 mock. Multi-DS configs show `2`, `3`, ….
  - **Server `stripPrefix` redesign.** Flattens `.design/` for PROJECT/RUNTIME and `.design/<group.path>/` for canvas groups. DS folders surface as top-level dirs instead of the redundant `system/project` chain.
  - Removed the "Design system view" entry from the View dropdown — redundant with per-DS folder click + existing `S` shortcut.
  - Sidebar open/closed state now persisted (`mdcc-sidebar-open`).

- 5d9292e: **Design plugin — Phase 3.6.1: canvas envelope hygiene, reusable canvas-lib, HMR, and DS specimens as TSX.**

  - **`@maude/canvas-lib`** — shared canvas library (`<designRoot>/_lib/canvas-lib.tsx`) resolved virtually at build time. Ships the frame envelope (`DesignCanvas`, `DCSection`, `DCArtboard`, `DCPostIt`), specimen helpers (`SpecimenHeader`, `SpecimenMeta`, `TokenChip`, `ColorSwatch`, `TypeScaleRow`, `KbdHint`, `ThemeToggle`) and hooks (`useTokens`, `useTheme`, `useArtboardBounds`). Authored once, imported by canvases and specimens — `/design:handoff` inlines used exports per-canvas so the emitted registry-item stays self-contained.
  - **HMR** — `fs-watch` change events now broadcast `canvas-hmr` messages over the existing inspector WebSocket. CSS sibling edits hot-swap via `<link>` cache-bust; `_lib/**` edits trigger hard iframe reload; canvas `.tsx` edits do a module reload. Target p50 < 200 ms click-to-paint, p99 < 400 ms.
  - **DS specimens are now TSX**, not HTML. `/design:setup-ds` scaffolds bare-TSX specimens via the new `ds-specimen.tsx.template`; the `design-system-completeness-critic` and `design-system-keeper` agents read `.tsx`. The legacy `system/<ds>/preview/*.html` set is archived under `_history/_migration-2026-05-15/`.
  - **`/design:edit` Step 1.5** now also pre-loads `<designRoot>/_lib/canvas-lib.tsx` for every `.tsx` canvas so iteration prompts see the authoring vocabulary instead of re-inventing helpers.
  - **Fixes** the white-page regression in `Docs Site.tsx` / `Canvas Viewport.tsx` introduced by the Phase 3.6 codemod (which referenced `<DesignCanvas>` JSX identifiers that were undefined in TSX-land) and rebuilds `Smoke TSX.tsx` against the new envelope.
  - Adds `canvas-lib-resolver`, `canvas-lib-inline`, and `hmr-broadcast` modules to `plugins/design/dev-server/` with full Bun-test coverage.

- 0122207: **Design plugin — Phase 4.1: universal canvas input grammar (DDR-026).**

  Every TSX canvas now ships with the same infinite-canvas affordances out of the box — no opt-in flag, no two-grammar split. Replaces the Phase-4 Cmd-only inspector overlay selection path.

  - **Three canvas tools.** `V` Move (default), `H` Hand, `C` Comment — bottom-left floating ToolPalette + letter-key shortcuts. Scoped to canvas-iframe focus (don't collide with shell shortcuts).
  - **Selection grammar.** `Cmd + hover` previews the deepest element under cursor. `Cmd + click` selects (replace). `Cmd + Shift + click` adds to a multi-selection (dashed group bounding box renders around the union). Bare hover / click pass through — native interactions (button presses, link clicks, input focus) still work in Move tool. Selection halos render as `position: fixed` overlays in screen coords, so 2 px stays 2 px regardless of zoom level.
  - **Hand tool.** Bare drag pans the world — no Space required. Cursor forced to `grab` across every descendant (overrides element-level `cursor: pointer` declarations on buttons / links).
  - **Comment tool.** Hover paints a preview halo on the element under cursor. Click commits that element to the selection set AND opens the shell-side composer for it; the halo persists until Submit / Cancel / Esc. Native interactions on artboard children are fully suppressed via capture-phase `preventDefault + stopImmediatePropagation` — buttons / inputs don't activate while in comment mode.
  - **Right-click context menu.** Element / artboard chrome / world contexts. Items include `Add comment`, `Copy CSS`, `Copy data-cd-id`, `Hide`, `Deselect`, `Fit just this artboard`, `Fit to view`, `Reset view`. Full keyboard navigation (Arrow Up/Down / Enter / Esc), shortcut hints right-aligned in monospace.
  - **Active-artboard indicator.** Subtle 1 px tinted accent ring on the artboard closest to the viewport center — marks the `/design:edit` context anchor without competing with selection halos.
  - **`_active.json#selected` schema widening.** Now accepts `SelectedElement | SelectedElement[] | null`. Writer collapses single-entry arrays to a bare object for back-compat with `/design:edit` and handoff tooling. Reader (`normalizeSelectedRead`) accepts all three shapes.
  - **Inspector overlay slimmed to comment-pin renderer.** The legacy Cmd-hover / Cmd-click selection path (`.dgn-insp-hover` / `.dgn-insp-selected` cyan outline) is removed. Only `.dgn-pin*` styles + the `comments-set` / `comment-focus` message handlers remain. Comment pins still render on legacy `.html` mocks and on TSX canvases equally.
  - **Shell `.sel-halo` wrap removed.** The pre-Phase-4 2 px accent border that wrapped the entire iframe is gone — element-level halos in canvas-shell are the only selection visual now.

  **Decision evolution.** First draft of Phase 4.1 landed an opt-in `inputMode="figjam"` prop on `DesignCanvas`. After live smoke tests the decision flipped to universal grammar (visual-inconsistency feedback: cyan-with-label inspector overlay vs accent-no-label new router) + naming directive (`figjam` removed from public API). The full alternatives history lives in DDR-026.

  **No new dependencies.** All new modules are sibling files under `plugins/design/dev-server/`. Tree-shake-on-handoff still works via `canvas-lib-inline.ts` AST walker — drops carry the canvas-shell code as inlined source.

  `bun test` 185/185, 0 fail (133 baseline + 52 new tests across `input-router`, `use-tool-mode`, `use-selection-set`). `bunx tsc --noEmit` clean of new errors. Canvas-build smoke against Canvas Viewport / Docs Site / Smoke TSX all return 200 with consistent canvas-shell wiring.

- a771d04: **Design plugin — Phase 4.2: free-form artboard repositioning (DDR-027, DDR-028).**

  Artboards on the infinite canvas are now spatially editable. Phase 4 shipped the persistence infra; 4.2 plugs the drag-to-reposition UI surface into both that infra and the Phase 4.1 selection-set + tool-mode grammar.

  - **Drag the artboard chrome** (label strip + outer border) while the Move tool is active. Inner content stays click-through, so Cmd+select still works through it.
  - **Multi-select drag.** When the selection-set contains multiple artboard roots, dragging any one moves all selected artboards rigidly together — relative offsets captured at drag-start and preserved through snap.
  - **Snap-to-grid + snap-to-sibling.** 40 world-unit grid + 8 world-unit tolerance to other artboards' left / right / center on X (and top / bottom / center on Y). 1 px guide lines render at the snapped position in `--accent`. Independent per axis (X can snap to a sibling and Y to the grid simultaneously).
  - **Hold Alt to disable snap.** Per-pointermove modifier read; release Alt and guides reappear on the next move.
  - **Ghost preview.** Original artboards mute to opacity 0.3 (`.dc-dragging`); a semi-transparent clone at opacity 0.5 (`.dc-artboard-ghost`) follows the snapped cursor position. Drop commits.
  - **4 px click-vs-drag classifier.** Below threshold → label `onClick` fires (Phase 4 pan-to-focus regression-clean). At/above → drag starts, the synthetic click is suppressed via a one-shot capture-phase listener.
  - **Persistence on drop.** PATCH `meta.layout.artboards[]` via the existing `patchCanvasMeta` writer. Reload restores positions.
  - **Position-only writes (DDR-027).** The writer strips `w` / `h` from layout payload — artboard size is JSX-authoritative now. The reader still tolerates legacy entries with `w` / `h` for back-compat with Phase 4 default-grid snapshots; the next drag organically migrates them to position-only entries.
  - **Snap tolerance in world units (DDR-028).** Tolerance scales with the layout, not the screen, so snap feel stays consistent across zoom levels. `useSnapGuides` is a pure zoom-agnostic function.
  - **Cursor swap.** `grab` on label hover when active tool is `move`; `grabbing` during drag. Wired via the existing `.dc-canvas[data-active-tool="move"]` projection.

  **New modules.** `use-snap-guides.tsx` (pure snap math, 20 table tests) · `use-artboard-drag.tsx` (state-machine reducer + DOM hook, 20 unit tests) · `SnapGuideOverlay` export from `canvas-lib.tsx` mounted by `CanvasShell`.

  **Bug fixes (caught during visual smoke + code review + post-merge dogfooding).**

  - The reader in `DesignCanvasInner.artboards` `useMemo` previously replaced default-grid entries wholesale with meta entries. Once 4.2 writers started emitting position-only `{ id, x, y }`, the replace left `w` / `h` undefined → artboards rendered at 0×0. Reader now merges meta over defaults instead of replacing.
  - The drag hook used to call `setPointerCapture` on the outer article on pointerdown. That redirected the synthetic `click` event to the captured ancestor, breaking the label button's `onClick` → Phase 4 pan-to-focus regression. Capture removed; global window-level pointermove/up listeners (capture: true) carry the drag without it.
  - `selectedIds` in the drag hook fell back from `Selection.id` (a child element's `data-cd-id`) to `Selection.artboardId`. That pulled stray child cd-ids into the multi-drag identity set and silently disabled multi-artboard drag. New `selectionsToArtboardIds` helper now keys on `artboardId` only; covered by a regression test.
  - Drag commits PATCH'd the server but the local React state stayed frozen — users had to switch canvases to "see" the dropped artboard at its new position. `DesignCanvasInner.artboards` converted from `useMemo([seeds])` to `useState` with optimistic update on commit. Drop now reflects instantly in the DOM without an iframe reload.

  **Handoff regression-clean.** Drag + snap exports (`useArtboardDrag`, `SnapGuideOverlay`, `computeSnap`, `useSnapGuides`, `DragStateContext`) never travel into a handed-off registry item — the static-frame overrides for `DesignCanvas` / `DCArtboard` / `DCSection` break the transitive chain, pinned by 2 new tests in `handoff-static-frames.test.ts`.

  **Schema.** `canvas-meta.schema.json#layout.artboards[].required` narrows from `["id","x","y","w","h"]` to `["id","x","y"]`. `w` / `h` remain in `properties` as legacy read-only fields.

  `bun test` 239/239, 0 fail (baseline + 44 new across snap + drag + 1 canvas-meta-api + 2 handoff). `bunx tsc --noEmit` clean of new errors. Scenario `canvas-artboard-drag` authored at `.ai/scenarios/canvas-format-tsx/canvas-artboard-drag/spec.md`; manual web-desktop end-to-end smoke confirmed drag → snap → drop → reload round-trip with pin artboard at `{x: 1200, y: 1200}` post-reload, plus the post-merge instant-update fix (pin moved from `(0, 900)` → `(1414, 1400)` with DOM reflecting the change immediately on pointerup, no reload).

- 54dbe87: **Design plugin — Phase 4: canvas v2 infinite-canvas engine.**

  Every `.tsx` canvas under `<designRoot>/ui/` becomes a transformable world plane — `DCArtboard` children are absolutely positioned in world coords, the whole scene pans and zooms behind a single transform. Pan/zoom state survives reloads. The dev-server shell stays editor-style (one canvas active at a time, file-tab toggle); the infinite-canvas engine lives **inside** each canvas runtime, not at the shell level.

  - **`DesignCanvas` is now a world plane.** Internal `.dc-canvas` + `.dc-world` structure, render-order default grid (3 cols × max-cell-width × max-cell-height, 80 px gutter), per-cell sizing so canvases with mixed-width artboards tile cleanly. Single-artboard canvases default to fit-to-screen — visually identical to pre-Phase 4 until the user pans / zooms.
  - **`useViewportController` hook** — wheel = 2D pan (Mac trackpad gives both axes), Shift+wheel = horizontal pan (axis-swap robust across browsers/OSes), Ctrl/Cmd+wheel and pinch = zoom around cursor (mathematically exact — the world coord under the cursor stays fixed). Space-hold + drag and middle-mouse drag both pan. Cmd+0 fit, Cmd+1 actual size, Cmd+= / Cmd+- zoom in/out, Cmd+Option+1..9 jump-to-artboard N. Reduced-motion respected.
  - **`DCMiniMap` + `DCZoomToolbar`** — bottom-right 196×132 floating map with click-drag pan; bottom-center −/%/+/fit/1:1 toolbar. Mounted by default; opt-out via `<DesignCanvas controls={{minimap:false, toolbar:false}}>`.
  - **`DCArtboard` label is a focusable `<button>`** — click smooth-pans + zooms to fit just that artboard in 240 ms (rAF ease-out cubic; reduced-motion = instant). Active-artboard indicator (`aria-current="true"` + accent ring) tracks the artboard closest to viewport center.
  - **`<file>.meta.json` persistence** — `canvas-meta.schema.json` extended with optional `layout` + `viewport`. New `/_api/canvas-meta` GET/PATCH endpoint shallow-merges blocks (clamps zoom, rejects non-finite, refuses paths escaping repoRoot). `_shell.html` injects `window.__canvas_meta__`. `onSettle` PATCHes back 500 ms after the last input. 5 new tests pin the contract.
  - **Handoff stays clean.** `applyHandoffStaticOverrides()` in `handoff.ts` swaps `DesignCanvas` / `DCSection` / `DCArtboard` for minimal static-frame variants in the libMap before the canvas-lib BFS — engine code (`useViewportController`, `DCMiniMap`, `DCZoomToolbar`, `WorldContext`, harvest+grid+fit helpers) never reaches the emitted registry item. 4 dedicated tests pin the contract.
  - **Crisp text at any zoom.** The world uses CSS `zoom: N` (layout-level re-flow → text re-rasterizes at target resolution) instead of `transform: scale(N)` (which upsamples a cached layer and produces visible pixelation past zoom ~1.5). Pan velocity stays constant in screen px regardless of zoom.
  - **Pixi.js v8 added to the canvas runtime importmap.** Lazy-bundled at `/_canvas-runtime/pixi-js.js` (1.7 MB, only fetched by canvases that `import 'pixi.js'`). Reserved for the DDR-024-deferred snapshot-to-texture path and high-end designer overlays — current canvases don't need it because CSS `zoom` solves the crispness problem.
  - **DDR-024** captures the perf-gate methodology (`.design/_lab/perf-100-artboards.tsx` reference workload, idle / 5s pan / 10s zoom on M1 MBA, ≥ 20 % uplift over CSS to authorize Pixi.js engine swap). Pixi.js bundle stays deferred until a user-side bench fills the Measurements block.
  - **`_lib/` HMR cache invalidation fix.** When `_lib/canvas-lib.tsx` changes, the in-memory canvas bundle cache is cleared so the iframe reload picks up the fresh build. Without this, the HMR hard-reload message reached the browser but served stale-mtime-keyed bundles.
  - **Slug round-trip fix** in `runtime-bundle.ts`: package names with `.` (like `pixi.js`) now map to slugs with `-` (`pixi-js`) so the URL extension stays unambiguous.

  `bun test`: 123 baseline → 139 with 16 new Phase 4 tests, all green.

- b24726a: **Design plugin — Phase 5.1: FigJam-style annotation overhaul + canvas chrome redesign.**

  The Phase 5 draw layer was write-once: pen/rect/arrow strokes worked, but you couldn't re-select, re-style, move, or delete what you'd drawn, the viewport stuttered, and the dev-server menubar's `View / Selection / Tools` items were inert. Phase 5.1 brings annotations close to FigJam, with a single centered canvas toolbar that replaces the three floating chrome pieces.

  **Annotation rendering**

  - **Portal architecture.** The annotation SVG renders **inside** `.dc-world` via `createPortal`, so the world's CSS `zoom` + `translate` propagate to strokes natively — zero-latency pan/zoom (Phase 5's one-frame shimmer is gone). The input layer is a separate transparent overlay portaled into the host (`.dc-canvas`); viewport gestures (space-pan, middle-mouse, wheel/pinch) coexist with draw mode without `stopPropagation`. See `DDR-029`.
  - **New shapes.** `O` activates the ellipse tool. Rect + ellipse both gain a **fill picker** ("none" + 6-color palette). Pen + arrow gain a **thin / thick** thickness chip (2 px / 6 px). Schema is back-compatible — Phase 5 SVGs round-trip cleanly.
  - **Text-in-shape.** Double-click a selected rect or ellipse → `<foreignObject>` editor opens centered in the shape's bbox. Type your label, `Esc` commits; reload preserves. Font size step (S / M / L) lives in the contextual toolbar.

  **Annotation selection + editing**

  - **Parallel selection store.** `AnnotationSelectionProvider` mirrors `use-selection-set` for stroke IDs. Move-tool bare click on a stroke selects (replace), Shift+click adds. `Cmd / Cmd+Shift` falls through to the existing element-selection path (Phase 4.1 escape hatch preserved). Element + annotation selection don't co-exist visibly.
  - **Marquee drag-select.** In Move mode, drag from empty world → screen-coord rectangle expands as you drag; on release every stroke whose bbox intersects gets selected (Shift = additive). Sub-4-px gestures fall back to "click on empty world → clear".
  - **Contextual floating toolbar.** Per-shape FigJam-style toolbar anchored above the selection union bbox. Color (always), fill (rect/ellipse), thickness (pen/arrow), font-size (text), delete (always). Fields show the intersection across multi-select. Mutations route through a lifted strokes store and trigger the same debounced PUT save as drawing.
  - **Move / nudge / delete.** Drag a selected stroke (or the group) → world-coord translate, persists on release. Arrow keys nudge 1 unit (`Shift` = 10). `Backspace` / `Delete` removes selection.

  **Canvas chrome redesign**

  - **Single centered bottom toolbar** replaces `ToolPalette` + `DCZoomToolbar` (the bottom-right pill). Icon-based buttons grouped into three pill segments: nav (V/H/C) · draw (B/R/O/A/E) · view (presentation toggle + zoom display). Adopts the dev-server menubar's visual language (8 px radius, soft shadow, hairline border) so canvas chrome and app chrome read as one product. New `canvas-icons.tsx` ships a dependency-free Lucide-style icon set.
  - **Color/fill/thickness chrome** sits **directly above** the tool toolbar (centered) when a draw tool is active. Stripped of the Phase 5 "Hide" + "?" buttons — presentation lives on the main toolbar, annotation shortcuts live in the menubar `Help` modal.
  - **Minimap** restyled to the same chrome family (8 px radius, 24 px shadow), unchanged behavior.
  - **Zoom popover** absorbs the legacy `DCZoomToolbar`'s four actions (Zoom In / Out / Fit / Actual Size). Opens above the toolbar with shortcut hints. `DCZoomToolbar` is kept exported for back-compat but no longer rendered by `DesignCanvas`.

  **Dev-server menubar bridge**

  - `View → Annotations` toggles visibility (replaces the disabled "Phase 5" tag).
  - New `Selection` dropdown: `Deselect all` / `Select all annotations`.
  - New `Tools` dropdown: every tool with its shortcut, click → activates inside the canvas iframe via the existing `dgn:*` postMessage channel.
  - `HelpModal` gains an **Annotation tools** section so all 11 shortcuts (B/R/O/A/E, V+click, V+drag, double-click, arrow nudge, Backspace, Shift+P) live in one searchable place.

  **Runtime + build**

  - `react-dom` is now its own runtime bundle (was aliased to `react-dom/client`, which omits `createPortal`). Importmap routes `react-dom` → `/_canvas-runtime/react-dom.js`. See `DDR-029`.
  - New annotation modules: `use-annotation-selection.tsx`, `use-annotations-visibility.tsx`, `annotations-context-toolbar.tsx`, `canvas-icons.tsx`.
  - New `.gitignore` rule for `.design/**/*.annotations.svg` (per-canvas review scratch is user-local, not source).
  - `bun test` 287/287 pass (+18 over Phase 5 baseline). `bunx tsc --noEmit` clean (modulo 2 pre-existing `api.ts` errors).
  - New scenario `canvas-annotations-figjam` (14-step web-desktop walkthrough); supersedes Phase 5's `canvas-annotations`.
  - `DDR-029` recorded — annotation overlay architecture (portal into world, large SVG dimensions, react-dom bundle split).

- cc0ba03: **Design plugin — Phase 5: draw / annotation tools.**

  Annotate any canvas without leaving the dev-server. Pen, rectangle, arrow, and eraser tools mount as a transparent SVG overlay per canvas, persist to `<designRoot>/<slug>.annotations.svg`, and respect the Phase 4.1 tool grammar (V/H/C still rule; B/R/A/E switch into draw modes).

  - **Four shapes.** Pen freehand (multi-point path), rectangle (drag-to-size, negative areas auto-normalize), arrow (line + tri head), eraser (click or drag — hit-tests every stroke shape, removes the topmost match).
  - **Per-stroke color** via a 6-swatch floating chrome (accent · amber · green · blue · purple · ink). Default to the DS accent. Swatch only visible while an annotation tool is active.
  - **World-coord storage.** Strokes are stamped in world coordinates and rendered via the live viewport published by `useViewportControllerContext`; `vector-effect="non-scaling-stroke"` keeps stroke widths pixel-thick across zoom.
  - **Persistence.** Debounced 200 ms PUT to new `/_api/annotations` endpoint (`GET ?file=<canvas>` → SVG body; `PUT { file, svg }` → 204). Server writes `<designRoot>/<slug>.annotations.svg` (1 MB cap, SVG content gate). Reload restores every stroke; each canvas owns its own file (cross-canvas isolation).
  - **Shortcuts.** `B` = pen, `R` = rect, `A` = arrow, `E` = eraser, `V` = back to move, `Esc` = also back to move + clears in-flight. `Shift+P` toggles presentation (hides the layer without writing). `Cmd+/` opens a native `<dialog>` shortcut sheet.
  - **Coexistence with Phase 4.1.** Cmd+click in any draw mode still routes through the input-router's element selection (escape hatch). Pointer events on annotation tools return `no-op` from the router so the SVG layer claims them natively; on non-draw tools the SVG is `pointer-events: none` and the full Phase 4 / 4.1 grammar passes through.
  - **Help dialog uses native `<dialog>`.** Auto-opened with `.showModal()`, dismissed by Esc or backdrop click. Backdrop styled via `::backdrop` so the scrim follows the modal's stacking context cleanly.

  **New modules.** `annotations-layer.tsx` (~640 LOC — overlay + chrome + state machine + persistence client). New helpers exported for unit tests: `penPathD`, `arrowHeadPoints`, `strokesToSvg`, `svgToStrokes`, `strokeHitTest`, `rid`.

  **Server surface.** `api.ts` adds `loadAnnotations` / `saveAnnotations`. `http.ts` adds the `/_api/annotations` route (`GET` / `PUT` / `POST`, returns 400 on non-SVG bodies, 405 on other methods, 1 MB body cap).

  **Tool grammar.** `Tool` union extends to `pen | rect | arrow | eraser` with the `isAnnotationTool()` helper. `DEFAULT_TOOLS` grows to 7 (V/H/C/B/R/A/E). `canvas-shell.tsx` extends the cursor projection (`crosshair` for pen/rect/arrow, `cell` for eraser).

  **Tests.** 30 new tests across `test/annotations-layer.test.ts` (pure helpers: path / head / hit-test / round-trip / escape) and `test/annotations-api.test.ts` (endpoint round-trip + validation gates). `bun test` 269/269 pass (+30). Existing input-router and use-tool-mode tests extend for the new tool set.

  **Scenario.** `canvas-annotations` authored at `.ai/scenarios/canvas-format-tsx/canvas-annotations/spec.md`; smoke piloted against `localhost:4399` via agent-browser (PUT/GET round-trip + reload-restore + cross-canvas isolation verified end-to-end; eraser + Shift+P / Cmd+/ noted as harness limitations covered by unit tests).

  **Known limitations (entry point for Phase 5.1).** Pan/zoom is blocked in draw mode (the SVG claims pointer events). Strokes can't be selected, moved, or restyled after commit. No ellipse tool, no inline text inside shapes, no background fill, single thickness. The Phase 5.1 plan at `.ai/plans/phase-5.1-annotations-figjam.md` covers all of these plus a canvas-chrome redesign (centered icon toolbar replacing the current bottom-left palette).

### Patch Changes

- bf3b399: **Design plugin — Phase 4.0.5: canvas-lib single source in dev-server (DDR-025).**

  Internal refactor — zero behavior change for canvas authors (handoff drop is byte-identical), but plugin-author ergonomics + downstream-project filesystem layout shift.

  - **canvas-lib relocated.** The shared canvas library (`DesignCanvas`, `DCSection`, `DCArtboard`, `DCPostIt`, specimen helpers, hooks) now lives at `plugins/design/dev-server/canvas-lib.tsx` and ships with the dev-server install. Three prior copies — `plugins/design/templates/canvas-lib.tsx.template`, the dogfood `.design/_lib/canvas-lib.tsx`, and every initialized project's scaffolded `<designRoot>/_lib/canvas-lib.tsx` — collapse to one. Plugin releases now reach end users automatically.
  - **Bootstrap drops the canvas-lib scaffold step.** `design-system/SKILL.md` Round-0 Batch-A step 0 deleted. `/design:setup-ds` no longer writes a `_lib/` directory in the project; the virtual specifier `@maude/canvas-lib` resolves directly to the dev-server-bundled file at canvas build time.
  - **Legacy `<designRoot>/_lib/canvas-lib.tsx` deprecation guard.** Downstream projects with a pre-4.0.5 `_lib/canvas-lib.tsx` get a one-shot warning log per dev-server boot (`[canvas-lib] Legacy … detected …`); the project file is **ignored** and the dev-server-bundled lib is authoritative. After two minor versions the warning becomes silent and the fallback comment is removed.
  - **Perf fixture relocated.** `.design/_lab/perf-100-artboards.tsx` → `plugins/design/dev-server/examples/perf-100-artboards.tsx` with sibling `README.md`. The fixture is dev-server tooling, not user content — keeping it in `.design/_lab/` mislabeled the boundary.
  - **canvas-lib HMR.** When `plugins/design/dev-server/canvas-lib.tsx` is edited, the http-layer file-watcher clears the canvas bundle cache and emits a synthetic `_lib/canvas-lib.tsx` event so the existing hmr-broadcast classifier emits the same hard-reload message every open iframe was already wired for. No bespoke client-side wiring.
  - **DDR-022 partially superseded by DDR-025.** "Two-state model" (virtual specifier at author time, AST-inlined at handoff time) stands; only the _physical home_ of the canonical source changed. Header annotation added to DDR-022.

  `bun test`: 133/133 (4 tests in `canvas-lib-resolver.test.ts` rewritten to match the new contract — old assertion was `canvasLibPath('/foo/bar') === '/foo/bar/_lib/canvas-lib.tsx'`; new contract is `canvasLibPath()` returns the dev-server-internal path; new legacy-guard test asserts a planted bogus `<designRoot>/_lib/canvas-lib.tsx` is ignored). Handoff drop sha1-identical to pre-relocation baseline.

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
