# Phase 30 — Native Maude: Branch-scoped live multiplayer + editing presence + hub realignment

> **RE-PLANNED 2026-06-19** (during `/flow:execute`, in dialogue with the user). The original plan was built around **artboard locking** (per-canvas single-writer lock with a 30 s lease, attributed takeover, stale-lock UX). That mechanism is **superseded** — the user explicitly does **not** want a lock model (*"žádný komplikovaný lock edit nechci"*). Three findings during discovery collapsed the scope:
>
> 1. **Live TSX co-visibility is already shipped** — the canvas `.tsx` body already syncs cross-machine over the hub, **default-on for linked projects** (DDR-079 / Phase 9.1). So *"when one edits, the other sees it"* is largely **done**; this phase **verifies + surfaces** it, it does not build it.
> 2. **The only real gap is a cross-machine "editing now" signal.** `ai-activity` (agent-is-editing, DDR-078) exists but is **loopback-only** — it never crosses the hub. Humans have **no** "I'm editing" state at all. The net-new work is a lightweight **soft editing-presence** field that rides the existing hub-crossing awareness channel.
> 3. **New-canvas propagation collapses to branch-scoping + get-latest** — no new project-level hub transport is needed (the original Task 4's hardest piece).
>
> Discovery also confirmed every path in the original plan was **stale**: `plugins/design/dev-server/` → **`apps/studio/`** and `plugins/design/hub/src/admin/` → **`apps/hub/src/admin/`** (DDR-095). The hub-admin gz budget is **28 KB** (`apps/hub/test/admin-size.test.mjs`), not the originally-stated 15 KB.

Read DDR-054, DDR-063, DDR-064, DDR-072, DDR-078, DDR-079 and `.ai/docs/collab-model-design.md` before touching any sync/collab code. The **no-break exhaustive verify** posture applies (per `feedback-no-break-exhaustive-verify` memory) — this is security-critical (peer-code execution + a new awareness field over a semi-trusted hub).

---

## Model (what a non-technical user must understand)

> **Two rules. Everything else is the app's job.**

**Rule 1 — You see only your branch.** The canvas tree shows the canvases (and specimens) that exist **on your current branch, on your disk**. Git already enforces this — we just must **not** override it. No cross-branch tree items (not even disabled/greyed). A teammate working on a different draft is simply not in your tree; you coordinate verbally ("podívej se na draft Redesign") and switch with the existing RepoBranchSwitcher (phase-29).

**Rule 2 — Multiplayer = same branch.** To see each other's **cursors**, and to live-collaborate **annotations + comments + the TSX body**, both users must be on the **same branch**. Same branch ⇒ you're in the room together; different branch ⇒ you don't see each other at all.

**Consequence — editing.** On the **same HEAD**, both may edit. Conflict is structurally impossible while you're live together (the Yjs layer keeps both working trees converged for annotations/comments; the TSX body streams over the hub within ~1 s of each edit). Humans don't hand-type raw TSX — edits flow through the **CSS-layer inspector** or **`/design:edit`** (the agent), so there's no two-cursors-into-one-code-line garbage-merge risk. The soft editing-presence signal (below) discourages two people from kicking off conflicting edits at the same moment; it is **a heads-up, not a wall**.

**Consequence — commit/push is social.** Both peers see the live TSX change and both see the file as "changed" in their Changes panel. They **agree among themselves** who Saves/Publishes — *"stejně jako developeři"*. That's the accepted tradeoff for running on git.

**Consequence — new canvas.** A new canvas created by Anna reaches Bob via **"Get latest"** (creating/saving moves HEAD forward → the phase-28 get-latest nudge fires). No live cross-machine list push, no new hub channel. Same-machine multi-tab refreshes instantly via the loopback inspector bus.

---

## What's already shipped vs. net-new

| Area | State (verified 2026-06-19) | What phase-30 does |
| --- | --- | --- |
| Yjs presence, cursors, viewport | ✅ Shipped (Phase 8), **crosses hub** via `awareness-bridge.ts` | Reuse — add ONE field |
| Annotations + comments live sync | ✅ Shipped (Phase 8/9), crosses hub | Reuse — netýká se |
| **Live TSX body sync cross-machine** | ✅ **Shipped, default-on for linked** (DDR-079 / Phase 9.1). `.tsx` → fs.watch → Y.Text → Hocuspocus → peer disk → iframe reload (~800 ms / ~1 s after each edit). Gated by canvas-origin split (`MAUDE_CANVAS_ORIGIN_SPLIT`, default ON) + per-canvas/project `syncTsx` (default ON). F1 peer-code-exec CRITICAL→MEDIUM (DDR-063). | **Verify** the round-trip + **re-audit F1**; do NOT rebuild |
| Hub + linked mode | ✅ Shipped (Phase 9) | Reuse |
| Agent-is-editing signal (`ai-activity`, DDR-078) | ⚠️ Exists but **loopback-only** — never crosses the hub (`ctx.bus.emit('ai-activity')` → inspector WS only) | **Net-new:** surface it cross-machine via awareness |
| **Human "editing now" signal** | ❌ Does not exist | **Net-new:** soft `editing` awareness field |
| Cross-branch tree behaviour | ⚠️ Git hides other branches' files by default | **Confirm we don't override it** (branch-scoped visibility) |
| Hub admin UI | ⚠️ Exists, flat global doc list (`apps/hub/src/admin/`, vanilla JS + maude DS) | **Refactor** to repo/branch context |

---

## Description

This phase ships the **branch-scoped live-multiplayer model** above. Concretely, it adds the one missing primitive — a **soft, cross-machine "editing now" presence** (humans + agents) on the existing per-canvas Yjs awareness channel — surfaces the **already-shipped** live TSX sync, hardens the **branch-scoped visibility** rule, simplifies new-canvas propagation to **get-latest**, and realigns the **hub admin** to a single repo/branch context.

**Phase milestone:** Two users on the same hub session, **on the same branch**, see each other's cursors, annotations, comments — and now each other's **TSX edits** — live. When one is editing a canvas (via the CSS inspector or `/design:edit`/agent), the other sees a soft **"Anna is editing · agent is editing"** badge and is gently steered away from a colliding edit (no lock, no takeover). On a different branch they simply don't see each other; they switch branches to collaborate. A new canvas arrives via **Get latest**.

## User Story

> As a non-technical collaborator, I want to be **in the same draft** as my teammate and see their cursor, their live annotations, and their canvas changes as they happen — and a gentle "someone's editing this" cue so we don't step on each other — exactly like Figma, but honest about the fact it's backed by git (we agree who saves).

## Problem

Live presence, annotations, comments, **and the TSX body** already sync over the hub. But:

1. There's **no signal that a canvas is being actively edited by a peer or agent** that reaches the *other machine* — `ai-activity` is loopback-only; humans have no editing state. So two people (or a person + an agent) can unknowingly edit the same canvas at the same moment and race their saves into a git conflict.
2. The collaboration model was never made **branch-scoped** in the product's mental model — the original plan risked force-showing cross-branch canvases (which would create conflicts and confusion).
3. New canvases created during a session don't surface to the peer until they Get latest (acceptable per the model — but the nudge should name *what's new*).
4. The hub admin shows a **flat global** list of all documents across all repos — conflicts with the one-repo/branch-context IA.

