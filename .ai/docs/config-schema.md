# Config schemas — consolidated reference

> Authored 2026-05-12 as audit-driven addition. Single doc covering both major config files: `.ai/workflows.config.json` (flow plugin) and `.design/config.json` (design plugin), plus per-canvas `.meta.json`. Each field annotated with: type, default, introducing-phase, related slash commands. Use this to understand the *shape* of a complete v1.0+ project without spelunking through 10 phase plans.

## File 1 — `.ai/workflows.config.json` (flow plugin)

**Authoritative schema:** [`plugins/flow/.claude-plugin/config.schema.json`](../../plugins/flow/.claude-plugin/config.schema.json).

**Validation:** `ajv validate -s plugins/flow/.claude-plugin/config.schema.json -d .ai/workflows.config.json`.

**Full structure** (annotated post-v1.0):

```jsonc
{
  "$schema": "https://raw.githubusercontent.com/1aGh/md-claude/main/plugins/flow/.claude-plugin/config.schema.json",
  "name": "md-claude",                  // project slug; resolved into <project> placeholder by every flow command
  "language": "en",                     // "en" | "cs" | other ISO-639-1; affects /flow:plan + DDR prose

  "theme": "agnostic",                  // "dark" | "light" | "agnostic"; design-system-guard hint

  "paths": {                            // pre-v1.0
    "prd": ".ai/<name>-prd.md",
    "designSystem": ".ai/<name>-design-system.md",
    "codebaseMap": ".ai/context/codebase-map.md",
    "designRoot": ".design"             // Phase 11 — flow scans this for canvas detection
  },

  "platforms": ["web-desktop"],         // pre-v1.0; influences scenario-runner platform matrix

  "stack": {                            // Phase 1 — auto-detected by /flow:setup-onboard
    "language": "javascript",
    "framework": "none",
    "packageManager": "npm",
    "buildTool": "none",
    "monorepo": false,
    "ci": "github-actions",
    "tests": "none",
    "css": "none",
    "router": "none"
  },

  "conventions": {                      // Phase 1
    "branchingModel": "github-flow",
    "commits": "conventional",
    "prohibited": []
  },

  "boundaries": {                       // pre-v1.0 — testing-rules + debugging-rules skills enforce
    "realtime": [], "video": [], "api": [], "db": [],
    "auth": [], "telemetry": [], "payments": []
  },

  "motion": {                           // pre-v1.0 — motion-rules skill enforces
    "micro": 300, "page": 500, "complex": 1000,
    "customPulses": {}
  },

  "responsive": {                       // pre-v1.0 — responsive-rules skill enforces
    "approach": "mobile-first",
    "densityMap": { "web-desktop": "cozy" },
    "breakpoints": { "sm": 480, "md": 768, "lg": 1024, "xl": 1280, "2xl": 1536 }
  },

  "ux": {
    "responseTargetMs": 100,
    "bilingual": []
  },

  "skills": {                           // pre-v1.0
    "motionRules": { "enabled": true },
    "responsiveRules": { "enabled": true },
    "a11yRules": { "enabled": true },
    "testingRules": { "enabled": true },
    "debuggingRules": { "enabled": true }
  },

  "integrations": {
    "tracker":   { "provider": "github" },          // pre-v1.0
    "analytics": { "provider": "none" },            // pre-v1.0
    "ci":        { "provider": "github-actions" }, // pre-v1.0
    "design":    { "provider": "md-claude" },       // pre-v1.0
    "changelog": {                                  // Phase 3 — `/flow:release-changelog` + `/flow:release` gate
      "provider": "changesets",                     // changesets | git-cliff | conventional | custom | none
      "scope": "@1agh/md-claude",
      "releaseGuide": ".ai/release-guide.md"
    }
  }
}
```

**Read/write:** `mdcc config show | get <dotted.key> | set <key> <value>`.

---

## File 2 — `.design/config.json` (design plugin)

**Authoritative schema:** [`plugins/design/dev-server/config.schema.json`](../../plugins/design/dev-server/config.schema.json).

**Full structure** (annotated post-v1.0):

