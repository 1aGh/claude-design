# Workflow State

> Schema + rules live in `.claude/skills/workflow-state/SKILL.md`.

**Workflow:** feature-delivery — md-claude v1.0 roadmap
**Phase:** phase-3.5-dev-server-ui-ux-refresh (Tasks 4-10 done; **Tasks 11-13 added 2026-05-15** for viewport-area static visuals only — paper-grid bg + Wordmark + SelectionHalo + StatusBar info slots; canvas functionality stays in Phase 4 per user clarification) ∥ feature-docs-site-followups (commits 1-3 landed; items 19-21 deferred)
**Status:** plan-trimmed-pending-execute-of-tasks-11-13
**Started:** 2026-05-12
**Updated:** 2026-05-15
**Active task:** phase-3.5-dev-server-ui-ux-refresh
**Active plan:** `.ai/plans/phase-3.5-dev-server-ui-ux-refresh.md`

## Execution Progress — phase-3.5-dev-server-ui-ux-refresh

- ✅ Task 1-3 (design stage — CV-08/09/10 mocks; user signed off 2026-05-15)
- ✅ Task 4: index.html → JetBrains Mono fallback (Berkeley primary via token chain), Inter dropped
- ✅ Task 5: 1-tokens.css → project DS bridge (OKLCH paper-light + phosphor-dark + `--u-*` alias layer); zero hex literals remaining in chrome CSS; sibling-token roles audited (`--u-accent` → `--accent`, `--u-accent-bg` → `--accent-tint`, etc.)
- ✅ Task 6: Header + ThemeToggle component (Sun/Moon, localStorage-persisted) wired
- ✅ Task 7: Sidebar + Tree restyled to CV-08 — search "filter…" placeholder, section headers SKU-tracked uppercase, active-row hairline left edge + accent-tint bg (no pill), unread badge on `--accent` chip
- ✅ Task 8: Tabs + StatusBar slots — `StatusBarSlot` helper, slot order: ACTIVE | SELECTED | COMMENTS | LIVE | spacer | THEME; tabs got hairline-underline active treatment; ThemeToggle moved from Header → StatusBar per plan
- ✅ Task 9: SystemView (CV-09) — new live `TokenLadder` (reads `getComputedStyle`, MutationObserver re-reads on theme flip) + 8-step `TypeLadder` + SKU-framed header; CommentsPanel (CV-10) — uppercase mono tab labels with hairline-underline active state, hairline-divided item rows, accent-tint active pin, muted resolved
- ✅ Task 10: live smoke green — boot in <2 s, both themes round-trip via toggle, keyboard focus visible on tree + tabs + buttons (`--shadow-focus` 2 px accent ring); full a11y-auditor sweep deferred to `/flow:validate-a11y` at `/done`

**Files modified:**

- `plugins/design/dev-server/client/index.html` — fonts swap
- `plugins/design/dev-server/client/styles/1-tokens.css` — full rewrite (project DS + alias bridge)
- `plugins/design/dev-server/client/styles/3-shell.css` — sidebar/header/tabs/statusbar refactor; 5 hex literals removed
- `plugins/design/dev-server/client/styles/4-components.css` — system-view + comments panel refactor; 11 hex/rgba literals removed
- `plugins/design/dev-server/client/app.jsx` — `ThemeToggle`, `TokenLadder`, `TypeLadder`, `StatusBarSlot` components; theme state + localStorage round-trip

**Validation status:** `bun run build.ts` green (client 3.4 MB raw / styles 47.8 KB); `bun tsc --noEmit` clean; live dev-server boot OK against this repo's `.design/`; both themes screenshot in `/tmp/phase-3.5-shots/01-dark.png`, `02-light.png`, `03-light-canvas.png`, `04-system-view.png`, `05-focus.png`.

**Carry-over:**

- Modified-dot indicator (plan T7 spec) — no server data flow for "file modified since open", left out; would need fs-watch + diff against the canvas history snapshot.
- "Avatar + author" in comment items (plan T9 spec) — comment data model has no `author` field; deferred to a future schema migration.
- Full `/flow:a11y-auditor` cross-theme sweep — not run; recommended to invoke at `/flow:done`.
- `dev-server-shell-tour` scenario not recorded — recommended via `/flow:scenario new dev-server-shell-tour` before `/done`.
- Smoke against `/Volumes/D/git/dugmate/.design/` (canonical real-world example per plan §Validation step 8) — not run this session.
- DDR candidates per plan acceptance: (a) font hosting strategy (chose option-c JetBrains-Mono-only fallback; Berkeley Mono name kept in chain for users who have it locally), (b) token bridge approach (chose alias-layer + inline DS values rather than cross-`plugins/` `@import`).

**Last archived plan:** `.ai/plans/archive/feature-docs-site-mdcc-skin.md`
**Branch:** `main`

## Loaded skills (skill-loader)

Resolved 2026-05-12 via `/flow:maintain-docs` Step 3b → `flow:skill-loader` → `terminal-skills` MCP.

| Library / tech | Source | Slug | Notes |
| -------------- | ------ | ---- | ----- |
| Yjs | terminal-skills MCP | `yjs` | v1.0 collab backbone (Phase 8 LAN, Phase 9 hub). Covers Y.Doc / shared types / WebsocketProvider / awareness / IndexedDB offline. |
| Playwright | terminal-skills MCP | `playwright-testing` | Planned dev-only dep for visual regression (per PRD §Testing). Covers config, page objects, API mocking, visual snapshots, a11y axe integration. |

Still unresolved (no MCP match, no built-in skill):

- **Fumadocs** — Next.js-based docs site for v1.x. Fallback: WebFetch on https://fumadocs.dev when starting the docs-site phase.
- **Hocuspocus** — Yjs hub framework (Phase 9). The loaded `yjs` skill covers the WebSocket provider patterns; for Hocuspocus-specific server config (`@hocuspocus/server`, extensions, `onAuthenticate`), fallback to WebFetch on https://tiptap.dev/docs/hocuspocus when Phase 9 starts.
- **Next.js** (the framework itself) — no direct terminal-skills hit; closest tangents are `nextra`, `turbopack`, `ai-sdk`. Only needed when Fumadocs phase starts; defer.

Consider `/flow:make-skill-template` for **fumadocs** and **hocuspocus** if their use becomes load-bearing across multiple sessions.

## Decisions

