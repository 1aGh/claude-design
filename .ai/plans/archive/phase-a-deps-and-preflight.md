# Phase A — `maude doctor`: deps preflight + config health + quality gates

> **One umbrella diagnostic for "is my Maude install healthy AND is my workspace config sane?"** Today a new user can install Maude via the marketplace and run `/design:screenshot` only to fail mid-flow because `agent-browser` is not on PATH. Today THIS repo's own `.ai/workflows.config.json` declares `stack.language: "javascript"` (it's TypeScript), `stack.tests: "node-test"` (not in the schema enum — invalid), `stack.framework: "none"` (no `none` in the framework enum). Flow commands describe lint as a step in **prose** without binding to `pnpm lint`, so the agent sometimes skips it → lint debt accumulates → 6 emergency `chore(lint): biome ...` commits in 30 days (see `.ai/logs/system-reviews/biome-recurring-failures-review.md`). All three problem classes — dependencies, config correctness, quality-gate declaration — share the same fix: declare expected state as data, surface drift through one user-facing command. **That command is `maude doctor`.**
>
> Scope: **user safety + workspace correctness, not speed.** Phase B handles orchestration latency. Phase C handles cache / Monitor / background. This phase is structurally additive — no breaking changes to existing configs.
>
> **History:** This plan absorbs the former Phase D (`phase-d-config-hardening.md`, deleted). Both originally specified `maude doctor` independently — the merged plan unifies them so the command has one definition. See "History" subsection at the bottom for what changed and why.

---

## Problem (concrete cases this phase fixes)

### Dependency / install health (was Phase A's original scope)

1. **`agent-browser` silently missing.** `/design:screenshot`, `/design:new` step 9, `/flow:scenario` all hard-require `agent-browser`. Today they fail with whatever cryptic error the binary returns when invoked via Bash. No upfront check, no install hint.
2. **`agent-device` requires Xcode + Android SDK** to actually function. `/flow:scenario` and `/flow:utils-verify` invoke it for native paths. No detection on macOS without iOS sim configured.
3. **`bun` is hard for the dev-server build pipeline.** Per DDR-009 Phase 3.4 the dev-server is migrating to Bun authoritatively. Today the dev-server falls back to Node but the Bun path is the documented one.
4. **MCP servers go undiagnosed.** `AskUserQuestion` falls back to numbered-prose chat, but no one tells the user that fallback engaged because their MCP config is broken. `WebSearch`/`WebFetch` failures during `ux-research-agent` look like "research returned empty" with no remediation.
5. **No diagnostic command.** Users have no "is my install healthy" command. The CLI ships `init`, `config`, `design serve` — but nothing diagnostic.
6. **Per-command repeated checks.** `/design:init` and `/flow:init` both check `node >=20` and `git` independently. `/design:setup-ds` auto-invokes `/design:init` which re-runs the same checks. Cumulative ~5–15 s wasted on duplicate preflight per session start. (This bleed-over with Phase B is intentional — fixing it once at the manifest level helps both phases.)

### Config correctness + quality-gate declaration (was Phase D's scope)

7. **Schema drift is invisible.** Our own config has `tests: "node-test"` — not in the schema enum. No command catches this. `flow:testing-rules` silently treats it as `unknown` and degrades. Same risk for any future schema field change.
8. **Stack drift is invisible.** Repo migrated from JS → TS; nobody updated `stack.language`. `/flow:plan` and the skill-loader operate on the stale value. Same risk for any added framework, CSS approach, test runner, monorepo flag.
9. **`/flow:init` re-run is unsafe.** Step 1 (`maude init`) is idempotent. Step 4 (config setters) is destructive — it blindly overwrites with newly-detected values, including answers the user fine-tuned later (e.g. `prohibited: ["lodash"]` gets clobbered). Users learn not to re-run `/flow:init` after onboarding, which means stack changes never propagate.
10. **No validate-time gate on config sanity.** `/flow:validate` runs lint/types/tests/build but never the structural check on its own config. A typo in `motion.micro` ("ms" suffix → string instead of integer) breaks `motion-rules` silently mid-feature.
11. **Quality gates exist only as prose.** Schema declares only ONE quality gate — `stack.tests`. There's no field for `lint`, `format`, `typecheck`, `build`. Flow commands (`/flow:utils-verify`, `/flow:validate`, `/flow:done`) describe lint as a step in prose without binding to an explicit `pnpm lint` invocation, so the agent infers the command each time and sometimes skips it. Result: lint debt accumulates → CI catches it on `main` → emergency cleanup commits. See `biome-recurring-failures-review.md`.

---

## Solution shape

Eight layers, all reading from / writing to declarative manifests. Single user-facing diagnostic command (`maude doctor`); no `quality run` wrapper, no separate `config validate` or `config diff` subcommands — one umbrella that reports everything in sections.

### 1. Per-plugin `dependencies.json` (canonical schema for runtime deps)

One file per plugin: `plugins/design/dependencies.json`, `plugins/flow/dependencies.json`. Single source of truth — both `maude doctor` and the preflight script read this file; nothing else duplicates the list.

**Schema (JSON Schema in `plugins/<plugin>/dependencies.schema.json`):**

```jsonc
{
  "$schema": "./dependencies.schema.json",
  "version": "1",
  "plugin": "design",
  "dependencies": [
    {
      "id": "agent-browser",
      "type": "cli",                                  // cli | mcp | node-package | bun-package | system-tool
      "hardness": "hard",                             // hard | soft (soft = graceful degradation possible)
      "check": { "command": "agent-browser --version", "expectExit": 0 },
      "install": {
        "preferred": "npm i -g @anthropic-ai/agent-browser",
        "darwin":    "brew install anthropics/brew/agent-browser",
        "linux":     "npm i -g @anthropic-ai/agent-browser",
        "win32":     "npm i -g @anthropic-ai/agent-browser"
      },
      "autoInstall": true,                            // maude doctor --fix may run install.preferred
      "usedBy": ["commands/screenshot.md", "commands/new.md", "..."],
      "docsUrl": "https://github.com/anthropics/agent-browser"
    },
    {
      "id": "bun",
      "type": "cli",
      "hardness": "hard",
      "check": { "command": "bun --version", "minVersion": "1.3.0" },
      "install": { "preferred": "curl -fsSL https://bun.sh/install | bash" },
      "autoInstall": false
    },
    {
      "id": "askuserquestion-mcp",
      "type": "mcp",
      "hardness": "soft",
      "check": { "mcp": "AskUserQuestion", "tool": "ask" },
      "fallbackBehavior": "numbered-prose-chat"
    }
    // ... full list emerges from audit (Task A1)
  ]
}
```

### 2. `workflows.config.json` schema extensions: `quality` block

The `.ai/workflows.config.json` schema (`plugins/flow/.claude-plugin/config.schema.json`) gains ONE additive top-level property: `quality`, a flat map of gate name → shell command string.

```jsonc
"quality": {
  "type": "object",
  "description": "Map of gate name → shell command string. Gate names free-form; conventions: lint, format, typecheck, tests, build. Each command is run as-is via `eval` by the slash command that consumes the gate.",
  "additionalProperties": {
    "type": "string",
    "minLength": 1
  }
}
```

That's the entire schema addition. No `GateSpec` object shape, no `quality.order` array, no per-gate object — just non-empty strings. Convention enforced by slash commands, not by the schema. Missing `quality` block → flow commands print one-line warning + skip (no fabrication).

Example for THIS repo:

```jsonc
"quality": {
  "lint":      "pnpm lint",
  "format":    "pnpm biome format .",
  "typecheck": "pnpm exec tsc --noEmit -p plugins/design/dev-server",
  "tests":     "pnpm test && pnpm test:dev-server",
  "build":     "pnpm --filter @maude/site build"
}
```

### 3. Detection libraries — `stack-detect.mjs` + `config-lint.mjs`

Two pure JS libs (no I/O for output; consumers do the formatting):

