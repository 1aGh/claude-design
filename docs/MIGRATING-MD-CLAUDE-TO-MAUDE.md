# Migrating from `md-claude` to Maude

This project was renamed from `md-claude` to **Maude** in v0.15.0. The codebase, npm package, GitHub repo, and Claude Code marketplace all moved together.

## What changed

| Surface | Old | New |
| --- | --- | --- |
| npm package | `@1agh/md-claude` | `@1agh/maude` |
| Per-platform sub-packages | `@1agh/md-claude-<slug>` (×7) | `@1agh/maude-<slug>` (×7) |
| GitHub repo | `1aGh/md-claude` | `1aGh/maude` (auto-redirected) |
| Claude Code marketplace | `1aGh/md-claude` | `1aGh/maude` |
| Plugin install syntax | `design@md-claude`, `flow@md-claude` | `design@maude`, `flow@maude` |
| CLI primary bin | `mdcc` | `maude` |
| CLI legacy bin | — | `mdcc` (prints deprecation warning; removed in v0.17.x) |
| Safe-mode bin | `mdcc-safe` | `maude-safe` (`mdcc-safe` still exported) |
| Postinstall skip env var | `MD_CLAUDE_SKIP_POSTINSTALL` | `MAUDE_SKIP_POSTINSTALL` (old name accepted one cycle) |
| Docs canonical host | `md-claude.dev` (planned) | `maude.sh` |

## How to migrate

### 1. Reinstall the CLI

```sh
npm uninstall -g @1agh/md-claude
npm install -g @1agh/maude
```

The old `@1agh/md-claude` was unpublished from npm (within the 72-hour grace window) and **cannot be republished** — npm policy permanently locks the name after unpublish. Pinning `@1agh/md-claude` in a setup script will now return 404.

### 2. Update Claude Code marketplace

Inside Claude Code:

```
/plugin marketplace remove md-claude
/plugin marketplace add 1aGh/maude
/plugin install design@maude
/plugin install flow@maude
/reload-plugins
```

The GitHub repo redirect (`1aGh/md-claude` → `1aGh/maude`) covers raw URL fetches, but the marketplace `name:` field changed from `md-claude` to `maude`, so the entry in your Claude Code config needs to be re-added by hand.

### 3. Update `package.json` references

If your project pins `@1agh/md-claude`:

```diff
 {
   "dependencies": {
-    "@1agh/md-claude": "^0.14.0"
+    "@1agh/maude": "^0.15.0"
   }
 }
```

If you set `MD_CLAUDE_SKIP_POSTINSTALL=1` in CI or shell config, switch to `MAUDE_SKIP_POSTINSTALL=1`. The old name still works for one release cycle.

### 4. `mdcc` muscle memory

The `mdcc` CLI binary still works — it's a thin shim that prints a one-line deprecation warning on stderr and forwards every argument to `maude`. Use the time before v0.17.x to update aliases, scripts, and docs at your pace:

```sh
maude init                    # was: mdcc init
maude config set platforms '["web-desktop"]'
maude design serve --port 4399
```

### 5. Existing `.ai/workflows.config.json` scaffolds

The `$schema` URL in scaffolds generated before the rename still resolves: GitHub serves a 301 redirect from `raw.githubusercontent.com/1aGh/md-claude/...` to `raw.githubusercontent.com/1aGh/maude/...` indefinitely (as long as no new `md-claude` repo is created on the `1aGh` account). New `maude init` runs emit the new URL.

## What did **not** change (deliberately)

These look like leftover `md-claude`/`mdcc` references but are **intentionally preserved** as internal namespaces. They are implementation details, not brand surfaces, and renaming them would churn unrelated code without benefit:

- **CSS class names** `.mdcc-*` and CSS custom properties `--mdcc-*` throughout the docs site.
- **`site/components/mdcc/`** component path and `site/app/mdcc-tokens.css`.
- **`~/.config/mdcc/`** XDG config directory (used by the planned self-hosted hub).

See [DDR-032](.ai/decisions/DDR-032-rename-md-claude-to-maude.md) for the full rationale.

### Migrating canvas imports

If you have TSX canvases under your `.design/` directory that import from `@mdcc/canvas-lib`, update them to `@maude/canvas-lib`:

```diff
-import { DesignCanvas, DCSection, DCArtboard } from "@mdcc/canvas-lib";
+import { DesignCanvas, DCSection, DCArtboard } from "@maude/canvas-lib";
```

The dev-server's virtual-module resolver no longer matches the old specifier — Bun.build will fail to resolve it.

## Why the rename?

Two reasons: (1) **branding** — `Maude` is a single short word that works as a project name, an npm scope, and a CLI binary; (2) **clarity** — the project previously carried three parallel names (`md-claude` / `mdcc` / `claude-design-server`) which confused new users and bloated docs.

## Reporting issues with the migration

Open an issue at <https://github.com/1aGh/maude/issues> with the `migration` label. Include the surface that broke (CLI bin, marketplace, scaffolded file, etc.) and the exact error message.
