# DDR-045: Real-disk path resolution for compiled dev-server binaries

> **Path update — [DDR-095](DDR-095-runtime-apps-extracted-to-top-level.md) (2026-06-05):** the dev-server now lives at `apps/studio/` (hub at `apps/hub/`), moved out of `plugins/design/`. This DDR's invariants still govern; only the path changed. Old `plugins/design/dev-server` references below are historical.

**Status:** Accepted — 2026-05-25.
**Tags:** dev-server / bun-compile / paths / npm-install / marketplace-cache / phase-19.1 / phase-19.2
**Related:** [DDR-009](DDR-009-bun-runtime-authoritative-for-dev-server.md) (Bun runtime authoritative), [DDR-015](DDR-015-per-platform-binary-distribution.md) (per-platform binaries via optionalDependencies), [DDR-044](DDR-044-marketplace-install-vs-npm-install-artifact-strategy.md) (commit dist artifacts), [DDR-042](DDR-042-oxc-parser-bun-compile-workaround.md) (companion bun --compile workaround).

## Context

The dev-server runs in **three distinct layouts** that surface as the same `server.ts` codepath but anchor to very different filesystem realities:

1. **Dev** — `cd plugins/design/dev-server && bun run server.ts`. The TS source executes directly; `import.meta.url` is a real `file://` path that points into the working tree.
2. **npm install** — `npm i -g @1agh/maude` lands the per-platform compiled binary at `<prefix>/lib/node_modules/@1agh/maude/node_modules/@1agh/maude-darwin-arm64/maude` (sub-package per DDR-015) AND the source/dist tree at `<prefix>/lib/node_modules/@1agh/maude/plugins/design/dev-server/` (top-level package). The binary lives 3 directory levels DEEPER than the dev-server dir, in a sibling tree under the parent package's nested `node_modules/`.
3. **Marketplace cache** — Claude Code's `/plugin marketplace add 1aGh/maude` does a `git clone` into `~/.claude/plugins/cache/maude/`. No `bun --compile` binary on this path; user invokes the JS entrypoints directly. Layout otherwise mirrors the dev tree (everything `.gitignore`-respecting that survived the clone).

Phase 19 (v0.18.0) used `const HERE = dirname(fileURLToPath(import.meta.url))` universally in `http.ts`, `runtime-bundle.ts`, `boot-self-heal.ts`, and a handful of other modules. **Inside a `bun --compile` standalone binary, `import.meta.url` resolves to `file:///$bunfs/root/server.ts`** — bun's embedded virtual filesystem, not the host disk. Every `existsSync(join(HERE, 'dist', 'client.bundle.js'))` returned `false` against the virtual `/$bunfs/root/dist/`, every `Bun.build({ entrypoints: [join(HERE, '.synthetic.tsx')] })` anchored its module-resolution walk inside the embedded FS where no `node_modules/` exists. Symptoms cascaded:

- Self-heal false-triggered → tried to `bun install` → `Bun.spawn(['bun', ...])` failed `ENOENT` because compiled binaries inherit a stripped PATH that doesn't include `~/.bun/bin/bun`
- `/_client/client.bundle.js` 404'd → http.ts fall-through served `<virtual>/client/app.jsx` (raw JSX, no compile)
- `/_canvas-runtime/react.js` 500'd → synthetic-entry build couldn't resolve `"react"`

v0.18.1 introduced `paths.ts` as a dedicated module to fix this — but the first version of `isDevServerDir()` required BOTH `http.ts` AND `package.json` to identify a candidate directory. **npm excludes nested workspace `package.json` files from published tarballs by default** (so `plugins/design/dev-server/package.json` is absent on every npm install). Walk-up silently fell through to the import-meta fallback (the virtual path) and self-heal reported "missing artifacts" against `/$bunfs/root` — a worse error message for the same broken state.

v0.18.2 dropped the `package.json` check. The full investigation, both failed releases, and the final fix are captured here so the lesson survives the commit log.

## Alternatives considered

- **(A) Keep `import.meta.url` everywhere; document "don't compile with --compile".** Backwards-compatible with the dev path, zero new code. Rejected: per DDR-015 the per-platform standalone binary IS the distribution mechanism; abandoning `bun --compile` would mean shipping bun + node_modules + source to every end user (~150 MB instead of ~67 MB) and reintroducing the version-skew failure modes the binary distribution exists to prevent.

- **(B) Pre-bundle everything (react, react-dom, node_modules, dist) into the compiled binary via `bun --compile` embed.** Eliminates filesystem resolution at runtime — every file lives inside `/$bunfs/`. Rejected on three grounds: (1) `Bun.build` at request time (used by `runtime-bundle.ts` for the dynamic dev path) needs real disk `node_modules/react` to resolve the synthetic entrypoint — embedding doesn't help it; (2) `dist/client.bundle.js` needs to be SERVED to the browser via HTTP (not just readable internally), and Bun.file against `/$bunfs/` paths inside the same process is fine but cross-process serving has more constraints; (3) doubles binary size from ~67 MB to ~140 MB+ for the React + ReactDOM + node_modules transitive closure.

