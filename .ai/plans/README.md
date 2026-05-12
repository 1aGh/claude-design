# Plans

Feature implementation plans. One file per feature; the active multi-phase roadmap below maps to [`../docs/PRD.md`](../docs/PRD.md).

## Lifecycle (per-plan convention)

1. `/flow:plan <feature>` — drafts the plan with task list, file-touch map, scenarios.
2. `/flow:execute` — works through tasks, ticking `[x]`.
3. `/flow:done` — finalizes, runs validation, moves the file to `archive/`.

**Conventions:** front-matter `name | status | created | decisions`; task IDs `T1..Tn` so `/flow:resume` can re-enter mid-flow; archive on `/flow:done`, not on last task tick.

---

# md-claude v1.0 → v1.2+ — Execution roadmap

> 7 active v1.0 phases + 1 icebox + 1 late-v1.0 + 3 post-v1.0 plans, all implementing [`../docs/PRD.md`](../docs/PRD.md). Config reference at [`../docs/config-schema.md`](../docs/config-schema.md). Architecture research at [`../docs/research-runtime.md`](../docs/research-runtime.md) + [`../docs/research-collab.md`](../docs/research-collab.md).

## Dependency graph (v1.0 ship line)

```
                  ┌──────────────────────────────────┐
                  │ Phase 1: Contribute infra        │
                  │ + Changesets + monorepo          │
                  │ (incl. hub/ workspace reservation)│
                  │ (foundation — blocks everything) │
                  └────────────────┬─────────────────┘
                                   │
                ┌──────────────────┼──────────────────┐
                │                  │                  │
                ▼                  ▼                  ▼
        ┌───────────────┐  ┌───────────────┐  ┌──────────────────┐
        │ Phase 2:      │  │ Phase 3:      │  │ Phase 4:         │
        │ Docs site     │  │ release-       │ │ Canvas v2 engine │
        │ (Fumadocs)    │  │ changelog/cut  │ │ + infinite canvas│
        └───────────────┘  └───────────────┘  └────────┬─────────┘
                                                       │
                          ┌────────────────────────────┴───────────────┐
                          │                                            │
                          ▼                                            ▼
                  ┌────────────────┐                       ┌──────────────────┐
                  │ Phase 5:       │                       │ Phase 6:         │
                  │ Multi-DS       │                       │ Comments +       │
                  │ (gen-time) +   │   parallel            │ presentation +   │
                  │ draw tools     │                       │ export           │
                  └────────────────┘                       └────────┬─────────┘
                                                                    │
                                                                    ▼
                                                        ┌──────────────────────────┐
                                                        │ Phase 8: Live collab     │
                                                        │ LAN ("ambient multi-     │
                                                        │ player") — Yjs + Aware   │
                                                        │ Depends on 4 + 6         │
                                                        └────────────┬─────────────┘
                                                                     │
                                                                     ▼ (late v1.0 or v1.1)
                                                        ┌──────────────────────────┐
                                                        │ Phase 11: Flow ↔ Design  │
                                                        │ integration (extracted   │
                                                        │ from old Phase 3)        │
                                                        └──────────────────────────┘

Phase 7 (ACP chat sidebar): ❄️ ICEBOX — deferred to v1.1+ if user feedback validates
```

## Roadmap beyond v1.0

```
v1.1 (post-v1.0, ~6-8 weeks)
└─ Phase 9: Self-hostable hub + bidirectional file sync (Hocuspocus)
   Depends on Phase 8 (Yjs runtime) + Phase 1 (hub workspace pre-reserved)

v1.2 (conditional, only if v1.1 incidents prove need)
└─ Phase 10: Structured CRDT HTML co-editing (data-cd-id + Y.XmlFragment)
   Depends on Phases 4, 5, 6, 8, 9

v1.3+ (conditional on user-feedback survey)
└─ Phase 12: In-canvas CSS editor + Layers panel (Webflow-style direct manipulation)
   Depends on Phases 4, 5 (and ideally 10 for multi-peer ops)
```

## Execution order

