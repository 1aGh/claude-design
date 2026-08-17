# DDR-228 — Two modes of design ownership: repo-owned or hub-owned, never both

- **Date:** 2026-08-17
- **Status:** accepted
- **Scope:** `repo:maude`, `dept:dev`
- **Supersedes:** the implicit "linked AND committed" hybrid posture that every linked project has run in since cloud links shipped · the repo-to-repo P2P multiplayer variant (peers sharing a project by both cloning the same git repo, converging on `git push`) — developed, never shipped, now dead
- **Extends:** [DDR-226](./DDR-226-sync-v2-hub-ordered-journal-file-plane-one-serving-truth-and-the-dorucenka.md) · [DDR-115](./DDR-115-per-user-camera-split-and-runtime-state-taxonomy.md) · [DDR-198](./DDR-198-server-owned-git-history-in-the-hub.md) · [DDR-177](./DDR-177-desktop-self-contained-runtime-and-bundle-completeness-gate.md)

## Context

Sync v2 (DDR-226) makes a linked project's `.design/` a **full working mirror**
of the hub in both directions, deletions included. That forces a question the
old lanes could dodge: if the hub is a writer of the user's tracked files, *who
owns the folder?*

Today's answer is "both," and it is incoherent. A linked project has `.design/`
committed in the user's own repo (VERSIONED per DDR-115) **and** live-mirrored
from a hub. Consequences observed in dogfood: a `git checkout` of another branch
rewrites the tree under the sync engine; a `git restore` reverts bytes the hub
believes it delivered; the user's commit history and the hub's server-owned
history (DDR-198) both claim to be the record; and Syncthing-managed trees ride
a third lane on top. Every one of those is a conflict source with no principled
resolution, because there is no stated owner.

The user's decision (2026-08-16), taken as binding for the arc: **exactly two
modes, nothing in between.**

## Decision

| | **Mode A — repo-owned** | **Mode B — hub-owned (multiplayer)** |
|---|---|---|
| Source of truth | the user's git repo | the hub (server-owned git history DDR-198 + R2 durability) |
| `.design/` in the user's repo | committed (VERSIONED taxonomy) | **gitignored** (`git rm -r --cached` at adopt) |
| Local disk | the working copy itself | full working mirror (offline edits fine; the journal plane converges) |
| Collaboration | plain git — commit/push/pull, no Maude involvement | live multiplayer via the hub (doc lanes + journal file plane) |
| Hub link | none | required |
| History / forensics | the user's git | hub git + journal + R2 tail + `_trash/` quarantine |
| Repo handoff | n/a (already in the repo) | explicit export only (`design-sync.mjs` PR / registry-item) |

### 1. A hub link without the gitignore is not a state

Linking a project is not a toggle that leaves the folder's ownership ambiguous.
**Adopt (A→B)** is a single confirmed operation: fresh-link push of the local
`.design/` through the journal plane, then append `.design/` to the repo's
`.gitignore` **and** `git rm -r --cached .design`. A link that has not adopted
does not complete.

**Detach (B→A)** is the inverse and equally explicit: unlink the hub, remove the
ignore line, and prompt the user to commit `.design/` themselves. The bytes are
already local — the Mode-B mirror is a full copy, not a cache — so detach is
never a download.

Both transitions are **one-shot operations, never a continuous sync**, and both
run from the desktop UI without a terminal (DDR-177: the target user has none),
with a `maude` CLI mirror for terminal users.

### 2. `design-sync.mjs` is export, not a sync lane

It is reclassified in docs and command wording as an explicit **export/handoff**
(open a PR against the user's repo with the current design tree). It was never a
peer lane and must stop being described as one, now that "sync" has a precise
meaning.

### 3. Syncthing-managed folders get an `.stignore` recommendation at adopt

Syncthing does not read `.gitignore`. Without an `.stignore` entry a Mode-B
project rides two independent file lanes over the same bytes. Adopt detects an
ancestor `.stfolder` and offers the entry.

### 4. Existing linked projects are migrated by an explicit prompt, once

On first run of the new version, a legacy linked project asks: adopt (ignore +
untrack) or detach. Lingering in the old hybrid is allowed only until answered,
and the Sync panel carries a persistent **"legacy hybrid"** badge meanwhile — an
unanswered prompt is visible, never silent.

### 5. The repo-level ignore is NOT a fifth copy of the DDR-115 taxonomy

DDR-115's four ignore-list copies govern what syncs **inside** `.design/`. This
decision's ignore is whole-folder, user-repo-side, and a different concern
entirely. Do not conflate them; the taxonomy lists stay untouched.

## Alternatives rejected

- **Keep the hybrid (linked AND committed).** It is the status quo and it has no
  answer for branch switches, `git restore`, or which history is the record.
  Mode B's delete propagation makes the contradiction sharper, not softer: a
  hub-owned mirror that ignores deletes contradicts its own model.
- **Repo-to-repo P2P multiplayer, converging on `git push`.** Developed as a
  product variant: peers share a project by both cloning the same repo, and
  Maude reconciles on push/pull. It dies on the same grounds as git-as-transport
  (DDR-227) plus a product one — collaboration latency becomes the user's push
  cadence, which is not multiplayer. Superseded here so it is not re-proposed.
- **Auto-adopt on link, no confirmation.** Editing a user's `.gitignore` and
  untracking a tracked folder is exactly the kind of one-way action that
  requires an explicit yes.
- **Mode B without a local mirror (cloud-only).** Breaks offline work and the
  "it's on my disk" half of the user story; the mirror is the point.

## Consequences

- The link flow gains a mandatory adoption step and refuses to complete without
  it; the desktop grows adopt/detach dialogs and the `maude` CLI grows the
  equivalents (`cli/lib/gitignore-block.mjs` supplies the idempotent
  append/remove discipline).
- **A fresh clone of a Mode-B repo has no `.design/` at all.** "Adopt an empty
  local dir from the hub" (fresh-link pull) is therefore the new-machine
  onboarding path and must be verified end-to-end, not assumed.
- Delete propagation (DDR-226 §8) becomes the *expected* behaviour for Mode B,
  which turns its default-ON flip into a *when*, not an *if*.
- `git rm -r --cached` runs on a possibly dirty tree: stage ONLY the `.design/`
  removals and the `.gitignore` edit, never `git add -A`. The working tree is
  untouched by design.
