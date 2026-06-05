---
name: flow:quality-gates
category: shared
description: How flow commands read project quality gates from `.ai/workflows.config.json` → `quality`. Use when wiring or running a quality gate (lint, format, typecheck, tests, build), when a command needs the `config.quality` read pattern, or when a `lint script` / `tests script` / `format script` must run. Data-shape reference, NOT a runner.
user-invocable: false
---

# Quality Gates

Reference for the `quality` block in `.ai/workflows.config.json`. This skill documents a **data shape and a read pattern** — it is not an execution contract and defines no output format. The data IS a plain shell-command string; `eval` is the runner.

## 1. Shape — a flat map

`quality` is a flat map of gate name → shell-command string. No nesting, no per-gate object, no `order` array, no `scope`/`blocking` fields.

```jsonc
"quality": {
  "lint":      "pnpm lint",
  "format":    "pnpm biome format .",
  "typecheck": "pnpm exec tsc --noEmit -p apps/studio",
  "tests":     "pnpm test && pnpm test:dev-server",
  "build":     "pnpm --filter @maude/site build"
}
```

The block is **optional**. Populate it via `maude doctor --fix` (additive — never overwrites an existing user value).

## 2. Gate names

Conventional names: `lint`, `format`, `typecheck`, `tests`, `build`. These are conventions, not an enum — projects may add free-form gates (`accessibility`, `i18n`, …). Schema only enforces *value is a non-empty string*.

## 3. Read pattern (every consumer uses this)

```bash
LINT_CMD=$(jq -r '.quality.lint // empty' .ai/workflows.config.json)
if [[ -n "$LINT_CMD" ]]; then
  eval "$LINT_CMD" || { echo "::error::lint gate failed (\`$LINT_CMD\`)"; exit 1; }
else
  echo "⚠ quality.lint not declared — run \`maude doctor --fix\`"
fi
```

## 4. Missing gate → warn + skip, NEVER fabricate

If a gate key is absent, print a one-line warning pointing at `maude doctor --fix` and move on. Do not infer or invent a command. A declared gate that fails IS a blocker; an *undeclared* gate is not.

## 5. Which command reads which gate

| Command | Gates read | Posture |
| ------- | ---------- | ------- |
| `/flow:utils-verify` | `format`, `lint` | Blocker; missing → skip+warn |
| `/flow:quick` | `format`, `lint` (staged-only) | Blocker |
| `/flow:validate` | `format` → `lint` → `typecheck` → `tests` → `build` (in order, fail-fast) | All blocker |
| `/flow:done` | — delegates to `/flow:validate` | — |
| `.ai/release-guide.md` pre-flight | every entry in `config.quality` | Blocker |

Config never enforces ordering or blocking — that is the calling command's opinion. Schema health for the `quality` block (e.g. a non-string value) surfaces under `maude doctor`, not here.
