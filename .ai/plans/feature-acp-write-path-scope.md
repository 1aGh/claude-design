# Feature: ACP writes are project-scoped — every write outside the project asks

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports.

## Description

The ACP chat panel auto-approves `Write` / `Edit` / `NotebookEdit` with **no path scoping at all**. The justification in `bridge.ts:214-217` is that "edits land in the served project (already the edit target) and are reversible via the `_history/` snapshot stack" — **both halves are true only inside the project**, and nothing enforces that. A write to `~/Library/LaunchAgents/x.plist`, `~/.config/environment.d/*.conf` or `~/.zshenv` is auto-approved today, silently, with no prompt and no rollback.

This is the delivery primitive behind the A2 finding of the 2026-08-04 attacker pass on `feature-cloud-connect-ux`: untrusted project content (DDR-054) steers the auto-approving session into one file write that moves `MAUDE_CLOUD_URL`, which now governs both the sidecar's bearer-token destination *and* a native OS opener. Closing the write scope fixes that chain **and the whole class** — not one env var.

The fix is small in surface and precise in placement: the real approve/deny gate already exists (Milestone B — `requestPermission` → `permission-request` frame → `PermissionPrompt.jsx`, timeout + fail-closed deny). No new UI. What changes is *which* tool calls reach it.

## User Story

As someone who opens a design project I did not write, I want Maude's assistant to edit that project freely but to **ask before it touches anything outside it**, so that a canvas or README cannot quietly rewrite my shell profile, my launch agents, or another repo.

## Problem

- `MAUDE_DEFAULT_ALLOWED_TOOLS` (`bridge.ts:326-345`) lists `Edit`, `Write`, `NotebookEdit` as bare tool names. That list is spread into the SDK's `allowedTools` (`bridge.ts:372`), so **the CLI approves them itself and `requestPermission` is never called** — a path condition cannot be added "next to" the current design, only by moving the decision.
- The blast radius of the accepted residual grew when `feature-cloud-connect-ux` made `MAUDE_CLOUD_URL` the trust root of a native command. Nobody re-rated it at the time; this plan is that re-rating.
- The product direction actively increases the precondition: cloud sharing + `Open in Maude` mean other people's canvases and TSX land on disk and are read by the auto-approving session. What is rare today becomes routine.

## Solution

