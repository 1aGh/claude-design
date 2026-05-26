# Phase D — `workflows.config.json` hardening: lint, drift detect, init re-run, validate gate

> **Pre-flight problem in our own repo (2026-05-26):** `.ai/workflows.config.json` declares `stack.language: "javascript"` (repo is TypeScript — `site/tsconfig.json` exists), `stack.framework: "none"` (no `none` in the framework enum docs; site is Next.js 16), `stack.tests: "node-test"` (not in schema enum — invalid), `stack.css: "none"` (site/ has CSS), `stack.router: "none"` (should be `next-app`). If we can't keep our own config honest, downstream users definitely can't. This phase fixes that — once for everyone.
>
> Scope: **config correctness + drift visibility, not new schema fields.** Schema stays largely the same; we add validation and re-detection plumbing around it.

---

## Description

Add four interlocking hardening layers on top of the existing `.ai/workflows.config.json` + schema:

1. **`maude config lint`** — validate against `config.schema.json` (Ajv), reject unknown fields, flag stale enum values, suggest fixes.
2. **`maude config diff`** — re-run the `/flow:init` stack detector, compare to declared values, print a drift table, optionally `--write` fixes.
3. **`/flow:init` re-run is drift-aware** — when `.ai/workflows.config.json` already exists, Step 4 doesn't blindly overwrite; it computes drift first and prompts per-key (keep / overwrite / skip).
4. **Wire into validation gates** — `lint` is a blocker in `/flow:validate`; `diff` is a soft warning in `/flow:utils-verify` (nudge, never block).

The schema (`plugins/flow/.claude-plugin/config.schema.json`) already exists and is rich. We just don't actually validate against it anywhere — IDE-only JSON Schema validation via `$schema` reference is opt-in and silent. This phase makes it teeth.

## User Story

As a developer working in a Maude-bootstrapped repo, I want `workflows.config.json` to be **automatically validated and kept in sync with the real stack**, so that flow commands route correctly (e.g. test runner choice, framework-aware preflight, density-per-platform) and downstream skills don't operate on a fictional snapshot of my project.

## Problem

Concrete cases this phase fixes:

1. **Schema drift is invisible.** Our own config has `tests: "node-test"` — not in the schema enum. No command catches this. `flow:testing-rules` silently treats it as `unknown` and degrades.
2. **Stack drift is invisible.** Repo migrated from JS → TS; nobody updated `stack.language`. `/flow:plan` and the skill-loader operate on the stale value. Same risk for any added framework, CSS approach, test runner, monorepo flag.
3. **`/flow:init` re-run is unsafe.** Step 1 (`maude init`) is idempotent (skips when `.ai/` exists). Step 4 (config setters) is destructive — it blindly overwrites with newly-detected values, including answers the user fine-tuned later (e.g. `prohibited: ["lodash"]` gets clobbered if the detector path runs with empty `$ANSWER_PROHIBITED`). Users learn not to re-run `/flow:init` after onboarding, which means stack changes never propagate.
4. **No validate-time gate.** `/flow:validate` runs lint/types/tests/build but never the structural check on its own config. A typo in `motion.micro` ("ms" suffix → string instead of integer) breaks `motion-rules` silently mid-feature.
5. **No discoverable "is my config OK" command.** Users have `maude config show / get / set` — no `lint` or `check` or `diff`. `maude doctor` (Phase A) covers install health, not config health.

## Solution

### Shape