| Step | Phase | File | Can parallelize? | Ship | Command |
| ---- | ----- | ---- | ---------------- | ---- | ------- |
| 1 | Contribute infra + Changesets + monorepo | `phase-1-contribute-infra-changesets.md` | — | v1.0 | `/flow:execute .ai/plans/phase-1-contribute-infra-changesets.md` |
| 2 | Docs site (Fumadocs) | `phase-2-docs-site-fumadocs.md` | with Phase 3 | v1.0 | `/flow:execute .ai/plans/phase-2-docs-site-fumadocs.md` |
| 3 | `integrations.changelog` + `/flow:release-changelog` + `/flow:release` | `phase-3-flow-changelog.md` | with Phase 2 | v1.0 | `/flow:execute .ai/plans/phase-3-flow-changelog.md` |
| 13 | Flow command categorization (naming + index, no subfolders) | `phase-13-flow-command-categorization.md` | with Phase 2 | v1.0 | `/flow:execute .ai/plans/phase-13-flow-command-categorization.md` |
| 4 | Canvas v2 rendering engine | `phase-4-canvas-v2-rendering-engine.md` | — | v1.0 | `/flow:execute .ai/plans/phase-4-canvas-v2-rendering-engine.md` |
| 5 | Multi-DS + draw tools | `phase-5-multi-ds-and-draw-tools.md` | with Phase 6 | v1.0 | `/flow:execute .ai/plans/phase-5-multi-ds-and-draw-tools.md` |
| 6 | Comments + presentation + export | `phase-6-comments-presentation-export.md` | with Phase 5 | v1.0 | `/flow:execute .ai/plans/phase-6-comments-presentation-export.md` |
| 7 | ACP chat sidebar | `phase-7-acp-chat-sidebar.md` | ❄️ skipped | ICEBOX | (not in v1.0) |
| 8 | Live collaboration LAN | `phase-8-live-collaboration-yjs-lan.md` | — | v1.0 | `/flow:execute .ai/plans/phase-8-live-collaboration-yjs-lan.md` |
| 11 | Flow ↔ Design integration | `phase-11-flow-design-integration.md` | — | v1.0 late / v1.1 | `/flow:execute .ai/plans/phase-11-flow-design-integration.md` |
| 9 | Self-hosted hub + file sync (Hocuspocus) | `phase-9-self-hosted-hub-file-sync.md` | post-v1.0 | v1.1 | `/flow:execute .ai/plans/phase-9-self-hosted-hub-file-sync.md` |
| 10 | Structured CRDT HTML co-editing | `phase-10-structured-crdt-html-coediting.md` | post-v1.1, conditional | v1.2 conditional | `/flow:execute .ai/plans/phase-10-structured-crdt-html-coediting.md` |
| 12 | In-canvas CSS editor + Layers | `phase-12-in-canvas-css-and-layers.md` | post-v1.2, conditional | v1.3+ conditional | `/flow:execute .ai/plans/phase-12-in-canvas-css-and-layers.md` |

## Copy-paste execution blocks (v1.0)

### Phase 1 — Contribute infra + Changesets + monorepo

```
/flow:execute .ai/plans/phase-1-contribute-infra-changesets.md
```

> **What to build:** `CONTRIBUTING.md` / COC / `SECURITY.md`, PR + issue templates, Dependabot, bootstrap Changesets in this repo via a wrapper script that preserves `scripts/check-version-parity.sh`, add `.github/workflows/quality.yml` (Biome + `node:test` + link-check), document recommended branch protection. Adopt `pnpm changeset add` as the contributor release flow; keep `scripts/bump-version.sh` as emergency manual fallback. **Plus: monorepo bootstrap** with `pnpm-workspace.yaml` listing `[site, plugins/design/dev-server, plugins/design/hub]` — `hub/` is Phase 9 territory but reserved here. GitHub repo setup via `gh` CLI (`scripts/setup-github.sh`).

### Phase 2 — Docs site (Fumadocs)

```
/flow:execute .ai/plans/phase-2-docs-site-fumadocs.md
```

> **What to build:** `site/` Next.js workspace (excluded from default `pnpm install` via `--filter`). Author core MDX pages (getting-started, cli, flow, design, config, recipes/{nextjs,expo,monorepo}). Auto-generate command + schema reference from `plugins/*/commands/*.md` frontmatter and `config.schema.json`. Enable Fumadocs search; add `llms.txt`. Deploy via Vercel (DDR for hosting choice). Link from README; de-duplicate.

