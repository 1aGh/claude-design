---
name: init
category: setup
description: One-time project-level environment init for the design plugin. Detects missing dependencies (node ≥ 20, git, agent-browser, maude), prints install hints for soft deps, offers to run /init for CLAUDE.md and /flow:init for .ai/, and writes a skeleton .design/config.json. Does NOT create a design system — use /design:setup-ds <name> for that. Mirrors /flow:init.
argument-hint: "[--skip-prompts]"
---

# /design:init — bootstrap the design plugin's environment

Project-level environment init for the `design` plugin. Mirrors `/flow:init` in shape and purpose: detect what's already in place, print actionable install / next-step hints for what's missing, and write the minimal skeleton config so subsequent commands have something to read.

This command does **not** create a design system. That's `/design:setup-ds <name> "[brief]"`'s job. This one only prepares the ground.

## What it does

1. **Pre-flight** — checks hard + soft dependencies and current `.design/` state.
2. **Skeleton config** — writes `.design/config.json` with `designSystems: []` (empty) if it doesn't exist.
3. **Post-flight prompts** — single multi-select AskUserQuestion listing any soft deps that came up missing; user picks none / some / all; `--skip-prompts` skips this entirely.
4. **Next-step summary** — prints the recommended next command (`/design:setup-ds <name>` or `/design:edit "..."` if the user just wants to dive in).

## Step 1 — Pre-flight

The dependency list (node, git, maude, agent-browser, …) is **not** a hardcoded `command -v` chain — it is sourced from `plugins/design/dependencies.json` via the shared `preflight.sh` helper (Task A14). Editing that manifest (e.g. adding `vhs` as a soft dep) surfaces in the next `/design:init` run with no change to this command.

```bash
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
CACHE="$REPO_ROOT/.design/_preflight.json"
mkdir -p "$REPO_ROOT/.design"

# ── Cross-command short-circuit (Task A15) ────────────────────────────────
# Skip the whole dependency preflight if a sibling command already ran it
# this session: cache must be < 5 min old AND have all hard deps passing.
# node is a hard dep so this probe is always available + portable.
FRESH=$(node -e "try{const c=require('$CACHE');process.stdout.write(String(c.all_hard_pass===true && Date.now()-Date.parse(c.checked)<300000))}catch{process.stdout.write('false')}")

if [[ "$FRESH" == "true" ]]; then
  echo "preflight cached (<5min, all hard deps pass) — skipping dependency check"
  DEPS_OK=1
  DEPS_MISSING="$(node -e "try{process.stdout.write((require('$CACHE').soft_warnings||[]).join(','))}catch{}")"
else
  # Human-readable dep table (✓/✗/⚠ + install hint), then machine vars.
  # --cache writes <designRoot>/_preflight.json for the short-circuit above.
  maude preflight --plugin design --cache "$CACHE"
  eval "$(maude preflight --plugin design --shell-export --cache "$CACHE")"
  # Exposes: $DEPS_OK (1 if all HARD deps pass, else 0), $DEPS_MISSING (csv of missing ids).
fi

# Environment state (NOT dependencies — stays inline)
CLAUDE_MD_OK=false
[[ -f "$REPO_ROOT/CLAUDE.md" || -f "$REPO_ROOT/.claude/CLAUDE.md" ]] && CLAUDE_MD_OK=true

AI_WORKSPACE_OK=false
[[ -f "$REPO_ROOT/.ai/workflows.config.json" ]] && AI_WORKSPACE_OK=true

DESIGN_DIR_OK=false
[[ -d "$REPO_ROOT/.design" ]] && DESIGN_DIR_OK=true

DESIGN_CONFIG_OK=false
[[ -f "$REPO_ROOT/.design/config.json" ]] && DESIGN_CONFIG_OK=true
```

**Hard-stops:** `$DEPS_OK` is `0` when any **hard** dep (node ≥ 20, git) is missing or outdated — abort, surfacing the install hint the preflight table already printed (missing Node → install hint; missing git → `run git init first`). Soft misses (`$DEPS_MISSING`) flow to the Step 3 prompt, never abort.

**Print pre-flight summary block** (table format):

