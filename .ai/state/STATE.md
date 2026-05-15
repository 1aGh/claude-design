# Workflow State

> Schema + rules live in `.claude/skills/workflow-state/SKILL.md`.

**Workflow:** feature-delivery — md-claude v1.0 roadmap
**Phase:** feature-docs-site-mdcc-skin — **execute-complete**
**Status:** awaiting-done
**Started:** 2026-05-12
**Updated:** 2026-05-15
**Active task:** —
**Active plan:** `.ai/plans/feature-docs-site-mdcc-skin.md`
**Last archived plan:** `.ai/plans/archive/phase-14-design-system-keeper-pattern-priors.md`
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