- **`cli/lib/stack-detect.mjs`** — exports `detectStack(repoRoot) → StackSnapshot` (port of `/flow:init` Step 2 bash) AND `detectQualityGates(repoRoot) → Record<string, string> | null` (reads `package.json` scripts + biome/prettier/tsconfig presence). Returns `null` for "nothing detectable" — never fabricates.
- **`cli/lib/config-lint.mjs`** — exports `lintConfig({ config, schemaPath }) → { ok, errors, fixApplied? }`. Ajv 2020-12 backed, with a Levenshtein post-pass for enum suggestions. **Name kept for Ajv-vocab consistency; users never see "config lint" in CLI output** — surfaced under the "Schema:" section of `maude doctor`. Source-code lint is what `config.quality.lint` runs; the two never collide because the user-facing CLI surface only mentions `maude doctor`.

### 4. Preflight helpers — `preflight.sh` (design) + `cli/lib/preflight.mjs` (flow + CLI side)

Both consume `dependencies.json`. Output modes:

| Mode | Output | Exit code |
|---|---|---|
| Default (text) | Table with ✓/✗/⚠ per dep + install hint for failing | 0 if all hard pass; 1 if any hard fail |
| `--json` | Machine-readable result | same |
| `--shell-export` | `export DEPS_OK=1 DEPS_MISSING="bun,agent-device"` | same |
| `--quiet` | Only print missing hard deps; silent on success | same |
| `--fix` | Run `install.preferred` for each dep where `autoInstall: true` | 0 on success, 1 on install failure |

### 5. **`maude doctor` — unified diagnostic command**

Single top-level subcommand that combines deps + config + quality in one report.

```sh
maude doctor                  # full health check across deps + config
maude doctor --plugin design  # scope to one plugin (deps only — config is global)
maude doctor --fix            # auto-install autoInstall deps + apply safe config fixes
maude doctor --json           # machine-readable envelope
```

**Output sections:**

```
maude doctor

  Dependencies (plugins/design):
  ✓ bun           1.3.3
  ✗ agent-browser missing — npm i -g @anthropic-ai/agent-browser
  ⚠ playwright    not installed (soft dep, fallback for agent-browser)

  Dependencies (plugins/flow):
  ✓ node          22.0.0
  ✓ git           2.48.0

  Config schema (.ai/workflows.config.json):
  ✗ stack.tests
    value: "node-test"
    must be one of: vitest | jest | playwright | ... | none | unknown
    suggestion: "none" (closest match)

  Stack drift:
  Key                    Declared          Detected         Status
  stack.language         javascript        typescript       drift
  stack.framework        none              next.js          drift
  stack.router           none              next-app         drift

  Quality gates (additions only — existing values never overwritten):
  Gate              Declared    Detected             Status
  quality.lint      (missing)   pnpm lint            add
  quality.format    (missing)   pnpm biome format .  add
  quality.typecheck (missing)   pnpm exec tsc --…    add
  quality.tests     (missing)   pnpm test            add
  quality.build     (missing)   pnpm build           add

  Summary: 1 hard dep missing, 1 schema error, 3 stack drifts, 5 quality additions.

  Run with --fix to: install missing deps (prompt per item), drop unknown keys,
  apply detected drift, add missing quality gates. Existing user values are NEVER
  overwritten.

  Exit: 1 (hard dep missing AND/OR schema error blocks). Without those, drift +
  additions warnings exit 0.
```

