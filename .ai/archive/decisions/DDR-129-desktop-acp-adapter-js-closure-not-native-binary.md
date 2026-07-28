# DDR-129 — Desktop ships the ACP adapter's JS closure and drives the user's own `claude`, never the SDK's native binary

**Status:** accepted · **Date:** 2026-06-24 · **Phase:** 32 follow-up — desktop distribution hotfix
**Relates:** DDR-123 (ACP chat runs on the user's own `claude` CLI; embedding the SDK with a token is a ToS trap), DDR-128 (first-open readiness; Rust-corrected sidecar PATH), DDR-106 (desktop ships the `apps/studio` SOURCE tree as a bundle resource), DDR-045 (real-disk path resolution via `paths.ts`), DDR-126 (native distribution + "no package managers in the app")

## Context

The native chat panel (DDR-123) spawns the third-party adapter `@agentclientprotocol/claude-agent-acp` at runtime. `apps/studio/acp/probe.ts → resolveAdapterEntry()` resolves it from `DEV_SERVER_ROOT/node_modules`. But `apps/desktop/scripts/stage-resources.mjs` excluded `node_modules` wholesale (correct for canvas-building — react/motion are externalized to the prebuilt `dist/runtime` bundles), and the ACP feature + that exclusion shipped in the same PR (#53), so the exclusion was never reconsidered against the new dependency. Result: **every released desktop build (v0.31.0, v0.32.0) reported "The Claude agent bridge is not installed in this build"** — the marquee feature dead in the `.app`, while `pnpm dev:desktop` worked (its sidecar falls back to the live source tree, which has the full pnpm `node_modules`). RCA: `.ai/logs/rca/issue-desktop-acp-bridge-not-installed-in-packaged-app.md`.

A second fact reframed the fix. The adapter's `claudeCliPath()` (`acp-agent.js:51`) returns `CLAUDE_CODE_EXECUTABLE` when set, and **only otherwise** falls back to the Claude binary shipped as a ~210 MB platform-native OPTIONAL dep of `@anthropic-ai/claude-agent-sdk` (`@anthropic-ai/claude-agent-sdk-<os>-<arch>`). Maude's bridge checked that `claude` existed but never passed it — so even in dev the adapter was using the bundled native binary, contrary to DDR-123's "drive the user's OWN CLI" intent.

## Decision

**Ship only the adapter's JS dependency closure, and pin the adapter to the user's own `claude`.**

1. **Stage the JS closure, not the native binary.** `stage-resources.mjs` walks the adapter's transitive JS closure (nested-aware Node resolution over pnpm's peer-dir layout) and copies it flat-hoisted + symlink-dereferenced into the staged `node_modules` — 4 packages, ~11 MB (`claude-agent-acp` + `@agentclientprotocol/sdk` + `@anthropic-ai/claude-agent-sdk` JS + `zod`), no version conflicts. The `@anthropic-ai/claude-agent-sdk-<os>-<arch>` native binaries (~210 MB each, platform-locked) are explicitly skipped — both as graph edges and from staging.
2. **Pin `CLAUDE_CODE_EXECUTABLE`** in `bridge.ts` to `resolveClaudePath()` (the user's installed CLI). The adapter then never reaches the native-binary branch, so step 1's exclusion is safe, and the turn runs on the user's subscription — DDR-123's documented intent, now actually enforced.
3. **Fail loud, surface honestly.** A build-time assertion in `stage-resources.mjs` fails the desktop build if the adapter bin isn't staged (no more silently shipping a dead panel). `readiness.ts` gains a required `Claude agent bridge` row driven by `resolveAdapterEntry()`, so a missing adapter shows in the checklist instead of leaving every other row green while chat is disabled.

## Why not bundle the native binary

- **Size:** ~210 MB per platform vs. ~11 MB platform-independent JS. The native route also forces per-build-leg platform selection (the matching `-<os>-<arch>` per matrix leg); the JS closure is one tree for every leg.
- **Compliance:** the native binary is the SDK's embedded runtime; driving it instead of the user's `/login`'d CLI is exactly the "embed-with-a-token ToS trap" DDR-123 exists to avoid.
- **Correctness:** the user already has `claude` (readiness requires it; DDR-128 makes `Bun.which('claude')` accurate in the packaged app via the Rust-corrected sidecar PATH).

**This is load-bearing and counter-intuitive: do NOT "fix" a future native-binary-not-found by bundling `@anthropic-ai/claude-agent-sdk-*`.** The native binaries are deliberately excluded; the contract is `CLAUDE_CODE_EXECUTABLE` + the user's CLI.

## Security follow-ups (recorded, not all in this change)

The `/flow:done` review pair (defender PASS, 0 blockers; attacker) surfaced, beyond the in-scope fix:

- **Done here (defense-in-depth):** the adapter child env now drops `MAUDE_TOKEN_ENDPOINT`/`MAUDE_TOKEN_KEY` (only the dev-server's `github/token.ts` needs them) — defangs the one real exfil chain (a PATH-hijacked `claude`, which itself requires pre-existing RCE). The staging copy gained a realpath-containment guard so `cpSync({dereference:true})` can't follow a malicious dep's symlink out of its package dir.
- **Deferred (pre-existing / broader infra, out of scope for this hotfix):**
  - Gate the desktop staging on `pnpm install --frozen-lockfile` (mirror the hub Dockerfile rule, CLAUDE.md) and traverse `dependencies` only (drop `optionalDependencies` from the closure walk — the only optionals here are the natives we already skip).
  - The auto-approve permission handler (`bridge.ts`, phase-31 accepted risk) still needs an approve/deny UI before any multi-user/hub reach (per the `project_maude_phase31_acp_chat_panel` memory).
  - DDR-128's `-il` login-shell PATH probe re-runs per sidecar respawn; consider caching the resolved PATH and preferring a non-interactive resolution.
