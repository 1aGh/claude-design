# Feature: Maude Desktop — truly standalone bundle (zero manual installs) + a durable "bundle build & deps" gate

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports. This is a **build/packaging/distribution** plan — no UI, no design-system surface.

## Description

Make the packaged `Maude.app` fully self-contained so a user with **zero terminal knowledge** (no `node`, `npm`, `brew`, `bun`, `claude`) hits **no blockers**: the ACP chat panel connects, and every `maude design <verb>` the bundled agent shells out to actually runs. Then install a **durable build gate** so every future Maude extension (new helper, new dep, new sidecar) automatically ships its build output **and** its runtime dependencies — the class of regression can't recur.

## User Story

As a non-technical designer installing Maude Desktop on a brand-new Mac, I want the AI editing and all design tooling to work out of the box, so that I never have to open a terminal or install a runtime by hand.

## Problem

The `.app` bundles compiled binaries (`maude-server`, `maude`, `agent-browser`) but **not the `node`/`bun` runtimes its own runtime-spawned code shells out to, nor the npm deps those standalone scripts import**. Full evidence + reproductions in [`.ai/logs/rca/issue-acp-panel-hangs-on-nodeless-machine.md`](../logs/rca/issue-acp-panel-hangs-on-nodeless-machine.md). Confirmed gaps:

1. **G1 — ACP adapter has no JS runtime.** `resolveAgentRuntime()` (`apps/studio/acp/probe.ts:164`) = `MAUDE_ACP_RUNTIME || Bun.which('node') || process.execPath`. No `node` → falls back to `process.execPath`, which in the `bun --compile` sidecar is the **sidecar binary itself** (proven: a compiled Bun binary ignores a passed script unless `BUN_BE_BUN=1`). Adapter never speaks ACP → `conn.initialize()` (`bridge.ts:466`, **no timeout**) hangs → panel spins "Working…" forever. User confirmed: `brew install node` fixed it.
2. **G2 — bundled `maude` can't find its own helpers (pkgRoot).** Compiled `maude` at `Contents/MacOS/maude` resolves `pkgRoot` (`cli/lib/pkg-root.mjs`, walk-up needs BOTH `apps/studio/bin/screenshot.sh` AND `cli/commands/design.mjs`) to its own dir; assets are in the **sibling** `Contents/Resources/apps/studio/`, and `cli/` isn't staged at all → every `maude design <verb>` → "helper not found at `Contents/MacOS/apps/studio/bin/<verb>.sh`". Reproduced on the real v0.45.1 `.app`.
3. **G3 — 15 helpers hard-depend on `bun`, not bundled.** `import-asset/brand/tokens.sh` (+12 more) `exec bun run …`; `externalBin` ships no `bun`; the import trio hard-exits without it.
4. **G4 — standalone-helper npm deps absent from BOTH channels.** `_import-asset.mjs`/`_import-brand.mjs` (transitively: `happy-dom`, `svgo`, `pdf-lib`, …) resolve from on-disk `node_modules`. Root `package.json` declares only `{ajv, ajv-formats}` (+ platform binaries), so `npm i -g @1agh/maude` never installs them; and the `.app` stages only ~10 `node_modules` (ACP-adapter + render-export closures — `stage-resources.mjs`), **missing** `happy-dom`/`svgo`/`pdf-lib`. So the helpers `import`-fail in the bundle too.
5. **G5 — DDR-168 PATH-shadow.** `sidecar.rs` prepends the (broken) bundled `maude`, so it shadows a user's own `npm i -g @1agh/maude`; the fresh-machine user can't even work around G2 manually.
6. **G6 — install-timeout.** `INSTALL_POLL_MAX_MS = 90000` (`ReadinessList.jsx:95`) is shorter than the fresh-machine `claude.ai/install.sh` download → premature "Install timed out" while the fire-and-forget install keeps running.
7. **G7 — no completeness gate.** Nothing asserts the bundle/npm closure is complete, so this shipped unnoticed in ≥2 releases (green in `tauri dev`, broken in the `.app` — the `native-app verification ceiling` class).
8. **Minor / separate — XXE guard false-positive.** `import-asset`/`import-brand` reject a plain SVG 1.1 `<!DOCTYPE>` (no internal subset, no `ENTITY`) that Illustrator/Serif emit. Over-broad guard. Tracked here, fixed independently.

