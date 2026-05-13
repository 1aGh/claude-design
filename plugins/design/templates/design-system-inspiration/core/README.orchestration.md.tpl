# {{project_label}} — Design root

> **CODING AGENTS: READ THIS FIRST.**
>
> This folder is the project's living design source. It's NOT a snapshot — it's continuously maintained as the team iterates on UI in this repo. When in doubt, trust the contents of this folder over any older PDF / Figma / mockup snapshot.

## What's here

```
.design/
├── README.md                # this file (auto-maintained by /design:setup-docs)
├── INDEX.md                 # canvas catalog (auto-maintained)
├── config.json              # per-repo plugin config
├── system/                  # design system: tokens, assets, ui kits, README
│   └── {{ds_dirname}}/
│       ├── README.md
│       ├── SKILL.md
│       ├── colors_and_type.css    # ← authoritative tokens
│       ├── assets/                # logos, brand glyphs
│       ├── preview/               # browsable specimens (colors, type, components, motion)
│       └── ui_kits/               # reference UI compositions
└── ui/                      # canvas projects (multi-artboard DesignCanvas files)
    ├── <Canvas-1>.html
    ├── <Canvas-1>.meta.json
    ├── <Canvas-2>.html
    └── ...
```

## What you should do — IMPORTANT

**Read `INDEX.md` first.** It lists every canvas with title, brief, sections, artboards, and which production routes they map to. Pick the canvas matching the work scope.

**Read its iteration transcript next.** Each canvas with iteration history has a chat at `_history/<slug>/chat.md`. The chat shows the back-and-forth between the user and the design assistant — it tells you **what the user actually wants** and **where they landed**. The HTML file is the output, but the chat is where the intent lives.

**Find the canvas's primary HTML and read it top to bottom.** Each canvas project is a multi-artboard `DesignCanvas` HTML file. Then **follow its imports**: open every component file under `ui/components/`, the tokens at `system/{{ds_dirname}}/colors_and_type.css`, and the canvas's `.meta.json` sidecar.

**If anything is ambiguous, ask the user to confirm before you start implementing.** It's much cheaper to clarify scope up front than to build the wrong thing.

## About the design files

The design medium is **HTML/CSS/JS** — these are prototypes, not production code. Your job is to **recreate them pixel-perfectly** in whatever technology the production codebase uses (React, Vue, native, whatever fits). Match the visual output; don't copy the prototype's internal structure unless it happens to fit.

Each canvas is a **multi-artboard `DesignCanvas`** with one or more `DCSection` blocks containing `DCArtboard` instances. Each artboard is a separate screen — you implement them as separate routes / components in production.

## Hard rules (from {{project_label}}'s design system)

{{hard_rules_from_system_readme}}

## How tokens work

The authoritative token file is `system/{{ds_dirname}}/colors_and_type.css`. Every canvas links to it. Production code should consume the same tokens (compiled to TS/JS or kept as CSS vars). **Never invent tokens — extend the source CSS instead.**

## Plugin commands quick reference

| Command | Purpose |
|---|---|
| `/design:edit "<feedback>"` | Edit active canvas in place (auto-critic loop runs after) |
| `/design:edit "<…>" --perfect` | Same, with up to 8 polish iterations |
| `/design:new "<Name>" "<brief>"` | Scaffold a new canvas project |
| `/design:critic` | Run review panel (orchestrator-routed) |
| `/design:rollback` | Undo last edit |
| `/design:screenshot` | Capture canvas / selected element |
| `/design:setup-docs` | Refresh this README + INDEX (auto-runs after `/design:edit` and `/design:new`) |
| `/design:setup-ds <name>` | Create another design system |
| `/design:handoff` | Migrate active canvas to a handoff target |
| `/design:browse` | Boot the local dev server |
| `/design:help` | Grouped command index |

## Last updated

{{iso_timestamp}}
