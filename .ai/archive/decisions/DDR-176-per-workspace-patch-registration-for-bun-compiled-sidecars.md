# DDR-176: Patch registration is per package-manager root — a pnpm-workspace patch does not reach apps/studio's own bun install

**Status:** Accepted
**Date:** 2026-07-15
**Tags:** dev-server, bun-compile, pnpm, patches, css-tree, svgo, sidecar, incident

**Related:** [DDR-042](DDR-042-oxc-parser-bun-compile-workaround.md) (companion bun --compile embedding workaround, oxc-parser), [DDR-045](DDR-045-real-disk-path-resolution-for-compiled-dev-server.md) (compiled-binary path-resolution gotchas), [DDR-009](DDR-009-bun-runtime-authoritative-for-dev-server.md) (apps/studio is bun-native, not pnpm-native)

## Context

`v0.44.0` and `v0.45.0` shipped a dev-server sidecar (`maude-server`, the `bun build --compile` binary bundled into both the desktop app and every `@1agh/maude-<slug>` npm sub-package) that crash-looped on **every** boot:

```
error: Cannot find module '../data/patch.json' from '/$bunfs/root/maude-darwin-arm64'
```

Root cause: `svgo` → `csso` → `css-tree`'s `lib/data-patch.js` does `require('../data/patch.json')` via `createRequire(import.meta.url)`. That pattern isn't statically analyzable by Bun's bundler, so the JSON file never gets embedded into the compiled standalone binary's virtual `/$bunfs/` filesystem. At runtime the binary tries (and fails) to resolve the relative path against its own virtual root.

This exact bug was already found and fixed once — commit `7cc9ff1d` ("fix(desktop): unbreak dev-server sidecar boot in compiled bun binaries") added `patches/css-tree@2.2.1.patch`, `patches/css-tree@3.2.1.patch`, `patches/csso@5.0.5.patch` (rewriting the dynamic `require()` to a static `import ... with { type: 'json' }`, which Bun's bundler CAN inline) and registered them via `patchedDependencies` in the root `pnpm-workspace.yaml`.

But `apps/studio` (the dev-server package itself) does **not** install through the root pnpm workspace. Per DDR-009, it is bun-native: it has its own `bun install` step (both in CI's `build-binaries.yml`/`build-desktop.yml` and locally) and its own `bun.lock`, entirely independent of the root `pnpm-lock.yaml`. `pnpm-workspace.yaml`'s `patchedDependencies` block only applies to packages resolved by pnpm — it has no effect on `apps/studio`'s bun-managed dependency tree. So the compiled sidecar kept embedding the **unpatched** `css-tree`, and the bug shipped again in two consecutive releases, undetected by any gate: `quality.yml`'s tests run against source (never the compiled `/$bunfs/` binary), and `build-binaries.yml`'s "smoke-test binary" step doesn't boot the server against a real project root and probe `/_health`.

Found live: user downloaded the freshly-released `v0.45.0` desktop app and it hung forever on the "Starting…" splash. Direct-launch diagnosis (`/Applications/Maude.app/Contents/MacOS/maude-desktop` run from a terminal instead of double-clicked) surfaced the crash-loop log immediately.

## Alternatives considered

- **A. Register the same `.patch` files via `patchedDependencies` directly in `apps/studio/package.json`** (Bun supports the identical `patchedDependencies` config shape as pnpm, and applies standard unified diffs the same way) — reuses the exact patch content already committed under `patches/`, no divergence from upstream beyond the documented fix, zero new files.
- **B. Vendor/fork the patched `data-patch.js`/`data.js` as local override files apps/studio imports instead of the real `css-tree` module** — sidesteps the dual-registry trap entirely, but diverges further from upstream and needs manual re-sync on every `css-tree` version bump; more moving parts than a patch.
- **C. Unify package management — have `apps/studio` consume the root pnpm-managed `node_modules` instead of its own bun install** — would make one patch registry authoritative, but directly conflicts with DDR-009's deliberate choice to keep the dev-server bun-native (Bun-specific APIs, its own lockfile, its own install lifecycle); a much bigger, riskier refactor to fix a one-line registration gap.
- **D. Add a CI smoke step that boots the compiled binary against a scratch project root and asserts a successful `/_health` probe** — necessary regardless (this class of bug will recur for other dependencies), but doesn't fix THIS bug by itself; a detection improvement, not a root-cause fix.

## Decision

We pick **Option A**: register `css-tree@2.2.1`, `css-tree@3.2.1`, and `csso@5.0.5` under `patchedDependencies` in `apps/studio/package.json`, pointing at the same `../../patches/*.patch` files the root workspace already uses. Verified locally by rebuilding the `darwin-arm64` sidecar and confirming it boots and serves `/_health: {"ok":true}` without the crash; verified again against the actual `v0.45.1` release artifacts (both the `.dmg`-extracted desktop app and — indirectly, via the shared build step — the npm sub-packages).

Option D (a real boot-and-health-probe CI smoke test) is a recommended follow-up, tracked below, but out of scope for this hotfix.

## Consequences

**Positive:**
- Fixes the crash for every install path (desktop app on all three OSes, `@1agh/maude` npm CLI's `maude design serve`) with a five-line diff and no new files.
- No divergence from the already-reviewed patch content — `apps/studio` and the root workspace patch the exact same upstream code the exact same way.
- Consistent with DDR-009: `apps/studio` stays a self-contained bun package; this doesn't erode that boundary.

**Negative / trade-offs:**
- **Structural landmine, not eliminated:** any *future* `patchedDependencies` entry added to root `pnpm-workspace.yaml` for a package that is *also* a (transitive) dependency of `apps/studio` needs a matching entry in `apps/studio/package.json` — and nothing currently enforces that the two registries stay in sync. This is the same class of "N places must agree, drift once" risk already called out for the runtime-state taxonomy in DDR-115 (`isMaudeRuntimeState` / `gitignore-block.mjs` / `.gitignore`).
- The underlying detection gap (D) is still open: no CI step actually boots a compiled sidecar binary end-to-end and checks it serves a real request. A dependency bump that reintroduces a similarly un-embeddable dynamic `require()`/`import()` pattern in some other transitive package would ship silently again.

## Revisit when

- The next time a `patchedDependencies` entry is added anywhere in the repo for a package that resolves inside `apps/studio`'s own tree — verify (by hand, until a test exists) that it's registered in **both** `pnpm-workspace.yaml` and `apps/studio/package.json`.
- If a lint/test is added asserting patch-registry parity between the two files, or a CI step is added that boots the compiled `maude-server` binary against a scratch project and asserts `/_health` — that closes the detection gap this DDR leaves open, and the "structural landmine" caveat above can be downgraded.

## Linked
- Plan: —
- PRD: —
- Supersedes: —
