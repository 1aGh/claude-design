# Feature: Maude tells you when a chat finishes — or needs you — including in a project you're not looking at

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports.

## Description

**The notification this asks for already exists in code and does not fire.** `app.jsx` has `notifyDesktop()` (202-214), `handleAssistantFinished` (9637) and `handleAssistantAttention` (9659) — the second one added by DDR-185 precisely because "a stalled turn otherwise gives no signal at all if the window isn't focused". Both are gated on `!assistantOpenRef.current || document.hidden`, both call `new Notification(...)`, and `Notification.requestPermission()` is called at 9627.

So this is **not** a "build notifications" feature. It is three separate reasons the existing one is silent, and only the first is a bug:

1. **It's the Web `Notification` API inside WKWebView.** The packaged app is Tauri v2 / wry / WKWebView, and the Tauri notification plugin is **not** in `apps/desktop/src-tauri/Cargo.toml` (verified — the plugin list is shell / single-instance / dialog / deep-link / updater / wdio-webdriver). Whether `Notification.permission` can ever reach `granted` in that webview is the **first thing Task 1 must measure**, not assume. If it cannot, every notification in the product has been a no-op since it was written, and the in-app badge has been carrying the whole signal alone.
2. **It only ever knew about the project you're looking at.** The handlers run in the webview, and the webview is loaded for one project. A chat running in project A while you're in B has no client executing that code.
3. **It cannot see a detached chat at all.** feature-acp-write-path-scope's Addendum made a bridge outlive its socket — a live agent with no UI attached. That is the exact state where a notification matters most (nobody is watching) and the exact state where a client-side handler cannot exist by definition.

(2) and (3) are new consequences of the Addendum. The sidecar pool now keeps project A's server — and its running turns — alive when you switch away; nothing observes them. This plan closes that: **the decision to notify moves out of the webview and into the native shell**, which is the only component that outlives any single project's page.

## User Story

As someone who kicks off a long chat and switches to another project, I want Maude to tell me when that chat finishes or gets stuck waiting on me, so that I don't have to keep switching back to check — and so a turn doesn't sit blocked on a permission prompt nobody saw until it times out and denies.

## Problem

- A permission request raised while detached fails closed after `PERMISSION_TIMEOUT_MS` (120 s) — correct security behaviour, and a bad experience if the only reason nobody answered is that nobody was told. The fail-closed default was designed as a backstop, not as the normal path.
- The sidecar pool (`MAX_INSTANCES = 3`) means up to three projects can have live turns while exactly one is visible. The pool's own reaper already asks each instance `/_api/acp/running` — the shell can reach every instance, the shell just never tells the user anything.
- `handleAssistantAttention`'s 30 s cooldown (`ATTENTION_NOTIFY_COOLDOWN_MS`) and the "you weren't looking" gate are good policy that currently applies to a notification that may never render.

## Solution

**Move the notify decision to the native shell; keep the payload boring on purpose.**

- **A — measure first (Task 1).** Determine empirically whether the Web `Notification` API works in the packaged WKWebView. This decides whether the existing client path is *repairable* or *dead*, and therefore whether the shell path replaces it or complements it. Do not design past this.
- **B — a real native notification.** Add `tauri-plugin-notification` (a genuine new dependency — see Risks) and a `notify` command, so the shell can post an OS notification regardless of which project's page is loaded, or whether any page is loaded.
- **C — the server states the fact, the shell decides the policy.** Extend the existing `/_api/acp/running` into an activity snapshot: per chat, `running` / `awaiting-input` / `idle`, plus a monotonic `seq`. The bridge already holds `pendingPermissions` and `pendingElicitations`; it just doesn't expose their counts. The **shell** polls every pooled instance and fires on *transitions* — because only the shell knows which project is on screen and whether the window is focused.
- **D — the notification body carries NO project content.** This is the load-bearing constraint, not a nicety. A chat title is model-generated from what the model read, and per DDR-054 the served project's content is untrusted. Putting a title in a notification body renders attacker-influenced text on a lock screen, outside the app, in a surface the user cannot inspect — and cross-project polling would carry it out of the project it came from. The payload is the **project name (from the path the user chose) plus a fixed string**. Nothing else.
- **Explicitly NOT in scope:** a cross-project chat *list* in the panel. That was asked for and declined on 2026-08-07 for the reason recorded in the archived plan — a shared list is one step from a shared session, which would dissolve the write-scope boundary the previous feature exists to draw. **Awareness that another project is busy is safe; showing its contents is not.** This plan is deliberately the former.

