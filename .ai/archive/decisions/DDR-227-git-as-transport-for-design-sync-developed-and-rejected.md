# DDR-227 — Git as the transport for `.design/` sync: developed seriously, rejected

- **Date:** 2026-08-17
- **Status:** accepted
- **Scope:** `repo:maude`, `dept:dev`
- **References:** [DDR-226](./DDR-226-sync-v2-hub-ordered-journal-file-plane-one-serving-truth-and-the-dorucenka.md) (the architecture that ships instead) · [DDR-198](./DDR-198-server-owned-git-history-in-the-hub.md) · [DDR-199](./DDR-199-cells-on-cloudflare-and-the-four-things-deploying-taught-us.md) · [DDR-217](./DDR-217-cloud-asset-transport-desktop-push.md) · [DDR-054](./DDR-054-linked-mode-trust-model-and-task-4-hardening.md) · [DDR-193](./DDR-193-maude-cloud-tenant-cells-and-containment-invariant.md)

## Context

"Both sides already run git — why are we hand-rolling a file sync?" is the
obvious question, and it has been asked more than once. During the sync-v2
redesign (2026-08-16) one of the three blind architects was assigned to develop
it **to the bolts** rather than dismiss it: full topology analysis, wire
protocol, auth mapping, commit/merge model, materialization under the trust
model, event channel, large-binary policy, and engine choice. The full
development is `.ai/plans/notes/sync-redesign-dossier/candidate-leverage-gitsync.md`
Part I.

Its own author's verdict: *"buildable — but by the time it satisfies DDR-054,
the latency bar, and the cell's physical limits, every git-specific mechanism
has been bypassed or re-implemented, and what remains is the journal+CAS design
wearing a packfile costume."*

This DDR records that development and its rejection so git-as-transport is
never re-litigated from scratch.

## Decision

**Git is not the sync transport, on four independent grounds. Git stays in the
system doing what it is good at: history of record (cell autocommit, DDR-198),
seed clone, checkpoint/backup/rehydrate (DDR-199), and outbound export
(mirror-push, `design-sync.mjs`).**

### Ground 1 — `receive-pack` is unsplittable and the cell's body caps are not

The hub exposes no git endpoint today; adding one (`git http-backend` CGI shim
or `upload-pack --stateless-rpc`) is feasible. But smart-HTTP `receive-pack` is
**a single POST of one pack, with no resumable form in the protocol.** A
fresh-link push of a real design project (alligators-class: hundreds of files,
a 280 MB seed already forced `standard-1`) is one multi-hundred-MB POST through
the worker→DO→container splice, whose code-level caps (100 MB/file, 2 GiB/process
budget) and the platform's own body limit sit below it. Per-blob PUTs chunk
naturally; packs do not. The workarounds — artificial history slicing, or
sidebanding the pack to R2 — have both already left the git protocol.

### Ground 2 — unbounded binary history vs. the cell's 8 GB / 600 s physics

Append-only history is immutable posture (DDR-195/198: no rewrite, no
force-push). So every saved generation of every PNG/MP4 accretes in every clone,
every `git bundle`, and every backup generation, forever. A design project with
300 MB of media and modest churn reaches ~800 MB of packs; the per-generation
`repo.bundle` then crosses the **1.1 GiB boot-restore threshold that already
failed the 600 s window on a ½-vCPU cell** — and rehydrate runs *before* the hub
binds, so availability is already a function of project size. Plain-blob GitSync
makes it a function of project *history*.

The annex-style escape (pointer files in git, bytes over a content-addressed
HTTP lane with its own presence tracking) **is the asset lane we are trying to
delete**, re-added with pointer indirection and a location-tracking branch on
top.

### Ground 3 — the working tree is unusable under DDR-054

`git checkout` materializes whatever the pack says: arbitrary paths, symlinks,
`.tsx` outside canvas groups, runtime-state names. The hub is untrusted to
peers, so the receiver must re-validate every path through
`classifyProjectFile` + canvas-path validation + symlink refusal + caps.
**Git's working-tree machinery is therefore banned and only its object store
survives** — feeding the exact classifier-gated materializer the journal design
already needs. DDR-131 is the standing receipt that git's transport/config
surface is RCE-rich (`ext::` helpers — a CRITICAL found in our own code in June).

The same collapse happens at the merge: the model must be file-level
conflict-aside, never line-level (DDR-110: prevent-don't-merge, no merge UI
ever), and isomorphic-git throws `MergeNotSupportedError` on any real conflict —
so the three-way tree merge is hand-rolled **using the same decision table the
journal design needs**. The giant does not carry the load at the point where the
load exists.

### Ground 4 — git has no server→client event channel

The visibility half of the problem (bytes arrive, nobody is told) is
transport-independent: a post-receive hook would broadcast over the existing
WebSocket — the identical mechanism as the journal's poke, merely triggered
differently. Git contributes nothing to the half of the redesign that fixes the
live bug.

### Supporting facts that make the topology worse

- **Repo topology has no good option.** (a) Syncing the user's own repo drags
  their whole codebase onto Maude infrastructure and collides with their origin
  (the reason the cell seed scrubs credentials in the first place). (b) A hidden
  second bare repo over the same working tree means **two git indexes over one
  tree** — index/mtime races against the user's own branch switches, a bug class
  nobody runs in production — and the cell needs a second, `.design/`-scoped
  repo too, so the cell's store count *grows*. (c) A server-side virtual repo is
  "implement a git server over a manifest", i.e. the journal design with extra
  steps.
- **Two engines on the hot path.** The `.app` bundles no git binary (DDR-177's
  target user has no terminal; macOS `/usr/bin/git` triggers an Xcode CLT
  dialog), so the no-git persona rides isomorphic-git — which DDR-133 already
  records as slow on real repos and able to wedge the Bun idle window. System
  git when present, iso when not, is trap #2 (two architectures, every bug fixed
  twice) rebuilt deliberately.
- **Contention shape.** Non-fast-forward rejects turn into fetch → merge →
  re-push loops of pack-negotiation RTTs, where the journal design has one
  idempotent CAS'd PUT.

## Alternatives considered inside the git framing

- **Plain blobs** — Ground 2.
- **git-annex-style pointers** — recreates the asset lane plus a location branch.
- **Partial clone (`filter=blob:none`)** — the requirement is a full local
  mirror, so the blobs arrive regardless.
- **Sparse checkout** — buys nothing on the desktop (full `.design/` is the
  requirement) and does not solve the cell's second-repo problem.

## Consequences

- The redesign ships the journal + CAS + poke architecture (DDR-226) — which is
  what remains of GitSync once every git-specific mechanism has been bypassed.
- Git's surviving roles are explicitly enumerated and unchanged: server-owned
  history in the cell, seed clone, `git bundle` checkpoints riding the same
  backup generation as the SQLite snapshots, rehydrate, and **outbound export
  only** (`design-sync.mjs` PRs, mirror-push).
- Re-opening this requires new facts against one of the four grounds — not a
  fresh intuition that "we already have git."
