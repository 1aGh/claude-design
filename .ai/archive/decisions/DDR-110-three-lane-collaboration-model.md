# DDR-110: Three-lane collaboration model + non-technical mental model + repo/branch IA

- **Date:** 2026-06-16
- **Status:** Accepted (founding decision for the native-collab arc — phase-26 Task 1). Governs phases 27 (git UI), 29 (onboarding + repo/branch switcher), and 30 (live multiplayer). Recorded now as the contract those phases build against.
- **Tags:** native-app, collaboration, sync, yjs, git, crdt, locking, presence, ia, vocabulary, phase-30
- **Related:** [DDR-064](./DDR-064-single-shared-collab-doc.md) (the shared Y.Doc — Lane 2 live overlay; the file on disk is a git-owned projection of it), [DDR-051](./DDR-051-collab-persistence-json-snapshot-at-quiescence.md) (snapshot-at-quiescence — _why Yjs does NOT lose git history_), [DDR-076](./DDR-076-empty-hub-doc-never-clobbers-local-canvas.md) (an empty/absent hub doc never fabricates or clobbers a local canvas — the no-cold-start guarantee), [DDR-054](./DDR-054-linked-mode-trust-model-and-task-4-hardening.md) (iframe sandbox/CSP gating live-sync of peer-authored canvas _code_), [DDR-055](./DDR-055-shell-owned-comment-layer.md) (comments = append-only conflict-free JSON), [DDR-078](./DDR-078-agent-presence-virtual-collaborators.md) (agent presence), [DDR-052](./DDR-052-hocuspocus-over-partykit-for-hub.md) (hub transport), [DDR-079](./DDR-079-tsx-sync-default-on.md) (project-level TSX sync). Source docs: [`collab-model-design.md`](../docs/collab-model-design.md) (the alignment + UX mental model this DDR formalizes), [`epic-native-collab-app.md`](../docs/epic-native-collab-app.md).

## Context

The native-collab arc must answer: **what syncs how?** Two inputs were reconciled (2026-06-04, see `collab-model-design.md`): the epic's two-layer model (git = distribution, Yjs = live co-edit) and a morning-debate proposal (edit→save→push, no streaming, artboard locking, comments as separate JSON).

The debate's one original premise — "reject Yjs/CRDT because real-time loses git history + the local-file model" — is **factually wrong in Maude**: per DDR-064/051 the Y.Doc is a live overlay and the on-disk file is a **git-owned projection** (snapshot at quiescence). Git owns every file and commit. "Drop CRDT so git history survives" solves a problem the implementation already solved differently. Live Yjs co-editing is **already shipped and default-on** (Phase 8/9/9.1/9.2). Rejecting it = deleting a working, security-hardened subsystem.

The debate's genuine contribution is **artboard locking** — cheap, additive, and it fits exactly where the epic had a gap: the un-mergeable TSX code body.

