# DDR-200 — The share view serves bytes, not code: a browser surface that cannot execute anything

- **Date:** 2026-07-29
- **Status:** accepted
- **Scope:** `repo:maude`, `dept:dev`
- **Implements:** [DDR-197](./DDR-197-browser-surface-narrowing-of-ddr-192.md) · [DDR-193](./DDR-193-maude-cloud-tenant-cells-and-containment-invariant.md) §2
- **Plan:** `.ai/plans/archive/cloud-phase-18-browser-share-view.md`

## Context

An invite on a phone dead-ended at "install a desktop app". For the persona the
cloud arc is staked on (DDR-193 §5) that converts to zero. What a phone
invitee needs is to **see** the work — and seeing does not require anyone to run
the tenant's code.

## Decision

**The vendor serves finished pictures out of storage and interprets nothing.**

### 1. The share view never touches the cell

`view-<project>.cloud.maude.sh` reads snapshots straight from R2 through an R2
binding. It does not proxy to the project's container, does not open a
document, and does not wake anything.

This is the strongest available form of the containment claim: **the surface
anyone with a link can reach has no code path to the surface holding the
project's data.** It is also cheaper and faster than routing through a cell,
but that is a side effect, not the reason.

### 2. A separate origin from the workspace

The workspace holds sessions and an operator credential; the share view is
reachable by anyone holding a link. Same origin would mean a flaw in the
surface anyone can reach borrows the trust of the surface only members can.

### 3. SVG is excluded — this is the sharpest line in the feature

An SVG is a *document*: it can carry `<script>` and `<foreignObject>`. Serving
one on the share origin would hand tenant-authored markup a same-origin
execution context. PNG, JPEG, WebP and AVIF are inert. The allowlist is
therefore a list of **formats**, not "images", and the same exclusion is
enforced twice — at publish (`cli/lib/share-plan.mjs`) and at serve
(`apps/cells/share.mjs`) — with each side naming the reason so they cannot
drift into disagreeing.

### 4. No script on the page at all

Server-rendered HTML, `default-src 'none'`, no `<script>`, no inline handlers,
no `javascript:` URLs — asserted in tests. A page that shipped JavaScript would
make the containment claim something to argue about rather than something
anyone can check in ten seconds.

### 5. Rendering happens on a member's machine

`maude share publish` takes the screenshots locally and uploads finished
images. A "publish" button that made the server render would be a one-line
convenience that deletes the invariant this whole surface exists to preserve.

### 6. Default closed, and closed on every failure

Sharing is on only when `tenants/<id>/share.json` says `enabled: true`. A
missing marker, an unparseable one, an unreachable bucket and a project that
does not exist all produce the identical "nothing to see here" — which also
means the endpoint is not a directory of every customer.

The marker is written **last**, after the images. Its presence is what turns
sharing on, so writing it first would expose a half-published gallery — the
same reasoning as the backup manifest.

### 7. The view never implies liveness

A snapshot is always as-of some moment. Every page carries the stamp, whether
or not anything looks stale — **a warning that appears only when stale teaches
people that its absence means current.** A canvas with no snapshot says nobody
has shared it yet, rather than rendering as an empty project. Ages are plain
language ("4 days ago"), never a raw timestamp that makes the reader do
arithmetic to answer the only question they have.

## Consequences

- Browser **editing** remains out of scope; Phase 21 decides its future and
  BUILDER's client-side-eval dissent is preserved there.
- Comments in the browser (plan T2) are not built. Seeing was the part that
  converted a dead end into a working link; saying something still requires the
  desktop.
- A published view is a point-in-time copy that does not update itself. That is
  stated on every page rather than being a caveat in documentation.

## Verified

alligators: 44 canvases published from a laptop, visible at
`https://view-alligators.cloud.maude.sh` with no install and no account.
Sharing refused before it was enabled; `POST` refused (405); `/s/logo.svg` and
`/s/../hub.db` both 404.