```jsonc
{
  "$schema": "https://raw.githubusercontent.com/1aGh/md-claude/main/plugins/design/dev-server/config.schema.json",
  "name": "my-project",                 // pre-v1.0
  "projectLabel": null,                 // pre-v1.0; optional override of name in chrome
  "designRoot": ".design",              // pre-v1.0
  "canvasGroups": [                     // pre-v1.0; browser left-nav
    { "label": "Design system", "path": "system" },
    { "label": "Canvases",      "path": "ui" }
  ],
  "rootClass": "app",                   // pre-v1.0; CSS root class injected
  "themeDefault": "dark",               // pre-v1.0; "dark" | "light" | "agnostic"
  "teamAccentDefault": null,            // pre-v1.0; brand accent override
  "handoffTargets": [],                 // pre-v1.0; e.g. ["apps/web", "apps/mobile"]
  "newCanvasDir": "ui",                 // pre-v1.0; `/design:new` default location
  "newComponentDir": "ui/components",   // pre-v1.0

  // ──────── Phase 4 (canvas v2 rendering engine) ──────── //
  "layout": {                           // viewport defaults; per-canvas .layout.json overrides
    "defaultZoom": 1.0,
    "snapToGrid": false,
    "gridSize": 8
  },

  // ──────── Phase 5 (multi-DS + draw tools) ──────── //
  "designSystems": [                    // multi-DS list; pre-v1.0 single-DS layout auto-migrates
    { "name": "main",      "path": "system/main",      "description": "Default DS" },
    { "name": "marketing", "path": "system/marketing", "description": "Marketing site" }
  ],
  "defaultDesignSystem": "main",        // referenced when /design:new has no --ds flag

  // ──────── Phase 8 (LAN collab — v1.0) ──────── //
  "collab": {
    "enabled": true,                    // master switch; false → solo only, no Yjs runtime
    "autoBind": "loopback",             // "loopback" | "lan" | "off"; gates --bind 0.0.0.0
    "snapshotIntervalMs": 800,          // Y.Doc → JSON snapshot debounce
    "stashOnBranchSwitch": true,        // v1.1: stash unsaved Y ops before git checkout

    // ──────── Phase 9 (hub federation — v1.1) ──────── //
    "commitStrategy": "full"            // "full" | "hub-only" | "manual"; controls gitignore generation
  },
  "linkedHub": {                        // Phase 9; absent in solo / LAN mode
    "url": "https://md-claude-hub-foo.fly.dev",
    "projectId": "my-project"
  },

  // ──────── Phase 10 (structured CRDT — v1.2, conditional) ──────── //
  "elementIdentity": {
    "strategy": "data-cd-id",           // only meaningful if Phase 10 ships
    "idLength": 8
  }
}
```

**Read/write:** server reads on boot + on file save (debounced). User edits via plain editor (no `mdcc` setter today — could add `mdcc design config <show|get|set>` in v1.1 if frequent).

---

## File 3 — per-canvas `<canvas>.meta.json`

**Authoritative schema:** [`plugins/design/dev-server/canvas-meta.schema.json`](../../plugins/design/dev-server/canvas-meta.schema.json).

One file per canvas: `.design/<group>/<slug>.meta.json` colocated with `<slug>.html`. All fields optional but recommended.

```jsonc
{
  "name": "Home screen",                // human-readable
  "tags": ["dark-mode", "landing"],     // Phase 11 — flow uses for /flow:plan canvas detection
  "status": "ready-for-handoff",        // Phase 11 — enum: "draft" | "in-review" | "ready-for-handoff" | "handed-off"
  "handoffCommit": "abc123def",         // Phase 11 — set when /flow:done sweeps handoff; commit SHA

  "designSystem": "marketing",          // Phase 5 — references designSystems[].name from .design/config.json

  "opt_out_scope": ["motion"],          // pre-v1.0 — overrides which critic agents run on /design:critic

  "presentation": {                     // Phase 6
    "order": 3,                         // 1-indexed position in slideshow
    "transition": "fade"
  },

  "lastModifiedBy": "alice@studio",     // optional metadata
  "createdAt": "2026-04-12T10:00:00Z"
}
```

Per-canvas sidecars in the same directory (not part of `.meta.json` but logically related):

| File | Producer | Phase | Git |
|------|----------|-------|-----|
| `<slug>.html` | `/design`, `/design:new`, manual edit | pre-v1.0 | committed |
| `<slug>.layout.json` | Phase 4 viewport persistence | Phase 4 | committed |
| `<slug>.annotations.svg` | Phase 5 draw tools | Phase 5 | committed |
| `<slug>.meta.json` | `/design:new`, manual edit, `/flow:done` updates handoff | pre-v1.0 + Phases 5/11 | committed |

