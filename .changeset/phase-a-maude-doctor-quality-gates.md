---
"@1agh/maude": minor
---

`maude doctor` — one umbrella diagnostic for workspace health, plus declarative quality gates.

- **`maude doctor`** reports missing dependencies (per-plugin, from `plugins/<plugin>/dependencies.json`), `.ai/workflows.config.json` schema errors, stack drift, and missing quality-gate declarations in one report. `--fix` applies safe auto-fixes (per-dep install prompt; config edits are additive and never overwrite an existing user value); `--json` for programmatic consumers; `--plugin` scopes the deps section.
- **Declarative quality gates.** New optional top-level `quality` map in `workflows.config.json` (`gate → shell-command` string). Flow commands read it directly via `jq` + `eval` — `/flow:utils-verify` + `/flow:quick` run `format`+`lint`; `/flow:validate` runs `format → lint → typecheck → tests → build` then any custom gates; the release pre-flight runs all. No `maude quality run` wrapper — `pnpm <script>` is already the runner. Gate set is per-project and user-owned; the `ai-skeleton` template ships no `quality` block (populate via `maude doctor --fix`).
- **Manifest-sourced preflight.** `/design:init` + `/flow:init` now source their dependency table from `dependencies.json` (no hardcoded `command -v` chain), with a `_preflight.json` 5-minute cross-command cache and a SessionStart hook that warns (deps only) when a hard dependency is missing. `/flow:init` re-runs are now drift-aware (per-key keep/apply/skip; never clobbers tuned `prohibited`/`boundaries`/`motion`).

See [DDR-057](.ai/decisions/DDR-057-maude-doctor-deps-config-quality.md) for the unified-diagnostic + no-wrapper-over-pnpm rationale and the `eval`-of-config trust boundary.
