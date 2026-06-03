# DDR-083 — `yjs` boot preflight: fail loud with a `bun install` hint, not a silent boot timeout

**Status:** Accepted — 2026-06-02.
**Supersedes:** none. **Refined by:** [DDR-084](DDR-084-server-up-boots-compiled-binary.md) — which makes `server-up` boot the compiled platform binary (embeds yjs) on a production install, so the common production path no longer hits this preflight at all. This preflight is now the **source-path** fail-loud guard (dev tree, or a production install whose binary is missing): on a real global install the shipped tarball excludes `dev-server/package.json`, so the original `bun install` hint was a dead end there — DDR-084 fixes the boot; DDR-083's hint is context-aware (`bun install` in the dev tree, else `npm i -g @1agh/maude`).
**Related:** [DDR-044](DDR-044-marketplace-install-vs-npm-install-artifact-strategy.md) (`boot-self-heal.ts` — which deliberately *dropped* boot-time `bun install`; this DDR honors that and stays a preflight, not a re-introduced auto-install), [DDR-009](DDR-009-bun-runtime-authoritative-for-dev-server.md) (the `bun --compile` standalone-binary packaging migration — the *durable* fix for "nested deps not installed"; this preflight is the bridge until that lands), [DDR-062](DDR-062-plugins-reach-executable-logic-via-maude.md) (plugin markdown reaches `server-up` / `visual-sanity` through `maude design <verb>` — the preflight rides those same helpers, so every boot path inherits it), [DDR-082](DDR-082-scaffold-integrity-gates.md) (Group A of the same setup-ds Round-2 plan — the scaffold-integrity gates; this is Group B). Instruments: `plugins/design/dev-server/bin/server-up.sh` (the preflight + exit 3), `plugins/design/dev-server/bin/visual-sanity.sh` (exit 5 + `server-deps-missing` status), `plugins/design/skills/design-system/_bootstrap.md` (visual-sanity exit-5 recovery row).

## Context

`server-up.sh` boots the dev-server with `bun server.ts`. `server.ts` imports `sync/index.ts`, which does a **value** import `import * as Y from 'yjs'` at module top level. The dev-server's runtime deps (`yjs`, `y-protocols`, `lib0`, …) live in a **nested** `plugins/design/dev-server/package.json` — NOT the root `@1agh/maude` package. Two common installs therefore boot without them:

- a **global `npm i -g @1agh/maude`** (npm installs the root package's deps, never a nested workspace's), and
- a **fresh `git worktree`** (a new worktree shares no `node_modules` until `bun install` runs in the dev-server dir).

When `yjs` is unresolvable, `bun server.ts` throws at the import **after** `server-up.sh` has already `nohup`-spawned it. The server never writes `_server.json`, so `server-up.sh` polls the full `--timeout` window (10–15 s) and exits `1` with a generic **"server start timeout"**. The real cause (`Cannot find module 'yjs'`) is buried in `_server.log`. Worse, `visual-sanity.sh` — the **mandatory, never-elided** post-scaffold gate — saw that generic exit `1` and degraded to a manual workaround. Hit live during the 2026-06-02 moodboard dogfood on exactly those two install shapes.

This is the precise failure the "fail loud, never silently degrade" design forbids: a missing dependency presented as an opaque timeout instead of an actionable error.

## Decision

Add a **dependency preflight** to `server-up.sh`, on the cold-start path of the `bun + server.ts` runtime, that runs **before the spawn**:

- Resolve `yjs`, `y-protocols`, `lib0` by walking `node_modules` up from the dev-server dir (mirrors node/bun bare-specifier resolution; handles both a dev-server-local and a workspace-hoisted install — no `bun` subprocess, ~ms).
- If any is missing, **exit `3`** with a copy-pasteable hint: `→ run: (cd <dev-server-dir> && bun install)`. No 10-second poll, no buried log.

Surface it through the existing helper → recovery contract:

- `visual-sanity.sh` special-cases `server-up.sh` exit `3` → its own **exit `5`** + `"server-deps-missing"` manifest status (distinct from the generic `server-boot-failed` / exit `1`).
- `_bootstrap.md`'s visual-sanity exit-code table gains a **row for `5`**: run `bun install`, then re-run — *not* the skip-or-retry AskUserQuestion (that's for a genuine boot crash, where the fix is unknown; here the fix is known).

### Why a preflight, not a self-heal (`bun install` at boot)

The plan listed self-heal as "preferred." We chose the documented **fallback** (preflight + hint) on purpose:

- **`boot-self-heal.ts` already rejected boot-time install** (DDR-044, v0.18.1) for three concrete reasons: npm-global never installs nested workspace deps anyway; the `bun --compile` binary's `import.meta.url` resolves to a virtual `/$bunfs/root` so `existsSync` false-triggers; and standalone binaries don't inherit shell `PATH`, so `Bun.spawn(['bun', …])` hit `ENOENT`. Re-introducing auto-install would re-litigate a settled decision.
- **`server-up.sh` runs in a real shell** (not the compiled binary), so an auto-`bun install` *would* technically work there — but it adds a slow, network-dependent, possibly-permission-denied (root-owned global install dir) side effect to a load-bearing boot script, for marginal benefit over a one-line hint the user runs once.
- **The durable fix is packaging, not boot-time install** — DDR-009's `bun --compile` standalone binaries embed `yjs` and make the whole class disappear. The preflight is the cheap, low-risk bridge until that ships; it doesn't pretend to be the structural fix.

## Consequences

- **Positive:** a missing-`yjs` boot now fails in < 1 s with `(cd <dir> && bun install)`, never a 10 s timeout + log spelunking. The mandatory visual-sanity gate gets a distinct `server-deps-missing` signal and routes to the right remediation instead of silently degrading.
- **Additive + low-risk:** the preflight only runs on the `bun` cold-start path (after the server-alive early-exit), so a warm server pays nothing; a correctly-installed repo passes silently. No behavior change for the happy path.
- **Scope:** dev-server code only (`server-up.sh` + `visual-sanity.sh`) + one `_bootstrap.md` recovery row. The plan mandated a separate branch from Group A (DDR-082); per user direction both groups ship on one branch / PR. The two commits stay disjoint (Group A is markdown-only, Group B touches dev-server `.sh` + a single distinct `_bootstrap.md` row), so the risk separation is preserved in history.
- **Task B2 (Playwright-browser export preflight) was already done in `main`** (`bf84825`): `bin/_pw-launch.mjs` `launchChromium()` maps the missing-Chromium failure to exit `3` + `INSTALL_HINT`, every export shim uses it, `/_api/export` returns **500 + the remediation** (never 200 + empty body), with regression coverage in `test/exporters/pw-launch.test.ts`. The Round-2 plan's "Already done" section pre-dated that fix; B2 is **verify-only**, not re-implemented here.

## Alternatives considered

- **Auto-`bun install` at boot (self-heal)** — rejected: contradicts DDR-044's deliberate removal; slow/permission-fragile in a load-bearing boot script. Could be revisited as an opt-in env knob if the hint proves insufficient in practice.
- **A runtime guard inside `server.ts`** — impossible: the static `import * as Y from 'yjs'` in `sync/index.ts` (imported by `server.ts`) crashes *before* any in-process guard could run. The check must live in the launcher, ahead of the spawn.
- **Ship the dev-server deps in the npm tarball / vendor them** — that's the DDR-009 packaging migration's job; a much larger change, out of scope for this hardening pass.