- **(C) Walk up from `process.execPath` to find the install dir.** Use a unique-enough anchor (a file the install always has and a random user tree wouldn't) to identify the dev-server directory regardless of the layout above it. Centralize the logic in one module (`paths.ts`) so every consumer imports the same constants.

- **(D) Environment variable contract — require `MAUDE_DEV_SERVER_ROOT` to be set by the CLI wrapper.** The Node `cli/bin/maude.mjs` knows the install layout (it computed `PKG_ROOT` to find the binary), so it could set the env var before spawning. Rejected as primary mechanism but kept as escape hatch (planned for future revision — see "Revisit when"): adds another contract surface, surprising for users who launch the binary directly (e.g. `claude-design-server` bin or `~/.bun/bin/maude-darwin-arm64` after `bun add -g`), and the walk-up works without it.

## Decision

**Adopt (C): centralize path resolution in `plugins/design/dev-server/paths.ts`.** Every dev-server module that needs filesystem-relative paths imports the constants from this module instead of computing them locally.

Implementation contract:

1. **`paths.ts` exports four constants**, computed once at module load:
   - `DEV_SERVER_ROOT` — real disk path to `plugins/design/dev-server/`
   - `DIST_DIR` = `<DEV_SERVER_ROOT>/dist`
   - `CLIENT_DIR` = `<DEV_SERVER_ROOT>/client`
   - `RUNTIME_BUNDLES_DIR` = `<DIST_DIR>/runtime`
   - (plus the helper boolean `IS_COMPILED_BINARY`)

2. **Resolution order:**
   - **Dev mode shortcut:** if `dirname(fileURLToPath(import.meta.url))` is a real (non-`/$bunfs`, non-`B:/~BUN`) path AND `isDevServerDir(it)` is true → return it.
   - **Compiled mode walk-up:** start at `dirname(process.execPath)`, walk up to 10 parents. At each level, check `isDevServerDir(cur)` AND `isDevServerDir(join(cur, 'plugins/design/dev-server'))`. Return the first match. Both checks are needed: npm install has the binary in a sibling tree (so `cur` itself is never the dev-server dir, the nested probe wins); a hypothetical layout that compiles + runs the binary directly inside the dev-server dir (e.g. dev `bun run build.ts --release` followed by `./dist/maude-*`) would have `cur === DEV_SERVER_ROOT`.
   - **Fallback:** return the import-meta dir even if virtual. Callers (especially `boot-self-heal.ts`) MUST handle the case where `existsSync` against the returned path returns false and surface a clear "install corrupted" message — never silently degrade.

3. **`isDevServerDir(dir)` MUST check only `existsSync(join(dir, 'http.ts'))`.** Reasons captured in v0.18.2:
   - `package.json` is excluded by npm from nested workspace tarballs → checking it false-rejects every npm install.
   - `dist/client.bundle.js` exists in the npm/marketplace install but NOT in a freshly-cloned dev tree before the first `bun run build.ts` → checking it false-rejects the dev path.
   - Requiring two anchors creates a combinatorial set of false rejections; the install paths walk through node_modules layers above the binary, so collision risk against a random user-tree `http.ts` is negligible.

4. **Behavioral rule for every NEW module added under `plugins/design/dev-server/`:** if you need a filesystem-relative path, import from `paths.ts`. Do NOT compute `dirname(fileURLToPath(import.meta.url))` locally. The lone exception is `paths.ts` itself.

## Consequences

**Positive:**
- One source of truth for path resolution. A future install layout change (e.g. a Deno port, a snap package, a Homebrew formula) is fixed in one file.
- The compiled-binary path actually works without environment-variable contracts users don't know about.
- `boot-self-heal.ts` becomes pure verification (committed artifacts present?) instead of a fragile install-fixer; failure modes are clear "install corrupted, reinstall" rather than `ENOENT bun`.

**Negative / trade-offs:**
- Every new dev-server module is now an `import { DIST_DIR } from './paths.ts'` away from being correct, and the temptation to write `const HERE = dirname(fileURLToPath(import.meta.url))` is high (it works in dev tests). Discoverable only via code review or a smoke test against an actual compiled binary. **Mitigation:** CLAUDE.md rule (next sweep) + a future test that compiles a probe binary and asserts no path constants resolve to `/$bunfs`.
- Walk-up adds ~10 `existsSync` syscalls at module load on the binary path. Single-digit milliseconds, negligible relative to Bun.serve startup.
- Modules that haven't been migrated yet (`canvas-lib-resolver.ts` was identified as the remaining offender — logs a benign `ENOENT '/$bunfs/root/canvas-lib.tsx'` watch warning in compiled mode) will keep tripping on the same bug until they adopt `paths.ts`. v0.18.3+ follow-up.

**Neutral:**
- The `/$bunfs/root` detection (in `isVirtualBunfsPath`) is a Bun implementation detail (`B:/~BUN` is the Windows variant). If Bun renames its embedded-FS prefix, the dev-mode shortcut will silently fall through to walk-up — which still works for compiled binaries; only the dev path would degrade (slightly slower module load). Acceptable.

## Revisit when

- **Bun adds a stable public API for "real disk path of the current binary"** — e.g. `Bun.installRoot` or `import.meta.compileSource`. Today `process.execPath` is the most reliable proxy and works on every platform we ship to, but it's a Node-inherited contract and Bun could in principle return something different (e.g. for `bun --compile` produced binaries that are then renamed).
- **A new install layout** lands that doesn't fit the npm / marketplace / dev triad — e.g. a Tauri-wrapped desktop app embeds the dev-server, or someone ships `@maude/dev-server` as a standalone npm package. The walk-up's "up to 10 parents, find http.ts" heuristic may need an extra anchor or an explicit env var.
- **Walk-up false-matches** in user reports — if a user has `http.ts` in their working tree close enough to the binary location for the walk to mistakenly anchor there. Tighten by also checking for `dist/runtime/react.js` (after the `dist/` rule is removed from `.gitignore` for dev branches too) or `canvas-lib.tsx` (always present in the dev-server dir).

## Linked

- Plan: `.ai/plans/archive/phase-19-dev-server-bootstrap-fixes.md` (retro at end documents the v0.18.0 → v0.18.1 → v0.18.2 series)
- Changesets: `.changeset/v0-18-1-greenfield-install-fix.md`, `.changeset/v0-18-2-paths-package-json-anchor.md`
- Supersedes: — (extends DDR-044)
