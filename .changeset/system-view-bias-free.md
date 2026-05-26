---
"@1agh/maude": patch
---

fix(dev-server): System view now renders the project's actual design-system tokens

`MDCC-DSN/01` (the System tab in the dev-server browser) was reading from the dev-server shell's own chrome stylesheet via `getComputedStyle(document.documentElement)` with a hardcoded list of canonical token names (`--bg-0..4`, `--fg-0..3`, `--accent*`). For projects whose DS used different naming (imported / hand-written / brand mirrors) the overview showed Maude's amber-rust theme instead of the user's tokens; for projects that used the canonical naming, swatch values still came from the shell, not the DS.

Three fixes:

- **Bias-free rendering** — `TokenLadder` + `TypeLadder` now consume parsed tokens from `/_system-data` and render swatches from raw values, not `var(--name)` against the shell document. Whatever the user's `colors_and_type.css` declared shows up exactly as written.
- **Per-DS `tokensCssRel` auto-resolution** — `designSystems[]` entries without an explicit `tokensCssRel` default to `<entry.path>/colors_and_type.css`. Multi-DS projects (or projects with nested-folder DS layouts) no longer need to spell out the path.
- **DS picker** — when `designSystems.length > 1`, the System view header renders a selector that switches both tokens and previews. Unknown `?ds=<name>` returns 404 instead of silently falling back.

See `.ai/decisions/DDR-048-dev-server-system-view-no-shell-bias.md` for the full rationale and the contract between the shell chrome and the user-facing System view.
