# Phase 3.4: Dev-server architecture refactor (performance pre-cleanup)

> **PIVOTED 2026-05-15** — runtime simplified from "Preact for shell + React 19 for canvases (hybrid)" to **"React 19 everywhere"** (DDR-012, pending). The Preact bundle+RAM win on the shell didn't justify the dual-runtime complexity (two `jsxImportSource` configs, two bundle paths, conditional mount API, `meta.runtime` field, per-runtime handoff audit, future-phase cognitive tax). Performance budgets **relaxed** below to absorb React 19's footprint while keeping the v1 "tip-top" narrative (cold-start to HTTP 200 < 100 ms unchanged; bundle gz < 80 KB up from 60; idle RAM < 80 MB up from 50; first paint < 350 ms up from 250). Files-to-Create + Task 4 simplified accordingly; DDR list re-themed; Phase 3.5 + Phase 3.6 updated in lockstep.

> **Goal:** make the dev-server tip-top — fast, low-RAM, no jank — **before** any feature work lands. This pulls the architectural decisions out of Phase 4 so Phase 4 can stay focused on the Pixi.js canvas + render engine.
>
> **Source of architectural research:** [`.ai/docs/research-runtime.md`](../docs/research-runtime.md) (runtime choice) + external deep-research on perf-oriented local dev-tool architecture (2026-05-15, captured inline in this plan's "Research" section).

## Description

Refactor the dev-server's shell to a build-pipeline-driven, **Bun-runtime-authoritative** architecture targeting concrete performance budgets. Concretely: migrate server source to `Bun.serve` / `Bun.file` / `Bun.write` (drops `node:http` + the handwritten WS upgrade — Bun's `serve` handles both natively), modularize the 1288-LOC `server.mjs` into typed `.ts` modules, swap React-UMD-via-babel-standalone for **`Bun.build`-produced React 19 bundle** (single runtime for shell + canvases — see DDR-012), organize `styles.css` into CSS `@layer`s with Lightning CSS at build time, add custom WS-driven HMR over the existing inspector socket, harden memory hygiene (Bun heap-snapshot-based leak detection + `FinalizationRegistry` for iframe state), lazy-mount iframes via IntersectionObserver, and **ship as a `bun build --compile` standalone binary per platform** (darwin-arm64 / darwin-x64 / linux-x64 / win32-x64), distributed via npm `optionalDependencies` sub-packages (esbuild-style pattern). End-user prereq drops from "Node 20+ installed" → "nothing" — `npm i -g @1agh/md-claude` installs only the matching platform's ~70 MB binary; running `mdcc design serve` launches that binary directly.

**This is a runtime-authoritative migration, not a build-target migration.** Source code uses Bun APIs (`Bun.serve`, `Bun.file`, `Bun.write`, `Bun.spawn`, `Bun.password`, `bun:test`); there is no Node fallback. Trade-off accepted per DDR-009: maximal cold-start + WS perf + zero-end-user-prereq distribution in exchange for Bun tail-risk + lock-in.

**Out of scope:**
- Pixi.js canvas / pan-zoom / minimap → Phase 4
- Design token migration + shell visual refresh → Phase 3.5 (this refactor unblocks 3.5; 3.5 uses the new build pipeline + framework)
- Live collab, ACP relay, draw tools, comments, presentation → Phase 5/6/7/8 (each lands on this hardened shell)

## User Story

As a designer running `mdcc design serve` for hours on my laptop, I want to install one thing (`npm i -g @1agh/md-claude`) with **no Node prerequisite**, have the dev-server cold-start in under 100 ms, idle under 50 MB of RAM, react to theme toggle / tab switch / tree-open in one frame, and never lag the Pixi.js canvas during shell renders — so that the tool feels native instead of "a dev preview".

## Problem

| Symptom | Current cause | Impact |
| --- | --- | --- |
| ~150 KB of Babel-standalone parsed in-browser per page load + JSX recompiled at runtime | `index.html` ships React UMD + babel-standalone from unpkg; `app.jsx` served raw | Slow cold start (~1.5-2 s on a fresh tab), ~40-60 MB extra heap for the Babel AST that's never freed |
| `app.jsx` is 1000 LOC in one file, `styles.css` is 1400 LOC unstructured, `server.mjs` is 1288 LOC monolith | Organic growth since v0.5; no build step so each split would historically require manual `<script>` ordering | Hard to reason about, every edit is a full-page reload (state thrown), no path to HMR or code-splitting |
| Idle RAM creeps as tabs open/close (no explicit lifecycle on iframe-injected inspector state) | Iframe-injected inspector scripts retain references to parent via WS callbacks; no `FinalizationRegistry` cleanup | Long sessions (8 h+) report 300-500 MB resident on M1 |
| Full-page reload on every file save throws inspector connection + selected element | No HMR — server reads file off disk, browser re-fetches HTML | Loses context during a tight edit loop; ~600 ms wall clock per save |
| `node:fs.watch` on macOS is unreliable for recursive `.design/` trees | macOS FSEvents API quirks; `recursive: true` exists since Node 19 but rename events leak | Stale tree, missed updates, occasional duplicate notifications |
| Pan/zoom (when Pixi lands in Phase 4) will compete with React render scheduler for main-thread time | React 18 reconciler runs on the same thread as the Pixi ticker | Predicted 5-10 fps drop during shell re-renders unless render budget is tightened |
| No tests for the server — 1288 LOC with no safety net | Phase 1's `node --test` is wired but only for the CLI | Every refactor is yolo; Phase 4 amplifies the risk |
| Babel-standalone CDN tarball isn't pinned to integrity in CI | `index.html` does pin SRI hashes — OK — but ships ~150 KB to do JSX transform that should happen at publish time | Wasted bytes, wasted user CPU, online-only |

## Solution

Four-stack rewrite, additive (no end-user behavior change), ordered to land independently:

1. **Bun runtime authority + server modular split (TypeScript)** — Migrate `server.mjs` to a `.ts` module set: `server.ts` (entry + `Bun.serve` lifecycle) · `http.ts` (route fetch handler) · `ws.ts` (Bun.serve native WebSocket handler — replaces handwritten upgrade) · `api.ts` (`/api/*` handlers) · `inspect.ts` (active-canvas + selected-element protocol) · `history.ts` (snapshot stack) · `fs-watch.ts` (Bun's `fs.watch` recursive). All file I/O via `Bun.file` / `Bun.write`; all subprocess calls via `Bun.spawn`; tests in `bun:test`.
2. **Bundler + compile pipeline** — `build.ts` driving (a) `Bun.build` for the **client** (JSX, esbuild-compatible, IIFE for the browser, **React 19 from npm**, tree-shaken) + (b) `bun build --compile --target=bun-<platform>` for the **server** (produces standalone binary). Lightning CSS still handles `client/styles/`. Output: `dist/client.bundle.js` (shell + shared React 19 runtime), `dist/styles.css`, `dist/mdcc-<platform>` (binary). Per-platform CI matrix in GitHub Actions.
3. **Framework swap (client)** — Drop babel-standalone + UMD React from `index.html`; load `Bun.build`-produced bundle that ships **React 19 from npm** tree-shaken (~25-35 KB gz after Bun.build dead-code elimination — shell uses ~30 % of React's surface). The React 19 runtime bundle is shared between the shell (loaded at `/`) and Phase 3.6's canvas TSX route (loaded at `/ui/:slug`) — one runtime, one mental model, per DDR-012.
4. **Client perf hardening** — Custom WS-driven HMR reusing the existing inspector socket (parent-only patches; iframes never reload). CSS rewrite into `@layer reset, tokens, layout, shell, components, utilities` with Lightning CSS handling OKLCH fallbacks + minification. IntersectionObserver-based lazy mount of artboard iframes with `content-visibility: auto` on wrappers. `FinalizationRegistry` + `WeakRef` for iframe-scoped state cleanup (Bun's JSCore GC behavior verified against the 8 h soak).

5. **Distribution** — npm package `@1agh/md-claude` ships a tiny JS shim (`cli/bin/mdcc.mjs`, < 5 KB) that detects platform + `exec`s the matching per-platform binary, fetched via `optionalDependencies`: `@1agh/md-claude-darwin-arm64`, `@1agh/md-claude-darwin-x64`, `@1agh/md-claude-linux-x64`, `@1agh/md-claude-win32-x64`. End-user `npm i -g @1agh/md-claude` installs the shim + only their platform's ~70 MB binary. Pattern lifted from `esbuild` / `@swc/core` / `@biomejs/biome` (all live this way in production).

## Metadata

- **Type:** Major refactor + runtime migration (no end-user feature change; perf + distribution win)
- **Complexity:** High
- **App/Package:** `plugins/design/dev-server/` + `cli/` end-to-end + CI release pipeline
- **Affected Systems:** dev-server server, dev-server client, mdcc CLI, build pipeline, GitHub Actions release workflow, npm tarball composition (single → multi-package)
- **New runtime:** **Bun ≥ 1.3** (authoritative). Source uses `Bun.*` APIs. No Node fallback. Node 20+ is no longer a runtime; only `cli/bin/mdcc.mjs` (the shim) runs on whatever the user's `npm exec` resolves to (typically Node, but trivial so doesn't matter).
- **New build-time deps:** `bun` (CI-only, installed via `curl -fsSL https://bun.sh/install | bash`), `@types/bun`, `react ^19`, `react-dom ^19`, `lightningcss ^1.27`. **Dropped:** `esbuild` (replaced by `Bun.build`), `@parcel/watcher` (replaced by Bun's recursive `fs.watch`), handwritten WS upgrade code (replaced by `Bun.serve` websocket handler), Preact (decided against; see DDR-012).
- **Blocks:** Phase 3.5 (shell visual refresh — lands on the new bundle + React 19), **Phase 3.6** (canvas TSX format — needs `Bun.Transpiler`, `Bun.hash`, `Bun.serve` routes API + `inspect.ts` injected-script seam + shared React 19 runtime), Phase 4 (canvas v2 — lands on the binary), **Phase 12** (in-canvas CSS editor + layers — transitively via 3.6's `_locator.json` contract), every subsequent phase

## Performance budgets (acceptance gates)

> These are the contract. Measurements come from a single repeatable harness (see Task 11). Any task that regresses a budget gets reverted before the next task lands.

| Metric | Target | How measured | Rationale |
| --- | --- | --- | --- |
| Cold start: process spawn → HTTP `/` 200 | **< 100 ms** | `time mdcc design serve --port 4399 &; curl localhost:4399/_health` | Bun standalone binary baseline |
| Cold start: process spawn → first paint of file tree | **< 350 ms** | server logs `started`, client logs `first-paint` via `performance.timeOrigin` | "feels native" threshold; relaxed from 250 ms to absorb React 19 vs Preact delta (DDR-012) |
| Initial client bundle size (gz) | **< 80 KB** | `du -sh dist/client.bundle.js.gz` after `Bun.build` + Lightning CSS minify | Shell + React 19 tree-shaken; relaxed from 60 KB. Pixi (Phase 4) adds ~120 KB more |
| Standalone binary size per platform | **< 80 MB** (gzipped tarball entry ~40 MB) | `du -sh dist/mdcc-<platform>` after `bun build --compile` | Bun runtime + JSCore + bundled JS |
| Idle RAM (8 h session, 1 canvas open, no interaction) | **< 80 MB resident** | `ps -o rss` snapshots every 60 s | Relaxed from 50 MB to absorb React 19 vs Preact delta. Bun JSCore is still ~30-40 % lower than V8 baseline — 80 MB cap is conservative for an 8h session |
| Peak RAM (10 canvases open + 1 h pan-zoom — measured AFTER Phase 4 lands; gated only on the Phase 3.4 baseline subset here) | **< 150 MB resident** | same harness | Bounded growth |
| Theme toggle paint | **< 16 ms** | `requestAnimationFrame` delta after `data-theme` flip | One frame budget |
| Tree open/collapse | **< 8 ms** | Performance API mark + measure | Half-frame for 60 fps room |
| Tab switch | **< 16 ms** | same | One frame |
| File-tree fuzzy filter on 1000 entries | **< 4 ms** | `console.time` around filter call | Keystroke-responsive |
| Hot module replacement (parent shell module edit → live update) | **< 200 ms** wall clock; iframe state preserved | manual timer + visual check that inspector connection persists | "no edit-loop tax" |
| WS round-trip parent ↔ inspector | **< 1 ms** median, < 5 ms p99 | bench harness pings 1000× | Phase 6/8 floor |
| Bun heap soft-limit | **256 MB** before warning, 512 MB hard cap | `--smol` flag + `process.memoryUsage().heapTotal` polling | Kills runaway allocations early; `--smol` enables low-memory mode |
| WS connection count per process (Phase 8 readiness) | **≥ 10 K** without RSS growth | bench harness | Bun.serve native WS scales 1.7× over `ws` |

If any of these regress in a later phase, the offending change is reverted before merge — the budgets ride with the codebase.

---

## Context References

### Must-Read Files

- `plugins/design/dev-server/server.mjs` (1288 LOC) — full file. Identify hot paths + boundaries for the modular split.
- `plugins/design/dev-server/client/app.jsx` (1000 LOC) — full file. Now runs natively on React 19 (no compat shim needed); rewrite is mostly removing the React UMD globals + adopting esm imports.
- `plugins/design/dev-server/client/styles.css` (1400 LOC) — for the `@layer` split + Lightning CSS audit.
- `plugins/design/dev-server/client/index.html` — script tags to remove; bundle tag to add.
- `plugins/design/dev-server/runtime/design-canvas.jsx` (39 KB) + `runtime/tweaks-panel.jsx` (18 KB) — **audit before refactor.** Likely meta-design canvases from commits `b200e59` ("stable element IDs + canonical screenshot pipeline + shared bash helpers") + `5864f71` ("meta-design of dev-server canvas viewport states"). If they're design artifacts they belong under `.design/ui/`; if they're runtime code, modularize them. DDR required.
- `package.json` — root, for `bin`, `files`, new `optionalDependencies` block.
- `plugins/design/dev-server/package.json` — currently 321 bytes stub from Phase 1. Fills in here.
- `plugins/design/dev-server/bin/screenshot.sh` etc. — shipped via npm `files`; ensure `dist/` joins them.
- `.ai/docs/research-runtime.md` — runtime decision context (read the first 80 lines for the executive recommendation + workload reality check).
- `.ai/plans/phase-4-canvas-v2-rendering-engine.md` (lines 52–56) — Phase 4's "Task 2: Build the dist bundles" — **this task moves here**, Phase 4 becomes pure rendering.
- `.ai/plans/phase-3.5-dev-server-ui-ux-refresh.md` — downstream consumer of the new pipeline + framework.

### Files to Create

- `plugins/design/dev-server/build.ts` — Bun-driven build orchestrator: runs `Bun.build({ entrypoints: ['client/app.jsx'], outdir: 'dist', target: 'browser', format: 'iife', minify: true })` for the client; runs `Bun.build({ entrypoints: ['server.ts'], outdir: 'dist', target: 'bun', compile: { target: 'bun-<platform>', outfile: 'dist/mdcc-<platform>' } })` for the server binary, looping the platform matrix. Lightning CSS step still runs separately for `client/styles/_index.css` → `dist/styles.css`. Watch mode (`--watch`) drives custom HMR.
- `plugins/design/dev-server/tsconfig.json` — `{ "compilerOptions": { "types": ["bun-types"], "target": "ESNext", "moduleResolution": "Bundler", "jsx": "preserve", "strict": true } }`.
- `plugins/design/dev-server/server.ts` — entry + `Bun.serve` lifecycle + `_server.json` write + root resolution (replaces `server.mjs`).
- `plugins/design/dev-server/http.ts` — route table for `Bun.serve` via the **`routes` field (Bun ≥ 1.3)**: `{ '/': handler, '/_client/*': handler, '/_design/*': handler, '/<canvas>.html': handler, ... }`. Top-level `fetch(req)` stays as the fall-through. The `routes` shape makes Phase 3.6 a clean extension — `/ui/:slug` lands as one more key, no rewrite.
- `plugins/design/dev-server/ws.ts` — `Bun.serve` `websocket: { open, message, close, drain }` handlers + per-connection FSM. **Drops** the handwritten RFC-6455 upgrade — Bun handles it.
- `plugins/design/dev-server/api.ts` — `/api/*` handlers (returns `Response` objects).
- `plugins/design/dev-server/inspect.ts` — active-canvas + selected-element protocol; `_active.json` writer via `Bun.write` with **explicit `selected.v: 1` schema version field** (Phase 3.6 bumps to `v: 2` when migrating from CSS-selector path to `data-cd-id`); inspector-script injection text.
- `plugins/design/dev-server/history.ts` — snapshot/rollback stack via `Bun.file` + `Bun.write`.
- `plugins/design/dev-server/fs-watch.ts` — `fs.watch(root, { recursive: true })` adapter (Bun's recursive watcher is reliable on macOS, unlike Node's; drops `@parcel/watcher`).
- `plugins/design/dev-server/mem.ts` — `FinalizationRegistry` registry for iframe-state cleanup + heap-snapshot helpers (`Bun.gc(true)` forced GC for tests).
- `plugins/design/dev-server/client/styles/` — directory holding the new `@layer` source files (split):
  - `0-reset.css` (`@layer reset`)
  - `1-tokens.css` (`@layer tokens` — imports `.design/system/project/colors_and_type.css` at build time)
  - `2-layout.css` (`@layer layout`)
  - `3-shell.css` (`@layer shell`)
  - `4-components.css` (`@layer components`)
  - `5-utilities.css` (`@layer utilities`)
  - `_index.css` — single entry, `@layer reset, tokens, layout, shell, components, utilities;` then `@import` of each.
- `plugins/design/dev-server/client/hmr.mjs` — WS-side HMR client (parent shell only; iframes opt out).
- `plugins/design/dev-server/client/iframe-lazy.mjs` — IntersectionObserver lazy-mount helper for artboard iframes.
- `plugins/design/dev-server/test/` — `bun:test` smoke tests:
  - `server-lifecycle.test.ts` — boot, `/_health`, `_server.json` write, shutdown.
  - `ws-handshake.test.ts` — full RFC-6455 handshake against `Bun.serve` WS (uses `Bun.connect` client).
  - `active-state.test.ts` — `_active.json` write/read roundtrip.
  - `history-rollback.test.ts` — snapshot stack + restore.
  - `fs-watch.test.ts` — recursive `fs.watch` fires on file change (tempdir fixture).
  - `bundle-smoke.test.ts` — `dist/client.bundle.js` exists, parses as JS, contains a React 19 marker.
  - `binary-smoke.test.ts` — `dist/mdcc-<platform>` exists, `chmod +x`, spawns and exits 0 on `--version`.
- `plugins/design/dev-server/.npmignore` — exclude `test/`, `client/`, `*.ts` source — only `dist/` + `bin/` + `package.json` ship. **Note:** the dev-server workspace package is NOT published independently; it's bundled into the per-platform sub-packages below.
- `cli/bin/mdcc.exe` — 500-byte ASCII shell stub (Claude-Code-pattern). The actual binary is hardlinked over this file by postinstall. Bin entry in root `package.json`.
- `cli/install.cjs` — postinstall script. Detects platform (incl. glibc/musl + Rosetta), hardlinks the platform sub-package's `mdcc` over `cli/bin/mdcc.exe`. `fs.copyFileSync` fallback on cross-volume.
- `cli/cli-wrapper.cjs` — `--ignore-scripts` fallback, exposed as `mdcc-safe` bin. `spawnSync` shim with platform detect on every call.
- `packages/md-claude-darwin-arm64/package.json` + binary — Apple Silicon.
- `packages/md-claude-darwin-x64/package.json` + binary — Intel macOS.
- `packages/md-claude-linux-x64/package.json` + binary — Linux glibc x64.
- `packages/md-claude-linux-arm64/package.json` + binary — Linux glibc ARM64.
- `packages/md-claude-linux-x64-musl/package.json` + binary — Alpine / distroless x64.
- `packages/md-claude-linux-arm64-musl/package.json` + binary — Alpine / distroless ARM64.
- `packages/md-claude-win32-x64/package.json` + binary — Windows x64.
- `.github/workflows/build-binaries.yml` — release-tag-triggered matrix workflow: `runs-on: [macos-14, macos-13, ubuntu-22.04, ubuntu-22.04-arm, ubuntu-22.04 (Alpine container), windows-2022]`, each installs Bun, builds the binary, uploads as a GitHub Release asset + publishes the per-platform sub-package to npm with `--provenance`.
- `.ai/decisions/DDR-009-bun-runtime-authoritative.md` — flipped from prior "Stay Node" recommendation. Cites research-runtime.md as superseded by Option-B decision (2026-05-15).
- `.ai/decisions/DDR-012-react-19-unified-runtime.md` — **React 19 everywhere** (supersedes the prior "Preact via compat for shell" draft). Records the three-draft pivot + the bundle/RAM-vs-complexity trade-off + the relaxed performance budgets.
- `.ai/decisions/DDR-013-server-modular-split-typescript.md` — module boundaries + TypeScript adoption.
- `.ai/decisions/DDR-014-css-layer-architecture.md` — `@layer` ordering rationale.
- `.ai/decisions/DDR-015-per-platform-binary-distribution.md` — `optionalDependencies` sub-package pattern; why not single tarball; CI release-matrix design.
- `.ai/decisions/DDR-016-runtime-folder-purpose.md` — outcome of the `runtime/` audit.

### Documentation (external — opened during research)

- [React 19 release notes](https://react.dev/blog/2024/12/05/react-19) — features available natively (no compat layer needed).
- [esbuild getting started](https://esbuild.github.io/getting-started/) — IIFE + ESM dual output.
- [Lightning CSS](https://lightningcss.dev/) — `@layer` support + OKLCH fallbacks + minification.
- [`@parcel/watcher`](https://github.com/parcel-bundler/watcher) — native macOS FSEvents wrapper; used by Tailwind/Nx/Nuxt.
- [Vite HMR API](https://vite.dev/guide/api-hmr) — pattern reference for the custom HMR (not the implementation).
- [`web.dev` iframe lazy-loading](https://web.dev/articles/iframe-lazy-loading) — `loading="lazy"` semantics.
- [`debugbear` content-visibility](https://www.debugbear.com/blog/content-visibility-api) — ~80% initial render work cut.
- [Node memory tuning](https://nodejs.org/learn/diagnostics/memory/understanding-and-tuning-memory) — `--max-old-space-size`, `FinalizationRegistry`, weakrefs.

### Patterns to Follow

- Keep zero-runtime-dependency philosophy on the **server** side: Bun's recursive `fs.watch` replaces `@parcel/watcher` (Bun's macOS FSEvents wrapper is reliable). All new deps (`react ^19`, `react-dom ^19`, `lightningcss`) are `devDependencies` consumed at build time and bundled into `dist/` by `Bun.build`.
- Build-then-publish, never publish-then-build. `prepublishOnly` already runs version parity; extend it to also run `pnpm --filter dev-server build` so a fresh `dist/` lands in every tarball.
- Inline all build-time deps via esbuild `--bundle`. End user's `node_modules/@1agh/md-claude/` after `npm i -g` contains the bundle + bins, nothing more.

---

## Research Summary

> 2026-05-15 external deep-research (≈ 14 WebSearch queries) cross-referenced with this repo's [`research-runtime.md`](../docs/research-runtime.md). Top recommendations:

### TL;DR — 4 biggest wins

1. **Bun-compile standalone binary** removes the "Node installed?" prereq entirely. 4× HTTP, 1.7× WS, 40 % less RAM per socket — and cold-start ~10-30 ms instead of ~50-100 ms.
2. **Kill babel-standalone + UMD React → ship `Bun.build`-produced React 19 bundle.** ~110 KB gz (babel-standalone CDN parsed in-browser) → ~25-35 KB gz (React 19 tree-shaken by `Bun.build`). First paint drops from ~1.5 s to ~350 ms. Single runtime shared with Phase 3.6 canvases (DDR-012).
3. **Lazy-mount iframes via `IntersectionObserver` + `content-visibility: auto`.** ~80 % less initial render work; frees the main thread so Phase 4's Pixi pan/zoom stays at 60 fps.
4. **Bun `--smol` flag + `FinalizationRegistry` for iframe-injected inspector state.** Prevents the 300–500 MB 8 h-session creep; idle RAM target lands at < 80 MB (relaxed from earlier draft per DDR-012).

### Runtime decision — Bun authoritative (revised 2026-05-15)

Prior research (`.ai/docs/research-runtime.md`, 2026-05-12) recommended "Stay Node, Bun side-channel via GitHub Releases." This is **superseded** by the Option-B decision (2026-05-15) — see DDR-009.

- **Bun 1.3.x as the runtime:** 4× HTTP throughput vs Node, 1.2 M concurrent WS connections vs `ws`'s 680 K, ~40 % less RAM per socket. Native WebSocket support in `Bun.serve` drops the handwritten upgrade. `Bun.file` / `Bun.write` are lazy + zero-copy where the kernel allows. Source: [bun docs](https://bun.com/docs/runtime), [lemire WebSocket benchmark](https://lemire.me/blog/2023/11/25/a-simple-websocket-benchmark-in-javascript-node-js-versus-bun/).
- **`bun build --compile` for distribution:** produces a standalone ~50-80 MB binary per `--target=bun-<platform>`. Includes JSCore + Bun runtime + bundled JS. No JIT warm-up cost — the binary starts in ~10-30 ms. Source: [bun executables docs](https://bun.com/docs/bundler/executables).
- **npm distribution via `optionalDependencies` sub-packages:** main package `@1agh/md-claude` ships only a tiny shim + manifest; npm installs the matching `@1agh/md-claude-<platform>` sub-package per the user's `process.platform + process.arch`. Pattern lifted from esbuild / @swc/core / biome — battle-tested in production.
- **Strategic alignment + verified precedent:** md-claude is a Claude Code plugin marketplace. Background investigation 2026-05-15 of the actual `@anthropic-ai/claude-code@2.1.142` npm tarball **confirms** Anthropic ships Claude Code itself as a `bun build --compile` standalone binary via npm `optionalDependencies` sub-packages, with a 500-byte stub bin + postinstall-hardlink pattern. Their `install.cjs` line 180 reads "Same pattern as Bun's npm package" — this is Bun-official. Our distribution model in Task 12 + Task 13 mirrors theirs verbatim (incl. musl variants for Alpine + Rosetta 2 detection).
- **Trade-off accepted:** Bun's tail risk (`research-runtime.md` § "Known issues to watch" — Bun-Express hang, Prisma leak, 758 open crash issues per HN thread Sept 2025). Our code uses only the documented-stable Bun surface (`Bun.serve`, `Bun.file`, `Bun.write`, `Bun.spawn`, `bun:test`, `node:path`, `node:url`); none of the reported crash classes apply. Mitigation: pin a known-good Bun version in CI, snapshot every minor release in a perf-canary job.
- **No Node fallback** (DDR-015). If Bun breaks the world, we pin to the prior Bun release until upstream lands a fix; we do **not** maintain a parallel Node port. This is the trade-off the user explicitly accepted for Option B.

### Build tool

- `Bun.build` (JS API): bundles client JSX → IIFE; handles TS/JSX/CSS natively; comparable speed to esbuild (~0.8 s for ~500 modules); zero extra toolchain since Bun is already the runtime.
- `bun build --compile`: standalone-binary compiler with cross-platform `--target=bun-<platform>` (darwin-arm64, darwin-x64, linux-x64, win32-x64).
- esbuild: previously considered; redundant when Bun is the runtime.
- **Decision:** `Bun.build` for client + `bun build --compile` for server binary. One toolchain. Source: [Bun bundler executables docs](https://bun.com/docs/bundler/executables).

### UI framework

- React 18 UMD (current): 40 KB core gz + 150 KB babel-standalone parse cost.
- Preact + `preact/compat`: 5 KB gz total, drop-in JSX, ~30–40 % lower RAM — but agent codegen surface + Radix/shadcn handoff path want native React; dual-runtime complexity compounds.
- React 19 via `Bun.build` (npm `react` + `react-dom`, tree-shaken): ~25-35 KB gz, no compat shim, agent training-data parity, shadcn registry handoff parity.
- Solid / Svelte: faster runtime but full rewrite.
- **Decision:** **React 19 everywhere — shell + canvases unified** (DDR-012). The Preact bundle/RAM win didn't justify dual-runtime complexity (see DDR-012's rationale section). Bundle is tree-shaken; Phase 3.6 canvases reuse the same runtime bundle.

### CSS strategy

- Hand-rolled (current): 1400 LOC, unstructured.
- Lightning CSS: Rust, native `@layer` support, OKLCH→fallback automatic, microsecond rebuilds. Used by Tailwind v4 Oxide engine.
- **Decision:** Lightning CSS at build time + `@layer reset, tokens, layout, shell, components, utilities`. Zero runtime cost, free fallbacks. DDR-014. Source: [lightningcss.dev](https://lightningcss.dev/).

### File watching

- `node:fs.watch` on Node: unreliable on macOS, no recursive filenames.
- `node:fs.watch` on Bun: re-implemented native, recursive works on macOS via FSEvents, no extra dep needed.
- `@parcel/watcher`: previously considered, no longer required.
- **Decision:** Bun's built-in `fs.watch(root, { recursive: true })`. Zero runtime deps. Source: Bun docs node:fs compat.

### WebSocket

- Handwritten upgrade (current): zero deps, works, but ~150 LOC of RFC-6455 to maintain.
- `Bun.serve` native WebSocket: built-in `websocket: { open, message, close, drain }` handlers; protocol concerns handled by the runtime.
- **Decision:** `Bun.serve` native WS. Drops the handwritten upgrade entirely. 1.7× perf headroom for Phase 8 collab.

### HMR

- Vite HMR: assumes Vite owns the server.
- Custom WS HMR: reuse existing inspector socket, broadcast `module-update`, dynamic `import()` the new module, patch parent component tree only; iframes opt out so inspector state persists.
- **Decision:** Custom HMR over existing WS. Pattern reference: [Vite HMR API](https://vite.dev/guide/api-hmr).

### Memory hygiene

- `bun --smol` flag at process start → low-memory mode, more aggressive GC (Bun docs).
- `FinalizationRegistry` + `WeakRef` map for iframe → inspector-state (so closing a tab GCs the script context). Works on JSCore identically to V8.
- `Bun.gc(true)` in tests to force a sync GC and assert leak-free.
- Single parent `MutationObserver` instead of N per-iframe.
- Throttle inspector message rate per-iframe.

### Iframe perf

- `loading="lazy"` + `IntersectionObserver` to *unmount* iframes outside viewport.
- `content-visibility: auto` + `contain-intrinsic-size` on iframe wrappers (~80 % initial render work cut).
- Sources: [web.dev iframe lazy-loading](https://web.dev/articles/iframe-lazy-loading), [debugbear content-visibility](https://www.debugbear.com/blog/content-visibility-api).

### Cross-cutting risks

- React 19 ecosystem: validate that `app.jsx`'s existing React 18-pattern code transpiles cleanly under React 19 (no breaking changes expected; `useId`/`Suspense`/`flushSync`/concurrent features all forward-compat). No compat shim needed.
- Adding a build step breaks "edit `app.jsx` and reload" → mitigated by `--watch` mode in dev.
- **Bun lock-in (DDR-015):** no Node fallback. If a Bun release breaks our hot path, we pin to prior known-good Bun until upstream fixes. Mitigation: nightly CI perf-canary job runs against `bun-latest`; any > 5 % regression on the perf-harness budgets opens a tracking issue.
- **Per-platform binary publishing matrix:** four sub-packages (`@1agh/md-claude-darwin-arm64` etc.) must publish atomically per release tag. Mitigation: `.github/workflows/build-binaries.yml` uses `npm publish --provenance` on all five packages (main + 4 sub) in a single workflow with `needs:` dependencies; any failure aborts the whole publish.
- Inlining tokens import from `.design/system/project/colors_and_type.css` at build time couples the bundle to the DS file path; document and DDR if path changes.
- **Bun on Windows is younger** than darwin/linux — Win32 binary may surface edge cases first. Mitigation: explicit Windows smoke test in `binary-smoke.test.ts`; if Windows is broken at v1.0 release, ship the other three and flag Windows as "preview".

---

## Tasks

> Execute in order. Each task is independently revertible — land them as separate commits in the same PR, or as separate PRs gated by a feature flag in `package.json` `scripts`. Run perf harness (Task 11) after each.

### Task 1: AUDIT `runtime/` folder — purpose split

- **Do:** Read both files (`runtime/design-canvas.jsx` 39 KB, `runtime/tweaks-panel.jsx` 18 KB). Trace imports + references in `server.mjs` and `app.jsx`. Decide one of three:
  - **(a)** They are design canvases (meta-mocks of the dev-server itself) — move them to `.design/ui/`, drop the `runtime/` folder.
  - **(b)** They are runtime code (panels/canvases injected at runtime into the user's `.design/`) — keep but rename to `client/panels/` and modularize.
  - **(c)** Mixed — split per-file.
- **Pattern:** Check git log on both files; check what `app.jsx`'s `<Viewport>` mounts; check whether `server.mjs` serves them.
- **Gotcha:** Commit history hints they're meta-design (`5864f71` = "meta-design of dev-server canvas viewport states"). Don't assume — verify.
- **Validate:** DDR-016 written with the chosen path; file tree moved; no broken references.

### Task 2: ADD Bun toolchain + deps + npm scripts

- **Do:**
  - **CI/dev prereq:** install Bun via `curl -fsSL https://bun.sh/install | bash` in CI runner setup; document in CONTRIBUTING.md that local development requires Bun ≥ 1.3.
  - In `plugins/design/dev-server/package.json`:
    - `devDependencies`: `@types/bun ^1`, `bun-types ^1`, `react ^19`, `react-dom ^19`, `@types/react ^19`, `@types/react-dom ^19`, `lightningcss ^1.27`.
    - `dependencies`: **none** (Bun + binary self-contained; client deps are bundled).
    - `scripts`: `"build": "bun run build.ts"`, `"build:watch": "bun run --watch build.ts"`, `"test": "bun test"`, `"typecheck": "bun tsc --noEmit"`.
  - Root `package.json`: add `"engines": { "bun": ">=1.3" }` alongside the existing Node engine (Node still needed for the `mdcc.mjs` shim and the rest of the npm tooling).
  - Root `packageManager`: keep `pnpm@11` (Bun is the runtime, not the package manager — pnpm still resolves npm tarballs).
- **Pattern:** Bun's official docs on TS + tsconfig + bun-types.
- **Validate:** `bun --version` ≥ 1.3 in CI; `bun run build.ts --dry-run` exits 0; `pnpm install` still resolves (pnpm is unaffected).

### Task 3: ADD `build.ts` — Bun-driven build orchestrator

- **Do:** Write `build.ts` driving three steps:
  - **(a) Client bundle:** `await Bun.build({ entrypoints: ['client/app.jsx'], outdir: 'dist', target: 'browser', format: 'iife', minify: true, sourcemap: env === 'dev' ? 'inline' : 'none', define: { 'process.env.NODE_ENV': JSON.stringify(env) } })`. JSX is auto-detected by Bun; `jsxImportSource: "react"` is the default. No alias config — npm `react` + `react-dom` resolve natively. Tree-shaking yields ~25-35 KB gz (React 19 + ReactDOM + shell code).
  - **(b) CSS bundle (Lightning CSS, called from `build.ts` via `lightningcss` API):** input `client/styles/_index.css` → `dist/styles.css`, minified, OKLCH fallbacks emitted, `@layer` flattening preserved.
  - **(c) Server binary per platform:** for each `target` in `['bun-darwin-arm64', 'bun-darwin-x64', 'bun-linux-x64', 'bun-windows-x64']`, spawn `Bun.spawn(['bun', 'build', '--compile', '--target=' + target, '--outfile=dist/mdcc-' + platformSlug(target), 'server.ts'])`. In dev mode (`--watch`), skip compile and just run `bun --watch server.ts` for hot iteration.
  - **Watch mode** (`--watch`): client and CSS contexts re-run on file change; server runs via `bun --watch server.ts` so iteration is sub-second. On rebuild, broadcast `{ type: 'module-update', path, hash }` over the inspector WS (Task 9).
- **Pattern:** [Bun bundler executables](https://bun.com/docs/bundler/executables) for `--compile`; [Bun.build API](https://bun.com/docs/bundler) for the in-process JS API.
- **Gotcha:** `bun build --compile` cross-compile may need an x64 emulation fallback on ARM CI runners — current `bun build --compile --target=bun-linux-x64` from an arm64 host works per Bun docs, but verify before relying on it in `.github/workflows/build-binaries.yml`. If cross-compile is flaky, the matrix workflow already gives us a native runner per platform.
- **Gotcha 2:** `Bun.build` can't resolve `.css` `@import` chains outside `client/`. Lightning CSS handles that in step (b).
- **Validate:** `bun run build.ts` produces `dist/client.bundle.js` (~50–60 KB gz target) + `dist/styles.css` + `dist/mdcc-<current-platform>`. `./dist/mdcc-darwin-arm64 design serve --port 4399` boots in < 100 ms.

### Task 4: MIGRATE `app.jsx` from React UMD to React 19 esm imports

- **Do:** Replace `app.jsx`'s reliance on `window.React` / `window.ReactDOM` UMD globals with explicit imports: `import { useState, useEffect, ... } from 'react'`; `import { createRoot } from 'react-dom/client'`. `Bun.build` resolves these to the npm packages and tree-shakes unused surface. JSX `jsxImportSource: "react"` is Bun's default — no extra config.
- **Do:** Update the mount call site to use `createRoot(domNode).render(<App />)` (React 18+ API; works under React 19).
- **Pattern:** Standard React 19 esm pattern. `Bun.build` handles bundling; nothing exotic.
- **Gotcha:** If `app.jsx` does `React.createElement(...)` instead of JSX in any spot, those calls need `import { createElement } from 'react'`. Grep first.
- **Gotcha 2:** React 19 removed `ReactDOM.render` (the React 18 legacy API). If `app.jsx` uses it (it might — current shell is React-18-shape), switch to `createRoot`. Five-minute change.
- **Validate:** `Bun.build` succeeds with no warnings; manual smoke-test boots dev-server, file tree renders, theme toggle works, comment thread opens — same behavior as the current Babel-standalone version, just on real React 19 with tree-shaken bundle.

### Task 5: UPDATE `index.html` — drop unpkg scripts, load bundle

- **Do:** Remove the React UMD + React-DOM UMD + babel-standalone `<script>` tags (lines 9–11). Add `<script type="module" src="/_client/client.bundle.js"></script>` plus `<link rel="stylesheet" href="/_client/styles.css">`.
- **Pattern:** Single bundle, single stylesheet, zero CDN.
- **Validate:** Network tab shows two requests (HTML, bundle, stylesheet — three actually), no `unpkg.com` calls. DevTools Performance recording cold start < 800 ms.

### Task 6: REFACTOR `styles.css` → `client/styles/` with `@layer` + Lightning CSS

- **Do:**
  - Create the six `client/styles/N-*.css` files described in "Files to Create".
  - Move declarations from current `styles.css` into the right layer (reset / tokens / layout / shell / components / utilities).
  - `1-tokens.css` does `@import url('../../../system/project/colors_and_type.css');` (path resolves to `.design/system/project/colors_and_type.css` from the dev-server workspace).
  - `_index.css` declares the layer order: `@layer reset, tokens, layout, shell, components, utilities;` then imports the six files.
  - Extend `build.mjs` to call Lightning CSS on `_index.css` → `dist/styles.css`. Lightning options: `minify: true`, `targets: { chrome: 110, safari: 16, firefox: 110 }`, `drafts: { customMedia: true }`.
- **Pattern:** Lightning CSS handles OKLCH→sRGB fallbacks automatically and emits minified single-file output.
- **Gotcha:** `@layer` ordering is global per document — the `_index.css` `@layer reset, tokens, layout, shell, components, utilities;` declaration sets the cascade priority. Component-level styles can still use `@layer components { ... }` inside their own files; Lightning CSS merges identically-named layers correctly.
- **Validate:** `dist/styles.css` builds; visual diff vs baseline (open dev-server before/after — no visible regression); `wc -l dist/styles.css` confirms one combined output.

### Task 7: MODULARIZE + REWRITE `server.mjs` → seven TypeScript modules on Bun.serve

- **Do:** Rewrite `server.mjs` (1288 LOC Node) into seven `.ts` files on the Bun runtime:
  - `server.ts` (≤ 150 LOC) — entry, `Bun.serve({ port, fetch, websocket, error })` lifecycle, `_server.json` write via `Bun.write`, root resolution (`process.argv` + `Bun.env`).
  - `http.ts` (≤ 200 LOC) — exports a `routes: Record<string, RouteHandler>` map consumed by `Bun.serve({ routes })` (Bun ≥ 1.3 routing API): `GET /`, `GET /_client/*` (serves `Bun.file('dist/client.bundle.js')`), `GET /_design/*` (serves files from the user's `.design/` root), `GET /<canvas>.html`, plus a top-level `fetch(req)` as static fall-through. **Designed for extension** — Phase 3.6 adds `'/ui/:slug'` + `'/_bun_hmr'` as additional keys without rewriting this module.
  - `ws.ts` (≤ 100 LOC) — exports the `websocket: { open, message, close, drain }` handlers object for `Bun.serve`. Per-connection state stored on `ws.data` (Bun's typed websocket data slot). **Drops handwritten RFC-6455 upgrade** — saves ~150 LOC.
  - `api.ts` (≤ 300 LOC) — `/api/*` JSON endpoints. Each handler returns `Response` (`Response.json(...)` shortcut).
  - `inspect.ts` (≤ 200 LOC) — active-canvas / selected-element protocol; `_active.json` writer via `Bun.write`; inspector-script injection text.
  - `history.ts` (≤ 150 LOC) — `_history/<slug>/` snapshot writer via `Bun.write` + rollback reader via `Bun.file().text()`.
  - `fs-watch.ts` (≤ 80 LOC) — wraps `fs.watch(root, { recursive: true })` (Bun's recursive macOS support works out of the box). Emits events to subscribers (HTTP layer triggers `_active.json` writes, HMR triggers bundle rebuild signal).
- **Pattern:** Single-responsibility per module; no cross-module mutable state — communicate via a `Context` object passed to each module's factory function (`createHttp(ctx)`, `createWs(ctx)`, ...).
- **Gotcha:** Bun's WebSocket API uses `ws.data` for per-connection state, not closures. Migrate the existing handwritten per-socket FSM accordingly.
- **Gotcha 2:** `Bun.file(path)` is lazy — `await file.text()` actually reads. Make sure every call site `await`s; missing-`await` is a silent bug.
- **Gotcha 3:** Bun's `Response.json()` sets content-type automatically; the existing manual `'content-type': 'application/json'` headers go.
- **Gotcha 4:** No ESM cycles. `server.ts` imports the six; the six only import `mem.ts` (Task 8) + `bun` + `node:path`.
- **Validate:** All existing smoke flows still work (boot, open canvas, Cmd+click, rollback). Diff `_server.json` schema = 0. `wc -l` each module ≤ 300. `bun tsc --noEmit` passes.

### Task 8: ADD `mem.ts` — Bun heap discipline + FinalizationRegistry

- **Do:**
  - **(a) `--smol` flag at process start:** Bun standalone binaries can pass runtime flags via `BUN_OPTIONS` env var or embed them at compile time. Decision: embed `--smol` via `bun build --compile --smol` (verify flag is honored by compile; if not, set `BUN_OPTIONS=--smol` in the binary wrapper).
  - **(b)** `mem.ts` exports `registerIframe(iframeId, cleanupFn)` that registers `cleanupFn` against a `FinalizationRegistry`; `inspect.ts` calls it whenever a tab closes / canvas unmounts. The registry's callback fires when the iframe-scoped state object is GC'd, dropping any held WS subscriptions.
  - **(c)** Replace any `Map<id, fullState>` keyed on iframe ID with `Map<id, WeakRef<fullState>>` where lookups null-check the deref.
  - **(d)** Add a `heapCheck()` helper called every 60 s — reads `process.memoryUsage().heapTotal`, logs to stderr if > 256 MB, force-GC via `Bun.gc(true)` if > 384 MB.
- **Pattern:** Bun runtime docs on `--smol` + `Bun.gc()` + standard `FinalizationRegistry` usage.
- **Gotcha:** `FinalizationRegistry` callbacks are not guaranteed; if a callback MUST run, also wire an explicit `cleanupFn` invoked on the `iframe:closed` WS event. The registry is the safety net, not the primary path.
- **Gotcha 2:** Bun's `Bun.gc(true)` (sync) is expensive — only call in tests or the > 384 MB emergency branch, never per-request.
- **Validate:** 8 h soak test (Task 11's harness) → idle RAM stays < 80 MB. Open/close 20 canvases in sequence → resident RSS returns to within 5 MB of baseline after 60 s. `Bun.gc(true)` in a test confirms no FinalizationRegistry callbacks pending.

### Task 9: ADD `client/hmr.mjs` — WS-driven HMR (parent shell only)

> **Scope clarification:** this HMR is **for the shell chrome only** (`Header`, `Tree`, `Tabs`, `SystemView`, `CommentsPanel`, the surrounding CSS layers). It does NOT cover canvas-content HMR — that arrives in **Phase 3.6** via Bun's native `import.meta.hot` + `/_bun_hmr` socket, scoped to the canvas TSX route. The two HMR systems run side-by-side on different routes / sockets; the shell HMR socket carries `module-update` events for the bundled client, the `/_bun_hmr` socket (Phase 3.6) carries Vite-compatible `bun:beforeUpdate` / `bun:afterUpdate` events for canvas TSX files.

- **Do:**
  - Client-side: open the existing inspector WS (or piggyback). On message `{ type: 'module-update', path, hash }`: dynamic `import(path + '?v=' + hash)` the rebuilt module, traverse the parent component tree, swap mountable components in-place. Iframes opt out: any module path under `client/iframe-injected/` (the inspector script) is skipped — the iframe document stays as-is.
  - Server-side: `build.mjs --watch` writes a manifest to `dist/.hmr-manifest.json` after each rebuild; `fs-watch.mjs` watches `dist/` and broadcasts `module-update` over WS to all clients.
  - On full-page state changes (e.g. token block in `1-tokens.css` changed) → live-reload via CSS-only path (re-fetch `dist/styles.css`); never reload the document.
- **Pattern:** [Vite HMR API](https://vite.dev/guide/api-hmr) — adapt the `accept`/`dispose`/`invalidate` triad to your custom socket.
- **Gotcha:** React 19's Fast Refresh keeps component identity stable on dynamic re-import IF the component is module-level + named. Use the existing React Fast Refresh runtime (Bun ships it for HMR; opt in via `import.meta.hot.accept()` in the patched modules). For shell components (Tree, Tabs, Header) this works out of the box.
- **Gotcha 2:** First implementation should be CSS-only HMR (zero risk) + full-page reload for JSX. Add JSX patching incrementally.
- **Validate:** Edit `client/app.jsx`'s `Header` component (e.g. swap an icon path), save → toolbar updates in < 200 ms, inspector WS connection stays alive, selected element in canvas iframe is still selected.

### Task 10: ADD `client/iframe-lazy.mjs` — IntersectionObserver lazy mount

- **Do:**
  - `iframe-lazy.mjs` exports `mountLazy(host, src)` — creates an `<iframe>` with `loading="lazy"`, wraps in a `<div style="content-visibility: auto; contain-intrinsic-size: 1280px 720px;">`. Registers the wrapper with a shared `IntersectionObserver`; when the wrapper is intersecting, the iframe gets `src`; when it leaves viewport for > 30 s, the iframe `src` is cleared (its state is saved to a `Map<wrapperId, lastScrollX/Y + selectedElement>`).
  - `app.jsx`'s `<Viewport>` calls `mountLazy` for each artboard.
- **Pattern:** Mapping-library "level of detail" + `web.dev`'s lazy iframe guide.
- **Gotcha:** When Phase 4 ships Pixi, the lazy logic moves to the Pixi viewport controller (it knows world coords). For Phase 3.4 the shell only has a flexbox list, so a simple IO suffices.
- **Gotcha 2:** Clearing `iframe.src` resets the document — losing inspector state. Preserve state in the parent Map; re-inject on re-mount.
- **Validate:** Open a canvas with 10 artboards. Scroll so 8 are off-screen. DevTools Performance: ~80 % less render time vs baseline. RAM held by off-screen iframes drops to near-zero.

### Task 11: ADD perf harness + `bun:test` suite

- **Do:**
  - `test/perf-harness.ts` — agent-browser script that boots `dist/mdcc-<platform> design serve`, opens a synthetic 10-canvas / 100-artboard fixture, measures all the budgets from the table (cold start, theme toggle, tree open, etc.). Outputs `test/perf-report.json` + a one-line summary.
  - Seven smoke tests (listed in Files to Create above, all `.test.ts`) — each runs in < 1 s, `bun test` returns 0. Tests use `bun:test` (`import { describe, test, expect } from 'bun:test'`).
  - **Binary smoke gate:** `binary-smoke.test.ts` is the gate before any release tag — it spawns the compiled binary and verifies `--version`, `--help`, and a 50 ms `mdcc design serve` boot.
  - Hook the harness into CI as a non-blocking job (record results in PR comments; only block if a regression > 20 % from baseline).
- **Pattern:** `bun:test` is API-compatible with `node:test` enough that tests are portable in theory; use `bun:test` here because we control the runtime.
- **Validate:** All seven smoke tests pass with `bun test`; perf harness records baseline; CI green on all four platforms.

### Task 12: ADOPT Claude Code's postinstall-overwrite distribution pattern

> **2026-05-15 update:** background investigation of the actual `@anthropic-ai/claude-code` npm tarball (v2.1.142) revealed Anthropic uses a **strictly faster** pattern than the `execFileSync` runtime shim originally drafted here. Adopt their pattern verbatim — it eliminates per-invocation Node startup cost, which is the whole point of the Bun migration.

- **Do:**
  - **(a) Main package bin = a 500-byte ASCII stub** named `cli/bin/mdcc.exe` (the `.exe` extension is intentional on all OSes — makes npm's `cmd-shim` emit a direct exec on Windows; Unix ignores the extension). The stub prints a helpful error if postinstall didn't run:
    ```sh
    #!/bin/sh
    echo "@1agh/md-claude: postinstall did not complete. Run \`npm rebuild @1agh/md-claude\` or reinstall." >&2
    exit 1
    ```
    Root `package.json` `bin: { "mdcc": "cli/bin/mdcc.exe" }`. (The old `cli/bin/mdcc.mjs` Node entry is **deleted** — it's now the binary directly.)
  - **(b) `cli/install.cjs` (new — runs as postinstall):** resolves the matching `@1agh/md-claude-<platform>` sub-package via `require.resolve`, then **hardlinks** the platform's `mdcc` binary over `cli/bin/mdcc.exe` (`fs.linkSync` first; `fs.copyFileSync` fallback if cross-volume). After postinstall, invoking `mdcc` execs the native binary directly with **zero Node overhead at runtime**. Platform detection logic:
    - Read `process.platform` + `process.arch`.
    - On Linux, detect `glibc` vs `musl` via `process.report.getReport().header.glibcVersionRuntime`; pick the right sub-package.
    - On macOS, if `process.arch === 'x64'` AND the host is Apple Silicon (detect via `sysctl.proc_translated`), prefer the arm64 binary — Rosetta 2 lacks AVX which Bun's x64-compile output requires.
  - **(c) `cli/cli-wrapper.cjs` (new — fallback):** for users who install with `npm install --ignore-scripts` (corporate policy), this is a tiny `spawnSync` shim that performs platform detection on every invocation. Slower path, but covers the ~5 % of users who block postinstalls. `package.json` `bin: { "mdcc-safe": "cli/cli-wrapper.cjs" }` exposes it as a parallel entry; README documents it for `--ignore-scripts` users.
  - **(d) Sub-packages — six, not four:** Create `packages/md-claude-<slug>/` for each of:
    - `darwin-arm64`, `darwin-x64`
    - `linux-x64`, `linux-arm64`
    - `linux-x64-musl`, `linux-arm64-musl` (Alpine / distroless — Claude Code ships these separately)
    - `win32-x64`
    - Optionally `win32-arm64` if Bun's Windows-ARM target is stable; otherwise skip.
    Each sub-package's `package.json` has `name: "@1agh/md-claude-<slug>"`, `version: "<root version>"`, `os` + `cpu` fields restricting npm install to matching hosts (musl variants use `libc: ["musl"]`), `files: ["mdcc"]`. The binary is named `mdcc` (no extension) inside the sub-package; the postinstall hardlinks it over the main package's `mdcc.exe`.
  - **(e) Main package `optionalDependencies`:** Add all 6-7 sub-packages pinned to the wrapper version. npm installs only the matching one per `os` / `cpu` / `libc`.
  - **(f) Root `files`:** ship `cli/bin/mdcc.exe`, `cli/install.cjs`, `cli/cli-wrapper.cjs`, `plugins/flow/templates/`, the flow config schema, `LICENSE`, `README.md`. **Drop** `plugins/design/dev-server/` (binaries ship via sub-packages).
  - **(g) Root `scripts.postinstall: "node cli/install.cjs"`** (only fires on user installs, not in our own dev tree — guard with `if (process.env.MD_CLAUDE_SKIP_POSTINSTALL || isLocalDev())`).
  - **(h) `scripts.prepublishOnly`:** extend to `"bash scripts/check-version-parity.sh"`. CI workflow (Task 13) handles per-platform compile + sub-package publishing; local `npm publish` is no longer the release path.
- **Pattern:** Confirmed against `@anthropic-ai/claude-code@2.1.142` tarball — exactly this shape. Comment on line 180 of their `install.cjs` reads "Same pattern as Bun's npm package", so this is Bun-official too. The plan's earlier `execFileSync` shim approach (esbuild/swc/biome style) is superseded by this **hardlink-and-disappear** approach.
- **Gotcha:** `--ignore-scripts` installs skip postinstall — the 500-byte stub will exit with the helpful error. The `mdcc-safe` bin via `cli-wrapper.cjs` covers that case.
- **Gotcha 2:** Hardlink fails across filesystems (e.g. when `node_modules` is on a different volume than the npm cache) — `fs.copyFileSync` fallback is mandatory.
- **Gotcha 3:** `npm pack --dry-run` on the root tarball stays small (~15 KB like Claude Code's ~14 KB). Per-platform sub-package tarballs are ~50-60 MB gzipped (Claude Code's darwin-arm64 is 59 MB / 207 MB unpacked).
- **Gotcha 4:** Rosetta 2 detection on macOS — `sysctl -n sysctl.proc_translated` returns 1 if Node is running under Rosetta. Prefer arm64 binary in that case.
- **Validate:**
  - `npm pack --dry-run` shows tiny main tarball (≤ 20 KB) + per-platform sub-tarballs sized as expected.
  - Local `npm i -g .` works in a scratch dir; postinstall hardlinks the right binary; `mdcc --version` execs the native binary directly (verify via `ps` — no Node process for the actual call).
  - `mdcc design serve` boots in < 100 ms (no Node startup tax).
  - Test on Apple Silicon under Rosetta (`arch -x86_64 node ...`): arm64 binary should be selected.
  - Test on Alpine container: musl variant should be selected.

### Task 13: ADD `.github/workflows/build-binaries.yml` — per-platform release matrix

- **Do:** Create release-tag-triggered (`on: push: tags: ['v*']`) workflow with a 7-entry matrix:
  ```yaml
  strategy:
    fail-fast: false   # let other platforms succeed even if Windows fails
    matrix:
      include:
        - os: macos-14
          target: bun-darwin-arm64
          slug: darwin-arm64
        - os: macos-13
          target: bun-darwin-x64
          slug: darwin-x64
        - os: ubuntu-22.04
          target: bun-linux-x64
          slug: linux-x64
        - os: ubuntu-22.04-arm
          target: bun-linux-arm64
          slug: linux-arm64
        - os: ubuntu-22.04
          container: alpine:3.20
          target: bun-linux-x64-musl
          slug: linux-x64-musl
        - os: ubuntu-22.04-arm
          container: alpine:3.20
          target: bun-linux-arm64-musl
          slug: linux-arm64-musl
        - os: windows-2022
          target: bun-windows-x64
          slug: win32-x64
  steps:
    - checkout
    - oven-sh/setup-bun@v2 (bun-version: 1.3.x pinned)
    - bun install
    - bun run plugins/design/dev-server/build.ts --release --target=${{ matrix.target }}
    - cp dist/mdcc packages/md-claude-${{ matrix.slug }}/   # binary always named `mdcc` inside sub-pkg
    - cd packages/md-claude-${{ matrix.slug }} && npm publish --provenance --access public
    - upload binary as GitHub Release asset
  ```
  Then a `publish-main` job with `needs: [build-binaries]` that publishes the main `@1agh/md-claude` package (stub + install.cjs + cli-wrapper.cjs) only after all sub-packages are live.
- **Pattern:** [esbuild's release workflow](https://github.com/evanw/esbuild/blob/main/.github/workflows/release.yml) is the reference shape.
- **Gotcha:** GitHub Actions ARM macOS runners (`macos-14`) are paid minutes; budget accordingly. If cost is a concern, cross-compile darwin-arm64 from a darwin-x64 runner — but verify `bun build --compile --target=bun-darwin-arm64` works cross-arch first.
- **Gotcha 2:** npm provenance (`--provenance`) requires a public repo + npm 9.5+; both are fine here.
- **Validate:** Tag a `v0.13.0-test` pre-release, watch the workflow run, confirm all 5 packages (4 sub + 1 main) publish, confirm `npm i -g @1agh/md-claude@0.13.0-test` works on each platform.

### Task 14: WRITE 5 DDRs (DDR-009 already landed)

> Each DDR is short (≤ 100 lines), follows `.ai/decisions/README.md` schema. Land each in the same commit as the matching task — or batch at the end if cheaper.

- **~~DDR-009~~:** ✅ Already written 2026-05-15 — [`DDR-009-bun-runtime-authoritative-for-dev-server.md`](../decisions/DDR-009-bun-runtime-authoritative-for-dev-server.md). Captures both the Bun-authoritative runtime choice AND the no-Node-fallback consequence (originally drafted as a separate DDR-015 in this plan; consolidated since the fallback acceptance is inseparable from the runtime choice).
- **~~DDR-012~~:** ✅ Landed 2026-05-15 — [`DDR-012-react-19-unified-runtime.md`](../decisions/DDR-012-react-19-unified-runtime.md). React 19 everywhere — shell + canvases unified. Three-draft pivot (Preact-only → hybrid → unified React 19) + the bundle/RAM-vs-complexity trade-off + the relaxed performance budgets.
- **~~DDR-013~~:** ✅ Landed 2026-05-15 — [`DDR-013-server-modular-split-typescript.md`](../decisions/DDR-013-server-modular-split-typescript.md). Server modular split into seven TypeScript modules on `Bun.serve`. Module-boundary contract + state ownership rules + why TS now.
- **~~DDR-014~~:** ✅ Landed 2026-05-15 — [`DDR-014-css-layer-architecture.md`](../decisions/DDR-014-css-layer-architecture.md). CSS `@layer` architecture: `reset, tokens, layout, shell, components, utilities`. Why this order; how token import works.
- **DDR-015:** Per-platform binary distribution via npm `optionalDependencies` sub-packages with postinstall-hardlink (Claude-Code pattern). Why not single fat tarball; CI release-matrix design; precedent (`@anthropic-ai/claude-code` + Bun npm package). _Pending — lands with Task 12-13._
- **~~DDR-016~~:** ✅ Landed 2026-05-15 — [`DDR-016-runtime-folder-purpose.md`](../decisions/DDR-016-runtime-folder-purpose.md). `runtime/` folder is the canvas-runtime library home (Task 1 audit verdict: not meta-design, not shell chrome; injected into user HTML pages via `/_runtime/*`).

### Task 15: UPDATE Phase 4 plan — remove Task 2 (build dist bundles) + add Bun runtime note

- **Do:** Edit `.ai/plans/phase-4-canvas-v2-rendering-engine.md`:
  - Delete Task 2 ("Build the dist bundles (client + server)") — moved here as Task 3 (Bun build orchestrator) + Task 12 (sub-packages) + Task 13 (CI matrix).
  - Update Task 1 ("Perf-prototype before committing to Pixi") so it explicitly runs **against** the new build pipeline (Bun.build + React 19), not against babel-standalone.
  - Update "Runtime-agnostic constraint" section (lines 22-24) — **no longer applicable**, runtime is now Bun authoritative. Remove the `node:*` purity constraint; Pixi.js code in Phase 4 can use Bun APIs in the build orchestrator but the client code stays browser-only.
  - Update "Depends on" → "Phase 3.4 (architecture refactor — Bun runtime + build pipeline + React 19 + perf budgets)".
  - Update "Affected files" — remove `build.mjs` (now `build.ts` created here) and the bundler-related package.json edits.
- **Validate:** Phase 4 plan reads as "pure rendering": Pixi shootout → stage + viewport controller → iframe positioning sync → layout persistence → minimap → migration → schema. No bundler talk, no runtime-agnostic constraint.

### Task 16: UPDATE Phase 3.5 plan — point at new pipeline

- **Do:** Edit `.ai/plans/phase-3.5-dev-server-ui-ux-refresh.md`:
  - "Dependencies" → add "Phase 3.4 must land first (Bun runtime + build pipeline + React 19 + token import path)".
  - Task 4 (Berkeley Mono webfont) — note that `index.html` is now the bundle-loading variant; the `<link>` goes there.
  - Task 5 (token bridge) — note that tokens already arrive via Lightning CSS `@import` in `1-tokens.css`; the bridge work becomes "ensure `--u-*` aliases live in the same layer".
- **Validate:** Phase 3.5 still scopes the visual refresh; no overlap with this plan.

---

## Validation

1. **Lint:** `biome check .` (already wired in root `package.json`).
2. **Types:** `bun tsc --noEmit` in the dev-server workspace passes.
3. **Tests:**
   - `bun test plugins/design/dev-server/test/**/*.test.ts` — all 7 green on every CI runner.
   - `node --test --test-reporter=spec cli/**/*.test.mjs` — existing CLI tests still green (shim is Node).
4. **Build:** `bun run plugins/design/dev-server/build.ts --release --target=bun-<host-platform>` succeeds; `dist/client.bundle.js.gz` < 80 KB; `dist/mdcc-<platform>` is a valid executable < 80 MB.
5. **Smoke:** `./dist/mdcc-<platform> design serve --port 4399 --root /tmp/scratch-design` boots in < 100 ms; `curl localhost:4399/_health` returns 200.
6. **Perf harness:** Task 11's harness runs end-to-end, records baseline, all budgets in the table pass.
7. **Cross-platform scenario:** `scenario-runner` web-desktop only (dev-server is desktop-only).
8. **A11y:** `flow:a11y-auditor` against `http://localhost:4399` — no new blockers vs baseline (this phase doesn't change visuals, only the runtime).
9. **Manual:**
   - 8 h soak test (leave dev-server open overnight against `/Volumes/D/git/dugmate/.design/`) — final RSS < 80 MB, no error logs.
   - Open / close 20 canvases in sequence — RAM returns to baseline within 60 s.
   - Edit `app.jsx`'s `Header` — toolbar updates in < 200 ms without losing inspector connection.
   - Edit `client/styles/4-components.css` — page restyles in < 100 ms, no reload.
   - Test against three real downstream repos (`dugmate`, plus two scratch projects) — no regression.

---

## Risk Register

| Risk | Mitigation |
| --- | --- |
| **Bun upstream regression breaks our hot path (no Node fallback per DDR-015)** | Pin Bun version in `engines.bun` + CI runners. Nightly perf-canary job against `bun-latest` flags regressions early. If a release-blocker lands, hold at the prior known-good Bun until upstream fixes. |
| **Per-platform binary cross-compile fails** (e.g. darwin-arm64 from x64 host) | Native runner per platform in the CI matrix (Task 13); cross-compile is an optimization, not a requirement. |
| **Windows binary edge cases** (Bun-Windows is youngest tier) | Explicit `binary-smoke.test.ts` on Windows; if release-blocking, ship the 3 working platforms and label Windows "preview" with GitHub Releases binary download as fallback. |
| **npm `optionalDependencies` resolution surprises** (esbuild has historically hit edge cases) | Shim has clear error message + diagnostic; documented installation troubleshooting in README. |
| **Tarball size hits npm warnings** (per-platform ~30-40 MB gz × 4) | Below npm's hard cap (~250 MB). Documented as expected; main package itself is < 1 MB. |
| React 19 ecosystem regression on `app.jsx` (unlikely — React 18→19 is largely additive) | Run `Bun.build` over current `app.jsx` early in Task 4; type-check + smoke-test before moving to Task 5. React 18 LTS available as a 10-minute pin-fallback if a blocking regression surfaces. |
| HMR JSX patching breaks component state | Land CSS-only HMR first (Task 9 Gotcha 2); JSX patching incremental + keyed by component identity. |
| Bun's recursive `fs.watch` regression on macOS | Falls back to manual polling in `fs-watch.ts` if `fs.watch` errors; documented in DDR-013. |
| Build step breaks "edit-and-reload" muscle memory | `bun --watch server.ts` for server + custom HMR for client keep the loop fast; document in README. |
| Lightning CSS rejects a token expression | Pin LCSS version + capture build log on first cut. |
| Perf budgets are aspirational, miss on real hardware | Budgets are gates per task; if a task can't hit its budget, replan before continuing. |
| Pulling Task 2 out of Phase 4 destabilizes Phase 4's task numbering | Task 15 explicitly re-numbers and re-grounds. |
| `runtime/` folder turns out to be load-bearing | Task 1 is the audit gate; nothing else proceeds until DDR-016 lands. |

---

## Scenario Coverage

| Scenario | Covers | Status |
|----------|--------|--------|
| `dev-server-cold-start-perf` | Boot dev-server → measure cold start, idle RAM, theme toggle, tab switch, tree open | 🆕 new (perf harness output is the scenario report) |
| `dev-server-8h-soak` | 8 h leave-running fixture; RAM resident sampled every 60 s; no error logs | 🆕 new (long-running, runs nightly in CI optionally) |
| `dev-server-hmr-roundtrip` | Edit `Header` component → confirm patch lands in < 200 ms with inspector connection intact | 🆕 new |

---

## Acceptance Criteria

- [ ] All 16 tasks completed; perf harness records all budgets met (see Performance Budgets table)
- [ ] `npm i -g @1agh/md-claude` on a clean machine **without Node installed beyond `node` to run the shim** results in a working `mdcc design serve` (the shim then execs the platform binary)
- [ ] React UMD + babel-standalone removed from `index.html`; cold start to HTTP 200 < 100 ms; cold start to first paint < 350 ms (relaxed per DDR-012)
- [ ] Bundle: `du -sh dist/client.bundle.js.gz` < 80 KB (relaxed per DDR-012)
- [ ] Per-platform binary: `du -sh dist/mdcc` < 80 MB for all seven platform builds (darwin-arm64, darwin-x64, linux-x64, linux-arm64, linux-x64-musl, linux-arm64-musl, win32-x64)
- [ ] postinstall-hardlink pattern: after `npm i -g @1agh/md-claude`, invoking `mdcc` is a direct exec of the native binary (no Node process resident — verify via `ps`)
- [ ] `--ignore-scripts` fallback works via `mdcc-safe` bin
- [ ] Rosetta 2 detection: x64 Node on Apple Silicon resolves to arm64 binary
- [ ] musl detection: Alpine container install resolves to the `-musl` variant
- [ ] `server.mjs` rewritten to 7 `.ts` modules on `Bun.serve`, none > 300 LOC, no ESM cycles, `bun tsc --noEmit` passes
- [ ] Bun `--smol` flag honored in compiled binary; 8 h soak < 80 MB RSS (relaxed per DDR-012)
- [ ] `FinalizationRegistry` + `WeakRef` cover iframe-scoped state; open/close 20 canvases → RSS returns to baseline within 60 s; `Bun.gc(true)` test confirms no pending callbacks
- [ ] CSS `@layer` architecture: 6 layers, declared once in `_index.css`; Lightning CSS produces single minified `dist/styles.css`
- [ ] Bun's recursive `fs.watch` covers `.design/` macOS rename events reliably (no `@parcel/watcher` dep)
- [ ] `Bun.serve` native WebSocket replaces handwritten RFC-6455 upgrade; WS round-trip < 1 ms median; 10 K-connection bench passes without RSS growth
- [ ] WS-driven HMR: edit `client/styles/4-components.css` → repaint < 100 ms no reload; edit `Header` JSX → patch < 200 ms inspector connection intact
- [ ] IntersectionObserver lazy iframe mount + `content-visibility: auto` on wrappers
- [ ] 7 smoke tests in `test/` all green via `bun test`; perf harness in CI as non-blocking job; binary smoke test gates release tags
- [ ] All 6 DDRs (009–014) written; DDR-009 already landed 2026-05-15
- [ ] `.github/workflows/build-binaries.yml` exists; tagged release publishes 8 packages (1 main + 7 sub) with `--provenance`; `fail-fast: false` so a single-platform failure doesn't block others
- [ ] `cli/bin/mdcc.exe` is the 500-byte stub; `cli/install.cjs` (postinstall) + `cli/cli-wrapper.cjs` (--ignore-scripts fallback) both ship
- [ ] Phase 4 plan updated (Task 2 removed, runtime-agnostic constraint removed); Phase 3.5 plan updated (depends on Phase 3.4)
- [ ] No DDR-worthy decision left unrecorded
- [ ] Phase 3.5 still works as planned (token import path stable, React 19 compat with shell components — additive only)
- [ ] Phase 4 still works as planned (Pixi.js drops into the new build pipeline cleanly; Bun runtime executes the server)