- **A — move the decision.** Drop `Edit` / `Write` / `NotebookEdit` from `MAUDE_DEFAULT_ALLOWED_TOOLS` and gate them inside `requestPermission`: every write whose target resolves **inside `repoRoot`** is auto-approved exactly as today (DDR-184's no-prompt-per-edit goal is preserved verbatim); every other write goes to the existing prompt, naming the resolved absolute path.
- **B — resolve, never string-compare.** The verdict is computed on a **realpath-resolved** path (nearest existing ancestor for a file that does not exist yet), so `..`, `~`, and a symlink inside the project pointing out are all caught. `path.relative(root, target)` must be non-empty, not absolute, and not start with `..`.
- **C — fail closed.** Path comes from `toolCall.locations[].path` (ACP-normalized absolute), cross-checked against `rawInput.file_path`. A write tool arriving with **no** resolvable location, or with locations and rawInput that disagree, is treated as out-of-project — it prompts. A multi-location write is auto-approved only if **every** location passes.
- **D — an out-of-project write cannot be made permanent by one click.** The prompt's "always allow"-shaped options are filtered out for out-of-project writes, so consent is per-call. (Decision recorded below; it is the difference between a gate and a speed bump.)
- **E — the scope is pinned to the session's project, not the open one.** Today `repoRoot` is unambiguous only because a bridge's lifetime *is* the project's lifetime (see the Addendum). The moment a session outlives a project switch, "the project" is two different things — so the gate resolves against the `repoRoot` the session was **created** with, carried on the session, never re-read from whatever project the window is showing now.
- **Explicitly NOT in scope:** `Read` / `Grep` / `Glob` stay unscoped. This closes **write** egress, not read. Saying so out loud matters — it would be easy to read this plan as closing the trifecta, and it does not.

## Metadata

- **Type**: Security hardening + session-lifetime UX (see Addendum)
- **Complexity**: Medium (write-scope) / Medium-High once the Addendum's session lifetime lands
- **App/Package**: `apps/studio` (`acp/bridge.ts`, `acp/index.ts`, client prompt copy, `client/panels/RepoBranchSwitcher.jsx`), `apps/desktop/src-tauri` (`sidecar.rs`), tests
- **Affected Systems**: ACP permission surface (DDR-179 / 180 / 184 / 185 lineage); ACP session lifetime (DDR-125 F2 + the cross-restart-resume RCA)
- **Dependencies**: none new
- **Mandatory**: this repo requires a `security-auditor` + `ethical-hacker` fan-out for **every** ACP-permission-surface change (stated in `bridge.ts:229-231`; DDR-185's first cut shipped real bypasses that only that pass caught). Plus a DDR.

---

## Context References

### Must-Read Files

> During `/flow:execute`, read every file listed here in parallel in a single message.

- `apps/studio/acp/bridge.ts` — Why: the whole change. `MAUDE_DEFAULT_ALLOWED_TOOLS` (326-345), the `allowedTools` spread (364-373), the `requestPermission` handler (932-958), `this.opts.repoRoot` (37, 348, 707, 835). Read the 205-320 comment block in full before editing — it records why each entry exists and which ones a prior security pass removed.
- `apps/studio/client/panels/PermissionPrompt.jsx` — Why: where the out-of-project copy renders; check whether it already shows a path and what option kinds it offers.
- `apps/studio/test/acp-session-allowed-tools.test.ts` — Why: guards the allow-list contents; must be updated in the same change (it will fail the moment Write/Edit leave the list — that failure is the point).
- `apps/studio/test/acp-permission.test.ts` + `acp-permission-prompt.test.ts` — Why: the existing shape for testing this gate; new cases belong alongside.
- `.ai/archive/decisions/DDR-185-*.md` (and the DDR-184 it extends) — Why: the addendum documents the bypasses found in the first cut of the allow-list; the same failure modes apply to a path check.
- `.ai/logs/security-reviews/main-20260804-2200-attacker.md` — Why: A2's full chain, which this plan closes at the primitive.

Addendum-only (read these before Task 8):

- `apps/studio/acp/index.ts` — Why: the whole session-lifetime change. `bridges = new Map<string, AcpBridge>()` keyed by `ws.data.id` (138), `getOrCreateBridge` (160), `onOpen` (353), and `onClose` (440-448) which calls `bridge.stop()` the instant the socket dies. This socket-coupling IS the bug.
- `apps/studio/acp/bridge.ts` — Why (Addendum lens): `sessionFor` (681-745) with its `loadSession`-then-`newSession` resume, `sessionStorePath` (`_chat/<id>.session.json`, 487 / 781), `transcriptPath` (485), and `appendTranscript` on **every** agent update (930) — the last one is what makes detached streaming recoverable without inventing a new buffer.
- `apps/studio/client/panels/RepoBranchSwitcher.jsx` — Why: `switchDraft` (251), `createDraft` (279) and the local-merge fold (317) each call `window.location.reload()` unconditionally. That reload is what kills a running chat on a branch switch, and it is where the warning gate goes.
- `apps/desktop/src-tauri/src/sidecar.rs` — Why: `switch_project` (415) kills the sidecar child and lets the supervisor respawn it at the new root. Every bridge in that process dies with it, so no server-side change alone can make a chat survive a desktop project switch.
- `.ai/archive/decisions/DDR-125-*.md` — Why: names both the "N processes" cost of parallel chats (the ceiling Task 11 has to respect) and the cross-restart-resume gap this Addendum finishes closing.

### Files to Create

- none (all changes land in existing files; a DDR is authored at `/flow:done`)

### Patterns to Follow

- **The gate already exists** — `requestPermission` (bridge.ts:932) with `MAX_PENDING_PERMISSIONS`, a timeout, and `cancelled` as the fail-closed default. Add a branch **before** `pendingPermissions` registration; do not build a parallel path.
- **Comment style** — this file explains WHY at length, including what was rejected and by which pass. Match it; the `bridge.ts:214-217` justification must be corrected in place (it is currently the wrong claim, not merely incomplete).
- **Path types** — `toolCall.locations[].path` is documented as "The absolute file path being accessed or modified" (`@agentclientprotocol/sdk` `types.gen.d.ts:568-572`).

---

## Design Decisions

| Decision | Choice | Why |
| --- | --- | --- |
| Where the check lives | inside `requestPermission` | the only place that sees a per-call path; `allowedTools` is name-only |
| Path source | `locations[].path`, cross-checked with `rawInput.file_path` | adapter-normalized; rawInput is model-authored |
| Non-existent target | resolve nearest existing ancestor | a fresh file has no realpath; the parent decides |
| Disagreement / absent path | prompt (out-of-project verdict) | fail closed — the gate's existing default |
| "Always allow" on an out-of-project write | filtered out (per-call consent only) | otherwise one click restores the hole permanently |
| `Read`/`Grep`/`Glob` | unchanged | out of scope, stated explicitly so nobody reads this as closing read egress |
| `Bash(maude:*)` | audited, not changed here | see Task 5 — if a helper can write arbitrary paths, that is a separate finding, not a silent extension of this one |
| Scope root for a long-lived session | the `repoRoot` **pinned at session creation** | Solution E — a session that survives a project switch must not inherit the new project's write scope |
| Bridge lifetime | keyed by chat, not by socket; a grace TTL after the last socket detaches | a page reload is not a user intent to kill a running turn (Addendum) |
| Desktop project switch | keep the origin project's sidecar alive instead of killing it | one server per open project keeps `repoRoot` (and therefore the gate) one-to-one — the alternative, one long-lived cross-project agent process, would dissolve the boundary this plan exists to draw |
| Branch switch with a live turn | **warn + confirm**, do not silently reload | the worktree changes under the agent mid-turn; the honest v1 is to say so, not to pretend the turn is safe |
| Permission request raised while detached | existing timeout → fail-closed deny, unchanged | nobody is looking; "no UI attached" must never read as consent |

---

## Tasks

Execute in order. Each task is atomic and testable.

### Task 1: PROVE what the adapter actually sends for a write

- **Do**: Before changing policy, capture a real `RequestPermissionRequest` for `Write` and `Edit` from a live ACP session (the `onPermission` transparency callback already fires for every request — log it behind a temporary env flag, or assert in a bridge test with a scripted adapter). Record: is `locations` populated? absolute? does `rawInput.file_path` agree?
- **Gotcha**: the whole design rests on `locations` being present and absolute. If it is not, the fallback (`rawInput.file_path` resolved against `cwd`) becomes the primary source and the fail-closed branch carries more weight — decide this on evidence, not on the type declaration.
- **Validate**: a recorded fixture checked into the test as the basis for Task 3's cases.

### Task 2: REMOVE the three write tools from the allow-list

- **Do**: Drop `'Edit'`, `'Write'`, `'NotebookEdit'` from `MAUDE_DEFAULT_ALLOWED_TOOLS`. Correct the `bridge.ts:214-217` justification: state that in-project writes are auto-approved *by the path gate*, and that the `_history/` rollback argument holds only inside the project — which is why it does not extend outside it.
- **Gotcha**: `acp-session-allowed-tools.test.ts` will go red. That is the intended signal; update it to assert the new list **and** that no bare write tool is present.
- **Validate**: `cd apps/studio && bun test test/acp-session-allowed-tools.test.ts`.

### Task 3: ADD the path gate in `requestPermission`

- **Do**: A pure, exported helper — `writeTargetsInsideProject(toolCall, repoRoot): boolean` — kept separate from the handler so it is unit-testable without a session. In `requestPermission`: if the tool is a write tool AND the helper returns true → resolve `{ outcome: 'selected', optionId: <the allow option> }` immediately, without registering a pending prompt. Otherwise fall through to the existing prompt path.
- **Pattern**: pick the allow option from `params.options` by `PermissionOptionKind` rather than a hardcoded id; if no allow-shaped option exists, fall through to the prompt (fail closed).
- **Gotcha**: resolve with `realpathSync` where the path exists and on the nearest existing ancestor where it does not; compare via `path.relative` (empty / absolute / leading `..` ⇒ outside). A naive `startsWith(repoRoot)` also matches `/repo-evil` — the classic sibling-prefix bug.
- **Validate**: new unit tests — in-project file, in-project new file, `../` escape, absolute escape, symlink-inside-project→outside, missing `locations`, locations/rawInput disagreement, multi-location where one is outside.

### Task 4: SURFACE the out-of-project write honestly in the prompt

- **Do**: `PermissionPrompt.jsx` shows the **resolved absolute path** and says plainly that it is outside the project. Filter "always"-shaped options for this case (Decision D).
- **Gotcha**: render the resolved path, never the model's string — `docs/../../../.zshenv` reads as harmless in a prompt. This is the same lesson as the deep-link modal's truncated project name.
- **Validate**: `bun test test/acp-permission-prompt.test.ts` + a client render check.

### Task 5: AUDIT the remaining write paths for a bypass

- **Do**: Check whether the still-auto-approved surface can write outside the project — chiefly `Bash(maude:*)` (helpers take `--out`/`--root` arguments) and `NotebookEdit`-adjacent tools. Document findings; do NOT widen or narrow other entries in this change.
- **Gotcha**: a scoped `Write` next to an unscoped helper that writes anywhere is theatre. If a bypass exists, it belongs in the DDR as a named open item with its own follow-up, not quietly fixed here.
- **Validate**: written findings section in the DDR draft.

### Task 6: SECURITY fan-out (mandatory, not optional)

- **Do**: `security-auditor` + `ethical-hacker` in parallel on the diff, per `bridge.ts:229-231`. Brief them specifically on: TOCTOU between resolve and the CLI's actual write; symlink swaps; Windows path semantics (case-insensitivity, `\\?\`, 8.3 short names, UNC); `repoRoot` itself being a symlink; and whether the auto-approve branch can be reached with a spoofed `locations`.
- **Gotcha**: DDR-185's first cut passed review by construction and still had real bypasses. Treat a clean verdict as a hypothesis.
- **Validate**: verdict `PASS` / `PASS WITH SUGGESTIONS`; any CRITICAL → back to execute.

### Task 7: E2E — the panel still edits without prompting

- **Do**: Extend the desktop ACP e2e so an in-project edit completes with **no** permission prompt (the DDR-184 regression guard), and add a scenario where an out-of-project write raises the prompt.
- **Gotcha**: memories `project_desktop_e2e_harness_wdio_gotchas` — and the run now sets `MAUDE_E2E_NO_KEYCHAIN`; keep the display awake (a locked/asleep screen and the keychain modal both fail the run looking exactly like a code break).
- **Validate**: `pnpm test:e2e:desktop:acp-cold-start` (or the relevant ACP suite) green.

---

## Addendum: the ACP panel is project- and branch-agnostic

> Requested 2026-08-07. Folded into this plan rather than split out, because the two changes meet at one line: **which `repoRoot` the write gate resolves against.** A gate written against "the open project" is correct only while a session cannot outlive one — the moment it can, that same gate silently hands project A's session write access to project B. Ship the pinning (Solution E) with the lifetime change or not at all.

### What is actually true today (measured, not assumed)

The user's intuition — *"the session runs per repo anyway"* — is **half right**, and the half that is wrong is the half that hurts:

| | per repo, survives | dies |
| --- | --- | --- |
| Chat history (`<designRoot>/_chat/<id>.jsonl`) | ✅ appended on **every** agent update (`bridge.ts:930`), independent of any socket | |
| The ACP session id (`_chat/<id>.session.json`) | ✅ persisted, and `sessionFor` (`bridge.ts:681`) tries `loadSession` before `newSession` | |
| The **live** bridge + its `claude` child process | | ❌ keyed by `ws.data.id`; `onClose` → `bridge.stop()` (`acp/index.ts:440-448`) |
| An **in-flight turn** | | ❌ killed mid-stream, no warning, no resume of *that* turn |

So the *conversation* is per repo. The *running agent* is per WebSocket. Both switches break it, for different reasons:

- **Branch switch** — `RepoBranchSwitcher.jsx` calls `window.location.reload()` unconditionally on switch (251), draft-create (279) and local-merge fold (317). The reload closes the socket → the bridge stops → the turn dies. Nothing warns. Reopening the chat replays history and can resume the session, so it *looks* like it merely lost its place; the work in flight is simply gone.
- **Project switch** — `sidecar.rs:415 switch_project` kills the sidecar child outright and lets the supervisor respawn it at the new root. The **whole server process** goes, so every chat in project A dies, not just the visible one. No server-side fix reaches this; it needs the desktop shell to stop killing the process.

### Requirement

1. **Across projects: sessions keep running.** Switching to project B must not stop project A's turn. Switching back lands in the same chat, still streaming if it still is. Sessions stay strictly per repo — nothing migrates, each project's chats simply stay alive in their own scope.
2. **Across branches: survive if we can, warn if we cannot.** Preferred: a branch switch does not kill the chat. Accepted floor for v1: if a chat is mid-turn, the switcher says so plainly (*"a chat is running — switching the draft will stop it"*) and requires an explicit confirm. Silently reloading is the one outcome that is not acceptable.
3. **Neither may widen the write scope.** Solution E is the invariant: the gate follows the session's origin repo.

### Hazards to design against (do not skip these)

- **A branch switch moves the worktree under a live turn.** The agent read `foo.tsx` on `draft-a` and writes it back after checkout to `main` — a silent cross-branch clobber. Worse, this plan's own premise leans on `_history/` rollback, and the snapshot stack is per-canvas-slug with **no branch awareness**, so the "it's reversible" argument degrades exactly here. This is why branch is harder than project, and why warn-and-confirm is an honest floor rather than a cop-out.
- **A detached bridge is a live agent with no UI attached.** Any `requestPermission` raised while nobody is watching must hit the existing timeout → fail-closed deny. "No client attached" must never be a path to auto-approval — that would re-open, from a new direction, exactly what Task 3 closes.
- **Unbounded detached bridges leak processes.** DDR-125 already books "N processes" as the cost of parallel chats; detaching removes the natural reaper (socket close). A TTL and a ceiling are load-bearing, not polish.
- **Re-attach must not double-render.** History hydration (transcript) plus a live stream tail is two sources for the same bytes; the seam needs a sequence marker, not a guess.
- **App quit still kills everything** (`sidecar.rs kill_server`, DDR-166's SIGTERM-first path). Keep that — this Addendum extends session lifetime across *switches*, never across quit.

### Options for the desktop project case (decide in Task 10, do not pre-bake)

| Option | Effect | Cost |
| --- | --- | --- |
| **1. Detach bridge lifetime from the socket** (key by chat, grace TTL) | Fixes branch switch and every reload. Alone it does **not** fix desktop project switch. | Small, server-only. Prerequisite for the others. |
| **2. Keep the origin project's sidecar alive on switch** (spawn/attach per project instead of kill-and-respawn) | Fixes the project case while keeping one `repoRoot` per server — the gate stays one-to-one. | Sidecar supervisor becomes a small pool: N ports, N processes, teardown + reap policy. |
| **3. Move the agent out of the sidecar into a long-lived cross-project host** | Also fixes it. | **Recommended against** — one agent process spanning projects dissolves the per-project boundary this plan is drawing, and re-opens the scope question in the worst place. |

Recommendation: **1 + 2**. 1 is worth landing on its own even if 2 slips — it is what makes the branch case survivable rather than merely warned about.

### Task 8: DETACH the bridge from the socket

- **Do**: Key `bridges` by chat identity rather than `ws.data.id`, and let a bridge outlive `onClose`. On close, detach the sink (stop sending to a dead socket) and start a grace timer; on a new socket for the same chat, re-attach and replay. Keep the `AiActivity` tracker's `endTurn()` semantics correct — a detached-but-running turn must still hold its banner, while a genuinely abandoned one must clear.
- **Pattern**: the transcript is already the durable record (`bridge.ts:930` appends every update regardless of socket) — hydrate from it on re-attach and stream only the tail, rather than inventing a second buffer.
- **Gotcha**: the seam. Mark the last transcript offset handed to the client and stream from there, or the user sees the last few seconds twice.
- **Validate**: a bridge test that closes the socket mid-turn, re-opens, and asserts (a) the turn completed, (b) the client receives each update exactly once, (c) no orphaned bridge after the TTL.

### Task 9: WARN before a branch switch stops a chat

- **Do**: `RepoBranchSwitcher.jsx` asks the server whether any chat is mid-turn before the `window.location.reload()` in `switchDraft` / `createDraft` / the local-merge fold, and on a hit shows a confirm naming what stops. If Task 8 lands first, a *reload* no longer kills the chat — but a **checkout** still moves the ground under it, so the warning stays either way; only its wording changes ("will stop it" → "is editing files on this draft").
- **Gotcha**: three call sites, not one. All three reload; all three need the gate.
- **Validate**: client render test for both wordings + a manual pass with a live turn.

### Task 10: KEEP the origin project's session alive across a desktop project switch

- **Do**: Decide between Options 1+2 and 3 above (recommendation: 1+2), then make `sidecar.rs switch_project` stop being a kill. Under Option 2 it becomes spawn-or-attach: the origin sidecar stays up, the new project's comes up beside it, the webview navigates to the new one. Needs a reap policy (idle + no live chat ⇒ shut down) and a ceiling.
- **Gotcha**: `switch_project` currently deletes the target's `_server.json` to force `wait_for_server` onto a fresh write. With a pool, that file is a *live* instance's state for a project that may already be running — deleting it must not orphan a healthy server. Loopback + `is_loopback_url` navigation guards (DDR-109) apply per instance.
- **Gotcha**: every `_server.json` consumer assumes one instance per project, not one per app. Re-read the DDR-115 runtime-state taxonomy before adding a per-instance file.
- **Validate**: switch A→B→A with a long turn running in A; the turn is still streaming on return. Plus: quit still tears every instance down (DDR-166).

### Task 11: PIN the write scope to the session's project (the seam with Tasks 2-4)

- **Do**: Carry the creating `repoRoot` on the session/bridge and have `writeTargetsInsideProject` resolve against **that**, never against a re-read of the currently-open project. A session whose origin project is no longer open keeps its original scope — it does not acquire the new one.
- **Gotcha**: `newSessionParams` already sets `cwd: repoRoot` (`bridge.ts:410`) at creation, so the value exists; the risk is a later refactor reading `this.opts.repoRoot` from a bridge that has been re-pointed. Make the pinned value a distinct, readonly field with a comment saying why it must not be recomputed.
- **Validate**: a test that runs a session created under root A while root B is the "open" project, and asserts a write into B **prompts** rather than auto-approving.

### Task 12: SECURITY re-run on the lifetime change

- **Do**: The mandatory `security-auditor` + `ethical-hacker` fan-out (Task 6) covers the lifetime diff too, briefed specifically on: a detached bridge's permission requests (must fail closed), whether a re-attach can bind a socket to *another* project's bridge, whether the sidecar pool lets a canvas from project A reach project B's origin (DDR-054 / DDR-123 — the canvas origin must never reach `/_ws/acp`, per instance), and process-exhaustion via repeated switches.
- **Validate**: verdict `PASS` / `PASS WITH SUGGESTIONS`; any CRITICAL → back to execute.

### Addendum acceptance criteria

- [x] A page reload (including a branch switch) does not kill a running chat — the turn completes and the client re-attaches without duplicated output
- [x] A branch switch with a live turn warns and requires confirmation at **all three** reload call sites
- [x] Switching desktop projects A→B→A leaves A's turn running; returning lands in the same chat *(implemented as the sidecar pool — Options 1+2; verified by construction + `cargo check`/`clippy`, NOT yet by a live A→B→A run, see Execution notes)*
- [x] A session's write scope is the project it was **created** in, proven by a test with a different project open
- [x] A permission request raised while no socket is attached fails closed (deny), never auto-approves
- [x] Detached bridges are TTL-reaped and capped; app quit still tears everything down (`acp.stopAll()` on SIGTERM + `kill_server` drains the whole pool)
- [ ] Security fan-out covers the lifetime diff, not just the path gate

### Explicitly not in the Addendum

- Chats do **not** move between projects, and no chat becomes cross-project. "Project-agnostic" here means *the panel keeps working through a switch*, not *one session spanning repos* — the latter would undo Solution E.
- No change to what survives an app **quit** beyond today's resume-from-`_chat/` behaviour.

---

## Validation

1. **Static + tests**: `pnpm lint`, `pnpm test`, `pnpm test:dev-server`
2. **Unit**: the path-gate cases from Task 3 (the escape shapes are the point of this change)
3. **Regression**: in-project editing still prompt-free — DDR-184's whole reason for the allow-list
4. **Security**: mandatory fan-out (Task 6)
5. **E2E**: ACP desktop suite
6. **Manual**: ask the panel to write outside the project and confirm the prompt names the resolved path
7. **Addendum**: reload / branch-switch / project-switch survival + the pinned-scope test (see the Addendum's own criteria)

## Risks

- **A scoped Write beside an unscoped helper is theatre.** Task 5 exists to find that before the DDR claims a property the system does not have.
- **TOCTOU**: we resolve, the CLI writes moments later; a symlink swapped in between defeats the check. Probably acceptable (it needs local code execution already) — but state it in the DDR rather than let a reader assume it was considered.
- **Prompt fatigue.** If a normal workflow writes outside the project more often than expected, people will click through. Task 1's evidence should tell us the real rate before shipping; if it is high, the scope rule is wrong, not the users.
- **Windows path comparison** is not POSIX — case-insensitivity and short names are a real bypass class, and this repo ships a Windows build.
- **Concurrent sessions on `~/git`** — stage only this feature's files; `scripts/check-import-coherence.sh` is a release gate.
- **The Addendum can be split, the pinning cannot.** Tasks 8-12 are shippable after Tasks 1-7, but if the session lifetime lands **without** Task 11, the write gate quietly becomes wrong in the exact case it was built for. Either both, or neither.
- **A live agent with no UI attached** is a new state this system has never had. Every fail-closed default (permission timeout, turn cancel, `MAX_PENDING_PERMISSIONS`) is now load-bearing in a situation it was not written for — re-read them rather than assuming they carry over.

## Follow-ups (out of scope, recorded)

- **Read-side egress** (`Read`/`Grep`/`Glob` unscoped + `WebFetch` auto-approved) is the other half of the trifecta and is untouched here. Deserves its own rating.
- **The `cloud_base() != default` badge** — the cheap, independent mitigation for A2's token half, which this plan does not address.
- Re-rate the DDR-125 F2 residual now that its blast radius includes a native OS capability.

---

## Task 1 findings — what the adapter actually sends (measured 2026-08-07)

Measured against `@agentclientprotocol/claude-agent-acp@0.57.0` on disk, not inferred from the ACP type declarations — **the two disagree**, and the design had to change because of it. Full write-up lives in `apps/studio/acp/write-scope.ts`'s header; the recorded wire shape is replayed by `test/fixtures/mock-acp-agent-write.mjs`.

| Plan assumed | Actually true | Consequence |
| --- | --- | --- |
| `locations[].path` is "ACP-normalized absolute" | `dist/tools.js` sets `locations: input?.file_path ? [{path: input.file_path}] : []` — the model's string **verbatim**, no normalization | A relative path is possible; it must be resolved against the session `cwd` (= repo root). The SDK doc comment (`types.gen.d.ts:568-572`) is aspirational. |
| `locations` cross-checked against `rawInput.file_path` gives two independent sources | Both read the **same** field for `Write`/`Edit` | The cross-check is **tautological** against today's adapter. Kept anyway (fail-closed gates shouldn't assume a well-behaved counterparty) but it is not corroboration, and the code says so. |
| `NotebookEdit` behaves like the others | It has **no case** in the adapter's tool mapper — falls through to `case "Other"`, which emits **no `locations` at all**; its target is `rawInput.notebook_path` | The `rawInput` fallback is **mandatory**, not defensive polish. |
| The write tool is identifiable from the permission request | The request's `toolCall` is `{toolCallId, rawInput, ...toolInfoFromToolUse(…)}` (`acp-agent.js:2270-2286`) and carries **no tool name** | The name rides only on the prior streamed `tool_call`'s `_meta.claudeCode.toolName`. The bridge now harvests it there (bounded map, `MAX_TRACKED_TOOL_NAMES`); a miss **fails closed to the prompt**. `kind`/`title` were rejected as sources — `kind:'edit'` is shared with any future edit-shaped tool. |

**Prompt-rate evidence (the plan's "prompt fatigue" risk):** the gate auto-approves every write under the pinned root, which is where 100% of canvas/design work lands. In the ACP e2e and the full 282-test ACP suite, zero in-project writes produced a prompt. The scope rule looks right; nothing observed suggests a normal workflow writes outside the project.

## Task 5 findings — remaining write paths (audited, NOT fixed here)

Per the task's own instruction: findings are recorded as named open items with their own follow-up, **not** quietly fixed inside this change. This section exists so the DDR cannot claim a property the system does not have.

> **THE RECURRING FAILURE IN THIS SECTION — read this before trusting any list below.**
>
> Three separate times in this review, a list here read as complete and was short:
> 1. The original audit swept only the `maude design` helpers and missed the read-only bash group — where the auditor then found **F1**, a cheaper arbitrary write than anything the list contained.
> 2. The `--out` enumeration had eight entries; a grep found **nine** (`transcribe` missing).
> 3. The `--root` enumeration had five; a grep found **26** — not stragglers, but the house convention for every helper.
>
> The pattern is more useful than any of the three items: **an enumeration written from what the author happened to look at reads, to every later reader, as a statement about the system.** Each of these was correctly *rated* and wrongly *scoped*, and the scoping error is what invites someone to fix the listed items and believe the class is closed.
>
> So: the findings below are stated as CLASSES with counts and a grep-able definition, not as lists. Where a list appears, it carries how it was produced. If you are about to act on one, re-derive it — and if you extend this section, say what you searched, not just what you found.

**The honest scope of this change:** it closes the *direct* `Write`/`Edit`/`NotebookEdit` primitive and makes an out-of-project write of arbitrary content require per-call human consent **through the write tools**. It does **not** establish "an ACP session cannot write outside its project": `Bash(maude:*)` remains auto-approved and unscoped, carrying both `exec bun run` and redirection with attacker-chosen content. With F1 fixed, the direct A2 delivery path IS closed — but **"closed" means "through the write tools and the read-only bash group", not "in general"**, and the auditor signed the claim only in that exact wording. Two standing rules follow from that, and they bind release notes and product copy, not just the DDR: (1) the qualifier must never be dropped — the moment this appears anywhere as bare "closed", or as user-facing copy like "Maude asks before writing outside your project", it is false; (2) the sentence *"this change does not establish that an ACP session cannot write outside its project"* must survive editing, because that is precisely what a reader assumes from the feature's title and is the one thing still untrue.

- **F1 — `Bash(cat:*)` + shell redirection is an unrestricted arbitrary write (HIGH, pre-existing, PoC'd live).** `bridge.ts`'s allow-list carries `Bash(cat:*)`, `head`, `tail`, `ls`, `tree`, `wc`, `file`, `stat`. Claude Code's `Bash(<cmd>:*)` prefix rule does **not** reject shell redirection, so `cat > /tmp/x`, `cat payload > /tmp/x` and — worst — `cat > ~/.zshenv <<'EOF' … EOF` all match the rule, are self-approved by the CLI, and never reach `requestPermission`. The last form is model-authored arbitrary content to an arbitrary path in ONE command, with no write tool involved at all. Verified against claude 2.1.220 under `--permission-mode default` (an unmatched tool auto-denies there, so a landed write proves the rule matched). **This was the exact A2 primitive this plan's Problem section names, fully intact, and cheaper than the `Bash(maude:*)` chain below** — no `--script`, no code execution, no symlink. The allow-list comment justifying that group argued it adds no incremental *read* capability, which is true and beside the point: every one of those verbs accepts `>`.

  **FIXED, on an explicit user decision to override this task's own no-narrowing rule** (the alternative — shipping a write gate whose headline claim is defeated by `cat >` — was judged worse than the friction). All nine entries are CUT from `MAUDE_DEFAULT_ALLOWED_TOOLS`, mirroring how DDR-185's security addendum cut `find` and `agent-browser` rather than patching them, and for the identical reason: a prefix rule cannot inspect what follows the command name, so there is nothing to patch. `pwd` goes too (`pwd > file` redirects like the rest). Accepted cost: those verbs prompt again, giving back part of DDR-185's friction win — `Read`/`Grep`/`Glob` stay auto-approved, so the actual read workflow is untouched and what returns is a prompt on the *convenience interface* to power already granted. Guarded by a dedicated test in `acp-session-allowed-tools.test.ts` so re-adding any of them fails loudly. Route them back through a hardened `maude design` wrapper verb (like `agent-browser-safe` / `curl-local`) if the friction proves unacceptable — a wrapper can reject redirection.
- **`.git/` AND `.claude/` ARE IN-PROJECT AND REACH CODE EXECUTION (HIGH) — FIXED.** Found at `/flow:done` by tracing the one question the adversarial pass was spawned for and never answered. `.git/` is inside `repoRoot`, so `writeTargetsInsideProject` auto-approved `.git/hooks/pre-commit` / `post-checkout` / `.git/config` **silently, with no prompt**. That is code execution at the next git operation, and it needs **no second tool call** — cheaper than the accepted `Bash(maude:*)` chain. Maude runs git on the user's behalf (`/_api/git/checkout` from the branch switcher, `/branch`, `/fold`), `MAUDE_USE_SYSTEM_GIT=1` forces the real binary (which runs hooks; isomorphic-git does not), and even where Maude never shells out the user's own terminal `git commit` fires the hook. `.claude/` is the same shape one step removed: DDR-144's `settingSources:['user']` stops the ACP session reading the project's copy, but a plain `claude` the user opens in that repo does read it, so the write steers a FUTURE session.

  **This falsifies the feature's own premise, which is why it is recorded here rather than as a footnote.** The rationale for auto-approving in-project writes is that they "land in the served project (already the edit target) and are reversible via the `_history/` snapshot stack". For `.git/hooks/pre-commit` BOTH halves are false: it is not the edit target, and `_history/` snapshots canvases under `<designRoot>` and nothing else. **In-project is a NECESSARY condition for auto-approval, not a sufficient one** — that is the corrected statement of the rule.

  Fixed on an explicit user decision with `EXECUTION_SENSITIVE_DIRS` in `write-scope.ts`: a resolved target whose first segment relative to the scope root is `.git` or `.claude` returns the new verdict `in-project-denied` and goes to the prompt. Segment match, not prefix — `.gitignore` and `.github/` are ordinary files, and a prefix compare would catch both (the same sibling-prefix bug as the root check). The prompt copy is separate from the out-of-project copy, because saying "outside this project" here would be a plain lie; it says the file is part of how the project RUNS. The list is pinned by a test: every entry costs a prompt on a genuinely in-project path, and prompt fatigue is itself a security failure, so growth must be a decision rather than drift. **Same class, deliberately NOT included, follow-up:** `node_modules/` (a write executes at the next import) and `package.json` `scripts`.
- **A6 — the case fold was `win32`-only and macOS is case-INSENSITIVE (MEDIUM) — FIXED.** `isProtectedInProject` folded case only on win32. `realpathSync.native` canonicalizes casing for components that EXIST on disk (which is why `.GIT/config` was caught — `.git/` exists in any real repo), but a protected path that does NOT yet exist keeps the caller's casing. In a typical design project `.claude/`, `CLAUDE.md`, `.mcp.json`, `.gitattributes` and `.gitmodules` are all absent — so each was reachable by pressing shift. Measured against the shipped module before the fix: `claude.md`, `.CLAUDE/settings.json` and `.MCP.json` were all auto-approved while their lowercase forms were denied. It did NOT reopen the RCE chain (`.git/` and `package.json` exist), but it restored A3 in full: one auto-approved `Write <root>/claude.md` persists an injection into every future session in the repo, including the user's own terminal. Fixed by folding unconditionally — cost on a case-sensitive filesystem is a prompt on a genuine `Claude.md`, which is the right direction since this check only ever ADDS a prompt. Deliberately NOT applied to `isInsideRoot`: that is a CONTAINMENT check where folding could wrongly judge a sibling as inside — opposite risk, opposite default.
- **The PREDICATE behind `PROTECTED_IN_PROJECT`, recorded so the list is extended by re-derivation and not by pattern-matching:** *an in-project path that reaches execution without a further agent action.* Three strong omissions found by grepping for that property, **NOT currently in the list** (they are new scope beyond the approved fix and are the user's call):
  - `.envrc` — direnv executes it on `cd` into the repo. The lowest bar of anything on or off the list: no app action, no git operation, no click beyond entering the directory in a shell.
  - `.vscode/**` — `settings.json`'s `terminal.integrated.env.*` and `tasks.json`'s `runOn: folderOpen` execute when the user opens the project in their editor, which is the single most likely thing they do next after opening a design project.
  - `.github/workflows/**` — executes in CI with repo secrets, and **this app ships the trigger**: "Save version" → "Publish" (`/_api/git/commit` → `/_api/git/push`) is a two-click path from an auto-approved workflow write to CI execution. Note this one needs a PATH-prefix rule, not a segment rule — `.github/` itself must stay allowed.
- **LOW-1 (open):** `attach` calls `getOrCreateEntry`, which mints an entry for any chat id, so `MAX_BRIDGES` is exhaustible by ATTACHED entries that `enforceDetachedCeiling(0)` cannot reap — a same-origin self-DoS in which the ceiling is trivially exhausted by the very thing it protects.
- **LOW-3 (open):** `/_api/git/status` has no host guard and no `sameOriginRead` (its POST siblings have both), safe only via dual-allowlist absence. `isTrustedRequestHost` is Host-header-only, so any loopback page — including project A's canvas iframe firing a cross-origin `no-cors` GET at project B's port — can TRIGGER it; firing it is enough to make that instance shell out to `git status`. This is precisely why A1's fix belongs at the write gate rather than in the git watcher.
- **F5 re-rate (open):** a one-click UI path to `bypassPermissions` deserves more than INFO now that `requestPermission` is load-bearing rather than incidental — it is the single switch that disables the whole write gate.
- **`Bash(maude:*)` is an arbitrary-CODE-EXECUTION and arbitrary-WRITE surface (HIGH, pre-existing, ACCEPTED).** Booked as ONE finding on the auditor's advice, replacing an earlier split into a HIGH (`draw-build`) beside a MEDIUM (redirection): two differently-severe entries read as two independent things and are easier to talk past than one accurate HIGH. The single rule carries both:

  - **Code execution.** `apps/studio/bin/draw-build.sh` ends in `exec bun run "$SCRIPT"`, and `to-lottie.sh` runs an agent-authored `gen.py` under its venv python. Fully prompt-free: write an **in-project** `.ts`/`.py` (auto-approved by the new gate, correctly — it is in-project), then `maude design draw-build --script that.ts`, and that script does anything the user can.
  - **Redirection, with attacker-chosen CONTENT.** The prefix rule does not reject `>` here either. This corrects an under-rating of mine: I claimed it was only helper-*chosen* stdout, which does not hold — several helpers echo IN-PROJECT file contents, and in-project files are exactly what the new gate auto-approves the model to write. `bin/prep.sh` reads `.design/config.json` through `jq` and emits its values; `read-annotations` does the same for the annotations SVG, `handoff` for registry JSON. So: write `config.json` (in-project, auto-approved) → `maude design prep --json > ~/Library/LaunchAgents/x.plist`. Attacker-chosen content, arbitrary path — the same primitive as `cat >`, one indirection longer. Subsumed by the code execution above (anything `>` achieves, `exec bun run` achieves more directly), which is why it is one finding and not two.
  - **ACCEPTED, not fixed:** `Bash(maude:*)` IS the design workflow (DDR-062); removing it would put a prompt on every step of the thing DDR-184 exists to unblock — a materially larger decision than dropping nine convenience verbs. Follow-up: rate whether "the agent authors a script, a first-party verb executes it" is acceptable under auto-approve at all, or needs its own consent step.
- **UNSCOPED DESTINATIONS ARE A CLASS, NOT A LIST (MEDIUM, pre-existing).** Deliberately stated as a class with counts attached, because the two earlier drafts of this item were enumerations that read as complete and were short — see the note below on why that matters more than either item.
  - **`--out` / `--out-dir` accepts an arbitrary destination, no root check: 9 helpers.** `draw-proof.sh`, `draw-build.sh`, `screenshot.sh`, `smoke.sh`, `to-lottie.sh`, `visual-sanity.sh`, `_video-playwright.mjs`, `_transcribe.mjs`, `scenario-report.mjs`. Most write helper-produced binary content (PNG/JSON) — a **destructive-overwrite** primitive. Two exceptions carry attacker-influenced CONTENT: `draw-build --out` (agent-authored SVG, arbitrary text to an arbitrary path), and `transcribe --out` (`_transcribe.mjs:110` parses it, `:409-410` strips only the extension, `:442`/`:447` `writeFileSync` to `${outBase}.srt`/`.vtt`, no root check on the path) — whose words come from the source audio, which can itself be an in-project asset the agent wrote and the gate auto-approved. SRT's index+timestamp framing makes it structured rather than free-form, which is why it rates MEDIUM rather than with `draw-build` — but structured is not harmless: a line of attacker-chosen text lands verbatim in many config formats. Prompt-free under `Bash(maude:*)`: `maude design transcribe --source <in-project audio> --out ~/.config/systemd/user/evil.service --format srt`.
  - **`--root <repo>` re-targets a helper at ANOTHER project: 26 helpers.** `chat-open`, `draw-proof`, `asset-sweep`, `canvas-rects`, `photo-bg-remove`, `generate`, `photo-adjust`, `prep`, `server-up`, `runtime-health`, `to-lottie`, `screenshot`, `smoke`, `visual-sanity`, `_canvas-rects-static`, `_audio-search`, `_import-asset`, `_fetch-asset`, `_ingest-footage`, `_import-brand`, `_import-tokens`, `_probe-footage-playwright`, `_smart-frames`, `annotate`, `_transcribe`, `read-annotations`. Severity is unchanged (writes still land under the target's resolved `designRoot`, which is what bounds this below the code-execution finding) but the SHAPE is not: an earlier draft listed five, which reads as a handful of stragglers. Twenty-six means **`--root` re-targeting is the house convention for every helper** — a different remediation conversation, and one shared root check rather than five patches. The old wording invited someone to fix five and believe they were done.
  - **Remediation shape:** one shared destination check across `bin/`, applied to both flags, not per-helper patches.
- **No finding, verified by inspection rather than assumed:** `generate`, `import-asset`, `import-brand`, `import-tokens`, `ingest-footage`, `fetch-asset`, `audio-search`, `photo-adjust`, `photo-bg-remove`, `handoff`, `asset-sweep` take NO destination argument (grepped for `--out`/`--dest`/`--output`/`--target`/`--to`; only `transcribe` hit). Their writes are computed under a resolved assets or DS directory (`_import-asset.mjs:79-86`, `_import-brand.mjs:491-502`, `_import-tokens.mjs:893`, `_ingest-footage.mjs:219-276`, `_fetch-asset.mjs:416-445`) — the same structural scoping already credited to `canvas-edit`/`annotate`. `asset-sweep` and `audio-search` are read-only.
- **F4 (LOW residual, verified NOT exploitable today):** `resolveRealPath` collapses `..` lexically *before* realpath, so `<root>/link/../x` (link→outside) is judged inside where POSIX `open()` would land outside. The auditor built it and tested against the real CLI: Claude Code's Write normalizes `file_path` lexically the same way, so the two agree and there is no bypass. Recorded because it is an undocumented coupling to CLI internals — the same class as the ACP type declarations Task 1 already caught being wrong.
- **F5 (INFO):** the gate is session-mode-conditional. `bypassPermissions`/`dontAsk` short-circuit adapter-side and `requestPermission` never runs. Pre-existing, and DDR-144's `settingSources:['user']` correctly stops an untrusted project from setting it — but the DDR must say "in every mode that routes through the prompt", not unconditionally.
- **Trust boundary to name explicitly:** a hostile *adapter* could mislabel a Bash call as `Write` and have the gate approve it. Not an escalation (the adapter is the enforcer and could simply not ask), but the DDR should state the adapter as the trust boundary rather than leave it implied.
- **No finding:** `canvas-edit`, `annotate` and the annotation writers resolve their targets under the resolved `<designRoot>` rather than taking a free-form destination; `curl-local` (DDR-185) is loopback-pinned and writes nothing.

## Task 6 / 12 — security fan-out results (security-auditor)

**Final verdict: PASS WITH SUGGESTIONS.** No blockers remain. Progression: **FAIL** (F1 + F2) → fixes → **FAIL** (A1 blocker) → fixes → **PASS WITH SUGGESTIONS**, every fix re-verified directly against the code. The auditor verified every item below directly against the code rather than by inspection of my summary.

**Fixed in this change** — F1 (the read-only bash group cut, on an explicit user decision), F2 (grant strict / warning generous), F3 + its nit (display sanitization, widened and escaped), F6 (`stripAlways` split from `info` — a name-keyed `addRules` rule is unscoped regardless of which card it was clicked from), A1 (**the blocker** — `_server.json`'s untrusted url reaching curl argv unvalidated; now loopback-checked with the same `is_loopback_url` the navigate site uses, URL rebuilt from the parsed origin, `--` terminator), A2 (`reap_instances` no longer lets one busy project pin the pool), A3 (`MAX_BRIDGES` total ceiling — the old "attached bridges are bounded by human action" premise was true under socket-keying and died with the re-keying), A4 (control frames attachment-scoped), A5 (`spawn_for` no longer drops a live `CommandChild` without terminating it), A6 (cross-project origin test added now that pool concurrency is designed-in).

**Verified clean by the auditor, not taken on trust:** the `attach` frame's client-supplied `seq` (sanitized chat id, all hostile numeric forms fail safe, replay bounded); `/_api/acp/running`'s dual-allowlist absence (read in both `CANVAS_SAFE_API` and `startCanvasServer`'s routes); detached bridges failing closed (whole detach/reap path traced — nothing resolves a pending permission to anything but `cancelled`); and that `allowedTools` has exactly one assignment site.

**Must be visible in the DDR, not only here** (the auditor's explicit ask): `Bash(maude:*)` as the single HIGH (code execution + redirection); the unscoped-destination CLASS (`--out` × 9, `--root` × 26) stated as a class rather than a list; the recurring enumeration failure recorded above; Windows-on-real-hardware unverified; and the sentence that this change does **not** establish "an ACP session cannot write outside its project."

**Explicitly NOT covered — do not read the fan-out as complete:**
- The **ethical-hacker pass never reported at all.** `bridge.ts`'s own convention asks for BOTH auditors, and the security-auditor stated plainly that its pass does not substitute for the adversarial one. The composite-chain questions it was briefed on are unanswered: `.git/hooks/pre-commit` as an in-project write that becomes code execution at the next git operation, and adversarial work on the detached-bridge state generally.
- **Windows path behaviour is reasoning, not execution** — no real Windows host was available. The analysis found no bypass (ADS/UNC/`\\?\`/short names/trailing dots all resolve to prompt, and `toLowerCase` avoids the Turkish-İ trap), but this repo ships a Windows build and that residual is untested.
- **LOW, open — the reaper probe's PORT is attacker-chosen.** `{"url":"http://127.0.0.1:9999/"}` passes `is_loopback_url`. Bounded now that the path is pinned to `/_api/acp/running`: a bare GET to an arbitrary localhost port, substring-checked, never exfiltrated. Two consequences worth naming: a liveness/timing oracle for local ports, and a project that pins itself "busy" by pointing at a port that never answers `"running":0`. Closing it means comparing against the port that instance actually bound. Recorded, not fixed.
- **Pre-existing, unrelated to this change:** `is_loopback_url` does not accept `::1`, so an IPv6-bound server fails BOTH the navigate site and this probe. A false-negative (functionality), not a hole, and shared with the navigate site — belongs wherever DDR-109 is tracked, not here.
- **LOW, open:** `readFileSync` slurps the entire transcript on every `attach` and every `/_api/acp/chat` hit. A large transcript plus repeated attaches is a memory/CPU amplifier. Pre-existing pattern (`readChatMessages` already did it); the `attach` path makes it client-triggerable. Bound or stream it.

## Execution notes — deviations from the plan, and why

Recorded here rather than silently absorbed, because each one changes something the plan asserted.

1. **The `locations`-vs-`rawInput` cross-check is tautological (Task 1).** The plan treated them as two independent sources. They are one field. Kept and implemented, but the code says plainly that it is defense against a non-compliant adapter, not corroboration. See the Task 1 findings table.
2. **The gate needs the tool NAME, which the permission request does not carry.** Not anticipated by the plan. Solved by harvesting `_meta.claudeCode.toolName` off the streamed `tool_call` the adapter guarantees is emitted first, into a bounded map (`MAX_TRACKED_TOOL_NAMES`). Every failure of that channel — miss, eviction, reorder — falls through to the prompt.
3. **`writeTargetsInsideProject` takes a third argument (`toolName`).** The plan specified `(toolCall, repoRoot)`. It cannot decide anything without the name (see 2), and sniffing `kind === 'edit'` would auto-approve any future edge-shaped tool.
4. **Auto-approval uses `allow_once` only, never `allow_always`.** The plan said "pick the allow option by `PermissionOptionKind`". Falling back to `allow_always` would make the adapter install a session-wide `addRules` standing rule for the tool NAME — silently restoring the unscoped `Write` grant from inside the code that removes it. No `allow_once` offered ⇒ prompt.
5. **The out-of-project card substitutes the headline, not just the body (Task 4).** A first cut passed the body test and still rendered `toolCall.title` — which the adapter builds from the model's own string, so a write to `~/.zshenv` was headlined "Write docs/../../../.zshenv". Caught by the test, fixed rather than waived.
6. **Task 8 keys bridges by chat, as specified — but the motivation is narrower than the plan assumed.** The client already opens one WebSocket per chat, so per-chat keying is a LIFETIME change, not a multiplexing one. No new process multiplication; DDR-125's "N processes" ceiling is unchanged.
7. **Task 9's wording is the post-Task-8 one only.** The plan allowed for two wordings ("will stop it" vs "is editing files on this draft"). Since Task 8 landed, the first is now false — the turn is no longer killed — so only the second ships, and a test asserts the false one never returns.
8. **Task 9 asks the SERVER, not client chat state.** A bridge can be running detached with no client that knows about it, which is exactly the case the warning is for. Required a new `GET /_api/acp/running` and a small registry (`acp/running.ts`) rather than a `createHttp` signature change.
9. **Task 10 implements Options 1+2 as recommended; Option 3 is not implemented.** `switch_project` is now spawn-or-attach over a `MAX_INSTANCES`-capped pool, the `_server.json` delete happens ONLY on the spawn path (deleting a live instance's file would orphan a healthy server — the plan's own named gotcha), the supervisor respawns the root that died rather than "the current project", and `kill_server` drains the whole pool.
10. **The reap policy reuses Task 9's endpoint.** "Idle + no live chat ⇒ shut down" is answered by curl-ing that instance's own `/_api/acp/running`. A server that cannot answer is treated as evictable — otherwise a wedged process could veto its own eviction forever.

### Not verified by a live run

Stated plainly rather than implied by a ticked box:

- **The desktop A→B→A project-switch survival (Task 10)** is verified by construction, `cargo check` and `cargo clippy` (both clean), not by a live switch with a long turn running. It needs a packaged/`tauri dev` run on a machine with a signed-in `claude`.
- **The e2e scenario (Task 7)** — `apps/desktop/e2e/scenarios/acp-write-scope.e2e.ts` — is authored and type-checks, but has not been executed: it requires `pnpm test:e2e:desktop:build` (a full debug Tauri build) plus a signed-in `claude` and an awake display. The equivalent assertions ARE covered at the bridge level in `test/acp-write-gate.test.ts` (in-project write ⇒ zero client frames; out-of-project ⇒ prompt with the resolved path), so the regression guard exists — the e2e adds packaged-shell coverage on top.

## Acceptance Criteria

- [x] `Edit` / `Write` / `NotebookEdit` are no longer in `MAUDE_DEFAULT_ALLOWED_TOOLS`
- [x] An in-project write is auto-approved with **no** prompt (DDR-184 preserved; bridge-level proven, e2e scenario authored — see Execution notes for its run status)
- [x] A write outside the project prompts, naming the **resolved** absolute path
- [x] `..`, absolute, symlink-escape, absent-location and disagreeing-location cases all resolve to *prompt* (unit-tested)
- [x] Out-of-project consent is per-call — no "always" option on that path (stripped server-side AND rejected by `resolvePermission`)
- [ ] Security fan-out run and clean; findings either fixed or recorded as named open items
- [ ] DDR recorded (supersedes the "auto-approving Edit/Write is the accepted residual" claim); What's New entry only if the prompt is user-visible enough to warrant one
