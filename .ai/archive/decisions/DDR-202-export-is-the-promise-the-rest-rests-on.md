# DDR-202 — The export is the promise the rest of the product rests on

- **Date:** 2026-07-29
- **Status:** accepted
- **Scope:** `repo:maude`, `dept:dev`
- **Implements:** [DDR-193](./DDR-193-maude-cloud-tenant-cells-and-containment-invariant.md) §3
- **Plan:** `.ai/plans/cloud-phase-20-self-administration.md`

## Context

A design tool that holds your work hostage is not a tool anyone can commit to.
DDR-193 §3 already made purge reachable **only** through `exported` — there is
no path from "stopped paying" to "your designs are gone" that skips "you were
handed your files". That machine was tested; nothing produced the files.

## Decision

**An export is a git bundle, an asset manifest, and a plain-language README —
and it states what it does NOT contain.**

### It is the history, not a copy of the current files

`git bundle --all`: every commit, every ref. `git clone repo.bundle <name>`
gives back a normal git repository that depends on nothing of ours. A zip of
the working tree would lose the record of how the work got there, which is most
of what a design project is.

### The media is listed, not enclosed

Assets are content-addressed objects and a project's media routinely runs to
hundreds of megabytes. Copying them into every export would make exporting
expensive enough that people stop doing it — **which is the same as not
offering it**. `assets.json` names every object with its storage key and byte
count, so retrieving them is a loop rather than a guess, and a reader can tell
whether their download finished.

### It says what is missing, as prominently as what is there

`MANIFEST.md` has a `## What is NOT here` section: comments and per-machine
state (outside the versioned project by design), the media bytes, and anything
belonging to another project. **An export that quietly omits something is worse
than one that refuses** — the reader finds out months later, when the original
is gone.

It also tells the reader how to distinguish a bad download from a bad archive
(`git bundle verify`), because at the moment somebody is leaving, "it will not
open" with no next step is the worst possible answer.

### It is verified before it is offered

The bundle path already verifies (DDR-199 / Phase 15). Handing someone a
corrupt archive at the moment they are leaving is the worst possible time to be
wrong.

### A failure in the media listing must not cost the export

An unreadable assets directory yields an empty manifest, not a failed export.
The history is the irreplaceable part; trading it for a complete listing would
be the wrong trade at the worst moment.

## Consequences

- `stepToward('purged')` now has something real behind the state it requires.
- Exports are timestamped and never collide, so "latest" is lexical and an
  earlier export is never overwritten by a later one.

## Not built

The self-administration surfaces that would let a customer do this without a
terminal: the project dashboard, members, billing portal link, the delete
button, and the customer-visible audit log page. The export itself was the part
that had to exist first — the buttons are mechanical, and a delete button with
no working export behind it would be a promise the product could not keep.
