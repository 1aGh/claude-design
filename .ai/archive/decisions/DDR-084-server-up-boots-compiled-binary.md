# DDR-084 — `server-up` boots the compiled platform binary in production; `bun server.ts` is dev-only

> **Path update — [DDR-095](DDR-095-runtime-apps-extracted-to-top-level.md) (2026-06-05):** the dev-server now lives at `apps/studio/` (hub at `apps/hub/`), moved out of `plugins/design/`. This DDR's invariants still govern; only the path changed. Old `plugins/design/dev-server` references below are historical.

**Status:** Accepted — 2026-06-03.
**Supersedes:** none. **Refines:** [DDR-083](DDR-083-yjs-boot-preflight.md) (the yjs boot preflight — now correctly positioned as the *source-path* fail-loud guard; this DDR is the *production* fix DDR-083 deferred to "the bun --compile packaging migration").
**Related:** [DDR-009](DDR-009-bun-runtime-authoritative-for-dev-server.md) (bun authoritative + per-platform `bun --compile` standalone binaries via npm `optionalDependencies` — this DDR wires the boot path to that binary), [DDR-020](DDR-020-single-dev-server-runtime-bun.md) (`server-up.sh` runtime selection), [DDR-044](DDR-044-marketplace-install-vs-npm-install-artifact-strategy.md) (`boot-self-heal.ts` — why we don't auto-install), [DDR-062](DDR-062-plugins-reach-executable-logic-via-maude.md) (`maude design <verb>` dispatch — the choke point that injects the resolved binary path). Instruments: `cli/commands/design.mjs` (`resolveServerBinary` + `runBinDispatch` env injection), `plugins/design/dev-server/bin/server-up.sh` (binary runtime branch), `cli/commands/design.test.mjs` (resolver unit tests).

## Context

A live `/design:setup-ds` dogfood on a **global `npm i -g @1agh/maude`** install crashed at dev-server boot:

```
error: Cannot find package 'yjs' from '…/@1agh/maude/plugins/design/dev-server/sync/index.ts'
```

Root cause, traced end to end:

- `server.ts` → `sync/index.ts` does a top-level value import `import * as Y from 'yjs'`.
- The npm tarball ships `server.ts` + `sync/index.ts` **but deliberately excludes `dev-server/package.json`** (`plugins/design/dev-server/.npmignore`: *"Workspace metadata never ships; the root @1agh/maude package owns publishing"*) and ships no `node_modules`. The root package declares only `ajv` + the platform-binary `optionalDependencies` — **not** `yjs`/`react`/`motion`/…
- So `bun server.ts` from a production install is **structurally un-bootable** — and there isn't even a `package.json` there to `bun install` from (which makes the DDR-083 `bun install` hint a dead end on this shape).

The intended production runtime (DDR-009) is the **`bun --compile` standalone binary** shipped via the `@1agh/maude-<platform>` optional sub-packages — it **embeds yjs and every dep**. `maude design serve` already resolves and runs it. **But the design plugin flows don't go through `maude design serve`** — they call `maude design server-up` → `server-up.sh`, which (pre-this-DDR) *always* ran `bun server.ts`, bypassing the binary entirely. The binary was sitting installed and working (`node_modules/@1agh/maude-darwin-arm64/maude`, 68 MB) while the boot path ignored it.

This is the real, durable bug behind the symptom DDR-083's preflight only made *louder*.

## Decision

**`server-up.sh` boots the compiled platform binary in a production install, exactly as `maude design serve` does**, and falls back to `bun server.ts` only in the local dev tree (or under `MAUDE_FORCE_SOURCE=1`).

- **Resolution lives in one place — `cli/commands/design.mjs`.** A new read-only `resolveServerBinary({ pkgRoot })` reuses the proven `lazyResolveBinary` + the postinstall side-channel (`cli/.platform-binary-path`) that `runServe` already uses. `runBinDispatch` calls it for the boot verbs (`server-up`, `visual-sanity`, `smoke`) and hands the path to the helper via **`MAUDE_DEV_SERVER_BIN`**. Helpers that shell into `server-up.sh` (visual-sanity, smoke) inherit it.
- **`server-up.sh` prefers, in order:** `--allow-legacy` node → `MAUDE_DEV_SERVER_BIN` (or, for a direct `bash server-up.sh`, the side-channel) → `bun server.ts`. The binary branch spawns the standalone; deps are embedded, so the DDR-083 yjs preflight is skipped on this path (it guards only the source path).
- **Dev tree keeps using source.** `resolveServerBinary` returns `null` when `isLocalDevTree(pkgRoot)` (the `packages/` dir, present only in the source checkout) — so a maintainer editing the dev-server gets their working copy live, not a stale pnpm-installed binary. This preserves `server-up`'s historic dev-tree behavior (it always ran source before) — a deliberate, verified no-regression. `MAUDE_FORCE_SOURCE=1` forces source anywhere.

The DDR-083 preflight stays as the **source-path fail-loud guard** (dev tree with deps missing → `bun install`/`pnpm install` hint; a production install that somehow has no binary AND no manifest → `npm i -g`/`npm rebuild -g @1agh/maude` hint). The two DDRs now compose: DDR-084 makes the common production path *work*; DDR-083 makes the rare un-bootable-source path *fail loud with the right hint*.

## Consequences

- **Positive:** future `@1agh/maude` releases boot the dev-server from the design plugin flows on a clean global install — the yjs-at-boot crash is gone, because the path that actually runs (`server-up`) now uses the embedded-deps binary like `serve` does. No new runtime deps, no dep-list duplication, no bloating `npm i -g` with the native dep tree the binary distribution exists to avoid.
- **No dev regression:** the local checkout still runs `bun server.ts` from source (verified: `isLocalDevTree` guard + `MAUDE_FORCE_SOURCE`).
- **Single source of resolution truth:** `resolveServerBinary` reuses `lazyResolveBinary`; `runServe` keeps its own inline copy (it also caches + hard-fails), but both share the same lookup primitives, so they can't drift on *where* the binary is.
- **Hardening (post `/flow:done` adversarial review — F1).** The resolved path is spawned only if it passes a **structural allowlist** (`isPlausiblePlatformBinary` in `design.mjs`, mirrored in `server-up.sh`): basename `maude`/`maude.exe` inside a `maude-<slug>/` dir. The side-channel file's *content* and an injected `MAUDE_DEV_SERVER_BIN` are the only attacker-influenceable inputs (in a shared-prefix / poisoned-clone layout); a path outside the allowlist is ignored → fall back to source. Combined with the defender's finding that the spawn is `exec`-as-argv0 + double-quoted (never `sh -c`), the env/file can therefore only **deny** the binary, never **redirect** the spawn to an arbitrary executable. Verified end-to-end on the real global install: conforming binary still boots; a side-channel/env pointing at `/tmp/.../maude` (non-`maude-<slug>` parent) is rejected and `pwned` never executes.
- **Verified:** binary boots a scratch `.design` in ~1 s with `/_health` OK (yjs embedded, no crash); dev tree + `MAUDE_FORCE_SOURCE=1` still boot source; full chain `maude design server-up` resolves+injects the env in a production shape and returns `null` (→ source) in the dev tree; poisoned-path rejection proven on the real install; 9/9 `design.test.mjs` (5 resolver/allowlist unit tests) + biome clean.

## Alternatives considered

- **Declare the dev-server runtime deps on the root `@1agh/maude` package.json** (so `npm i -g` installs them and `bun server.ts` resolves) — rejected: duplicates the dep list across two manifests (drift), and bloats every install with the full native tree (oxc-parser bindings, pixi, motion, react…) that the `bun --compile` binary distribution was specifically designed to *avoid* shipping as npm deps. It also fights DDR-009's architecture.
- **Resolve the binary in bash inside `server-up.sh`** — rejected: would re-implement platform-slug detection + the nested/flat layout walk that `design.mjs` already owns and tests. Keep resolution in JS; pass the answer down via env.
- **Leave it at DDR-083's preflight (fail-loud hint only)** — rejected: on the exact failing shape (global install) the `bun install` hint is a dead end (no `package.json` shipped). A louder error that still can't boot isn't a fix.