## Metadata

- **Type**: Enhancement (+ a latent-bug fix, pending Task 1)
- **Complexity**: Medium
- **App/Package**: `apps/desktop/src-tauri` (new plugin, command, poller), `apps/studio` (`acp/bridge.ts`, `acp/running.ts`, `http.ts`), `apps/studio/client/app.jsx`
- **Affected Systems**: ACP session lifetime (detached bridges), the sidecar pool, the in-app unseen badge
- **Dependencies**: `tauri-plugin-notification` (new — first new Tauri plugin since the updater)
- **Mandatory**: this touches the ACP surface and adds an OS-level egress channel. A `security-auditor` + `ethical-hacker` fan-out is required — see Task 8, and read the archived plan's Task 6/12 notes on why a clean defender verdict is not sufficient on this surface.

---

## Context References

### Must-Read Files

> During `/flow:execute`, read every file listed here in parallel in a single message.

- `.ai/plans/archive/feature-acp-write-path-scope.md` — Why: **read this first.** The Addendum created detached bridges and the sidecar pool, which are the reason (2) and (3) above exist. Its "Task 5 findings" header also carries the recurring-enumeration warning that applies to any list in this plan.
- `apps/studio/client/app.jsx` — Why: `notifyDesktop` (202-214), `Notification.requestPermission()` (9627), `handleAssistantFinished` (9637), `handleAssistantAttention` (9659) + `ATTENTION_NOTIFY_COOLDOWN_MS` (115). The existing policy — the "you weren't looking" gate and the cooldown — is good and should be preserved, not re-derived.
- `apps/studio/client/panels/ChatPanel.jsx` — Why: where `onFinished` / `onBusyChange` are raised (1899-1935) and how `busyChats` tracks per-chat state. The client path stays the fast path for the *visible* project.
- `apps/studio/acp/bridge.ts` — Why: `pendingPermissions` / `pendingElicitations` (the `awaiting-input` signal, currently private), and `PERMISSION_TIMEOUT_MS` (120 s — the deadline a notification is racing).
- `apps/studio/acp/running.ts` + `apps/studio/acp/index.ts` (`runningChats()`) — Why: the existing probe registry this extends. Note its comment on why it is a pull, not a pushed snapshot.
- `apps/studio/http.ts` (`/_api/acp/running`, ~1337) — Why: the route to extend, including its `isTrustedRequestHost` gate and its deliberate absence from `CANVAS_SAFE_API` + `startCanvasServer` routes.
- `apps/desktop/src-tauri/src/sidecar.rs` — Why: `SidecarState.instances` (the pool), `has_running_chat` (the existing per-instance probe, incl. its A1 loopback validation), `reap_instances`. The poller is a sibling of `has_running_chat` and must reuse `is_loopback_url` the same way.
- `apps/desktop/src-tauri/src/lib.rs` — Why: plugin registration, `invoke_handler` command list, and where a background task would be spawned.
- `apps/desktop/src-tauri/capabilities/default.json` — Why: a new plugin needs its permission declared here or the command is refused at runtime.

### Files to Create

- `apps/desktop/src-tauri/src/notify.rs` — the native notification command + the pool poller + its transition state.
- `apps/studio/test/acp-activity-endpoint.test.ts` — the activity snapshot's shape + origin gate.

### Design canvases

| Canvas | Status | Tags | Notes |
| --- | --- | --- | --- |
| `ChatPanel` | `handed-off` | — | The panel's approved look. This feature adds **no new in-panel UI** — the unseen badge already exists. Consult only if Task 7 concludes a settings toggle is needed. |

### Patterns to Follow