## Solution

1. **Soft editing-presence (net-new, replaces locking):** a lightweight `editing` field on the existing per-canvas Yjs awareness channel — `{ since }` — set while a human (CSS-inspector / `/design:edit`-triggered) or an **agent** (bridge `ai-activity` → awareness) is editing that canvas; cleared on quiescence/disconnect (Yjs awareness GC). It rides the **already-bridged** awareness relay, so it crosses the hub for free. The peer UI shows a soft **"is editing this"** badge. **No lease, no takeover, no stale-lock machinery.**
2. **Branch-scoped visibility (confirm + harden):** tree shows only the current branch's on-disk canvases/specimens; cross-branch items are **not** shown. Coordination is social + the existing RepoBranchSwitcher.
3. **Live TSX co-visibility (verify + surface):** confirm the default-on TSX hub sync round-trips two machines; surface a subtle "synced / live" affordance so users trust it; **re-audit** the F1 peer-code-execution containment.
4. **New-canvas via get-latest (simplify):** enrich the phase-28 get-latest nudge to name new canvases; loopback inspector-bus refresh for same-machine multi-tab. No new hub transport.
5. **Hub admin realignment (refactor):** scope the admin to one repo/branch context.

## Metadata

- **Type:** Enhancement + small New Capability (editing-presence is new; TSX live + branch-scoping are surface/harden of shipped infra; hub realignment is refactor)
- **Complexity:** Medium–High (security-critical: a new awareness field over a semi-trusted hub + re-audit of peer-code execution; touches `use-collab.tsx`, `collab/`, `ai-activity.ts`, hub admin)
- **App/Package:** `apps/studio/` (collab + client) + `apps/hub/src/admin/`
- **Depends on:** Phase 8/9 (Yjs presence + hub + live TSX sync), phase-26 (shell), phase-27 (git layer + Changes/get-latest), phase-28 (get-latest nudge), phase-29 (RepoBranchSwitcher — "draft"/"Shared version" vocabulary)
- **Security:** peer-authored TSX **already** executes in the canvas-origin iframe (contained CRITICAL→MEDIUM by the canvas-origin split + strict CSP, DDR-054/063). This phase adds a new untrusted-input surface (the `editing` awareness field) — it MUST go through the existing `sanitizeForeignState()` chokepoint — and re-audits F1 because we are now actively *relying on* the live-TSX path being on.

