# DDR-107: Git engine — isomorphic-git (pure-JS), detect-and-prefer system git

- **Date:** 2026-06-16
- **Status:** Accepted (founding decision for the native-collab arc — phase-26 Task 1). Implementation lands in phase-27 (the git layer); recorded now so phase-27's plan has a stable reference.
- **Tags:** native-app, git, isomorphic-git, zero-setup, phase-27, dependencies
- **Related:** [DDR-106](./DDR-106-tauri-v2-native-shell-architecture.md) (the shell that hosts this engine), [DDR-109](./DDR-109-native-shell-security-model.md) (where git credentials live — OS keychain, never `_server.json`/`.design/`), [DDR-110](./DDR-110-three-lane-collaboration-model.md) (git = the canvas distribution lane), [DDR-062](./DDR-062-plugins-reach-executable-logic-via-maude.md) (any new bin helper reaches users via `maude design <verb>`). Reuse note: today the only git in the codebase is incidental `git hash-object` shell-outs in `cli/lib/cache.mjs` — there is no git library yet. Epic: [`epic-native-collab-app.md`](../docs/epic-native-collab-app.md).

## Context

Phase-27 surfaces in-UI git (clone / status / commit / push / pull / branch / diff / log) behind plain non-technical verbs ("Save version", "Publish", "Get latest"). The persona may **not have git installed** — "zero setup" is the headline promise. The engine question: shell out to **system git**, use **`isomorphic-git`** (pure-JS), or a **Tauri/Rust git plugin** (libgit2 bindings).

Design repos are small (TSX + JSON + a few assets) — no LFS, no giant histories, no submodule webs in the common case.

## Decision

**Use `isomorphic-git` (pure-JS, runs in the Bun dev-server) as the baseline engine. Detect system git at runtime and prefer it when present; fall back to isomorphic-git otherwise.** Credentials come from the OS keychain (DDR-108/109), never from disk.

### Why

- **Zero system-git dependency** — the pure-JS path means a user with no git installed still gets clone/commit/push. This is the whole "zero setup" promise; a hard system-git dependency would break it for exactly the persona we're building for.
- **Bun-compatible, in-process** — runs inside the existing dev-server (the sidecar), so the git service is just new `/_api/git/*` endpoints over a library call, no extra spawned process to manage or sign.
- **Prefer-system-git when present** — system git is faster and handles edge cases (large blobs, packfiles, unusual configs) better. Detecting it (`git --version` probe) and routing through it when available gives the best of both without making it mandatory.
- **No native compile** — unlike a libgit2/Rust plugin, isomorphic-git adds no per-platform native binding to build, sign, or debug across the CI matrix (we already carry that burden for `better-sqlite3` in the hub; we don't want a second).

### Scope / limits (document, don't pretend away)

- **LFS, very large repos, submodules** — isomorphic-git is weak here. Accepted: design repos don't hit these in the common case. When system git is detected, route large operations through it. Surface a plain-language notice if a repo exceeds a sane size threshold rather than silently degrading.
- **Auth model** — HTTPS with a token from the keychain (DDR-108 OAuth → keychain). No SSH-key management UI in this arc (too technical for the persona; system-git users with SSH configured still work via the prefer-system path).
- **Conflict handling stays minimal by design** (DDR-110) — the only routine conflict is "you tried to Publish but the shared repo moved" → reject push → "Get latest first". True content conflicts get a coarse visual "keep yours / keep theirs / keep both" picker, never a 3-way text merge.

## Consequences

- **Positive:** the zero-setup promise holds for users without git; no new native binding in CI; the git service is plain dev-server endpoints mirroring the `canvas-create.ts` security pattern (main-origin-only, path containment, explicit 4xx).
- **Negative / accepted:** isomorphic-git is slower than system git and has real large-file/LFS gaps — mitigated by the detect-and-prefer-system path and a documented size threshold.
- **Dependency added (phase-27):** `isomorphic-git` (+ its `http` client for the Bun environment). Recorded in `apps/studio` deps + the plugin `dependencies.json` per the existing manifest convention.

## Alternatives considered

- **System git only** — rejected: breaks zero-setup for users without git (the core persona).
- **Tauri/Rust libgit2 plugin** — rejected: a per-platform native binding to build/sign/debug across the whole CI matrix, in Rust, for marginal benefit over pure-JS on small repos. Reconsider only if large-repo performance becomes a real complaint.
- **Wrap `git hash-object` shell-outs (extend `cli/lib/cache.mjs`'s pattern)** — rejected: that's incidental plumbing, not a git porcelain; building clone/push/pull on raw plumbing shell-outs is strictly worse than a real library.

## Addendum (phase-27 implementation, 2026-06-17)

The phase-27 git layer (`apps/studio/git/service.ts`) ships **isomorphic-git as the default and `MAUDE_USE_SYSTEM_GIT=1` as an explicit opt-in**, NOT the "detect system git at runtime and prefer it when present" auto-routing this DDR describes as the end-state. Reasons for the first cut:

- **Deterministic, fully-tested behavior** — one default engine means the test matrix (status/commit/log/diff round-trip + the real push→pull→non-ff-conflict round-trip) exercises exactly what users run. Auto-detect would silently route to whichever engine the host happens to have, splitting behavior across two untested-in-combination paths.
- **The zero-setup promise rides on the iso-git default** — making the pure-JS path the default (not the fallback) is the safest way to guarantee a no-git machine works.
- **Engine note** — there is **no `@isomorphic-git/http` npm package** (the plan's dependency line was wrong); the HTTP client ships *inside* `isomorphic-git` as `isomorphic-git/http/node`. Push auth is `onAuth: () => ({ username: token, password: '' })` (token-as-username basic-auth, never a Bearer header). Bundle size: `index.js` 517 KB raw / **116 KB gz** — a server-side dep (not in the client bundle), within the "acceptable for a design-repo-sized use case" bar.

**Auto-detect-and-prefer-system-git is deferred** (a `git --version` probe + per-operation routing) to a later slice; the opt-in env flag is the bridge until then. See [DDR-112](./DDR-112-simplified-staging-model.md) § Consequences.