`maude doctor --fix` is **never invoked silently**. The user has to type the flag. Per-dep prompts for autoInstall deps (`Install agent-browser via "npm i -g @anthropic-ai/agent-browser"? [y/N]`). For config: drift keys where detector returned non-`"unknown"` apply silently (the user already declared a value, we're just unifying with reality); quality additions apply silently (no overwrite risk); schema-error keys are NEVER auto-fixed (those are user decisions).

Slash commands call the underlying libs (`config-lint.mjs`, `stack-detect.mjs`, `preflight.mjs`) DIRECTLY — no `maude doctor` CLI roundtrip from inside `/flow:validate` Step 0.5 etc. The CLI is the user-facing entry; the libs are shared infrastructure.

### 6. Wire into existing init flows + cross-command short-circuit

- `plugins/design/commands/init.md` step 1 (pre-flight): replace inline `command -v` checks with a single `bash $CLAUDE_PLUGIN_ROOT/dev-server/bin/preflight.sh --shell-export`.
- `plugins/flow/commands/init.md` step 1: same pattern via `node $CLAUDE_PLUGIN_ROOT/../../cli/lib/preflight.mjs`.
- Cross-command short-circuit: `_preflight.json` cache file (`<designRoot>/_preflight.json` for design, `.ai/state/_preflight.json` for flow) with `{ checked: <iso>, all_hard_pass: true }`. Other commands skip preflight if `Date.now() - checked < 5min`.

### 7. Wire into validation gates + `/flow:init` drift-aware re-run

- **`/flow:validate`** gains **Step 0.5** (blocker): calls `lintConfig` directly. On exit 1 (schema errors), block. Then **replace prose static-checks** ("Lint", "Format check", "Type-check", "Unit + integration", "Build") with explicit bash that reads `config.quality.*` via jq and runs each via `eval`, fail-fast on non-zero.
- **`/flow:utils-verify`** runs `config.quality.format` + `config.quality.lint` (only those two — `typecheck` / `tests` / `build` belong to `/flow:validate`). Adds a soft drift warning consuming `maude doctor --json`.
- **`/flow:quick`** runs `format` + `lint` on staged files only.
- **`/flow:done`** delegates to `/flow:validate` (no direct gate invocations — single source of truth).
- **`.ai/release-guide.md` pre-flight** iterates `config.quality.*` and runs each via `eval`. Schema-check via `maude doctor --json | jq .summary.schemaErrors == 0`.
- **`/flow:init`** Step 4 becomes drift-aware: when re-running on existing config, `maude doctor --json` first, prompts per-key (keep / overwrite / skip), default = keep. `prohibited`, `boundaries`, `motion` ceilings, density map are NEVER in the drift list (detector doesn't touch them).

### 8. SessionStart hook (best-effort warn for deps only)

Per research finding §10 — SessionStart hooks **cannot block** session start, but they CAN print a warning that Claude sees as a session note.

Add `plugins/design/hooks.json` + `plugins/flow/hooks.json`:

```json
{
  "hooks": {
    "SessionStart": [{
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "${CLAUDE_PLUGIN_ROOT}/dev-server/bin/preflight.sh --quiet --warn-only",
        "timeout": 8
      }]
    }]
  }
}
```

**Config-side does NOT use SessionStart** — config health surfaces inside `/flow:validate` and `/flow:utils-verify` where it's actionable. SessionStart noise about config drift would be obnoxious mid-feature.

---

## Out of scope (deliberately)

- **No `maude config validate` / `maude config diff` / `maude quality run` / `quality list` / `quality check` CLI subcommands.** `maude doctor` is the single user-facing entry point. Slash commands call `pnpm <script>` (or whatever `config.quality.<gate>` contains) directly — wrapping `pnpm` in a `maude` subcommand is a runner around a runner. See `feedback-no-redundant-tooling-over-pnpm` memory.
- **No `GateSpec` object shape** for `quality` entries. Just a string command. If projects later need per-gate metadata (warn-only, staged-only), the schema can additively widen to accept string OR object — but v1 is plain strings only.
- **No per-gate `scope`, `blocking`, or `fix` fields in v1.** Slash commands decide their own scope per gate by convention (e.g. `/flow:quick` runs `format` + `lint` only). Blocking is opinionated by the calling slash command, not by the config.
- **No husky / lefthook / pre-commit scaffold.** User's choice of hook tool is too varied. With `config.quality` as a flat map, hook authoring is a one-liner: `eval $(jq -r '.quality.lint' .ai/workflows.config.json)`. We make hooks easy to write; we don't write them.
- **`maude doctor --fix` never silently auto-installs.** Per-dep prompt, always.
- **`scope: "affected"` gate semantics.** Defer to a follow-up phase — "affected" computation is non-trivial per-tool (nx, turbo, bun test --changed, jest); worth getting right in isolation. v1 has no `scope` field at all.
- **New schema fields other than the additive `quality` block.** No changes to existing `stack` / `boundaries` / `motion` / `responsive` shapes.
- **Migrating users from old enums** (e.g. legacy `tests: "node-test"`). Doctor flags it; user picks the migration target. We don't guess.
- Splitting oversized SKILL.md files (Phase B).
- Parallel subagent fan-out rewording (Phase B).
- Sidecar cache for research results (Phase C).
- Monitor pattern in server-up.sh (Phase C).

---

## Design Decisions

### `--fix` safety contract (combined across deps + config)

`maude doctor --fix` only writes / installs where:

1. **Deps:** dep is hard-failing AND `autoInstall: true` AND user confirms the per-dep prompt → run `install.preferred`.
2. **Stack config:** detector returned a concrete value (not `"unknown"`) AND declared value disagrees → apply detected.
3. **Quality:** gate key does NOT already exist in `config.quality` AND detector emitted a string for it → add.
4. **Schema:** unknown property → drop. Missing key with a schema default → fill with default. NEVER touch a key with an invalid value (e.g. won't auto-replace `stack.tests: "node-test"` with a guessed enum — user's job).

Detector returning `"unknown"` while config has a real value = user knows something the detector doesn't (e.g. they configured a custom test runner). Never overwrite. Same rule applies to `/flow:init` re-run's per-key prompt. Same rule for `quality.*` — existing user-tuned commands are sacred.

### Lint enum-suggestion strategy

When a string value fails the `enum` constraint, compute Levenshtein distance against every enum entry; suggest top 1 if distance ≤ 3, top 2 if any tie. No suggestion for non-string mismatches (would just be noise). Levenshtein is inlined (~15 lines) in `config-lint.mjs` — no `fastest-levenshtein` dep.

### Quality gates — detector heuristics

`detectQualityGates(repoRoot)` reads `package.json` and emits a string command per matching script:

| Gate name | Triggers on | Emitted command |
| --------- | ----------- | --------------- |
| `lint` | `scripts.lint` exists | `<pkgmgr> lint` |
| `format` | `scripts.format` exists, OR (`biome.json` exists AND no `scripts.format`) | `<pkgmgr> format` or `<pkgmgr> biome format .` |
| `typecheck` | `scripts.typecheck` exists, OR (`tsconfig.json` exists AND no `scripts.typecheck`) | `<pkgmgr> typecheck` or `<pkgmgr> exec tsc --noEmit` |
| `tests` | `scripts.test` exists | `<pkgmgr> test` |
| `build` | `scripts.build` exists | `<pkgmgr> build` |

Detector emits a flat map. NEVER overwrites an existing `quality.<key>` value via `maude doctor --fix` — additions only.

### Quality gates — flow command bindings

Each slash command picks which gates it cares about and what posture to take. The config doesn't enforce ordering or blocking — that's the slash command's opinion.

| Command | Gates read | Posture |
| ------- | ---------- | ------- |
| `/flow:utils-verify` | `format`, `lint` | Blocker. Missing gate → skip with warning. |
| `/flow:quick` | `format`, `lint` | Blocker (staged-only). |
| `/flow:validate` | `format`, `lint`, `typecheck`, `tests`, `build` (in this order, fail-fast) | All blocker. |
| `/flow:done` | Delegates to `/flow:validate`. | — |
| `.ai/release-guide.md` pre-flight | Every entry in `config.quality` (no filter). | Blocker. |

Pattern (one block per gate in each slash command):

```bash
LINT_CMD=$(jq -r '.quality.lint // empty' .ai/workflows.config.json)
if [[ -n "$LINT_CMD" ]]; then
  eval "$LINT_CMD" || { echo "::error::lint gate failed (\`$LINT_CMD\`)"; exit 1; }
else
  echo "⚠ quality.lint not declared in workflows.config.json — run \`maude doctor --fix\`"
fi
```

---

## Context References

### Must-Read Files

- `cli/commands/config.mjs` (full file, 100 lines) — Why: `maude config show/get/set` stay unchanged; new `cli/commands/doctor.mjs` mirrors its dispatcher shape.
- `cli/commands/init.mjs` (full file, 179 lines) — Why: file-templating + idempotency precedent. The `maude init` CLI is already careful about `--force`; `/flow:init` re-run logic should match.
- `cli/bin/maude.mjs` (the dispatcher) — Why: register `doctor` as new top-level subcommand alongside `init` / `config` / `design` / `version`.
- `plugins/flow/.claude-plugin/config.schema.json` (full file, 399 lines) — Why: the contract. Lint validates against this verbatim. Schema uses Draft 2020-12 — Ajv must be configured for it (`new Ajv2020()`). New `quality` block lands here as an additive top-level property.
- `plugins/flow/commands/init.md` (Step 2 lines 71–181, Step 4 lines 264–344) — Why: the bash detector that becomes `cli/lib/stack-detect.mjs`. Port logic 1:1.
- `plugins/flow/templates/ai-skeleton/workflows.config.json` (full file, 75 lines) — Why: skeleton must validate cleanly. Skeleton has NO `quality` block — detector fills via `--fix`.
- `.ai/workflows.config.json` (this repo's config) — Why: our own canary. Plan must produce a working `maude doctor` that flags `tests: "node-test"` as schema error, surfaces 5 stack drift items, proposes 5 quality additions.
- `plugins/flow/commands/utils-verify.md`, `plugins/flow/commands/validate.md`, `plugins/flow/commands/done.md`, `plugins/flow/commands/quick.md` — Why: currently describe lint/typecheck/tests in **prose**. This phase converts to explicit gated bash blocks reading `config.quality.*` via jq + eval.
- `.ai/release-guide.md` (Pre-flight + Biome reformat sweep sections) — Why: release walker's lint step is narrowly framed; this phase generalizes it.
- `plugins/flow/skills/a11y-rules/SKILL.md` and `plugins/flow/skills/motion-rules/SKILL.md` — Why: closest skill shape for new `quality-gates` skill (~50-line reference).
- `.ai/logs/system-reviews/biome-recurring-failures-review.md` — Why: end-to-end justification for Layer 5. The "specific improvement actions" table maps 1:1 to several tasks below.
- `feedback-no-redundant-tooling-over-pnpm.md` (memory) — Why: foundational design constraint. Anything that smells like "wrap pnpm in a maude subcommand" is rejected at design review.

### Files to Create

- `plugins/design/dependencies.json` + `plugins/design/dependencies.schema.json`
- `plugins/flow/dependencies.json` + `plugins/flow/dependencies.schema.json`
- `plugins/design/dev-server/bin/preflight.sh`
- `plugins/design/hooks.json` + `plugins/flow/hooks.json`
- `cli/lib/preflight.mjs` (+ test)
- `cli/lib/stack-detect.mjs` (+ test, ~7 fixtures incl. quality detection)
- `cli/lib/config-lint.mjs` (+ test, ~6 fixtures incl. enum + non-string `quality.<gate>` value)
- `cli/lib/validate-deps-schema.mjs` (~30 lines hand-rolled JSON schema validator for dependencies.json; ajv reserved for the main config schema)
- `cli/commands/doctor.mjs` (+ test, ~7 cases)
- `plugins/flow/skills/quality-gates/SKILL.md` (~50 lines reference)

---

## Tasks

Execute in order. Each task is atomic and testable.

### A1 — Enumerate canonical dep list

- **Do:** Walk every file under `plugins/design/{commands,agents,skills}/` and `plugins/flow/{commands,agents,skills}/` plus `plugins/design/dev-server/bin/*.sh`. For each dep mentioned (CLI binary, MCP, npm package), record id + hardness + which file referenced it.
- **Source:** the dependency inventory already produced in the planning round — see audit summary (9 CLI binaries, 3 MCP servers, 11 npm runtime packages for design; 2 CLI binaries for flow).
- **Output:** `plugins/design/dependencies.json` + `plugins/flow/dependencies.json`, both validated against the schema.
- **Validate:** `node -e "require('./plugins/design/dependencies.json')"` parses; every `id` is unique; every `usedBy` path exists on disk.

### A2 — Write the dependency JSON Schema

- **Do:** Create `plugins/<plugin>/dependencies.schema.json` matching the structure in Solution §1. Reference from `dependencies.json` via `$schema`.
- **Gotcha:** keep `check.command` as a string (not array) — it executes via `bash -c`, allowing pipes if needed.
- **Validate:** ajv-cli against both `dependencies.json` files. If ajv-cli isn't available, hand-roll `cli/lib/validate-deps-schema.mjs` (~30 lines, no deps).

### A3 — Build `preflight.sh` (shell helper for design plugin)

- **Do:** Create `plugins/design/dev-server/bin/preflight.sh`. Read `../dependencies.json` (relative resolution per DDR-045 → use `paths.ts`-style env vars). Loop deps, run `check.command`, collect results. Print mode-specific output.
- **Pattern:** mirror existing helper conventions from `screenshot.sh`, `bootstrap-check.sh`, `server-up.sh`.
- **Gotcha:** the dev-server may run from a compiled bundle (Bun standalone). Use `$CLAUDE_PLUGIN_ROOT` env var, not `dirname $0` — DDR-045 lesson.
- **Validate:** `bash plugins/design/dev-server/bin/preflight.sh --json | jq '.summary'` returns valid JSON.

### A4 — Build `cli/lib/preflight.mjs` (Node-side helper)

- **Do:** Mirror `preflight.sh` in Node — same logic, same output modes — for the flow plugin and shared use by `maude doctor`.
- **Pattern:** mirror `cli/commands/config.mjs` (zero deps, child_process for the `check.command`).
- **Validate:** `node cli/lib/preflight.mjs --plugin design --json` matches `bash preflight.sh --json` output.

### A5 — ADD `ajv` + `ajv-formats` to package.json dependencies

- **Do:** `pnpm add ajv@^8 ajv-formats@^3` at repo root.
- **Gotcha:** `ajv/dist/2020.js` is the Draft-2020 entry. Default `import Ajv from 'ajv'` is Draft-07 and will silently accept schemas with `$schema: 2020-12` while skipping new keywords.
- **Validate:** `cat package.json | jq '.dependencies.ajv'` returns the installed version; `node -e "import('ajv/dist/2020.js').then(m => console.log(m.default))"` resolves.

### A6 — CREATE `cli/lib/stack-detect.mjs` (port of `/flow:init` Step 2 bash + quality detection)

- **Do:** Pure JS function `export async function detectStack(repoRoot) → StackSnapshot`. One detector per field. Read-only filesystem (`node:fs/promises.stat` + `readFile` of `package.json` / lock files). Return `"unknown"` strings for any unresolved field — never throw. **Plus** export sibling `detectQualityGates(repoRoot) → Record<string, string> | null` per Design Decisions § "Quality gates — detector heuristics" — reads `package.json` scripts + `biome.json` / `.prettierrc` / `eslint.config.*` presence, emits a flat map. Returns `null` when nothing detectable.
- **Pattern:** mirror the order in `init.md` lines 71–181. Quality detector is a separate pure function — composable, testable.
- **Gotcha:** bash version uses `grep -q '"vitest"' package.json` — port as substring check on the raw file (NOT `JSON.parse` then key-lookup), since the bash version matches `vitest` in scripts too. For quality-gates, DO use `JSON.parse(pkgJson).scripts` — names are exact, no substring fuzz.
- **Validate:** `node --test cli/lib/stack-detect.test.mjs` passes after A7.

### A7 — CREATE `cli/lib/stack-detect.test.mjs` (fixtures + assertions)

- **Do:** `node:test`-driven. Use `os.tmpdir()` + `mkdtempSync` for hermetic fixtures. ~7 cases: empty repo (all unknown, quality null), Next.js+biome (quality detected with 3 entries), Expo+prettier, monorepo with both, scripts:{format} only (one gate emitted), package manager prefix correctness (pnpm vs npm).
- **Pattern:** `cli/lib/argv.test.mjs` is the reference.
- **Gotcha:** don't use real repo paths — tests must be hermetic and runnable in CI without checkouts of fixture projects. Assert on emitted `command` strings verbatim — drift in detector output is a public contract change.
- **Validate:** `node --test cli/lib/stack-detect.test.mjs` passes all cases.

### A8 — CREATE `cli/lib/config-lint.mjs` (Ajv + enum-suggestion post-pass)

- **Do:** `export async function lintConfig({ configPath, schemaPath })`. Load both, instantiate `new Ajv2020({ allErrors: true, strict: false })`, add formats, compile schema once, validate. On failure, map Ajv errors to `{ path, message, suggestion? }`. For `enum` errors on string fields, compute Levenshtein vs each allowed value; attach `suggestion` if min distance ≤ 3. **File named `config-lint.mjs` for Ajv-vocab consistency; users never see "lint" in CLI** — surfaced under "Schema:" section of `maude doctor`. No user-facing `config lint` subcommand exists.
- **Pattern:** keep function pure — no I/O for output. `doctor.mjs` does the formatting.
- **Gotcha:** schema has `additionalProperties: false` at multiple levels. The new `quality` block uses `additionalProperties: { type: "string" }` so Ajv accepts arbitrary gate names — only value-is-non-empty-string applies.
- **Validate:** A9's test file passes.

### A9 — CREATE `cli/lib/config-lint.test.mjs`

- **Do:** 6 fixtures inline JSON literals: (a) valid skeleton config, (b) invalid enum `tests: "node-test"`, (c) unknown field `stack.foo: 1`, (d) type mismatch `motion.micro: "300ms"`, (e) missing `name`, (f) `quality.lint: 123` (non-string value).
- **Pattern:** Refactor `lintConfig` to accept either `{ configPath, schemaPath }` or `{ config, schema }`. Same internal logic.
- **Gotcha:** Levenshtein implementation is trivial; inline ~15 lines in `config-lint.mjs` — no extra dep.
- **Validate:** `node --test cli/lib/config-lint.test.mjs` passes.

### A10 — EXTEND `plugins/flow/.claude-plugin/config.schema.json` with the `quality` block

- **Do:** Add top-level `quality` per Design Decisions / Solution §2. Optional. `type: "object"`, `additionalProperties: { type: "string", minLength: 1 }`. No per-gate object shape, no `gates`/`order` wrapper. **Do NOT** add `quality` to any `required` array.
- **Pattern:** existing block-style properties (`motion`, `responsive`) — same indentation. `quality` is the SIMPLEST block by design.
- **Gotcha:** don't enum the gate names. Projects with custom gates (`accessibility`, `i18n`) need to add their own.
- **Validate:** `node cli/bin/maude.mjs doctor` against a test config with valid `quality` → 0 schema errors. Against config with `quality.lint: 123` → 1 error at `/quality/lint`.

### A11 — CREATE `cli/commands/doctor.mjs` — unified diagnostic entry point

- **Do:** New top-level `maude` subcommand. `export async function run({ args, pkgRoot })`. Sequentially: (1) load both `dependencies.json` files; (2) run `preflightLib.checkAll()` (Task A4); (3) load `.ai/workflows.config.json`; (4) call `lintConfig` (Ajv schema); (5) call `detectStack` + `detectQualityGates`; (6) merge into one report; (7) render per Design Decisions § "CLI output shape" — Dependencies (per plugin) → Config schema → Stack drift → Quality gates → Summary. Support `--plugin <name>` (scopes deps section only — config is global so always shown), `--fix` (per-dep prompts for autoInstall + applies safe config fixes), `--json` (structured envelope `{ deps: {...}, schema: {...}, drift: {...}, quality: {...}, summary: {...} }`). Exit 0 if healthy or warnings-only, 1 if any hard dep missing OR any schema error.
- **Pattern:** dispatcher shape from `cli/commands/config.mjs` + `cli/commands/init.mjs` for argv parsing.
- **Gotcha:** `pkgRoot` is plumbed through `run({ args, pkgRoot })` from `cli/bin/maude.mjs`. Use it — don't compute relative to `import.meta.url` (CLI distributed via `bun --compile` standalone binaries per DDR-045). For `--fix` config writes, re-use `saveConfig` from `cli/commands/config.mjs` — single JSON write path. For `--fix` dep installs, NEVER silent — per-dep prompt.
- **Validate:** `node cli/bin/maude.mjs doctor` from this repo. Expected: deps section (with whatever's missing/present), 1 schema error (`tests: "node-test"`), 4 stack drifts, 5 quality additions, exit 1 if deps clean / exit 1 if schema error. Then `--fix` — should drop schema-fixable, apply 4 drifts, add 5 quality entries, prompt per autoInstall dep. Re-run → exit 0 (clean).

### A12 — CREATE `cli/commands/doctor.test.mjs`

- **Do:** node:test for the dispatcher. ~7 cases: (a) all-healthy config → exit 0; (b) hard dep missing → exit 1 with table line; (c) schema error → exit 1 with the error in output; (d) drift only → exit 0 with warning; (e) quality additions only → exit 0 with addition lines; (f) `--fix` on a config with both schema + drift + additions → modifies the file correctly + exit 0; (g) `--json` emits structured envelope; (h) `--plugin design` scopes deps section but still shows full config section.
- **Pattern:** spawn `cli/bin/maude.mjs doctor` as a child for end-to-end coverage (~50ms per case). Use `os.tmpdir()` fixtures per case.
- **Validate:** `node --test cli/commands/doctor.test.mjs` passes all cases.

### A13 — REGISTER `doctor` in `cli/bin/maude.mjs` dispatcher

- **Do:** Add `doctor` to the subcommand dispatch (alongside `init`, `config`, `design`, `version`). Wire to `cli/commands/doctor.mjs`. Update the "unknown subcommand" error to list `doctor` among the known ones. Also update `cli/commands/config.mjs` `usage()` text to add a "See also: `maude doctor` for config health-check" line.
- **Pattern:** existing dispatch for `init` / `config` — copy verbatim.
- **Validate:** `node cli/bin/maude.mjs doctor` runs and prints the unified report. `node cli/bin/maude.mjs wat` errors with a list that includes `doctor`. `node cli/bin/maude.mjs quality` errors (no such subcommand — slash commands read config directly).

### A14 — UPDATE `plugins/design/commands/init.md` + `plugins/flow/commands/init.md` (preflight wiring)

- **Do:** Edit step 1 (pre-flight section, ~line 30 of each): replace inline `command -v node`, `command -v git`, `command -v maude`, `command -v agent-browser` block with a single `bash "$CLAUDE_PLUGIN_ROOT/dev-server/bin/preflight.sh" --shell-export | source /dev/stdin` (design) / `node "$CLAUDE_PLUGIN_ROOT/../../cli/lib/preflight.mjs"` (flow). Read exported variables, render existing table format.
- **Gotcha:** `init.md` is read by Claude, not bash — the bash recipe in markdown is what Claude executes. Keep markdown human-readable.
- **Validate:** `/design:init` on a clean machine prints the same table it does today, but dep list is now sourced from `dependencies.json`. Editing `dependencies.json` (e.g. adding `vhs` as a soft dep) shows up in next `/design:init` run without editing the .md.

### A15 — Cross-command short-circuit (`_preflight.json`)

- **Do:** After successful preflight, `preflight.sh` / `preflight.mjs` write `<designRoot>/_preflight.json` (design) and `.ai/state/_preflight.json` (flow): `{ checked: <iso>, plugin: "design", all_hard_pass: true, soft_warnings: [...] }`. Other commands read this first; if `Date.now() - checked < 5min` and `all_hard_pass: true`, skip preflight entirely.
- **Gotcha:** freshness file lives in `<designRoot>/` (gitignored alongside `_server.json`) for design, and `.ai/state/` for flow. Both already gitignored.
- **Validate:** invoke `/design:init`, then immediately `/design:new` — second command should print "preflight cached, skipping".

### A16 — SessionStart hook for session-wide warning (deps only)

- **Do:** Add `plugins/design/hooks.json` + `plugins/flow/hooks.json` as in Solution §8. Hook body: invoke `preflight.sh --quiet --warn-only`. Output: single line "MISSING HARD DEPS: bun, agent-browser. Run `maude doctor --fix` to install." (silent on success).
- **Gotcha:** SessionStart cannot prompt. Make output very short; long output bloats every session start. Config-side does NOT use SessionStart — only deps.
- **Validate:** start fresh `claude` session where `agent-browser` is missing → warning appears in session start output.

### A17 — UPDATE `plugins/flow/commands/init.md` Step 3.5 (drift-aware re-run)

- **Do:** Add Step 3.5 BEFORE Step 4 propagation:
  ```
  ## Step 3.5: Drift check (only when re-running on existing config)

  > Skip if `.ai/workflows.config.json` did not exist before Step 1.

  Run `maude doctor --json` and parse the `drift` + `quality` sections. For each
  stack drift row:
  - If declared == "unknown" / "" / null: silently apply detected.
  - If declared != detected and detector returned a concrete value: ask
    `keep declared <X> | apply detected <Y> | skip this key`. Default = keep.

  For each quality addition: ask `add quality.<gate>: "<command>" | skip`. Default = add.

  Apply chosen overrides via `maude config set`.
  ```
- **Pattern:** mirror existing Step 4's `maude config set` calls.
- **Gotcha:** `prohibited`, `boundaries`, `motion` ceilings, density map are NEVER in the drift list (detector doesn't touch them). Reinforce in prose so user doesn't fear re-run will eat tuned values.
- **Validate:** Run `/flow:init` in this repo (already has config). Step 3.5 fires, prompts about language/framework/tests/router + 5 quality additions, leaves `prohibited` / `boundaries` / `motion` untouched.

### A18 — UPDATE `plugins/flow/commands/validate.md` — schema-check Step 0.5 + quality.* reads

- **Do:** TWO related edits, ONE task:
  1. Insert at the top: `Step 0.5: maude doctor --json | jq -e '.summary.schemaErrors == 0'` — fail-fast on schema errors. On exit 1, block with one-line summary + "run `maude doctor --fix`". Drift / quality additions are warning-only at this step.
  2. Replace the prose static-checks bullets ("Lint", "Format check", "Type-check", "Unit + integration", "Build") with explicit bash blocks reading `config.quality.*` via jq and running each in order (format → lint → typecheck → tests → build), fail-fast on non-zero. Each gate is one block per Design Decisions § "Quality gates — flow command bindings".
- **Pattern:** existing Step 0/1 — same posture: blocker on failure, no auto-fix in validate context.
- **Gotcha:** don't call `--fix` from validate. Print the fix command (`→ try \`pnpm biome check --fix\`` or `→ try \`maude doctor --fix\``) and let the user run it.
- **Validate:** Run `/flow:validate` in this repo with current invalid config — should block at Step 0.5 with `tests: "node-test"` error. Fix config; re-run; static-check chain runs all 5 declared gates in order.

### A19 — UPDATE `plugins/flow/commands/utils-verify.md` — quality.format + quality.lint reads (staged) + soft drift warning

- **Do:** TWO related edits, ONE task:
  1. Replace prose lint/typecheck bullets in Process section with explicit bash reading `config.quality.format` + `config.quality.lint` via jq and running via `eval`. Pattern from Design Decisions. Skip `typecheck` / `tests` / `build` — they're `/flow:validate`'s job.
  2. Final soft drift warning step: `maude doctor --json`; if drift > 0 OR quality additions > 0, print one-line warning. Not blocking.
- **Pattern:** explicit bash + gate. No `maude quality run` wrapper — `eval $(jq -r '.quality.lint')` IS the runner.
- **Gotcha:** the drift warning is a *nudge*, never a blocker. Gate failures ARE blockers.
- **Validate:** Run `/flow:utils-verify` in this repo (after A25 populates `quality`) with introduced lint error → `lint` gate exits 1. Revert → step passes. Drift warning appears at bottom when applicable.

### A20 — CREATE `plugins/flow/skills/quality-gates/SKILL.md` (thin reference, ~50 lines)

- **Do:** Frontmatter: `name: flow:quality-gates`, `category: shared`, trigger phrases: `quality gate`, `config.quality`, `lint script`, `tests script`, `format script`. Body covers: (1) `config.quality` is a flat map; (2) common conventional gate names + free-form additions; (3) read pattern `eval $(jq -r '.quality.<name> // empty' .ai/workflows.config.json)`; (4) missing gate → warn + skip, NEVER fabricate; (5) short table mapping slash commands to gates they read (utils-verify → format+lint, validate → all 5 in order, quick → format+lint staged, done → via validate, release pre-flight → all). **NOT a runner contract** — documents data shape, that's it.
- **Pattern:** mirror `plugins/flow/skills/a11y-rules/SKILL.md` frontmatter. Body is reference, not policy.
- **Gotcha:** skill is data-shape reference, not execution contract. Resist adding "how to format failure report" / "JSON output shape" — the data IS a plain string command.
- **Validate:** `wc -l plugins/flow/skills/quality-gates/SKILL.md` ≤ 80. Slash commands' bash blocks reference `flow:quality-gates` by name; skill loader resolves it.

### A21 — UPDATE `plugins/flow/commands/done.md` — verify validate transit covers gates

- **Do:** Inspect `done.md` — confirm it delegates to `/flow:validate`. Add one-line note: "Quality gates run inside `/flow:validate` (see Phase A Layer 7). `/flow:done` itself adds no new gate invocation." Remove any direct lint bullet not gated by `/flow:validate`.
- **Pattern:** documentation update; no new bash.
- **Gotcha:** don't add another bash block that reads `config.quality` — duplicating doubles CI time.
- **Validate:** `grep -nE "quality\.|lint|format|typecheck" plugins/flow/commands/done.md` only matches references via `/flow:validate`.

### A22 — UPDATE `plugins/flow/commands/quick.md` — fast subset (staged-only)

- **Do:** Replace any prose lint mention with bash reading `config.quality.format` + `config.quality.lint`. Wrap with git-staged-files probe: `STAGED=$(git diff --cached --name-only); [[ -z "$STAGED" ]] && exit 0; eval "$LINT_CMD" -- $STAGED`. Gates that don't accept file arguments will scan everything anyway — gate's choice.
- **Pattern:** same shape as A19. Distinguishing feature: staged probe.
- **Gotcha:** if user has no `format` gate declared, skip with warning, not fail.
- **Validate:** `/flow:quick` with format violation in staged file → exits 1. No staged files → exits 0 silently.

### A23 — PATCH `.ai/release-guide.md` pre-flight + Biome sweep sections

- **Do:** Rewrite Pre-flight Biome bullet:
  ```bash
  # Step 1: config health
  maude doctor --json | jq -e '.summary.schemaErrors == 0' \
    || { echo "::error::config schema errors — run \`maude doctor --fix\`"; exit 1; }

  # Step 2: all declared quality gates
  for gate in $(jq -r '.quality | keys[]' .ai/workflows.config.json); do
    cmd=$(jq -r ".quality[\"$gate\"]" .ai/workflows.config.json)
    echo "→ $gate: $cmd"
    eval "$cmd" || { echo "::error::release pre-flight: $gate gate failed"; exit 1; }
  done
  ```
  Replace "Biome reformat sweep" section's narrow framing with: "After `pnpm run changeset:version`, re-run `format` + `lint` gates. If only `format` errors remain, the bump expanded sub-package arrays — apply format-fix (`pnpm biome format --write .`) and re-stage. Any other gate failure is real debt that should have been caught upstream — abort the release and triage."
- **Pattern:** matches release-guide's existing explicit-bash-gated steps.
- **Gotcha:** keep human-facing prose around Biome sweep — don't strip the explanation. Just widen the framing.
- **Validate:** Run `/flow:release` against synthesized config with one failing gate → walker stops at pre-flight with failing command surfaced.

### A24 — UPDATE `plugins/flow/templates/ai-skeleton/workflows.config.json` — sanity-check skeleton + omit `quality`

- **Do:** (1) Run `maude doctor` against the skeleton (with a synthetic `name`). Fix any schema issues. (2) **DO NOT** add a `quality` block to the skeleton — leave it absent. `/flow:init` Step 4 calls `detectQualityGates(repoRoot)` and writes a concrete block based on user's actual `package.json`. Stub would be wrong OR trigger spurious overwrites. (3) Add one-line comment in skeleton frontmatter pointing users at `maude doctor --fix` if they want to populate `quality` later.
- **Pattern:** skeleton is SEED; `quality` is opt-in via detection, not template default.
- **Gotcha:** don't be clever with conditional templating — skeleton is a static file with `PROJECT_NAME` substitution, not a generator.
- **Validate:** copy skeleton to `/tmp/x.json`, replace `PROJECT_NAME` with `x`, `node cli/bin/maude.mjs doctor` in that tmp dir → 0 schema errors, no `quality` block.

### A25 — UPDATE `.ai/workflows.config.json` (this repo's config) — fix drifts + populate `quality`

- **Do:** (1) Run `maude doctor --fix` against this repo. Auto-applies `stack.language: typescript`, `stack.framework: next.js`, `stack.router: next-app`; ADDS detected `quality.*` entries. (2) Manually decide on `stack.tests` (`node-test` is invalid — pick `none` and record in DDR if no canonical runner applies). `--fix` won't touch it (safety contract). (3) For `quality.tests`: detector emits `pnpm test` but this repo has two test layers; manually edit to `"pnpm test && pnpm test:dev-server"`. (4) Verify each `quality.*` value is runnable.
- **Pattern:** same edits a downstream user would make. Dogfood.
- **Gotcha:** `stack.tests` is detector's blindspot — manual call + DDR. `quality.tests` compound — `--fix` does the dumb single-script add; user refines.
- **Validate:** `maude doctor` exits 0; report shows zero schema errors, zero drifts, zero additions; `jq '.quality | keys | length' .ai/workflows.config.json` returns 5.

### A26 — UPDATE `package.json` `files` field — ensure manifests + schemas ship

- **Do:** Add `plugins/design/dependencies.json`, `plugins/design/dependencies.schema.json`, `plugins/flow/dependencies.json`, `plugins/flow/dependencies.schema.json`, `plugins/design/hooks.json`, `plugins/flow/hooks.json` to `package.json` `files` array. Verify `plugins/flow/.claude-plugin/config.schema.json` is already there (Ajv runtime needs it). If not, add explicitly.
- **Pattern:** CLAUDE.md says `package.json` `files` is intentionally minimal — extend with care.
- **Validate:** `npm pack --dry-run | grep -E 'dependencies\.json|config\.schema\.json|hooks\.json'` shows all in tarball.

### A27 — UPDATE `README.md` and `CLAUDE.md` + `cli/commands/help.mjs` — document `maude doctor`

- **Do:** One paragraph in README under CLI section: "**Health check:** `maude doctor` reports missing dependencies, config schema errors, stack drift, and missing quality-gate declarations in one shot. `--fix` applies safe auto-fixes (prompts per dep install; never overwrites existing user config values). `--json` for programmatic consumers. Run after stack changes or before opening a PR. **Quality gates** are declared in `.ai/workflows.config.json` under the top-level `quality` map (e.g. `{ "lint": "pnpm lint" }`); slash commands read it directly and run via `eval`. No `maude quality run` wrapper — `pnpm <script>` is the runner. Hook this into your local pre-commit tool: `eval $(jq -r '.quality.lint' .ai/workflows.config.json)`." Add `doctor` to `cli/commands/help.mjs` output. In CLAUDE.md, add a "Dependency manifests + config health" subsection under "Architecture" pointing at `dependencies.json` files, `config.quality`, and `maude doctor`.
- **Pattern:** existing CLI doc blocks.
- **Validate:** `grep -E 'maude doctor' README.md cli/commands/help.mjs CLAUDE.md` returns matches. `grep -E 'maude quality run|maude config (validate|diff)' README.md cli/commands/help.mjs` returns ZERO matches (none of those exist).

### A28 — WRITE DDR for combined scope

- **Do:** Write `.ai/decisions/DDR-053-maude-doctor-deps-config-quality.md`. Title: "`maude doctor` as unified workspace diagnostic (deps + config + quality), single user-facing CLI surface, slash commands call internal libs directly." Cite: (a) audit findings from this planning round; (b) `biome-recurring-failures-review.md` (Layer 4 motivation); (c) `feedback-no-redundant-tooling-over-pnpm` memory (why no `maude quality run` wrapper).
- **Pattern:** mirror existing DDRs in `.ai/decisions/`. Next free DDR number = 053 (047/048/049/050/051/052 are taken — 052 went to the parallel hocuspocus-vs-partykit hub decision shipped in commit `41d9ad9`. Verify via `ls .ai/decisions/DDR-*.md | tail -10` immediately before writing in case more shipped between plan time and impl time).
- **Validate:** DDR linked from CLAUDE.md. `ls .ai/decisions/DDR-053-*.md` exists.

---

## Validation

Run these commands to confirm zero regressions:

1. **Unit tests**: `node --test cli/lib/preflight.test.mjs cli/lib/stack-detect.test.mjs cli/lib/config-lint.test.mjs cli/commands/doctor.test.mjs cli/lib/argv.test.mjs cli/lib/update-check.test.mjs` — all green.
2. **Schema validates:** `node cli/lib/validate-deps-schema.mjs` passes for both plugins.
3. **Doctor on clean machine:** spin up docker `node:20-alpine`, `npm i -g @1agh/maude`, run `maude doctor` → table shows `agent-browser ✗ — run npm i -g @anthropic-ai/agent-browser` plus any config issues.
4. **Doctor --fix actually installs + fixes:** in same container, `maude doctor --fix`, accept prompts, re-run → all hard deps ✓, schema clean.
5. **Dogfood doctor:** `node cli/bin/maude.mjs doctor` on this repo — after A25: exits 0, report shows zero hard-dep missing (on dev machine), zero schema errors, zero drifts, zero quality additions.
6. **Dogfood doctor --fix on dirty config:** temporarily revert one quality gate, run `maude doctor --fix`, confirm it's re-added (additive, no overwrite). Revert a stack key to wrong value, confirm `--fix` corrects to detected value.
7. **Dogfood quality reads:** `jq '.quality | keys' .ai/workflows.config.json` lists 5 gates. `eval $(jq -r '.quality.format' .ai/workflows.config.json)` exits 0. Same for `lint`.
8. **Dogfood flow:validate:** `/flow:validate` — Step 0.5 (`maude doctor` schema check) passes; static-check chain reads each `config.quality.*` and runs it; failing gate exits chain.
9. **Dogfood flow:utils-verify:** runs `format` + `lint` gates only; drift warning at bottom (consumes `maude doctor --json`).
10. **Dogfood flow:quick:** with staged file → only `format` + `lint`; no staged files → exits 0 silently.
11. **Dogfood release pre-flight:** simulate one failing gate → walker stops with failing command surfaced.
12. **SessionStart hook fires:** Claude Code session with hard dep missing → warning appears before first prompt.
13. **Cross-command short-circuit:** `/design:init` then `/design:new` → second command's bash log shows preflight skipped.
14. **Skeleton clean:** scaffolded skeleton validates under `maude doctor`; has NO `quality` block.
15. **Init re-run safety:** sandbox repo with hand-tuned `prohibited` + `quality.lint`, run `/flow:init`. Both preserved after Step 3.5; new detected gates ADD only.
16. **CLI surface check:** `node cli/bin/maude.mjs --help` lists `doctor` alongside `init` / `config` / `design` / `version`. NO `quality` / `config validate` / `config diff` subcommands.
17. **Skill load:** `flow:quality-gates` skill auto-loads on relevant trigger phrases.
18. **Manual regression:** `maude init --dry-run` still works; existing `maude config show/get/set` unchanged.

---

## Scenario Coverage

Not applicable — pure CLI + plugin command changes, no UI surface.

---

## Acceptance Criteria

- [ ] All tasks completed in order (A1 → A28)
- [ ] Both `dependencies.json` files exist, schema-validated, list every dep surfaced in the audit (~9 CLI + 3 MCP + 11 npm = 23 entries for design; 2 CLI for flow + shared)
- [ ] `maude doctor` available as top-level subcommand; reports deps + schema + drift + quality in unified report; supports `--plugin` / `--fix` / `--json`; exit code reflects hard-dep or schema-error presence
- [ ] **No `maude quality run`, `quality list`, `quality check`, `maude config validate`, or `maude config diff` exists** — single command (`maude doctor`) handles all health concerns; slash commands read `config.quality.*` directly via `jq` and execute via `eval`. CLI surface stays minimal.
- [ ] `flow:quality-gates` skill exists as ~50-line reference (data shape + read pattern + missing-gate behavior); auto-loads on relevant trigger phrases
- [ ] `/design:init` and `/flow:init` source from manifest; no hardcoded `command -v` chain
- [ ] `_preflight.json` cache shortcuts repeated checks within 5 min
- [ ] SessionStart hook prints actionable warning when hard deps missing
- [ ] `/flow:init` re-run is drift-aware (Step 3.5); never clobbers user-tuned non-stack values; merges newly-detected quality gates additively (set-if-absent)
- [ ] `/flow:validate` blocks on `maude doctor` schema errors (Step 0.5) AND on any failing `config.quality.*` gate
- [ ] `/flow:utils-verify` emits soft drift warning; runs `config.quality.format` + `config.quality.lint` (only those two)
- [ ] `/flow:done` quality gates flow through `/flow:validate` (single source of truth)
- [ ] `/flow:quick` runs `format` + `lint` on staged files only
- [ ] `.ai/release-guide.md` pre-flight calls `maude doctor` (schema gate) then iterates `config.quality` via `eval`; blocks walker on any failure
- [ ] This repo's `.ai/workflows.config.json` passes `maude doctor` with zero issues AND has a `quality` block with all 5 conventional gates
- [ ] Schema skeleton passes `maude doctor`; `quality` block ABSENT (skeleton bias-free per DDR-043 spirit; detector fills via `--fix`)
- [ ] Ajv + dep schemas bundled in published npm package (verified via `npm pack --dry-run`)
- [ ] Unit tests cover: stack-detect (7+ fixtures incl. quality detection), config-lint (6 fixtures incl. enum + non-string `quality.<gate>`), doctor command (7+ cases — healthy / dep-missing / schema-error / drift / additions / --fix / --json), preflight lib
- [ ] README + CLAUDE.md + `maude --help` document `maude doctor`; NO mention of `maude quality run`, `maude config validate`, or `maude config diff`
- [ ] DDR-053 written (verify number not taken at impl time); CLAUDE.md links it
- [ ] Version bumped via `scripts/bump-version.sh minor` (new feature)
- [ ] **Outcome metric:** after Phase A ships and is in active use, the rate of `chore(lint): biome ...` emergency cleanup commits drops to <1/quarter (today's baseline: 6/month, see `biome-recurring-failures-review.md`)

---

## Decisions to record

- DDR-053 (this plan): `maude doctor` as unified workspace diagnostic + `quality` flat-map declaration + no-wrapper-over-pnpm. 047 through 052 are taken at impl time (052 = hub hocuspocus/partykit, shipped in `41d9ad9`).
- Maybe DDR-054: SessionStart hook policy (warn-only vs blocking) once we observe how often users actually act on the warning.

---

## Estimated effort

~2 weeks of focused work. ~28 commits. Group into 5 PRs:

1. **Foundation:** A1+A2 (dep manifests + schema) + A5 (ajv dep) + A6+A7 (stack-detect) + A8+A9 (config-lint) + A10 (quality schema extension).
2. **Detection libs + doctor:** A3+A4 (preflight) + A11+A12+A13 (doctor command + tests + dispatcher).
3. **Init wiring + hooks:** A14+A15+A16 (init flows + preflight cache + SessionStart hook).
4. **Flow command bindings:** A17 (init drift-aware) + A18+A19+A20+A21+A22 (validate / utils-verify / skill / done / quick) + A23 (release-guide).
5. **Skeleton + dogfood + docs:** A24 (skeleton) + A25 (this repo) + A26 (package.json files) + A27 (docs) + A28 (DDR).

---

## Retro — PR 1+2 slice (A1–A13), 2026-05-27

**What worked.** The plan's "5 PR" decomposition held cleanly through the slice — A1-A10 stayed self-contained as the Foundation PR, A3-A4-A11-A12-A13 layered Doctor on top with zero cross-coupling. The Ajv-vs-string-suggestion duality the plan called out paid off: tests revealed that the schema's `tests:` field is a `description`-only enum, NOT a JSON Schema `enum` constraint, so the Levenshtein helper carries the suggestion duty alone for that specific key — caught at A9 test-write time, not at A25 dogfood time.

**What surprised.** (1) The bash detector's "no root tsconfig → language=javascript" branch was technically faithful but useless in this monorepo where every workspace has its own tsconfig. The plan's A6 said "port 1:1" but A25 expected `typescript` to be detected. Resolved with a workspace deep-scan extension (one level into `packages/*` + `apps/*` + `plugins/*` + `site` + `scripts`). The plan should declare deep-scan an intentional extension, not a 1:1 port. (2) DDR collision: by the time PR 1+2 landed, DDR-052 was claimed by the parallel hub workstream. The plan's "verify DDR number at impl time" hedge worked — A28 retargets to DDR-053 in the same edit. Worth amending future plans to NEVER hardcode a target number; always cite as "next free DDR" with a fixed slug.

**What to change next time.** The plan's "code-simplifier polish pass per task" guidance in `/flow:execute` was overhead-not-value for this slice: every CLI file was already under 250 LOC, already lint-clean after the initial write, and the simplifier rules would re-shuffle imports the same way biome's `organizeImports` already does. Worth carving an explicit "skip simplifier for new pure-data / new pure-CLI files under N LOC" rule into `/flow:execute` step 2.d so the next session doesn't pay the cost.

**What landed off-plan.** Plan A26 was deferred to PR 5 in original sequencing, but the packaging gap (`package.json` `files[]` not including dep manifests) had to land in this slice — otherwise `maude doctor` on a tarball install reports "manifest not found" and PR 5 wouldn't be testable in isolation. Folded into PR 1+2's commit; PR 5 task A26 can be marked done early.

**Cross-workstream surface.** A parallel `phase-9` hub slice landed `cli/commands/hub.mjs` + dispatcher / help wiring while PR 1+2 was in flight. Conflict surfaced at commit-time as a working-tree mid-air-collision: the hub session's edits to `maude.mjs` and `help.mjs` clobbered the doctor registration. Re-merge took 3 minutes (re-add `doctor` to dispatcher map + help text + examples block) but was avoidable: the plan should either lock those two files via a CODEOWNERS-style hint, or sequence dispatcher-touching tasks across phases through STATE.md's "active plan" rather than wall-clock interleaving.

## Retro — PR 3-5 slice (A14–A28), 2026-05-28

**What worked.** The PR 1+2 libs (`preflight.mjs`, `doctor.mjs`, `stack-detect`, `config-lint`) were clean seams to wire into — A14–A23 were almost entirely additive markdown + one ~25-line cache function, no lib changes. The `--json` envelope shape (`summary.{schemaErrors,driftCount,qualityAdditions}` + `config.{drift,qualityAdditions}[]`) was exactly what the slash-command bindings needed; no doctor changes required for A17/A18/A19.

**What surprised / changed from plan.** (1) **Two acceptance metrics were contradicted by reality and got reframed (with user steer).** The plan wanted "5 gates, zero drift" for this repo. But the detector permanently reports `tests: playwright` (false positive — `@playwright/test` is a video-smoke-only devDep), so `stack.tests` can never be both honest *and* drift-free → settled on `stack.tests: "unknown"` + a documented standing drift. And `quality.yml` runs **no** `tsc` step (the DDR-026 baseline is accepted), so a real `typecheck` gate would be permanently red and block `/flow:validate` → omitted on the principle **"gates = mirror CI."** The user's framing ("gates pro tohle repo mají zrcadlit CI") resolved both cleanly and produced 8 CI-mirroring gates (incl. custom `parity`/`tarball`/`tokens`/`site-content`) instead of the canonical 5. Future plans shouldn't assert "N gates / zero drift" as acceptance — assert "gates mirror the project's CI surface."  (2) **`hooks.json` location was wrong in the plan** — it specified top-level `plugins/<plugin>/hooks.json`; the location Claude Code actually loads is `plugins/<plugin>/hooks/hooks.json` (confirmed via claude-code-guide). (3) **A26 mis-scoped** — the plan wanted `hooks.json` in `package.json` `files[]`, but hooks are marketplace content (loaded from the git clone), not npm-runtime, so they're correctly excluded like `commands/`. Dep manifests ARE in `files[]` because `preflight.mjs` reads them at runtime. (4) **DDR collision again** — planned 053 was taken (hub admin auth), so did 054/055/056; retargeted to **057**. The plan's own "verify number at impl time" hedge saved it, but the lesson from PR 1+2's retro ("never hardcode a target number") bears repeating.

**What to change next time.** (1) **Process incident — self-inflicted.** During verification I ran `git checkout -- .` to drop a `biome format --write` artifact and it reverted **all 12 tracked-file edits** to HEAD (untracked new files survived). Recovered fully by reapplying every edit from conversation context, but it cost a round. Lesson now in practice: never broad `git checkout -- .` to clean format noise — scope to the specific file, or don't run `--write` formatters mid-task. (2) The `eval`-of-`config.quality` trust boundary deserved explicit treatment — added to DDR-057 (same model as `package.json` scripts; a malicious PR's gate runs on a maintainer's `/flow:validate`). Worth a one-line security note in the plan template for any "execute config-declared command" feature.

**What landed beyond plan.** Added a **Step 3.5 "custom quality gates"** loop to `/flow:validate` (runs any `config.quality.*` beyond the conventional five) so `/flow:validate` is a full local CI mirror — directly serving the stated goal of not chasing CI failures post-push. Not in the original task list; emerged from the "mirror CI" reframe.

## History

**2026-05-27** — this plan absorbs the former `phase-d-config-hardening.md`. Originally both Phase A (deps + preflight + `maude doctor`) and Phase D (config validation + drift + quality gates) independently specified a `maude doctor` command. Merging avoids:

- Two plans claiming `cli/commands/doctor.mjs` ownership.
- Two `--fix` / `--json` flag definitions.
- Phase A reserving DDR-047 (already shipped — bumped to DDR-053 in A28).
- Confusion between "deps health" and "config health" as user-mental-models — they're both "is my workspace OK?", one command, one answer.

The merge keeps Phase A's structural skeleton (8 Solution layers numbered through preflight + hooks) and folds Phase D's scope in as Layers 2, 7, and most of the new tasks (A6-A12, A17-A25). Slash command bindings (A18-A23) replace Phase D's Tasks 11-12d verbatim. Outcome metric (cleanup-commit rate) comes from Phase D's retro reference.

The deletion of `phase-d-config-hardening.md` is intentional — see git log for the final D-side content at commit (the one that lands this rewrite). Cross-references in `.ai/logs/system-reviews/biome-recurring-failures-review.md` are updated to point at this combined Phase A.