- **The existing notify policy is the spec.** `!assistantOpenRef.current || document.hidden` and the 30 s cooldown were written for a reason (DDR-185's "stalled turn gives no signal"); port them, don't reinvent them.
- **Loopback validation.** `has_running_chat` in `sidecar.rs` parses `read_server_url`'s result and requires `is_loopback_url` before curling — because `_server.json` is untrusted project content that the write gate auto-approves. The poller does exactly the same, via the same helper. See the `server-json-url-is-untrusted-validate-at-every-consumer` decision in the graph.
- **Dual-allowlist rule.** Any route reachable from the canvas origin must be in BOTH `CANVAS_SAFE_API` and `startCanvasServer`'s `routes`. The activity route must be in **NEITHER**, like `/_api/acp/running` today.

---

## Design Decisions

| Decision | Choice | Why |
| --- | --- | --- |
| Where the notify decision lives | the native shell | the only component that outlives a project's page; the webview cannot see a project it isn't showing, or a detached bridge at all |
| Transport | poll each pooled instance | the shell→instance direction already exists (`has_running_chat`); a push would need a new channel from Bun to Tauri that has no other user |
| Notification body | project name + fixed string, **never** a chat title | a title is model-generated from untrusted project content (DDR-054); a lock-screen surface is the worst place to render it, and cross-project polling would carry it out of its project |
| `awaiting-input` source | `pendingPermissions.size + pendingElicitations.size` | already tracked; the 120 s fail-closed timeout is the deadline the notification exists to beat |
| Visible project | keep the existing client path | it is instant and already correct; the poller is the fallback for what the client cannot see |
| De-dup | fire on TRANSITION, not on state | polling a level would re-notify every tick |
| Cooldown | reuse `ATTENTION_NOTIFY_COOLDOWN_MS` semantics per project | one stuck chat must not become a notification storm |
| Poll interval | slow (≥ 5 s), and only while ≥ 1 instance is non-current | this competes with `git status`; the visible project doesn't need it |

---

## Tasks

Execute in order. Each task is atomic and testable.

### Task 1: MEASURE whether the existing notification ever fires

- **Do**: In the packaged (or `tauri dev`) app, determine `Notification.permission` and whether `new Notification(...)` renders in WKWebView. Then check whether `requestPermission()` at `app.jsx:9627` ever resolves to `granted`. Record the answer.
- **Gotcha**: This is the whole plan's fork. If it works, B/C are an *extension* for the cross-project + detached cases and the client path stays primary. If it never fires, the product has shipped a silent no-op and the shell path is the *only* path — which also means the in-app badge has been the sole signal and should be re-rated. Do not proceed on the type declaration or on what the API "should" do; the previous feature's Task 1 found four such assumptions wrong.
- **Validate**: a written finding in this plan, with the observed values.

**Finding (2026-08-07) — NOT MEASURED; corrected from an earlier wrong claim in this same session.** This session initially believed `cargo`/`rustc` were entirely unavailable (`which cargo rustc` → not found) and executed Tasks 2–8 on that assumption. That was wrong in a narrow but important way: `~/.cargo/bin` existed on disk with a full toolchain, just not on this shell's `PATH`. Once found, `cargo check`, `cargo test --lib`, and `cargo clippy` all ran successfully against the new Rust code (see Task 4/5's updated Validate notes) — so the Rust side of this feature IS compile- and unit-test-verified, not merely "written and hoped." **What genuinely remains unmeasured is the GUI-level question Task 1 asks**: whether `Notification.permission` / `new Notification(...)` behave inside the actual WKWebView at runtime, which needs `tauri dev` or the packaged `.app` running with a real window — not something a headless `cargo check` can observe regardless of toolchain availability. Execution proceeded on the assumption that this measurement comes out unfavorable (WKWebView is widely known not to implement the local-notification path of the Web `Notification` API for embedded content, unlike Safari-the-browser), treating B/C/D as load-bearing rather than a mere extension — **this is still an assumption standing in for the measurement, not the measurement itself.** Task 6 wires both paths (native command under Tauri, `notifyDesktop` fallback on web) so the outcome is correct either way. **Before trusting this feature: run `tauri dev`** (now unblocked — `export PATH="$HOME/.cargo/bin:$PATH"` before `pnpm --filter maude-desktop tauri dev`, or add that directory to the shell profile) or build the packaged `.app`, set a breakpoint or log at `app.jsx:9626-9628`, check `Notification.permission` after `requestPermission()` resolves, and confirm whether `notifyDesktop()` ever actually renders an OS notification. If it turns out to work, re-rate: the client path is primary again and the shell path (B/C) is "only for cross-project + detached", exactly as originally scoped — no code change needed either way, just a note correction here.

