# Workflow State

> Schema + rules live in `.claude/skills/workflow-state/SKILL.md`.

**Workflow:** feature-delivery — md-claude v1.0 roadmap
**Phase:** Phase 3 — flow changelog integration + /flow:release
**Status:** done
**Started:** 2026-05-12
**Updated:** 2026-05-12
**Active task:** —
**Active plan:** —
**Last archived plan:** `.ai/plans/archive/phase-3-flow-changelog.md`
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

## Execution Progress

### Phase 3 — Tasks (flow changelog integration + /flow:release)

- [x] Task 1: Schema — `integrations.changelog` (provider/scope/releaseGuide/mcp/defaults) ✅
- [x] Task 2: Skeleton default `{changelog: {provider: none}}` ✅
- [x] Task 3: `/flow:release-changelog` command (changesets impl + stub for others) ✅
- [x] Task 4: `/flow:validate` Step 7b — non-blocking changelog hygiene ✅
- [x] Task 5: `/flow:done` Step 4b — overridable changelog reminder ✅
- [x] Task 6: DDR-keeper SKILL.md — provider-choice is DDR-worthy ✅
- [x] Task 7: De-hardcoded `changeset` in `execute.md:179` + `quick.md:37` ✅ (grep clean)
- [x] Task 8: `release-guide.md` template + `mdcc init --provider` propagation ✅ (smoke-tested 4 providers)
- [x] Task 9: `/flow:onboard` Q7 auto-detect + scaffold ✅
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