- DDR-001 Monorepo with single npm publisher (Phase 1)
- DDR-002 Release flow via Changesets, with parity-preserving wrapper (Phase 1)
- DDR-003 `/flow:release` walks user-authored runbook instead of dispatching on provider (Phase 3)
- DDR-004 Flow commands use `<group>-<verb>` prefix; compat stubs shipped in v0.6.0, removed in v0.6.1 (Phase 13)
- DDR-005 Docs site stack — Fumadocs + Vercel; accept Fumadocs DS defaults (Phase 2)
- DDR-006 Plugin commands/skills/agents declare `name: <plugin>:<slug>` in frontmatter (ad-hoc, 2026-05-13)
- DDR-007 Stable element-id schema — `data-dc-screen` + `data-dc-element` (Phase 13, 2026-05-15)
- DDR-008 `plugins/design/dev-server/bin/` is the canonical home for shared bash helpers (Phase 13, 2026-05-15)
- DDR-010 `design-system-keeper` agent — read-only DS-fidelity audit between generation and the critic panel (Phase 14, 2026-05-15) [DDR-009 was claimed by the bun-runtime DDR mid-session]
- DDR-011 Re-skin fumadocs via `--color-fd-*` overrides; do NOT fork (feature-docs-site-mdcc-skin, 2026-05-15)
- DDR-012 React 19 everywhere — shell and canvases share a single runtime (Phase 3.4, 2026-05-15)
- DDR-013 Server modular split into seven TypeScript modules on `Bun.serve` (Phase 3.4, 2026-05-15)
- DDR-014 CSS `@layer reset, tokens, layout, shell, components, utilities` + Lightning CSS at build time (Phase 3.4, 2026-05-15)
- DDR-015 Per-platform Bun binary distribution via npm `optionalDependencies` sub-packages with postinstall-hardlink (Phase 3.4 Tasks 12-13, 2026-05-15)
- DDR-016 `plugins/design/dev-server/runtime/` is the canvas-runtime library home — runtime code, not meta-design (Phase 3.4 Task 1 audit, 2026-05-15)

## Blockers

- (none)

## History

