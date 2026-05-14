# .design/ — read this first

You're looking at the design root of **md-claude** (this repo). Everything visual that the marketplace + dev-server surface up lives under here.

## Layout

```
.design/
├── README.md                  ← you are here
├── INDEX.md                   ← per-canvas index (auto-updated by /design:setup-docs)
├── config.json                ← per-repo plugin config (designSystems[], canvasGroups, …)
├── _server.json               ← live dev-server state (pid, port, url) — runtime only
├── _active.json               ← live active-tab + selected-element state — runtime only
├── _history/                  ← snapshot stack per canvas + research payloads
│   └── _system/               ← bootstrap roster, completeness reports, research cache
│
├── system/                    ← design systems (one or more)
│   └── project/               ← THE design system for md-claude (MDCC-DSN/01)
│       ├── README.md          ← philosophy + voice + hard rules (READ BEFORE EDITING)
│       ├── SKILL.md           ← terse per-DS rules (loaded by every iterator agent)
│       ├── colors_and_type.css ← tokens (authoritative — never invent colors)
│       ├── preview/
│       │   ├── _layout.css    ← shared specimen chrome (the SKU + hairline signature)
│       │   ├── _components.css ← shared component anatomy (.btn, .tile, .sku, …)
│       │   ├── colors-*.html  ← color / surface / accent specimens
│       │   ├── type-scale.html · spacing-scale.html · motion.html
│       │   ├── foundations: borders, elevation, focus, grid, iconography, opacity, radii, selection
│       │   ├── components: buttons, cards, inputs, toggles, dialogs, tooltips, tables, callout
│       │   ├── universal: empty-state, logo
│       │   ├── status: colors-status, components-status, skeletons
│       │   ├── audience-developer: type-mono, code-block, diff-view, log-stream,
│       │   │                       monospace-table, terminal-pane
│       │   ├── platform-desktop: components-resize-panels, ui_kits-desktop-{showcase,index}
│       │   └── theme-both: colors-themes-side-by-side
│       └── assets/
│           ├── logos/wordmark.svg   ← THE md-claude wordmark
│           └── glyphs/*.svg         ← domain-noun glyphs (plugin, canvas, slash-command, file-tree)
│
└── ui/                        ← (empty for now) — full product canvases when /design:new fires
```

The `system/project/` directory is the design system; everything inside `ui/` will be canvases that *consume* it.

## Working with this directory

```
/design:edit "<feedback>"           — iterate on the active canvas (auto-runs critic panel)
/design:new "<Name>" "<brief>"      — scaffold a new full canvas under ui/
/design:browse                      — open the dev-server tab (file tree + iframe preview)
/design:critic                      — run the full critic panel on the active canvas
/design:critic --system-only        — audit the design system itself (structural completeness)
/design:rollback                    — undo the last /design:edit
/design:handoff                     — migrate the active canvas into production code
/design:help                        — grouped command index
```

For dev-server-only operations: `mdcc design serve` (boots the canvas browser at a free port — defaults `4399`).

## What lives where (vs. what NOT to look for)

- **Tokens** (color / type / spacing / radii / motion) → `system/project/colors_and_type.css`. **Never** invent values outside this file.
- **Signature treatment** (SKU framing, 1px rules) → `system/project/preview/_layout.css`. Specimens import this; don't re-implement chrome inline.
- **Component anatomy** (`.btn`, `.tile`, `.sku`, etc.) → `system/project/preview/_components.css`.
- **Voice + hard rules** → `system/project/README.md`. The voice is htmx-grain over a U.S. Graphics-grade typographic spine.
- **Research provenance** → `_history/_system/project-df4b0d27-domain-research-discovery.json` (read before iterating on color / typography / voice).
- **Roster contract** → `_history/_system/project-000-scaffold-roster.yaml` (what got scaffolded, in which batch, with what dependencies).

This is a **single-DS** project — there's just `system/project/`. If a second DS becomes useful (e.g. a separate `marketing` DS later), bootstrap it with `/design:setup-ds marketing "<brief>"` and it'll land alongside, not on top.

## Provenance

- Bootstrapped 2026-05-14 from `md-claude` plugin v0.12.0 via `/design:setup-ds project "<brief>"`
- Discovery: 12 questions across 3 rounds, anchored to a Round 0 research payload (11 WebSearch queries, no fallback)
- Active design systems: `project` (MDCC-DSN/01) — the only one
- Active families: `accent`, `status`, `mono`

Next move if you're hands-on: `/design:critic --system-only` to see how the freshly-scaffolded DS scores against structural + aesthetic critics, then `mdcc design serve` to browse it visually.
