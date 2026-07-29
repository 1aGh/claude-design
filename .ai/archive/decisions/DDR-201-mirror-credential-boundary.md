# DDR-201 — The mirror credential boundary: a cell asks, it never holds

- **Date:** 2026-07-29
- **Status:** accepted
- **Scope:** `repo:maude`, `dept:dev`
- **Implements:** [DDR-192](./DDR-192-remote-workspace-server-architecture.md) · builds on [DDR-198](./DDR-198-server-owned-git-history-in-the-hub.md)
- **Plan:** `.ai/plans/cloud-phase-19-mirror-effects.md`

## Context

Mirroring a workspace to the customer's own GitHub needs a credential that can
push. The obvious place to put it is the thing that pushes — the cell. That is
the wrong place, and the reason is arithmetic rather than taste.

## Decision

**The GitHub App private key lives in the control plane and nowhere else. A
cell asks for a token; it never holds one it did not just receive.**

### Why not in the cell

The App private key can mint a token for **every repository the App is
installed on**. Putting it in a container means one compromised tenant is a
credential for every other tenant's GitHub — including repositories those
customers never connected to Maude.

A cell instead POSTs `/internal/mirror-token` presenting its own derived secret
(DDR-199 §6) and receives a token scoped to one repository, valid about an
hour. The blast radius of a compromised cell becomes exactly that cell's own
mirror, which is what it would have had anyway.

### Two checks, and the second is the one that matters

1. The caller proves it is that tenant's cell — its derived secret, compared in
   constant time.
2. **The repository it asks for is the one THAT tenant has configured**, read
   from the control plane's own database.

Without (2), any cell could ask for a token to any repository the App covers,
and (1) would happily pass. The owner half of `owner/name` is never the cell's
to choose; it comes from the stored configuration.

### The token is scoped, not general

`repositories: [name]` on the mint call. An unscoped installation token writes
to everything the installation covers — so a tenant mirroring to their own repo
would hold a credential for every other repo the owner installed the App on.

### It is never written down

Not to `.git/config` via `git remote add`, not to a log, not to disk. `git push
<url> <refspec>` takes the URL as one argv entry, so the credential exists in a
single process argument and in no file. A stored remote would put a live
credential in a directory the tenant's own tooling reads — and that the next
backup copies.

Every log path goes through `redactPushUrl`. A token in a log is a token on
disk forever.

### Failures say who has to do something

`classifyPushResult` already distinguished diverged / unauthorized / missing;
this wires it. **A diverged mirror stops.** Something exists there that Maude
did not put there, and destroying it is not ours to decide — so the message is
"nothing was overwritten", and no force flag is ever offered. The argv comes
from the tested builder rather than being re-typed, because that module's tests
assert the *absence* of a force flag, and absence is exactly what a later edit
adds with nothing noticing.

## Consequences

- The App key becomes a control-plane secret with a real blast radius. Rotating
  it rotates every mirror at once, which is the correct coupling.
- `projects.mirror_repo` / `mirror_branch` (schema v3) are the authority on
  where a project may push. A mirror cannot be redirected from inside a cell.
- A cell that cannot reach the control plane cannot mirror. That is acceptable:
  a mirror is a copy, and the workspace has the data.

## Not built yet

The scheduled push is not wired into the cell's runtime loop, and there is no
settings surface — a mirror is configured by writing the project row. Both are
mechanical; the credential boundary was the part that had to be right first,
because it is the part that cannot be fixed later without a rotation.
