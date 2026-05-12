# Research — Runtime choice for `plugins/design/dev-server/`

> Status: research only, no decision committed. Author: research subagent. Date: 2026-05-12.
> Scope: Should we rewrite the design dev-server from Node.js 20+ to Bun (or Deno)? Optimized for end-user experience (latency, distribution friction, runtime requirements) rather than raw throughput, since the server is 99% idle.

---

## TL;DR — Executive recommendation

**Stay on Node.js for the main `server.mjs` runtime today. Adopt Bun as an optional shipped binary in parallel via a thin npm wrapper once Phase 4 (Pixi.js client bundle) or Phase 8 (multi-cursor presence) lands.** A full rewrite is premature; runtime-agnostic refactoring + dual build targets is the pragmatic middle path.

Why now-but-not-yet:

1. The current workload (1 HTTP server, a few WS clients per editor session) has zero measurable benefit from Bun's perf delta. Latency is dominated by network + user think time, not runtime CPU. Switching now buys ~0ms in user-perceived speed.
2. Bun is, however, the strategic runtime for this ecosystem: Anthropic acquired Bun in late 2025 and Claude Code itself ships as a `bun build --compile` binary. As an md-claude plugin we *will* eventually want symmetric distribution.
3. The compelling moment to introduce Bun is **distribution**, not performance: a single-file binary published per platform via GitHub Releases lets non-dev users (designers, PMs) run `mdcc design serve` without installing Node. That payoff arrives once we have a richer bundle (Phase 4+) where "no Node required" actually changes who can install.

So the actionable trade-off is:
- **If you want quickest win + lowest risk now**: keep Node, write the new code (Phase 4-8) runtime-agnostically, and add a `bun --compile` target as a CI artifact once it's worth shipping.
- **If you want maximal designer-friendliness sooner**: cut over the dev-server to `Bun.serve` now and accept the medium risk that some `node:http` edge case bites you (see Risks). Distribution stays npm-only either way until you set up release binaries.

Deno is not recommended for this project. Section 4 details why.

---

## 1. Workload reality check

The dev-server source is `/Volumes/D/git/claude-design/plugins/design/dev-server/server.mjs` (~1280 lines, zero npm deps). Hot paths:

| Path | Frequency (typical session) | CPU cost |
|------|------------------------------|----------|
| `GET /` HTML shell | 1× per page load | negligible |
| `GET /<canvas>.html` static file | dozens per session | trivial fs.readFile |
| `GET /api/active`, `/api/state/*` | sub-Hz polling from inspector | trivial JSON write |
| WebSocket frame (active-canvas, inspector hover) | sub-Hz from 1-3 tabs | ~zero |
| `node:crypto.createHash('sha1')` for WS handshake | 1× per WS connect | microseconds |
| (Phase 4) bundle Pixi.js client | build-time, not request-time | bundler concern |
| (Phase 6) PDF render via `pdf-lib` | on-demand, seconds-scale | CPU-bound, JS-bound |
| (Phase 7) ACP relay over WS | spike during agent runs | I/O-bound |
| (Phase 8) cursor presence broadcast | 10-30Hz per client during collab | small JSON over WS |

**Implication.** None of the present or near-term hot paths is bottlenecked by Node's HTTP stack. Phase 8 multi-cursor *could* benefit from Bun's WS perf, but only at numbers (>100 concurrent cursors) we will not realistically hit in a single-editor tool. The case for switching is **not perf**, it is **distribution + runtime story alignment with Claude Code itself**.

---

## 2. Candidate runtimes

### 2.1 Node.js 20+ (status quo)

Maturity: maximum. Compatibility with the existing codebase: 100% (it is the codebase). npm-native; `engines.node >= 20` already in `package.json`.

Pros for our workload:
- All `node:http`, `node:crypto.createHash`, `node:fs/promises`, `node:net`, `node:child_process.exec` semantics are the reference — no compat risk.
- Single Sea (`node --experimental-sea-config`) exists for binary distribution but is experimental and clumsy compared to `bun build --compile` and `deno compile`.
- LTS cadence is predictable; Node 22 is current LTS.

Cons:
- End user needs Node installed. Not a problem for engineers, but is friction for the "designer with `npm i -g`" path.
- `node --experimental-sea-config` standalone binary is ~80MB, finicky on macOS (resource-fork tricks), no first-class cross-compile.
- WebSocket handshake is hand-rolled via `node:crypto` (current code does this), which is fine but is one more thing to maintain vs `Bun.serve({ websocket })`.

