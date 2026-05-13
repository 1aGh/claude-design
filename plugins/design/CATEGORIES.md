# Design plugin — command categories

> Canonical catalog of slash-command groups for the `design` plugin. The live index is rendered by `/design:help` from each command file's `category:` frontmatter field. This file is the **prose explainer** (why each group exists, naming convention, rename history); the frontmatter is the source of truth for the list.

## Why categorization

Claude Code's slash-command UI doesn't support subdirectory namespacing (issue [#2422](https://github.com/anthropics/claude-code/issues/2422), closed not-planned; [#44678](https://github.com/anthropics/claude-code/issues/44678) is the open feature request). The working substitute is a **strict `<group>-<verb>` prefix** — typing `/design:setup-` autocompletes only the `setup-*` members.

Mirrors the flow plugin's pattern (`plugins/flow/CATEGORIES.md`).

## Groups

### daily — Verb-as-complete-action, called every iteration cycle

Default verbs. No prefix. Members:

| Command | Description |
|---|---|
| `/design:edit` | Iterate on the active canvas with auto-critic loop |
| `/design:new` | Scaffold a new multi-artboard canvas project |
| `/design:critic` | Spawn the critic panel (or single agent / all critics) |
| `/design:browse` | Boot the local dev server |
| `/design:rollback` | Undo the last edit (snapshot-based) |
| `/design:screenshot` | Capture a screenshot of the active canvas |
| `/design:handoff` | Migrate the active canvas to a production target |
| `/design:help` | Print this grouped index |

The bare `/design` form is a **one-version compat stub** that redirects to `/design:edit`. It will be removed in the next minor version. Don't cross-reference it in new docs.

### setup — One-shot bootstrapping operations

Members:

| Command | Description |
|---|---|
| `/design:setup-onboard` | Initialize the project environment (deps check, install hints, skeleton `.design/config.json`). Mirrors `/flow:setup-onboard`. |
| `/design:setup-ds` | Create a design system (first one, additional, or re-bootstrap with `--force`). Thin wrapper → skill `design-system` in bootstrap mode. |
| `/design:setup-docs` | Refresh `.design/README.md` + `INDEX.md`. Auto-runs after `/design:edit` and `/design:new`; manual trigger to force a refresh. |

Why three setup verbs:

- **`setup-onboard`** is project-level — runs **once** per repo to prepare the ground (dependency hints, CLAUDE.md / .ai/ recommendations, skeleton config). Auto-invoked when other commands hit a missing `.design/config.json`.
- **`setup-ds`** is per-DS — runs **once per design system** (first one for a project, or every time you add a marketing-vs-admin-vs-mobile DS). Auto-invokes `setup-onboard` first if config is missing.
- **`setup-docs`** is per-canvas-event — auto-runs after every `/design:edit` and `/design:new`. Manual trigger when you want to force a regeneration.

## Naming convention

Commands within a group prefix the group name with a dash separator:

```
/design:setup-onboard          ← group "setup", verb "onboard"
/design:setup-ds               ← group "setup", verb "ds"
/design:setup-docs             ← group "setup", verb "docs"
```

Daily commands have no prefix:

```
/design:edit                   ← daily
/design:new                    ← daily
```

This makes autocomplete predictable — typing `/design:setup-` shows only the three setup verbs.

## Rename history

| Old | New | When | Why |
|---|---|---|---|
| `/design` | `/design:edit` | v0.8 (this plan) | Verb-as-action; resolves naming collision with skill `design` |
| `/design:docs` | `/design:setup-docs` | v0.8 (this plan) | Categorization to `setup-*` group |

The bare `/design` form is preserved as a compat stub for one minor version, then removed.

## Adding a new command

1. Pick the group from the table above. If none fits, propose a new group in this file (with prose justification) before adding the file.
2. Create `plugins/design/commands/<group>-<verb>.md` (or `<verb>.md` for `daily`).
3. Set frontmatter: `name: <verb-or-group-verb>`, `category: <group>`, `description: <one-liner>`, `argument-hint: <if any>`.
4. `/design:help` picks it up automatically — no manual catalog update needed.
5. Add an entry to the relevant section of this file if the group prose needs explanation.