## Solution

Ship a **self-contained runtime + complete dependency closure**, via a hybrid that keeps the bundle lean:

- **Runtime (G1, G3):** expose the already-bundled compiled binary as a general `bun` via `BUN_BE_BUN=1` (zero new binary weight — the sidecar *is* Bun). One runtime serves both the ACP adapter and the `bun run` helpers. `sidecar.rs` stages a `bun`-named launcher on the helpers' PATH and sets `MAUDE_ACP_RUNTIME` for the adapter; `bridge.ts` sets `BUN_BE_BUN=1` on the adapter spawn when the runtime is the compiled self.
- **Helper deps (G4):** two-track by whether a helper has a server route:
  - **Route-through-compiled-server** for helpers whose logic is already a pure module shared with an `/_api/` route (`import-asset` → `/_api/import-asset`, `import-brand` → `/_api/import-brand` — both exist). The `.sh` curls the local dev-server (compiled binary, **deps already embedded**) instead of `bun run`, mirroring `photo-adjust.sh`/`generate.sh`. Zero loose deps. Extend the same pattern to `import-tokens`/`svg-optimize` by adding their routes.
  - **Stage the closure** for genuinely-standalone helpers (whisper `transcribe`, footage `ingest`/`probe`, `draw-build`, `fetch-asset`, `audio-search`) — make `stage-resources.mjs`'s closure list **data-driven from the helpers' actual import graph**, not hand-maintained.
- **pkgRoot (G2):** stage `cli/` + a top-level `package.json` into `Contents/Resources/` so it's a valid `pkgRoot`, and set `MAUDE_PKG_ROOT` from `sidecar.rs` (the override branch already exists in `resolvePkgRoot`).
- **npm channel (G4):** route-through-server needs a running server; for the CLI-without-server case, have the import/optimize verbs boot an ephemeral local server (they already depend on one for the canary), and declare the residual standalone-only deps in root `package.json` so `npm i -g` is also complete.
- **Robustness (G1, G6):** add a handshake timeout to `start()`; add a preflight "runtime" row; raise/adaptive the install poll cap.
- **Durable gate (G7):** a CI/build step that (a) runs every `maude design <verb>` against the **bundled `.app`** in a PATH-stripped (no node/bun/claude) env and asserts none reports "helper not found" / "module not found" / "bun required", and (b) asserts the staged closure covers every helper's import graph. New helper with a new dep → build fails until it's bundled. Record the invariant in a DDR + CLAUDE.md.

## Metadata

- **Type**: Bug Fix + Refactor (distribution/packaging)
- **Complexity**: High
- **App/Package**: `apps/desktop`, `apps/studio`, `cli`, root `package.json`, `.github/workflows`
- **Affected Systems**: Tauri bundle staging, sidecar env/PATH, ACP adapter spawn, `maude` CLI pkgRoot, design-helper dispatch, CI
- **Dependencies**: none new at runtime (reuses the bundled Bun); build/CI only

---

## Context References

### Must-Read Files

