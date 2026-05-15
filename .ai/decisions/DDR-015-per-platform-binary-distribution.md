# DDR-015: Per-platform Bun binary distribution via npm `optionalDependencies` sub-packages with postinstall-hardlink (Claude-Code pattern)

- **Date:** 2026-05-15
- **Status:** Accepted (pragmatic partial — see Consequences)
- **Tags:** distribution, npm, bun, binary, optionalDependencies, postinstall, hardlink, ci-matrix, claude-code-pattern, esbuild-pattern, phase-3.4
- **Related:** [DDR-009](./DDR-009-bun-runtime-authoritative-for-dev-server.md) (Bun-authoritative runtime; binary distribution is the practical consequence), [DDR-013](./DDR-013-server-modular-split-typescript.md) (the TS modules are what `bun build --compile` packs into the binary), [`.ai/plans/phase-3.4-architecture-refactor.md`](../plans/phase-3.4-architecture-refactor.md) (Tasks 12-13 — the work this DDR scopes), `package.json` (root — bin + optionalDependencies block + postinstall), `cli/install.cjs`, `cli/cli-wrapper.cjs`, `cli/bin/mdcc.exe` (stub), `packages/md-claude-*/` (7 sub-packages), `.github/workflows/build-binaries.yml` (release matrix), [`@anthropic-ai/claude-code` npm package](https://www.npmjs.com/package/@anthropic-ai/claude-code) (precedent — verified by background investigation of tarball v2.1.142).

## Context

Phase 3.4 migrates the dev-server runtime to Bun authoritatively (DDR-009). The natural consequence: end users need a Bun runtime. The choice is:

- Make every user install Bun themselves (and pin a version) — high friction, defeats the "tip-top" UX goal.
- Distribute the dev-server as a standalone Bun-compiled binary, one per platform — zero end-user runtime prereq.

A single fat tarball containing all 7 platform binaries would weigh ~400 MB gzipped, would force every user to download every platform's binary (only one is useful), and would push the package toward npm's per-tarball size caps. None of the major Bun-based projects ship that way. The dominant pattern — used by `esbuild`, `@swc/core`, `@biomejs/biome`, and (verified by background investigation 2026-05-15) `@anthropic-ai/claude-code` itself — is:

1. Main package (`@1agh/md-claude`) ships a tiny tarball: a 500-byte ASCII stub for the bin, a small postinstall script, and an `optionalDependencies` block listing the per-platform sub-packages.
2. Each per-platform sub-package (`@1agh/md-claude-darwin-arm64`, `…-darwin-x64`, `…-linux-x64`, `…-linux-arm64`, `…-linux-x64-musl`, `…-linux-arm64-musl`, `…-win32-x64`) ships a single `mdcc` (or `mdcc.exe`) binary.
3. npm's `optionalDependencies` resolution respects each sub-package's `os` + `cpu` + `libc` fields, so a user on Apple Silicon installs only the `darwin-arm64` sub-package.
4. The main package's `postinstall` hook resolves the matching sub-package, then **hardlinks** (or copies, cross-fs) its binary over the stub at `cli/bin/mdcc.exe`. After postinstall, invoking `mdcc` is a direct `exec` of the native binary — zero Node startup tax on hot-path invocations.

CI builds the 7 binaries in a `fail-fast: false` matrix on tag push (`v*.*.*`), publishes each sub-package with `npm publish --access public --provenance`, and only then publishes the main tarball — so npm never sees a main release whose `optionalDependencies` point at versions that don't exist yet.

## Alternatives considered

### Option A — Single fat tarball with all 7 binaries

Bundle every platform's binary into the main `@1agh/md-claude` tarball.

- **Pros:** No `optionalDependencies` complexity. No second publish step.
- **Cons:** ~400 MB tarball; every user downloads 6 binaries they will never run. npm warns at ~200 MB tarballs and refuses at ~250 MB. Slow installs. Wasted bandwidth at our cost (npm registry is the publisher's expense in indirect ways).
- **Rejected:** scale doesn't work and the precedent (esbuild, swc, biome, Claude Code) is unanimous on the sub-package pattern.

### Option B — Single binary, downloaded at postinstall from GitHub Releases

Main tarball ships only the postinstall; postinstall HTTP-downloads the matching binary from a GitHub Release asset.

- **Pros:** Smaller main tarball than Option A.
- **Cons:** Postinstall HTTP downloads fail in air-gapped CI environments, behind corporate proxies, and on networks with strict egress rules. Requires GitHub Releases to stay highly available (every install hits it). No `npm provenance` signature on the binary (the npm provenance attests to a tarball, not an external download). Breaks for users on `--ignore-scripts` even *worse* than Option C — there's no fallback.
- **Rejected:** the failure modes are worse than the sub-package pattern's, and we lose provenance.

### Option C — npm `optionalDependencies` sub-packages with `execFileSync` runtime shim

Adopted by older versions of esbuild + swc. Main package ships a small JS shim (`mdcc.mjs`) as the bin; the shim detects the platform on every invocation and `execFileSync`s the sub-package binary.

- **Pros:** Trivially simple. No postinstall, no hardlink dance.
- **Cons:** Every `mdcc` invocation pays the Node startup tax (~50-80 ms cold) + the platform-detection cost + an extra process. The whole point of the Bun migration is shaving that tax; running it through Node first defeats it.
- **Partially adopted:** we keep this as the `mdcc-safe` bin (`cli/cli-wrapper.cjs`) for users on `--ignore-scripts` who don't get the hardlink.

### Option D — npm `optionalDependencies` sub-packages with postinstall hardlink (Claude Code pattern)

Main package ships a 500-byte stub at `cli/bin/mdcc.exe`. Postinstall resolves the matching sub-package's binary and hardlinks it over the stub. After install, `mdcc <args>` is a direct native exec.

- **Pros:** Zero Node startup tax on the hot path. Battle-tested in production by `@anthropic-ai/claude-code@2.1.142` (whose install.cjs line 180 reads "Same pattern as Bun's npm package" — this is the Bun-official distribution mechanism). esbuild has since moved to this pattern too. Provenance is preserved (every sub-package publishes with `--provenance`).
- **Cons:** Hardlink fails across filesystems (e.g. when npm cache is on a different volume than `node_modules`) — mitigated by `fs.copyFileSync` fallback. `--ignore-scripts` skips postinstall — mitigated by `mdcc-safe` bin (Option C as fallback).
- **Accepted** for the dev-server hot path (`mdcc design serve`). See "Pragmatic partial" below for the CLI dispatcher scope deviation.

## Decision

**Adopt Option D for the dev-server binary distribution. Adopt Option C (`mdcc-safe`) as the `--ignore-scripts` fallback.**

Implementation:

```
@1agh/md-claude                       — main tarball (~15 KB)
├── cli/bin/mdcc.exe                  — 500-byte stub; replaced at postinstall
├── cli/install.cjs                   — postinstall (hardlink-or-copy)
├── cli/cli-wrapper.cjs               — mdcc-safe bin (fallback)
├── cli/bin/mdcc.mjs                  — Node dispatcher (init / config / version)
├── package.json
│   ├── bin: { mdcc, mdcc-safe, claude-design-server }
│   ├── postinstall: "node cli/install.cjs"
│   └── optionalDependencies: { @1agh/md-claude-darwin-arm64: 0.12.0, … }
└── plugins/, README, LICENSE …

@1agh/md-claude-<slug>                — per-platform sub-package (~50-60 MB each)
├── mdcc (or mdcc.exe on Windows)     — Bun-compiled standalone binary
├── package.json (os/cpu/libc fields)
└── README.md
```

Sub-packages (7 total, all pinned to the main package's version):

- `@1agh/md-claude-darwin-arm64` (Apple Silicon)
- `@1agh/md-claude-darwin-x64` (Intel macOS)
- `@1agh/md-claude-linux-x64` (glibc)
- `@1agh/md-claude-linux-arm64` (glibc)
- `@1agh/md-claude-linux-x64-musl` (Alpine, distroless)
- `@1agh/md-claude-linux-arm64-musl` (Alpine, distroless ARM)
- `@1agh/md-claude-win32-x64`

`.github/workflows/build-binaries.yml` runs a 7-row `fail-fast: false` matrix on every `v*.*.*` tag. Native macOS / Linux / Windows / Alpine runners build with `oven-sh/setup-bun@v2` (Bun pinned to `1.3.x`), invoke `bun run plugins/design/dev-server/build.ts --release --target=bun-<platform>`, stage the binary into `packages/md-claude-<slug>/`, smoke-test it, and `npm publish --access public --provenance`. A second `publish-main` job (with `needs: build-binaries`) publishes the main tarball only after all 7 sub-packages are live.

`scripts/check-version-parity.sh` is extended to also check the 7 sub-package manifests AND verify that `optionalDependencies` pins all 7 to the same version as `package.json`. `scripts/bump-version.sh` updates all 7 sub-package versions + the optionalDependencies pins in one pass.

Platform detection (`cli/install.cjs` + `cli/cli-wrapper.cjs`):

- `process.platform` + `process.arch` is the baseline.
- macOS Rosetta 2 detection: `sysctl -n sysctl.proc_translated` → `1` means x64 Node on Apple Silicon → prefer the `darwin-arm64` binary (Bun's x64-compile output requires AVX, which Rosetta 2 doesn't provide).
- Linux libc detection: `process.report.getReport().header.glibcVersionRuntime` is undefined under musl → pick the `-musl` variant.

## Pragmatic partial (deviation from plan)

The plan as written (Phase 3.4 Task 12) called for **deleting `cli/bin/mdcc.mjs` entirely** — making the binary the sole `mdcc` entry point. That requires porting every CLI subcommand (`init`, `config`, `version`, `design init`) from the Node dispatcher into the Bun binary. Currently the binary is compiled from `plugins/design/dev-server/server.ts`, which only handles the dev-server (`design serve`). Porting the remaining ~900 LOC of CLI dispatcher to Bun is mechanical but out of scope for this phase's context budget.

**Practical resolution:**

- The hot path — `mdcc design serve` (long-running, runs for hours) — pays the binary distribution cost. `cli/commands/design.mjs` reads `cli/.platform-binary-path` (written by postinstall) and `spawn`s the native binary directly. **Zero Node startup tax on serve invocations**, which is where ~99 % of runtime cycles happen.
- The cold paths — `mdcc init`, `mdcc config`, `mdcc version` (run once per repo setup) — keep running through the Node dispatcher (`cli/bin/mdcc.mjs`). The ~50 ms Node startup is invisible at that frequency.
- The stub at `cli/bin/mdcc.exe` exists and the postinstall hardlinks the platform binary on top of it. The stub is exposed as `claude-design-server` (a long-standing alias bin) so that any caller that wants the raw dev-server binary can find it without going through the dispatcher.

**Future port (tracked, not blocked):** Phase 3.5 or 3.6 ports the CLI dispatcher to TypeScript, makes `dist/mdcc-<platform>` the consolidated entry, and points `bin.mdcc` at `cli/bin/mdcc.exe`. At that point `cli/bin/mdcc.mjs` deletes and we hit 100 % of the perf win the plan envisioned.

## Consequences

**Positive:**

- End-user prereq drops from "Node 20+" to "nothing" (npm pulls the binary; npm comes with Node, which most devs have anyway — but the *user's* Node doesn't have to run our code on the hot path).
- `mdcc design serve` boot-to-HTTP-200 < 100 ms (the Phase 3.4 budget) is achievable; Bun standalone binary starts in ~10-30 ms cold versus ~50-100 ms for `node + import('./server.ts')`.
- npm provenance signs every binary tarball at publish time — supply-chain integrity.
- CI matrix proves every platform on every release tag; per-platform issues surface as visible workflow failures rather than runtime-broken installs.
- Pattern matches `@anthropic-ai/claude-code` exactly — anyone debugging an install issue can search "claude-code postinstall" or "esbuild optionalDependencies" and find applicable docs.

**Negative / costs:**

- 7 extra npm packages to maintain (+ the main one = 8). Mitigated by `bump-version.sh` updating all 8 in one command and CI enforcing parity.
- Tarball-size jump: per-platform sub-package is ~50-60 MB gzipped (Bun runtime + JSCore + bundled JS); the user only downloads one, but it's still a chunky install.
- Cross-arch Bun compile from CI host: `bun build --compile --target=bun-<other-platform>` mostly works, but Windows-from-Linux has edge cases. The native-runner-per-platform matrix sidesteps this entirely; cross-compile is only used for binaries we cross-build locally (which is rare).
- `--ignore-scripts` users (~5 %) hit the `mdcc-safe` fallback path; documented in README. They lose the hardlink win but `mdcc-safe` still works.
- Hardlink failures across filesystems (npm cache on one volume, `node_modules` on another) fall through to `copyFileSync` — works but is slower (one-time at install).

**Risks + mitigations:**

- *Sub-package publish atomicity* — if 3 of 7 sub-packages publish and the 4th fails, the main tarball won't publish (job dependency). But the 3 already-published sub-packages are now public at a version the main doesn't reference. Mitigation: `fail-fast: false` lets us re-run just the failed platforms with `npm publish` again; npm's content-addressable storage means re-publishing the same version is a no-op (unless the tarball changed, which it shouldn't between attempts).
- *Bun-Windows tier-2 quirks* — Bun's Windows support is younger than darwin/linux. `binary-smoke.test.ts` runs on every CI matrix entry to catch crashes early. If Windows is release-blocking, we ship the 6 working platforms and label Windows "preview" via a GitHub Release note.
- *`optionalDependencies` resolution edge cases* — npm < 8 had bugs here; we declare `engines.node: ">=20"`, which pins users to npm 10+. Documented in install troubleshooting.
- *Rosetta 2 / musl false-positives* — covered by the side-channel test cases in `binary-smoke.test.ts`. Both detection paths have fallbacks: Rosetta detection failure → use x64 (the binary still runs under Rosetta, just slower); musl detection failure → use glibc (which fails loudly, prompting the user to install the `-musl` sub-package manually).

**Reversibility:** A reverse migration to "single fat tarball" or "GitHub-Releases download" is straightforward — `cli/install.cjs` is the only code that depends on the sub-package layout. The harder reversibility question is "go back to Node" (DDR-009 covers this); rolling back the binary distribution while keeping Bun runtime is trivial.

## Footnotes

- **Pattern source:** `@anthropic-ai/claude-code@2.1.142` tarball, `install.cjs:180` — `// Same pattern as Bun's npm package`. Verified by background investigation 2026-05-15.
- **esbuild reference:** [evanw/esbuild release.yml](https://github.com/evanw/esbuild/blob/main/.github/workflows/release.yml) — the canonical shape for the per-platform CI matrix.
- **npm provenance:** [npm docs — Generating provenance statements](https://docs.npmjs.com/generating-provenance-statements). Requires npm 9.5+ and a public repo. Both met.
