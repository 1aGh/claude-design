# Cloud Phase 18 — The browser surface: read-only share view (DDR-197 territory)

> The debate's unanimous near-term shape: what a phone invitee needs is to SEE
> and to SAY something — neither requires vendor compute to evaluate tenant TSX.
> **Prerequisite: DDR-197** (narrows DDR-192 §4 to what it protects: no
> vendor-side evaluation, no browser AI chat; a read-only non-executable surface
> is permitted). Browser EDITING remains forbidden — Phase 21 spike decides its
> future; BUILDER's client-side-eval dissent is preserved there.

## Containment posture (non-negotiable, tested)

- Vendor serves ONLY: PNG/JPEG snapshots (SVG excluded — script/foreignObject),
  comment text, presence JSON. Bytes it never interprets.
- Isolated origin (`view.<project>.cloud.maude.sh` or equivalent), strict CSP,
  cookieless for assets; the cell's boot-assert and CI grep gate stay green.
- Share toggle default OFF; every view stamped "as of <time>, rendered by <name>".

## Tasks

- [ ] T1 — **snapshot publish pipeline** (desktop-side): export-on-autosave of
  changed canvases → PNG → R2 under the project prefix. Reuses the existing
  screenshot/export machinery; runs on the MEMBER's machine only.
- [ ] T2 — share-view SPA: canvas gallery, per-canvas view, comment threads
  (stored as hub docs — comments already exist as a data shape), presence.
- [ ] T3 — access: signed-in members always; optional public link per project
  (default off) with revocable, expiring signed URLs.
- [ ] T4 — staleness honesty: the view NEVER implies liveness; missing snapshot
  renders as "not yet shared from a desktop", not as empty.
- [ ] T5 — tests: CSP/origin assertions, SVG rejection, share-off-by-default,
  vocabulary lint, containment gate extended to the share-view routes.

## Acceptance criteria

- [ ] A phone invitee taps an invite and within one minute SEES the project and
  leaves a comment — no install, no git, no dead end.
- [ ] Nothing in the serving path evaluates tenant-authored code (gate-proven).
