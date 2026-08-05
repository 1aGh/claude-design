---
name: production-grade-hardening
status: active
created: 2026-08-05
decisions:
  - kg:debate-production-grade-stack-direction (divergent debate, 2026-08-05, converged 3-0)
  - kg:debate-shared-layer-architecture (divergent debate round 2, 2026-08-05, converged 4-0 — import spine / vendor edge)
  - kg:debate-maturity-escalation (round 3 + online research, 2026-08-05, 4-0 escalate — verification reach, release integrity, DTCG; canary resolved via cross-challenge)
---

# Feature: Production-grade hardening & decomposition (the stack stays)

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports.

## Description

The maintainer's ask was: rewrite most apps onto Vite + React + Tailwind, possibly adopt Turborepo, and build shared UI/utils libraries — "z tohoto repa udelejme kvalitni, rychly a produkcni kod a ne jen MVP."

A divergent debate (BUILDER / SHIPPER / BREAKER, blind openings) **converged 3-0 against the wholesale stack swap** and 3-0 **for** a gates-first hardening program. The pain is real; the cure is different:

- The studio client is **already React** — but `client/app.jsx` is 15,378 lines (33,891 lines JSX/JS + 10,554 CSS client-wide) with **zero tests, excluded from lint (`biome.jsonc` `"!**/apps/studio/client"`), and untypechecked** (`allowJs` without `checkJs`).
- The repo is **already a pnpm monorepo** (6 workspace members). Turborepo would be an orchestrator over `pnpm -r --filter`, which already fans out — the "redundant tooling over pnpm" pattern the maintainer has explicitly rejected before. Its one win (caching) is the v0.22.0 failure class (stale artifact overwrites good artifact).
- **Vite cannot replace `Bun.build` here**: the dev server IS a bundler — canvases compile at request time inside a `bun --compile` standalone binary on machines guaranteed to have no node/bun/node_modules (DDR-009, DDR-177). `Bun.build` is called from 13 non-test modules; `@maude/canvas-lib` is a virtual specifier resolved by the server's own build plugin (DDR-025). "Vite for the shell" = two bundlers sharing React through one importmap — a new seam of exactly the class that produced **all six** shipped release breaks (v0.18.0/.1, v0.22.0, v0.44.0/.45.0, v0.51.0, v0.51.1). Zero of those were app logic.
- **Tailwind already lives where it belongs** (`site/`, v4). The `--bg-0..4` / `--fg-0..3` token vocabulary is a **public contract** for every downstream canvas and 20+ DS templates (DDR-043) — Tailwind must consume that contract, never re-author it.
- The real duplication is not "apps written twice": cloud↔hub route "duplicates" share 12–14 identical lines out of 400–1,100 (different runtimes — share **primitives**, not routes, per the DDR-054 trust boundary). The duplication the repo actually pays for: the `-maude` **CSS theme forks** (`1-tokens`/`3-shell`/`4-components` + `-maude` pairs), the token vocabulary **re-declared inline in 4 cloud page modules**, the **three hand-synced runtime-state lists** (drifted once already), and the **five version manifests**.

So: make the client observable → decompose it in place → dedupe what is actually duplicated into workspace packages. Same bundler, same artifacts, same contracts.

**Round 2 — shared layer (4 seats: BUILDER / SHIPPER / BREAKER / USER-ADVOCATE, blind openings) converged 4-0: `import` is the spine for internal apps; `vendor` (design:handoff) stays the edge protocol for downstream users and everything crossing the DDR-054 trust boundary.** The seats' own verification corrected the round-1 duplication brief twice:

- *base64url ×5* dissolves: hub calls the Node builtin (`Buffer.toString('base64url')`), cloud hand-rolls one 4-line Workers shim (`cell-token.mjs:30` — Workers has no Buffer), and `token-interop.test.mjs` copies deliberately (its header says the copying IS the test). Not a package candidate.
- The `-maude` CSS pairs are **not forks**: `3-shell.css` (legacy `--u-*` layer, 1,004 live refs) and `3-shell-maude.css` (`.st-*` chrome) share **zero** selectors — they are two coexisting layers, and the legacy layer's retirement is its own later migration.
- The REAL duplication is the **canvas↔app vocabulary authored twice**: `3-shell-maude.css` was hand-ported from `.design/ui/Studio.css` and drifted (667→2,887 lines); `.design/ui/{ChatPanel,DiffView,GitPanel,CreateProject,RepoBranchSwitcher}.tsx` duplicate `client/panels/*` (1,770 canvas vs 4,615 client lines; ChatPanel shares 42/45 `.chat-*` classes) with **zero imports from `.design/` anywhere under `apps/`**; token declarations exist **×5** (studio 167 / DS 103 / site 115 / hub 76 / cloud 54 declarations); the 12 committed registry sidecars each re-inline their own token copy with **no freshness check**.
- Direction is unanimous: **production code is authoritative; canvases become views/consumers of real code; the mock is never the source** (`.design` today is a fourth parallel copy, not an upstream).

**Round 3 — maturity escalation (4 seats + an online-research guest; maturity-first mandate: effort/cost objections invalid) converged 4-0 "escalate" — but on the VERIFICATION axis, not the language axis.** The seats' repo verification found the program's real gaps:

- **~319 existing test files never run pre-merge**: `quality.yml` omits `pnpm test:dev-server` (studio, 236 files), the hub suite (42) runs in no workflow at all, and cloud's 41 run only post-merge in `cloud-deploy.yml`. The repo's own `quality.tests` declares half of what CI executes.
- **The release gate is not atomic**: `publish-main` (npm) does not depend on `build-desktop.yml`, where the only bundle-completeness + client-boots gates live — two workflows on the same `v*` tag, no cross-reference. npm publishes while the blank-window gates are still running; the tag history shows three same-day hotfix chains in three weeks (v0.49, v0.52, v0.53) and v0.51.1 was the same-day blank-window fix.
- **Two gates the plan builds on are measurably blind**: `apps/studio/tsconfig.json` never typechecks 39 of 43 root `.tsx` — including `canvas-lib.tsx`, the single source every canvas imports (the 25-error count was measured against a partial surface); `check-import-coherence.sh` misses parent-relative imports (612 of 1,424 = 43% blind — the v0.54.0 hub image break, the SEVENTH artifact-class shipped break, sat exactly there).
- **The hub already imports cross-app without a gate**: its Dockerfile hand-COPYs `apps/studio/sync/autocommit.ts`, `git/repo-lock.ts`, `apps/cloud/mirror.mjs` into a repo-shaped layout — the DDR-054 crossing exists today, ungated.
- Research (sourced, Aug 2026): JS→TS full conversion is the mainstream default but the JSDoc holdouts (Svelte compiler, ESLint, webpack) are precisely JS-ecosystem tooling; Node 24 type stripping is stable but refuses `.ts` under `node_modules`; Workers TS is the vendor default; W3C DTCG hit its first stable release (2025.10); mature dev-tool robustness = downstream verification (ecosystem CI, pre-release channels, Bun's canary+crash pairing), not internal test depth.
- **The canary fork (2:2) was resolved by cross-challenge** into a populated-channel-free design: GitHub-prerelease-by-default releases (the site's updater route reads `releases/latest`, which excludes prereleases — stable clients isolated with zero client change), a WRITTEN promotion rule (minimum soak + gates green against the exact artifact + explicit promote step + promote-now break-glass for user-breaking fixes), the maintainer's own install on the prerelease feed, and an upgrade-from-N-1 leg on the nightly job (the only probe that exercises the auto-updater code path itself). A true populated channel waits for >5 external installs.

## User Story

As the maintainer of Maude I want the repo's weakest surfaces (untested/unlinted client monolith, untyped `.mjs`, forked CSS, hand-synced lists) brought up to the standard of its strongest ones, so that the codebase is production-grade — without adding a second toolchain across the seams that have caused every shipped breakage.

## Problem

The single surface that shipped a blank window (v0.51.1) has zero static analysis and zero tests. "Nic nerozbit a neztratit" is currently **unenforceable** on the exact file the maintainer wants to restructure. Meanwhile a 15k-line file on a Syncthing tree with concurrent sessions is a merge-conflict generator.

## Solution

Five phases — **no file moves until the gates are automatic, and no gate counts until it actually runs**:

1. **Observability & gates** (no file moves, no behavior change): fix the 25 existing `tsc` errors, turn on the per-package typecheck, un-exclude the client from Biome, promote `check-client-boots` + a new bundle-parity check to per-PR CI, JSDoc-type the CLI, characterization tests + one desktop-e2e scenario per panel about to move.
2. **Decompose in place**: split `app.jsx` along the **existing** `client/panels/` seam (20 modules already live there) via pure move-and-export commits; entrypoint and `Bun.build` config untouched; bundle byte-delta is the regression signal.
3. **Shared layer — contracts first (import spine, emit edges)**: a five-environment reachability **canary** + dep-surface freeze BEFORE any content moves; a committed **duplication census** as the admission list (≥2 named real consumers per element); then `packages/tokens` (single source, ~7 emit targets — no-build consumers receive **generated committed text**, never an import), `packages/protocol` (+ slug conformance test), `packages/crypto-portable` **narrowed** to security primitives (token grammar + timing-safe compare).
4. **Unified UI — close the design↔code gap**: shared CSS extracted from the APP's real styles and served to canvases via a `@maude/ds-css` virtual specifier (DDR-025 precedent, resolved through `paths.ts`); `design:handoff` gains `--check` freshness + a self-containment contract test; one canvas↔panel pair (DiffView) inverted as the pilot — go/no-go on `packages/ui` is measured, not mandated, and includes a trust-boundary review (what a shared module exposes to the untrusted canvas origin).
5. **Release integrity & detection (round 3)**: prerelease-soak + written promotion rule for the auto-update feed; nightly ecosystem-verify (clean install + upgrade-from-N-1 + updater manifest verification) as the repo's first scheduled workflow; scoped property tests; local diagnostics with zero egress (background telemetry rejected 4-0 and recorded as a DDR).

**TypeScript policy (checker-first ratchet, round-3 amended):** safety comes from the checker, not the file extension. (1) Type CHECKING everywhere now, as a per-PR MATRIX: studio `tsc --noEmit` (with the include-completion fix), cli `--checkJs`, and cloud/cells' FIRST type gate (`wrangler types` + `tsc --noEmit` — cloud has no tsconfig at all today, and the binding-shape bugs types catch there surface in production as tenant data); (2) all NEW packages authored in TS from day one, emitting committed `.mjs` for no-build consumers; (3) conversions where runtime-native or small-and-security-critical — hub `.mjs`→`.ts` (Bun runs TS directly), **`apps/cells` → `.ts` now** (4 modules / 838 lines guarding cross-tenant isolation — round-3 split verdict), studio client `.jsx`→`.tsx` as separate commits after Phase-2 moves; (4) cli stays JSDoc'd `.mjs` — Node's type stripping is disabled inside `node_modules`, AND `isPkgRoot` hard-codes the literal path `cli/commands/design.mjs` in three languages (`sidecar.rs:325`, `stage-resources.mjs:136`, `check-bundle-completeness.mjs:126`) — with NAMED escalation triggers: (i) the T5 `checkJs` trial shows JSDoc fighting the checker in ≥3 of the ~30 `cli/lib` files → adopt the Prettier shape (author TS, publish `dist/`, `prepublishOnly` tripwire), (ii) the compiled binary becomes the sole distribution channel, (iii) cli grows a runtime dependency; (5) `apps/cloud` file renames deferred behind the same trial evidence (its 87 modules are the best-tested surface; CI runs its tests on Node 22 where `.ts` test imports would force a runtime bump).

**Rejected (3-0):** Turborepo; Tailwind in the studio client / canvas contract; Vite as a shipping bundler; rewriting `apps/cloud` (87 modules, 41 test files — the best-tested surface in the repo).

**Doors left open (recorded, not scheduled):** Vite as a *dev-only* inner loop after the split, conditional on byte-compatibility with the committed artifact (SHIPPER + BREAKER concession); Tailwind in the studio *shell only* after Phase 1, hard boundary at `canvas-lib.tsx` + `plugins/design/templates/` (BREAKER concession); `cli/lib/` `.mjs`→`.ts` only if JSDoc + `checkJs` proves insufficient after a real trial.

## Metadata

- **Type**: Refactor
- **Complexity**: High (program), Medium per phase
- **App/Package**: apps/studio (primary), cli/, apps/cloud (tokens only), packages/* (new), root CI
- **Affected Systems**: studio client, Biome config, quality gates/CI, CSS theme layers, cloud page styling, npm `files` surface (new packages)
- **Dependencies**: none new at runtime; no new toolchain

---

## Context References

### Must-Read Files

> When consuming this section during `/flow:execute`, read every file listed here in parallel in a single assistant message — they're independent context loads.

- `apps/studio/client/app.jsx` — 91 named top-level components under section banners; `App()` ≈ 6,200 lines, `CssKnobs` ≈ 1,550. The decomposition target.
- `apps/studio/client/panels/` — the established extraction pattern (20 modules: ChatPanel 2,284, TimelinePanel 2,218, SettingsPanel 1,276…). Mirror this.
- `biome.jsonc` (line ~25) — the `"!**/apps/studio/client"` exclusion to delete.
- `apps/studio/tsconfig.json` — `client/**/*.jsx` already in `include` under `allowJs`; `strict: true`; `bun tsc --noEmit` currently: 25 errors in 11 files (`git/service.ts` ×5, `api.ts` ×5, `generation/gemma-models.ts` ×4, `context-menu.tsx`, `cloud/endpoints.ts`, `clip-ops.ts`, `runtime-bundle.ts`, `http.ts:1811` — genuine duplicate-`ok` bug, `collab/origins.ts`, `canvas-build.ts`, `assets-s3.ts`).
- `apps/desktop/scripts/check-client-boots.mjs` — the boot gate to promote to per-PR CI (today desktop-release-only).
- `apps/studio/build.ts` + `canvas-lib-resolver.ts` — why Bun.build is a distribution contract, not bundler config (RUNTIME_PACKAGES externals, importmap, cloudStubPlugin).
- `apps/studio/client/styles/` — 14 layered files `0-reset`→`6-acp-chat`. Round-2 correction: `3-shell.css` (legacy `--u-*`, 1,004 refs) vs `3-shell-maude.css` (`.st-*`, hand-ported from `.design/ui/Studio.css`, drifted 667→2,887) share ZERO selectors — the extraction target is the canvas↔app pair, not a "fork collapse".
- `.design/ui/{ChatPanel,DiffView,GitPanel,CreateProject,RepoBranchSwitcher}.tsx` vs `apps/studio/client/panels/*.jsx` — the five duplicated pairs (Phase-4 targets).
- `apps/studio/handoff.ts` (781 lines) + `apps/studio/canvas-lib-inline.ts` (`inlineUsedExports`) — the emit path T18 extends; 12 committed `.design/ui/*.registry.json` sidecars, currently freshness-unchecked.
- `apps/cloud/brand.mjs` (`appShell`) + `operator-pages.mjs`, `checkout-pages.mjs`, `people-page.mjs`, `project-admin.mjs` — each carries its own `CSS` const re-declaring the token vocabulary. Cloud is server-rendered no-JS by explicit decision — do not change that.
- `apps/studio/git/service.ts` (`isMaudeRuntimeState`) + `cli/lib/gitignore-block.mjs` + root `.gitignore` — the three hand-synced runtime-state lists (DDR-115; drifted once).
- `site/scripts/sync-mdcc-tokens.mjs` — the one-way token sync to replace with generate + `--check`.
- `apps/studio/test/import-tokens.test.ts` — extend into the token NAME contract test.
- DDRs (in `.ai/archive/decisions/`): 009, 025, 026, 043, 044, 045, 054, 062, 088, 115, 126, 176, 177.

### Files to Create

- `scripts/check-client-bundle-parity.sh` — rebuild `--release`, fail if rebuilt `dist/client.bundle.js` diverges from committed without a committed source change.
- `scripts/check-shared-reachability.sh` — the T12 five-environment canary (pnpm · studio bun.lock · compiled sidecar · staged .app · npm tarball).
- `.ai/context/duplication-census.md` — T11 output; the admission list for every shared-layer element.
- `packages/tokens/` — EXPLICIT workspace member (never a `packages/*` glob — the dir holds the 7 per-platform binary staging packages); TS-authored single token source → studio CSS layer, site tokens, DS `colors_and_type.css`, template values, committed `apps/cloud/tokens.generated.mjs`, hub admin block, (future) Tailwind `@theme` preset.
- `packages/protocol/` — typed schemas for `_server.json` / `_active.json` / `*.meta.json`; generator for the 3 runtime-state lists; DDR-088 allowlist parity check; slug conformance test.
- `packages/crypto-portable/` — NARROWED: token grammar + timing-safe compare only (security primitives, where divergence is a security bug). base64url stays duplicated on purpose with a comment. TS-authored, emits committed `.mjs` for cloud/hub.
- `@maude/ds-css/*` — virtual-specifier registrations in `canvas-lib-resolver.ts` (files stay under `apps/studio/client/styles/`).
- `apps/studio/client/inspector/`, `client/menus/`, `client/sidebar/` — decomposition destinations.

### Patterns to Follow

- Extraction: `client/panels/acp-runtime.js` + `panels/*.jsx` — plain ES module exports, imported by `app.jsx`, same bundler entry.
- Gates: `scripts/check-version-parity.sh` / `check-import-coherence.sh` — small loud bash checks wired into CI + `quality`.
- Tests: `apps/studio/test/*.test.ts` under `bun:test`; `happy-dom` + `@happy-dom/global-registrator` already available.

---

## Tasks

Execute in order. Each task is atomic and testable. **Phase gates are hard: no Phase 2 task starts until every Phase 1 task is green.**

### Phase 1 — Make it observable (no file moves)

> Round-3 additions T0a–T0f are GATE REPAIRS and belong inside Phase 1's budget (all four seats' top_risk: detection work must not displace Phase 2 — these repair gates the later phases build on, they are not new subsystems).

#### T0a: ADD the existing test suites to per-PR CI (they currently never run)
- **Do**: Add to `quality.yml` on `pull_request`: `pnpm test:dev-server` (236 bun:test files — with the `git status apps/studio/dist/` clobber guard around it), the `apps/hub` suite (42 files — today in NO workflow), and the `apps/cloud` suite (41 files — today post-merge only; keep the deploy-gate copy too). Land **non-blocking first**, triage, then flip to required (the T3 ratchet pattern). If triage reveals a genuinely-broken set, commit a named quarantine list with reasons — visible quarantine beats silent non-execution.
- **Why**: the plan's Phase-2 regression signal was "bundle byte-delta"; there are 319 stronger signals already written and never executed.
- **Validate**: CI runs all three suites on a PR; `quality.tests` in workflows.config matches what CI actually executes.

#### T0b: REMOVE the dead pre-DDR-009 server + silent no-bun fallback
- **Do**: Delete `apps/studio/server.mjs` (48 KB, zero `_canvas-shell` refs, documented dead); drop or repoint the `claude-design-server` bin; fix `apps/studio/package.json` `main`/`start`; replace the no-bun fallback branch in `cli/commands/design.mjs` (~line 470) with a LOUD refusal naming the missing runtime — today users without bun silently get a different, broken product, and booting it clobbers committed release bundles.
- **Validate**: `maude design serve` on a bun-less PATH refuses loudly; grep confirms no reference to the deleted file.

#### T0c: REPAIR the studio typecheck surface (blocks T1's completion claim)
- **Do**: Complete `apps/studio/tsconfig.json` `include` — add `"*.tsx"`, `commands/**`, `photo/**`, `sync/**`, `exporters/**`, `collab/**`, `acp/**`, `git/**`, `github/**`, `generation/**`, `print/**`, `footage/**`, `cloud/**` (39 of 43 root `.tsx` are unchecked today, INCLUDING `canvas-lib.tsx`; if the canvas tree deliberately compiles only under the bundler, use a second `tsconfig.canvas.json` — checked somewhere, not nowhere). Add a CI assertion that `tsc --listFiles` covers every tracked non-test `.ts`/`.tsx` under `apps/studio` so files cannot silently fall out.
- **Gotcha**: the error count WILL rise above the 25 measured against the partial surface — that is the point, not a regression.
- **Validate**: listFiles-coverage assertion green; error count baselined then driven to 0 (absorbs into T1).

#### T0d: REPAIR `check-import-coherence.sh` BEFORE extending it
- **Do**: Extend the matcher to parent-relative (`../`), dynamic `import()`, and extensionless specifiers (today 612 of 1,424 relative imports — 43% — are invisible; the v0.54.0 hub image break sat exactly there). Then extend to `packages/*` (T12).
- **Validate**: regression test — revert the `repo-lock.ts` COPY line in a scratch branch → gate goes red.

#### T0e: PIN the bun version end-to-end
- **Do**: CI pins `bun-version: '1.3.3'` in four workflows because Bun's minifier output is unstable across patch releases, but `package.json` says `"bun": ">=1.3"` — T4's bundle-parity gate would cry wolf on any local `bun upgrade`. Add an exact `bunVersion` field asserted by `check-version-parity.sh`.
- **Validate**: parity script fails on a mismatched local bun; CI matrix reads the pinned value from one place.

#### T0f: MAKE the release gate atomic
- **Do**: `publish-main` (`build-binaries.yml`) currently `needs: build-binaries` only, while `check-bundle-completeness.mjs --smoke` + `check-client-boots.mjs` run in the SEPARATE `build-desktop.yml` on the same tag — npm publishes while the blank-window gates still run (three same-day hotfix chains in three weeks). Extract a fast macOS `desktop-gate` job (or merge workflows) and add it to `publish-main`'s `needs:`. Include a documented, logged break-glass (`workflow_dispatch` with explicit override input) — the failure mode is silent routing-around, not the override.
- **Validate**: test tag with a deliberately corrupted `dist/client.bundle.js` → the npm publish step never executes.

#### T1: UPDATE apps/studio — fix ALL `tsc --noEmit` errors on the COMPLETED surface
- **Do**: Fix the 25 known errors across the 11 files listed above (`http.ts:1811` duplicate-`ok` is a genuine bug — fix, don't suppress) PLUS whatever T0c's include-completion surfaces. Baseline first, ratchet non-increasing, drive to 0.
- **Validate**: `cd apps/studio && bun tsc --noEmit` → 0 errors on the full surface.

#### T2: ADD the per-PR typecheck MATRIX
- **Do**: `quality.typecheck` runs: `apps/studio` (`bun tsc --noEmit`, full include per T0c) · `cli/` (`tsc --checkJs`, scoped) · `apps/cloud` + `apps/cells` (**their first type gate**: `wrangler types` → generated `Env` bindings + `tsc --noEmit`; wrangler transpiles but never type-checks — a type-broken Worker deploys fine). Wire into `.ai/workflows.config.json` + `quality.yml`. DDR-026's repo-wide-gate absence stands; this is a per-package matrix.
- **Validate**: matrix green locally + in CI; an injected binding-name typo in cloud goes red.

#### T3: REMOVE the Biome client exclusion
- **Do**: Delete `"!**/apps/studio/client"` from `biome.jsonc`. Land the **format-only** diff as one isolated, announced commit (Syncthing/concurrent sessions — see CLAUDE.md release-gate notes). Then enable lint errors-only and ratchet.
- **Gotcha**: `preset: recommended` over 33,891 virgin lines will not come back clean — errors-only first, ratchet later.
- **Validate**: `pnpm lint` green; `npx biome check apps/studio/client/app.jsx` actually checks the file.

#### T4: ADD per-PR boot + bundle-parity gates
- **Do**: CI job on PRs touching `apps/studio/client/**`: run `apps/desktop/scripts/check-client-boots.mjs` against a built artifact + new `scripts/check-client-bundle-parity.sh` (build `--release` twice, diff `dist/client.bundle.js`; fail on uncommitted drift). Closes the v0.51.1 + v0.22.0 class *before* any decomposition.
- **Gotcha**: v0.51.1 surfaced ONLY under `window.__TAURI__` AND minification — the boot check must inject the Tauri global (it already does via `--init-script`).
- **Validate**: intentionally corrupt a local bundle → gate fails; restore → green.

#### T5: ADD JSDoc types to cli/lib (a TRIAL with named escalation triggers)
- **Do**: `// @ts-check` + JSDoc across `cli/lib/*.mjs`; add `tsc --checkJs` (noEmit, scoped to `cli/lib/`) to CI. No `.ts` rewrite — DDR-009's Node shim, the npm `files` surface, AND the `isPkgRoot` literal-path probe (`cli/commands/design.mjs` hard-coded in `sidecar.rs:325`, `stage-resources.mjs:136`, `check-bundle-completeness.mjs:126`) stay untouched.
- **Checkpoint (round 3)**: after the first ~10 files, evaluate JSDoc friction. Escalation triggers (recorded in the T20 DDR): ≥3 of ~30 files fighting the checker → adopt the Prettier shape (author TS, publish `dist/`, `prepublishOnly` tripwire) as its own later phase; compiled binary becomes sole distribution; cli grows a runtime dep.
- **Validate**: scoped `tsc` green; `pnpm test` (cli node tests) green; checkpoint verdict written into the plan.

#### T5b: MIGRATE npm publishing to trusted publishing (OIDC) — unanimous, severable
- **Do**: Switch all 8 published packages off the long-lived `NPM_TOKEN` (`build-binaries.yml` lines ~174/~286) to npm trusted publishing; `id-token: write` is already granted for `--provenance`. No build step, no artifact change — pure supply-chain hardening on the path every `npm i -g @1agh/maude` trusts.
- **Validate**: publish dry-run from CI succeeds with the token secret deleted.

#### T6: CREATE characterization tests + e2e scenarios for panels about to move
- **Do**: `bun test` characterization tests for DOM-free client logic first (`client/panels/acp-runtime.js`, reducers/helpers inside `app.jsx`, `client/inspector-controls.jsx`) using happy-dom. One `apps/desktop/e2e` scenario per Phase-2 target (inspector, menus, sidebar) using existing testid conventions (`canvas-list` / `canvas-row-<slug>` / `canvas-frame`; add missing `data-testid`s in the same change).
- **Coverage rule (SHIPPER/BREAKER)**: gate only the panels Phase 2 will touch — a repo-wide coverage push is the "better lint, same monolith" failure mode.
- **Validate**: `pnpm test:dev-server` green; `pnpm test:e2e:desktop` scenarios green against a **built** `.app`, not `tauri dev`.

### Phase 2 — Decompose in place (same bundler, same artifact)

> Per-commit gates for T7–T10: `pnpm test:dev-server` · bundle-parity check · `/design:smoke` · `git status apps/studio/dist/` before AND after (the `bun test` dist-clobber rule) · testids survive · e2e green. Each cut is ONE pure move-and-export commit. Entrypoint stays `client/app.jsx`; `Bun.build` config untouched; bundle byte-size delta within a declared band is the regression signal.

#### T7: REFACTOR app.jsx — extract inspector knobs
- **Do**: lines ≈5033–7565 (`CssKnobs`, `ColorPicker`, `TokenPopover`, `GridTracksEditor`, `RawKnob`, `AttrKnob`) → `client/inspector/css-knobs.jsx`.

#### T8: REFACTOR app.jsx — extract inspector panel
- **Do**: lines ≈7566–9149 (`InspectorPanel`, `LayerRow`, `InspectComputed`, `ArtboardKnobs`) → `client/inspector/inspector-panel.jsx`.

#### T9: REFACTOR app.jsx — extract menubar
- **Do**: lines ≈3365–4162 (8 × `*Dropdown` + `Menubar`) → `client/menus/`.

#### T10: REFACTOR app.jsx — extract sidebar/tree
- **Do**: lines ≈1892–2860 (`Tree`, `Sidebar`, `FileRow`, `CanvasRow`, `DirRow`) → `client/sidebar/`.
- **Exit criterion for Phase 2**: `app.jsx` ≤ ~2,000 lines, holding `App` + shell wiring only.

### Phase 3 — Shared layer: contracts first (import spine, emit edges)

> Round-2 verdict (4-0): **import spine internally; vendor edge for downstream + across DDR-054.** No-build consumers (`apps/cloud`, `apps/cells`, `apps/hub`) receive **generated committed source** — their dep counts are frozen by CI. T11 is read-only and may run in parallel with Phase 1; T12 blocks all content moves.

#### T11: CREATE the duplication census (read-only; may run during Phase 1)
- **Do**: Script + committed report (`.ai/context/duplication-census.md`) diffing each of the five `.design/ui/X.tsx` ↔ `client/panels/X.jsx` pairs and every shared-layer candidate: shared class names, shared token references, structurally identical subtrees, REAL consumer count per candidate. Must settle the measured facts the seats disputed (`.design/ui/Studio.css` ↔ shell overlap vs the zero-overlap legacy pair — different comparisons; both land in the census).
- **Why**: the round-1 duplication brief was wrong twice. **Admission rule: nothing enters the shared layer without ≥2 real consumers NAMED here.**
- **Validate**: census committed + reviewed before T13/T16 start.

#### T12: ADD the shared-layer gates — blocks all content moves
- **Do**:
  - **Five-environment reachability canary**: `packages/tokens` with exactly ONE token; prove in CI it resolves in: root `pnpm -r` · `cd apps/studio && bun install` (own `bun.lock` — the DDR-176 lesson) · `bun build.ts --release --compile` sidecar · staged `.app` via `check-bundle-completeness.mjs --smoke` · `npm pack` → clean-dir install → `maude design slug`.
  - **Workspace membership is EXPLICIT**: add `packages/tokens` by name to `pnpm-workspace.yaml`; NEVER `packages/*` — the dir already holds the 7 per-platform binary staging packages (globbing hands Changesets seven publishable members).
  - **Dep-surface freeze (CI assertion)**: `apps/cloud` deps stay exactly 1, `apps/cells` stays 1, `apps/hub/bun.lock` byte-unchanged by any shared-layer commit (DDR-054 posture).
  - **Import coherence**: extend `scripts/check-import-coherence.sh` to `packages/*` specifiers (Syncthing tree; the v0.51.0 lesson).
- **Fallback (BREAKER, conceded as fully acceptable)**: if the canary fails any leg, the import spine is dead — everything ships as generated committed source + `--check`, which "costs nothing and drifts nothing so long as `--check` runs in CI".
- **Validate**: canary green on all five legs; freeze assertion goes red on an injected dep.

#### T13: CREATE packages/tokens — DTCG source, ~7 emit targets (round-3 amended, 3:1)
- **Do**: TS-authored, private, zero-dep workspace member owning the DDR-043 NAME contract + maude values. **Source schema = W3C DTCG 2025.10 JSON** (the stable interchange standard; the repo already PARSES DTCG inbound via `_import-tokens.mjs`, DDR-172), validated with `ajv` (already a root dep). **Emitters are hand-written and zero-dep — Style Dictionary is REJECTED in the contract path** (its output formatting would cost the byte-identity gate; record the rejection; narrow exception: SD may serve the Tailwind `@theme` target only if hand-emit cannot reach it, site being the one consumer where byte-identity is not load-bearing). Declare per-target NAME subsets/extensions IN the source — replacing `sync-mdcc-tokens.mjs`'s reconciliation block, not porting it. Emits: studio `client/styles/1-tokens*.css` · site tokens (DELETE `sync-mdcc-tokens.mjs`) · `.design/system/maude/colors_and_type.css` · template values · committed `apps/cloud/tokens.generated.mjs` via `brand.mjs` `appShell` (DELETE the four per-page `CSS` consts) · hub admin token block · Tailwind v4 `@theme` for site (in THIS task, not "future") · a DTCG `tokens.json` EXPORT with a round-trip test through `flattenJsonTokens` (users can bring tokens in; now they can get them out).
- **Gates**: **byte-identical-on-first-run** — the emit must reproduce today's files exactly (any diff = generator bug, not cleanup); NAME-contract test — deleted NAME fails loud, rename needs a two-release deprecation window; `--check` in `quality` + `quality.yml`. **Fallback (recorded)**: if DTCG's structure cannot reproduce byte-identity, T13 ships with a free-form source and DTCG becomes an emit target only.
- **Validate**: ajv schema validation green; `--check` red on a hand-edited token; round-trip test green; `cd apps/cloud && npm test` green; `/design:smoke` green.

#### T14: CREATE packages/protocol (+ slug conformance)
- **Do**: Typed schemas for `_server.json` / `_active.json` / `*.meta.json`; generator for the three runtime-state lists (`isMaudeRuntimeState`, `gitignore-block.mjs`, `.gitignore` block) + CI divergence check; DDR-088 dual-allowlist parity (`CANVAS_SAFE_API` ∩ `startCanvasServer` routes). ADD a **slug conformance test**: `apps/studio/locator.ts:46` exports a second `canvasSlug` that keeps `/` and does not lowercase while its docstring claims parity with `bin/slug.sh` (`tr '/' '-'` + lowercase) — a real latent bug. Conformance-test the canonical `canvasSlugFromRel` against `bin/slug.sh`. Do NOT merge the other slug functions — different semantics, and slugs key user data (`_history/<slug>/`, `_canvas-state/<slug>.view.json` — DDR-115).
- **Property tests (round 3, scoped)**: `fast-check` on grammars that key user data or cross a trust boundary ONLY — the slug grammar (`canvasSlugFromRel` ≡ `bin/slug.sh` over generated unicode / `/` / case / leading-dot inputs), the credential/token grammar, the protocol schemas, and the token flattener (parses untrusted third-party JSON). NOT the draw engine — its 16/24/48/256 render ladder is the stronger oracle (recorded).
- **Gotcha (DDR-177)**: any runtime-reachable package must pass `check-bundle-completeness.mjs <built .app> --smoke`; new dirs the CLI needs at npm runtime enter `package.json` `files`.
- **Validate**: generated lists byte-identical on first run; conformance test first documents, then fixes, the `locator.ts` mismatch; property suites green.

#### T15: CREATE packages/crypto-portable — NARROWED to security primitives
- **Do**: **Token grammar + timing-safe compare ONLY** — where divergence is a security bug (`credential-grammar.ts` already proves a registry pays for itself). TS-authored; workspace import for studio; **generated committed `.mjs`** for cloud/hub (dep freeze holds). **base64url stays duplicated on purpose** — hub's is a Node builtin call, cloud's a 4-line Workers shim; add the comment saying why. `token-interop.test.mjs` keeps its deliberate copy.
- **Validate**: cloud + hub suites green on both runtimes; dep-freeze assertions green.

#### T15b: GATE the hub's cross-app COPY manifest + publish the dep posture (round 3)
- **Do**: The hub Dockerfile already hand-COPYs cross-app imports (`apps/studio/sync/autocommit.ts`, `git/repo-lock.ts`, `apps/cloud/mirror.mjs`, `design-sync.mjs`) into a repo-shaped layout — the DDR-054 crossing exists TODAY, ungated (the v0.54.0 break was exactly a missing COPY line). Generate-or-assert the COPY set from the transitive import closure of `src/server.mjs`. PLUS: committed, generated `apps/hub/DEPENDENCIES.md` naming the frozen runtime closure and the CI assertion guarding it — a security posture only CI knows about is not one a self-hoster can rely on.
- **Validate**: removing a COPY line goes red in CI; DEPENDENCIES.md regenerates deterministically.

#### T15c: CONVERT apps/cells to TypeScript (round-3 split verdict)
- **Do**: 4 modules / 838 lines guarding cross-tenant isolation (`cellEnv`) — convert to `.ts` with `wrangler types`-generated bindings; wrangler bundles TS natively. This is the "small and security-critical" arm of the policy; `apps/cloud`'s 87 modules explicitly stay `.mjs` + `checkJs` behind the T5 trial trigger.
- **Validate**: `cd apps/cells && npm test` green (Node 24 CI leg); `wrangler deploy --dry-run` green; type gate red on an injected binding typo.

### Phase 4 — Unified UI: close the design↔code gap

> Direction unanimous in round 2: **the app is authoritative; canvases become views of real code; the mock is never the source.** `design:handoff` remains the ONLY outward distribution channel (vendor edge, self-contained drops).

#### T16: EXTRACT the pilot shared CSS via `@maude/ds-css` (kill-switch attached)
- **Do**: Register `@maude/ds-css/*` in `canvas-lib-resolver.ts`, mirroring `@maude/canvas-lib` resolution through `paths.ts` (NEVER a local `fileURLToPath` — the DDR-045 trap). Pilot: `client/styles/6-acp-chat.css` (1,951 lines, single-layer — sidesteps the legacy-layer dispute). `.design/ui/ChatPanel.tsx` imports `@maude/ds-css/chat.css`; DELETE `.design/ui/ChatPanel.css` (42/45 classes shared today).
- **Kill-switch (SHIPPER)**: does not merge until the file resolves inside a **compiled** `maude-server` binary AND a **built** `.app` (`check-bundle-completeness.mjs --smoke` + `check-client-boots.mjs`). If it cannot clear that on one file, the CSS half is abandoned and only tokens ship.
- **Validate**: class-parity assertion (canvas classes ⊆ shared file); `/design:smoke`; `git status apps/studio/dist/` before AND after; committed bundle rebuilt `--release`.

#### T17: EXTEND shared CSS to the shell vocabulary
- **Do**: Converge `Studio.css` ↔ `3-shell-maude.css` (the hand-ported pair, 667→2,887 drift) onto `@maude/ds-css/shell.css` per the census; then the remaining canvas `.css` copies. The legacy `--u-*`/`3-shell.css` layer (1,004 live refs) is NOT collapsed here — its retirement is a separate later migration.
- **Validate**: per-file computed-style probes (never screenshots — the `var()` alias scope trap); `/design:smoke`; desktop boot gate.

#### T18: ADD handoff freshness + self-containment gates
- **Do**: `maude design handoff --check` — regenerate all 12 committed `.design/ui/*.registry.json`, fail on divergence; wire into `quality`. PLUS the **self-containment contract test**: an emitted drop must never carry an unpublished `@maude/*` specifier in `dependencies` and must compile standalone — extend `inlineUsedExports` (`canvas-lib-inline.ts`) to inline `@maude/ds-css` / `@maude/tokens` content at emit time.
- **Validate**: fixture drop installs into a scratch Next.js project with zero Maude packages present.

#### T19: INVERT one canvas↔panel pair (DiffView pilot) → go/no-go on packages/ui
- **Do**: Smallest pair (263 canvas vs 590 client lines). The presentational shell becomes one shared module imported by BOTH the shipped panel and the canvas — the canvas becomes a live preview of real code. Wiring (WebSocket / ACP / git state) stays in the client; canvases run in the untrusted iframe origin (DDR-054); canvas-lib stays dev-only (DDR-025).
- **Exit**: a WRITTEN go/no-go on the remaining four pairs AND on `packages/ui-react`, based on measured effort — not a mandate. `packages/ui` may exist only with ≥2 real consumers named in the census (the canvas counts as one once it imports real code). **The go/no-go includes a trust-boundary review** (round 3): what a shared module exposes to the untrusted canvas iframe origin (DDR-054) — a React module imported by both the privileged shell and the canvas is a trust-boundary crossing, not just a resolution seam.
- **Validate**: bundle-parity green; `pnpm test:dev-server`; `/design:smoke`; one desktop-e2e scenario over the panel.

#### T20: CODIFY the TypeScript policy (checker-first ratchet)
- **Do**: Record as a DDR and enforce: (1) checking everywhere now (T2/T5); (2) new packages TS-authored from day one, emitting committed `.mjs` for no-build consumers; (3) conversions only where runtime-native — hub `.mjs`→`.ts` opportunistically (Bun executes TS), client `.jsx`→`.tsx` as separate commits AFTER Phase-2 moves (never inside a pure-move commit); (4) cli stays JSDoc'd `.mjs` (Node type stripping is disabled in `node_modules` — published `.ts` bins would force a build step); (5) cloud/cells convert only on evidence `checkJs` is insufficient.
- **Validate**: DDR recorded via `/flow:record-ddr`; policy referenced from CLAUDE.md conventions on the next `/flow:done`.

### Phase 5 — Release integrity & detection (round 3; starts after Phase 2, independent of Phases 3–4)

> All four seats' top_risk: this phase must NOT displace the decomposition. T0a–T0f (gate repairs) already landed in Phase 1; this phase adds the post-release detection layer — the only mechanism class that would have caught all SEVEN shipped breaks.

#### T21: ADD the prerelease-soak + written promotion rule (canary cross-challenge resolution, 4-0)
- **Do**: Releases are cut as **GitHub prereleases by default**. The site's updater route (`site/app/releases/[target]/[arch]/[current_version]/route.ts`) reads `releases/latest`, which excludes prereleases by GitHub's definition — stable clients are isolated with ZERO client change. Add: a canary-side feed (newest-including-prereleases) and point the maintainer's own install at it; a **written promotion rule in `.ai/release-guide.md`** — minimum soak (48 h or one nightly ecosystem-verify pass against the exact artifact, whichever is longer), promotion blocked on gates green, promotion as an EXPLICIT action, and a documented **promote-now break-glass** for user-breaking hotfixes (a soak that delays a fix is an outage extender); a visible stable-vs-canary version on the site releases page. A true POPULATED pre-release channel is deferred: trigger = >5 external installs/self-hosters, or the first break that reproduces only on a real user's machine and the nightly misses.
- **Validate**: a prerelease tag never appears in a stable client's update check; promotion flips it; the rule is in the runbook.

#### T22: CREATE the nightly ecosystem-verify job (the repo's first scheduled workflow)
- **Do**: Nightly (plus on-tag): (1) clean-container `npm pack` → install → `maude init` + `maude doctor` + every `maude design <verb>` in a scratch project on a stripped PATH; (2) **upgrade-from-N-1 leg** — install the PREVIOUS release, run against a DIRTY project (existing `.design/`, stale `_server.json`, old sidecar), upgrade in place to the candidate, assert the same surfaces, and verify the updater manifest + minisign signature against the prior artifact (the auto-updater code path executes ONLY on upgrade and has never been exercised); (3) built-`.app` boot: `check-bundle-completeness.mjs --smoke` + `check-client-boots.mjs`. Reuses existing scripts; this is Maude's ecosystem-CI analogue (robustness = downstream verification).
- **Validate**: job red on a deliberately broken candidate in each leg; results posted where the maintainer sees them.

#### T23: ADD local diagnostics — and record the no-telemetry commitment (4-0)
- **Do**: Structured ring-buffer boot log (sidecar spawn, client mount, `#root` child count, plugin bootstrap — `sidecar.rs` already rotates `server.log` 1 MB×3) + desktop **Help ▸ Copy diagnostic report** + `maude doctor --bundle`, with redaction rules and a test asserting no project paths or canvas content leak. **No network egress.** Record as a DDR: "no background telemetry in the local product" (privacy.mdx's published promise is a product feature; opt-out telemetry rejected 4-0; auto crash-submit rejected — Bun's is acceptable only because it rides an opt-in unstable channel). Document the updater's EXISTING outbound call (IP + target/arch + version to `maude.sh/releases/...`) in `privacy.mdx`. Acceptable future form: explicitly opt-in, account-scoped extension of the already-documented cloud usage events for signed-in users — local-only users never.
- **Validate**: redaction test green; DDR recorded; privacy.mdx updated.

---

## Validation

Run to confirm zero regressions (scoped to this repo's real gates — no generic 5-platform scenario runner here):

1. **Lint**: `pnpm lint`
2. **Types**: `cd apps/studio && bun tsc --noEmit` (+ scoped `tsc --checkJs` for `cli/lib/`)
3. **Tests**: `pnpm test && pnpm test:dev-server` (+ `cd apps/cloud && npm test` for T13)
4. **Build**: `pnpm --filter @maude/site build`; `bun run apps/studio/build.ts --release` (bundle parity)
5. **Smoke**: `/design:smoke` (canvas + specimen render gate)
6. **Desktop**: `pnpm test:e2e:desktop` against a built `.app`; before any desktop release additionally `check-bundle-completeness.mjs --smoke` + `check-client-boots.mjs`
7. **Drift gates**: `scripts/check-version-parity.sh`, `check-import-coherence.sh`, `git status apps/studio/dist/` before/after every `bun test` run

---

## Acceptance Criteria

- [ ] Phase 1 (round-3 amended): all three existing test suites run per-PR (quarantine list committed if needed); dead server.mjs gone + loud no-bun refusal; tsconfig surface complete (listFiles assertion) with 0 errors; import-coherence matcher covers parent-relative; bun version pinned end-to-end; **release gate atomic** (publish blocked on desktop smoke gates); typecheck MATRIX green (studio + cli + cloud/cells first type gate); trusted publishing live, NPM_TOKEN deleted; client lint + boot/parity gates per-PR; characterization tests + e2e scenarios for all Phase-2 targets
- [ ] Phase 2: `app.jsx` ≤ ~2,000 lines via pure move-and-export commits; every per-commit gate green; committed `dist/client.bundle.js` regenerated `--release` and committed alongside
- [ ] Phase 3: census committed; canary green on all five environments (or fallback invoked); token NAME contract single-sourced + contract-tested across all ~7 targets; cloud/cells/hub dep counts UNCHANGED; 3 runtime-state lists + DDR-088 allowlists generated/checked; crypto-portable narrowed to grammar + timing-safe compare
- [ ] Phase 4: `@maude/ds-css` pilot green inside compiled binary + built `.app` (or kill-switch invoked); `handoff --check` + self-containment contract test in `quality`; DiffView pair inverted with a written go/no-go (incl. trust-boundary review) on the rest; TypeScript policy recorded as DDR
- [ ] Phase 5: prerelease-soak + written promotion rule live in the runbook; nightly ecosystem-verify (clean + upgrade-from-N-1 + `.app` legs) scheduled and green; local diagnostics shipped with redaction test; no-telemetry DDR recorded; privacy.mdx documents the updater call
- [ ] `apps/cells` on TypeScript; `apps/cloud` under its first type gate with file conversion behind the named trigger
- [ ] No new toolchain reaches any shipping artifact; DDR-009/025/043/044/045/054/062/088/115/176/177 all still hold
- [ ] Each phase closed with `/flow:done` (DDR sweep → commit → validate)
- [ ] Debate dissent honored: gates landed BEFORE moves; "gates-only" degeneration avoided (Phase 2 actually executed)

---

## Rejected alternatives (debate record, 3-0)

| Proposal | Verdict | Reason (seat-attributed, quoted as data) |
| --- | --- | --- |
| Vite as build tool | Rejected for shipping; door open dev-only post-split | BREAKER: "the dev server IS a bundler… Vite resolves from on-disk node_modules and owns its process; it cannot be compiled into the sidecar." |
| Tailwind in studio/canvases | Rejected; site/ keeps it; shell-only = post-P1 option | BREAKER: "Tailwind crosses a published API" (DDR-043 token names). SHIPPER: "category error on two of three surfaces." |
| Turborepo | Rejected | SHIPPER: "adding a cache over the surface that breaks releases is negative expected value." BUILDER: "redundant-tooling-over-pnpm pattern the maintainer has rejected." |
| Rewrite apps/cloud | Rejected | SHIPPER: "the strongest code here, not the weakest — 87 modules, 41 test files." |
| `.mjs`→`.ts` sweep | Refined into the T20 checker-first ratchet | SHIPPER: JSDoc + `checkJs` first; new code TS; conversions only where runtime-native. |

## Rejected alternatives — round 2 (shared layer, 4-0)

| Proposal | Verdict | Reason (seat-attributed, quoted as data) |
| --- | --- | --- |
| Vendor/registry as the INTERNAL distribution spine | Rejected 4-0 | ADVOCATE: "vendoring makes one button fix into N copy operations… with NOTHING that fails when a copy goes stale." BREAKER: "12 sidecars… nothing checks their freshness — drift is silent and undetectable today." |
| Sourcing the shared layer FROM the design:handoff mocks | Rejected | BREAKER: "`.design` is not upstream of production — it is a fourth parallel copy… it would make the mock authoritative over the implementation." |
| `packages/ui` (React component library) now | Deferred until after Phase 2 + T19 go/no-go | ADVOCATE: "only ONE internal consumer actually runs React (desktop wraps the studio bundle)… paying the DDR-177 bundle-completeness tax on every release." |
| base64url / slug dedup packages | Rejected | BREAKER: "two correct runtime-appropriate one-liners… leave base64url duplicated on purpose, with a comment saying why." ADVOCATE: "slugs key USER DATA — a 'harmless' unification silently orphans someone's snapshot history." |
| Drops referencing a hosted `@maude` registry (`registryDependencies`) | Rejected | ADVOCATE: downstream self-containment is the product — "make handoff the internal distribution mechanism and drops start referencing `@maude/*` specifiers that do not exist on npm"; T18's contract test enforces the opposite. |
| `workspace:*` reaching apps/cloud, apps/cells, apps/hub | Rejected | SHIPPER: "`apps/cloud` is not a pnpm workspace member and has no `node_modules` — `workspace:*` cannot reach it at all." BREAKER: dep-surface freeze is a DDR-054 security posture. Generated committed source instead. |

## Round 3 — maturity escalation record (4-0 escalate; canary resolved by cross-challenge)

| Question | Resolution | Decisive argument (seat-attributed, quoted as data) |
| --- | --- | --- |
| cli → full TS + build | **Held** (3:1); trusted publishing escalated 4-0; three named triggers recorded | BREAKER: "`cli/` is the only surface with commit==ship and the only surface with zero shipped breaks; escalation gives it the exact property (artifact ≠ source) shared by all seven breaks." SHIPPER: `isPkgRoot` literal path hard-coded in 3 languages. |
| cloud/cells → TS | **Split-escalated**: cells converts now; cloud gets its FIRST type gate, renames behind trigger | BREAKER: "convert where divergence is a security bug" (cells, 838 lines, tenant isolation). BUILDER: cloud "has no tsconfig at all; the bugs types would catch surface in production, on one tenant, as data." |
| packages/ui now / registry-internal | **Held** 4-0; T19 gains trust-boundary review | BREAKER: "a React module imported by both the privileged shell and the DDR-054-untrusted canvas iframe is a trust-boundary crossing, not just a resolution seam." |
| DTCG | **Escalated** 3:1 — DTCG 2025.10 as SOURCE schema, hand-written emitters, SD rejected in contract path, byte-identity fallback | SHIPPER: `sync-mdcc-tokens.mjs`'s 40-line reconciliation comment is what a bespoke schema becomes. ADVOCATE: the repo parses DTCG in but cannot emit it out. |
| Verification reach | **Escalated** unanimously (T0a–T0f) | BUILDER: "236 bun:test files never execute in CI… asserted-not-enforced." ADVOCATE: "there are 236 stronger signals already written and never executed." BREAKER: tsconfig blind to 39/43 root .tsx incl. canvas-lib.tsx; import-coherence 43% blind; v0.54.0 = the seventh artifact break. |
| Atomic release gate | **Escalated** unanimously (T0f) | SHIPPER: "npm goes public while the gates that catch blank-window builds are still executing" — three same-day hotfix chains in three weeks. |
| Canary channel | **Resolved via cross-challenge**: prerelease-soak + written promotion rule + upgrade-from-N-1 leg; populated channel deferred (>5 external installs) | BREAKER: detection needs population, containment needs only delay. ADVOCATE: `releases/latest` excludes prereleases — stable isolation with zero client change; "being the pro-user seat and arguing to keep users as the canary is incoherent." SHIPPER: "stable-lags-canary only protects anyone if the lag is written down." |
| Opt-out telemetry / auto crash-submit | **Rejected** 4-0 → local diagnostics, no egress; DDR to record it | ADVOCATE: privacy.mdx is a published promise ("no tracking pixels… nothing in the page that could report on you"). BREAKER: "v0.51.1's blank window and v0.38.0's hang did not crash" — crash reporting wouldn't have caught them. |

## Confidence

**8/10** for one-pass implementation of Phases 1–2 (mechanical, gate-protected, pattern exists). Phase 3 is **7/10** — the canary (T12) converts the biggest unknown (five-environment resolution, the DDR-176/177 seam class) into a cheap early pass/fail with a conceded fallback (generated committed source everywhere). Phase 4 is **6.5/10** — the `@maude/ds-css` virtual specifier is exactly the seam class behind all six shipped breaks, which is why T16 carries SHIPPER's kill-switch (CSS half abandoned, tokens still ship).

Top program risks, preserved verbatim: round 1 (BREAKER): "gates-first degenerates into gates-only — the client stays a 15,378-line monolith with nicer lint" — mitigated by Phase 2 being line-mapped, not aspirational. Round 2 (BREAKER): "the dual-install seam: every packages/* must resolve under root pnpm AND apps/studio's own bun.lock AND bun build --compile AND the staged .app AND the npm tarball" — mitigated by the T12 canary running BEFORE any content moves. Round 2 (ADVOCATE): "'import' gets executed as packages/ui with one real consumer — paying the DDR-177 tax on every release while the .design↔client drift the maintainer actually feels goes untouched" — mitigated by the census admission rule + T19 measuring before mandating. Round 3 (all four seats, same risk in four voices): the detection layer must not displace the decomposition — mitigated structurally: T0a–T0f are repairs of gates later phases build on (Phase-1 budget), Phase 5 starts only after Phase 2, and T0a's suites land non-blocking-then-ratchet so a triage backlog cannot block T1 (ADVOCATE: "a permanently-red gate is worse protection than no gate").