---

## Context References

### Must-Read Files

> Read in parallel.

- `.ai/docs/collab-model-design.md` — **entire doc.** 3-lane model, UX mental model, microcopy contract. **NOTE:** this phase **reverses** its action A2 (*"TSX code lane = pessimistic locking"*) — DDR (Task 6) records the reversal.
- `.ai/decisions/DDR-064-single-shared-collab-doc.md` — one Y.Doc per canvas; awareness is per-canvas.
- `.ai/decisions/DDR-054-linked-mode-trust-model-and-task-4-hardening.md` — the F1 iframe sandbox + trust model. We rely on the canvas-origin split being on.
- `.ai/decisions/DDR-063-*.md` + `DDR-072-*.md` + `DDR-079-*.md` — `.tsx` sync gating (the two-locks rule; project-level default-on for linked).
- `.ai/decisions/DDR-078-agent-presence-virtual-collaborators.md` — `ai-activity`; the editing field must follow the same "synthetic peer is read-only display" discipline + the awareness sanitizer.
- `apps/studio/use-collab.tsx` — client Yjs provider; `CollabAwarenessState` (lines 83–114) + the `sanitizeForeignState()` chokepoint (lines 248–262). **This is where the `editing` field is added.**
- `apps/studio/collab/{room.ts,protocol.ts,registry.ts,awareness-bridge.ts,ai-activity.ts}` — server-side room lifecycle + the awareness↔hub bridge + the agent-activity source.
- `apps/studio/sync/index.ts` + `sync/agent.ts` — the live TSX projection (file ↔ Y.Text ↔ hub, ~800 ms debounce); `scanCanvases()` syncability gating.
- `apps/studio/ws.ts` (inspector bus → WS broadcast) + `apps/studio/client/app.jsx` (shell tree `loadTree()` @ ~5804; WS message handler @ ~5887; `ai-activity` relay to iframe).
- `apps/studio/use-agent-presence.tsx` — how agent presence is rendered (avatar + tinted overlay); the editing-presence overlay reuses this idiom.
- `apps/hub/src/admin/{index.html,app.js,style.css}` — current flat hub admin (vanilla JS, maude DS after DDR-097); realignment target. `apps/hub/test/admin-size.test.mjs` (28 KB gz guard).
- `.design/ui/Studio Hub.tsx` — artboard **D** (live presence map + AI-agent cursor, maude DS) is the lift reference for the editing-presence/agent-cursor treatment and the hub-admin realignment.

