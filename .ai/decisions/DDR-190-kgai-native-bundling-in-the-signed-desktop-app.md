# DDR-190: Bundling a third-party native engine (kgai `kg` + Kuzu) into the signed desktop app — pinned build-time fetch, never vendored, never floating

**Status:** Accepted
**Date:** 2026-07-23
**Tags:** kgai, desktop, tauri, sidecar, bundling, supply-chain, codesign, notarization, provenance, licensing, ddr-126, ddr-177, ddr-189

## Context

Phases 1–7 of `feature-kgai-ecosystem-integration` made the knowledge graph work everywhere a **terminal** is available. In the shipped desktop app it was **inert**: the ACP chat session is built with `settingSources:['user']` (DDR-144) and force-injects only our own bundled `design` plugin, so a terminal-less DDR-177 user — the app's primary persona — never marketplace-installs kgai, and its `Stop` hook (which IS the autonomous decision-capture nudge) never fires. A graph that only fills from terminal sessions would miss most of a team's work, so "desktop auto-capture works" is release-gating, not optional.

Making it work means shipping **someone else's native code** inside a Developer-ID-signed, notarized `.app`: the `kg` binary (kgaidev/kgai, Go), its native `libkuzu` (Kuzu), and kgai's Claude Code plugin tree (hooks/skills/commands). That is a supply-chain, licensing, and signing decision — not a build detail — so it gets its own record, analogous to DDR-126 (distribution/auto-update/signing posture) and DDR-177 (bundle self-containment).

## Alternatives considered

- **Vendor the kgai source/binaries into this repo** — rejected. It puts a 48 MB third-party blob (plus a plugin tree) under our version control, makes every upstream bump a large commit, and diverges from the established pattern for every other third-party binary we ship (`sync-sidecar`, `sync-agent-browser` fetch at build time; binaries are gitignored).
- **Install kgai at first run from inside the app** (run upstream's `scripts/install.sh`) — rejected. It needs Go + network at runtime, is exactly the "no toolchain" case DDR-177 exists to close, and would execute an unpinned upstream script on the user's machine after signing — the worst of both worlds for provenance.
- **Float on the latest kgai release** — rejected. An upstream change would silently alter behavior *inside an already-signed build*; the `as-of`/`set_props`/scoping surface has already moved once during this feature. Supply-chain reasoning from DDR-054/056: the bundled `kg` is third-party code we vouch for by signing it.
- **Pinned build-time fetch + explicit neutralization (this DDR)** — picked.

## Decision

1. **Pinned build-time fetch, never vendored.** `apps/desktop/scripts/sync-kg.mjs` downloads a **pinned** kgai release (`KGAI_VERSION`, the build-side mirror of `config.knowledgeGraph.engineVersion`) into the Tauri staging tree: `kg` → `binaries/kg-<target-triple>` (an `externalBin` sidecar, so **Tauri signs it** with the app), `libkuzu` → `resources/kgai/`, and the plugin tree → `resources/plugins/kgai/`. All are gitignored, exactly like the other synced binaries. Advancing the pin is a deliberate, harness-verified step (`maude kg check-upstream` reports installed-vs-latest + a capability diff) — **never automatic**.

2. **Integrity is asserted, not assumed.** The fetch is chunked + **size-verified against the release metadata**. This is not theoretical: GitHub's CDN truncated the 34 MB `libkuzu` repeatedly on a flaky link (measured 2026-07-22), and a short file passes a naive download, then fails `codesign` with "main executable failed strict validation" and SIGKILLs at runtime. A short download is now a **build failure**, not a broken signed bundle.

3. **Upstream's `SessionStart` install hook is stripped at stage time.** We keep ONLY kgai's `Stop` hook (the capture nudge). The install hook would run `scripts/install.sh` (Go + network, 180 s) on every session start of a signed app whose engine is already staged — pointless and a runtime-code-execution surface. `scripts/` is deliberately not staged.

4. **Injected as a first-party session plugin, with its natively-installed copy suppressed.** `KGAI_PLUGIN_DIR` (paths.ts, DDR-045 resolution) feeds `computeSessionPlugins()`; `bridge.ts` adds `kgai: false` to the hand-maintained `enabledPlugins` literal. Suppression matters MORE for kgai than for our own plugins: a user-installed copy would run its own install hook and point at a *different engine version* than the pinned sidecar we signed.

5. **Engine resolution is pkgRoot-based, not env-plumbed.** `maude kg` resolves the staged sidecar from maude's own package root (`Contents/MacOS/kg` + `Resources/kgai/libkuzu`) and folds the lib dir into `DYLD_`/`LD_LIBRARY_PATH` itself, so no spawner has to thread env through. `KGAI_BIN`/`KGAI_LIB` remain honored as an override.

6. **Licensing + provenance are shipped.** kgai is **MIT**; its `LICENSE` is staged with the tree and a `VERSION` stamp (release tag, repo, license, platform slug) lands in `Resources/kgai/` so what shipped is inspectable from the bundle.

7. **A bundle gate, because "green in `tauri dev`" proves nothing.** `check-bundle-completeness.mjs` gained kgai checks: libkuzu present, pin stamped, **Stop hook present**, **SessionStart absent**, and (with `--smoke`) a stripped-PATH `maude kg resolve` that must report `kgPresent:true` — i.e. the sidecar resolves with no `node`/`bun`/`kg` on PATH. This is the DDR-177 lesson applied before shipping rather than after.

**Platform scope:** kgai publishes darwin + linux prebuilts only. On Windows the sync is a **documented no-op** — the app ships without the graph and every `maude kg` verb degrades to its inactive no-op. `MAUDE_SKIP_KG_SYNC=1` opts any build out.

## Consequences

**Positive:**
- Autonomous capture works in the shipped app for the terminal-less user — the whole point of Phase 8.
- Bundle size grows ~48 MB, but with zero runtime install, zero network at first run, and a signed/notarized engine.
- The pin makes "what engine is in this build" answerable from the bundle itself, and upgrades are a reviewed step.

**Negative / trade-offs:**
- We now sign and distribute third-party native code — our notarization vouches for it. Advancing the pin needs the same care as any dependency bump (this is the DDR-054/056 posture, accepted deliberately).
- The build requires network (the fetch) unless `MAUDE_SKIP_KG_SYNC=1`; an offline build ships without kgai.
- Stripping upstream's SessionStart hook means we diverge from upstream's plugin as published — a documented, intentional divergence that must be re-checked when the pin advances.
- Windows users get no graph until kgai publishes a prebuilt.

## Revisit when

- kgai publishes Windows prebuilts (drop the platform carve-out), or changes its hook set / plugin layout (re-check the neutralization at pin-advance time).
- Kuzu's licensing or `libkuzu` distribution terms change.
- The bundle-size cost becomes a distribution problem (then: fetch-on-first-use with a signed, pinned installer rather than in-bundle).

## Linked

- Plan: `.ai/plans/feature-kgai-ecosystem-integration.md` (Phase 8, Tasks 15–16, Appendix E.1)
- Related: DDR-126 (desktop distribution / auto-update / signing), DDR-177 (bundle self-containment + the `--smoke` gate), DDR-189 (kgai cross-repo trust model), DDR-168 (bundled plugins always win), DDR-144 (`settingSources:['user']`), DDR-045 (real-disk path resolution)
