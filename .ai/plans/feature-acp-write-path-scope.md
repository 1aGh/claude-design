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

- [ ] A page reload (including a branch switch) does not kill a running chat — the turn completes and the client re-attaches without duplicated output
- [ ] A branch switch with a live turn warns and requires confirmation at **all three** reload call sites
- [ ] Switching desktop projects A→B→A leaves A's turn running; returning lands in the same chat
- [ ] A session's write scope is the project it was **created** in, proven by a test with a different project open
- [ ] A permission request raised while no socket is attached fails closed (deny), never auto-approves
- [ ] Detached bridges are TTL-reaped and capped; app quit still tears everything down
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

## Acceptance Criteria

- [ ] `Edit` / `Write` / `NotebookEdit` are no longer in `MAUDE_DEFAULT_ALLOWED_TOOLS`
- [ ] An in-project write is auto-approved with **no** prompt (DDR-184 preserved, e2e-proven)
- [ ] A write outside the project prompts, naming the **resolved** absolute path
- [ ] `..`, absolute, symlink-escape, absent-location and disagreeing-location cases all resolve to *prompt* (unit-tested)
- [ ] Out-of-project consent is per-call — no "always" option on that path
- [ ] Security fan-out run and clean; findings either fixed or recorded as named open items
- [ ] DDR recorded (supersedes the "auto-approving Edit/Write is the accepted residual" claim); What's New entry only if the prompt is user-visible enough to warrant one
