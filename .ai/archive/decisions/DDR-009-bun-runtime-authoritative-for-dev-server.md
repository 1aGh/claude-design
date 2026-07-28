# DDR-009: Bun runtime authoritative for `plugins/design/dev-server/` (no Node fallback)

> **Path update — [DDR-095](DDR-095-runtime-apps-extracted-to-top-level.md) (2026-06-05):** the dev-server now lives at `apps/studio/` (hub at `apps/hub/`), moved out of `plugins/design/`. This DDR's invariants still govern; only the path changed. Old `plugins/design/dev-server` references below are historical.

- **Date:** 2026-05-15
- **Status:** Accepted
- **Tags:** design, dev-server, runtime, bun, distribution, perf, lock-in, npm, ci, phase-3.4
- **Related:** [`.ai/docs/research-runtime.md`](../docs/research-runtime.md) (superseded by this DDR), [`.ai/plans/phase-3.4-architecture-refactor.md`](../plans/phase-3.4-architecture-refactor.md), [DDR-008](./DDR-008-dev-server-bin-canonical-helper-home.md) (helper-home conventions that survive the migration), `@anthropic-ai/claude-code@2.1.142` npm tarball (verified precedent), Phase 4 plan `Runtime-agnostic constraint` section (removed by this decision)

## Context

The dev-server (`plugins/design/dev-server/server.mjs`, 1288 LOC zero-dep `node:*` on Node 20+) carries two unresolved questions before Phase 4 (Pixi.js canvas) lands:

1. **Distribution friction.** `npm i -g @1agh/md-claude` requires the user to have Node 20+ installed. Designers / PMs without Node can't run `mdcc design serve`. Cold start is ~150-200 ms (Node + babel-standalone parse).
2. **Performance ceiling.** Phase 8 (live collab) wants 10 K+ concurrent WebSocket connections per server; current handwritten upgrade + Node `ws`-less server tops out at ~680 K but with idle-RAM creep. Phase 4 wants 60 fps pan/zoom without the React reconciler stealing main-thread time.

Prior internal research [`research-runtime.md`](../docs/research-runtime.md) (2026-05-12) recommended *"Stay on Node now, ship Bun `--compile` standalone binary as a v1.1 side-channel via GitHub Releases."* The rationale was: Bun's perf delta is unobservable on this idle-99 % workload, and forcing every npm user onto Bun violates the zero-config UX. The deep-research follow-up (2026-05-15) reached the same conclusion via an external lens.