| When | Phase | Note |
| ---- | ----- | ---- |
| 2026-05-12 | planning | PRD authored at `.ai/docs/PRD.md`; 8 phase plans generated. Start with `/flow:execute .ai/plans/phase-1-contribute-infra-changesets.md`. |
| 2026-05-12 | planning | Phase 1 expanded (Task 0: monorepo + pnpm workspaces; Task 8: GitHub repo via `gh` CLI). Phase 4 updated for esbuild + bundled `dist/server.bundle.mjs` + `dist/client.bundle.js` shipping pattern; `plugins/design/dev-server/package.json` becomes `"private": true` workspace. |
| 2026-05-12 | planning | Runtime research at `.ai/docs/research-runtime.md`. Decision: stay on Node 20+ for v1.0, defer Bun binary distribution to v1.1 (first off the icebox). Phase 4 constrained to runtime-agnostic `node:*` patterns. |
| 2026-05-12 | planning | Collab research at `.ai/docs/research-collab.md` (814 lines). Phase 8 scope cut to "ambient multiplayer" (Yjs + Awareness, no HTML co-editing). New Phase 9 created for v1.1 structured CRDT HTML co-editing (`data-cd-id` identity + Y.XmlFragment + AI diff-to-ops). Phase 0 spike (HTML↔Y.XmlFragment fidelity) is go/no-go gate for Phase 9. |
| 2026-05-12 | planning | Architecture pivot: user wants federated self-hostable hub, not LAN-peer-to-peer. Research overwritten (`.ai/docs/research-collab.md`, 1145 lines, new). **PartyKit rejected** (`partyserver` is CF-Workers-only). **Hocuspocus adopted** (MIT, Node-native, production-tested for TipTap Collab). Phase 9 renumbered → Phase 10 (v1.2 structured CRDT). New Phase 9 = self-hostable hub + bidirectional file sync (`mdcc hub serve|deploy`, `mdcc design link`). v1.1 ship target. |
| 2026-05-12 | planning | `/flow:maintain-docs` Step 3b → `flow:skill-loader` loaded `yjs` + `playwright-testing` skills from `terminal-skills` MCP. Fumadocs/Hocuspocus/Next.js framework still gaps (no MCP match) — recorded above under "Loaded skills". |
| 2026-05-12 | planning | Audit pass (2 Explore agents): 93% consistency, 16/16 user requirements covered. User decisions: (1) Phase 7 (ACP) → icebox; (2) apply all doc fixes now. Plus 3 scope refinements: (a) Phase 3 split — flow⇄design seam extracted to new Phase 11; (b) Phase 5 multi-DS reinterpretation (DS-as-attachment to `/design:new`, not runtime switcher) + extract layers + in-canvas CSS to new Phase 12 (end-of-roadmap extra feature); (c) Phase 8 file renamed `partykit` → `yjs-lan`. Phase 1 reserves `plugins/design/hub/` workspace. New `.ai/docs/config-schema.md` consolidates evolving config. Phase 9 gains migration section from Phase 8 LAN. |
| 2026-05-12 | Phase 1 | Started `/flow:execute phase-1`. Branch `infra/phase-1-contribute-changesets` cut from `main`. |
| 2026-05-12 | Phase 1 | Tasks 1–9 + DDR-001/002 landed. Local CI smoke green (lint/test/parity/tarball/changeset-status). Awaiting `/flow:done`. |
| 2026-05-12 | done | `/flow:done` — Phase 1 closeout. Plan archived; retro recorded; reverted out-of-scope biome JSX reformat at review gate. Next: Phase 2 (Fumadocs docs site) or Phase 3 (flow ↔ design changeset). |
| 2026-05-12 | Phase 3 | `/flow:execute phase-3` — schema + `/flow:release-changelog` + `/flow:release` + onboard auto-detect + de-hardcode + DDR-003. Worked directly on `main` (no branch cut, user's choice). Docs pages (Task 11) deferred to Phase 2. |
| 2026-05-12 | done | `/flow:done` Phase 3 — DDR-003 written, changeset queued (minor), retro recorded, plan archived. CLAUDE.md debrief skipped (no new convention). Next: Phase 2 (docs site) or any of Phase 4–10. |
| 2026-05-13 | Phase 13 | `/flow:execute` Phase 13 — 11 renames, 11 compat stubs (remove v0.6.0), category: frontmatter on 29 live commands, /flow:help aggregator, CATEGORIES.md catalog, README + plugin README + CLAUDE.md updates, 18-file reference sweep clean. 40 files in commands/ (29 live + 11 stubs). |
| 2026-05-13 | Phase 13 | Post-validate triple audit (3× Explore agents) caught a hidden-dir gap — original `rg` sweep skipped `.ai/`, `.github/`, `plugins/flow/.claude-plugin/`. Patched 22 leftover refs across 14 hidden-path files (`.ai/{README,INDEX}.md`, `.ai/{decisions,reviews,logs,context}/README.md`, `.ai/docs/{PRD,config-schema}.md`, `.ai/plans/{README,phase-11-…}.md`, `.ai/state/STATE.md`, `plugins/flow/.claude-plugin/config.schema.json`, `.github/ISSUE_TEMPLATE/docs.yml`). Final `rg --hidden` sweep clean. |
| 2026-05-13 | done | `/flow:done` Phase 13 — DDR-004 recorded (naming convention + v0.6.0 stub removal target), retro appended, plan archived to `.ai/plans/archive/phase-13-…`. Local commit only (no push, per user). |
| 2026-05-13 | Phase 2 | `/flow:execute phase-2` — scoped to Task 1–2 only (scaffold + core MDX) per user. Hosting choice: Vercel (DDR-005 to record at /flow:done). Tasks 3 (auto-gen command ref), 4 (schema renderer), 5 (search + llms.txt), 6 (deploy), 7 (README dedup) deferred to follow-up execute. |
| 2026-05-13 | Phase 2 | Commit `c81da3b` lands Task 1–2. Continued execute → Task 3–7 in one pass. Auto-gen command reference (37 pages) + schema reference + robots.txt + metadataBase fix + DDR-005 + site-deploy.yml workflow (inert pending Vercel secrets) + README trim 339→164. Build green; lint clean. Awaiting `/flow:done` for retro + archive. |
| 2026-05-13 | done | `/flow:done` Phase 2 — DDR-005 recorded (Fumadocs + Vercel + accept DS defaults), patch changeset authored (`.changeset/phase-2-docs-site.md`), retro appended (what worked / didn't / change-next-time / carry-overs), plan archived to `.ai/plans/archive/phase-2-docs-site-fumadocs.md`. Next: Phase 4–10 from the v1.0 roadmap (Phase 5 dep on Phase 4; Phase 11 dep on Phase 3 + 4; Phase 6/8/9/10 sequential). |
| 2026-05-13 | design-system-init | `/flow:execute` design-system-init.md — scoped to Phase 0–2 skeleton first, then user requested continuation through Phase 6. Commit `e7d7773` (Phase 0–2): rename `/design`→`/design:edit` + compat stub + sweep (22 files), inspiration library skeleton (24 files), skill `design-system` Bootstrap+Mode-detection sections, 3 new commands (setup-onboard/setup-ds/help) + CATEGORIES.md, pre-flight bootstrap hooks in edit/new, `mdcc design init` CLI subcommand (smoke-tested). Commit `852a25a` (Phase 3–6): `design-system-completeness-critic` agent w/ 3-tier rules + `--system-only` flag, multi-DS canvas wiring (canvas-meta `designSystem` field + `--ds=` flag w/ fail-on-unknown + flow:design-system-guard scoped to canvas DS), CLAUDE.md "Design system bootstrap" section (8 rules), Fumadocs narrative pages (bootstrap.mdx, categories.mdx, multi-ds.mdx, mdcc design init in cli.mdx). |
| 2026-05-13 | done | `/flow:done` design-system-init — validate green (passed with warnings, no hard fails), changeset authored (minor bump @1agh/md-claude), `.changeset/{config.json,README.md}` restored from git history (deleted post-v0.7.0), retro appended to plan with 5 "what worked" / 4 "what didn't" / 4 "change next time" bullets + carry-over list, plan archived to `.ai/plans/archive/design-system-init.md`. Open carry-overs: inspirational library expansion (~38 unwritten reference files), multi-DS `--all-ds` critic runtime testing, version bump to v0.8 (separate cycle). Total: 83 files net, ~3,600 insertions across 3 commits on `main` (no branch). |
| 2026-05-13 | ad-hoc | Plugin namespace + `setup-onboard` → `init` rename. No plan file; started from a `/flow:quick` trigger after a user-reported autocomplete collision between `/flow:resume` and the native `/resume`. Discovered Claude Code [#22063](https://github.com/anthropics/claude-code/issues/22063): plugin commands with `name:` frontmatter lose namespace prefix, registering as bare slugs. Workaround: prefix `name:` explicitly with `<plugin>:`. Verified empirically on `resume.md` first (autocomplete showed namespaced `/flow:resume`), then propagated to 77 plugin files (49 flow + 25 design + 3 incidental). Also renamed `/flow:setup-onboard` → `/flow:init` and `/design:setup-onboard` → `/design:init` (bare-verb exception to DDR-004's `<group>-<verb>` rule, mirroring Claude Code built-in `/init`). |
| 2026-05-13 | done | `/flow:done` plugin-namespace + init rename — commit 1 (`444afa5`) namespace fix (74 files), commit 2 follows with rename + cross-refs + DDR-006 + changeset. Total: 108 files net, ~190 insertions across 2 commits on `main`. No plan to archive (ad-hoc trigger). |
| 2026-05-15 | Phase 13 | `/flow:execute` Phase 13 started — stable element IDs (`data-dc-screen`/`data-dc-element`) + canonical screenshot pipeline (`screenshot.sh`) + 3 cheap helpers (`bootstrap-check.sh`, `server-up.sh`, `slug.sh`) + `data-artboard-id` selector bug fix. 22 tasks in 4 waves. |
| 2026-05-15 | Phase 13 | All 22 tasks completed in single execute pass. 14 files modified, 5 new helpers in `dev-server/bin/` (244 lines deleted, 212 added — net ~30 line reduction despite adding ~600 LOC of helpers because callers shrank dramatically). Grep audit clean: 0 inline `agent-browser` invocations, 0 server-lifecycle bash, 0 slug bash, 0 stale `data-artboard` selectors. Live smoke green against `Canvas Viewport.html`. Awaiting `/flow:done`. |
| 2026-05-15 | done | `/flow:done` Phase 13 — validate green with soft warnings → addressed (DDR-007 element schema, DDR-008 bin/ helper home, minor changeset for Phase 13). Retro appended. Plan archived to `.ai/plans/archive/phase-13-stable-element-ids-and-canonical-screenshots.md`. Local commit on `main`, no push (per session). |
| 2026-05-15 | Phase 14 | `/flow:execute` Phase 14 — design-system-keeper agent + pattern priors envelope + token-usage doctrine. 7 tasks: T1 Token usage guide section in DS README, T2 new agent (read-only `Read,Bash,Glob,Grep`), T3 `commands/new.md` envelope `## Pattern priors` + step 9.5 invocation, T4 `commands/edit.md` step 7.5 (conditional) + step 8a DS-drift fast-path + `--skip-ds-keeper` flag, T5 CLAUDE.md pattern-lift rule (127 lines), T6 DDR-010 (DDR-009 collision with bun-runtime DDR caught at validation, renamed), T7 CATEGORIES.md auto-routed-agents cross-reference section. T1 + T5 bundled into user's parallel commits (`3d663e6`, `16af2b6`); remaining 5 files committed by `/flow:done`. |
| 2026-05-15 | done | `/flow:done` Phase 14 — DDR-010 written, retro appended (3 wins / 3 misses / 3 process improvements), action checklist in retro source ticked to `[x]`, plan archived to `.ai/plans/archive/phase-14-design-system-keeper-pattern-priors.md`. Open carry-over: scratch-project smoke run of `/design:new` to verify ds-keeper fires + reports findings on a deliberately-drifty input. |
| 2026-05-15 | Phase 3.4 | `/flow:execute` Phase 3.4 — scoped to fundament-only per user: DDR-012 pivot (React 19 unified, supersedes hybrid Preact+React draft), Task 1 audit (runtime/ verdict = canvas-runtime library, not meta-design — DDR-016), Task 2 (Bun toolchain + react/lightningcss devDeps + scripts), DDR-013 (server modular split + TS), DDR-014 (CSS @layer + Lightning CSS). 5 DDRs landed + dev-server/package.json + root engines.bun=>=1.3 + STATE.md updated. Tasks 3-16 deferred to follow-up execute sessions. Parallel to feature-docs-site-mdcc-skin (awaiting-done). |
| 2026-05-15 | Phase 3.4 | `/flow:execute` Phase 3.4 follow-up — Tasks 3-16 implementation pass in one session. Highlights: `build.ts` Bun-driven orchestrator (client + Lightning CSS + per-platform compile + --watch HMR broadcast); React 18 UMD → React 19 esm in `app.jsx` (216 KB raw / 69 KB gz under 80 KB budget); `index.html` rewritten to bundle-loading (no more babel-standalone CDN); `styles.css` split into 6 `@layer` files under `client/styles/`; `server.mjs` (1288 LOC) rewritten as 7 TypeScript modules on `Bun.serve` (server.ts/http.ts/ws.ts/api.ts/inspect.ts/history.ts/fs-watch.ts + context.ts + mem.ts auxiliary; 1963 total LOC; bun tsc --noEmit clean); native WS handlers (drops handwritten RFC-6455 upgrade); `mem.ts` FinalizationRegistry + heap-watch; `client/hmr.mjs` CSS-only live reload; `client/iframe-lazy.mjs` IntersectionObserver lazy mount + content-visibility wrappers; 7 `bun:test` smoke tests (8 pass) + perf harness; postinstall-hardlink distribution pattern (`cli/install.cjs` writes side-channel file `cli/.platform-binary-path`, `design.mjs` execs binary direct — pragmatic deviation documented in DDR-015 since full bun-CLI port is deferred); 7 sub-package manifests under `packages/md-claude-<slug>/`; root `package.json` `optionalDependencies` pin all 7; `mdcc-safe` `--ignore-scripts` fallback; `.github/workflows/build-binaries.yml` 7-platform fail-fast matrix with `publish-main needs: build-binaries`; `scripts/check-version-parity.sh` + `bump-version.sh` extended to cover sub-packages + optionalDependencies pin parity; DDR-015 written; Phase 4 + Phase 3.5 plan footers reconciled with the new pipeline. Live smoke: server.ts boots in < 200 ms on this repo, all endpoints return correct JSON, `mdcc-darwin-arm64` standalone binary compiles in ~100 ms (57 MB; under 80 MB budget). |
| 2026-05-15 | done | `/flow:done` feature-docs-site-mdcc-skin — pre-existing CI Quality red since v0.12.0 (package.json tabs vs biome's space convention) surfaced + fixed in separate commit `5c8932c` (chore: biome format drift). Static gates green (types / lint / build / 7 node:test / token sync / stats drift). 4 scenarios written + run via `flow:scenario-runner` (agent-browser 0.27.0, web-desktop+web-mobile): blockers=0, parity_ok=true, but 8 follow-ups including 3 real bugs (numbered h2 ::before counter rule unmatched, mobile theme toggle 0×0/unreachable, cmd-K backdrop blur). `flow:design-system-guard` returned BLOCK (6 blockers: glassmorphism, BMC stock PNG, Lucide Coffee in nav, h2 selector miss, mobile toggle, cmd-K SVGs). `flow:a11y-auditor` returned BLOCK (3 WCAG fails: 2.4.7 focus rings, 2.1.1 mobile toggle, 2.4.1 skip-link). `flow:review-code` PASS WITH SUGGESTIONS (12 items, none release-blocking; `<dt>`/`<dd>` outside `<dl>` in page-meta-footer + build-stats brittleness are strongest patch candidates). Per user closeout decision: accept as known issues, ship + follow-up plan rather than return to /execute. Follow-up plan written at `.ai/plans/feature-docs-site-followups.md` (21 items across 3 commits). Retro appended to docs-site plan. Plan archived. No new commit during /done (feature commits already on main via 78d9d8f + 94b4e77; only format-drift fix 5c8932c added). Carry-overs: implement followups plan; investigate agent-browser daemon stability (a11y agent fell back to static-only due to `os error 35`); decide DDR-011 amendment vs new DDR for "Lucide-in-chrome scope" + "mobile theme toggle strategy". |
| 2026-05-15 | done | `/flow:done` Phase 3.4 — validate gates green (parity / tsc / 8 smoke tests / release build with 66 KB gz bundle / 57 MB binary / live boot OK). Two runtime bugs caught + fixed during user smoke and folded into the same commit: (a) `Bun.build` `format:'iife'` + `minify:true` triggers TDZ in React 19 internals → switched to `format:'esm'` + `<script type="module">` (66 KB gz, even better than IIFE was), (b) `app.jsx` had `useCallback`-declared `startDraftFromSelection` / `startDraftFor` AFTER the `useEffect` that references them via deps — fine under babel-standalone runtime eval, real TDZ under ESM build; moved declarations above. Also fixed minor `inspect.ts` bug: `Bun.write(.keep)` was a misguided "ensure dir exists" — Bun.write creates parent dirs automatically — removed + added artifact to .gitignore. Biome auto-fix landed across 7 TS files (template literals + non-null assertion cleanup); remaining 27 findings are intentional (`any` on bus payloads + WS msg decoder, `let foo` patterns) — same exemption posture as the existing JSX. Changeset queued (minor bump). Pragmatic deviation from plan T12 (full bun-CLI port) documented in DDR-015 — only `mdcc design serve` hot path execs the native binary today; cold-path subcommands (init/config/version) keep Node dispatcher; tracked as v1.0 follow-up. Single commit on `main`: `61d9e9d`. Plan retro appended + archived to `.ai/plans/archive/phase-3.4-architecture-refactor.md`. Carry-overs: 8h soak test, cross-platform binary smoke beyond darwin-arm64, --smol runtime honor verification, `iframe-lazy.mjs` wiring into `app.jsx` (Phase 4 viewport rewrite), full CLI bun-port (v1.0), `api.ts` / `inspect.ts` LOC split. Eight pre-existing `MM` staged files from prior parallel sessions (biome.json + site/* + dev-server/bin/_screenshot-playwright.mjs) were surgically excluded via `git reset HEAD` + per-file `git add` — index now clean of any non-3.4 content; their working-tree changes ended up matching HEAD so nothing was lost. |
| 2026-05-15 | Phase 3.5 | `/flow:execute` Phase 3.5 — Tasks 4-10 implementation pass after the user-signed-off design stage (CV-08/09/10 in `.design/ui/Canvas Viewport.html`). Token bridge: full rewrite of `client/styles/1-tokens.css` with project DS OKLCH paper-light + phosphor-dark blocks inlined (decided against cross-`plugins/` @import for fragility) + a `--u-*` alias layer with sibling-token roles audited per CLAUDE.md memory; all chrome CSS now passes `grep -E '#[0-9a-f]{3,6}|rgba?\(\s*[0-9]'` zero. Chrome refactor: ghost-button `.actions` row, mono SKU-framed sidebar with hairline section dividers, hairline-underline tabs (no pills), `StatusBarSlot` helper + new slot row (ACTIVE / SELECTED / COMMENTS / LIVE / spacer / THEME); ThemeToggle component shows the destination icon (Sun↔Moon) and persists to `localStorage('mdcc-theme')`. SystemView (CV-09): added live `TokenLadder` reading `getComputedStyle(documentElement)` for 21 named tokens with a `MutationObserver` on `data-theme` to re-read on flip, plus a `TypeLadder` rendering the 8-step ladder at actual size. CommentsPanel (CV-10): tabs row got SKU-tracked mono labels with active-underline + accent counter chip; comment rows are hairline-divided, accent-tint background on active pin with left-edge accent border, muted resolved (kept opacity 1 + `--fg-2`). Validation: `bun run build.ts` green (client 3.4 MB raw / Lightning CSS 47.8 KB) — Lightning CSS produced 47.8 KB minified styles, both themes round-trip via the toggle, `bun tsc --noEmit` clean, focus rings visible via Tab navigation. Live screenshots in `/tmp/phase-3.5-shots/` confirm: dark theme catalog-stamp visual, light paper-cream equivalent, real canvas iframe inside the new shell, system view token grid. Awaiting `/flow:done`. |
| 2026-05-15 | Phase 3.5 | `/flow:plan` addendum (rev 1, then trimmed) — user first wanted "připravte layout, Phase 4 ať jen předělá render engine" → I expanded 3.5 with 6 functional tasks (pan/zoom, MiniMap, ZoomToolbar, layout.json, tab semantics, perf smoke). User then clarified: *"funkcionalita kanvasu patří do Phase 4 ať se to nepřekrývá; teď jen shell UX a UI iterace podle design návrhu."* **Trimmed Phase 3.5 to 3 visual-only tasks: T11 paper-grid bg on `.viewport`, T12 `<Wordmark>` empty-state + `<SelectionHalo>` accent corner-ticks around iframe, T13 StatusBar `ARTBOARDS` (live count) + `ZOOM` (static 100% placeholder with tooltip).** Phase 4 expanded back to 7 tasks covering the whole canvas-functionality block as one coherent rewrite: T1 multi-iframe plane refactor, T2 pan/zoom controller, T3 MiniMap + ZoomToolbar interactive, T4 tab semantics change, T5 layout.json persistence + default-grid migration, T6 perf-prototype DDR, T7 Pixi engine swap + LoD + world coords + perf gate close. Both plans now don't overlap — Phase 3.5 paints around the canvas, Phase 4 owns how the canvas works. |

## Execution Progress

### feature-docs-site-mdcc-skin — execute complete (2026-05-15)

- [x] T1: Copy MDCC tokens into site + sync script ✅ (`site/app/mdcc-tokens.css`, `site/scripts/sync-mdcc-tokens.mjs`, `pnpm sync:tokens` + `sync:tokens:check`)
- [x] T2: Swap Inter → JetBrains Mono via next/font/google ✅ (`site/app/layout.tsx` — variable `--font-mdcc-mono`, `mdcc` class + `data-theme="light"` on `<html>`)
- [x] T3: `--color-fd-*` bridge in `site/app/global.css` ✅ (overrides for 17 fumadocs slots, mapped to MDCC `--bg-*`/`--fg-*`/`--accent`)
- [x] T4: MDCC nav chrome in `lib/layout.shared.tsx` ✅ (JSX nav title + Docs/Plugins/Source links)
- [x] T5: `<SkuLabel>` component + base MDCC CSS (.mdcc-sku, .mdcc-wm, .mdcc-nav-link, .mdcc-skip-link) ✅
- [x] T6: `(home)/page.tsx` rebuilt — Hero + CatalogGrid + MetaFooter inline ✅
- [x] T7: `<CodeBlock>` MDX renderer with filename strip + copy button ✅ (`site/components/mdcc/code-block.tsx`)
- [x] T8: `<Callout>` MDX renderer with ASCII glyphs (`?`, `!`, `▲`, `★`) ✅
- [x] T9: Docs shell extras — `<SkuBreadcrumb>` + CSS-counter h2 numbering + `<PageMetaFooter>` ✅
- [x] T10: Sidebar + TOC + prev/next pager re-skin (pure CSS in global.css) ✅
- [x] T11: Cmd-K palette re-skin (CSS targeting Orama dialog selectors) ✅
- [x] T12: Theme parity — `html.dark.mdcc` selector (specificity 0,2,1) wins over `.mdcc[data-theme="light"]` (0,2,0); mirrors all MDCC dark tokens ✅
- [x] T13: Inter removed; `appName` kept (still used by OG image route) ✅
- [x] T14: DDR-011 written + indexed in `.ai/decisions/README.md` ✅

**Validation:**
- `pnpm types:check` ✅ green
- `pnpm lint` ✅ green on all touched files (12 files clean)
- `pnpm build` ✅ green — 169 static routes prerendered, 0 warnings, Turbopack 3.6s

**Carry-over:**
- Visual diff vs 4 artboards (DS-01..DS-04) NOT yet run — `/flow:validate` step that needs `flow:scenario-runner`. Recommended before `/flow:done`.
- `design-system-guard` + `a11y-auditor` scenario runs pending — both from `/flow:validate`.
- Cmd-K type-specific glyphs documented in DDR-011 as deferred (fumadocs 16.8.10 doesn't expose result-type metadata).

### Phase 13 — Stable element IDs + canonical screenshots + cheap helpers — execute complete (2026-05-15)

- [x] Wave A: runtime + inspector (Tasks 1, 2) — `data-dc-screen` on DCArtboard; inspector `cssPath`/`domPath` prefer data-dc-* attrs ✅
- [x] Wave B: helpers (Tasks 3, 4, 15, 16, 17) — `screenshot.sh` + `_screenshot-playwright.mjs` + `bootstrap-check.sh` + `server-up.sh` + `slug.sh` self-test green ✅
- [x] Wave C: callers refactor (Tasks 5–13, 18, 19, 20) — `screenshot.md` / `new.md` / `edit.md` / `setup-ds` SKILL / design SKILL / 2 critics / CATEGORIES.md / CLAUDE.md; envelope directive 15 (element tagging); `data-artboard-id` selector sweep ✅
- [x] Wave D: packaging + audit (Tasks 21, 22) — npm pack ships all 5 helpers via existing `files: ["plugins/design/dev-server"]` (no edit needed); grep audit zero hits for screenshot/bootstrap/server/slug inline duplicates ✅

Live smoke against repo (`Canvas Viewport.html`, 10 artboards): `screenshot.sh --all-screens` captured 10/10 PNGs (55 KB first); `--full` 5 KB; `--screen idle` 42 KB; `bootstrap-check.sh` 0/10/11 exit codes verified across 3 project states; `server-up.sh` alive-detect + stale-respawn green.

Manual smoke deferred: end-to-end `/design:setup-ds → new → edit` in scratch project (Task 22 plan-step) — recommended pre-`/done`.

### design-system-init — Phase 0–6 complete (this execute)

- [x] Phase 0: rename `/design` → `/design:edit` + compat stub + plugin sweep ✅
- [x] Phase 1A: inspiration library skeleton (24 files at `plugins/design/templates/design-system-inspiration/`) ✅
- [x] Phase 1B: SKILL.md `design-system` extended with Bootstrap flow + Mode-detection; copy-tree rename hook; `package.json` files += templates ✅
- [x] Phase 2A: setup-docs rename, `category:` on all 12 commands, new commands (`help`, `setup-ds`, `setup-onboard`), `CATEGORIES.md` ✅
- [x] Phase 2B: missing-state hooks in `edit.md` + `new.md` (auto-invoke onboard → bootstrap) ✅
- [x] Phase 2C: `mdcc design init` CLI subcommand (Core scaffold from inspiration library) ✅; schema extended forward-compat (Phase 3/4 fields) ✅
- [x] Phase 3: `design-system-completeness-critic` agent (3-tier rules — Core/Conventional/Free-form, adaptive by `activeFamilies` + `completenessProfile`); `commands/critic.md` += `--system-only` flag + short-circuit; skill bootstrap flow wires the critic at scaffold end ✅
- [x] Phase 4: multi-DS canvas wiring — `canvas-meta.schema.json` += `designSystem` + `opt_out_scope` fields; `commands/new.md` parses `--ds=` flag with validation + fail-with-hint on unknown DS; `flow:design-system-guard` scoped to canvas DS (reads `.meta.json.designSystem`) ✅
- [x] Phase 5: CLAUDE.md "Design system bootstrap" section (8 rules: onboard-before-bootstrap, one-skill-owns-DS, 3-sub-modes, inspiration-not-substrate, dynamic-scaffold-count, literal-project-dirname, 3-tier-compliance, daily-verb-is-edit) ✅
- [x] Phase 6: Fumadocs narrative pages — `design/bootstrap.mdx`, `design/categories.mdx`, `design/multi-ds.mdx`; `design.mdx` → `design/index.mdx` (folder pattern); `cli.mdx` += `mdcc design init` section ✅

**Open carry-over for follow-up release:**

- Inspiration library is **skeleton only** (Core 10 + Universal 6 = 16 specimens populated). `foundations/` (8), `status/` (3), `audience-*/` (5–6 per branch), `platform-*/` (2–5), `theme-both/` (1), `patterns/` (6), `meta/` (4) — total ~38 additional reference files — are stubs documented in `_MAPPING.md` but not yet authored. Single-DS minimum-viable scaffold works today; richer scaffold awaits next library pass.
- Site `categories.mdx` mentions `--all-ds` for the critic — flag exists in critic.md spec but the actual loop logic in the critic agent's pre-flight is described, not yet runtime-tested against a real multi-DS project (no production multi-DS users yet).
- Version bump (Phases 0–6 ship together as v0.8 minor) — separate cycle.

### Phase 2 — Tasks (Fumadocs docs site)

- [x] Task 1: Scaffold Fumadocs in `site/` ✅ — manual `npm create fumadocs-app` by user, then integrated into pnpm workspace (`@md-claude/site`), `esbuild`+`sharp` allow-listed, build green
- [x] Task 2: Author core MDX pages ✅ — `index`, `getting-started`, `cli`, `flow`, `design`, `config`, `recipes/{nextjs,expo,monorepo}` + sidebar `meta.json`s; home page updated; `test.mdx` removed
- [x] Task 3: Auto-generate command reference ✅ — `site/scripts/build-command-reference.mjs` walks `plugins/{flow,design}/commands/*.md` and emits 37 per-command MDX pages under `content/docs/reference/{flow,design}/<name>.mdx`. Wired as `prebuild`. Output is gitignored.
- [x] Task 4: Render config schema as typed MDX ✅ — `site/scripts/build-schema-reference.mjs` walks `config.schema.json` recursively, emits `content/docs/reference/config-schema.mdx` with every key, type, default, enum, description.
- [x] Task 5: Search + `llms.txt` polish ✅ — Fumadocs default scaffold ships Orama search + `/llms.txt` + `/llms-full.txt` + `/llms.mdx/docs/*`; added `/robots.txt` + root `metadata` (fixes Next `metadataBase` warning).
- [x] Task 6: Deploy infra ✅ — DDR-005 (`docs-site-stack-and-hosting.md`) + `.github/workflows/site-deploy.yml`. Custom domain: `md-claude.iagh.cz` (subdomain of team-owned `iagh.cz`). Vercel project `md-claude` in team `Slant` (slug `iagh`).
- [x] Task 7: README de-dup vs docs site ✅ — root `README.md` trimmed 339 → 164 lines. Flow + design command tables removed (now at `/docs/flow`, `/docs/design:edit`); kept quickstart + workspaces + releasing + local-dev (contributor info).

**Carry-over (out of plan scope):**

- Design plugin commands lack `category:` frontmatter → all 8 show as "uncategorized" in auto-gen reference. Cosmetic; align in a follow-up cleanup pass.
- Recipes (Next.js / Expo / monorepo) are documented but not tested end-to-end against fresh repos per Acceptance criterion 4 — needs a manual smoke run after deploy.


### Phase 13 — Tasks (flow command categorization)

- [x] Task 1: `plugins/flow/CATEGORIES.md` — canonical catalog with 9 groups, naming convention, rename history ✅
- [x] Task 2: 11 `git mv` renames + `name:` field updates ✅
- [x] Task 3: `category:` frontmatter on all 29 live commands; `name:` normalized to match filenames ✅
- [x] Task 4: Reference sweep (18 files updated, 0 stale refs remaining outside plan/CATEGORIES/archive/help.md) ✅
- [x] Task 5: 11 backwards-compat stubs under old filenames (shipped in v0.6.0, removed in v0.6.1) ✅
- [x] Task 6: `/flow:help` aggregator command authored ✅
- [x] Task 7: Root `README.md` regrouped + `plugins/flow/README.md` created with naming convention ✅
- [x] Task 8: `CLAUDE.md` — new "Flow command naming" subsection under Architecture ✅
- [x] Task 9: Phase 3 alignment verified (`release-changelog` + `release` ship at final names) ✅
- [ ] Task 10: Phase 2 docs-site flow page — **carry-over** (out of scope here)

### Phase 3 — Tasks (flow changelog integration + /flow:release)

- [x] Task 1: Schema — `integrations.changelog` (provider/scope/releaseGuide/mcp/defaults) ✅
- [x] Task 2: Skeleton default `{changelog: {provider: none}}` ✅
- [x] Task 3: `/flow:release-changelog` command (changesets impl + stub for others) ✅
- [x] Task 4: `/flow:validate` Step 7b — non-blocking changelog hygiene ✅
- [x] Task 5: `/flow:done` Step 4b — overridable changelog reminder ✅
- [x] Task 6: DDR-keeper SKILL.md — provider-choice is DDR-worthy ✅
- [x] Task 7: De-hardcoded `changeset` in `execute.md:179` + `quick.md:37` ✅ (grep clean)
- [x] Task 8: `release-guide.md` template + `mdcc init --provider` propagation ✅ (smoke-tested 4 providers)
- [x] Task 9: `/flow:setup-onboard` Q7 auto-detect + scaffold ✅
- [x] Task 10: `/flow:release` runbook walker ✅
- [ ] Task 11: Docs pages — **deferred** (Phase 2 site dependency, tracked as carry-over)

### Phase 1 — Tasks

- [x] Task 0: Monorepo + workspace bootstrap ✅ tarball shape clean (42 files), parity OK
- [x] Task 1: CONTRIBUTING + CoC + SECURITY ✅ (CoC links Contributor Covenant 2.1)
- [x] Task 2: PR + issue templates ✅ (PULL_REQUEST_TEMPLATE.md + ISSUE_TEMPLATE/{bug,feature,docs,config}.yml)
- [x] Task 3: Wire Dependabot ✅ (.github/dependabot.yml — npm + actions, weekly, grouped)
- [x] Task 4: Bootstrap Changesets ✅ (config + Phase 1 changeset queued; status reports minor)
- [x] Task 5: Version wrapper preserving parity ✅ (scripts/changesets-version.sh)
- [x] Task 6: Quality CI workflow + argv test ✅ (biome + 7 argv tests passing; dev-server JSX excluded — pre-existing debt)
- [x] Task 7: Update publish workflow ✅ (build → publish → GH Release from CHANGELOG)
- [x] Task 8: GitHub repo via gh CLI ✅ (script + JSON payloads + CODEOWNERS + auto-merge-dependabot workflow). Script not yet **applied** to live repo (gated — needs maintainer to run).
- [x] Task 9: Update README ✅ (Workspaces section, reauthored Releasing, new Repo administration section)
- [x] DDR sweep: DDR-001 + DDR-002 written

### phase-3.4-architecture-refactor — fundament partial (2026-05-15)

> Scope this session: DDR groundwork + Task 1 audit + Task 2 deps. Tasks 3-16 (build pipeline, client migration, server rewrite, CSS @layer files, HMR, lazy iframes, perf harness, postinstall pattern, CI matrix, plan updates) deferred to follow-up `/flow:execute` sessions.

- [x] **DDR-012** — React 19 everywhere ✅ (`.ai/decisions/DDR-012-react-19-unified-runtime.md` — supersedes the hybrid Preact+React assumption; relaxes perf budgets to bundle < 80 KB, RAM < 80 MB, first paint < 350 ms)
- [x] **Task 1** — Audit `runtime/` folder ✅ (verdict: canvas-runtime library injected into user HTML pages via `/_runtime/*`, NOT meta-design. Plan hypothesis re: commit `5864f71` was wrong — actual origin is `b200e59`.) → **DDR-016** landed
- [x] **Task 2** — Bun toolchain deps ✅ (`plugins/design/dev-server/package.json` rewritten — `@types/bun`, `react ^19`, `react-dom ^19`, `@types/react ^19`, `@types/react-dom ^19`, `lightningcss ^1.27` in devDependencies; `build`/`build:watch`/`test`/`typecheck` scripts; root `package.json` `engines.bun = ">=1.3"`. No `pnpm install` / `bun install` run yet — defer to Task 3 session to avoid lockfile drift mid-refactor.) Bun 1.3.3 verified locally.
- [x] **DDR-013** — Server modular split + TypeScript ✅ (`.ai/decisions/DDR-013-server-modular-split-typescript.md` — 7 modules (`server.ts`, `http.ts`, `ws.ts`, `api.ts`, `inspect.ts`, `history.ts`, `fs-watch.ts`) + `mem.ts` auxiliary; ≤ 300 LOC each; Context-object communication; no module-level mutable state)
- [x] **DDR-014** — CSS @layer architecture ✅ (`.ai/decisions/DDR-014-css-layer-architecture.md` — `reset, tokens, layout, shell, components, utilities`; Lightning CSS at build time; DS token import via `1-tokens.css`)
- [x] **DDR-016** — `runtime/` folder verdict ✅ (`.ai/decisions/DDR-016-runtime-folder-purpose.md` — canvas-runtime library; renamed `.jsx` → `.tsx` in Task 7; IIFE bundle registers `window.*` globals for backward-compat with user HTML pages)
- [x] **DDR README + DDR-009 update** ✅ (DDR-README index now lists DDR-012/013/014/016; DDR-009's "Companion DDRs" footer renumbered from the old DDR-010..014 numbering to actual DDR-012..016)
- [x] **Task 3** — `build.ts` Bun-driven orchestrator ✅ (client `Bun.build` IIFE + Lightning CSS + per-platform `bun build --compile` + `--watch` HMR broadcast + `--dry-run` smoke)
- [x] **Task 4** — `app.jsx` UMD React → React 19 esm ✅ (`import { ... } from 'react'` + `createRoot` from `react-dom/client`; release bundle 216 KB raw / 69 KB gz — under 80 KB budget)
- [x] **Task 5** — `index.html` bundle-loading ✅ (no more unpkg babel-standalone / UMD)
- [x] **Task 6** — `client/styles/` 6 `@layer` files + Lightning CSS ✅ (0-reset / 1-tokens / 2-layout / 3-shell / 4-components / 5-utilities; `_index.css` declares layer order; output 25 KB minified)
- [x] **Task 7** — `server.mjs` → 7 TS modules on `Bun.serve` ✅ (server.ts/http.ts/ws.ts/api.ts/inspect.ts/history.ts/fs-watch.ts + context.ts factory base + mem.ts; 1963 LOC total; `bun tsc --noEmit` clean; native WS drops handwritten RFC-6455 upgrade; live boot returns correct JSON on /_health /_config /_index-data /_system-data)
- [x] **Task 8** — `mem.ts` ✅ (FinalizationRegistry + WeakMapById + startHeapWatch with warn/panic thresholds; --smol embedded into `bun build --compile`)
- [x] **Task 9** — `client/hmr.mjs` ✅ (CSS-only path zero-risk reload via `<link>` cache-busting; JSX path full-page reload until react-refresh-runtime is wired in Phase 3.5)
- [x] **Task 10** — `client/iframe-lazy.mjs` ✅ (IntersectionObserver mount + content-visibility wrapper + 30s-idle detach + state stash)
- [x] **Task 11** — perf harness + 7 `bun:test` smokes ✅ (server-lifecycle / ws-handshake / active-state / history-rollback (2 tests) / fs-watch / bundle-smoke / binary-smoke; `bun test` = 8 pass 0 fail in 1.6 s; `test/perf-harness.ts` measures cold start + gz bundle + WS p50/p99)
- [x] **Task 12** — postinstall-hardlink distribution ✅ (pragmatic deviation per DDR-015 — `cli/install.cjs` writes `cli/.platform-binary-path` side channel, `design.mjs` execs binary directly for `mdcc design serve` hot path; `mdcc.exe` stub + `mdcc-safe` (`cli/cli-wrapper.cjs`) fallback for `--ignore-scripts`; 7 sub-packages under `packages/md-claude-<slug>/`; root `optionalDependencies` pins all 7; full bun-CLI port deferred to Phase 3.5/3.6)
- [x] **Task 13** — `.github/workflows/build-binaries.yml` ✅ (7-platform fail-fast matrix on v*.*.* tags incl. Alpine musl variants + Windows; `publish-main needs: build-binaries`; npm provenance on every sub-package + main)
- [x] **Task 14** — DDR-015 written ✅ (per-platform binary distribution rationale + alternatives + Claude-Code precedent + pragmatic-partial deviation footer)
- [x] **Task 15** — Phase 4 plan reconciled ✅ (already had Phase 3.4 dependency from prior session; verified no stale references to `runtime-agnostic constraint` or `build.mjs`; relaxed Phase 3.4 budget references to DDR-012 values)
- [x] **Task 16** — Phase 3.5 plan reconciled ✅ (Task 4 note about bundle-loading index.html; Task 5 retargeted to `client/styles/1-tokens.css` `@layer tokens`; Validation section bumped — biome/tsc/build are now actual gates, not "skip")

**Files added (Tasks 3-16):**

- `plugins/design/dev-server/build.ts`, `tsconfig.json`, `context.ts`, `server.ts`, `http.ts`, `ws.ts`, `api.ts`, `inspect.ts`, `history.ts`, `fs-watch.ts`, `mem.ts`
- `plugins/design/dev-server/client/styles/{0-reset,1-tokens,2-layout,3-shell,4-components,5-utilities,_index}.css`
- `plugins/design/dev-server/client/{hmr,iframe-lazy}.mjs`
- `plugins/design/dev-server/test/{_helpers,server-lifecycle,ws-handshake,active-state,history-rollback,fs-watch,bundle-smoke,binary-smoke}.{ts,test.ts}` + `perf-harness.ts`
- `packages/md-claude-{darwin-arm64,darwin-x64,linux-x64,linux-arm64,linux-x64-musl,linux-arm64-musl,win32-x64}/{package.json,README.md}` (7 sub-packages)
- `cli/{install.cjs,cli-wrapper.cjs,bin/mdcc.exe}` (postinstall + safe-mode bin + 500-byte stub)
- `.github/workflows/build-binaries.yml`
- `.ai/decisions/DDR-015-per-platform-binary-distribution.md`

**Files modified (Tasks 3-16):**

- `plugins/design/dev-server/client/{app.jsx,index.html}` (React 19 esm; bundle-loading)
- `plugins/design/dev-server/package.json` (typescript + bun-types added)
- `package.json` (root: `bin.mdcc-safe`, `postinstall`, `optionalDependencies` × 7, `start`/`dev` use `bun run server.ts`, `build:binary` + `test:dev-server` scripts)
- `cli/commands/design.mjs` (side-channel binary path resolution for `mdcc design serve`)
- `scripts/{check-version-parity.sh,bump-version.sh}` (sub-package + optionalDependencies pin parity)
- `.ai/decisions/README.md` (DDR-015 indexed)
- `.ai/plans/{phase-4-canvas-v2-rendering-engine,phase-3.5-dev-server-ui-ux-refresh}.md` (3.4 alignment notes)

**Verification status this session:** No `bun run build.ts` exists yet (Task 3); no tests run; JSON syntax + Bun 1.3.3 install verified. Edit-Verify Loop is N/A — work is purely additive paper artifacts (DDRs) + a `package.json` rewrite with no runtime callers yet.

**Files modified:**

- `.ai/decisions/DDR-009-bun-runtime-authoritative-for-dev-server.md` — companion-DDRs footer renumbered
- `.ai/decisions/README.md` — index updated for DDR-012/013/014/016
- `.ai/state/STATE.md` — Phase header + Decisions list + History row + this section

**Files created:**

- `.ai/decisions/DDR-012-react-19-unified-runtime.md`
- `.ai/decisions/DDR-013-server-modular-split-typescript.md`
- `.ai/decisions/DDR-014-css-layer-architecture.md`
- `.ai/decisions/DDR-016-runtime-folder-purpose.md`
- `plugins/design/dev-server/package.json` — full rewrite (was 12-line stub)
- `package.json` — root `engines.bun: ">=1.3"` added
