# md-claude — Design root

> **CODING AGENTS: READ THIS FIRST.**
>
> This folder is the project's living design source. It's NOT a snapshot — it's continuously maintained as the team iterates on UI in this repo. When in doubt, trust the contents of this folder over any older PDF / Figma / mockup snapshot.

## What's here

```
.design/
├── README.md                # this file (auto-maintained by /design:setup-docs)
├── INDEX.md                 # canvas catalog (auto-maintained)
├── config.json              # per-repo plugin config
├── system/                  # design system: tokens, assets, README
│   └── studio/
│       ├── README.md
│       ├── SKILL.md
│       ├── colors_and_type.css     # ← authoritative tokens
│       ├── assets/
│       │   ├── logos/              # wordmark.svg, mark.svg
│       │   └── glyphs/             # canvas / terminal / inspector
│       └── preview/                # browsable specimens (flat — no subdirs)
│           ├── ui_kits-desktop-showcase.html   # ← the canonical "DS in use" composition
│           ├── ui_kits-desktop-index.html      # ← catalog of every specimen
│           ├── colors-*.html · type-*.html · components-*.html
│           ├── radii.html · elevation.html · focus.html · iconography.html
│           └── motion.html · spacing-scale.html · skeletons.html · logo.html · empty-state.html
└── ui/                      # canvas projects (multi-artboard DesignCanvas files)
    ├── <Canvas-1>.html
    ├── <Canvas-1>.meta.json
    └── ...
```

## What you should do — IMPORTANT

**Read `INDEX.md` first.** It lists every canvas with title, brief, sections, artboards, and which production routes they map to. Pick the canvas matching the work scope.

**Read its iteration transcript next.** Each canvas with iteration history has a chat at `_history/<slug>/chat.md`. The chat shows the back-and-forth between the user and the design assistant — it tells you **what the user actually wants** and **where they landed**. The HTML file is the output, but the chat is where the intent lives.

**Find the canvas's primary HTML and read it top to bottom.** Each canvas project is a multi-artboard `DesignCanvas` HTML file. Then **follow its imports**: open every component file under `ui/components/`, the tokens at `system/studio/colors_and_type.css`, and the canvas's `.meta.json` sidecar.

**For the canonical "DS in use" mock, open `system/studio/preview/ui_kits-desktop-showcase.html`.** It's the file that explains the visual language faster than the README ever could — top nav, sidebar, three switchable screens, status bar, accent picker. If you only open one specimen, open that one.

**If anything is ambiguous, ask the user to confirm before you start implementing.** It's much cheaper to clarify scope up front than to build the wrong thing.

## About the design files

The design medium is **HTML/CSS/JS** — these are prototypes, not production code. Your job is to **recreate them pixel-perfectly** in whatever technology the production codebase uses (React, Vue, native, whatever fits). Match the visual output; don't copy the prototype's internal structure unless it happens to fit.

For md-claude specifically, the most useful handoff target is the **dev-server itself**: the file tree, tabbed canvas iframe, and inspector overlay live at `plugins/design/dev-server/server.mjs` (inlined HTML / CSS). The showcase composition under `system/studio/preview/ui_kits-desktop-showcase.html` is what that dev-server should grow into.

## Hard rules (from studio's design system)

- **Two-tier accent.** `--accent` (plasma) lives in components — buttons, links, focus rings, sidebar-active, status text. `--brand-amber` lives in marketing surfaces only — docs hero, signature-moment art, the mark inset. Never mix.
- **All visuals reference `var(--*)` tokens.** No hardcoded hex / px / rem.
- **Mono is a display surface.** Geist Mono in status bars, file paths, version labels, port numbers, hero metadata. Not body text styled mono.
- **WCAG 2.1 AA contrast at every visible surface.** Focus-visible always rendered (`--ring`). `prefers-reduced-motion: reduce` collapses every duration to 1ms.
- **Voice: warm hacker.** Direct, opinionated, occasionally dry. Empty states name what's missing. Marketing copy can have personality; dev-server copy is terse.
- **Desktop only.** ≥ 1280px viewport. No mobile / tablet specimens in this scaffold.

## How tokens work

The authoritative token file is `system/studio/colors_and_type.css`. Every canvas links to it. Production code (the dev-server's inlined CSS, the docs site) should consume the same tokens. **Never invent tokens — extend the source CSS instead.**

## Plugin commands quick reference

| Command | Purpose |
|---|---|
| `/design:edit "<feedback>"` | Edit active canvas in place (auto-critic loop runs after) |
| `/design:edit "<…>" --perfect` | Same, with up to 8 polish iterations |
| `/design:new "<Name>" "<brief>"` | Scaffold a new canvas project |
| `/design:critic` | Run review panel (orchestrator-routed) |
| `/design:critic --system-only` | Audit studio's structural completeness |
| `/design:rollback` | Undo last edit |
| `/design:screenshot` | Capture canvas / selected element |
| `/design:setup-docs` | Refresh this README + INDEX (auto-runs after `/design:edit` and `/design:new`) |
| `/design:setup-ds <name>` | Create another design system alongside studio |
| `/design:handoff` | Migrate active canvas to a handoff target |
| `/design:browse` | Boot the local dev server |
| `/design:help` | Grouped command index |

## Last updated

2026-05-13 — initial bootstrap of `studio` (28 specimens scaffolded; 32 with foundations completed in v0.2)