### Task 2: EXPOSE awaiting-input on the bridge

- **Do**: Add a read-only accessor for pending permission + elicitation counts on `AcpBridge` (mirroring the existing `get modes` / `get usage` shape). Extend `runningChats()` in `acp/index.ts` into an activity snapshot: per chat `{ chatId, state: 'running' | 'awaiting-input' | 'idle' }`.
- **Pattern**: `acp/running.ts`'s registry is a PULL for the reason its comment gives — keep it that way; a snapshot would be stale by the time the shell read it.
- **Gotcha**: `awaiting-input` must win over `running` — a turn blocked on a prompt is technically still in-flight, and "running" is the less actionable of the two.
- **Validate**: `cd apps/studio && bun test test/acp-activity-endpoint.test.ts`.

### Task 3: EXTEND the activity route

- **Do**: Extend `/_api/acp/running` (or add `/_api/acp/activity` and keep `running` as-is for the reaper) to return the snapshot plus a monotonic `seq`.
- **Gotcha**: Keep the `isTrustedRequestHost` gate and the dual-allowlist ABSENCE. Do not add a chat title, first message, or any transcript content to this payload — see Decision D. If you add a field, ask what it would look like on a lock screen.
- **Validate**: extend `test/canvas-origin-gate.test.ts`'s assertions; new endpoint test.

**Incidental fix found by `bun run typecheck` (2026-08-07):** the new route was first written matching `/_api/acp/running`'s existing shape — a zero-argument arrow function that still referenced `isTrustedRequestHost(req)`. `req` was never a real pre-existing route-table pattern; it turned out `/_api/acp/running` itself has been shipping with this exact bug (`req` undeclared, `Http['routes']` is typed `Record<string, (req: Request) => Response | ...>` in `http.ts`) — a `ReferenceError` waiting to fire the moment either route is actually hit over HTTP (neither route had a real HTTP-level test before now, only source-string checks, which is why `bun test` stayed green while `bun run typecheck` caught it immediately). Fixed both call sites to declare `(req: Request) =>`, in the same commit as this feature since it's a one-line, directly-adjacent, low-risk fix — not part of the plan's scope but too small and too load-bearing (this is a security gate) to leave broken while copying its shape into new code.

### Task 4: ADD the native notification plugin + command

- **Do**: Add `tauri-plugin-notification` to `Cargo.toml`, register it in `lib.rs`, declare its permission in `capabilities/default.json`, and add a `notify` command in a new `notify.rs`.
- **Gotcha**: A missing capability entry fails at runtime, not at compile time — the classic Tauri v2 trap. Verify in the packaged app, not just `tauri dev`; the archived plan's DDR-177 lesson is that `tauri dev` green proves nothing about the `.app`.
- **Validate**: manual — a notification actually appears on macOS.

**Result (2026-08-07):** the command is named `send_notification`, not `notify` — `tauri-plugin-notification` itself already registers an internal command literally called `notify` (`notification:allow-notify` in the build's permission list), and Tauri's build-time ACL check never generated an `allow-notify` permission for an app-level command sharing that bare name with any name tried, so it was renamed to avoid the collision (this was caught by `cargo check`, not by inspection — see below). A second real gotcha beyond the plan's: Tauri v2's per-command permission `.toml` files under `permissions/autogenerated/` are themselves committed source, not ephemeral build output — `cargo build`'s validation step reads them but nothing in a normal `cargo check` run WRITES the file for a brand-new command (the proc-macro side-effect that would generate it never gets to run before build.rs's own validation fails first, for a first-time addition). Hand-authored `permissions/autogenerated/send_notification.toml` mirroring the existing files' exact shape (e.g. `take_pending_deep_link.toml`) to unblock this. After both fixes: `cargo check`, `cargo test --lib notify::` (10/10 pass), and `cargo clippy` (zero warnings) all ran clean in this session — `~/.cargo/bin` turned out to exist on disk despite an earlier `which cargo` miss (not on this shell's `PATH`); see Task 1's corrected finding. **Still not done: the actual "a notification appears on macOS" manual check** — that needs a running window, not just a clean build.

### Task 5: POLL the pool and fire on transitions

