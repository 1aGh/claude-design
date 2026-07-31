# Cloud Phase 18 — The browser surface: read-only share view (DDR-197 territory)

> The debate's unanimous near-term shape: what a phone invitee needs is to SEE
> and to SAY something — neither requires vendor compute to evaluate tenant TSX.

## Containment posture — held, and tested

- [x] Vendor serves ONLY PNG/JPEG/WebP/AVIF. SVG excluded (script/foreignObject).
- [x] Isolated origin `view-<project>.cloud.maude.sh`, strict CSP, no script.
- [x] Share toggle default OFF; every view stamped with how old it is.
- [x] The share view never reaches the cell at all — it reads storage directly,
  which is a stronger claim than the plan asked for.

## Tasks

- [x] T1 — snapshot publish pipeline (desktop-side): `maude share publish`
  uploads a directory of screenshots (typically a `maude design smoke`
  out-dir) to the project prefix. Runs on the MEMBER's machine only.
- [x] T2 — share view: gallery + per-snapshot serving. **Comments NOT built**
  — see Deliberately not done.
- [x] T3 — access: default off, on via `maude share publish`, off via
  `maude share off`. Per-project public link. Signed/expiring URLs not built.
- [x] T4 — staleness honesty: every page stamped; a project with no snapshots
  says nobody has shared yet rather than rendering empty.
- [x] T5 — tests: SVG rejection, CSP, no-script, path containment, origin
  separation, default-closed, plain-language ages.

## Acceptance criteria

- [x] A phone invitee taps a link and SEES the project — no install, no git,
  no dead end. Verified: 44 alligators canvases at
  `https://view-alligators.cloud.maude.sh`.
- [ ] …and leaves a comment. NOT built (see below).
- [x] Nothing in the serving path evaluates tenant-authored code. The serving
  path is an R2 read and a `<img>` tag; there is no code path that could.

## Deliberately not done

**Comments in the browser.** The acceptance criterion asked for see-and-say;
this delivers see. Seeing is what turned a dead end into a working link, and it
carries no write surface at all — which is why it could ship as a page with no
script on an origin with no session. Comments need identity, a write path and
moderation on the surface anyone with a link can reach, and each of those is a
decision, not an increment. Recorded as an open follow-up rather than
half-built.

**Signed, expiring share URLs.** Sharing is currently per project and binary.

## Decisions recorded

- [DDR-200](../archive/decisions/DDR-200-read-only-share-view-serves-bytes-not-code.md)

## Retro

- **Reading the constraint carefully made the feature smaller and safer.** The
  plan allowed serving from the cell; noticing that snapshots are just bytes in
  a bucket removed the cell from the path entirely. The containment claim went
  from "the cell does not render" to "the public surface cannot reach the
  cell".
- **One test caught a test, not a bug.** `/on[a-z]+=/` matches inside
  `content=`, so the no-inline-handlers assertion failed on correct markup.
  Anchoring to an attribute boundary fixed it. Worth remembering that a
  security assertion which fires on good input gets weakened by whoever is in a
  hurry.
- The publish path reuses `design smoke` verbatim — it already writes one PNG
  per canvas. `smoke` needs a running dev server, which the first run did not
  have and reported as 44 × `open-failed`; a clearer message there would have
  saved a cycle.