- `.ai/logs/rca/issue-acp-panel-hangs-on-nodeless-machine.md` — full RCA, all reproductions.
- `apps/studio/acp/probe.ts` (140–165) — `resolveClaudePath` / `resolveAgentRuntime`; the G1 fallback.
- `apps/studio/acp/bridge.ts` (362–472) — adapter spawn (`Bun.spawn([resolveAgentRuntime(), adapterEntry])`, line 400) + `conn.initialize()` (466, no timeout); `withTimeout` helper (88–95) to reuse.
- `apps/desktop/src-tauri/src/sidecar.rs` (129–228) — sidecar spawn env/PATH, `stage_bundled_cli_link`, `MAUDE_BUNDLED_CLI_PATH`/`MAUDE_DEV_SERVER_BIN`/`MAUDE_AGENT_BROWSER`; where `MAUDE_ACP_RUNTIME`/`MAUDE_PKG_ROOT`/a `bun` link get added.
- `apps/desktop/scripts/stage-resources.mjs` — the whole staging model; `collectClosure`/`stageClosure` (155–225), the `RENDER_RUNTIME_PKGS` list (250) is the pattern to extend/generalize.
- `cli/lib/pkg-root.mjs` (44–107) — `isPkgRoot`/`resolvePkgRoot`; the G2 walk-up + `MAUDE_PKG_ROOT` override branch; the false doc-comment (66–68).
- `cli/commands/design.mjs` (28–166) — `BIN_VERBS`/`BOOT_VERBS`, `runBinDispatch` (helper `.sh` resolution + "helper not found" error at 147–154).
- `apps/studio/bin/import-asset.sh`, `import-brand.sh`, `import-tokens.sh` — the `command -v bun` hard-gate + `exec bun run`.
- `apps/studio/bin/photo-adjust.sh` + `generate.sh` — the **curl-the-local-server** pattern to mirror for route-through helpers.
- `apps/studio/http.ts` (~2465–2540) — `/_api/import-asset` + `/_api/import-brand` route handlers (the embedded-deps path).
- `apps/studio/readiness.ts` (26, 226–363) — preflight item ids (`claude/maude/plugins/agent-browser/adapter`); add a `runtime` row.
- `apps/studio/client/panels/ReadinessList.jsx` (90–164) — install poll caps (G6).
- `plugins/design/dependencies.json` — declared CLI deps (node/git/bun/agent-browser); where a "bundled-runtime satisfies this" note or hardness change lands.
- `.github/workflows/build-binaries.yml` + `apps/desktop/e2e/` — where the completeness gate + bundled-`.app` smoke test wire in.

### Files to Create

- `.ai/archive/decisions/DDR-1XX-desktop-self-contained-runtime-and-bundle-completeness.md` — the invariant + the two-track deps model + the gate (claim the next number per `[[project_ddr_numbering_races_on_shared_main]]`).
- `apps/desktop/scripts/check-bundle-completeness.mjs` (or a test) — asserts the staged closure covers every helper's import graph + a stripped-PATH `maude design <verb>` smoke over the bundled `.app`.

### Patterns to Follow

- **Route-through-server**: copy `photo-adjust.sh`'s `curl … localhost:$PORT/_api/…` shape (reads `_server.json` for the port, POSTs JSON, non-zero-exits on error).
- **Closure staging**: reuse `collectClosure`/`stageClosure` in `stage-resources.mjs`; the new list should be **derived** (from a manifest or a `bun build --analyze` of each standalone `_*.mjs`), not hand-typed.
- **Compiled-self-as-bun**: `BUN_BE_BUN=1 <compiled-binary> script.mjs` runs the script (verified locally). Prefer this over shipping a second runtime.
- **pkgRoot override**: `resolvePkgRoot` already honors `MAUDE_PKG_ROOT` gated on `isPkgRoot` — staging `cli/` into Resources makes `Contents/Resources` pass `isPkgRoot`.

---

## Architecture Decision (record as the DDR)

**Invariant:** *The packaged app is self-contained. Every runtime-spawned surface (ACP adapter, each `maude design <verb>` helper) must have, inside the bundle, (a) a JS runtime to execute it and (b) its complete dependency closure — enforced by a build-time gate, never assumed.*

**Runtime:** one bundled Bun (the compiled sidecar via `BUN_BE_BUN`), not a user-installed `node`/`bun`. `Bun.which('node')` stays only as an optional override, never the sole source.