### Phase 3 — `integrations.changelog` + `/flow:release-changelog` + `/flow:release`

```
/flow:execute .ai/plans/phase-3-flow-changelog.md
```

> **What to build:** Generic `integrations.changelog` block in `config.schema.json` (provider enum: `changesets` | `git-cliff` | `conventional` | `custom` | `none`; sibling of `tracker` / `analytics` / `ci` / `design`). New `/flow:release-changelog` command authors entries (Changesets provider implemented; others stub with TODO). New `/flow:release` walks a project-owned `.ai/release-guide.md` runbook step-by-step with `[run]/[skip]/[edit]/[abort]` confirmations. `/flow:onboard` (renamed to `/flow:setup-onboard` in Phase 13) auto-detects provider from filesystem markers, asks Q7, scaffolds provider-appropriate runbook stub. `/flow:validate` + `/flow:done` add non-blocking changelog-hygiene warnings. `/flow:execute` + `/flow:quick` de-hardcoded. Commands ship under `release-*` group per Phase 13 naming convention. Flow⇄design seam **moved to Phase 11**.

### Phase 4 — Canvas v2 rendering engine

```
/flow:execute .ai/plans/phase-4-canvas-v2-rendering-engine.md
```

> **What to build:** Replace iframe-only canvas with hybrid Pixi.js (WebGL) viewport over positioned iframes. Pan / zoom / pinch / spacebar-drag. Mini-map, zoom controls, fit-to-screen. Per-canvas `.layout.json` for spatial state. Migrate v0.x canvases on first load. Introduce esbuild bundler; pre-build client dist for shipping. Perf gate: 50 artboards × 30 nodes ≥ 55fps on M1 Air. **Big DDR: Pixi vs fallback** based on perf prototype in Task 1.

### Phase 5 — Multi-DS + draw tools

```
/flow:execute .ai/plans/phase-5-multi-ds-and-draw-tools.md
```

> **What to build:** Multi design-system **as attachment** (revised interpretation 2026-05-12): multiple `.design/system/<name>/` folders, each scaffolds canvases via `/design:new --ds=<name>`. Per-canvas `.meta.json.designSystem` records membership; `design-system-guard` subagent scopes per canvas. **Not** a runtime canvas switcher. Plus: draw / annotation tools (pen / circle / arrow as SVG sidecar). Layers panel + in-canvas CSS editor explicitly NOT in this phase — moved to Phase 12.

### Phase 6 — Comments + presentation + export

```
/flow:execute .ai/plans/phase-6-comments-presentation-export.md
```

> **What to build:** Pin-comments anchored to element or world coords, threading + resolve + @mention (git committer autocomplete), persisted to `.design/_comments/<slug>.json`. Presentation mode (full-screen, arrow keys, Esc). Exporters: PDF (`pdf-lib`), PNG (Playwright dev-dep), HTML zip (inlined assets), Canva (best-effort archive + README). Surface via `mdcc design export` CLI + `/design:export` slash command.

### Phase 7 — ACP chat sidebar [❄️ ICEBOX — skip for v1.0]

