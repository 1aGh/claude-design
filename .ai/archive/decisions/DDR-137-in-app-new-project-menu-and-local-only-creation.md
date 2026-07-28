# DDR-137 — In-app "New Project": native File-menu entry + local-only (no-GitHub) creation

**Status:** Accepted — 2026-07-01.
**Related:** [DDR-106](DDR-106-tauri-v2-native-shell-architecture.md) (native menu introduced in phase-26 — this DDR grows the File submenu and establishes the "menu emits, webview owns the flow" pattern), [DDR-088](DDR-088-canvas-media-vocabulary-and-asset-write-surface.md) (canvas dual-allowlist — the new endpoint stays main-origin-only by omission from both allowlists), [DDR-054](DDR-054-linked-mode-trust-model-and-task-4-hardening.md) (linked-mode trust model / untrusted canvas — the gating rationale), [DDR-135](DDR-135-onboarding-verification-affordances-and-occlusion-ceiling.md) (native-shell verification ceiling — the menu path can't be DOM-driven). Instruments: `apps/desktop/src-tauri/src/{menu.rs,lib.rs}`, `apps/studio/http.ts`, `apps/studio/github/endpoints.ts`, `apps/studio/client/github.js`, `apps/studio/client/panels/{CreateProject,IdentityBar}.jsx`, `apps/studio/test/canvas-origin-gate.test.ts`.

## Context

Creating a new project was reachable only from **first-run onboarding** and the **IdentityBar account menu**, and it always created a repo **on GitHub** — `createProject` runs inside `withToken`, so a GitHub token is mandatory: it creates the remote repo, then `git init` + `.design/` scaffold + `setRemote`. Two gaps:

1. **No persistent entry point in the app chrome.** After first run, a user who wanted to start another project had to find the account-menu item; there was nothing in the native menu bar (only `File ▸ Open Project…` existed).
2. **No local-only path.** A user with no GitHub account — or who just wants a plain local git repo with no remote — had no way in. Every "new project" road led through GitHub.

User request (verbatim intent): expose "create repo" in the main app menu, and add an option for "just a local git, not a remote GitHub".

## Decision

1. **Native `File ▸ New Project…` is a thin event emitter; the webview owns the flow.** `menu.rs` adds the item (accelerator `Cmd+N`); `lib.rs`'s `on_menu_event` emits `menu://new-project`; `IdentityBar` listens and opens the existing `CreateProject` `new` dialog. This **reuses the established Rust-emit → JS-listen bridge** (`github://*`, `update-ready`) — no new pattern. We deliberately did **not** re-implement creation logic natively: the Rust `write_minimal_design` fallback (used by `Open Project` on a non-Maude folder) stays a minimal-scaffold-only affordance; the webview `CreateProject` flow is the **single source of truth** for project creation.

2. **Local-only creation is a separate endpoint, not a flag on `create-project`.** New route `POST /_api/project/create-local` = `create-project` **minus the network**: `mkdir` + `git init` (default branch `main`) + `scaffoldDesign`, with **no token, no `createRepo`, no `setRemote`**. It is a separate handler (`createLocalProject`) rather than a `local: true` branch inside `createProject`, because `createProject`'s body runs inside `withToken` — a token is structurally mandatory there, so a flag would fork inside a token-required path. The new route carries the **identical dual-allowlist gating** as its sibling (main-origin CSRF via `sameOriginWrite` + `isLoopbackHost` + POST-only; absent from `CANVAS_SAFE_API` and `startCanvasServer` routes) and reuses the same `slugifyRepoName` + `validParentDir` validation.

3. **Signed-out users can create a local project.** The native menu opens the dialog **regardless of GitHub sign-in state** (it only waits for the sign-in check to settle out of `loading`). The dialog's `NewView` gained a "Where" toggle — **GitHub** (disabled with a hint until signed in) vs **This computer only** (always available; hides the GitHub-only visibility + description fields). Consequently the menu handler **no longer force-starts sign-in** on a signed-out click, because a local project needs no GitHub.

## Why this is DDR-worthy

- It adds a **new privileged dev-server endpoint on the security-sensitive origin-gating surface** — a governed area (DDR-088 dual-allowlist, DDR-054 untrusted canvas). A future reader must be able to find *why it is safe*: it is a network-free clone of an already-reviewed sibling (`create-project`) under byte-for-byte identical gating, and the guarantee is pinned by a **403-from-canvas assertion** added to `canvas-origin-gate.test.ts`.
- It establishes two reusable calls: **"native menu = thin emitter, webview owns the flow"** for project-level actions, and **"separate local endpoint vs token-flag"** whenever a GitHub-backed action needs a token-free local twin.

## Consequences

- **Local create does `git init` + `.design/` scaffold but NOT flow `.ai/` (`maude init`).** This is consistent with the GitHub path (which also doesn't run flow init). A "flow init" step is deliberately **out of scope** — it would be a new pattern and belongs in its own change if wanted.
- **Onboarding's own `CreateInline` is unchanged** (still GitHub-only). The local option lives in the post-first-run `CreateProject` dialog reachable from the account menu **and** the new native menu item. Unifying onboarding onto the same dialog is a possible follow-up, not done here.
- **Verification ceiling (DDR-135 family).** The native menu item and the dialog's runtime behaviour **cannot be verified without a bundled `.app` rebuild** — native menu chrome is out of reach for DOM-driven E2E and browser-mode agent-browser. What *was* verified: full dev-server suite (1700 pass / 0 fail), the origin-gate 403-from-canvas assertion, and `cargo check` on the desktop crate. The native path needs desktop dogfood before release.
- **Recommended follow-up:** a `/flow:validate-security` pass on the new endpoint before the next release (flagged at implementation time; the posture is captured here + in the gate test, but an adversarial pass is cheap insurance for a disk-writing route).
- **No new dependency, no new gating primitive.** Reuses `slugifyRepoName`, `validParentDir`, `scaffoldDesign`, `isomorphic-git`, and the existing CSRF/loopback guards.

## Files changed

- `apps/desktop/src-tauri/src/menu.rs` — add `MENU_NEW_PROJECT` (`New Project…`, `Cmd+N`) to the File submenu, above `Open Project…`.
- `apps/desktop/src-tauri/src/lib.rs` — `Emitter` import; `on_menu_event` branch emits `menu://new-project`.
- `apps/studio/http.ts` — new `POST /_api/project/create-local` route (same gate as `create-project`).
- `apps/studio/github/endpoints.ts` — `createLocalProject` handler + interface/return wiring.
- `apps/studio/client/github.js` — `onMenuNewProject` listener helper + `createLocalProject` API helper.
- `apps/studio/client/panels/CreateProject.jsx` — `NewView` "Where" (GitHub / local) mode; `signedIn` prop; `laptop` icon.
- `apps/studio/client/panels/IdentityBar.jsx` — menu-event subscription (opens dialog even signed-out); pass `signedIn`.
- `apps/studio/test/canvas-origin-gate.test.ts` — assert `/_api/project/create-local` 403s from the canvas origin.
- `apps/studio/dist/client.bundle.js` — rebuilt release-minified.

## What this DDR does not change

- The GitHub-backed `create-project` flow (token → remote repo → `setRemote`) is untouched.
- The dual-allowlist invariant (DDR-088) and the untrusted-canvas boundary (DDR-054) stand — the new route sits on the privileged, main-origin-only side, exactly like its siblings.