**Helper deps — two tracks (documented per helper):**
- *Server-routed* when a pure-function module is shared with an `/_api/` route → the `.sh` curls the compiled server; deps ride the server's embedded closure; new deps are free.
- *Standalone-staged* otherwise → the helper's transitive npm closure is staged (data-driven) and runs under the bundled Bun.

**Future extensions:** adding a helper/dep without wiring its runtime+deps must **fail the desktop build and the npm-tarball check**. This is the durable answer to "vždy dělat build i dependencies".

> Consider a divergent note: the *most* future-proof end-state is running ALL helper logic in-process inside the compiled binary (one embedded closure, new deps automatically covered). That's a larger dispatch refactor; the hybrid above reaches self-containment now and is a stepping stone toward it. Capture the trade-off in the DDR.

---

## Tasks

Execute in dependency order. Each task is atomic and testable. Prefix each with the gap(s) it closes.

### ✅ Task 1 (G7 — do FIRST, red baseline): CREATE the bundle-completeness gate + bundled-`.app` smoke — DONE (verified: exits 1 against real v0.45.1 .app, enumerates all gaps)

- **Do**: Add `apps/desktop/scripts/check-bundle-completeness.mjs`: (1) for every `BIN_VERBS` helper, compute its transitive npm import closure (bun build --analyze of the `_*.mjs`, or parse imports) and assert each package is present in the staged `Resources/apps/studio/node_modules` **or** the helper is server-routed; (2) a stripped-PATH harness (`env -i` minus node/bun/claude) that runs `Contents/MacOS/maude design <verb> --help`/no-op for every verb against the built `.app` and asserts NONE prints "helper not found" / "Cannot find module" / "bun is required". Wire into `build-binaries.yml` (post-`tauri build`) and/or `apps/desktop/e2e/`.
- **Gotcha**: must run against the **bundled `.app`**, not `tauri dev` — that's the whole point (G7). Expect it RED now; it turns green as Tasks 2–7 land.
- **Validate**: `node apps/desktop/scripts/check-bundle-completeness.mjs <path-to-.app>` enumerates failures matching G1–G4.

### ✅ Task 2 (G2): FIX compiled-`maude` pkgRoot in the bundle — DONE (mechanism proven on real binary; unit tests pass; Rust needs build to compile-verify)

- **Do**: In `stage-resources.mjs`, also stage `cli/` and a top-level `package.json` into `OUT` (Resources root) so `Contents/Resources` satisfies `isPkgRoot` (needs `apps/studio/bin/screenshot.sh` + `cli/commands/design.mjs`). In `sidecar.rs`, set `command.env("MAUDE_PKG_ROOT", <resources>/…)` pointing at the staged root. Correct the false doc-comment in `resolvePkgRoot` (66–68).
- **Pattern**: mirrors how `MAUDE_DEV_SERVER_BIN`/`MAUDE_AGENT_BROWSER` are set in `sidecar.rs`.
- **Gotcha**: `MAUDE_PKG_ROOT` is honored only if `isPkgRoot(override)` passes — staging `cli/` is a hard prerequisite, not optional.
- **Validate**: `MAUDE_PKG_ROOT=<Resources> <app>/Contents/MacOS/maude --version` prints the version; `… design import-brand` reaches the helper's own usage (not "helper not found").

### ✅ Task 3 (G1, G3): Bundle one Bun runtime via `BUN_BE_BUN`; wire adapter + helpers to it — DONE (JS-only, no Rust needed; verified: acp tests 15/15, G3 shim live-tested with stripped PATH)