### 2.2 Bun 1.3.x (challenger)

Current stable: **Bun 1.3.13**, released **2026-04-20** (still 1.3.x line, no 1.4 yet as of May 2026). Stable line since March 2025 with monthly patches.

Anthropic acquired Bun in late 2025; Claude Code itself ships as a `bun build --compile` binary distributed to "millions of developers across macOS, Linux, and Windows." This is strategically important context for an md-claude marketplace plugin.

**Compat with our APIs** (per `bun.com/docs/runtime/nodejs-compat`, claims Node v23 parity):
- `node:http` — "Fully implemented. Outgoing client request body is currently buffered instead of streamed." Server-side request handling (our use case) is in the green. v1.3.13 added HTTP/2 h2c fixes; no open critical issues for `http.createServer` server-mode that affect us.
- `node:crypto` — Documented gaps are `secureHeapUsed`, `setEngine`, `setFips`. `createHash('sha1').update(...).digest('base64')` (our WS handshake call) is supported.
- `node:fs/promises` — fs as a whole passes 92% of Node's test suite. The specific calls we use (`readFile`, `writeFile`, `readdir({ withFileTypes: true })`, `mkdir({ recursive: true })`, `stat`) are all covered.
- `node:net` — fully implemented.
- `node:child_process.exec` — Documented gaps are `proc.gid`, `proc.uid`, missing Stream class export, no socket-handle IPC. `exec` for our single use (opening a browser via `open`/`xdg-open`) works.
- `node:url.fileURLToPath` — supported.
- `node:path` — 100% Node test-suite pass.

**Known issues to watch (real reports, not speculation):**
- Issue #20333 (June 2025): `http-server` package failed in Bun with `"TypeError: Attempted to assign to readonly property"` when assigning `response._headerNames`. Our code does NOT touch internal `_*` properties of the response, but third-party HTTP libraries can.
- Issue #14676 (Oct 2024): `bun build --compile` was reported as not truly standalone in certain `node_modules` configurations. Closed as "not planned" — interpretation: works as intended when you bundle correctly via the bundler instead of relying on disk `node_modules`. Implication for us: the compile flow expects bundler-style packaging; the current "zero deps, just run server.mjs" model maps to that easily.
- Hacker News thread (Sept 2025) collected complaints: Prisma memory leak; Express-in-Docker hang resolved by switching to Node; streams issue #16037; 758 open crash-related issues. None of these reports touch APIs we use, but they're a signal that Bun's tail risk is non-zero.

**Distribution superpower**: `bun build --compile --target=<t>` produces a single-file executable per platform. Available `--target` values:
- `bun-darwin-arm64`, `bun-darwin-x64`, `bun-darwin-x64-baseline` (pre-2013 CPUs)
- `bun-linux-x64`, `bun-linux-x64-modern` (Haswell+), `bun-linux-x64-baseline`, `bun-linux-arm64`
- `bun-linux-x64-musl`, `bun-linux-arm64-musl`
- `bun-windows-x64`, `bun-windows-x64-modern`, `bun-windows-x64-baseline`, `bun-windows-arm64`

That's 11+ targets to ship if we want exhaustive coverage. Realistic minimal matrix: 4 (`darwin-arm64`, `darwin-x64`, `linux-x64`, `windows-x64`) covers ~99% of designers and PMs.

**Binary size**: ~55-91 MB per platform for a hello-world (depends on platform; macOS arm64 around 57MB in v1.1.30; Linux ~91MB before recent size cuts; Windows ~100MB). v1.3.11 shaved ~4 MB on Linux. With `--minify` and `--bytecode`, additional megabytes come off, though source-map / runtime overhead dominates.

**Code signing on macOS**: documented and supported as of Bun **v1.2.4+**. Workflow is standard `codesign` with `entitlements.plist` requesting `com.apple.security.cs.allow-jit`. Notarization is the usual Apple step (`xcrun notarytool` + `xcrun stapler`) and is not Bun-specific; it costs an Apple Developer ID ($99/yr) and ~15 min of CI plumbing per release.

### 2.3 Deno 2.x

Current state (May 2026): Deno 2 launched late 2024 with explicit npm + `node_modules` support. `deno compile` produces standalone binaries with `--target` cross-compile.

