# Phase 19 — Dev-server first-boot bootstrap fixes

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports.

## Description

Source: `.ai/logs/system-reviews/maude-dev-server-bootstrap-review.md` (2026-05-25).

The end-to-end design-system bootstrap flow (Stage 0 → research → Stage 3 → scaffold → critics) works — landed at aspiration 4.3/5 on a niche brief. But the **first-boot dev-server experience on a fresh marketplace-cache install is broken**: three independent packaging/runtime gaps cause `/design:browse` to serve an empty page and `bun run build.ts` to crash. All three are one-line fixes upstream; together they block every new user who installs the plugin via the Claude Code marketplace (which clones the repo and respects `.gitignore`, so `dist/` and `node_modules/` arrive empty even though they're listed in `package.json#files` for npm).

This phase ships the seven UPSTREAM-N actions from the review: P0 packaging+robustness (1, 2), P1 startup self-heal (3), P2 runtime-bundle diagnostics (4), P2 TSX-era screenshot helper (5), P2 AskUserQuestion fallback docs (6), P3 single-DS name-convention resolution (7).

## User Story

As a **new Maude user who just installed the plugin via `/plugin marketplace add 1aGh/maude`**, I want `/design:setup-ds project → /design:browse` to render the canvas browser end-to-end without me needing to hand-run `bun install`, copy artifacts out of a separate npm install, or read a system-review document, **so that** the documented happy path works on a clean machine the first time.

## Problem

After `/plugin marketplace add 1aGh/maude`, the install lands in `~/.claude/plugins/cache/maude/design/<version>/` via git clone. That tree honors `.gitignore`, which excludes:

- `plugins/design/dev-server/dist/` — has `client.bundle.js`, `styles.css`, per-platform compiled `maude-*` binaries
- `plugins/design/dev-server/node_modules/` — has `react`, `react-dom`, oxc-parser binding, etc.

The dev-server then:

1. **404s on `/_client/client.bundle.js` and `/_client/styles.css`** (`http.ts:437-443` resolves against `DIST_DIR` first, falls through to raw source `client/` which has `.jsx` not bundled `.js`) → user sees an empty page.
2. **`bun run build.ts` crashes with `ENOENT: '/Users/.../cache/maude/package.json'`** because `build.ts:73-74` does `Bun.file(join(ROOT, '..', '..', '..', 'package.json'))` — three levels up from `dev-server/` lands at the marketplace cache root in a cache install (the maude repo isn't a package there, it's a flat content drop).
3. **`/_canvas-runtime/react-dom_client.js → 500 EISDIR`** because `runtime-bundle.ts` spawns `Bun.build` with a synthetic entrypoint anchored in `dev-server/`, expecting `react` to resolve via `dev-server/node_modules/`. Cache install has no `node_modules`; Bun falls back to its global install cache which (on at least one user's machine) had a half-written entry where `react@19.x/index.js` was a directory, surfacing as a barely-actionable 500.

Additionally:

- **AskUserQuestion can be unavailable at runtime** (don't-ask mode, permission denial). Stages 0/3 of the design-system skill spec it without a documented fallback — a future skill author baking in a hard dependency could dead-end the flow.
- **Visual-sanity screenshot step assumes HTML-era specimens.** TSX scaffolds need the dev-server to compile JSX; `screenshot.sh --url file://…tsx` silently no-ops.
- **Single-DS `<name>` convention** has spec tension: `setup-ds.md` says "literal `project` is the conventional default" but elsewhere requires `<name>` as a kebab-case slug. Completeness-critic flagged this as a blocker (C2) when user passed an explicit name matching the repo basename.

## Solution

Seven discrete fixes, executed in dependency order. P0 + P1 land the cache-install happy path; P2/P3 are robustness + docs.

| # | Priority | Fix |
|---|----------|-----|
| 1 | P0 | Make `dist/` and a production-only `node_modules/` subtree available in marketplace installs. Two viable mechanisms (pick one in Task 1): (a) **untrack** `plugins/design/dev-server/dist/{client.bundle.js,styles.css}` from `.gitignore` and commit them as build outputs (mirror the `site/lib/roadmap.json` pattern already used for Vercel); (b) **bundle React + react-dom into `client.bundle.js`** so the cache install doesn't need a separate `node_modules`. (a) is simpler but enlarges every commit by ~270 KB; (b) is cleaner but needs a runtime-bundle rewrite. Recommend (a) for `client.bundle.js`+`styles.css`, plus **Task 3 self-heal** for the runtime-bundle gap (which needs `react` resolvable somewhere). |
| 2 | P0 | `build.ts:73-74` — wrap the `Bun.file(…/package.json).text()` read in try/catch, default to `{ version: 'dev' }`. Better: rewrite the path to `join(ROOT, '..', 'package.json')` — `plugins/design/package.json` does ship in every install (it's the plugin manifest). Even better: inline the version at build time via Bun's `define`. |
| 3 | P1 | On `server.ts` boot, check `dist/client.bundle.js` exists AND that `node_modules/react/package.json` resolves (or that `runtime-bundle.ts` can resolve `react` via `import.meta.resolve`). If either is missing, print a one-line diagnostic AND auto-run `bun install --production` + `bun run build.ts`. Gate behind `MAUDE_NO_AUTOBUILD=1` env flag for users who want to opt out. |
| 4 | P2 | `runtime-bundle.ts` — wrap the `Bun.build` call in try/catch, detect `EISDIR`/`ENOENT` referring to Bun's global cache, emit `"Bun's global package cache for <pkg>@<v> is in a bad state. Run `bun pm cache rm <pkg>` and reload the page."` |
| 5 | P2 | `screenshot.sh` + `SKILL.md` Visual sanity step — when source is `.tsx`, require the dev-server URL pathway (`http://localhost:PORT/_canvas-shell.html?canvas=…`) instead of `file://`. Add an early branch in `screenshot.sh` that detects `.tsx` and either errors out cleanly or auto-resolves via `_server.json`. Update SKILL.md to acknowledge the TSX-era requirement. |
| 6 | P2 | `setup-ds.md` + `SKILL.md` Discovery section — document the fallback: "If AskUserQuestion is unavailable (don't-ask mode, permission denial), Stage 0 + Stage 3 batches fall back to numbered-prose chat messages." Add a copy-paste prose template per stage. |
| 7 | P3 | `setup-ds.md` Arguments section + `SKILL.md` Detect-target section — resolve the convention tension. Decided default: warn at name-validation time if `<name>` matches the repo basename, suggest `project` as the alternative; otherwise honor `<name>` and produce `system/<name>/` without re-routing through the convention. Critics' C2 dirname check should consult the same rule. |

## Metadata

- **GitHub Issue**: (none yet — opens as part of this phase)
- **Source document**: `.ai/logs/system-reviews/maude-dev-server-bootstrap-review.md`
- **Type**: Bug Fix (1-3) + Enhancement (4-7)
- **Complexity**: High
- **App/Package**: `plugins/design` (dev-server, commands, skills); root `.gitignore`; `package.json#files`
- **Affected Systems**: Marketplace install path, npm install path, Bun runtime bundle pipeline, screenshot helper, design-system skill discovery flow
- **Dependencies**: None new. Existing: Bun ≥ 1.3, agent-browser (for screenshot), npm marketplace install mechanism (out-of-repo behavior we must accommodate)
- **Related DDRs**: DDR-009 (Bun runtime authoritative), DDR-019 (per-iframe runtime bundles), DDR-025 (canvas-lib single source), DDR-033 (3-stage discovery)
- **Will likely need new DDR**: "Marketplace install vs npm install — what ships, what auto-builds" (decided in Task 1)

---

## Context References

### Must-Read Files

- `plugins/design/dev-server/server.ts` (1–110) — Bun.serve entry; the right place for the boot self-heal hook
- `plugins/design/dev-server/build.ts` (60–105) — `buildClient()` with the brittle `../../../package.json` read at line 73-74; also has the oxc cross-compile fetcher (lines 153-180) that already pulls bindings on-demand — a good reference pattern for Task 3 self-heal
- `plugins/design/dev-server/http.ts` (425–450) — `/_client/*` route; resolves `DIST_DIR` first, falls through to `CLIENT_DIR`. The boot self-heal must run before this route handles the first request.
- `plugins/design/dev-server/runtime-bundle.ts` (1–80) — synthetic Bun.build entrypoint that resolves `react` via `dev-server/node_modules/`; the try/catch for Task 4 wraps the `Bun.build(…)` call
- `plugins/design/dev-server/package.json` — `dependencies` vs `devDependencies` split; react + react-dom are currently in `devDependencies`. Task 3 self-heal needs `bun install --production` to pull them, OR they need to move into `dependencies` so `--production` keeps them.
- `package.json` (root, `files` field lines 60-68) — only `plugins/design/dev-server` listed as a directory. npm packs descendants per .gitignore unless overridden by `files`. **`files` overrides `.gitignore` for explicitly listed directories** (we verified via `npm pack --dry-run`: `dist/client.bundle.js` IS in the npm tarball). The bug is marketplace install ≠ npm install; marketplace is a git clone.
- `.gitignore` — currently has `plugins/design/dev-server/dist/`. Task 1a removes specific entries (`client.bundle.js`, `styles.css`) while keeping the compiled binaries (~70-120 MB each) gitignored.
- `plugins/design/dev-server/bin/screenshot.sh` (1–80) — current arg parser; Task 5 adds `.tsx` detection branch
- `plugins/design/skills/design-system/SKILL.md` — Visual-sanity step (Task 5 docs update) + Discovery section (Task 6 fallback docs) + Detect-target section (Task 7)
- `plugins/design/commands/setup-ds.md` — Arguments section (Task 7 name-validation rule) + pre-flight check (Task 6 AskUserQuestion probe)
- `plugins/design/agents/design-system-completeness-critic.md` — C2 dirname check; update to honor the Task 7 rule
- `cli/install.cjs` — already runs as `postinstall`; consider whether the build-binary auto-fetch belongs here too (vs the boot self-heal in `server.ts`)
- Recent commit `80bd9de` (`fix(dev-server): auto-fetch oxc binding for cross-compile targets`) — establishes the precedent for runtime artifact fetching. Pattern to mirror in Task 3.

### Files to Create

- `.ai/archive/decisions/DDR-034-marketplace-install-vs-npm-install-artifact-strategy.md` — record the Task 1 decision (untrack `client.bundle.js`+`styles.css`, leave per-platform binaries gitignored, self-heal node_modules at boot)
- `plugins/design/dev-server/test/boot-self-heal.test.ts` — `bun:test` covering the Task 3 startup check (missing dist → builds; missing node_modules → installs; `MAUDE_NO_AUTOBUILD=1` → skips with explicit warning)
- `plugins/design/dev-server/test/runtime-bundle-error-mapping.test.ts` — Task 4 error-mapping unit test (mock EISDIR from Bun.build, assert human-readable message + remediation command)

### Documentation

- [DDR-009 — Bun runtime authoritative](.ai/archive/decisions/DDR-009-bun-runtime-authoritative-for-dev-server.md) — Why: confirms server.ts is the canonical entry. `server.mjs` is legacy; do not add new logic there.
- [DDR-019 — per-iframe runtime bundles](.ai/archive/decisions/DDR-019-per-iframe-runtime-bundles.md) — Why: explains why `/_canvas-runtime/*` lazy-builds react instead of shipping it pre-bundled. Constrains Task 1's bundling-React-into-client.bundle.js option.
- [npm `files` field semantics](https://docs.npmjs.com/cli/v10/configuring-npm/package-json#files) — Why: confirms `files` includes everything under listed directories regardless of `.gitignore`; relevant to Task 1 mechanism choice.
- [Bun.spawn](https://bun.com/docs/api/spawn) — Why: Task 3 self-heal needs to invoke `bun install` + `bun run build.ts`; prefer `Bun.spawn` over `child_process.spawn` per DDR-009.

### Patterns to Follow

**Self-heal at startup with env-flag bypass** — mirror the oxc cross-compile fetcher in `build.ts:153-180`:

```ts
// build.ts:153 (existing pattern — Task 3 mirrors this shape)
const bindingDir = join(ROOT, 'node_modules', '@oxc-parser', `binding-${oxcSlug}`);
if (!existsSync(bindingDir)) {
  // pulls the package on demand from the user's npm registry
  …
}
```

**Project-root-vs-plugin-root path resolution** — `server.mjs:24-28` documents the canonical pattern:

```ts
// Never uses __dirname — the plugin can be installed centrally and serve any repo.
function resolveRepoRoot() {
  const i = process.argv.indexOf('--root');
  if (i !== -1 && process.argv[i + 1]) return path.resolve(process.argv[i + 1]);
  if (process.env.CLAUDE_PROJECT_DIR) return path.resolve(process.env.CLAUDE_PROJECT_DIR);
  return process.cwd();
}
```

Task 2 fixes the inverse mistake: `build.ts:73` reaches OUT of the plugin tree into "the parent npm package", which doesn't exist in a marketplace install. The fix is to stay inside `plugins/design/` (where `plugin.json` is the manifest of record).

**Numbered-prose AskUserQuestion fallback** — already used informally in the system-review session. Task 6 codifies:

```markdown
# Numbered-prose fallback for Stage 0 scope picker

> AskUserQuestion is unavailable in this session (don't-ask mode or permission denial).
> Please reply with one line containing your choice:

  1. New design system (first one in this project)
  2. Additional DS alongside existing ones
  3. Re-bootstrap an existing DS

Reply: `1` or `2` or `3`.
```

**File-pattern detection in shell helpers** — `screenshot.sh` currently does `case "$1" in --screen|...)`. Task 5 adds a URL/path branch that inspects the resolved file extension:

```bash
# Pseudo-snippet — Task 5
if [[ "$URL" == file://*.tsx ]]; then
  echo "screenshot.sh: TSX specimens require the dev-server (file:// won't compile JSX)." >&2
  echo "  Hint: ensure the dev-server is running, then use --port instead of --url" >&2
  exit 2
fi
```

---

## Design Decisions

> This phase is server-infra + docs. No UI components, no design-system tokens. Section preserved for completeness.

### Components (from registry)

| Component | Source | Notes |
|-----------|--------|-------|
| (none) | — | Infra phase; no UI delta |

### Existing screens / blocks reused

(none)

### Icons

(none)

### Tokens

(none)

### Custom Components Needed

(none)

---

## Tasks

Execute in dependency order. P0 first (Tasks 1, 2, 3 unblock the happy path), then P2/P3 polish (Tasks 4-7).

Each task is atomic and testable. After each one, run `/flow:utils-verify` per the Edit-Verify Loop.

### Task 1: DECIDE artifact-distribution strategy + UPDATE `.gitignore`

- **Do**: Decide between (a) commit `client.bundle.js`+`styles.css` to git (recommended) vs (b) bundle React into client.bundle.js so node_modules isn't needed at runtime. Write **DDR-034** in `.ai/archive/decisions/` capturing the choice + rationale + alternatives rejected. Then edit `.gitignore`: change `plugins/design/dev-server/dist/` to explicitly preserve `client.bundle.js` and `styles.css` while keeping the per-platform `maude-*` binaries (~70-120 MB each) gitignored. Use the `!` negation pattern:
  ```
  plugins/design/dev-server/dist/
  !plugins/design/dev-server/dist/client.bundle.js
  !plugins/design/dev-server/dist/styles.css
  ```
- **Pattern**: `site/lib/roadmap.json` is the existing precedent — auto-generated artifact that IS committed because the consumer (Vercel for roadmap.json; marketplace cache install for client.bundle.js) cannot see the source it was generated from. Document this parallel in DDR-034.
- **Gotcha**: `npm pack` output already includes these — the change is purely about marketplace installs. Verify after change: `git status` shows the two files as new (commit them), `npm pack --dry-run` still lists them (no regression).
- **Validate**:
  ```sh
  pnpm --filter @maude/dev-server build
  git status plugins/design/dev-server/dist/   # → client.bundle.js + styles.css visible, maude-* still ignored
  npm pack --dry-run 2>&1 | grep -E "client.bundle.js|styles.css"   # still listed
  ```

### Task 2: FIX brittle package.json read in `build.ts`

- **Do**: `plugins/design/dev-server/build.ts` line 73-74. Change `join(ROOT, '..', '..', '..', 'package.json')` to `join(ROOT, '..', 'package.json')` so it reads `plugins/design/package.json` (the plugin manifest — always present in both npm and marketplace installs). If that file is also missing, fall back to `{ version: 'dev' }` via try/catch so build never aborts on a missing version embed.
- **Pattern**: Compare to `server.mjs:24-32` — the existing pattern for "resolve a path that works in any install layout."
- **Gotcha**: `plugins/design/package.json` doesn't exist today (we verified — only `plugins/design/dev-server/package.json` and `plugins/design/.claude-plugin/plugin.json` exist). Two options:
  - **(a)** Read `plugins/design/.claude-plugin/plugin.json` instead (`join(ROOT, '..', '.claude-plugin', 'plugin.json')`) — that file IS always present and has a `version` field. **Recommended.**
  - **(b)** Create `plugins/design/package.json` with `{ "name": "@maude/design-plugin", "version": "x.y.z", "private": true }` and add it to the version-bump script.
- **Validate**:
  ```sh
  cd plugins/design/dev-server && bun run build.ts --dry-run   # no ENOENT
  # Simulate marketplace install layout:
  cp -r plugins/design /tmp/maude-marketplace-sim/design && cd /tmp/maude-marketplace-sim/design/dev-server && bun run build.ts --dry-run   # still works
  ```

### Task 3: ADD boot self-heal in `server.ts` for missing `dist/` + `node_modules/`

- **Do**: At the top of `plugins/design/dev-server/server.ts` (after `createContext()` and before `Bun.serve`), add a pre-flight check:
  1. If `dist/client.bundle.js` doesn't exist AND `MAUDE_NO_AUTOBUILD !== '1'` → print `"  ⚠ first-boot: building client assets (one-time, ~2s)…"` then `await Bun.spawn(['bun', 'run', 'build.ts'], { cwd: HERE, stdio: 'inherit' })`.
  2. If `node_modules/react/package.json` doesn't resolve AND `MAUDE_NO_AUTOBUILD !== '1'` → print `"  ⚠ first-boot: installing runtime deps (one-time, ~15s)…"` then `await Bun.spawn(['bun', 'install', '--production'], { cwd: HERE, stdio: 'inherit' })`.
  3. If `MAUDE_NO_AUTOBUILD === '1'` and either check fails, print a one-line diagnostic with the remediation command and `process.exit(1)`.
- **Pattern**: Mirror `build.ts:153-180` (oxc cross-compile auto-fetcher) — same shape: detect missing artifact, log a single line, fix it inline, continue.
- **Gotcha**:
  - `react` + `react-dom` are currently in `devDependencies` (line 30-33 of `dev-server/package.json`). For `bun install --production` to pull them, they must move to `dependencies`. Update `package.json` in the same task.
  - `Bun.spawn` returns a `Subprocess`; `await proc.exited` to block until done.
  - The orchestrator polls `_server.json` for liveness — make sure the self-heal completes BEFORE `Bun.serve` writes `_server.json`, otherwise the poller will report "up" while the server is still installing.
  - HMR clients reconnect on disconnect — a first-boot rebuild that takes 15s won't drop user state.
- **Validate**:
  ```sh
  cd plugins/design/dev-server && bun test test/boot-self-heal.test.ts
  # E2E:
  rm -rf dist node_modules && bun run server.ts --port 4499 &
  sleep 20 && curl -sf http://localhost:4499/_client/client.bundle.js > /dev/null && echo OK
  kill %1
  ```

### Task 4: CATCH Bun-cache-corruption errors in `runtime-bundle.ts`

- **Do**: Wrap the `Bun.build(...)` call in `runtime-bundle.ts` (inside the bundle factory — look for `Bun.build({ entrypoints: …, target: 'browser', … })`). Catch errors; if the message matches `/EISDIR|ENOENT.*\.bun\/install\/cache/`, throw a wrapped error with text:
  > Bun's global package cache for `<pkg>@<version>` is in a bad state.
  > Fix: `bun pm cache rm <pkg>` then reload the page.
  > Original: <original error.message>
- **Pattern**: Established error-translation idiom — see how `build.ts` already handles `result.success === false` by collecting `result.logs` and re-throwing with context.
- **Gotcha**: Match the package name from the synthetic entrypoint, not from the error path (cleaner UX). Pass it through from `RUNTIME_PACKAGES` lookup.
- **Validate**:
  ```sh
  cd plugins/design/dev-server && bun test test/runtime-bundle-error-mapping.test.ts
  ```

### Task 5: UPDATE `screenshot.sh` + `SKILL.md` for TSX-era visual sanity

- **Do**:
  - `plugins/design/dev-server/bin/screenshot.sh`: after URL resolution, if the resolved URL is `file://*.tsx`, error out with exit 2 and the message `"TSX specimens require the dev-server (file:// cannot compile JSX). Start the dev-server, then re-run with --port instead of --url."`. If `--port` is set + the source file is `.tsx`, route through `http://localhost:PORT/_canvas-shell.html?canvas=<rel>` instead of trying `file://`.
  - `plugins/design/skills/design-system/SKILL.md` "Visual sanity" step: explicitly state that TSX specimens need the dev-server up; either auto-start it (call `bin/server-up.sh` first) or downgrade the step to "optional, dev-server-gated" and emit a warning when skipped.
- **Pattern**: `bin/server-up.sh` already provides the auto-start primitive (PID + `/_health` check, respawn on stale). Compose it into screenshot.sh's TSX branch.
- **Gotcha**: `_canvas-shell.html?canvas=…` is the canonical entry for compiled TSX (see `http.ts` route table). Don't try to invent a new URL scheme.
- **Validate**:
  ```sh
  # Negative test: file:// on .tsx errors cleanly
  plugins/design/dev-server/bin/screenshot.sh --url file:///tmp/fake.tsx --full --out /tmp/x.png; echo $?   # → 2 with hint
  # Positive test: TSX via --port works (requires dev-server)
  plugins/design/dev-server/bin/screenshot.sh --port 4399 --screen home --out /tmp/home.png && file /tmp/home.png   # → PNG
  ```

### Task 6: DOCUMENT AskUserQuestion fallback in skill + command

- **Do**: Edit `plugins/design/skills/design-system/SKILL.md` Discovery section and `plugins/design/commands/setup-ds.md` pre-flight:
  - Add a "Tool-availability check" sentence at the top of the bootstrap flow: probe AskUserQuestion with a trivial question (e.g. "Confirm bootstrap mode") on first invocation; on `InputValidationError` or permission denial, switch Stage 0 + Stage 3 batches to numbered-prose mode for the remainder of the session.
  - Add a worked-example fallback template per stage (Stage 0 scope picker, Stage 3 refinement batches). Use the format shown in **Patterns to Follow** above. Make it copy-pasteable.
- **Pattern**: Same shape as how `flow:question-protocol` skill batches user input — frame the fallback as "single prose reply with numbered answers".
- **Gotcha**: Stage 1 is already plain prose by spec — only Stages 0/3 need the fallback path documented. Stage 2 is non-interactive (research agent).
- **Validate**:
  ```sh
  grep -A 3 "Tool-availability check\|AskUserQuestion fallback" plugins/design/skills/design-system/SKILL.md
  grep -A 3 "Tool-availability check\|AskUserQuestion fallback" plugins/design/commands/setup-ds.md
  ```

### Task 7: RESOLVE single-DS name-convention tension

- **Do**:
  - `plugins/design/commands/setup-ds.md` Arguments section + `plugins/design/skills/design-system/SKILL.md` Detect-target section: state the rule explicitly. **Decided default**: honor user-supplied `<name>` verbatim. If `<name>` matches the repo basename (signals "user typed `setup-ds my-repo` not understanding the `project` convention), emit a warning at name-validation time: `"You passed '<name>'; for first-bootstrap projects the conventional default is 'project' (used by /design:edit auto-detection). Continue with '<name>'? [Y/n]"`. Continue on `Y` (default).
  - `plugins/design/agents/design-system-completeness-critic.md` C2 dirname check: update to honor the rule above — if `<name>` was explicitly supplied (not defaulted), do not flag the divergence. Read `_history/_system/<name>-vision-brief.json` `name_source` field (add this field in setup-ds.md's name-capture step) to disambiguate "user-supplied" vs "default-applied".
- **Pattern**: How other validators in the repo treat "user-supplied overrides convention" — usually a single-line warning with `[Y/n]` (default Y). Mirror that.
- **Gotcha**: The vision-brief schema needs a new optional `name_source: "user" | "default"` field. Add to the schema + the capture step, default to `"default"` when absent so old briefs don't false-positive.
- **Validate**:
  ```sh
  # Synthetic test: vision-brief with name_source=user, completeness critic doesn't flag
  echo '{"name":"my-repo","name_source":"user"}' > /tmp/test-brief.json
  # Spawn completeness critic with --brief /tmp/test-brief.json — should NOT raise C2
  ```

### Task 8: UPDATE CLAUDE.md "Known issues" section (transitional)

- **Do**: Append to `CLAUDE.md`:
  ```markdown
  ## Known issues

  - **Fixed in vX.Y.Z** (Phase 19): `/design:browse` first-boot needed a manual `bun install` in
    `~/.claude/plugins/cache/maude/design/<version>/dev-server/`. Marketplace installs now self-heal
    on first boot — see `.ai/plans/phase-19-dev-server-bootstrap-fixes.md` and DDR-034.
  ```
  After v0.18.0 ships and one full release cycle passes without regression, delete this section.
- **Gotcha**: Don't write the version number until Task 1-7 have landed and the version bump is queued — leave a `<vX.Y.Z>` placeholder and fill it during `/flow:done`.
- **Validate**: `grep "Known issues" CLAUDE.md`

### Task 9: VERSION BUMP + release prep

- **Do**: Run `scripts/bump-version.sh minor` (new behavior + new env flag → minor bump). Verify all three manifest versions match. Then `scripts/check-version-parity.sh`.
- **Validate**:
  ```sh
  scripts/check-version-parity.sh   # exit 0
  ```

### Task 10: REGENERATE site roadmap

- **Do**: After this plan lands and `.ai/state/STATE.md` History is updated by `/flow:done`, run:
  ```sh
  pnpm --filter @maude/site gen:roadmap
  ```
  Commit `site/lib/roadmap.json` in the same commit as the STATE update.
- **Pattern**: Standard per-CLAUDE.md "Site roadmap regen" rule.
- **Validate**: `git diff site/lib/roadmap.json` shows the new phase entry.

---

## Validation

Run these commands to confirm zero regressions:

1. **Lint**: `pnpm lint` (biome check)
2. **Types**: `cd plugins/design/dev-server && bun tsc --noEmit`
3. **Tests**: `cd plugins/design/dev-server && bun test` (includes new `boot-self-heal.test.ts` and `runtime-bundle-error-mapping.test.ts`); `pnpm test` (CLI node:test suite)
4. **Build**: `pnpm build` (full `pnpm -r --if-present run build`); then `pnpm --filter @maude/dev-server build:binary` for at least one release target as a smoke test
5. **Version parity**: `scripts/check-version-parity.sh`
6. **Marketplace-install simulation** (the load-bearing scenario for this phase):
   ```sh
   # Simulate the marketplace cache install (git clone, .gitignore honored, no npm install)
   TMP=$(mktemp -d) && git clone --depth 1 . "$TMP/maude" && cd "$TMP/maude/plugins/design/dev-server"
   # MUST work without manual bun install / build:
   bun run server.ts --root /tmp/scratch-design-project --port 4498 &
   sleep 30   # self-heal needs time on cold cache
   curl -sf http://localhost:4498/_client/client.bundle.js > /dev/null && echo OK-1
   curl -sf http://localhost:4498/_client/styles.css > /dev/null && echo OK-2
   curl -sf http://localhost:4498/_canvas-runtime/react.js > /dev/null && echo OK-3
   kill %1
   ```
7. **`MAUDE_NO_AUTOBUILD=1` opt-out works**: same scenario but with the env flag set — server should exit 1 with a clear remediation message instead of self-healing.
8. **Design System Guard / A11y / Cross-platform scenario**: N/A — this phase has zero UI delta.
9. **Manual**: in a fresh scratch project, run `/plugin marketplace add /absolute/path/to/maude` → `/design:init` → `/design:setup-ds my-design-system` → `/design:browse`. The browser tab should render the canvas index without any 404s in DevTools. Verify the AskUserQuestion fallback by running the same flow with `--don't-ask` mode (or whatever the harness flag is).

---

## Scenario Coverage (UI tasks — required)

**N/A** — this phase has no user-facing UI changes. The "scenario" for this phase is the marketplace-install simulation in Validation step 6.

If `/done`'s scenario-runner gates on the presence of a scenario, justify the skip in the PR description by linking to this section and to the manual smoke (Validation step 9).

---

## Acceptance Criteria

- [ ] DDR-034 written and committed under `.ai/archive/decisions/` (captures Task 1 mechanism choice + rejected alternatives)
- [ ] `.gitignore` updated to preserve `client.bundle.js` and `styles.css` while keeping per-platform binaries ignored; both files committed
- [ ] `build.ts:73-74` reads from a path that exists in marketplace installs (Task 2), with try/catch fallback to `version: 'dev'`
- [ ] `server.ts` self-heals missing `dist/` and `node_modules/` on first boot; `MAUDE_NO_AUTOBUILD=1` opts out cleanly
- [ ] `runtime-bundle.ts` translates Bun-cache-corruption errors into actionable user messages with remediation command
- [ ] `screenshot.sh` rejects `file://*.tsx` with a clear hint; auto-routes TSX through `_canvas-shell.html?canvas=…` when `--port` is set
- [ ] `SKILL.md` + `setup-ds.md` document the AskUserQuestion numbered-prose fallback with copy-pasteable templates
- [ ] Single-DS name-convention rule is unambiguous in `setup-ds.md` + `SKILL.md`; completeness-critic C2 honors `name_source` field
- [ ] `CLAUDE.md` "Known issues" entry added with version placeholder filled at release time
- [ ] `scripts/check-version-parity.sh` passes after version bump
- [ ] `pnpm lint`, `bun tsc --noEmit`, `pnpm test`, `bun test` all green
- [ ] Marketplace-install simulation (Validation step 6) succeeds without manual intervention on a clean clone
- [ ] Manual smoke (Validation step 9) succeeds end-to-end in a fresh scratch project
- [ ] `site/lib/roadmap.json` regenerated and committed in the same change as the STATE update
- [ ] No new DDR-worthy decision left unrecorded
- [ ] Code follows project conventions; no regressions in existing dev-server behavior

---

## Retro

**What worked**
- **System-review-as-input.** Starting from `.ai/logs/system-reviews/maude-dev-server-bootstrap-review.md` meant Stage 1 was already done — 7 prioritized, root-caused, one-line fixes with exact file:line references. Plan-writing time was minutes, not hours. This is the highest-leverage `/plan` input shape I've seen: a structured retro from an actual user session > a feature brief from product.
- **Belt-and-braces decision in DDR-044.** Pure self-heal (option c) would have been a single mechanism but had a hard-fail mode (read-only filesystem). Pure commit-artifacts (option a) leaves runtime deps unfixed. Combining a+self-heal made every variant survivable. The decision table in the DDR documents why the seemingly-redundant approach is actually load-bearing.
- **Extracting `boot-self-heal.ts` to its own file.** Plan said "add to top of server.ts". Wrong shape — server.ts has top-level `await Bun.serve(...)`, you can't import it without booting a real server in the test process. Pure-function extraction gave full branch coverage in 6 tests; pattern is now a precedent for any other init-time hook.
- **DDR-021 step 3.5 smoke gate skipped intentionally, documented in the report.** Live curl checks were a more targeted substitute (covered the 4 exact routes the system review flagged as broken). The full `/design:smoke` would have screenshotted 30+ canvases, none of which had their rendering path touched.

**What didn't**
- **DDR-034 was taken** — plan referenced it for the artifact-strategy decision, but `.ai/archive/decisions/DDR-034-comments-overlay-screen-coord-fixed-position.md` already existed from April. Required a chain of find-replace across SKILL.md, setup-ds.md, build.ts comments, server.ts comments, completeness-critic, CLAUDE.md to renumber to DDR-044. **Rule going forward**: `/plan` MUST run `ls .ai/archive/decisions/` to find the next free DDR number before referencing one.
- **Plan Task 2(a) recommended file didn't exist.** Plan said "read `plugins/design/package.json`" — there is no such file in this repo (only `plugins/design/.claude-plugin/plugin.json` and `plugins/design/dev-server/package.json`). Required an on-the-fly switch during Task 2 execution. **Rule going forward**: `/plan` MUST verify cited paths exist with `ls` before recommending them.
- **Moved more deps than planned.** Plan said move react+react-dom. Actually needed react+react-dom+lightningcss+magic-string+oxc-parser because `bun install --production` needs every runtime import. Caught in implementation by grepping `from 'oxc-parser'` / `from 'lightningcss'` etc. — but the plan's `grep -rn "import.*from"` reconnaissance step should have caught it during planning. **Rule going forward**: when moving a dep between `dependencies` / `devDependencies`, grep ALL runtime imports against the dep list, not just the named ones.
- **Marketplace-install simulation never ran end-to-end.** Validation step 6 of the plan was a `git clone --depth 1 . $TMP/maude` + `bun run server.ts` smoke. I substituted live curl checks against the in-place server (artifacts already present). The actual cold-clone smoke is the load-bearing scenario for DDR-044 and currently has no CI coverage. **Follow-up needed**: add a `marketplace-install-smoke.yml` GH Actions workflow that does the full cold clone + boot + curl in a fresh runner.

**What to change in `/plan` / `/execute` next time**
- **Plan template should reserve a "Sanity probes" section** — a 3-5 line shell snippet the planner ran while planning, showing the actual state of the repo (`ls plugins/design/`, `git check-ignore -v dist/`, `npm pack --dry-run | grep dist`). Catches the "plan references nonexistent file" failure mode at planning time.
- **Plan should explicitly enumerate file moves** — `move X from devDeps to deps` should list ALL files that import X, not just "X is needed at runtime".
- **DDR number allocation belongs in `/flow:record-ddr`** — agent should always grep first, never trust the planner's number.
- **Live-curl-smoke beats screenshot-smoke for backend infra changes** — DDR-021 step 3.5 should split: bulk-canvas changes → `/design:smoke`; dev-server-only changes → curl-based smoke. Document this distinction.