- **Do**: In `sidecar.rs`, stage a `bun`-named launcher (symlink/shim to the `maude-server` binary) into a narrow PATH dir (mirror `stage_bundled_cli_link`) and set `BUN_BE_BUN=1` for children invoking it as `bun`; export `MAUDE_ACP_RUNTIME=<that bun>`. In `bridge.ts` `start()`, when `resolveAgentRuntime()` is the compiled self, add `env.BUN_BE_BUN = '1'` before `Bun.spawn`. In `probe.ts`, have `resolveAgentRuntime()` prefer the bundled Bun over `process.execPath`'s footgun and signal the BUN_BE_BUN case.
- **Gotcha**: the helpers' `command -v bun` gate must find the staged `bun` — verify the launcher is executable and on the PATH `sidecar.rs` sets. `BUN_BE_BUN` is a no-op on a real `bun`, safe to set on the fallback path.
- **Validate**: with `node`/`bun` absent from PATH, the ACP panel completes a real turn, and `maude design svg-optimize` (a standalone bun helper) runs.

### ⏭️ Task 4 (G4 — route track): Route `import-asset`/`import-brand` through the local server — SUPERSEDED by Task 5 (staging) per the owner's "vše bundlovat" preference; kept as a future option to shrink the bundle. Original detail below.

- **Do**: Rewrite `import-asset.sh`/`import-brand.sh` to `curl` the local dev-server `/_api/import-asset` / `/_api/import-brand` (read port from `<designRoot>/_server.json`; boot via `server-up.sh` if absent), mirroring `photo-adjust.sh`. Keep the `bun run` path only as a no-server fallback. Deps then ride the compiled server's embedded closure — no `happy-dom`/`svgo`/`pdf-lib` staging needed for these.
- **Gotcha**: `/_api/import-*` are privileged (not in `CANVAS_SAFE_API`) — fine over trusted loopback from the CLI; do NOT add them to the canvas allowlist.
- **Validate**: `maude design import-brand <svg>` succeeds with no `bun`/`happy-dom` on the machine, server up.

### ✅ Task 5 (G4 — staged track): Make `stage-resources.mjs` closure data-driven; stage residual standalone-helper deps — DONE (shared `helper-deps.mjs`; derived {happy-dom, svgo, playwright}; deps resolvable in apps/studio/node_modules; gate double-checks. Full stage run needs the build.)

- **Do**: Replace the hand-maintained `RENDER_RUNTIME_PKGS` list with a derivation: enumerate every standalone (`bun run`) `BIN_VERBS` helper's `_*.mjs`, analyze its transitive npm imports, and stage the union (via `collectClosure`). Verify the residual set after Task 4 (e.g. `svgo` for `svg-optimize`/`draw-build` unless also routed; `ajv` for `import-tokens`; whisper/footage deps).
- **Gotcha**: some "deps" are external binaries (whisper.cpp, chromium) resolved at runtime, not npm packages — the gate must distinguish and not false-fail on those.
- **Validate**: Task 1's completeness check passes for every staged-track helper.

### ✅ Task 6 (G4 — npm channel): Complete the `npm i -g @1agh/maude` closure — DONE (added `happy-dom` 20.10.6 + `svgo` ^4.0.1 to root `dependencies`, matching apps/studio; the bun-shim from Task 3 covers the interpreter). Ephemeral-server option not needed — staging + declared deps suffice.

- **Do**: For CLI-without-server use, have `import-asset`/`import-brand`/etc. boot an ephemeral local server (they already need one for the canary), OR declare the residual standalone-only deps in root `package.json` `dependencies`. Add an npm-tarball completeness check (mirror Task 1 for the packed tarball). Reconcile with `plugins/design/dependencies.json` (mark deps the bundle satisfies).
- **Gotcha**: don't bloat root deps with things only the compiled binary needs — only what a **standalone** helper imports and can't get via the server.
- **Validate**: in a clean container, `npm i -g @1agh/maude` then `maude design import-brand <svg>` works (with the server-boot path).

### ✅ Task 7 (G5, G1, G6): Robustness — DONE: (a) handshake timeout (bridge.ts, tests 15/15). (c) install cap — deadline now pushed forward on every `running` poll so a slow-but-progressing install is never cut off; cap 90s→180s of no-signal; client bundle rebuilt. (b) preflight runtime row — SKIPPED: the G1/G3 fix makes the runtime always resolvable (compiled self via BUN_BE_BUN), so the row would always be green; a real failure now surfaces via the handshake timeout (7a) instead. (d/G5) resolved by G2 (bundled maude is now functional, so the DDR-168 prepend is safe).