| Layer | Where | What |
| ----- | ----- | ---- |
| 1. Schema lint | `cli/commands/config.mjs` adds `lint` subcommand (Ajv 2020-12) | Validate file against schema; print errors with JSON Pointer paths + suggestions; exit 1 on failure. `--fix` for trivial cases (drop unknown keys, fill missing defaults from schema). |
| 2. Stack drift | `cli/commands/config.mjs` adds `diff` subcommand; detector logic extracted to `cli/lib/stack-detect.mjs` (called by both `diff` and `/flow:init`) | Re-detect → compare → table. `--write` applies; `--json` for programmatic consumers. |
| 3. /flow:init re-run | `plugins/flow/commands/init.md` Step 4 gets a "config exists?" pre-check | When existing: compute drift, render diff table, ask `keep` / `overwrite per-key` / `skip propagation`. Default = keep. |
| 4. Validate gates | `plugins/flow/commands/validate.md` adds Step 0.5 (lint blocker); `plugins/flow/commands/utils-verify.md` adds soft drift warning | `lint` blocks. `diff` warns (single line, no prompt) — drift is a normal state mid-refactor; only block if explicitly stale. |

### Dependencies

- **Ajv** — `ajv@^8` + `ajv-formats@^3`. Adds ~150 KB to the npm package. Worth it — JSON Schema is the contract; we should validate it the same way external consumers (CI, IDE plugins) do. Bundled, no peer install on user side. Alternative considered: hand-rolled validator. Rejected — re-implements 90% of Ajv and gets enum diffs subtly wrong.
- **No other new deps.** Stack detector is pure `node:fs` reads + regex on lock files, same as `/flow:init` Step 2 already does (just extracted from bash to JS).

### Out of scope (deliberately)

- New schema fields. The existing schema covers everything we need.
- Auto-fixing stack values without confirmation. `--write` requires explicit flag; never silent.
- Migrating users from old enums (e.g. legacy `tests: "node-test"`). Lint flags it; the user picks the migration target. We don't guess what `node-test` was supposed to mean (Node's built-in `node --test`? Jest? Vitest pre-rename?).
- Pre-commit hook scaffold. User's choice of hook tool (husky / lefthook / simple-git-hooks) is too varied to scaffold; we document the one-line `maude config lint` command and let users wire it themselves.

## Metadata

- **GitHub Issue**: (none — internal hardening)
- **Type**: Enhancement + Refactor
- **Complexity**: Medium
- **App/Package**: `cli/` + `plugins/flow/`
- **Affected Systems**: `maude` CLI, `/flow:init`, `/flow:utils-verify`, `/flow:validate`
- **Dependencies**: `ajv@^8`, `ajv-formats@^3`

---

## Context References

### Must-Read Files

