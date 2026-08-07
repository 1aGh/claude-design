# Feature: cloud connect tells the truth, live

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports. **Phase 1 is a prerequisite for Phase 2 and must not be skipped** — rendering the current signal faster only makes a wrong answer more convincing.

## Description

Connecting a Maude Cloud project gives the user no usable feedback. The confirm
dialog closes at the exact moment work begins, and a single static sentence
takes its place and never changes. Underneath it, the status signal it would
render is optimistic by construction: the monitor is born `online`, one connected
provider out of seventy-five reads as "synced", and the count that constitutes
real proof is never consulted by any surface.

This makes the connect outcome honest at the source, then makes the existing
sentence live so the user watches it move from *connecting* to *synced* — and, in
every failure state, is told what to do next.

## User Story

As someone opening a cloud project in Maude Desktop, I want to see what is
actually happening and be told plainly whether it worked, so that I am never left
guessing whether to wait, retry, or go looking for my canvases.

## Problem

**The dialog disappears when the user most needs it.** `CloudBar.jsx:412`
`connectPending()` runs `setPending(null)` — closing the modal — and then
`setNote(connectOutcomeNote(...))`, a static sentence in the rail. The user
confirms, the surface vanishes, one line appears, nothing ever updates it.

**The sentence reports an intention as a result.** `supervisor.ts:147` returns
`{ syncing: true, canvases }` as soon as `runtime.start()` did not throw and at
least one local canvas is eligible. It is not evidence of a socket, an accepted
token, or a byte moved.

**The signal it would render is optimistic, in four separate ways** — all
verified in code, not inferred:

| Defect | Evidence |
| --- | --- |
| Monitor is born online | `connection-state.ts:113` — `let state: SyncState = 'online'` |
| One connected provider ⇒ "online" | `aggregate()` returns `'connected'` on the first match; 1 of 75 connected + 74 auth-rejected still reads green |
| `docs.synced` can only rise | the four `noteDocState` sites (`index.ts:636/652/732/864`) never demote `connected`; a provider disconnect does not touch `docStates` |
| The status bar ignores the only honest field | `syncSlot` (`app.jsx:4581-4607`) references `docs` **zero** times; it keys on the optimistic `state` |

**And `remoteGap` names documents the user already has.** Introduced in
`231ead01`: `remoteDiff` is computed *before* the pull (`index.ts:444`) and
recorded *after* it (`index.ts:1028`), so post-pull `hubOnly` enumerates exactly
the documents that just arrived. Reproduced live — `_sync.json` reads
`remoteGap.hubOnly: ["ui-aaa","ui-hello"]` with both files on disk.

The consequence, in the user's words: *"vyskočí modal, pak vidím jen syncing
canvases, ale reálně se nic nestane."*

## Solution

Two phases, in order.

**Phase 1 — make the signal honest.** Seed the monitor as not-yet-connected;
let `docs.synced` fall when a provider drops; fix `remoteGap` to mean what its
name says (or rename it to what it records); make the status bar read `docs`
before `state`. This is the precondition: every surface downstream inherits
whatever this pipeline says.

**Phase 2 — make the existing sentence live.** Drill the already-wired
`sync:status` payload into `CloudBar` and derive the note from
`docs.{synced,pending,rejected}` — the only fields set by a real handshake. No
new surface, no new bus consumer, no polling. The transition *Connecting… →
Syncing 72 of 75 → Synced · 3 pulled down* **is** the feedback that is missing.

**Rejected — a dedicated Connect Run sheet** (persisted job record, per-document
ledger, confirmed round trip). A strong design and the right model if this
recurs, but it adds a fourth consumer to a payload whose three existing readers
already disagree, and every client edit taxes the committed bundle. Revisit if
≥2 fresh reports arrive after the honest note ships, or if first-arrival on an
empty folder proves to need its own surface. The reasoning is preserved in the
debate record so a future attempt starts from it rather than re-deriving it.

## Metadata

- **Type**: Bug Fix + Enhancement
- **Complexity**: Medium
- **App/Package**: `apps/studio`
- **Affected Systems**: sync status pipeline (`connection-state`, `status`,
  `supervisor`), cloud attach lane, studio client (CloudBar + status bar)
- **Dependencies**: none new

---

## Context References

### Must-Read Files

> Read all of these in parallel in one message during `/flow:execute`.