### Files to Modify (not create from scratch)

- `apps/studio/use-collab.tsx` — add `editing?: { since: number }` to `CollabAwarenessState`; add `sanitizeEditingState()` inside `sanitizeForeignState()`; add a `useEditingPresence(slug)` hook (set/clear the field).
- `apps/studio/collab/ai-activity.ts` (+ wiring in `server.ts`/`registry.ts`) — bridge agent `ai-activity` start/stop onto the room's awareness as a synthetic-peer `editing` state so it crosses the hub (per DDR-078 read-only-display discipline).
- `apps/studio/client/app.jsx` — mount the soft editing-presence overlay/badge on the canvas; add an `'editing'`/`'canvas-list-update'` WS message handler that calls `loadTree()`; enrich the get-latest nudge.
- `apps/studio/ws.ts` + `apps/studio/canvas-create.ts`/`api.ts` — emit a `canvas-list-update` bus event on create/delete → broadcast over the inspector WS (loopback refresh).
- `apps/hub/src/admin/{index.html,app.js,style.css}` — realign to repo/branch context.

### Files to Create

- `apps/studio/client/panels/EditingPresence.jsx` (or fold into an existing overlay) — the soft "Anna / agent is editing this" badge. **No** take-over button.
- `apps/studio/test/editing-presence.test.ts` — sanitize matrix (valid/invalid `editing` field), agent→awareness bridge, set/clear, awareness-GC clear on disconnect.

### Design canvas

| Canvas (to create) | Screens needed |
| --- | --- |
| `LiveCollab.tsx` (replaces the original `ArtboardLock.tsx`) | (1) two peers same branch — cursors + "Anna is editing" soft badge on a canvas; (2) **agent** editing — the `--presence-agent` cursor + "agent is editing" badge; (3) branch-scoped tree (only your branch; teammate on another draft → coordinate cue, **no** cross-branch items); (4) get-latest nudge naming a new canvas ("✦ Anna added *Login* · Get latest"); (5) the "you're both in *Redesign*" room cue. |