```
Pre-flight summary
──────────────────
  node          ✓ v22.5.1
  git           ✓ initialized
  maude         ✓ v0.7.0                    ← scaffold via CLI available
  agent-browser ✗ missing                   ← needed for screenshot + 5 critics
  CLAUDE.md     ✗ missing                   ← /init recommended
  .ai/          ✗ missing                   ← /flow:init recommended
  .design/      ✗ missing                   ← will create skeleton
  config.json   ✗ missing                   ← will create skeleton

Hard deps satisfied. <N> soft items to address.
```

## Step 2 — Write skeleton `.design/config.json` (if missing)

```jsonc
{
  "$schema": "https://raw.githubusercontent.com/1aGh/maude/main/apps/studio/config.schema.json",
  "name": "<repo-basename-as-fallback>",
  "designRoot": ".design",
  "canvasGroups": [
    { "label": "Design system", "path": "system" },
    { "label": "UI kit", "path": "ui" }
  ],
  "extensions": [],
  "completenessProfile": "standard",
  "activeFamilies": [],
  "designSystems": [],
  "defaultDesignSystem": null
}
```

DS-specific fields (`rootClass`, `tokensCssRel`, `themeDefault`, `teamAccentDefault`, `handoffTargets`, `newCanvasDir`, `newComponentDir`) are **NOT** set here — they get added when `/design:setup-ds <name>` creates the first DS.

Also `mkdir -p .design/` if absent.

If `.design/config.json` already exists, **do not overwrite** — re-run pre-flight summary and continue to Step 3 (re-checking the environment is a valid reason to invoke this command).

## Step 3 — Post-flight multi-select offers

Honor `--skip-prompts` (auto-invoked-by-`setup-ds` path passes this). Otherwise, surface a single AskUserQuestion (multiSelect = true) listing the soft deps that came up missing.

```
What should I help with next? (multi-select; "none" is fine)

  [ ] Print `npm i -g agent-browser` install hint (needed for screenshot + 5 critics)
  [ ] Print `npm i -g @1agh/maude` install hint (faster scaffold via CLI helper)
  [ ] Run `/init` to generate CLAUDE.md (recommended — agents need it)
  [ ] Run `/flow:init` to scaffold .ai/ workspace (enables /flow:plan to see the design system)
  [ ] None — I'll handle setup myself
```

**Behavior per selection:**

- **agent-browser hint** → print `npm i -g agent-browser` + one-liner on what it unlocks (screenshot, auto-loop, axe-core a11y).
- **CLI hint** → print `npm i -g @1agh/maude` + note about `maude design serve` and `maude design init`.
- **Run /init** → print "Run `/init` now — Anthropic's built-in command analyzes the codebase and writes CLAUDE.md." (cannot programmatically invoke another slash command from inside one).
- **Run /flow:init** → print "Run `/flow:init` now to scaffold `.ai/` workspace."
- **None** → skip.

Skip the soft-dep block entirely if everything is green.

## Step 4 — Print next-step summary

```
Onboard complete.
  .design/config.json: skeleton written (no DS yet)
  Hard deps: ✓ all satisfied
  Soft deps surfaced: <list-or-none>

Next:
  /design:setup-ds <name> "[brief]"   — create your first design system
  /design:edit "<describe a product>" — bootstrap implicitly via /design:edit
```

## Behavior matrix

| State | Behavior |
|---|---|
| `.design/config.json` missing, invoked directly by user | Full pre-flight + write skeleton + post-flight prompts |
| `.design/config.json` missing, auto-invoked by `/design:setup-ds` or `/design:edit` / `/design:new` | Same flow, post-flight is skipped (parent passes `--skip-prompts`) |
| `.design/config.json` present, invoked directly by user | Re-run pre-flight summary + offer post-flight prompts again ("re-check environment") |
| `.design/config.json` present, auto-invoked by another command | No-op short-circuit: print "environment already initialized" and exit |

## What `/design:init` does NOT do

- **No DS creation.** Use `/design:setup-ds <name> "[brief]"`.
- **No CLAUDE.md generation.** That's Anthropic's built-in `/init` — we only surface the recommendation.
- **No `.ai/` scaffold.** That's `/flow:init` — we only surface the recommendation.
- **No npm installs.** Soft-dep install hints are printed for the user to copy/paste — we never auto-install.
