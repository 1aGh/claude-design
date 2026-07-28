# DDR-120 — Branch-scoped live multiplayer + soft editing-presence (no locking)

**Status:** accepted
**Date:** 2026-06-19
**Phase:** phase-30 (Native Maude — live multiplayer)
**Related:** DDR-064 (one Y.Doc + Awareness per canvas), DDR-054/063 (canvas-origin split + F1 containment for peer-TSX execution), DDR-072/079 (project-level TSX sync default-on for linked), DDR-078 (agent presence as virtual collaborators), DDR-110 (three-lane collaboration model), DDR-116 (in-UI visual conflict picker). **Reverses** `.ai/docs/collab-model-design.md` action **A2** (*"TSX code lane = pessimistic locking"*) and the original phase-30 plan's artboard-locking design. Implemented in `apps/studio/use-collab.tsx`, `apps/studio/collab/{room,registry}.ts`, `apps/studio/server.ts`.

## Context

The original phase-30 plan, following `collab-model-design.md` A2 / H2, was to ship **artboard locking** for the un-mergeable TSX code-body lane: a per-canvas single-writer `lock` field on awareness with a 30 s lease, attributed takeover, and stale-lock UX. Locking exists to stop two people overwriting the same code file.

Three things, surfaced in dialogue with the product owner during execution, made locking the wrong mechanism:

1. **Users don't hand-type raw TSX.** Edits flow through the **CSS-layer inspector** (`/_api/edit-css` → AST rewrite) or **`/design:edit`** (the agent writes the file). So the failure mode locking guards against — two human cursors typing into the same code line producing a character-merged-but-semantically-broken file — essentially does not occur. The mutating actor is a structured edit or an agent op, not co-typing.
2. **Live TSX co-visibility is already shipped.** Per DDR-072/079 (Phase 9.1), the canvas `.tsx` body already syncs cross-machine over the hub, **default-on for linked projects** (`.tsx` → fs.watch → Y.Text → Hocuspocus → peer disk → iframe reload, ~1 s after each edit). So *"when one edits, the other sees it"* was already true; the remaining need was **attribution + a soft heads-up**, not arbitration.
3. **Locks have an expensive, orphaned-lease failure mode.** Every check-out system's hardest problem is stale locks (the Perforce `+l` lesson cited in `collab-model-design.md` H2). A lease + takeover + stale-detection state machine is real complexity for a risk that (1) largely removed. The product owner was explicit: *"žádný komplikovaný lock edit nechci."*

A second axis also needed pinning down: **what does a non-technical user see across git branches?** Maude runs on disk in a git repo. The product owner's conclusion: **you see only your branch.**

## Decision

Ship a **branch-scoped live-multiplayer model** built on a **soft "editing now" presence** signal — **not** a lock.

### The two rules (user-facing)

1. **You see only your branch.** The canvas tree shows the canvases/specimens on your current branch, on disk. Git already enforces this; we do **not** override it (no cross-branch tree items, not even disabled). A teammate on another draft is simply absent from your tree; you coordinate socially and switch with the RepoBranchSwitcher (phase-29).
2. **Multiplayer = same branch.** Cursors, annotations, comments, and the live TSX body sync **only** when both peers are on the same branch. On the same HEAD both may edit; the live layer keeps trees converged so saves are fast-forwards. **Commit/Publish is socially coordinated** ("who saves this?") — the accepted tradeoff for running on git.

### Soft editing-presence (replaces locking)

A new optional field on the per-canvas Yjs awareness state:

```ts
editing?: { since: number } | null; // epoch-ms the edit session began
```

- It rides the **existing per-canvas awareness channel**, which already crosses the hub via `bridgeAwareness` — so it reaches remote peers for free, exactly like cursors.
- Humans set it via `useEditingPresence()` (set on each edit, auto-extend, idle-clear after 5 s, clear on unmount). Agents get it via a server bridge: `room.setAgentEditing()` projects `ai-activity` (DDR-078, previously loopback-only) onto the room's own awareness slot, so an agent edit on machine A surfaces as "X is editing" on machine B. Agent activity is attributed to the **driving human** (`ai-activity.author`) — honest (their `/design:edit` is editing it), uses their normal presence color, and avoids putting a spoofable "I am the agent" flag on an untrusted channel.
- The peer overlay shows a soft **"is editing this"** heads-up. It is **NOT** a lock: it never blocks an edit, has no lease, no takeover, no stale-lock state. It steers two actors away from a simultaneous edit; the **visual conflict picker (DDR-116)** remains the safety net if two divergent saves do happen.

### Untrusted-input discipline

The `editing` field is attacker-influenceable through the semi-trusted hub (DDR-054), so it is validated at the existing `sanitizeForeignState()` chokepoint (`sanitizeEditingState`): `since` must be a finite, positive epoch-ms not more than 5 s in the future, else it is dropped to `null`. This blocks a permanent-badge pin (far-future timestamp) and a `Date.now() - since` age-math poison (NaN/Infinity).

## Consequences

- **Smaller, safer surface than locking.** No lease timers, no takeover protocol, no orphaned-lock recovery. One sanitized awareness field + a server bridge.
- **DDR-078 partial reversal (scoped).** DDR-078 deliberately kept agent presence **off** awareness ("a server projection, not a peer") to avoid destabilizing real-peer presence. Phase-30 puts a minimal agent *editing* state onto the room's own (otherwise-unused) awareness slot **specifically so it crosses the hub**. The rich local agent treatment (violet `--presence-agent` avatar/cursor) still rides the original `ai-activity` bus unchanged; the awareness projection is the cross-machine heads-up only. Cross-machine, the agent shows in the driving human's color, not the agent violet — an accepted attribution nuance (the hue would require a spoofable trusted flag on an untrusted channel).
- **Cross-branch is invisible by construction.** Because the tree reads disk (current branch), no code path surfaces another branch's canvases. This is the simplest conflict-prevention: you can only edit what's on your branch+HEAD.
- **F1 re-audit obligation.** Because the model now *relies on* the default-on live-TSX path (peer code executing in the canvas-origin iframe), phase-30 re-audits the DDR-054/063 containment (canvas-origin split + strict CSP) rather than treating it as background.
- **`collab-model-design.md` A2 is superseded.** That doc stays as historical research context; this DDR is the authority for the TSX-lane collaboration mechanism.

## Alternatives considered

- **Artboard locking (original plan / A2).** Rejected: guards a failure mode that structured/agent editing largely removes, and adds the orphaned-lease complexity every check-out system struggles with.
- **Full CRDT co-editing of the TSX text.** Rejected: character-merge of two simultaneous edits to the same code region yields syntactically/ semantically broken JSX. Not needed once edits flow through agent/CSS-layer ops.
- **A reserved project-level synced doc to push a cross-branch canvas list live.** Rejected: branch-scoped visibility means we never show other branches' canvases, so there is nothing to push — this removes the need for a new hub transport entirely (see DDR-121).
