# DDR-116 — In-UI merge-conflict resolution via a side-picking mergeDriver

**Status:** accepted
**Date:** 2026-06-19
**Phase:** phase-28 (Native Maude E3 — GitHub identity & remote)
**Related:** DDR-107 (isomorphic-git engine), DDR-113 (DiffView), DDR-114 (OAuth-App boundary)

## Context

Phase-27 shipped the DiffView "Keep mine / theirs / both" picker but its resolve
action was a stub (`onResolve` just closed + re-read status) — there was no backend
to apply the choice or complete the merge. When a real conflict hit, the user was
wedged with no terminal-free way out. Two concrete bugs made it worse:

1. `mergeConflictFiles` only handled `Array.isArray(err.data)`, but isomorphic-git's
   `MergeConflictError.data` is an **object** `{ filepaths, bothModified, … }`. So a
   real conflict returned **no files**, the resolver never opened, and "Get latest"
   looped forever.
2. isomorphic-git's `git.pull` throws on a content conflict and **leaves the working
   tree clean** — no `MERGE_HEAD`, no conflicted index, no markers. So there is no
   on-disk merge state for a standard "edit markers → add → commit" resolve flow to
   operate on.

## Decision

Resolve conflicts by **re-running the merge with a custom `mergeDriver`** that returns
one whole side per conflicted blob (`cleanMerge: true`), rather than relying on git's
native conflict-marker state:

- `mine` → our blob, `theirs` → their blob. Because every blob resolves clean,
  `git.merge` completes and writes a real **two-parent merge commit**; non-conflicting
  changes from both sides still merge normally.
- `both` → take theirs for the file **and** write our version as a sibling
  `<name> (mine)<ext>` copy, committed separately ("zero data loss" — the DiffView
  default).
- The system-git engine (`MAUDE_USE_SYSTEM_GIT=1`) resolves the conventional way
  (`git checkout --ours/--theirs -- <file>` + `git commit --no-edit`) since that
  engine *does* leave a merge in progress.

Surfaced through `/_api/git/resolve` (main-origin + loopback + CSRF gated, in the
dual-allowlist's privileged set — never reachable from the canvas origin).

## Why not alternatives

- **Native git conflict markers + manual resolve**: iso-git doesn't produce them
  (leaves the tree clean), and Maude's whole point is no-terminal — we don't want to
  show `<<<<<<<` markers to a non-technical user anyway.
- **`merge({ abortOnConflict: false })`** writes markers + an unmerged index, but then
  needs a second "complete the merge" step and exposes the marker text. The mergeDriver
  approach resolves in one call with a clean two-parent commit.
- **Require system-git**: rejected — DDR-107 keeps the managed binary zero-dep.

## Consequences

- Conflict resolution is whole-file per side (no line-level 3-way merge). For design
  canvases (the conflict unit) this matches the visual "pick a version" model; line
  merges aren't meaningful for rendered TSX anyway.
- The UI applies one choice to the conflict at a time (DiffView opens on the first
  conflicted file); the mergeDriver applies that choice across all both-modified blobs.
  Per-file divergent choices are a future enhancement.
- Security: the `(mine)` copy path is git-tree-derived and guarded with
  `isContainedRepoPath` (audit F-1/D-2).
