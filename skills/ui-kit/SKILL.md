---
name: ui-kit
description: Reference UI prototypes and shared components for the project's surfaces (desktop / mobile / tablet). Auto-load when designing or implementing any UI for this repo. Content lives in the project's design root (default `.design/ui/`) — this skill is a pointer.
---

# UI kit — pointer skill

This skill is a **thin pointer**. The actual UI-kit content lives under the project's design root, defined in `<repo>/.design/config.json`:

```
<designRoot>/ui/
  ├── project/
  │   ├── <ProjectName> Studio.html      # multi-artboard desktop canvas (composer)
  │   ├── <ProjectName> Mobile.html      # multi-artboard mobile canvas (composer)
  │   ├── <Other Canvas>.html            # additional canvas projects
  │   ├── components/*.jsx               # shared desktop components
  │   └── components/mobile/*.jsx        # shared mobile components
  ├── chats/                             # iteration transcripts per surface (if migrated from Claude Design)
  └── README.md                          # canvas catalog
```

The canvas runtime itself (`DesignCanvas`, `DCSection`, `DCArtboard`, `DCPostIt`, `TweaksPanel`, `useTweaks`) is **NOT** copied per-project — it lives in `.claude/plugins/design/dev-server/runtime/` and is auto-injected by the dev server into every served HTML. Canvases reference these as window globals after babel compiles them. New canvases must not bundle a local copy.

This skill is non-user-invocable. Auto-loads when Claude is doing UI work. The user-facing entry point is the `design` orchestrator skill.

## Canon: canvas-first, multi-artboard

Every project canvas under `<designRoot>/ui/project/` follows the same shape:

1. **`DesignCanvas`** wrapper — Figma-style infinite canvas (panable / zoomable).
2. **`DCSection`** blocks — labeled groups of related screens.
3. **`DCArtboard`** instances — individual screens, each wrapped in the project's app shell where applicable.

Standalone single-page HTML wrappers (one screen, no canvas) are an anti-pattern and should be migrated when found. New screens always go into an existing canvas as a new `DCArtboard`, or a new canvas project file via `/design:new`.

## How the orchestrator uses this skill

When `design` is asked to start work on a known surface:

1. Lists canvas files in `<designRoot>/ui/project/` and matches by name.
2. Resolves component file (e.g. `<designRoot>/ui/project/components/<Surface>.jsx`) if the canvas references one.
3. Reads any matching iteration transcript in `<designRoot>/ui/chats/` — that's the source of truth for what the user actually wanted.
4. Loads tokens from `<designRoot>/<tokensCssRel>`.
5. Hands the union as the aesthetic + layout brief to `frontend-design` (for new canvases) or applies inline edits (for `/design "<feedback>"`).

For unknown surfaces, the orchestrator skips component-mapping but still loads tokens + finds one similar reference canvas to learn the project's idioms.

## What you must never do

- **Never bypass the canvas pattern.** New screens go inside `DesignCanvas` artboards, not as new top-level HTML pages.
- **Never edit the migrated `chats/` transcripts** — they're historical record.
- **Never assume desktop and mobile share components** — each platform has its own subdir under `components/`.

## Cross-links

- Canvas catalog: `<designRoot>/ui/README.md` (if present)
- Per-repo config: `.design/config.json`
- Sibling skill: `design-system` (tokens, type, color)
- Sibling skill: `design` (orchestrator)
