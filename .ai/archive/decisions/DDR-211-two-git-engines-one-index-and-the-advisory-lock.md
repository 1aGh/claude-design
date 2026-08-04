# DDR-211: Two git engines over one index, and the lock that was the second problem

**Date:** 2026-08-04
**Status:** accepted
**Tags:** cloud/cell/git/concurrency/lock/role/amends-ddr-209
**Supersedes:** —
**Extends:** [DDR-209](DDR-209-one-studio-three-shells-the-cell-serves-the-studio.md)

## Context

Cloud Phase 27 made a cell two processes over one working tree: the hub commits
autosaves, bundles backups and clones the checkout at boot; the studio writes
canvas source and runs the browser's own git verbs. The phase's **preserved
dissent** named the cost precisely, and it was the one item deployed unfixed:

> "The 3 a.m. event is not a 500 — it is a tenant's canvas lost to a half-staged
> commit or a checkout under a live writer, in a cell whose /health still says
> 200 because the hub process is fine."

The plan offered two routes: route the hub's git through the studio's own
`sync/autocommit.ts` (single writer), or — "if that is too large for one phase" —
one advisory lock both honour plus a quiesce RPC and a concurrency test.

## Decision

**The fallback, taken deliberately, plus the thing that had to come first.**

### 1. They were not racing on a lock. They were running different git engines.

The studio's WRITE paths default to **isomorphic-git**, which keeps an
in-PROCESS `async-lock` keyed on the index path and writes `.git/index`
directly. It never creates `.git/index.lock` and never looks for one. The hub
shells out to **system git**, which does both.

So the two processes were not merely unsynchronised — they were **not speaking
the same protocol about what a lock is**. No discipline on either side could
have helped, and neither could a lock added to only one of them. The first
change is one line: `MAUDE_USE_SYSTEM_GIT=1` in the cell child's environment
(`studio-child.mjs`), unconditional rather than an operator's job, because a
cell is exactly the deployment it is right for and the image already asserts
`git` is present.

That alone makes `.git/index.lock` a real boundary between the two processes.

### 2. Single-writer would have merged two writers out of six.

Routing the hub's git through `sync/autocommit.ts` is attractive because the hub
already imports it across the app boundary. It also would not have fixed the
problem. `gitCheckout`, `gitFoldDraft`, `gitPull` and `gitDiscard` are the
browser's verbs, in the studio, and `bundleRepo` / `seedRepo` / `restoreRepo` are
the hub's — those still collide with each other and with autocommit. A
`git checkout <branch>` landing under a live `git add` is not a lesser version of
the 3 a.m. event; it is the 3 a.m. event.

It carries a second cost: the tenant's history would depend on a supervised
child being ready, so "the child restarted" becomes "those edits were never
committed" — unless the hub keeps a fallback writer, at which point there are
two writers again.

### 3. The lock is held across the SEQUENCE, not the invocation.

`apps/studio/git/repo-lock.ts`, imported by both processes.
`<repo>/.git/maude-repo.lock`, created with `wx` (create-or-fail is what makes it
a lock rather than a suggestion), holding `{pid, holder, at, token}`.

Two properties `index.lock` cannot provide, and they are the reason this exists
on top of it rather than instead of it:

- **It waits instead of failing.** Two racing commits under `index.lock` give one
  of them `Unable to create '.git/index.lock': File exists`. Loud — and a failed
  autosave commit is a history that quietly stops.
- **It spans a sequence.** `add` then `commit` is two invocations; `checkout main`
  then `merge` then `branch -D` is three. `index.lock` is released between each.
  The half-staged commit lives in those gaps.

A stale holder is stolen — by age (30 s) or by a pid that is gone — so a cell
that crashed mid-commit unwedges itself without a human. Release only unlinks
**our** token, because a lock that can be pulled out from under a live holder is
worse than no lock. A studio verb that cannot acquire refuses in its own shape
("somebody else is saving this project right now") rather than throwing a 500 at
a panel.

Ordinary file writes are deliberately **not** locked: they are atomic per file
(tmp + rename) everywhere in this codebase, so a `git add` racing a canvas write
stages the old bytes or the new ones and the next quiescence commits the rest.
Locking a keystroke-debounced write against a 3-second commit cycle would buy
nothing and cost the editor its latency.

### 4. No quiesce RPC — as a finding, not a shortcut.

Every hub-side operation that rewrites the tree is **cold-start**:
`restoreLatest` is called only from `rehydrate.mjs`, which the cell entrypoint
runs as its own process before the hub starts, and `seedRepo` runs once against
an empty directory. There is no live hub operation the studio could be quiesced
for. The header of `repo-lock.ts` is where whoever adds one will find out they
need the RPC too.

### 5. Two writers nobody had counted.

- **A viewer could `checkout` and `pull`.** Both were `read` in the route
  manifest, on the reasoning that "looking at another branch is not changing
  one" — true for one user at one checkout, and false in a cell, where a viewer
  switching branches replaces the files under an owner who is mid-edit. Both are
  now `edit`. The desktop is unaffected: it never consults this manifest, and
  there the original reasoning still holds.
- **The tenant's own `.design/config.json` could start a third committer.**
  `linkedHub` is versioned, so it arrives with the checkout; honouring it inside
  a cell would dial OUT to a third-party hub carrying the project's canvases and
  run a second autocommit over the tree the hub is already committing.
  Unreachable by accident today — a cell has no `~/.config/maude/hubs.json`, so
  the token lookup returns null — and an accident is not an invariant. Workspace
  mode now refuses it and names which authority won.

## Consequences

- The cell's git write paths changed engine, and that engine **had no test
  coverage at all**: `MAUDE_USE_SYSTEM_GIT` was an escape hatch nobody set, so
  `commitSystem` and the system-git halves of checkout / branch / discard were
  untested while their iso twins were well covered. Shipping the flip that way
  would have traded a known bug for an unmeasured one. The flag is now read live
  rather than at module load — the same reason its neighbour `noSystemGit()`
  already was — and `test/git-system-engine.test.ts` runs the iso engine's
  assertions against the engine the cloud runs.
- `test/repo-concurrency.test.ts` is real git, real files, real contention, and
  it **fails without the lock** — verified by removing it, which produces exactly
  the interleaving the dissent describes: `one:add two:add two:commit one:commit`.
- A desktop pays one file create per git verb, uncontended.
- What is still NOT single-writer: two processes may still both write files, and
  the lock is advisory — a future writer that does not take it is not stopped by
  anything. The invariant is stated in one module and honoured in two; nothing
  enforces it structurally the way `check-no-studio-reimpl.sh` enforces E2.
