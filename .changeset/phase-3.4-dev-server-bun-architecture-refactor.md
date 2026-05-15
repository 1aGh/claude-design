---
'@1agh/md-claude': minor
---

**Phase 3.4 — dev-server runtime + build pipeline + distribution overhaul.**

The dev-server (`mdcc design serve`) is now built on Bun authoritatively (DDR-009), distributed as per-platform standalone binaries via npm `optionalDependencies` sub-packages (DDR-015), and runs on a 7-module TypeScript split of the former 1288-LOC `server.mjs` monolith (DDR-013). The shell client migrates from React 18 UMD via babel-standalone to React 19 from npm, bundled with `Bun.build` to a 66 KB gz IIFE (DDR-012). CSS moves to a `@layer reset, tokens, layout, shell, components, utilities` cascade processed by Lightning CSS at build time (DDR-014).

**No breaking change for `mdcc` CLI surface.** `mdcc init` / `mdcc config` / `mdcc design serve` / `mdcc design init` all work as before — same flags, same output paths. End-user prereq drops from "Node 20+" to "nothing" once published with sub-packages, because postinstall hardlinks the matching platform binary in place. `mdcc-safe` bin is the `--ignore-scripts` fallback (slower but always works).

Highlights:

- `bun build --compile` produces ~57 MB standalone binary per platform (darwin-arm64 / darwin-x64 / linux-x64 / linux-arm64 / linux-x64-musl / linux-arm64-musl / win32-x64).
- 7 sub-packages under `packages/md-claude-<slug>/`; `optionalDependencies` in the main tarball pin all 7 in lockstep. `scripts/bump-version.sh` + `scripts/check-version-parity.sh` extended.
- `.github/workflows/build-binaries.yml` is the new release pipeline (fail-fast: false matrix, native runner per platform, npm provenance on every artifact, `publish-main` gated on all sub-packages being live).
- Native `Bun.serve` WebSocket replaces the hand-rolled RFC-6455 upgrade (saves ~150 LOC + 1.7× WS throughput headroom for future collab features).
- 7 `bun:test` smoke tests + `perf-harness.ts` measure the Phase 3.4 budgets (cold start < 100 ms HTTP, bundle gz < 80 KB, WS p50 < 1 ms).
- CSS-only HMR live; full JSX HMR with react-refresh-runtime is deferred to Phase 3.5.

Unblocks Phase 3.5 (DS-token-aware shell visual refresh) and Phase 4 (Pixi.js canvas v2 + infinite canvas).

Per-platform sub-packages (new on npm): `@1agh/md-claude-darwin-arm64`, `@1agh/md-claude-darwin-x64`, `@1agh/md-claude-linux-x64`, `@1agh/md-claude-linux-arm64`, `@1agh/md-claude-linux-x64-musl`, `@1agh/md-claude-linux-arm64-musl`, `@1agh/md-claude-win32-x64`. End users should not install these directly — npm resolves the matching one automatically.

See `.ai/decisions/DDR-{009,012,013,014,015,016}.md` for the full rationale set.
