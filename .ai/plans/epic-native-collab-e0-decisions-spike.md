# Phase E0 — Native-collab epic: decisions + de-risk spike

> **First phase of the [native-collab epic](epic-native-collab-app.md).** E0's job is to **de-risk the three scariest unknowns with throwaway spikes** and **formalize the already-made decisions as DDRs** — before committing the months of production work in E1–E7. The exit is an explicit **Go / No-Go**: does Tauri-sidecar-over-the-existing-binary actually work well enough to build on?
>
> Validate docs and codebase patterns before implementing. Pay attention to existing naming, the binary-resolution path (DDR-009/084), real-disk paths (DDR-045), and the canvas-origin split (DDR-063).

## Description

Build three **throwaway** spikes and write the founding DDRs. The spikes answer questions that, if answered wrong after E1 is built, would waste weeks: (A) can a Tauri v2 app spawn the existing compiled Maude dev-server binary as a **sidecar** and render a real canvas — with HMR and the cross-origin canvas iframe — inside the OS webview? (B) can `isomorphic-git` clone/commit/**push** a real GitHub repo from inside the Bun dev-server with token auth, fast enough for a `.design/` repo? (C) can a non-technical user **"Sign in with GitHub"** via OAuth device-flow from a desktop app, with the token landing in the OS keychain — no PAT paste?

No production code, no UI polish, no Windows/Linux builds. Spikes are deleted or archived at the end; what survives E0 is **knowledge + DDRs + a Go/No-Go**.

## User Story

As the team about to commit to a native-app pivot, we want the riskiest architectural assumptions **proven on real hardware** and the decisions **written down**, so that E1 (the production Tauri shell) starts from confidence, not hope — and so we discover a fatal "the webview can't render our canvases" problem in days, not after a month of shell work.

## Problem

The epic assumes three things that are **plausible but unproven in this codebase**:

1. The OS webview (WKWebView on macOS) renders the Maude canvas runtime — React + `motion` + **cross-origin canvas iframes** (DDR-063 split is ON by default) + WebSocket HMR — correctly. If it can't, Tauri is the wrong shell and we'd rather know now.
2. `isomorphic-git` (the leaning git engine, chosen for zero system-git dependency) can actually **push** with a token from Bun, and is acceptably fast for our repos. iso-git's push path + auth is the historically fiddly part.
3. GitHub OAuth **device flow** gives a non-technical user a clean "enter this code" sign-in from a desktop shell, and Tauri can stash the resulting token in the **OS keychain**.

And five decisions taken during planning (Tauri shell, two-layer collab, repo/branch IA, git engine lean, GitHub auth lean) are recorded only in the epic prose — they need durable DDRs before code references them.

## Solution

Three isolated spikes + a DDR sweep + a findings/Go-No-Go doc. Each spike is the **smallest possible** thing that answers its question, lives under a clearly-marked throwaway location, and is torn down after.

## Metadata

- **Type:** Spike / Decision (de-risk)
- **Complexity:** Medium (unfamiliar tech — Rust/Tauri, isomorphic-git, OAuth — but no production surface)
- **App/Package:** throwaway `spikes/e0-native-shell/` (Tauri) + scratch scripts against `plugins/design/dev-server/`
- **Affected Systems:** none in production — spikes only. Outputs land in `.ai/decisions/` + `.ai/logs/`.
- **Depends on:** the epic plan ([epic-native-collab-app.md](epic-native-collab-app.md)). Nothing else.
- **Blocks:** E1 (Tauri shell) — E1 must not start until E0's Go/No-Go is Go.

---

## Context References

### Must-Read Files / Assets

> Read in parallel at `/flow:execute` start (single message, multiple Reads).

- [`epic-native-collab-app.md`](epic-native-collab-app.md) — the parent epic; the Decisions table + reuse inventory are the source of truth this phase formalizes.
- `cli/commands/design.mjs` (`runServe`, `resolveServerBinary`, `lazyResolveBinary`, the `MAUDE_DEV_SERVER_BIN` side-channel) — **how the compiled dev-server binary is located and booted** (DDR-084). The Tauri sidecar spike spawns exactly this binary. Read `BOOT_VERBS` + `runBinDispatch`.
- `plugins/design/dev-server/server.ts` + `server.mjs` — the binary's entry; port resolution (`--root` → `$CLAUDE_PROJECT_DIR` → cwd), `_server.json` write (`{pid,port,url,started}`). The spike waits on `_server.json` before pointing the webview (the orchestrator pattern).
- `plugins/design/dev-server/paths.ts` (DDR-045) — disk-path resolution inside a compiled binary. The spike's sidecar runs as a compiled binary → any path logic must respect this.
- `.ai/decisions/DDR-009-bun-runtime-authoritative-for-dev-server.md` + `DDR-084-server-up-boots-compiled-binary.md` — the binary-distribution + boot model the sidecar relies on.
- `.ai/decisions/DDR-063-canvas-origin-split-default-on-tsx-sync-opt-in.md` — **the canvas iframe runs cross-origin by default.** Spike A must verify a cross-origin iframe + its CSP work inside WKWebView. This is the highest-risk detail.
- `.ai/decisions/DDR-054-linked-mode-trust-model-and-task-4-hardening.md` — the iframe sandbox/CSP model; informs both the webview CSP and the E5-scoped live-code gate.
- `plugins/design/dev-server/build.ts` (`bun run build:binary`) — produces the minified release binary the spike bundles as a sidecar.
- `.design/` (this repo's own) — a ready multi-artboard canvas set to render in Spike A (e.g. `ui/Canvas Viewport.tsx`, `ui/Smoke TSX.tsx`).

### Files to Create

- `spikes/e0-native-shell/` — throwaway Tauri v2 project (`src-tauri/` + minimal `index.html`/glue). **Marked throwaway; gitignored or deleted at phase end.**
- `spikes/e0-git/` — throwaway Bun script exercising isomorphic-git against a scratch GitHub repo.
- `spikes/e0-oauth/` — throwaway device-flow + keychain round-trip.
- `.ai/decisions/DDR-086-tauri-shell-architecture.md` (number TBD — take the next free) and siblings — see Tasks.
- `.ai/logs/spikes/e0-native-collab-findings.md` — the findings + Go/No-Go.

### Documentation to read (per Step 0 — load skills first)

- **Tauri v2** — sidecar (`externalBin` / `tauri-plugin-shell` `Command::sidecar`), the `bundle > externalBin` config, webview CSP (`app > security > csp`), `tauri-plugin-updater`, code-signing/notarization. Why: every Spike-A mechanic.
- **isomorphic-git** — `clone`, `commit`, `push`, `http` from `isomorphic-git/http/node`, `onAuth` token callback. Why: Spike B.
- **GitHub OAuth device flow** — `POST /login/device/code`, polling `POST /login/oauth/access_token`, the `read:user`/`repo` scopes; + a Tauri keychain plugin (or the `keyring` Rust crate). Why: Spike C.

### Patterns to Follow

- **Spike hygiene:** every spike file/dir carries a top-of-file `// THROWAWAY — E0 de-risk spike, not production. Delete after phase E0.` banner. No spike code is imported by production modules.
- **Reuse the binary, don't fork it:** Spike A spawns the *real* compiled binary via the same resolution `design.mjs` uses — it does not hand-roll a server.
- **Decision records, not prose:** each decision → one DDR, cross-linked from the epic + this plan.

---

## Spike subjects & acceptance

| Spike | Question | Acceptance (the bar to call it answered) |
| ----- | -------- | ---------------------------------------- |
| **A — Tauri sidecar + webview render** | Can Tauri spawn the binary as a sidecar, manage its lifecycle, and render a real canvas (+ HMR + cross-origin iframe) in WKWebView? | A Tauri window on macOS: (1) spawns the compiled binary as a sidecar against this repo's `.design/`; (2) waits for `_server.json`, then loads the UI; (3) **a multi-artboard canvas renders correctly** (React + motion + the cross-origin canvas iframe); (4) editing the `.tsx` triggers HMR and the canvas live-reloads in the window; (5) closing the window **kills the sidecar** (no orphan process); (6) a killed/stale sidecar respawns. CSP/cross-origin issues either resolved or documented as a known E1 task. |
| **B — isomorphic-git push** | Can iso-git clone/commit/push a real repo from Bun with token auth, fast enough? | From a Bun script: clone a small scratch GitHub repo, write a file, `commit`, `push` with a token via `onAuth`, and verify the commit on GitHub. Record wall-clock for clone + push on a `.design`-sized repo. Note any LFS/submodule/large-file caveat. If push is unworkable → fallback finding (system-git-when-present). |
| **C — GitHub OAuth device flow + keychain** | Can a non-technical user sign in without a PAT, token to keychain? | A scratch OAuth app: run the device flow end-to-end (get `user_code` → enter at `verification_uri` → poll → receive access token), then store + read it back from the **OS keychain** via Tauri (or the keyring crate). Capture the exact UX a non-technical user sees. |

> Spikes A/B/C are independent — run in parallel where practical. A is the long pole and the one that can kill the Tauri direction.

---

## Tasks

Execute roughly in order; B and C can run alongside A.

### Task 0: Load skills + read context

- **Do:** Run `Skill(flow:skill-loader)` with "Tauri v2, isomorphic-git, GitHub OAuth device flow" as input (none are covered by a loaded built-in skill). Then read every file in **Must-Read** in parallel.
- **Validate:** skill set recorded in `STATE.md`; key DDRs (009/045/054/063/084) understood before touching the binary.

### Task 1: Spike A — Tauri sidecar renders a canvas

- **Do:** Scaffold a minimal Tauri v2 app in `spikes/e0-native-shell/`. Build the release binary (`cd plugins/design/dev-server && bun run build:binary`) and wire it as a Tauri **sidecar** (`externalBin`). On app start: spawn the sidecar with `--root <this repo>`, poll for `<designRoot>/_server.json`, then point the webview at its `url`. Verify the six acceptance points (render, HMR, cross-origin iframe, kill-on-quit, respawn, CSP).
- **Pattern:** mirror `design.mjs`'s binary resolution + the `server-up.sh` "wait for `_server.json`" handshake.
- **Gotcha:** the **cross-origin canvas iframe** (DDR-063) + the webview CSP is the likeliest blocker — test it explicitly, don't assume. WKWebView treats `127.0.0.1:<a>` and `127.0.0.1:<b>` as cross-origin; confirm the iframe + its `postMessage` inspector channel + ws HMR all survive.
- **Validate:** screen-record the window: canvas renders, edit → HMR reload, quit → `ps` shows no orphan sidecar.

### Task 2: Spike B — isomorphic-git clone/commit/push

- **Do:** In `spikes/e0-git/`, a Bun script that clones a small scratch GitHub repo, mutates a file, commits, and pushes with a token via `onAuth`. Time clone + push. Repeat against a `.design`-sized repo (copy this repo's `.design/` into the scratch repo). Record caveats.
- **Gotcha:** iso-git push auth + the `http/node` client are the fiddly parts; a 401 usually means the `onAuth` shape or scope is wrong, not that the approach fails.
- **Validate:** the pushed commit is visible on GitHub; timings recorded in the findings doc.

### Task 3: Spike C — OAuth device flow + keychain

- **Do:** In `spikes/e0-oauth/`, register a scratch GitHub OAuth app, run the device flow end-to-end, store the token in the OS keychain (Tauri keychain plugin or `keyring` crate from the Spike-A app), read it back. Screenshot the user-facing steps.
- **Gotcha:** device flow needs the OAuth app to have "device flow" enabled; the `repo` scope is needed for private-repo create/push (note the scope decision for the DDR).
- **Validate:** token round-trips through the keychain; the non-technical UX is captured (how many clicks, what the user types).

### Task 4: Write the DDRs

- **Do:** Take the next free DDR numbers and write (cross-link each from the epic + this plan):
  1. **Tauri v2 shell architecture** — sidecar-over-compiled-binary model, lifecycle (spawn/wait-on-`_server.json`/kill-on-quit/respawn), the Spike-A findings (esp. cross-origin iframe + CSP), and why Tauri over Electron.
  2. **Git engine** — isomorphic-git as default (zero system-git dep), detect-and-prefer-system-git when present; Spike-B timings + caveats; the LFS/large-file boundary.
  3. **GitHub auth model** — OAuth device-flow "Sign in with GitHub" → OS keychain; scopes; GitHub App deferred to a later phase for org/collaborator management; Spike-C UX notes.
  4. **Native-shell security model** — loopback-only sidecar, webview CSP, `maude://` deep-link allowlist, secrets in keychain.
  5. **Two-layer collaboration/sync model** — git = canvas lifecycle/distribution (push→pull, no cold-start, no create/delete propagation → **drops the former Phase-26 hub-propagation/untrusted-inbox idea, whose plan was deleted**); Yjs/hub = live co-edit of edits+annotations+comments for canvases both hold (persisted, reuse DDR-064); cursors/selection/viewport = ephemeral + gitignored; the **scoped DDR-054 iframe gate** for live-syncing peer canvas *code*. Cross-link DDR-054/064/076/085.
  6. **Navigation / IA model** — repo + branch switching is the primitive; one project = one repo; the maude UI *and* hub admin UI adopt it (no multi-repo hub multiplex).
- **Validate:** 6 DDRs exist, numbered, cross-linked; the epic's "DDRs to record in E0" table updated to point at the real numbers.

### Task 5: Findings doc + Go/No-Go

- **Do:** Write `.ai/logs/spikes/e0-native-collab-findings.md` — per-spike result (pass / pass-with-caveats / fail), the cross-origin/CSP verdict, git timings, OAuth UX, and a clear **Go / No-Go for E1** with the reason. If No-Go on Tauri, name the recommended pivot (Electron / thin-wrapper) and what specifically failed.
- **Validate:** a decision the user can act on in one read.

### Task 6: Tear down spikes

- **Do:** Delete (or move to `.ai/logs/spikes/_archive/`) the `spikes/` dirs so no throwaway code lingers in the tree. Knowledge lives in the DDRs + findings doc, not in spike code.
- **Validate:** `git status` shows no stray spike artifacts in production paths.

---

## Validation

This is a spike phase — validation is **"did each spike answer its question,"** not a production gate.

1. **Spike A:** screen recording shows canvas render + HMR + clean sidecar teardown in a Tauri window on macOS.
2. **Spike B:** a real pushed commit on GitHub + recorded timings.
3. **Spike C:** token round-trips through the OS keychain; device-flow UX captured.
4. **DDRs:** 6 written, numbered, cross-linked from the epic.
5. **Findings:** Go/No-Go recorded with rationale.
6. **No production impact:** `pnpm lint` / existing dev-server tests unchanged (E0 touches no production code); spike dirs torn down.

> **N/A (justified):** 5-platform `scenario-runner`, `a11y-auditor`, `design-system-guard` — E0 has no product UI; the spikes reuse the existing UI verbatim. No `/design:new` mockups (no net-new screens in E0).

---

## Acceptance Criteria

- [ ] Skills loaded (Tauri/Rust, isomorphic-git, OAuth) + key DDRs read.
- [ ] **Spike A passes** (or fails with a documented reason): Tauri sidecar spawns the compiled binary, a canvas renders with HMR + the cross-origin iframe in WKWebView, quit kills the sidecar.
- [ ] **Spike B passes**: iso-git clone/commit/push round-trips against a real repo with token auth; timings + caveats recorded.
- [ ] **Spike C passes**: GitHub OAuth device flow → token → OS keychain round-trip; non-technical UX captured.
- [ ] **6 DDRs** written, numbered, cross-linked from the epic; the epic's E0 DDR table updated with the real numbers; the dropped former-Phase-26 hub-propagation idea recorded as out-of-scope in the collaboration DDR.
- [ ] **Findings doc** with an explicit **Go / No-Go for E1** + rationale (and a named pivot if No-Go).
- [ ] Spikes torn down — no throwaway code in production paths.
- [ ] STATE.md History row + roadmap regen (`pnpm --filter @maude/site gen:roadmap`) when this lands.

---

## Risks (E0-specific)

- **Tauri webview can't render our canvases** (the cross-origin iframe / CSP / motion) — this is exactly what Spike A exists to find. If it fails, E0 has done its job: pivot before E1.
- **Spike scope creep** — the temptation is to "just make it nice." Resist: each spike is the minimal answer to one question; polish is E1's job.
- **OAuth app + signing identity logistics** — Spike C needs a scratch GitHub OAuth app; real signing/notarization is deliberately deferred to E1 (only flagged here).
- **Rust toolchain friction** for a JS/Bun team — first Tauri build is the slowest; budget for it. Isolated to `spikes/`.

## Confidence

**8/10** that E0 is well-scoped and will produce a clear Go/No-Go. The Tauri-renders-our-canvas question (Spike A, cross-origin iframe in WKWebView) is the genuine unknown — that's precisely why it's a spike and not an assumption baked into E1.