- `cli/commands/config.mjs` (full file, 100 lines) — Why: the new `lint` and `diff` subcommands live here; current shape is dispatcher → `loadConfig` / `saveConfig` / `setPath`. Same pattern for additions.
- `cli/commands/init.mjs` (full file, 179 lines) — Why: file-templating + idempotency precedent. The `maude init` CLI is already careful about `--force`; `/flow:init` re-run logic should match that posture.
- `plugins/flow/.claude-plugin/config.schema.json` (full file, 399 lines) — Why: the contract. Lint validates against this verbatim. Note: schema uses Draft 2020-12 — Ajv must be configured for it (`new Ajv2020()`).
- `plugins/flow/commands/init.md` (Step 2 lines 71–181, Step 4 lines 264–344) — Why: the bash detector that becomes `cli/lib/stack-detect.mjs`. Port logic 1:1, don't "improve" it during the move (separate concern).
- `plugins/flow/templates/ai-skeleton/workflows.config.json` (full file, 75 lines) — Why: the seed values. Schema-defaults injection in `lint --fix` must match this (don't introduce a third source of truth).
- `.ai/workflows.config.json` (this repo's config) — Why: our own canary. Plan must produce a working `lint` that fails meaningfully on the 5 existing drift items, and a `diff` that proposes the right fixes. End-to-end test = "run `maude config lint` against ourselves, get a useful report."
- `cli/bin/maude.mjs` (the dispatcher) — Why: register new subcommands here; check the existing pattern (likely a switch / map on `positional[0]`).

### Files to Create

- `cli/lib/stack-detect.mjs` — pure JS port of `/flow:init` Step 2 bash. Exports `detectStack(repoRoot) → { language, framework, packageManager, buildTool, monorepo, ci, tests, css, router }`. Reusable by `diff` and (eventually) by `/flow:init` if we want to drop the bash version.
- `cli/lib/stack-detect.test.mjs` — node:test fixtures: empty repo (all `unknown`), Next.js repo, Expo repo, monorepo with both. ~6 cases. Same style as `argv.test.mjs`.
- `cli/lib/config-lint.mjs` — exports `lintConfig({ config, schemaPath, repoRoot }) → { ok, errors: [{ path, message, suggestion? }], fixApplied? }`. Ajv-backed, plus a post-pass for enum suggestions (Levenshtein nearest-neighbor when the value is a string that doesn't match any enum).
- `cli/lib/config-lint.test.mjs` — fixtures: valid config, invalid enum value, unknown field, type mismatch, missing required (`name`).

### Documentation

- [Ajv 2020 docs](https://ajv.js.org/json-schema.html#draft-2020-12) — Why: schema uses `https://json-schema.org/draft/2020-12/schema`, default Ajv constructor is Draft-07. Must use `import Ajv from 'ajv/dist/2020.js'`.
- [JSON Schema enum validation](https://json-schema.org/understanding-json-schema/reference/generic.html#enumerated-values) — Why: Ajv reports `must be equal to one of the allowed values` but doesn't tell you which. We add a Levenshtein post-pass to suggest the closest enum entry. Reference for the error shape.

### Patterns to Follow

```js
// cli/lib/argv.test.mjs — the test style we match. node:test, no framework.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs } from './argv.mjs';

test('parseArgs — boolean flag', () => {
  const { flags } = parseArgs(['--force'], { booleans: ['force'] });
  assert.equal(flags.force, true);
});
```

```js
// cli/commands/config.mjs — the subcommand dispatcher style. Match exactly.
if (sub === 'show') { /* ... */ return; }
if (sub === 'get')  { /* ... */ return; }
if (sub === 'set')  { /* ... */ return; }
// Add:
if (sub === 'lint') { /* ... */ return; }
if (sub === 'diff') { /* ... */ return; }
```

---

## Design Decisions

> No UI surface — CLI output only. Tables rendered as ASCII (column-padded). No colors (no chalk dependency); use Unicode glyphs sparingly (`✓` / `✗` / `⚠` already used in `init.mjs`).

### CLI output shape (lint)

```
maude config lint

  .ai/workflows.config.json

  ✗ stack.tests
    value: "node-test"
    must be one of: vitest | jest | playwright | cypress | rspec | pytest | go-test | cargo-test | junit | none | unknown
    suggestion: "none" or "vitest" (closest match: "none")

  ✗ stack.language
    value: "javascript"
    schema: valid string, but stack.framework is "none" and tsconfig.json exists — likely should be "typescript"
    (drift-detect hint, not a schema error — run `maude config diff` for full stack drift)

  ⚠ stack.framework
    value: "none"
    schema: valid string; schema description lists enum but doesn't enforce — consider tightening

  2 errors, 1 warning. Run with --fix to drop unknown keys + restore schema defaults.
  Stack-related drift: run `maude config diff`.
```

### CLI output shape (diff)

```
maude config diff

  Detected vs declared in .ai/workflows.config.json:

  Key                    Declared          Detected         Status
  ─────────────────────  ────────────────  ───────────────  ─────────
  stack.language         javascript        typescript       drift
  stack.framework        none              next.js          drift
  stack.packageManager   pnpm              pnpm             ok
  stack.buildTool        none              none             ok
  stack.monorepo         true              true             ok
  stack.ci               github-actions    github-actions   ok
  stack.tests            node-test         (none-detected)  drift
  stack.css              none              (none-detected)  ok
  stack.router           none              next-app         drift

  4 drifts. Re-run with --write to apply detected values (declared values that
  the detector returned as "unknown" are NEVER overwritten — those are user edits).
```

### Lint enum-suggestion strategy

When the value is a string that fails the `enum` constraint, compute Levenshtein distance against every enum entry; suggest the top 1 if distance ≤ 3, top 2 if any tie. No suggestion for non-string mismatches (would just be noise).

### `--write` safety contract

`maude config diff --write` only writes keys where:

1. Detector returned a concrete value (not `"unknown"`).
2. Declared value disagrees.

Detector returning `"unknown"` while config has a real value = user knows something the detector doesn't (e.g. they configured a custom test runner). Never overwrite. Same rule applies to `/flow:init` re-run's per-key prompt.

---

## Tasks

Execute in order. Each task is atomic and testable.

### Task 1: ADD `ajv` + `ajv-formats` to package.json dependencies

- **Do**: `pnpm add ajv@^8 ajv-formats@^3` at repo root (the CLI is published from the root package).
- **Pattern**: existing deps are bundled — Ajv joins them. No `peerDependencies` games.
- **Gotcha**: `ajv/dist/2020.js` is the Draft-2020 entry. Default `import Ajv from 'ajv'` is Draft-07 and will silently accept schemas with `$schema: 2020-12` while skipping new keywords.
- **Validate**: `cat package.json | jq '.dependencies.ajv'` returns the installed version; `node -e "import('ajv/dist/2020.js').then(m => console.log(m.default))"` resolves.

### Task 2: CREATE `cli/lib/stack-detect.mjs` (port from `/flow:init` Step 2 bash)

- **Do**: Pure JS function `export async function detectStack(repoRoot) → StackSnapshot`. One detector per field (`detectLanguage`, `detectFramework`, …). Read-only filesystem (`node:fs/promises.stat` + `readFile` of `package.json` / lock files). Return `"unknown"` strings for any unresolved field — never throw.
- **Pattern**: mirror the order in `init.md` lines 71–181. Same heuristics, same precedence (e.g. `tsconfig.json` → `typescript` wins over presence of `package.json` → `javascript`).
- **Gotcha**: bash version uses `grep -q '"vitest"' package.json` — port as substring check on the raw file (NOT `JSON.parse` then key-lookup, because the bash version also matches `vitest` in scripts, not just devDeps; preserve that behavior).
- **Validate**: `node cli/lib/stack-detect.test.mjs` (after Task 3) — fixtures cover empty repo, Next.js app router, Expo, pnpm-workspace monorepo, all `unknown`.

### Task 3: CREATE `cli/lib/stack-detect.test.mjs` (fixtures + assertions)

- **Do**: `node:test`-driven. Use `os.tmpdir()` + `mkdtempSync` to scaffold throwaway fixtures: write `tsconfig.json` / `next.config.mjs` / `package.json` shells, run `detectStack(tmpDir)`, assert. Cleanup in `t.after`.
- **Pattern**: `cli/lib/argv.test.mjs` is the reference.
- **Gotcha**: don't use real repo paths — tests must be hermetic and runnable in CI without checkouts of fixture projects.
- **Validate**: `node --test cli/lib/stack-detect.test.mjs` passes all cases.

### Task 4: CREATE `cli/lib/config-lint.mjs` (Ajv + enum-suggestion post-pass)

- **Do**: `export async function lintConfig({ configPath, schemaPath })`. Load both, instantiate `new Ajv2020({ allErrors: true, strict: false })`, add formats, compile schema once, validate. On failure, map Ajv errors to `{ path, message, suggestion? }`. For `enum` errors on string fields, compute Levenshtein vs each allowed value; attach `suggestion` if min distance ≤ 3.
- **Pattern**: keep the function pure — no I/O for output. `cli/commands/config.mjs` does the formatting. This makes testing trivial (pass in JSON, get errors back).
- **Gotcha**: schema has `additionalProperties: false` at multiple levels. Ajv reports these as `must NOT have additional properties` with `params.additionalProperty`. Surface the property name in the message — it's the most useful piece.
- **Validate**: `node --test cli/lib/config-lint.test.mjs` — fixtures: (a) valid skeleton config, (b) invalid enum (`tests: "node-test"`), (c) unknown field (`stack.foo: 1`), (d) type mismatch (`motion.micro: "300ms"`), (e) missing `name`. Each fixture asserts the expected error count and at least one `suggestion` for the enum case.

### Task 5: CREATE `cli/lib/config-lint.test.mjs`

- **Do**: As above; 5 cases. Use inline JSON literals (don't write files for these — pass `config` and `schema` objects directly into a `lintConfig` variant that accepts pre-loaded objects).
- **Pattern**: Refactor `lintConfig` to accept either `{ configPath, schemaPath }` (CLI use) or `{ config, schema }` (test use). Same internal logic.
- **Gotcha**: Levenshtein implementation is trivial; inline it in `config-lint.mjs` rather than adding `fastest-levenshtein` dep. ~15 lines.
- **Validate**: `node --test cli/lib/config-lint.test.mjs` passes.

### Task 6: UPDATE `cli/commands/config.mjs` — add `lint` subcommand

- **Do**: Add `if (sub === 'lint') { ... }` branch. Resolve schema path (bundled in npm package: `plugins/flow/.claude-plugin/config.schema.json` relative to `pkgRoot`). Call `lintConfig`. Format output as in Design Decisions. Support `--fix` flag (drops Ajv-detected unknown properties + fills missing keys from schema defaults). Exit 0 on success, 1 on errors, 0 on warnings-only.
- **Pattern**: `cli/commands/config.mjs` already imports `parseArgs` — extend with `booleans: ['fix']`.
- **Gotcha**: `pkgRoot` is plumbed through `run({ args, pkgRoot })` from `cli/bin/maude.mjs`. Use it — don't compute relative to `import.meta.url` (this CLI is also distributed via `bun --compile` standalone binaries per DDR-045; relative-to-import paths break inside `/$bunfs/root`).
- **Validate**: `node cli/bin/maude.mjs config lint` from this repo. Expected: 1+ errors (we have `tests: "node-test"`), exit 1. Then add `--fix` and re-check — should drop drift-detected keys but NOT touch `tests` (no schema default to substitute; user-decision required).

### Task 7: UPDATE `cli/commands/config.mjs` — add `diff` subcommand

- **Do**: Add `if (sub === 'diff') { ... }` branch. Call `detectStack(process.cwd())`, load current config, compute per-key diff for the `stack.*` subtree. Render the table from Design Decisions. Support `--write` and `--json`. `--write` only applies detected values where detector returned non-`"unknown"`.
- **Pattern**: same dispatcher shape as `lint`.
- **Gotcha**: `--write` must preserve formatting of unchanged keys. Re-use `saveConfig` (existing in `config.mjs`) — it does `JSON.stringify(..., 2)` which is already the file's canonical form.
- **Validate**: `node cli/bin/maude.mjs config diff` from this repo. Expected output: 4 drifts (language, framework, tests, router) matching the table in Design Decisions. `--write` applies the 4 changes; re-running shows `0 drifts`.

### Task 8: UPDATE `cli/commands/config.mjs` — refresh `usage()` text

- **Do**: Add `lint` + `diff` lines with their flags.
- **Pattern**: existing usage block, same indentation.
- **Validate**: `node cli/bin/maude.mjs config help` shows the new lines.

### Task 9: UPDATE `cli/bin/maude.mjs` (if it dispatches subcommands explicitly)

- **Do**: Inspect; if it maps subcommand names → modules, no change needed (lint/diff are inside `config.mjs`). If it explicitly lists known subcommands for error messages, ensure `lint` / `diff` appear in the "unknown subcommand" suggestion.
- **Pattern**: keep aligned with how `show`/`get`/`set` are presented today.
- **Validate**: `node cli/bin/maude.mjs config wat` prints a useful error mentioning the new subcommands.

### Task 10: UPDATE `plugins/flow/commands/init.md` — Step 4 becomes drift-aware

- **Do**: Add a Step 3.5 "Re-run detection? Diff?" check **before** Step 4 propagation:

  ```
  ## Step 3.5: Drift check (only when re-running on existing config)

  > Skip if `.ai/workflows.config.json` did not exist before Step 1 (`maude init`
  > just created it from skeleton; no drift possible yet).

  Run `maude config diff --json` and parse the output. For each `drift` row:

  - If declared == "unknown" / "" / null: silently apply detected (no prompt — there's
    no user choice to clobber).
  - If declared != detected and detector returned a concrete value: ask the user
    `keep declared <X> | apply detected <Y> | skip this key`. Default = keep.

  Apply chosen overrides via `maude config set`. This replaces the unconditional
  Step 4 propagation when a pre-existing config is found; otherwise Step 4 runs
  as today (greenfield write of all values).
  ```

- **Pattern**: mirror existing Step 4's `maude config set` calls — same key paths, but only fire for keys the user said `apply detected` for.
- **Gotcha**: `prohibited`, `boundaries`, motion ceilings, density map are **never** in the drift list (detector doesn't touch them). Step 3.5 is stack-only. Reinforce in the prose so the user doesn't fear `/flow:init` re-run will eat their tuned values.
- **Validate**: Run `/flow:init` in this repo (already has config). Expected: Step 3.5 fires, prompts about language/framework/tests/router, leaves `prohibited` / `boundaries` / `motion` untouched.

### Task 11: UPDATE `plugins/flow/commands/validate.md` — add `config lint` as Step 0.5 (blocker)

- **Do**: Insert before existing static checks: `Step 0.5: maude config lint` — run, parse exit code. On exit 1 (schema errors), block validate with a one-line summary + "run `maude config lint --fix` or `maude config diff --write`". On warnings-only, print and continue.
- **Pattern**: existing Step 0/1 (lint/types) — same posture: blocker on failure, no auto-fix in validate context.
- **Gotcha**: don't call `--fix` from validate. Validate is a gate; auto-fixing schema-invalid configs in a gate is the kind of "helpful" thing that surprises users.
- **Validate**: Run `/flow:validate` in this repo with the current invalid config — should block at Step 0.5 with the `tests: "node-test"` error. Fix the config; re-run; should pass through.

### Task 12: UPDATE `plugins/flow/commands/utils-verify.md` — add soft drift warning

- **Do**: Add a final step: `maude config diff --json` (no `--write`); if drift count > 0, print a one-line warning:
  ```
  ⚠ stack drift: <N> keys differ from detected stack. Run `maude config diff` to
    review, `maude config diff --write` to apply. Not blocking.
  ```
- **Pattern**: existing utils-verify warnings (a11y soft pass, etc.) — same line shape.
- **Gotcha**: this is a *nudge*, never a blocker. Drift is normal mid-refactor (e.g. user just added Tailwind, hasn't run `/flow:init` re-run yet). Blocking here would be obnoxious.
- **Validate**: Run `/flow:utils-verify`; expect the warning line at the bottom of the report.

### Task 13: UPDATE `plugins/flow/templates/ai-skeleton/workflows.config.json` — sanity-check skeleton is lint-clean

- **Do**: Run `maude config lint` against the skeleton (with a synthetic `name`). Fix any drift between skeleton and current schema. Expected: zero errors today after Phase 1 of schema work was completed; this is a regression guard step.
- **Pattern**: schema is the contract; skeleton must validate.
- **Validate**: copy skeleton to `/tmp/x.json`, replace `PROJECT_NAME` with `x`, `node cli/bin/maude.mjs config lint` in that tmp dir → 0 errors.

### Task 14: UPDATE `.ai/workflows.config.json` (this repo's config) — fix the 4 detected drifts

- **Do**: Run `maude config diff --write` against this repo. Apply: `stack.language: typescript`, `stack.framework: next.js`, `stack.router: next-app`. Manually decide on `stack.tests` (`node-test` is invalid — we use `bun:test` for dev-server and `node:test` for CLI; pick `none` and document in a DDR if no single canonical runner applies).
- **Pattern**: same edits a downstream user would make. Eat our own dogfood.
- **Gotcha**: `stack.tests` is the one detector can't auto-pick because the repo has multiple. Make a manual call; record in `.ai/decisions/`.
- **Validate**: `maude config lint` exits 0; `maude config diff` shows zero drifts.

### Task 15: UPDATE `package.json` `files` field — ensure schema ships

- **Do**: Verify `plugins/flow/.claude-plugin/config.schema.json` is in `files` (or `plugins/flow/.claude-plugin/` as a whole). The CLI needs it at runtime to lint. If missing, add the explicit path.
- **Pattern**: CLAUDE.md says `package.json` `files` is intentionally minimal — extend with care.
- **Validate**: `npm pack --dry-run | grep config.schema.json` confirms the schema is included in the tarball.

### Task 16: UPDATE `README.md` and `cli/commands/help.mjs` — document `config lint` + `config diff`

- **Do**: One paragraph in README under the CLI section: "Validate and re-detect: `maude config lint` + `maude config diff`. Run after stack changes or before opening a PR." Also add to `cli/commands/help.mjs` output if it enumerates subcommands.
- **Pattern**: existing CLI doc blocks.
- **Validate**: `grep -E 'config (lint|diff)' README.md cli/commands/help.mjs` returns matches.

---

## Validation

Run these commands to confirm zero regressions:

1. **Unit tests**: `node --test cli/lib/stack-detect.test.mjs cli/lib/config-lint.test.mjs cli/lib/argv.test.mjs cli/lib/update-check.test.mjs` — all green.
2. **Dogfood lint**: `node cli/bin/maude.mjs config lint` — exits 0 after Task 14.
3. **Dogfood diff**: `node cli/bin/maude.mjs config diff` — `0 drifts` after Task 14.
4. **Dogfood validate**: `/flow:validate` — Step 0.5 passes.
5. **Skeleton lint**: scaffolded skeleton (Task 13 fixture) validates cleanly.
6. **Init re-run safety**: in a sandbox repo with a hand-tuned `prohibited: ["lodash"]`, run `/flow:init`. Confirm `prohibited` is untouched after Step 3.5.
7. **Manual regression**: `maude init --dry-run` still works (no Ajv dependency leakage into init flow); existing `maude config show/get/set` unchanged.

---

## Scenario Coverage

> Not applicable — pure CLI + plugin command changes, no UI surface.

---

## Acceptance Criteria

- [ ] All 16 tasks completed in order
- [ ] `maude config lint` available; validates against schema; suggests enum fixes; supports `--fix`
- [ ] `maude config diff` available; re-detects stack; renders drift table; supports `--write` + `--json`; never overwrites concrete values with detector `"unknown"`
- [ ] `/flow:init` re-run is drift-aware (Step 3.5); never clobbers user-tuned non-stack values
- [ ] `/flow:validate` blocks on `config lint` failures
- [ ] `/flow:utils-verify` emits soft drift warning when applicable
- [ ] This repo's `.ai/workflows.config.json` passes lint with zero errors
- [ ] Schema skeleton (`plugins/flow/templates/ai-skeleton/workflows.config.json`) passes lint
- [ ] Ajv schema bundled in published npm package (verified via `npm pack --dry-run`)
- [ ] Unit tests cover: stack-detect (5+ fixtures), config-lint (5 fixtures incl. enum suggestion)
- [ ] README + `maude config help` document the new subcommands
- [ ] DDR recorded for any non-obvious decision (e.g. `stack.tests` for this repo)
- [ ] No regressions in existing `maude init`, `maude config show/get/set` flows