- **Do**: (a) G1 — wrap `conn.initialize()` in `start()` with `withTimeout`, surface a clear error instead of infinite "Working…"; (b) add a `runtime` preflight item in `readiness.ts` + a row in `ReadinessList.jsx` so a missing runnable runtime is visible, not silent; (c) G6 — raise `INSTALL_POLL_MAX_MS` and/or key the deadline off `getInstallState().phase === 'running'`; (d) G5 — once G2 lands the prepend is safe; add a comment/assertion that the bundled `maude` must be functional before it's allowed to shadow.
- **Validate**: killing the adapter mid-handshake yields an error toast, not a spinner; readiness shows the runtime row.

### ✅ Task 8: RELAX the SVG DOCTYPE guard for benign declarations — DONE (`_import-asset.mjs` `svgPreParseReject`: reject `<!ENTITY>` + internal DTD subset, accept plain external-id DOCTYPE; tests 52/52 incl. Illustrator-accept + XXE-reject). Also wired the completeness gate into CI (`build-desktop.yml`, macOS `--smoke` post-build — G7 enforcement).

- **Do**: In the import-asset/brand SVG sanitizer, allow a plain `<!DOCTYPE svg …>` with **no internal subset and no `ENTITY`** (the Illustrator/Serif case); keep rejecting internal-subset/`ENTITY`/`<script>`/`foreignObject`/external refs (the real XXE surface).
- **Gotcha**: security-sensitive — keep the reject set tight; add a test with a real Illustrator export (accept) and an XXE payload (reject).
- **Validate**: a stock Illustrator SVG imports; an internal-`ENTITY` payload is still rejected.

### ✅ Task 9: RECORD the DDR + update CLAUDE.md — DONE (DDR-177 + README index entry + CLAUDE.md self-contained-bundle rule)

- **Do**: Write DDR-1XX (the invariant + two-track model + gate). Add a CLAUDE.md rule under the desktop/release section: "Any new `maude design <verb>` helper or runtime-spawned surface MUST ship its runtime + dep closure in the bundle and pass `check-bundle-completeness`; new deps are added to the staged closure (or the helper is server-routed) in the same change." Wire via `claude-md-keeper`.
- **Validate**: `scripts/check-version-parity.sh` unaffected; docs build clean.

---

## Validation

Run after each task (Edit-Verify Loop) and at the end:

1. **Static/tests**: `pnpm test` (bun suites under `apps/studio/`, `cli/` node tests) — note the known better-sqlite3 ABI reds are env, not this change (`[[project_cli_tests_better_sqlite3_abi]]`).
2. **Build the real bundle**: `pnpm build` then the desktop `tauri build` (or the CI matrix leg) — must produce a `.app`.
3. **The gate (Task 1)**: `node apps/desktop/scripts/check-bundle-completeness.mjs <built .app>` → 0 failures.
4. **Stripped-PATH end-to-end (the acceptance heart)**: on a machine/container with **no `node`, `bun`, `claude`, `brew`**, launch the built `.app`, open a project, (a) send an ACP prompt → real streamed response (G1/G3), (b) run a route helper `maude design import-brand` (G2/G4), (c) run a staged helper `maude design svg-optimize` (G3/G4). All succeed.
5. **Desktop E2E**: extend `apps/desktop/e2e/` (the `acp-cold-start` scenario) with the node-less/bun-less variant per `[[project_tauri_desktop_e2e_testing_path]]`.
6. **npm channel**: clean-container `npm i -g @1agh/maude` + a route helper works (Task 6).

## Acceptance Criteria