Why it's not a fit for us:
- Our code uses `node:*` imports throughout, which Deno 2 supports — but Deno's value proposition is permissions and Web-first APIs, neither of which solves anything we have.
- Strategic alignment: Claude Code chose Bun; Anthropic now owns Bun. As a Claude marketplace plugin, betting against that direction adds friction without payoff.
- `deno compile` binaries are smaller (~50% slimmer per Deno 2024 retrospective) but the ecosystem story (npm publish flow, `package.json` engines, scoped `@1agh/md-claude`) is more pleasant in Bun.

Recommendation: rule out unless a future requirement (e.g. running untrusted user-supplied design code with a sandbox) makes Deno's permissions model load-bearing. Phase 7 ACP relay is the only candidate, and even there a Bun child process with restricted env vars is sufficient.

---

## 3. Per-criterion comparison

| Criterion | Node 20+ | Bun 1.3 | Deno 2 |
|---|---|---|---|
| API drop-in for current `server.mjs` | 100% | ~99% (caveats §2.2) | ~95% (node: import path mapping works, behavior diffs possible) |
| `node:http` server-mode stability | reference | green per docs, watch issue tracker | green via `node:http` shim |
| WebSocket handshake (`crypto.createHash` sha1) | reference | supported | supported |
| Native WS server primitive | hand-roll via http upgrade | `Bun.serve({ websocket })` with pub/sub | `Deno.upgradeWebSocket()` |
| WS perf (relevant if Phase 8 scales) | baseline | 7x throughput / 60% less mem (uWebSockets-based) | competitive, less documented |
| Cold start | ~80ms | ~10-20ms | ~30ms |
| Bundle a single-file executable | `node --experimental-sea-config`, awkward | `bun build --compile` mature | `deno compile` mature |
| Binary size per platform | ~80MB | ~50-90MB | ~50MB |
| Cross-compile targets | very limited | 11+ targets | 4-6 |
| macOS code signing | manual | documented since v1.2.4 | documented |
| npm publish story | native | `bun publish` mirrors npm | works but Deno-native registries (jsr) preferred |
| Strategic alignment with Claude Code ecosystem | neutral | **strongly aligned (Anthropic-owned)** | counter-direction |
| Risk of "weird breakage" 2-3 yr horizon | very low | low-medium (acquisition + 1.3 stability) | low-medium |

---

## 4. Standalone binary distribution analysis

The hypothesis: ship a thin npm wrapper that downloads a per-platform single-file binary, eliminating the need for end users to have Node installed.

### 4.1 The npm pattern (proven by esbuild)

esbuild distributes via npm `optionalDependencies` keyed on `os` + `cpu`: a parent package `@1agh/md-claude` declares `optionalDependencies` for `@1agh/md-claude-darwin-arm64`, `@1agh/md-claude-linux-x64`, etc. npm/pnpm/yarn install only the one matching the host. A tiny launcher in the parent package resolves the binary and `execve`s it.

Advantages over `postinstall`:
- Works inside corporate proxies, offline mirrors, read-only filesystems.
- No supply-chain attack surface from a postinstall download script (which more orgs are starting to block by default).
- Native to the package manager — if it doesn't work, it's a pm bug, not ours.

Esbuild ships **both** approaches as belt-and-suspenders, because optionalDependencies can be disabled in some setups. We can do the same; the postinstall fallback is ~20 lines of code that fetches from GitHub Releases.

### 4.2 Binary matrix to ship

Realistic minimum:
- `bun-darwin-arm64` (Apple Silicon)
- `bun-darwin-x64` (Intel Mac, still in use)
- `bun-linux-x64-modern`
- `bun-windows-x64-modern`

Stretch:
- `bun-linux-arm64` (Raspberry Pi, AWS Graviton dev setups)
- `bun-linux-x64-musl` (Alpine Docker)

Total Releases artifact storage per version: ~4 platforms × ~60-90 MB = **240-360 MB per release**. GitHub Releases is free for public repos; not a cost concern.

### 4.3 Per-platform per-binary trade-offs

