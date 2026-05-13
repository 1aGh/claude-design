---
name: help
category: daily
description: List all design commands grouped by category.
---

# /design:help — grouped command index

Print every `/design:*` command grouped by its `category:` frontmatter field. Use this whenever you forget a name — type `/design:help` for the live index, or use the group prefix (e.g. `/design:setup-`) to narrow autocomplete.

## Process

### 1. Read the catalog

Walk `plugins/design/commands/*.md`. For each file, parse its YAML frontmatter and collect `name`, `category`, and `description`.

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
| /design:<name>     | <description>                                  |
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
- The bare `/design` form is a one-version compat stub that redirects to `/design:edit`. It will be removed in the next minor version; cross-reference future docs with `/design:edit` only.