---

## Runtime files (gitignored)

These live alongside canvases but are runtime state, never committed:

| File / dir | Producer | Phase | Purpose |
|------------|----------|-------|---------|
| `.design/_server.json` | dev server boot | pre-v1.0 | `{ pid, port, url, started }` for orchestrator |
| `.design/_active.json` | inspector WS | pre-v1.0 | `{ active, open_tabs, selected, last_change }` — current selection |
| `.design/_server.log` | dev server | pre-v1.0 | nohup output |
| `.design/_history/<slug>/` | every `/design` edit | pre-v1.0 | auto-snapshot stack for `/design:rollback` |
| `.design/_state/<slug>.ydoc.bin` | Phase 8/9 Yjs runtime | Phase 8 | binary CRDT log; regenerable from snapshots |
| `.design/_chat/<slug>.jsonl` | Phase 7 ACP (icebox) | Phase 7 | per-canvas transcript |

`.gitignore` block (managed by `mdcc init` / `mdcc design sync-gitignore`, framed with `# md-claude:begin` / `# md-claude:end` markers):

```gitignore
# md-claude:begin
.design/_state/
.design/_server.json
.design/_active.json
.design/_server.log
.design/_history/
.design/_chat/
# md-claude:end
```

User can switch `collab.commitStrategy: "hub-only"` to additionally ignore canvas content (`.design/*.html`, `.layout.json`, `.annotations.svg`, `_comments/*.json`) — opt-in for teams who want hub as the only source of truth. Default is `"full"`.

---

## Schema validation in CI

`scripts/check-version-parity.sh` already runs in CI. Phase 1 Task 6 adds a sibling step in `.github/workflows/quality.yml`:

```yaml
- run: npx ajv-cli validate -s plugins/flow/.claude-plugin/config.schema.json -d .ai/workflows.config.json
- run: npx ajv-cli validate -s plugins/design/dev-server/config.schema.json -d .design/config.json
- run: find .design -name '*.meta.json' -exec npx ajv-cli validate -s plugins/design/dev-server/canvas-meta.schema.json -d {} \;
```

(Optional — depending on whether the host project commits a populated `.design/` to test against.)

---

## Field-introducing phase index

For "which phase adds this field" lookup:

- **pre-v1.0:** name, language, theme, paths.{prd, designSystem, codebaseMap}, platforms, motion, responsive, ux, skills.*, integrations.{tracker, analytics, ci, design}, all `.design/config.json` fields except those marked below
- **Phase 1:** stack.*, conventions.*, `.design/dev-server/package.json` workspace stub
- **Phase 3:** `integrations.changelog.{provider, scope, releaseGuide, mcp, defaults}`
- **Phase 4:** `.design/config.json.layout`, per-canvas `<slug>.layout.json`
- **Phase 5:** `.design/config.json.designSystems[]`, `defaultDesignSystem`, per-canvas `<slug>.annotations.svg`, `.meta.json.designSystem`
- **Phase 6:** `.design/_comments/<slug>.json`, `.meta.json.presentation`
- **Phase 7 [icebox]:** would have added `acp.*` block — deferred
- **Phase 8:** `.design/config.json.collab.{enabled, autoBind, snapshotIntervalMs, stashOnBranchSwitch}`, `.design/_state/`
- **Phase 9:** `.design/config.json.linkedHub.{url, projectId}`, `.design/config.json.collab.commitStrategy`, `~/.config/mdcc/hubs.json`
- **Phase 10 [conditional v1.2]:** `.design/config.json.elementIdentity.*`, `data-cd-id` attributes injected into HTML
- **Phase 11:** `paths.designRoot` in flow config, `.meta.json.{status, handoffCommit}` formalized
- **Phase 12 [end-of-roadmap]:** no new config keys (UI-only); inspector edit endpoint internal

---

## Open questions (intentional gaps)

1. **Should `linkedHub` be committed to git?** Default yes (shared by team). But for forks where each contributor has their own hub, may want `linkedHub` in `.design/config.local.json` instead. Tracked as v1.2+ refinement.
2. **Multi-hub linking** (one project linked to two hubs) — not supported v1.1, would require array `linkedHubs[]`. Out of scope.
3. **Canvas-level `collab.enabled` opt-out** — should an individual canvas be able to opt out of sync (e.g. sensitive WIP)? Not in current schema; tracked as v1.2+ refinement.