**Reference (lift, don't re-derive):** `.design/ui/Studio Hub.tsx` artboard **D** (presence map + peer avatars + floating AI-agent cursor, maude DS). Lift the presence-node + cursor-tag anatomy + agent-cursor styling. Microcopy follows the `collab-model-design.md` vocabulary contract (no `branch`/`merge`/`commit`/`pull` in user-facing copy; use draft / Shared version / Save version / Get latest).

---

## Tasks

### Task 1: Design mockup — `LiveCollab.tsx`

- **Do:** Author (lift from Studio Hub artboard D — *not* a blind `/design:new --perfect`, per CLAUDE.md "lift, don't re-derive" and the phase-27/28/29 precedent) a maude-DS canvas covering the 5 screens above: soft editing-presence badge (human + agent variants), branch-scoped tree, get-latest-names-new-canvas nudge, "same room" cue. Then critic-gate it (≥ 4.5 bar; design + signature-moment + a11y, like prior phases). Vocabulary per the contract — **no lock/takeover language** anywhere.
- **Validate:** Canvas `status: ready-for-handoff`; critic ≥ 4.5; a11y 0 blockers; compiles + renders (read every artboard PNG per DDR-021).

### Task 2: Soft editing-presence field on awareness (net-new core) — ✅ completed 2026-06-19

> **Done:** `CollabAwarenessState.editing {since}` + `sanitizeEditingState()` (rejects future/NaN/non-positive `since`) at the `sanitizeForeignState()` chokepoint + `useEditingPresence()` hook (set/auto-extend/idle-clear, no-op outside a provider) in `use-collab.tsx`. Agent bridge: `room.setAgentEditing()` projects agent activity onto the room's own awareness slot (idempotent — heartbeat-safe), `registry.setAgentEditing()` delegate, `server.ts` subscribes `ai-activity` bus → registry so agent-edit crosses the hub. **No lease/takeover/stale-lock built** (locking reversal). `test/editing-presence.test.ts` (9 tests: sanitize accept/reject matrix + room projection round-trip + heartbeat no-op). 91 collab/ai/awareness tests pass; biome + tsc clean.

- **Do:** Extend `CollabAwarenessState` in `use-collab.tsx`:
  ```ts
  /** Set while THIS peer is actively editing the canvas body (CSS-inspector /
   *  /design:edit / agent). Cleared on quiescence + on disconnect (awareness GC).
   *  Soft heads-up only — NOT a lock; never blocks another peer. */
  editing?: { since: number } | null;  // since = epoch ms the edit session began
  ```
  - `useEditingPresence(slug)`: `setEditing()` → `publishAwareness({ editing: { since: Date.now() } })`; `clearEditing()` → `publishAwareness({ editing: null })`. Auto-clear after a short idle window (no edit activity for ~5 s) and on unmount. Awareness is per-canvas, so the field needs no slug (it's implicit in the room) — keep the shape minimal.
  - **Human trigger:** call `setEditing()` when a CSS-inspector mutation (`/_api/edit-css` · `/_api/edit-attr`) or a `/design:edit`-shaped write touches this canvas; debounce-extend while edits continue; `clearEditing()` on idle.
  - **Agent trigger (bridge `ai-activity` → awareness):** when `ai-activity` marks a canvas as agent-edited, reflect it onto that room's awareness as a synthetic editing state so it **crosses the hub** (today `ai-activity` is loopback-only). Honour DDR-078: synthetic, read-only-display, must pass the sanitizer.
  - **Sanitize:** add `sanitizeEditingState()` to `sanitizeForeignState()` — `since` must be a finite positive number ≤ `Date.now() + 5000` (reject future timestamps ±5 s); anything else → `null`. No new peer cap needed (existing `MAX_FOREIGN_PEERS`).
  - **Explicitly NOT building:** lock acquisition/release, 30 s lease, attributed takeover, stale-lock detection. (Reversal of original Task 2.)
- **Validate:** `editing-presence.test.ts` — sanitize accept/reject matrix; set→clear; agent `ai-activity`→awareness bridge; awareness state dropped on disconnect (reuse the `room.ts` disconnect-evicts-awareness behaviour).

### Task 3: Soft editing-presence overlay (client) — ✅ visual layer + agent path completed 2026-06-19

> **Done:** the soft editing treatment lives in the **in-canvas presence layer** (`cursors-overlay.tsx` + `participants-chrome.tsx`), driven by `peer.editing` — NOT the plan's shell-side `EditingPresence.jsx` (that location was a locking-design holdover; presence renders in the canvas iframe where the awareness lives, avoiding a cross-origin bridge). A peer/agent editing gets a gently-pulsing accent ring + a ✎ marker + "Editing this canvas" popover line; the cursor pulses + carries ✎. **No take-over button, no read-only wall** — a heads-up. `isOwnEditingEcho()` (pure, exported, tested) drops the authoring machine's own server-side projection echo so the editor doesn't see a ghost of themselves. `prefers-reduced-motion` respected. **Agent path works end-to-end** (Task-2 server projection → hub → this badge — the user's primary ask). `participants-chrome.test.ts` +4 tests (26 presence tests pass); biome + tsc clean; client bundle rebuilt (release; `client.bundle.js` 410 KB, runtime bundles + binary untouched). **Deferred:** (a) the **human CSS-inspector edit trigger** (shell→iframe `setEditing` bridge, like `ai-activity`'s relay) — the hook `useEditingPresence` exists but isn't wired to inspector edits yet; (b) the full **two-peer agent-browser demo** (needs a live trigger + is the native-app dogfood ceiling).

- **Do:** Per the approved mockup. When another peer's (or the agent's) awareness carries `editing` for the current canvas, show a soft badge — avatar/funny-name + "is editing this canvas" — reusing the `use-agent-presence.tsx` tinted-overlay idiom and the `--presence-agent` hue for the agent. **No** "Take over" button; **no** read-only wall (the user can still edit — it's a heads-up). When self is editing, optionally a subtle "you're editing" chip. The live TSX changes already arrive via the hub sync + iframe reload — the badge just attributes them.
- **Validate:** Two tabs (loopback), same canvas: Tab A edits → Tab B shows the soft "A is editing" badge AND sees the TSX change render (~1 s) → badge clears on idle. Agent path: run `/design:edit` on a canvas with a second tab open → the second tab shows "agent is editing".

### Task 4: Branch-scoped visibility + new-canvas via get-latest — ✅ core completed 2026-06-19

> **Done:** `api.createCanvas`/`deleteCanvas` emit a `canvas-list-update` bus event (`{action:'added'|'removed', rel, slug}`); `ws.ts` broadcasts it to inspector (shell) clients; `app.jsx` WS handler calls `loadTree()` on receipt → other tabs on the same dev-server refresh the (branch-scoped, on-disk) tree without a reload. **Branch-scoped visibility is structural** — `loadTree()` re-reads `/_index-data` (disk = current branch); no code injects cross-branch items, so the property holds by construction (documented; covered by the DDR). Test: `canvas-create-api.test.ts` boots a real server + inspector WS, asserts `added` on create + `removed` on delete (39 pass). biome clean; tsc clean (only the pre-existing `api.ts fname` DDR-026 baseline). **Deferred sub-item (polish):** enriching the phase-28 cross-machine get-latest nudge to *name* the new canvases — the nudge already fires; naming-what's-new is a client nicety on top, tracked as a follow-up.

- **Do:**
  - **Visibility:** confirm + assert the tree only ever lists the current branch's on-disk canvases/specimens (`/_index-data` reads disk → already branch-scoped). Add a guard/test that we never inject cross-branch items. Coordination stays social + RepoBranchSwitcher (phase-29).
  - **New canvas (same-machine):** emit a `canvas-list-update` bus event on `POST /_api/canvas` create + delete → broadcast over the inspector WS → client `loadTree()` (no reload). Makes two tabs on one dev-server refresh instantly.
  - **New canvas (cross-machine):** enrich the phase-28 get-latest nudge to name what's new ("✦ Anna added *Login* · Get latest"); after the user Gets latest, the tree refreshes (existing path). **No new hub transport** — the file travels via git, the nudge is the signal.
- **Validate:** Two tabs same dev-server: create canvas in A → B's tree updates < 1 s, no reload. Branch-scoped: switch to a branch lacking a canvas → it's absent (not greyed). Cross-machine new canvas → peer sees the enriched get-latest nudge; after Get latest, tree shows it.

### Task 5: Hub admin UI realignment

- **Do:** Rework `apps/hub/src/admin/` to one repo/branch context:
  - Top-level "Connected repo" read-only display (repo URL + active branch from the hub config / first connected client's doc-namespace prefix).
  - Rename "Documents" → "Canvases"; show only slugs matching the active repo/branch prefix, not all raw doc names.
  - Remove the flat global document list.
  - Keep: token management, status, generate-invite.
  - **Size guard: ≤ 28 KB gz** (`apps/hub/test/admin-size.test.mjs` — the real budget; the original plan's "15 KB" was stale).
- **Validate:** Admin loads; canvas list shows only the active repo/branch context; token generation still works; gz ≤ 28 KB.

### Task 6: DDRs — ✅ completed 2026-06-19

> **Done:** **DDR-120** (branch-scoped multiplayer + soft editing-presence, no locking — explicitly reverses `collab-model-design.md` A2 + the original phase-30 locking plan; scoped DDR-078 reversal for the agent→awareness bridge; records the F1 re-audit obligation) + **DDR-121** (live-session canvas propagation via Get latest / loopback `canvas-list-update`; no project-level hub doc). Both indexed in `.ai/decisions/README.md`. _(F1 re-audit itself runs in /done's security fan-out.)_

- **Do:** Write 2 DDRs:
  1. **Branch-scoped live multiplayer + soft editing-presence** — the two-rule model; multiplayer requires same branch; live TSX already-on (DDR-079) is the co-edit medium; **soft editing-presence replaces locking** (explicitly **reverses** `collab-model-design.md` A2 and the original phase-30 locking design — cite *why*: users edit via agent/CSS-layer not raw co-typing, so garbage-merge risk is absent and a lock's complexity/orphaned-lease failure mode isn't worth it; the visual conflict picker (DDR-116) remains the safety net for divergent saves). Record the F1 re-audit outcome.
  2. **Live-session canvas propagation via get-latest** — new canvases reach offline/cross-machine peers through git "Get latest" (enriched nudge), same-machine peers through the loopback `canvas-list-update` bus event; no project-level hub document; event is ephemeral, not persisted.

---

## Validation

1. **Tests:** `bun test` — `editing-presence.test.ts` + existing `collab-*`/`room` tests green.
2. **Security (`flow:validate-security` + the F1 re-audit):** the `editing` field is sanitized at the `sanitizeForeignState()` chokepoint; the `ai-activity`→awareness bridge follows DDR-078 read-only-display discipline; `canvas-list-update` payload sanitized (slug charset). **Re-audit F1** (peer-TSX execution) since we now actively rely on the live-TSX path being on — confirm the canvas-origin split + CSP still contain it; record residuals.
3. **No-break exhaustive verify (per `feedback-no-break-exhaustive-verify`):** all existing collab features verified via agent-browser after `use-collab.tsx` changes. **Two tabs, same canvas, loopback:** cursors, comments, annotations, **and live TSX edits** all still live-sync; the editing badge appears + clears.
4. **Scenario (within the native-app verification ceiling):** two peers, same branch, same hub session — A edits (B sees the TSX change + "A is editing" badge), B annotates (A sees it live), one creates a canvas (the other gets the get-latest nudge), they agree who Saves/Publishes. Cross-machine bits are the user's dogfood ceiling; agent-browser substitutes for the verifiable parts.
5. **Hub admin:** loads, shows only active-context canvases, ≤ 28 KB gz.

## Acceptance Criteria

- [ ] `LiveCollab.tsx` mockup approved (critic ≥ 4.5, a11y 0 blockers) — Task 1
- [x] `editing` awareness field: set/clear, sanitized, **no lock/lease/takeover** — Task 2
- [x] `ai-activity` (agent editing) **crosses the hub** via awareness — Task 2
- [x] Soft editing-presence overlay renders (human + agent), no take-over wall — Task 3 _(visual layer + agent path; human inspector-edit trigger deferred)_
- [ ] Live TSX cross-machine round-trip **verified** (cursors + annotations + comments + TSX, two tabs) — Validation 3
- [x] Branch-scoped visibility (structural — `loadTree` re-reads disk); `canvas-list-update` loopback refresh — Task 4 _(cross-machine get-latest nudge enrichment deferred — polish)_
- [ ] Hub admin realigned to repo/branch context, ≤ 28 KB gz — Task 5
- [x] 2 DDRs written (DDR-120 model+editing-presence reversing A2; DDR-121 canvas propagation) — Task 6
- [ ] Security pass: `editing` field + `ai-activity` bridge + `canvas-list-update` sanitized; **F1 re-audited** — Validation 2
- [ ] No-break exhaustive verify: all existing collab features still work — Validation 3

---

## Superseded (original locking plan — kept for provenance)

The original phase-30 shipped **artboard locking** as the mechanism for the un-mergeable TSX code-body lane (per `collab-model-design.md` A2 / H2): a `lock {slug, since}` awareness field, 30 s lease, attributed takeover, stale-lock UX, and a `LockOverlay` with a "Take over" button. **Dropped 2026-06-19** in favour of the soft editing-presence model above, because (a) the user does not want a lock, (b) edits flow through the agent / CSS-layer (not raw human co-typing) so the garbage-merge risk locking guarded against is largely absent, and (c) live TSX co-visibility was already shipped, so the remaining need was *attribution + a soft heads-up*, not arbitration. The DDR (Task 6 #1) records this reversal.
