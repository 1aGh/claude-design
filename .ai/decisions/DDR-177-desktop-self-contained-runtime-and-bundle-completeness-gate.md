# DDR-177: The packaged app is self-contained — every runtime-spawned surface ships its runtime + dep closure, enforced by a build-time gate

**Status:** Accepted
**Date:** 2026-07-15
**Tags:** desktop, tauri, bundle, bun-compile, acp, cli, dependencies, self-contained, incident, gate

**Related:** [DDR-045](DDR-045-real-disk-path-resolution-for-compiled-dev-server.md) (compiled-binary path resolution — `process.execPath` is not a JS runtime), [DDR-176](DDR-176-per-workspace-patch-registration-for-bun-compiled-sidecars.md) (another "green in source, broken in the compiled binary" bundle bug), [DDR-166](DDR-166-zero-terminal-acp-cold-start.md) (zero-terminal ACP cold start — the promise this makes true), [DDR-168](DDR-168-acp-bundled-cli-and-plugins-always-win.md) (bundled CLI wins on PATH — which turned the pkgRoot bug into one the user couldn't work around), [DDR-062](DDR-062-plugins-reach-executable-logic-via-maude.md) (`maude design <verb>` dispatch), [DDR-009](DDR-009-bun-runtime-authoritative-for-dev-server.md) (apps/studio is bun-native).

## Context

A user installed Maude Desktop on a brand-new Mac with no `node`/`npm`/`brew`/`bun`/`claude`. Nothing worked end-to-end: the ACP chat panel hung at "Working…" forever, and once past that (after she manually installed node), every `maude design <verb>` the agent shelled out to failed — first "helper not found", then "bun is required", then a cascade of missing npm packages (`happy-dom`, `svgo`, `agent-browser`). Full RCA (local): `.ai/logs/rca/issue-acp-panel-hangs-on-nodeless-machine.md`.

The bundle shipped the compiled binaries (`maude`, `maude-server`, `agent-browser`) but **not the JS runtimes and npm dependencies its own runtime-spawned code shells out to**:

- **Runtime (G1/G3):** the ACP adapter and 15 `bun run` design helpers need a JS runtime. `resolveAgentRuntime()` fell back to `process.execPath`, which in the `bun --compile` sidecar is the sidecar BINARY, not an interpreter (DDR-045 class); the helpers hard-required a `bun` that wasn't bundled. No node/bun → dead.
- **pkgRoot (G2):** the compiled `maude` at `Contents/MacOS/` resolved its `apps/studio/bin/<verb>.sh` helpers relative to a pkgRoot that walk-up placed at `Contents/MacOS/` — but the staged tree lives in the *sibling* `Contents/Resources/`, and `cli/` wasn't staged at all. Every helper → "helper not found".
- **Deps (G4):** standalone `bun run _*.mjs` helpers resolve their imports from disk, but neither channel provided them — the npm package's root `dependencies` were `{ajv, ajv-formats}` only, and the `.app` staged just ~10 `node_modules` (the ACP-adapter + render-export closures), missing `happy-dom`/`svgo`.

All of this was **green in `tauri dev`** (which inherits the dev machine's node/bun/PATH and a real repo pkgRoot) and **broken only in the packaged `.app`** — the "native-app verification ceiling" class, and it shipped undetected through ≥2 releases because no gate ran against a node-less bundle.

## Decision

**Invariant:** *The packaged app is self-contained. Every runtime-spawned surface — the ACP adapter and each `maude design <verb>` helper — must have, inside the bundle, (a) a JS runtime to execute it and (b) its complete dependency closure. This is enforced by a build-time gate, never assumed. It holds for BOTH distribution channels: the desktop `.app` and `npm i -g @1agh/maude`.*

Mechanisms:

1. **One bundled Bun runtime, zero extra bytes.** The compiled binaries ARE Bun — a `bun --compile` executable run with `BUN_BE_BUN=1` behaves as the `bun` CLI.
   - *ACP adapter:* `resolveAgentRuntime()` returns `{bin, bunBeBun}`; when it falls back to the compiled self it flags `bunBeBun`, and `bridge.ts` sets `BUN_BE_BUN=1` on the spawn. (The bridge runs *inside* `maude-server`, so `process.execPath` is already the compiled Bun — no Rust needed.) The handshake is now time-boxed so a mis-launched runtime surfaces an error, not an infinite "Working…".
   - *Design helpers:* `runBinDispatch` (`cli/commands/design.mjs`) stages a tiny `bun` shim (`BUN_BE_BUN=1 exec <compiled-binary>`) into `~/.cache/maude/bun-shim` and prepends it to the child PATH when no real `bun` is present — so all 15 `bun` helpers resolve with no user-installed bun, on desktop AND npm.
   - *Caveat:* the ACP adapter + `@anthropic-ai/claude-agent-sdk` are Node-authored and the dev path prefers `node`, so running them under Bun MUST be verified on a real compiled node-less build. If a Bun/Node incompatibility surfaces, bundle a real `node` as an `externalBin` and point `MAUDE_ACP_RUNTIME` at it (the override rung).
2. **pkgRoot bridged.** `stage-resources.mjs` stages `cli/` + top-level `package.json` into `Resources/` (added to `tauri.conf.json` `bundle.resources`), so it satisfies `isPkgRoot`; `resolvePkgRoot()` gained an `.app` sibling probe, and `sidecar.rs` sets `MAUDE_PKG_ROOT` for the portable (Linux `.deb`) case.
3. **Deps staged data-driven, both channels.** `helper-deps.mjs` is the single source of truth for each standalone helper's npm closure (module-graph walk). `stage-resources.mjs` stages that closure into the `.app`; root `package.json` `dependencies` carries the same set for the npm channel. A new helper's deps are picked up automatically — no hand-maintained list.
4. **The gate.** `apps/desktop/scripts/check-bundle-completeness.mjs` asserts, against a built `.app`, that pkgRoot is valid, a runtime is bundled, and every standalone helper's deps are staged — plus a `--smoke` pass that runs every verb in a stripped PATH (no node/bun/claude). `stage-resources.mjs` also has an inline build-time gate for the same closure. **This is the durable answer to "vždy dělat build i dependencies": a future helper/dep that isn't bundled fails the build.**

## Alternatives considered

- **Route every helper through the compiled server's `/_api/*` routes** (deps ride the embedded closure; leaner bundle). Viable for `import-asset`/`import-brand` (routes exist) but not the genuinely-standalone helpers (whisper, footage, draw), needs a running server, and doesn't help the no-server npm-CLI case. Rejected as the *primary* mechanism in favor of staging (the owner explicitly wanted "vše bundlovat" — completeness over bundle size); kept as a future option for the import family.
- **Bundle a full `node` (or standalone `bun`) as an `externalBin`.** Definitively correct for the Node-authored adapter, but +tens of MB and a second runtime to maintain. Kept as the fallback if adapter-under-Bun fails verification.
- **Hand-maintained staged-deps list** (mirror the existing `RENDER_RUNTIME_PKGS`). Rejected: exactly the "forgot to add the new dep" failure this DDR exists to prevent. Data-driven derivation + the gate replace it.

## Consequences

- AI editing and all design tooling work on a fresh machine with no manual installs — the DDR-166 promise is finally true bundle-side.
- The bundle grows by the standalone-helper dep closures (`happy-dom`, `svgo`, …) — accepted.
- **Verification ceiling:** the true acceptance test — build the `.app` and run `check-bundle-completeness … --smoke` on a node/bun/claude-less machine — needs the owner's build matrix (Rust in `sidecar.rs`/`tauri.conf.json` can't compile-verify headless). Wiring the gate into `build-binaries.yml` (macOS post-build) is a follow-up.
- **New rule (CLAUDE.md):** any new `maude design <verb>` helper or runtime-spawned surface MUST ship its runtime + dep closure in the bundle and pass `check-bundle-completeness`; a new npm dep goes into the staged closure (auto via `helper-deps.mjs`) or the helper is server-routed — in the same change.