- `apps/studio/sync/connection-state.ts` (lines 100-200, 260-290) — Why: the monitor. `state` seed, `aggregate()`, `docStates`, `snapshot()`, and the `setRemoteGap` added in `231ead01`.
- `apps/studio/sync/index.ts` (lines 421-470, 630-740, 990-1030) — Why: the boot sequence, the four `noteDocState` sites, the summary that computes the settled truth and logs it, and where `remoteDiff` is computed vs recorded.
- `apps/studio/sync/supervisor.ts` (lines 105-150) — Why: `boot()` returns `{ syncing: true, canvases }` before any handshake settles.
- `apps/studio/sync/status.ts` — Why: the `_sync.json` writer + `sync:status` broadcaster; its header names the sanctioned readers.
- `apps/studio/cloud/endpoints.ts` (lines 395-450) — Why: the attach lane that carries `sync` to the client, and the `note` fallback for older clients.
- `apps/studio/client/panels/CloudBar.jsx` (lines 250-290, 405-445, 560-600) — Why: `connectOutcomeNote`, `connectPending()` (the modal-closes-then-static-note sequence), and the deep-link dialog chrome.
- `apps/studio/client/app.jsx` (lines 4556-4610, 9330-9340, 10950-10960) — Why: `syncSlot` (ignores `docs`), the `syncStatus` state, and the `sync:status` WS handler that already delivers live payloads.

### Files to Create

- `apps/studio/test/cloud-connect-note.test.ts` — the note's state machine, one case per user-visible state.

### Design canvases

| Canvas | Status | Tags | Notes |
| --- | --- | --- | --- |
| `.design/ui/Cloud Self Service.tsx` | `draft` | cloud, self-service, user-flow, onboarding | The connect/launch flow. Draft, so advisory rather than authoritative — do not treat its copy as approved. |

### Patterns to Follow

- **Pure function + thin render.** `connectOutcomeNote` is already exported and
  already the seam (`CloudBar.jsx:264`). All new decision logic goes there so it
  is testable under `bun:test` without touching the bundle.
- **Absent fields are the normal case.** `docs` / `rejectedSlugs` / `remoteGap`
  are optional in `SyncStatusSnapshot` (pre-DDR-102 payloads lack them). Every
  new read must survive `undefined` — the CLI and the browser banner read the
  same payload.
- **Hub strings are untrusted (DDR-054).** Document names and rejection reasons
  originate at the hub. `connection-state.ts` says "Treat as text, never HTML"
  twice; keep counts first in any sentence so a hostile name cannot dominate it,
  and cap what is rendered.

---

## Design Decisions

No new components. One existing sentence gains states, and each names the next
action — the user's explicit requirement.

### States and copy

| State | Condition (from the live payload) | Text | What to do next |
| --- | --- | --- | --- |
| Connecting | `docs.synced === 0 && docs.pending > 0` | `Connecting to <project>…` | (nothing — it is working) |
| Syncing | `docs.synced > 0 && docs.pending > 0` | `Syncing with <project> — <synced> of <total>` | (nothing) |
| Synced | `docs.pending === 0 && docs.rejected === 0` | `Synced with <project>` + `· <n> pulled down` when the run brought canvases | Open one of the arrived canvases |
| Some refused | `docs.rejected > 0` | `<n> of <total> canvases refused by <project>` | Reconnect — the credential may have been rotated; names in the tooltip |
| Unreachable | `state === 'offline'` | `<project> is unreachable — your edits are queued` | Nothing to do; it resumes by itself |
| Nothing syncable | `notSyncable` | keep today's copy (already honest) | Create a canvas |

### Tokens / iconography

Reuse the rail's existing note styling and the status bar's dot tones. No new
tokens, no new icons.

---

## Tasks

Execute in order. Tasks 1-5 are Phase 1 and must land before Task 6.

### Task 1: ADD the falsifier test — a failing connect must not read as synced

- **Do**: In `apps/studio/test/`, assert the payload at t=0 of a connect whose providers never connect (or are auth-rejected) does NOT read as synced under the rule any surface would use. Write it against today's code and **expect it to fail** — it is the proof the pipeline is optimistic.
- **Gotcha**: if it passes today, Tasks 2-4 are unnecessary and the plan shrinks — say so rather than "fixing" what is not broken.
- **Validate**: `cd apps/studio && bun test test/<name>.test.ts` — red for the documented reason.

### Task 2: UPDATE the monitor so it is not born connected