- [ ] All tasks completed; `check-bundle-completeness` green against the built `.app`.
- [ ] On a fresh, node/bun/claude/brew-less machine: ACP connects, `maude design import-brand` and a standalone helper both run — **no manual install**.
- [ ] Handshake timeout + preflight runtime row + raised install cap landed.
- [ ] DDR recorded; CLAUDE.md rule added; the gate runs in CI on the desktop legs.
- [ ] Bundle size increase measured and justified in the DDR (route-through-server keeps it minimal).
- [ ] No regression in `tauri dev` or the existing desktop-e2e scenarios.

---

## Risks / Open Questions

- **Bun vs Node for the ACP adapter + SDK** (`@anthropic-ai/claude-agent-sdk` is "authored for Node"). Dev already runs it under real Bun; MUST be verified on a real compiled node-less build. If a Bun/Node incompat surfaces, fall back to bundling a real `node`/`bun` binary as an `externalBin` + `MAUDE_ACP_RUNTIME` (heavier but definitive).
- **Ephemeral-server boot for the npm-CLI import path** adds latency/complexity; confirm the import verbs genuinely need a server (the canary) vs. can run purely in-process.
- **Bundle size**: staging full closures for standalone helpers could be large (onnxruntime, pdf-lib, playwright already staged). Route-through-server (Task 4) is the lever that keeps it down — prefer it wherever a pure module + route exist.
- **DDR-168 interaction**: the prepend-bundled-maude rule is only safe once G2 is fixed; sequence Task 2 before relying on it.
- **Windows/Linux legs**: `BUN_BE_BUN`, the `bun` launcher, and pkgRoot staging must be verified per-platform (the sidecar slug matrix), not just darwin-arm64.

---

## Retro (2026-07-15)

**What worked**
- **Gate-first (Task 1) was the right call.** Building `check-bundle-completeness.mjs` before any fix gave a red baseline that enumerated every gap and became the green target — and it caught a real one I'd have missed (the module-graph walk found `svgo` transitively via `../draw/optimize.ts`; the naive direct-import grep didn't).
- **The runtime fix needed zero Rust.** Realizing the ACP bridge runs *inside* the `maude-server` process (so `process.execPath` is already the compiled Bun) collapsed G1 to a 2-line `probe.ts`/`bridge.ts` change + `BUN_BE_BUN`. The design.mjs `bun` shim did the same for the helpers in one chokepoint.
- **Verified for real, not just claimed.** Rebuilt the CLI binary + staged resources + assembled a bundle + ran the gate `--smoke` GREEN, then ran the user's *exact* failing command (`maude design import-brand`) on `env -i` with no node/bun/claude → correct output. Plus `cargo check` for the Rust. That end-to-end run is what turned "should work" into "does work."
- **Data-driven staging + a single `helper-deps.mjs`** means a future helper's deps stage automatically AND the gate can't drift from what ships — the durable "always bundle build+deps" the user asked for.

**What didn't / friction**
- **The plan's "route-through-server" (Task 4) was the wrong default.** The owner wanted "bundle everything"; staging (Task 5) was simpler, directly gate-verifiable, and more aligned. Superseded Task 4 mid-execution. Lesson: confirm the size-vs-simplicity preference *before* picking the mechanism.
- **Verification ceiling is real and had to be named repeatedly.** The full signed `tauri build` + a live ACP session (Node-authored SDK under Bun) genuinely can't run headless; I kept flagging it rather than pretending. The Bun-vs-Node-adapter risk remains the one unproven assumption (DDR-177).
- **Shared-`main` entanglement.** A concurrent session's large uncommitted feature (ACP capability picker) landed in the tree mid-close; had to stage only my own files every commit and scope the security review to my committed diff, not `git diff`.

**Change for next time**
- For any desktop/packaging change, **write the bundled-`.app` gate first** and treat "green in `tauri dev`" as meaningless — it's the recurring bug class (cf. DDR-045, DDR-176, and this one).
- When a plan hinges on a size-vs-complexity trade (route-through-server vs. stage-the-deps), surface it as an explicit `AskUserQuestion`-worthy fork in `/plan`, not a buried "Architecture Decision" the executor has to reverse.