Both recommendations assumed the **dual-channel maintenance cost** (npm-via-Node + GitHub-Releases-via-Bun) was acceptable. The user re-examined this and pointed out: **Bun-compiled standalone binaries shipped via npm `optionalDependencies` sub-packages eliminate the dual-channel cost entirely** — end-user installs one thing (`npm i -g @1agh/md-claude`), npm resolves only the matching platform sub-package (~50-60 MB), the binary self-contains JSCore + Bun runtime + bundled JS. The user explicitly cited [Bun `--compile` docs](https://bun.com/docs/bundler/executables) and asked whether Claude Code itself uses this model.

A background agent un-tar-ed `@anthropic-ai/claude-code@2.1.142` from npm and confirmed: **yes, Claude Code ships exactly this way.**

- Main package: 14 KB tarball, 152 KB unpacked, 7 files.
- `bin: { "claude": "bin/claude.exe" }` — 500-byte ASCII stub. The `.exe` extension is intentional on all OSes (makes npm `cmd-shim` emit direct exec on Windows; Unix ignores).
- `optionalDependencies` lists 6+ platform sub-packages (`darwin-arm64`, `darwin-x64`, `linux-x64`, `linux-arm64`, `linux-x64-musl`, `linux-arm64-musl`, `win32-x64`).
- `install.cjs` postinstall: hardlinks the matching platform sub-package's binary **over** `bin/claude.exe`. After postinstall, invoking `claude` is a direct exec of the native binary — **no Node process at runtime**.
- `strings` on the binary reveals `bun-vfs$$/node_modules/…`, `Bun-Version`, Bun's `--compile` error strings — proves it's a Bun-compiled standalone binary.
- Comment on `install.cjs` line 180: *"Same pattern as Bun's npm package."* — this is the Bun-canonical distribution pattern.

The investigation reframed the question. The trade-off is no longer "Bun perf vs npm friction" (the friction is solvable) — it's whether to take the runtime-agnostic middle path (source compatible with both Node and Bun) or commit to Bun authoritatively (source uses `Bun.serve` / `Bun.file` / `Bun.write` natively, no Node fallback).

## Alternatives considered

### Option A — Status quo: stay Node 20+, no binary distribution

Source stays `.mjs` on `node:http` + handwritten WS upgrade. Users need Node installed.

- **Pros:** Zero migration cost. Maximum compatibility breadth. No new tail risk.
- **Cons:** Locked into Node startup latency (~150-200 ms cold start with babel-standalone). Designers / PMs without Node can't use `mdcc`. Phase 8 WS-scale headroom limited. Strategically diverges from Anthropic / Bun ecosystem.
- **Rejected:** the user wants the app "tip-top" before features land; distribution friction + cold-start budget are both load-bearing for the v1 ship narrative.

### Option B — Bun as build target only (runtime-agnostic source)

Source code keeps to `node:*` APIs (works on Node and Bun). CI compiles via `bun build --compile` per platform. Distribute via npm `optionalDependencies` sub-packages. Maintain a parallel Node bundle as a fallback (esbuild-built, no Bun internals) for `--runtime=node` env var or a separate `@1agh/md-claude-node` package.

- **Pros:** Full Bun perf + binary distribution win. Fallback path: if Bun upstream lands a regression, ship the Node bundle until upstream fixes. No source lock-in.
- **Cons:** Source can't use Bun's nice ergonomics (`Bun.serve`'s native WS, `Bun.file` lazy I/O, `Bun.write` zero-copy, `bun:test`). Dual-runtime CI surface. The Node fallback bundle has its own bug surface — when prod is Bun and fallback is Node, "works on my Bun" is no proof.
- **Rejected after user re-examination:** the user judged the lock-in cost lower than the dual-source-maintenance cost. The fallback is the lock-in's *insurance*; the question was whether the premium is worth it.

### Option C — Bun runtime authoritatively, no Node fallback

Source rewrites to `.ts` on Bun (`Bun.serve` + `Bun.file` + `Bun.write` + `Bun.spawn` + `bun:test`). `node:path` + `node:url` still used where Bun supports them transparently. Distribute via npm sub-packages as in Option B. **No Node fallback** — if Bun upstream regresses, we pin to a known-good prior Bun release until upstream fixes, but never maintain a parallel Node port.

- **Pros:**
  - Full Bun perf (4× HTTP, 1.7× WS, 40 % less RAM/socket, ~10-30 ms cold start vs ~50-100 ms Node).
  - One source surface, one CI runtime, one set of tests via `bun:test`.
  - Strategic + verified precedent alignment with `@anthropic-ai/claude-code` (same exact distribution + compile model).
  - End-user `npm i -g @1agh/md-claude` installs a working binary with zero Node dependency at runtime (postinstall hardlinks the binary over the stub — pattern documented in Bun's own npm package).
- **Cons:**
  - Lock-in. If Bun lands a regression we can't fast-pin around, we ship broken.
  - Bun tail risk: 758 open crash issues per HN thread (Sept 2025); reported leaks in Prisma + Express + Docker. Our code uses only the documented-stable Bun surface (`Bun.serve`, `Bun.file`, `Bun.write`, `Bun.spawn`, `bun:test`), so none of the reported crash classes apply today — but tomorrow's regression has no fallback.
  - Bun-Windows tier is the youngest; Win32 binary may surface platform-specific edge cases first.

## Decision

We pick **Option C — Bun runtime authoritatively, no Node fallback** because:

1. **Verified production precedent.** `@anthropic-ai/claude-code` is the closest possible neighbor (same distribution channel, same end-user surface, same parent platform) and uses this exact pattern. The risk surface is empirically de-risked.
2. **Single source of truth.** Maintaining a parallel Node port (Option B's fallback) is the kind of debt that decays fastest — "fallback only fixed when broken" → fallback breaks silently between regressions → fallback gives a worse UX → fallback is removed under pressure anyway. Skipping it removes the temptation.
3. **End-user UX win is concrete.** Cold start drops from ~150-200 ms to ~10-30 ms. Designers / PMs install `mdcc` with no Node prereq. This is the primary v1 differentiator over "feels like a dev preview."
4. **Strategic alignment with Anthropic.** md-claude is a Claude Code plugin marketplace; aligning with Claude Code's runtime + distribution model is the path of least friction for cross-ecosystem features later (e.g. shared Bun-native libraries, common diagnostics, identical install troubleshooting).
5. **Recovery is bounded.** If Bun upstream regresses, the recovery plan is "pin to prior known-good Bun version + ship a patch tag" — measured in hours, not weeks. A nightly CI perf-canary job against `bun-latest` (Phase 3.4 Task 13) flags regressions before they reach a release tag.

## Rejected alternatives — rationale

**Option A (stay Node)** rejected because the workload-perf argument from `research-runtime.md` is correct for the *server*, but doesn't address the end-user *distribution* cost (Node prereq + cold start). The user's v1-ship goal is a tip-top app, not "good enough server perf." Distribution friction is a tip-top blocker.

**Option B (Bun build target only, Node fallback maintained)** rejected because the fallback is dual-source-maintenance overhead that decays unobserved. Either the fallback is genuinely exercised (then it slows iteration on the hot path) or it's not (then it breaks silently between Bun releases). The user's risk appetite explicitly accepted the lock-in trade-off in exchange for source simplicity.

## Consequences

**Positive:**

- **End-user UX:** `npm i -g @1agh/md-claude` works with no Node prereq beyond the npm-installed-bin shim path; `mdcc design serve` cold-starts in < 100 ms; idle RAM drops to < 50 MB (Bun JSCore vs V8 baseline).
- **Source simplicity:** one runtime, one source set, one test runner (`bun:test`). No `process.platform === 'node' ? … : …` branches.
- **Native APIs:** `Bun.serve` includes native WebSocket (drops ~150 LOC of handwritten RFC-6455 upgrade); `Bun.file` is lazy + zero-copy where the kernel allows; `Bun.write` round-trips JSON with no manual serialize/stringify dance.
- **Phase 8 readiness:** Bun-native WS scales 1.7× over `ws`; 10 K concurrent connections per process budget becomes reachable without process forking.
- **Strategic alignment + precedent reuse:** same distribution pattern as `@anthropic-ai/claude-code`; future cross-plugin features can assume Bun runtime.

**Negative / trade-offs:**

- **Lock-in.** If Bun upstream regresses our hot path and we can't fast-pin around it, we ship broken. No Node escape hatch.
- **Bun tail risk surface.** Our code stays on the documented-stable Bun surface (`Bun.serve`, `Bun.file`, `Bun.write`, `Bun.spawn`, `bun:test`, `node:path`, `node:url`) — none of the reported crash classes (Prisma leak, Express-in-Docker hang, streams issue #16037) touch APIs we use. But tomorrow's regression is unbounded by today's audit.
- **CI complexity.** Seven-entry platform matrix (`darwin-arm64`, `darwin-x64`, `linux-x64`, `linux-arm64`, `linux-x64-musl`, `linux-arm64-musl`, `win32-x64`), per-platform binary publish, atomic 5-package release pipeline. `.github/workflows/build-binaries.yml` carries this cost.
- **npm tarball footprint per release:** 7 sub-packages × ~50-60 MB each gzipped = ~350-420 MB published per version (well below npm's hard cap; precedent set by Claude Code 59 MB / esbuild ~30 MB / swc ~50 MB).
- **Win32 risk:** Bun-Windows is the youngest tier. If Win32 binary becomes a release-blocker, ship the other six platforms and label Windows "preview" with a GitHub Releases binary download as a manual fallback.
- **Recovery plan must be drilled.** "Pin to prior known-good Bun + ship a patch tag" is the only recovery. The nightly canary job and a documented version-pin path in `package.json` `engines.bun` are mandatory, not optional.

## Behavioral rules (for CLAUDE.md follow-up)

This DDR encodes two rules future code must follow:

1. **Server code uses Bun APIs natively.** New endpoints, new file I/O, new subprocess invocations in `plugins/design/dev-server/` reach for `Bun.serve` / `Bun.file` / `Bun.write` / `Bun.spawn` — not `node:http` / `node:fs.readFile` / `node:child_process.spawn`. `node:path` and `node:url` are still fine (Bun supports them identically).
2. **Tests use `bun:test`.** Not `node --test`. (Exception: `cli/**/*.test.mjs` continues to use `node --test` because the CLI shim runs on whatever npm-exec resolves to — typically Node.)
3. **There is no Node port.** Do not add `process.versions.node` branches "just in case." If you're tempted to write a Node-compatible path, you're violating this DDR — open a follow-up DDR to revisit instead.

## Revisit when

- **Bun upstream regresses the hot path AND we can't fast-pin around it** (e.g. multiple consecutive minor releases break us with no prior known-good version available). In that case, revisit whether a Node port is cheaper than waiting upstream out.
- **Anthropic deprecates Bun or pivots Claude Code off it.** The strategic-alignment argument loses its weight.
- **End-user platform demand expands beyond Bun's compile-target reach** (e.g. wasm sandbox, ChromeOS-native, BSD variants). Bun's cross-compile matrix is the constraint; if users need a platform Bun doesn't ship, the binary-only model breaks.
- **2028-01** as a calendar checkpoint regardless — re-read the active Bun ecosystem state and confirm the bet still pays.

## Linked

- **Plan:** [`.ai/plans/phase-3.4-architecture-refactor.md`](../plans/phase-3.4-architecture-refactor.md) — implementation of this decision
- **Phase 4:** [`.ai/plans/phase-4-canvas-v2-rendering-engine.md`](../plans/phase-4-canvas-v2-rendering-engine.md) — consumes the Bun runtime; "runtime-agnostic constraint" section there was removed when this DDR landed
- **Supersedes (in part):** [`.ai/docs/research-runtime.md`](../docs/research-runtime.md) — research conclusion stays valid as workload analysis, but its top-line recommendation ("Stay Node, Bun side-channel") is superseded by Option C
- **Precedent (external):** `@anthropic-ai/claude-code@2.1.142` npm tarball — investigated 2026-05-15
- **Companion DDRs (renumbered after DDR-010/011 landed for other concerns; written as Phase 3.4 tasks land):**
  - [DDR-012](./DDR-012-react-19-unified-runtime.md) — React 19 unified runtime (supersedes the earlier Preact-`compat` draft; landed 2026-05-15 with the pivot)
  - [DDR-013](./DDR-013-server-modular-split-typescript.md) — server modular split into 7 TypeScript modules on `Bun.serve` (landed 2026-05-15)
  - [DDR-014](./DDR-014-css-layer-architecture.md) — `@layer` CSS architecture with Lightning CSS (landed 2026-05-15)
  - DDR-015 — per-platform binary distribution with postinstall-hardlink, mirroring Claude Code (pending; lands with Phase 3.4 Task 12-13)
  - [DDR-016](./DDR-016-runtime-folder-purpose.md) — `runtime/` folder audit verdict (landed 2026-05-15)
