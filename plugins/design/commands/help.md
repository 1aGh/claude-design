---
name: design:help
category: daily
description: List all design commands grouped by category.
---

# /design:help — grouped command index

Print every `/design:*` command grouped by its `category:` frontmatter field. Use this whenever you forget a name — type `/design:help` for the live index, or use the group prefix (e.g. `/design:setup-`) to narrow autocomplete.

## Process

### 1. Read the catalog

Walk `plugins/design/commands/*.md`. For each file, parse its YAML frontmatter and collect `name`, `category`, and `description`.

- The `name:` field is the fully-qualified slash name (e.g. `design:edit`), so render it directly with a leading `/`.
- If a file has no `category`, list it under `(uncategorized)` at the bottom so the gap is visible.

### 2. Group + order

Group commands by `category`. Print groups in this fixed order (matches `plugins/design/CATEGORIES.md`):

1. **daily** — Verb-as-complete-action, called every iteration cycle.
2. **setup** — One-shot bootstrapping operations (onboard the project, create a design system, refresh docs).

Within each group, sort alphabetically.

### 3. Render

For each group, print:

```
## <group> — <one-line description>

| Command            | Description                                    |
| ------------------ | ---------------------------------------------- |
| /<name>            | <description>                                  |
```

### 4. Pointer

Close with:

```
For group definitions and the canonical catalog, see `plugins/design/CATEGORIES.md`.
```

## Notes

- This command is **read-only**. It never edits files — it just scans frontmatter and renders the table.
- Source of truth for the command list is the **frontmatter on disk** (no drift). `CATEGORIES.md` supplies group ordering + group prose.
- If a new command is added without `category:`, `/design:help` will surface it under `(uncategorized)` — that's the signal to fill in the field.
- The bare `/design` compat stub (v0.8) was removed in v0.9 — only `/design:edit` resolves now.

### Canvas keyboard shortcuts (in the dev-server iframe)

Cheat-sheet for the in-canvas chrome — independent of slash commands. Always print this block alongside the command table when rendering `/design:help`.

| Key                          | Action                                              |
| ---------------------------- | --------------------------------------------------- |
| `V`                          | Move tool (select / drag artboard)                  |
| `H`                          | Hand tool (drag to pan, no Space needed)            |
| `C`                          | Comment tool (click an element to drop a pin)       |
| `B` / `R` / `O` / `A`        | Pen / Rectangle / Ellipse / Arrow annotation tools  |
| `E`                          | Eraser (annotations)                                |
| `Esc`                        | Cancel current gesture, clear selection, back to V  |
| `Cmd+Z` / `Ctrl+Z`           | **Undo** the last canvas edit (Phase 20, DDR-049)   |
| `Cmd+Shift+Z` / `Ctrl+Y` / `Cmd+Y` | **Redo** the last undone edit                 |
| `Cmd+0`                      | Fit canvas to screen                                |
| `Cmd+1`                      | Actual size (100 %)                                 |
| `Cmd` + `+` / `Cmd` + `−`    | Zoom in / out                                       |
| `Shift+P`                    | Toggle annotation visibility (presentation)         |

Undo / redo cover drag, marquee batch-move, equal-spacing distribute, align, annotation strokes (add / erase / translate / text). Viewport + selection are intentionally NOT undoable (Figma convention). Stack is per-canvas-iframe, ring-capped at 50, cleared on external `.meta.json` edit. Comments are not undoable in v0.