UX research (14+ prior-art sources) is decisive on the framing: a hard "sync-first" gate (H3) is the biggest risk and **fails** (Figma/Docs have zero pre-collab gate); edit→save→push as a _replacement_ for real-time (H1) **fails** for FigJam-like positioning (Abstract's ~$57M tombstone; Penpot is git-native and still built multiplayer); comments-always-flow (H6) and lock-the-unmergeable (H2) **hold**.

## Decision

### Three lanes, three strategies

| Lane | What | Strategy |
| --- | --- | --- |
| **1. Distribution** | _Which canvases exist on your disk_ | **Git only** — push→pull. No cold-start materialization, no hub-propagation of create/delete, no untrusted inbox. A canvas you didn't pull never appears. (The dropped "Phase 26 untrusted-inbox" idea stays dropped.) |
| **2. Live overlay** | Edits, annotations, comments, presence, cursors, selection, viewport | **Yjs (already shipped)** — edits + annotations + comments sync live **and persist** (Y.Doc → git-owned disk projection, DDR-064/051). Cursors / selection / viewport / who's-here are **ephemeral awareness**, gitignored, never committed. |
| **3. Code body** | Canvas TSX (peer-authored code) | **Artboard lock** — soft single-writer, broadcast via awareness, released on commit / lease-expiry. **No CRDT merge, no merge UI** for TSX. Live-syncing a peer's TSX renders their code in your iframe → gated behind the DDR-054 iframe sandbox/CSP. |

Lane 2's annotations + comments are _data_ → lowest risk, ship first. Lane 3's TSX live-edit ships behind the iframe gate.

### The premise correction (record, don't adopt)

Yjs in Maude does **not** lose git history: the file is a git-owned projection of the Y.Doc, snapshotted at quiescence (DDR-064/051). Git owns every commit. This DDR records the correction explicitly so it isn't re-litigated.

### Conflict strategy — prevent, don't merge

- **Together-live → conflict is structurally impossible.** The live layer holds both working trees byte-identical, so every "Save version" is a guaranteed fast-forward for the other peer.
- **Apart, same file → coarse visual picker**, never a text merge: "You and Anna both changed _Login_ separately" → **Keep mine · Keep Anna's · Keep both**. Default-safe = **keep both** (zero data loss). Comments/annotations never enter the dialog.
- The only routine "conflict" is push-rejected-because-remote-moved → "Get latest first". **No hard sync gate, no "commit first" wall** (H3/H5 down-scoped to a soft nudge + auto-checkpoint).

### Non-technical mental model — what the user actually perceives

> **The only thing the user must understand is _people_: are we in the room together right now, or not?** Everything else — sync, pull, push, merge — is the app's job, not the user's.

Two presence states (🟢 here now / ⚪ away) × two object states (Shared / "Draft · only you"). That's the whole surface. New-canvas confusion is solved by making share-state a property of the **object** ("only you see this yet"), not the connection; background auto-share closes the unshared window in seconds. Catch-up is the **unread** pattern ("✦ 3 new from Anna · Show"), never "pull".

**Vocabulary contract (hard rule for all phase 27/29/30 UI):** Save version = commit · Publish = push · Get latest = pull · History = log · Draft = branch/working line · Send for review (never "pull request"). **Forbidden in UI copy:** `branch`, `merge`, `main`, `commit`, `push`, `pull`, `fetch`, `behind`, `diverged`, `conflict`, `sync` (as a user-run verb), `(Conflicted copy)`. Real git is the engine, never the vocabulary — and there is **no "developer view" toggle** (kept clean, per user).

### Navigation / IA — repo + branch is the organizing primitive

**One project = one repo. The top-level nav is a repo switcher + branch switcher** ("you are in _repo X_ on _branch Y_", one-click switch). Both the maude UI **and** the hub admin UI adopt this — a hub instance attaches to **one repo/branch context at a time**, never a multiplexed directory of many repos. This maps 1:1 onto git-as-source-of-truth and onto how IDEs/Figma present "projects" (phase-29 switcher; phase-30 hub realignment).

## Consequences

- **Positive:** keeps the shipped real-time subsystem; adds only the cheap, correctly-scoped locking lane; gives every later UI phase a fixed vocabulary + IA contract; makes the "conflict is impossible while live" promise honest and structural.
- **Negative / accepted:** the three lanes are a non-trivial mental model for _implementers_ (the user never sees it) — this DDR + `collab-model-design.md` are the canonical reference. Lane-3 TSX live-edit is blocked on the DDR-054 iframe gate (annotations/comments ship ahead of it).
- **Explicitly OUT:** hub-propagation of canvas create/delete; cold-start auto-materialization; receiving any canvas you didn't pull; any 3-way text-merge UI; any hard pre-collaboration sync gate.

### Open questions deferred to phase-30 design

Auto-share cadence; hub-down-mid-session behavior; "Draft" final naming; same-canvas code-body single-writer strictness; the ≥30 s "really away" presence threshold; delete-vs-edit default. Enumerated in `collab-model-design.md` § "Open questions pro E5 design".

## Alternatives considered

- **Two-lane only (epic original)** — superseded: the un-mergeable TSX code body had no strategy; Lane 3 (artboard lock) fills it.
- **Drop Yjs, edit→save→push only (debate)** — rejected: deletes a working subsystem on a false premise; fails FigJam positioning per UX research (H1).
- **Hard sync-first gate + mandatory handshake (debate)** — rejected: H3 is the single biggest risk and fails in the field; softened to auto-checkpoint + ambient "Join".
- **Hub multiplexing many repos** — rejected: turns into a mess; repo/branch switching is the simpler, IDE/Figma-aligned mental model.