| Concern | Trade-off |
|---|---|
| Bundle size of the npm `dist-tag` | Parent stays tiny (~50KB) thanks to optionalDeps; users only pull their platform's ~60MB tarball. |
| `npm i -g` time on cold cache | Dominated by the platform binary download. ~3-10s on broadband. Comparable to esbuild. |
| Codesigning / notarization | Mandatory for macOS users who download from GitHub (Gatekeeper). Requires Apple Developer ID. Skipping = users see "untrusted developer" prompt. |
| Windows SmartScreen | Either pay for an EV cert (annual) or accept the warning. Most CLI tools skip this. |
| Bun runtime version pinning | The runtime is embedded in the binary; we control upgrades by re-releasing. No runtime drift between users. **This is a real wins-over-Node distribution benefit.** |
| Multi-arch CI cost | GitHub Actions free tier handles macOS arm64, x64, Linux x64; Windows x64 native. Linux arm64 needs `setup-qemu-action` or arm runners (now free for OSS). ~5-10 min per build matrix entry. |
| Version skew bug surface | We now ship four flavors of "the same product". One platform-specific Bun bug = one platform-specific release patch. Manageable but new failure mode. |

### 4.4 Postinstall friction reality

For the user who runs `npm i -g @1agh/md-claude`, the experience is:
- *Today (Node-only)*: ~3s install, ~0 disk overhead since they have Node. Works on any platform.
- *With Bun binary via optionalDeps*: ~5-10s install, ~60MB platform binary cached. Works on the 4 platforms we shipped. **Designers without Node installed can now use it.**

The net is "+5s install for engineers, –$infinity friction for non-engineer users." Worth doing once we have something a non-engineer wants to install.

---

## 5. Hybrid strategy proposal (recommended path)

**Phase A (now, no code change urgency):**

1. Audit `server.mjs` for any subtle Node-only behavior. The audit list:
   - `node:http` server upgrade event handling (we manually compute `Sec-WebSocket-Accept` with sha1). This is fine on Bun but reads weirdly — leaving it as-is is the right call; rewriting to `Bun.serve({ websocket })` would be Bun-only.
   - `node:child_process.exec` for opening the browser (`open` macOS, `xdg-open` Linux, `start` Windows) — works on all three runtimes.
   - `process.argv` parsing — works everywhere.
   - File paths: we use `path.posix.join` for URLs and `path.join` for fs; both behave the same.