- **Do**: In `notify.rs`, a background task that walks `SidecarState.instances`, skips the currently-displayed `project_root`, probes each instance's activity endpoint, and fires a native notification on an `idle→awaiting-input` or `running→idle` transition. Hold last-seen state per (project, chat).
- **Pattern**: reuse `has_running_chat`'s URL handling verbatim — parse, `is_loopback_url`, rebuild from `origin().ascii_serialization()`, `--` before the URL.
- **Gotcha**: `MAX_INSTANCES` is 3, so this is at most 2 non-current instances — keep the interval slow. A wedged instance must not stall the loop (bound the probe like `RUNNING_PROBE_TIMEOUT_MS`). Reaping an instance must clear its state, or a later instance at the same path inherits stale transitions.
- **Validate**: a Rust unit test over the transition function with a scripted state sequence.

**Result (2026-08-07):** `cargo test --lib notify::` — 10/10 pass, covering the transition function (including a deliberate, documented deviation from this task's literal "idle→awaiting-input" wording — see the doc comment on `transition_kind` in `notify.rs`: the real-world case is `running→awaiting-input`, which the literal wording would have missed) plus the sanitize-sink tests added during Task 8's fix. `cargo clippy` — zero warnings.

### Task 6: WIRE the visible project to the same policy

- **Do**: Keep `handleAssistantFinished` / `handleAssistantAttention` as the fast path for the visible project; route them through the native command when running under Tauri, falling back to `notifyDesktop` on web. Preserve the "you weren't looking" gate and the cooldown.
- **Gotcha**: Don't double-notify — the visible project is skipped by the poller (Task 5) precisely so the client owns it. If Task 1 found the web path dead, this becomes the *only* client change that matters.
- **Validate**: manual, both surfaces; a client unit test over the gate + cooldown if they get extracted.

### Task 7: DECIDE whether this needs a settings toggle

- **Do**: Decide (and record) whether notifications need an opt-out in Settings. Look at how `claude_auto_setup` is stored in `prefs.rs` for the existing shape.
- **Gotcha**: Don't add a toggle reflexively — every knob is a support surface. But an OS notification is one of the few things a user may genuinely want off, and macOS's own Notification Center toggle may be sufficient. Argue it either way; do not leave it undecided.
- **Validate**: a one-paragraph decision in this plan.

**Decision (2026-08-07): NO in-app toggle for v1 — rely on macOS's own per-app Notification Center control.** Two reasons, and the second is the load-bearing one. First, the reflexive-knob argument the gotcha already names: `claude_auto_setup`'s shape (`prefs.rs`) would make an `notifications_enabled: bool` cheap to add, but cheap-to-add isn't the bar — it's still a permanent support surface, and the OS already ships the exact control ("turn Maude's notifications off") in a place users already know to look (System Settings ▸ Notifications ▸ Maude), so an in-app duplicate adds a second place the same fact can drift out of sync with. Second, and specific to this feature: **this notification is not purely a convenience — it's the mechanism `awaiting-input` uses to beat `PERMISSION_TIMEOUT_MS`'s 120 s fail-closed deny** (Problem section; Risks section's "notification fatigue is a security failure" makes the same point about the OS level). An in-app "Notifications: off" toggle sitting inside Maude's own settings is a more likely place for a user to flip it once, for an unrelated annoyance (e.g. muting the "Claude finished" ping), and silently lose the awaiting-input escape hatch too — without the friction of leaving the app that the OS-level Notification Center panel provides. If real-world use shows people want to keep "finished" but mute "needs input" (or vice versa), that's a future, evidence-driven addition — not a day-one reflex.

### Task 8: SECURITY fan-out (mandatory)

- **Do**: `security-auditor` + `ethical-hacker` in parallel. Brief specifically on: whether any project-derived string can reach a notification body (Decision D is the whole point); whether the poller can be pointed at a non-loopback host via a poisoned `_server.json` (the A1 class — the fix exists, prove it was reused rather than re-implemented); whether cross-project polling leaks the existence or contents of project B to project A's page; notification flooding as a DoS/annoyance channel; and whether the new endpoint stays off the canvas origin.
- **Gotcha**: On this exact surface, the defender pass returned PASS WITH SUGGESTIONS on a diff containing a CRITICAL RCE; the adversarial pass found it. Both halves, and treat a clean verdict as a hypothesis.
- **Validate**: verdict `PASS` / `PASS WITH SUGGESTIONS`; any CRITICAL → back to execute.

**Result (2026-08-07):** ran in parallel. `security-auditor` → **PASS**, 0 blockers/warnings, 3 sub-floor notes (no CORS header on `/_api/acp/activity` — harmless, matches the pre-existing `/_api/acp/running` posture; a one-tick race where a just-switched-to project can be polled once more; `notify`'s freeform title/body has no sink-side validation). `ethical-hacker` → the pattern held again: **1 HIGH chained finding**, exactly the kind the gotcha warns a clean defender pass can miss.

- **HIGH — fabricated-activity notification flood, chained into a security-control-disabling social-engineering path.** `notify.rs`'s poller re-trusts `_server.json` fresh on every tick with only `is_loopback_url` (proves "loopback", not "ours"). A compromised project (prompt-injected write, poisoned clone — `_server.json` is an in-project write the write-scope gate already auto-approves) can run its own loopback responder and answer the activity probe with a scripted, ever-alternating state. The 30 s cooldown bounds RATE, not COUNT, so this can page the user indefinitely — with a genuinely truthful project name (Decision D's content rule held; the finding is about *frequency*, not *content*). Chained consequence: a user who mutes Maude's notifications system-wide to stop the noise (the exact remedy Task 7 pointed people at) also loses the real `awaiting-input` signal, i.e. the attack can be used to talk a user into disabling the fail-closed timeout's own escape hatch. Also chains with the pre-existing (separately-accepted, not part of this diff) `has_running_chat` pattern in `sidecar.rs`, which trusts the same file to decide pool eviction — a fake responder can pin itself in the 3-slot pool too.
  - **Fixed now:** a lifetime cap (`MAX_NOTIFICATIONS_PER_PROJECT_SESSION = 20`, `notify.rs`) independent of the 30 s cooldown — turns "indefinite" into "bounded per project per app session"; `last_seen` still updates past the cap so the in-app badge stays accurate, only the OS ping is withheld. Also added sink-side sanitization (length cap + control-character strip) on the `notify` command for the LOW finding, as cheap defense-in-depth against a not-yet-found XSS in the main webview.
  - **NOT fixed — named open item, tracked for a follow-up:** the real fix is authenticating the poller's target at SPAWN time (the app recording the port/token it launched its OWN dev-server with, rather than re-reading an untrusted file every tick) instead of a session cap. Out of scope for this pass because it also touches `has_running_chat`'s identical, separately-shipped-and-accepted pattern in `sidecar.rs` — fixing one consumer and not the other would be inconsistent, and fixing both is a bigger architectural change than this feature's plan sized for. Tracked in Follow-ups below.

**Second round (2026-08-07, `/flow:done` Step 4 re-review) — the mitigation above had two real gaps, both fixed, not just noted this time.** A closing security-auditor + ethical-hacker + code-simplifier fan-out re-reviewed the full diff including the Task 8 mitigation itself. `security-auditor` → PASS. `ethical-hacker` → **2 blockers**, both confirmed real on inspection:

1. **Cap-defeat via pool churn.** `clear_project` reset `notified_count` on EVERY call, including from `shutdown_instance` — which `reap_instances` drives using `has_running_chat`'s answer, read from the SAME untrusted `_server.json` the whole finding is about (its own doc comment: "any failure ⇒ evictable"). A compromised project could pump toward the cap, answer one probe "idle" to get reaped (wiping its count), get reopened on the user's next ordinary project switch, repeat — turning "bounded per project per app session" into "bounded per pool-membership epoch, attacker-controlled." **Fixed:** split into `clear_project_reaped` (clears only `last_seen`, the correctness-required part — called from `shutdown_instance`, the attacker-timeable path) and `clear_project_fully` (clears everything including the notification budget — called only from the `MAX_RESTARTS` supervisor-giveup path, which requires actually crash-looping the trusted process 3+ times, not just answering one HTTP probe).
2. **The `send_notification` command had no cap of its own.** `MAX_NOTIFICATIONS_PER_PROJECT_SESSION` was enforced only inside `poll_one` — the command itself (reachable from any main-webview JS, including a hypothetical future XSS, which is the exact threat model `sanitize_notify_field` already treats as plausible) had zero rate limit, only content sanitization. **Fixed:** added a dedicated `command_notify: Mutex<(Option<Instant>, u32)>` bucket, checked/incremented at the top of the `send_notification` command, using the same cooldown/cap constants — a single shared bucket is correct here because only one project is ever visible at a time (this command exists only for that one).

Re-verified after both fixes: `cargo check` / `cargo test --lib notify::` (still 10/10) / `cargo clippy` all clean. `code-simplifier`'s only suggestion (merging `last_notified`+`notified_count` into one map) was left as optional polish, not applied, since a security review was reading those exact files at the time.

---

## Validation

1. **Static + tests**: `pnpm lint`, `pnpm test`, `pnpm test:dev-server`, `cargo check` + `cargo clippy`
2. **Unit**: the activity snapshot shape; the transition function
3. **Origin gate**: the new route in NEITHER allowlist (`canvas-origin-gate.test.ts`)
4. **Security**: the mandatory fan-out (Task 8)
5. **Manual, packaged `.app` — not `tauri dev`**:
   - long turn in project A → switch to B → notification when A finishes
   - permission prompt raised in A while viewing B → notification, and it arrives well inside the 120 s fail-closed window
   - app in background / window minimised
   - no notification for the project you're looking at with the panel open (the "you weren't looking" gate)
6. **Regression**: `dist/` rebuilt release-minified if any client source changed — a full `bun test` clobbers it (confirmed twice)

## Risks

- **Task 1 may invalidate the framing.** If the web path works, this is smaller than it looks. If it doesn't, a shipped feature has been silently dead and that deserves its own note.
- **A new Tauri plugin is a real dependency**, and this repo's release surface is signed + auto-updating (DDR-126). It also needs a capability entry that fails at *runtime* — verify in the packaged app.
- **Notification content is an egress channel.** Decision D exists because the obvious, friendly implementation ("Claude finished: *<chat title>*") is the insecure one. Any reviewer who suggests adding the title should be pointed at DDR-054.
- **Polling competes with `git status`.** The fs-watcher already shells out per canvas write; a tight poll loop across instances would add to that. Slow interval, bounded probe.
- **Notification fatigue is a security failure**, the same argument as prompt fatigue in the previous feature: a user who mutes Maude's notifications loses the `awaiting-input` signal that exists to beat a fail-closed timeout.
- **Concurrent sessions on `~/git`** — stage only this feature's files; `scripts/check-import-coherence.sh` is a release gate and fires on an untracked new module.

## Follow-ups (out of scope, recorded)

- A **badge on the project switcher** ("this project is busy") — the visual sibling of this feature, discussed 2026-08-07. Cheap once the activity endpoint exists.
- The archived plan's open items are unaffected but adjacent: LOW-1 (`MAX_BRIDGES` exhaustible), LOW-3 (`/_api/git/status` has no host guard), the F5 re-rate.
- **NAMED OPEN ITEM (ethical-hacker, 2026-08-07, HIGH, mitigated not fixed — see Task 8):** `_server.json`-based liveness/activity checks trust an untrusted, in-project file with no spawn-time authentication. Affects TWO consumers: `notify.rs::poll_one` (this feature) and `sidecar.rs::has_running_chat` (pre-existing, feature-acp-write-path-scope Addendum, separately shipped and accepted). A compromised project can run its own loopback responder to (a) spoof activity and page the user indefinitely — mitigated here with a per-session notification cap, not fixed — and (b) pin itself in the 3-slot sidecar pool by never reading as idle — not mitigated at all. Real fix: have the app itself authenticate what it's talking to at spawn time (record the port it launched its own dev-server on, or mint a per-boot token the dev-server must echo back) instead of re-trusting a freshly re-read file every probe. Sized as its own follow-up plan — it touches two features' worth of code and the two consumers should be fixed together, not piecemeal.

## Acceptance Criteria

- [ ] Task 1's measurement recorded before any other task starts
- [ ] A turn finishing in a NON-visible project produces a notification — implemented (`notify.rs::poll_one`, `running→idle`) and compiles/unit-tests clean (`cargo test --lib notify::`); **NOT manually verified against a real running window** (this environment can run `cargo` but not a GUI/WKWebView session)
- [ ] A permission prompt / elicitation in a non-visible project produces a notification, inside the 120 s fail-closed window — implemented (any→awaiting-input, see `notify.rs`'s documented deviation from the plan's literal wording), unit-tested; **NOT manually verified**
- [ ] A detached chat (no socket attached) still produces both — implemented (the poller reads the pool's bridges regardless of socket attachment — `activitySnapshot()` has no attached-only filter); **NOT manually verified**
- [ ] No notification for the visible project while the panel is open and focused — implemented (poller skips `project_root`; client keeps the existing `!assistantOpenRef.current || document.hidden` gate); **NOT manually verified**
- [x] No chat title, message text, or transcript content in any notification body — asserted by a test, not by inspection (`acp-activity-endpoint.test.ts`)
- [x] The activity route is in NEITHER `CANVAS_SAFE_API` nor `startCanvasServer`'s routes (asserted by test)
- [x] The poller validates `_server.json`'s URL with `is_loopback_url` (reused, not re-implemented) — confirmed independently by both security-auditor and ethical-hacker
- [x] Security fan-out run; findings fixed or recorded as named open items (see Task 8's Result + Follow-ups)
- [ ] Verified in the PACKAGED `.app`, not only `tauri dev` — **NOT DONE.** `cargo check` / `cargo test` / `cargo clippy` all pass (`export PATH="$HOME/.cargo/bin:$PATH"` first — see Task 1's corrected finding), but nothing in this session opened an actual window. Run `tauri dev` first, then a full `tauri build`, and re-check every unchecked box above by hand before trusting this feature.

## Retro

- **A two-round security fan-out earned its keep, again.** The first Task 8 pass caught a real HIGH (unbounded notification flood via an untrusted `_server.json`) and it was mitigated with a session cap. The `/flow:done` closing re-review — spawned specifically because the mitigation code itself hadn't been reviewed — found the mitigation had two real gaps (the cap could be reset via a normal pool-eviction cycle the attacker could steer, and the command surface had no cap of its own at all). Neither gap was hypothetical; both were fixed. **Lesson for future plans: when a security fan-out produces a code change (not just a decision), that change needs its OWN review pass before the feature is considered closed — reviewing the mitigation is not optional just because the original finding was already addressed once.**
- **`which cargo` is not sufficient evidence a toolchain is absent.** This session spent the first several tasks operating on the wrong assumption that Rust tooling was completely unavailable, when `~/.cargo/bin` simply wasn't on `PATH`. Once found, `cargo check`/`test`/`clippy` caught two real bugs (a `req`-referencing `ReferenceError` in `/_api/acp/running`, and a Tauri command-name collision) that would otherwise have shipped unverified. **Check `~/.cargo/bin`, `~/.rustup`, etc. explicitly before concluding a toolchain is unavailable — recorded as a path-scoped rule in `.claude/rules/tauri-desktop.md` isn't the right fix for this one since it's an environment fact, not a codebase fact, but future sessions on this plan's lineage should know to check.**
- **Concurrent Syncthing-tree sessions are a real, not theoretical, risk — twice in one `/flow:done` run.** `apps/studio/dist/*` got clobbered by another live session's dev-server boot (not by anything this session ran) between the code-review fan-out and the commit step, and unrelated files from a second concurrently-developed feature (`feature-cloud-connect-honest-status`) were interleaved in `git status` by the time of staging. Both were caught by checking `git status` immediately before staging, not by assuming the tree was quiet. **This is the exact risk CLAUDE.md's "Concurrent sessions on `~/git`" section already names — worth treating as load-bearing, not boilerplate, on every `/flow:execute`/`/flow:done` pass in this repo.**
- **What worked well:** the plan's own "measure first" framing for Task 1 kept the fork honest even when the measurement itself couldn't be performed (no GUI in this environment) — the plan now says so explicitly instead of silently assuming success, and Task 6's dual-path (native + web-fallback) design meant the unmeasured assumption didn't block correct behavior either way.
- **What to change next time:** a plan this security-sensitive (new OS-level egress channel) could name "review the mitigation, not just the finding" as an explicit Task 8 sub-step up front, rather than relying on `/flow:done`'s generic closing fan-out to catch it after the fact.