- **Do**: `connection-state.ts:113` — seed `state` as `'connecting'` (or an explicit never-connected value) rather than `'online'`. Audit every reader for what the new initial value means to them.
- **Gotcha**: `app.jsx:4590` treats anything not-`online` as offline-ish; check the status bar does not now flash "offline" on every boot of a healthy project. Solo (unlinked) projects must be unaffected — they never mount the monitor.
- **Validate**: Task 1's test moves toward green; `bun test test/sync-connection-state.test.ts` stays green.

### Task 3: UPDATE `docs.synced` so it can fall

- **Do**: Demote a `connected` doc back to `pending` when its provider disconnects (`noteProviderStatus`, or the per-doc equivalent). Today nothing does, so a hub that dies leaves `75/75` frozen forever.
- **Pattern**: mirror the existing `noteDocState` transitions; keep `auth-rejected` sticky (a rejection is not a transient).
- **Validate**: a test that connects N docs, drops the provider, and asserts `docs.synced` falls.

### Task 4: FIX `remoteGap` to mean what it says

- **Do**: `index.ts:1028` records the **pre-pull** diff, so `hubOnly` lists documents that have since arrived. Either re-derive the diff after the pull (it will be empty — everything is pulled now) or rename the field to what it truly records, e.g. `pulled: string[]`. Prefer the rename: "what arrived this run" is the useful fact and the Synced state wants it.
- **Gotcha**: `setRemoteGap` caps at 20 names (hub-controlled payload size) — preserve that whichever way it goes.
- **Validate**: on the pull fixture, `_sync.json` must not name a file that exists on disk. Reproduce with the scratch project used in the RCA.

### Task 5: UPDATE the status bar to read `docs` before `state`

- **Do**: `app.jsx` `syncSlot` (4581-4607) currently references `docs` zero times. Derive the dot and label from `docs.{synced,pending,rejected}` first, falling back to `state` when `docs` is absent (older payloads).
- **Gotcha**: this is the surface `connectOutcomeNote`'s hover text points at. If it keeps lying, Phase 2 sends the user to a second wrong answer.
- **Validate**: `pnpm lint`; the status bar renders correctly in a browser against a hub that refuses auth.

### Task 6: UPDATE `connectOutcomeNote` to take the live payload

- **Do**: extend the signature to `connectOutcomeNote(project, sync, live)`. When `live` is present it wins over the attach response; derive the states from the Design Decisions table. Keep the existing no-supervisor / nothing-syncable branches. Pure function — no React.
- **Gotcha**: `live` is absent on first render and on older payloads; every branch must survive `undefined`.
- **Validate**: `apps/studio/test/cloud-connect-note.test.ts` — one case per row of the table, including the undefined-payload fallback.

### Task 7: WIRE the live payload into CloudBar

- **Do**: prop-drill `syncStatus` (already App state at `app.jsx:9334`, already passed to `StatusBar`) through `Sidebar` into `CloudBar`, and pass it to `connectOutcomeNote`. The note re-renders as the payload changes — that is the whole liveness mechanism.
- **Gotcha**: no polling and no new fetch. The WS handler and the mount backfill already deliver.
- **Validate**: `pnpm lint`; note transitions observed live against the local cell harness.

### Task 8: REBUILD the committed client bundle — last, and once

- **Do**: `git status apps/studio/dist/` → `cd apps/studio && MAUDE_SKIP_RUNTIME_BUILD=1 bun run build.ts --release` → `git status apps/studio/dist/` again. Only `client.bundle.js` (and `styles.css` if CSS changed) may differ.
- **Gotcha**: **never run `bun test` from the repo root** — it clobbered `dist/` with multi-MB dev bundles three times in one session. Run studio tests with `cd apps/studio` first. What is committed is what ships.
- **Validate**: bundle size in the release range (~2 MB, not ~14 MB); the app boots and the note renders.

---

## Validation

1. **Lint**: `pnpm lint`
2. **Tests**: `cd apps/studio && bun test` (never from the repo root) + `node --test apps/hub/test/*.test.mjs`
3. **Build**: `pnpm --filter @maude/site build`
4. **Live, against the local cell harness** — the states curl cannot prove:
   - a healthy connect walks Connecting → Syncing → Synced
   - a connect against a hub with a bad token ends in the refused state, naming a count
   - a connect against a stopped hub ends in unreachable, not a cheerful "syncing"
   - the status bar and the note agree at every step
