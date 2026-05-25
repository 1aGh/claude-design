---
"@1agh/maude": patch
---

`fix(dev-server)`: greenfield `npm i -g @1agh/maude` actually boots (Phase 19.1)

v0.18.0 shipped seven fixes but had a load-bearing architectural bug that broke the very scenario it was supposed to repair. Three reports crashed `maude design serve` on a clean machine immediately:

```
⚠ first-boot: installing runtime deps (one-time, ~15s)…
ENOENT: no such file or directory, posix_spawn 'bun'
```

**Root cause:** the boot self-heal, http route resolver, and runtime-bundle synthetic-entrypoint anchor all used `dirname(fileURLToPath(import.meta.url))` to find the dev-server install dir. In a `bun --compile` standalone binary that resolves to the **virtual** `/$bunfs/root` — bun's embedded filesystem — NOT a real disk path. Every `existsSync` check against it returned false, self-heal false-triggered, tried to `bun install` + `bun build`, ran into PATH inheritance issues in the spawned subprocess, and crashed. Even users who DID have bun installed hit this because compiled-binary spawn-context doesn't inherit shell PATH the same way subshells do. And even if the spawn HAD worked, npm install of the root `@1agh/maude` package never installs nested workspace deps (`plugins/design/dev-server/package.json`'s react/react-dom/etc.) — so the install target wouldn't exist either.

**Three coordinated fixes:**

1. **New `paths.ts` module** with `DEV_SERVER_ROOT`, `DIST_DIR`, `CLIENT_DIR`, `RUNTIME_BUNDLES_DIR` constants. Resolves the real disk path across all three runtime modes: (a) dev (`bun server.ts` — uses `import.meta.url`), (b) npm install (walks up from `process.execPath` past `@1agh/maude-<plat>/maude` to find `@1agh/maude/plugins/design/dev-server/`), (c) marketplace cache (same walk-up logic). Detects `/$bunfs/*` and `B:/~BUN/*` virtual paths explicitly. Falls back gracefully when nothing matches. Wired into `http.ts`, `runtime-bundle.ts`, `boot-self-heal.ts` (all consumers replaced).

2. **Pre-built runtime bundles ship in `dist/runtime/<slug>.js`.** Every release build now also produces 6 minified bundles (react, react-dom, react-dom/client, react/jsx-runtime, react/jsx-dev-runtime, pixi.js — total ~1.1 MB minified). Committed to git via `.gitignore` negation pattern (same precedent as `client.bundle.js` per DDR-044). `runtime-bundle.ts` now checks `dist/runtime/<slug>.js` first and serves it directly with no Bun.build call. Dynamic build remains as fallback for dev mode. This eliminates the runtime dependency on disk `node_modules/react` entirely — npm installs no longer need anything beyond what the tarball ships.

3. **`boot-self-heal.ts` radically simplified.** Dropped the `bun install` + `bun build` attempt (rooted in the broken assumption about paths and the wrong premise that npm would install nested deps). Now just verifies the two committed artifacts exist: `dist/client.bundle.js` and `dist/runtime/react.js`. If either is missing, prints a one-screen remediation with the looked-under path + the exact reinstall command. No more spawn, no more PATH issues, no more first-boot crashes — either the install is correct (passes silently) or it's broken (fails fast with actionable hint).

**Verified end-to-end:** the simulated npm install layout (binary at `<tmp>/lib/node_modules/@1agh/maude-darwin-arm64/maude`, dist at `<tmp>/lib/node_modules/@1agh/maude/plugins/design/dev-server/dist/`) resolves correctly via `paths.ts` walk-up, server boots without self-heal warnings, and curl smoke against `/_client/*` and `/_canvas-runtime/*` returns 200 across all 6 runtime sub-bundles. Pre-existing 351-test suite still green; 5 new tests cover `paths.ts` resolution and the simplified self-heal behavior (8 → 5 tests, drop install/build path coverage that no longer applies).

**Bundle size delta:** +1.1 MB committed (6 minified runtime bundles). Acceptable per DDR-044 precedent (committed artifacts > runtime dependency on disk + PATH that may not exist).

No breaking changes — v0.18.0 users who happened to have everything aligned still work, and the failure path is now graceful rather than catastrophic.