2. Ensure new Phase 4-8 code stays in the Node-compatible subset. Avoid:
   - `Bun.serve`, `Bun.file`, `Bun.write` (Bun-only).
   - `Deno.*` (won't appear).
3. Add a `.ai/docs/runtime-targets.md` rule: "All code in `plugins/design/dev-server/` MUST run on Node 20+. Bun parity is desired; Deno parity is not required." This is the only doc change needed today.

**Phase B (when Phase 4 Pixi bundle is real and you want non-dev users):**

1. Set up `bun build --compile --target=<t>` in CI for the 4-platform minimum.
2. Publish per-platform tarballs as `@1agh/md-claude-<os>-<arch>` scoped packages.
3. Add `optionalDependencies` to the parent `@1agh/md-claude`.
4. Thin launcher in `cli/bin/mdcc.mjs` decides: if a platform binary is available, exec it; otherwise fall back to `node plugins/design/dev-server/server.mjs`. The fallback also preserves the current dev-loop experience for contributors.
5. Codesign + notarize macOS binaries in CI.
6. Document the dual install path in `README.md`: "fast path (binary)" vs "compatible path (Node)".

**Phase C (optional, only if benchmarks justify):**

If Phase 8 cursor presence shows measurable bottleneck on Node, write a `server.bun.mjs` variant that uses `Bun.serve({ websocket })` with native pub/sub `server.publish(topic, msg)`. Default stays Node; Bun variant is opt-in via `mdcc design serve --runtime=bun`. Until benchmarks demand it, this is overengineering.

---

## 6. Bundler question (Bun vs esbuild for Phase 4)

If/when we bundle the Pixi.js + React + pdf-lib client (Phase 4 / Phase 6):

| Criterion | esbuild | Bun bundler |
|---|---|---|
| Speed | ~300-700ms cold prod build | ~1.75x faster than esbuild on three.js bench |
| Tree-shaking | yes | yes, always on |
| Plugin API | mature, large ecosystem | "esbuild-compatible" (subset) |
| Stability for React + Pixi + pdf-lib | proven everywhere | should work; less mileage |
| Independent install | `npm i esbuild`, works anywhere | requires Bun runtime to build |
| Output controllability | mature | newer |

**Recommendation**: use **esbuild** for the bundler. Reasons:
- The 2x speed delta is meaningless at our bundle size (single-digit MB).
- esbuild as a build-time dep does not affect runtime, so the runtime choice (Node vs Bun) is decoupled from the bundler choice.
- pdf-lib is pure JS, no native deps; bundles cleanly anywhere.
- Pixi.js v8 bundles cleanly with esbuild (well-documented).

The exception: if we go full Bun (run `bun` in CI anyway for the `--compile` step), using `bun build` for the client bundle is one less tool. Marginal win.

---

## 7. Benchmark plan (before any irreversible decision)

The cheap experiment to do before committing:

1. **Build a port of `server.mjs` to `Bun.serve` (1-2 hour spike)** in a branch. Keep `node:*` imports for fs/path/etc, replace only `http.createServer` + manual upgrade with `Bun.serve({ fetch, websocket })`. Diff the LoC and the readability.
2. **Measure cold start**: `time mdcc design serve --port 4399` vs `bun ...`. Expect Bun to win by ~50ms. Not load-bearing for us but verify the claim holds.
3. **Measure WS broadcast latency** under realistic load: 5 simulated tabs subscribing to active-canvas state, server pushing 30 frames/sec for 60 seconds. Track p50/p95/p99 with `performance.now()` on the client. Expect <1ms on both; Bun's win is invisible to humans.
4. **Measure single-file binary size** for the minimal 4-platform matrix:
   ```
   bun build --compile --minify --bytecode --target=bun-darwin-arm64 plugins/design/dev-server/server.mjs --outfile bin/mdcc-darwin-arm64
   ```
   Expected: 55-70 MB each. Record actual.
5. **Measure cold install** for the optionalDeps wrapper: `npm i -g @1agh/md-claude` on each of 4 platforms with a fresh cache. Compare to current install time.

Do not commit to a runtime change until 1-3 are run. Do not commit to binary distribution until 4-5 are run.

---

## 8. Risks

### 8.1 Bun-specific tail risks

- **Acquisition aftermath**: Anthropic now owns Bun. Mostly upside (more funding, prioritization toward Claude Code use cases), but governance/license drift is a non-zero tail risk. Bun remains MIT as of May 2026.
- **Subtle `node:http` divergence**: server-mode is "fully implemented" but corner cases (header normalization, raw `req._headerNames` access patterns, trailing slashes in URLs) have surfaced in third-party libs. Our code is plain enough to dodge most of these. Mitigation: keep a Node fallback path.
- **`crypto.createHash` semantics**: documented as supported, but the exact byte output for the WS magic-string + SHA1 + base64 chain must be tested. Trivially verified by hand.
- **`bun build --compile` and dynamic file paths**: the compiled binary embeds files declared at build time. Our server reads arbitrary files from the user's `.design/` at runtime — those are user files, NOT embedded, NOT a problem. But: if we ever read a file from `__dirname`-relative path inside the dev-server itself, the embedded vs disk distinction matters. Current code only uses `__dirname` for serving `dev-server/client/*` assets — these would need to be **embedded** at compile time with the `with { type: "file" }` attribute or bundled inline.
- **758 open crash-related GitHub issues** as a generic signal that Bun's bug tail is longer than Node's. Mitigation: pin Bun version per release; ship Node fallback.

### 8.2 Distribution-specific risks

- **macOS notarization** must be set up correctly or users see "developer can't be verified" + an extra Settings click. Engineering cost: ~1 day of CI plumbing. Annual cost: $99 Apple Developer ID.
- **Windows SmartScreen** will warn on unsigned binaries until reputation accrues. Common annoyance; not a blocker.
- **Per-platform bug surface**: we now have to consider "broken on Windows x64 but works elsewhere" type issues. Mitigation: the Node fallback path always exists.
- **Repo size**: GitHub Releases storage is free; not a concern.
- **Update story**: today users `npm update`; with binaries we still rely on `npm update` to trigger optionalDeps refresh. Same pattern esbuild uses successfully at scale.

### 8.3 Hybrid strategy risks

- **Two code paths to maintain**. Mitigation: avoid the `server.node.mjs` + `server.bun.mjs` split. Keep ONE `server.mjs` that runs on both, and treat `bun --compile` purely as a packaging step. Only fork if benchmarks force it.
- **Version skew** between the Bun-compiled binary and the Node fallback when users switch between them in a session. Mitigation: same source file → no drift possible.

### 8.4 Status-quo risks (sticking with Node-only)

- **Friction barrier** for the designer / PM persona who is the entire reason this server exists.
- **Strategic dissonance**: shipping a Claude Code plugin in the runtime Claude Code is not. Not a functional issue, but a small bet against the ecosystem's chosen direction.

---

## 9. Decision checklist (use when ready to decide)

If checking most "yes" → switch runtime (Bun) or add binary distribution:
- [ ] Phase 4 Pixi client lives in the dev-server bundle (yes → distribution matters more)
- [ ] Non-engineer end users are a real persona for `mdcc design serve` (yes → binary distribution wins)
- [ ] WS throughput hits >50 concurrent clients regularly (yes → Bun WS perf matters)
- [ ] CI budget for 4-platform build matrix is acceptable (yes → binary distribution feasible)
- [ ] Apple Developer ID is in hand or budgetable (yes → macOS notarization possible)
- [ ] Bun-only `node:*` quirks in our code are zero (verify via benchmark step 1)

If most are "no" → status quo (Node-only via npm) is correct.

---

## 10. References

Bun docs & releases:
- Node.js compatibility matrix: https://bun.com/docs/runtime/nodejs-compat
- WebSocket API: https://bun.sh/docs/api/websockets
- Standalone executables / `bun build --compile`: https://bun.com/docs/bundler/executables
- macOS codesign guide: https://bun.com/docs/guides/runtime/codesign-macos-executable
- Bun v1.3.13 release notes (2026-04-20): https://bun.com/blog/bun-v1.3.13
- Anthropic acquisition: https://www.anthropic.com/news/anthropic-acquires-bun-as-claude-code-reaches-usd1b-milestone
- Bun joins Anthropic (blog): https://bun.com/blog/bun-joins-anthropic
- Releases page: https://github.com/oven-sh/bun/releases

Benchmarks & analysis:
- Strapi cross-runtime 2026 comparison: https://strapi.io/blog/bun-vs-nodejs-performance-comparison-guide
- Sachin Sharma 2026 production benchmark (Bun vs Node 24 vs Deno 2): https://sachinsharma.dev/blogs/bun-vs-node-vs-deno-benchmark
- Tech Insider "Bun vs Node: 3x faster, but is it ready?" (2026): https://tech-insider.org/bun-vs-nodejs-2026/
- Alex Cloudstar "Bun Compatibility 2026": https://www.alexcloudstar.com/blog/bun-compatibility-2026-npm-nodejs-nextjs/
- Lemire's WS benchmark (Node vs Bun, baseline reference): https://lemire.me/blog/2023/11/25/a-simple-websocket-benchmark-in-javascript-node-js-versus-bun/
- byteiota "Bun Runtime Production Guide 2026: Speed vs Stability": https://byteiota.com/bun-runtime-production-guide-2026-speed-vs-stability/
- Oliver Yasuna "Case for Bun in 2026: where it works, where it doesn't" (May 2026): https://medium.com/@oliveryasuna.main/the-case-for-bun-in-2026-where-it-works-and-where-it-doesnt-1cf61a55d1c9

Known issues:
- "bun build --compile not truly standalone" #14676: https://github.com/oven-sh/bun/issues/14676
- "http-server fails on Bun" #20333: https://github.com/oven-sh/bun/issues/20333
- HN skeptical thread (Sept 2025) — production breakage reports: https://news.ycombinator.com/item?id=45211622
- Reduce executable size #5854 / #14546: https://github.com/oven-sh/bun/issues/5854

Bundler comparison:
- Bun bundler vs esbuild official docs: https://bun.sh/docs/bundler/esbuild
- Bun bundler blog: https://bun.com/blog/bun-bundler
- 2025 bundler comparison roundup: https://strapi.io/blog/modern-javascript-bundlers-comparison-2025

Distribution pattern (optionalDependencies):
- esbuild platform-specific binaries via optionalDeps (#1621): https://github.com/evanw/esbuild/pull/1621
- Sentry "How to publish binaries on npm": https://sentry.engineering/blog/publishing-binaries-on-npm

Deno:
- Deno 2 announcement: https://deno.com/blog/v2.0
- `deno compile` self-contained binaries: https://deno.com/blog/deno-compile-executable-programs
- Deno node/npm compat: https://docs.deno.com/runtime/fundamentals/node/

Cross-runtime architecture:
- pmbanugo "Runtime-agnostic packages": https://pmbanugo.me/blog/runtime-agnostic-packages-apps-javascript
- `@cross/utils` runtime detection helpers: https://jsr.io/@cross/utils