> **Deferred 2026-05-12.** ACP is inherently local-per-peer (hub doesn't proxy cross-peer). Marginal value-add in hub federation; saves ~2 weeks of v1.0 scope. Plan retained at `phase-7-acp-chat-sidebar.md` with icebox header. Re-evaluate at v1.1+ if user feedback validates browser-based agent chat as designer need.

### Phase 8 — Live collaboration LAN ("ambient multiplayer")

```
/flow:execute .ai/plans/phase-8-live-collaboration-yjs-lan.md
```

> **What to build:** Yjs + Awareness over existing dev-server WS. Cursors / selections / viewport sync (ephemeral). Y.Doc-backed comment threads + annotations (persisted to JSON snapshots at quiescence). "Claude is editing" awareness banner during `/design` runs. NO HTML co-editing (deferred to Phase 10). `--bind 0.0.0.0` opt-in via `MDCLAUDE_LAN=1` + `--collab-token`. Cross-NAT recipes documented (Tailscale, Cloudflare Tunnel). v1.0 release blocker: this is the last v1.0 phase before final `/flow:validate` + tag.

### Phase 11 — Flow ↔ Design integration (late v1.0 / early v1.1)

```
/flow:execute .ai/plans/phase-11-flow-design-integration.md
```

> **What to build:** Close the seam between flow + design plugins. `/flow:plan <feature>` auto-detects matching canvases in `.design/` (slug + `.meta.json.tags` heuristic), surfaces them as plan context. `/flow:done` inventories canvases with `status: ready-for-handoff` and offers `/design:handoff` sweep. `codebase-intelligence` skill includes Design artifacts in `.ai/context/codebase-map.md`. `ddr-keeper` prompts for `relatedCanvas` on UI-themed DDRs. DDR for soft vs. hard handoff prompt.

## Copy-paste execution blocks (post-v1.0)

### Phase 9 — Self-hostable hub + bidirectional file sync (v1.1)

```
/flow:execute .ai/plans/phase-9-self-hosted-hub-file-sync.md
```

> **What to build:** `mdcc hub serve|deploy|token|status` + `mdcc design link|unlink|status|adopt`. Hocuspocus-based hub (`@hocuspocus/server` + `@hocuspocus/extension-sqlite`) bundled as `dist/hub.bundle.mjs`. Deploy recipes: Fly (primary), Docker Compose + Caddy, systemd, Tailscale Funnel, Cloudflare Tunnel. Bidirectional fs watcher with echo prevention (SHA-256 origin tags + 1500ms windows). Per-peer local `.design/` is mirror of hub canonical Yjs state. v1.1 treats HTML body as opaque `Y.Text` (structured CRDT deferred to Phase 10). `collab.commitStrategy: full | hub-only | manual` gitignore mode. Token UX: `generate / rotate / list / revoke` with HMAC storage on hub side. Phase 8 → Phase 9 migration documented.

### Phase 10 — Structured CRDT HTML co-editing (v1.2 conditional)

```
/flow:execute .ai/plans/phase-10-structured-crdt-html-coediting.md
```

> **What to build (only if v1.1 incidents prove need):** Stable element identity via `data-cd-id` injection. HTML ↔ Y.XmlFragment round-trip codec. Tree-edit-distance diff engine for `/design` Write-tool output. Inspector + layers panel rebind to Y.XmlElement ops (cross-peer concurrent edits). Stash-on-branch-switch reconciliation. Task 0 fidelity spike is go/no-go gate.

### Phase 12 — In-canvas CSS editor + Layers panel (v1.3+ conditional)

```
/flow:execute .ai/plans/phase-12-in-canvas-css-and-layers.md
```

> **What to build (only if user-feedback survey validates):** Layers panel (DOM tree, drag-to-reorder). Inspector panel for top-10 CSS properties → rewrite source HTML. Source-rewrite strategy DDR (inline / class / smart). Keyboard shortcuts `L / I`. Gates on Task 0 survey ≥30% "I want this frequently."

## Validation commands

After every phase: `/flow:verify` for touched files; before merge: `/flow:validate` for the full gate (lint + tests + build + scenarios + a11y + DS).

Before tagging `v1.0.0`:

```
/flow:validate                                # full gate
scripts/check-version-parity.sh               # belt-and-suspenders
pnpm changeset status                         # confirm no pending changesets unpublished
node --test cli/**/*.test.mjs                 # explicit
```

Plus schema validation (after Phase 1):

```
npx ajv-cli validate -s plugins/flow/.claude-plugin/config.schema.json -d .ai/workflows.config.json
npx ajv-cli validate -s plugins/design/dev-server/config.schema.json -d .design/config.json
```

## Final release (v1.0)

```
pnpm changeset version       # bumps via the new wrapper (Phase 1 Task 5)
pnpm changeset publish       # publishes + tags v1.0.0
git push --follow-tags       # triggers .github/workflows/publish.yml
```

Then in Claude Code (against every consumer repo):

```
/plugin marketplace update md-claude
/plugin install design@md-claude
/plugin install flow@md-claude
```

## Tracking

Workflow state for this roadmap lives at `../state/STATE.md`. Each phase opens a feature branch, lands a changeset, and gets merged behind a `next` branch. Final v1.0 squash to `main` only after Phase 8 ships (+ optionally Phase 11) and `/flow:validate` is clean across all phases. Phase 9 starts its own development line post-tag.
