---
"@1agh/md-claude": minor
---

**Plugins: namespace `name:` frontmatter + rename `setup-onboard` → `init`.**

- Every plugin command, skill, and agent now declares `name: <plugin>:<slug>` in its frontmatter (e.g. `flow:resume`, `design:edit`). Without the explicit prefix, Claude Code registers the bare slug — which collides with built-ins like `/resume` and loses the namespaced row in autocomplete. See [Claude Code issue #22063](https://github.com/anthropics/claude-code/issues/22063) and [DDR-006](./.ai/decisions/DDR-006-plugin-namespace-in-name-frontmatter.md).
- `/flow:setup-onboard` → `/flow:init` and `/design:setup-onboard` → `/design:init`. Bare-verb `init` is the lone exception to the `<group>-<verb>` filename rule, mirroring Claude Code's built-in `/init`. The namespace prefix (`flow:` / `design:`) keeps them unambiguous against the built-in.
- `/flow:help` and `/design:help` render templates updated to `/<name>` (the prefix is already in `name:`) to avoid double-prefix output.
- Both `CATEGORIES.md` files updated with new naming convention, the `init` carve-out, and rename-history rows.

**Downstream impact:** Users invoking the old slash names need to switch — `/flow:setup-onboard` → `/flow:init`, `/design:setup-onboard` → `/design:init`. No backwards-compat stubs; the slash names disappear cleanly because both plugins ship as a single version-pinned bundle.
