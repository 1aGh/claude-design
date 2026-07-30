# DDR-205 — Verify a backup when you WRITE it, not when you need it

- **Date:** 2026-07-30
- **Status:** accepted
- **Scope:** `repo:maude`, `dept:dev`
- **Strengthens:** [DDR-202](./DDR-202-export-is-the-promise-the-rest-rests-on.md) · [DDR-199](./DDR-199-cells-on-cloudflare-and-the-four-things-deploying-taught-us.md)

## What happened

The alligators cell crash-looped. Reproduced locally rather than guessed at:

```
error: Could not read cfa54ed2…
fatal: remote did not send all necessary objects
```

`seedRepo` cloned with `--depth 1`. **`git bundle create --all` exits 0 on a
shallow repository** and writes an archive referencing parent commits it does
not contain. The cell checkpointed happily for a day — nineteen objects, 232 MB
— and not one of those generations could be restored.

## Why the existing guards did not catch it

They were all on the **read** side. `restoreRepo` verifies, and it worked
exactly as designed: it detected the bad bundle and refused. The entrypoint
then refused to start, also as designed.

Every individual guard behaved correctly and the outcome was still a tenant
who could not reach their work and a day of backups that were decoration.
DDR-202 said "verified before it is offered". That is not early enough — by
then the only copy is the bad one.

## Decision

**Verification belongs at the moment of writing.**

1. `bundleRepo` runs `git bundle verify` before returning the bytes. "It was
   written" is not "it can be restored", and the only moment anybody discovers
   the difference is the moment they need it. **No backup is a visible state; a
   backup that is not one is invisible.**
2. A shallow checkout is refused outright, with the reason. It cannot produce a
   complete bundle at all, so there is nothing to verify.
3. The seed clones in full. The extra bytes at seed time are the cheapest part
   of this system.

### And a failed generation must not be the end of it

`rehydrate` now walks back through generations. A cell whose newest backup is
bad still has yesterday's, and refusing outright left the tenant unreachable
over a fault older copies did not share — "refuses to start" is indistinguishable
from "the platform is broken" to the person looking at it.

Restoring an older copy is **loud**: a tenant who has lost work should learn it
from a message, not from noticing the data is old.

## The generalisation worth keeping

An integrity check on the read path proves the reader is careful. It says
nothing about whether the artifact was ever any good. **Any artifact whose
whole purpose is to be used later — a backup, an export, a published bundle —
must be validated at creation, by exercising the thing it will be used for.**
Here that means: do not merely create the bundle, clone it.

## Verified

Nineteen unrestorable objects deleted; alligators reseeded from a full clone.
The first new generation was downloaded and cloned in anger: 14 commits, 44
canvases, `--is-shallow-repository: false`.
