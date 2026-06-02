# DDR-081 — Biome v1→v2 migration: `biome.jsonc`, v1-posture preservation, and a deferred lint-posture cleanup

> **Numbering note (2026-06-02):** `080` (`moodboard-direction-gate`) is the highest on this tree; **081 is the next free number**. If a side-branch lands an `081` first, renumber on merge (same convention as DDR-080's note).

**Status:** Accepted — 2026-06-02.
**Supersedes:** none.
**Related:** [DDR-026](DDR-026-tsc-baseline-accepted.md) (no `tsc` quality gate — biome + tests + build catch type regressions, so the v2 bump adds no typecheck surface), [DDR-043](DDR-043-bias-free-design-plugin-templates.md) (bias-free reference templates — the `design-system-inspiration/**/*.html` files biome v2's new HTML linter flagged are illustrative artifacts, not product code), [DDR-009](DDR-009-bun-runtime-authoritative-for-dev-server.md) (Bun runtime / committed runtime bundles — touched by the same sweep's motion regen). Instruments: `biome.jsonc`, `cli/lib/stack-detect.mjs`, `.changeset/motion-v12-runtime-bundles.md`, `.ai/plans/archive/dependency-freshness-biome-v2-motion-v12-migration.md`.

## Context

The dependabot `majors` group PR (#33, ex-#30) carried two breaking majors that failed CI's `Quality` gate for a real reason: `@biomejs/biome` 1.9.4 → 2.4.16 (breaking config format) and `motion` 11→12 (committed runtime bundles). Biome 2's `biome check` rejected the pinned-to-1.9.4 `biome.json` outright (`files.ignore` → `files.includes`, `organizeImports` → `assist`, new recommended rules). The migration had to land Biome v2 **green** without turning the dependency bump into a codebase-wide lint-posture overhaul.

Three structural facts shaped the decision:

1. **Biome v2 parses `biome.json` as strict JSON** — no comments. The plan explicitly called for per-rule justification comments, which strict JSON can't carry.
2. **`recommended: true` is a strictly larger set in v2** — promoted-from-nursery rules (`noStaticElementInteractions`, `noImportantStyles`, `noDescendingSpecificity`, `useIterableCallbackReturn`, …), stricter existing rules, **and brand-new experimental HTML linting**. The v1 tree was clean under v1's `recommended`; v2 surfaced 317 errors / 93 warnings, ~166 of them a11y errors in `.html` reference templates v1 never parsed.
3. **The project's existing posture is deliberately lenient** — `biome.json` already downgraded `noUnusedVariables`/`useNodejsImportProtocol` to `warn` and turned `noConsole` off. Adopting v2's stricter recommended wholesale would silently widen scope (the bias the plan's "out of scope: net-new lint rules beyond v2 defaults" clause forbids).

## Decision

Treat the upgrade as an **engine + config migration that preserves the v1 *effective* posture**, not a lint-strictness change. Specifically:

1. **`biome.json` → `biome.jsonc`.** Rename (git-tracked, history preserved) so JSONC comments can document every rule decision. Safe because the `biome` CLI auto-discovers either filename and `cli/lib/stack-detect.mjs` already probes both.
2. **Neutralize the net-new v2 rules to match v1**, with a per-rule justification comment, two tiers:
   - **`off`** for rules that conflict with *intentional* code and would be permanent noise: `noImportantStyles` + `noDescendingSpecificity` (hand-tuned CSS cascade — fumadocs overrides, a11y reduced-motion). Mirrors the existing `noConsole: off` posture.
   - **`warn`** for genuinely-deferrable cleanups (`useTemplate`, `noUnusedImports`, `useOptionalChain`, `noDelete`, `useIterableCallbackReturn`, `noArrayIndexKey`, `useExhaustiveDependencies`, `useIndexOf`, `noUselessFragments`). Warnings don't fail `biome check`, so the gate is green while the signal stays visible. Mirrors the existing `noUnusedVariables: warn` posture.
3. **Exclude `!**/*.html`** from `files.includes`. v2's experimental HTML linter is net-new scope v1 had no equivalent for; the repo's only HTML is the bias-free `design-system-inspiration` reference templates (DDR-043) + the server shell — never linted under v1.
4. **Scope a11y exemptions, don't disable globally.** The net-new a11y rules (`noStaticElementInteractions`, `useAriaPropsSupportedByRole`) fire on the bespoke canvas-chrome overlays — the exact category the pre-existing `comments-overlay.tsx` override already exempts. Extend that override (per-file `includes`) rather than downgrading a11y everywhere, so a11y stays enforced on real product UI. The **one real product-code finding** (`roadmap-timeline` glyph `<span>` → `role="img"`) was fixed, not exempted.
5. **Adopt v2's safe-fixable output** (`biome check --write`, no `--unsafe`): the import re-sort (v2's `assist` changed sort order) + 24 mechanical safe fixes across ~146 files. Unsafe/semantic fixes were NOT applied (avoids risky churn in dev-server hot paths).
6. **Defer the real cleanup.** The 52 residual `warn` findings are a separate **"tighten lint posture"** ticket — explicitly out of scope for a dependency bump (and the deferral is recorded in-config + here so the next contributor knows the warnings are intentional-with-a-plan, not rot).

## Consequences

- `pnpm lint` (= `biome check .`) is green: 411 files, 0 errors, 52 warnings. The `lint`/`format` quality gates resolve unchanged.
- Future contributors see 52 warnings on every lint run — acceptable noise in exchange for a non-blocking, visible cleanup backlog. The follow-up ticket re-enables them incrementally (`--unsafe` autofix where mechanical, hand-fix where semantic).
- Adding a *new* HTML file that genuinely wants linting now requires a deliberate `includes` un-exclusion — a feature, not a bug (forces the choice to be conscious).
- **Adjacent finding (not a decision — filed as follow-ups):** the same sweep's motion regen revealed the committed `dist/runtime/*.js` were stale **unminified dev builds** (#31 bumped react/yjs without regenerating); the release regen corrected them. And two dev-server footguns surfaced during validation — a running `maude design serve` **reset this repo's git index** to the parent commit (sync/git-lifecycle mutating the served repo's index), and `pnpm test:dev-server` **rewrites `dist/runtime/*.js` in dev mode**, clobbering committed release bundles. Both argue for: regenerate release bundles as the *last* step before commit, and keep no dev-server running during git operations. Worth a dedicated bug DDR if they recur.

## Alternatives considered

- **Keep `biome.json`, drop the comments.** Rejected — the plan wanted in-config justification, and undocumented `off`/`warn` rules read as unexplained rot.
- **Adopt v2's stricter `recommended` + fix all 124 lint findings.** Rejected — turns a dep bump into a codebase-wide refactor across dev-server hot paths (regression risk), and the plan scoped net-new rules out.
- **Disable HTML formatting/linting via an `html` toggle instead of `!**/*.html`.** Rejected — the path exclusion is the precise v1-scope restoration; an engine toggle is a broader, less legible lever.
