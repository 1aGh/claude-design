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
- **Explicitly NOT in scope:** `Read` / `Grep` / `Glob` stay unscoped. This closes **write** egress, not read. Saying so out loud matters — it would be easy to read this plan as closing the trifecta, and it does not.

## Metadata

- **Type**: Security hardening
- **Complexity**: Medium
- **App/Package**: `apps/studio` (`acp/bridge.ts`, client prompt copy), tests
- **Affected Systems**: ACP permission surface (DDR-179 / 180 / 184 / 185 lineage)
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

## Validation

1. **Static + tests**: `pnpm lint`, `pnpm test`, `pnpm test:dev-server`
2. **Unit**: the path-gate cases from Task 3 (the escape shapes are the point of this change)
3. **Regression**: in-project editing still prompt-free — DDR-184's whole reason for the allow-list
4. **Security**: mandatory fan-out (Task 6)
5. **E2E**: ACP desktop suite
6. **Manual**: ask the panel to write outside the project and confirm the prompt names the resolved path

## Risks

- **A scoped Write beside an unscoped helper is theatre.** Task 5 exists to find that before the DDR claims a property the system does not have.
- **TOCTOU**: we resolve, the CLI writes moments later; a symlink swapped in between defeats the check. Probably acceptable (it needs local code execution already) — but state it in the DDR rather than let a reader assume it was considered.
- **Prompt fatigue.** If a normal workflow writes outside the project more often than expected, people will click through. Task 1's evidence should tell us the real rate before shipping; if it is high, the scope rule is wrong, not the users.
- **Windows path comparison** is not POSIX — case-insensitivity and short names are a real bypass class, and this repo ships a Windows build.
- **Concurrent sessions on `~/git`** — stage only this feature's files; `scripts/check-import-coherence.sh` is a release gate.

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
