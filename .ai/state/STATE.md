# Workflow State

> Schema + rules live in `.claude/skills/workflow-state/SKILL.md`.

**Workflow:** feature-delivery — md-claude v1.0 roadmap
**Phase:** design-system-init (Phase 0–4)
**Status:** in-progress
**Started:** 2026-05-12
**Updated:** 2026-05-13
**Active task:** `.ai/plans/design-system-init.md`
**Active plan:** `.ai/plans/design-system-init.md`
**Last archived plan:** `.ai/plans/archive/phase-2-docs-site-fumadocs.md`
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
| 2026-05-13 | design-system-init | `/flow:execute` design-system-init.md — scoped to Phase 0–2 skeleton (Phase 3 critic, Phase 4 multi-DS, Phase 5 CLAUDE.md, Phase 6 docs site deferred). Phase 0 rename `/design`→`/design:edit` + compat stub + sweep (22 files). Phase 1A inspiration library skeleton (Core 10 + Universal 6 + `_README` + `_MAPPING` = 24 files at `plugins/design/templates/design-system-inspiration/`). Phase 1B extended `skills/design-system/SKILL.md` with Bootstrap flow + Mode-detection sections; `package.json` files += templates; `cli/lib/copy-tree.mjs` += rename hook. Phase 2A: `commands/docs.md` → `setup-docs.md`, `category:` on all 12 commands, new `help.md` + `setup-ds.md` + `setup-onboard.md` + `CATEGORIES.md`. Phase 2B: pre-flight bootstrap-detection hooks in `edit.md` + `new.md`. Phase 2C: `mdcc design init [--no-discovery / --discovery-payload]` subcommand (smoke-tested in `/tmp/scratch-design` — 16 files scaffolded, config schema-valid). Schema extended with `extensions`, `completenessProfile`, `activeFamilies`, `designSystems[]`, `defaultDesignSystem` (forward-compat for Phase 3/4). |

## Execution Progress

### design-system-init — Phase 0–2 skeleton (this execute)

- [x] Phase 0: rename `/design` → `/design:edit` + compat stub + plugin sweep ✅
- [x] Phase 1A: inspiration library skeleton (24 files at `plugins/design/templates/design-system-inspiration/`) ✅
- [x] Phase 1B: SKILL.md `design-system` extended with Bootstrap flow + Mode-detection; copy-tree rename hook; `package.json` files += templates ✅
- [x] Phase 2A: setup-docs rename, `category:` on all 12 commands, new commands (`help`, `setup-ds`, `setup-onboard`), `CATEGORIES.md` ✅
- [x] Phase 2B: missing-state hooks in `edit.md` + `new.md` (auto-invoke onboard → bootstrap) ✅
- [x] Phase 2C: `mdcc design init` CLI subcommand (Core scaffold from inspiration library) ✅; schema extended forward-compat (Phase 3/4 fields) ✅
- [ ] Phase 3 (adaptive completeness-critic) — deferred to follow-up `/flow:execute`
- [ ] Phase 4 (multi-DS canvas wiring) — deferred to follow-up
- [ ] Phase 5 (CLAUDE.md "Design system bootstrap" section) — deferred to follow-up
- [ ] Phase 6 (Fumadocs site sync — `/design` → `/design:edit` sweep + new pages) — deferred to follow-up

**Carry-over for next execute:**

- The bootstrap skill **calls** `design-system-completeness-critic` but the agent doesn't exist yet (Phase 3 deliverable). Skill currently passes through silently when missing — acceptable for skeleton, must land before next release.
- `setup-ds.md` references multi-DS `additional-ds` + `re-bootstrap` modes; works for single-DS today, multi-DS canvas wiring (per-canvas `.meta.json.designSystem`, `--ds=` validation in `/design:new`) is Phase 4.
- Site docs still reference `/design` → must be swept in Phase 6.
- Inspiration library is **skeleton only** (Core 10 + Universal 6 = 16 specimens out of the ~62-file full library planned). `foundations/`, `status/`, `audience-*/`, `platform-*/`, `theme-*/`, `patterns/`, `meta/` are intentionally empty for follow-up phases — `_MAPPING.md` documents the full shape.

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