5. **A11y**: the note is a live region — a screen reader must hear the transition, not just the final text.

---

## Scenario Coverage

`apps/desktop/e2e/scenarios/cloud-attach.e2e.ts` already covers sign-in, the
picker, the deep-link decision and the mismatch warnings (6 cases, stubbed
control plane). **Extend it** rather than writing a new scenario:

| Scenario | Covers | Status |
| --- | --- | --- |
| `cloud-attach` case 7 | after Connect, the note reaches a terminal state (not the static sentence) | 🆕 new case |
| `cloud-attach` case 8 | a refused connect ends visibly refused with a next action | 🆕 new case |

---

## Acceptance Criteria

- [x] All tasks completed (1–8)
- [x] Task 1's falsifier is green **because the pipeline changed** — it was red on 3 of 5 cases against the pre-fix monitor, for the two documented reasons, and no assertion was softened
- [x] `_sync.json` never names a document that exists on disk — `remoteGap` is now `pulled` ("what arrived this run"), recorded from the pull targets rather than the pre-pull diff
- [x] The status bar and the connect note never disagree — both call the one exported `syncPresentation`, so agreement is structural
- [x] Every state in the Design Decisions table names a next action (or says explicitly there is none); asserted per-row in `sync-presentation.test.ts`
- [x] `dist/` diff contains only the intended artifacts — `client.bundle.js` alone, 2,000,926 B, checked before and after
- [x] Lint clean (0 errors); affected tests green
- [x] Recorded as **DDR-214**, including the rejected Connect Run design with its reasoning

### Found while executing (outside the plan)

- **The `dist/` clobber has a root cause, and it is fixed.** `test/bundle-smoke.test.ts`
  shelled out to `build.ts` in DEV mode and wrote its 14 MB unminified output straight
  over the committed 2 MB release artifacts. Not a server boot, not the repo-root/subdir
  distinction the plan's Task 8 gotcha assumed — CLAUDE.md carried it as "root cause
  unconfirmed". `build.ts` now honours `MAUDE_DIST_DIR` (unset everywhere real), and the
  test builds into a tmpdir. Verified: a full suite run no longer touches `dist/`.

---

## Retro

- **The falsifier paid for itself immediately.** Task 1 was red on 3 of 5 cases against
  the pre-fix monitor, which converted "the modal feels vague" from a UI complaint into
  a measured defect in the pipeline. Without it the obvious move was a progress bar over
  a signal that was wrong — the breaker's line, *"a live, animated, more-credible wrong
  sentence."* Worth making the opening falsifier a standing shape for any "the UI is
  unclear" report.

- **Two surfaces reading one payload with two rules will always drift.** The status bar
  and the connect note each had their own mapping and each was wrong differently — and
  the note's hover text pointed at the status bar for "the real answer". Extracting
  `syncPresentation` made agreement structural instead of a thing two files remember.
  The plan asked for the two to agree; a shared rule is the only version of that which
  survives the next edit.

- **The `dist/` clobber had a cause, and the plan's own gotcha was pointing the wrong
  way.** Task 8 warned "never run `bun test` from the repo root". It was never about the
  directory: `test/bundle-smoke.test.ts` shelled out to `build.ts` in dev mode and wrote
  14 MB over the committed 2 MB release artifacts. CLAUDE.md had carried it as "root
  cause unconfirmed" through several releases. **Lesson for `/plan`: a gotcha stated as a
  ritual ("don't run X from Y") is a signal the cause is unknown — treat it as a lead to
  chase, not a rule to obey.**

- **A concurrent session committed this work's in-flight files.** `app.jsx` and the e2e
  scenario were swept into another session's commit while `presentation.ts` stayed
  untracked, leaving `main` with an import to a file no clean clone has. Exactly the
  hazard CLAUDE.md documents — and `check-import-coherence.sh` reported OK through it,
  so the gate has a hole (it did not catch a tracked `.jsx` importing an untracked
  `.ts`). **Follow-up worth its own task: widen that script, because it is the one thing
  standing between this class of accident and a broken tag.**

- **Baseline before blaming.** Nine suite failures looked alarming; stashing the change
  and re-running proved `exporters/jobs` fails without it, and the rest were 5s timeouts
  under a loaded machine that pass in isolation. Two were genuinely mine (stale copy
  assertions). Cheap check, and it is the second time this session that assuming
  "pre-existing" would have been wrong in one direction or the other.
