# DDR-215 — The canvas path travels in-band, and is believed only because it slugs back to its own document

- **Date**: 2026-08-07
- **Status**: Accepted
- **Scope**: `repo:maude`, `dept:dev`
- **Area**: canvas sync, hub workspace agent, cell materialisation
- **Relates to**: DDR-054 (hub-pushed content is untrusted), DDR-102, DDR-115
  (runtime-state taxonomy), DDR-196 (the workspace agent's decision/effects
  split), DDR-214 (one honest sync-status rule)

## Context

A canvas synced; its **location** did not. A document name carries a flattened
slug (`ui/2026/social/summer-camp.tsx` → `ui-2026-social-summer-camp`), and
`/` → `-` is not reversible, so neither receiver could reconstruct the folder.

Both gave up the same way, and each deferred to the other. The studio's
`pullTargets` wrote the body flat at the design root, commenting that a flat file
"is trivially moved". The hub's `defaultBodyPath` did the same, commenting that
"a desktop peer — which knows the real path — will move it on its next sync."
**Neither was a mechanism.** Nothing moved anything, and the two comments
together described a hand-off that did not exist.

Flat was also worse than untidy. The file tree and `scanCanvases` both enumerate
`config.canvasGroups` (`system/`, `ui/`), so a file at the design root is inside
no group: not listed, not scanned, not synced onward. Observed on the live fleet
(`alligators` ↔ `alligators.cloud.maude.sh`): the hub held 76 documents with full
bodies, the cell's design root held 71 `.tsx` files, and three canvases the
desktop had created appeared nowhere in the cloud. The desktop's own log said
`76/76 synced`, and it was telling the truth.

## Decision

**1. The path travels in the document, as `syncMeta.path`.**

`syncMeta` already exists per document (`bodyEditAt` / `by` / `seededBy`), is
already synced, is already optional on the wire, and is already never
materialised to disk. Adding a field there is invisible to every peer that does
not know about it.

The document NAME was rejected as the carrier: it is identity. Encoding the path
into it would orphan every document in every deployed hub and break the
`pathIndex` warm path for canvases that work today.

**2. The receiver validates rather than trusts, and rule 7 is why it is safe.**

`apps/studio/sync/canvas-path.ts` accepts a path only if it is a bounded,
control-character-free, relative, `/`-separated, dot-component-free, `.tsx` path
whose every component matches the canvas charset, which resolves inside a
declared canvas group — **and which slugs back to the document that carried it**
(`canvasSlugFromRel(path) === slug`).

That last rule is the load-bearing one. It makes a hostile path self-defeating:
a path pointing somewhere else no longer addresses this document. The value is
not believed because the sender is trusted (DDR-054 says it is not); it is
believed because it was checked against a value the receiver derived
independently. `canvasSlugFromRel` is IMPORTED, never re-typed — a drifting copy
would turn the whole check into decoration.

**3. One module, two runtimes.** The hub imports the studio's validator and the
`apps/hub/Dockerfile` copies it into the image, exactly as it already does for
`sync/autocommit.ts` and `cloud/mirror.mjs`. Re-typing a guarantee in `.mjs` is
re-typing it without its traversal corpus — and this bug is what a decision
spelled twice looks like after a year.

**4. A refused or absent path degrades; it never loses the canvas.** The
fallback is still flat, but it lands inside the canvas group **the slug came
from** — `ui-legacy` → `ui/legacy.tsx`.

That prefix-stripping is not cosmetic. `ui/ui-legacy.tsx` would be visible and
would slug to `ui-ui-legacy`: a SECOND document syncing the same bytes, with the
original orphaned on the hub. A fallback may not fork a document, so a slug
matching no declared group keeps today's design-root behaviour — invisible, but
the same document, and no worse than before.

**5. `pathIndex` still wins on the hub.** A file the checkout already holds is
never relocated by a remote path, or a peer could move another peer's work.

**6. A fresh link may accept a group it has not been told about — once.**
`config.json` is not in the sync lane, so a bare folder runs on the DEFAULT
groups, and a project whose author calls their group `screens` would have every
path refused. On a boot with no local canvases and no `config.json`, an
undeclared group is accepted (rules 1-7 untouched) and the groups actually seen
are written into a `config.json`. The relaxation therefore applies once; a
project that has declared itself is never edited.

**7. Rule 7 governs a path's IDENTITY, not its DESTINATION.** This is the
distinction the adversarial review turned up, and it is the one a future reader
is most likely to get wrong. Rule 7 proves a path belongs to *this document*. It
says nothing about what already occupies that location — so a second gate,
`admitPullTarget`, refuses a target that

- **already exists on this disk.** "Hub-only" means "no local DESCRIPTOR", not
  "no local file": `scanCanvases` omits a canvas whose `.meta.json` says
  `syncable: false` (a security opt-out a hub must not be able to flip) and one
  the TSX sandbox gate excluded. Such a canvas is classified hub-only and pulled,
  and its target is the real file.
- **means something other than a canvas.** `.css`/`.meta.json` are derived from
  the body path and `system` is a DEFAULT group, so `system-colors_and_type`
  writes its css lane straight over `tokensCssRel` — the stylesheet the server
  serves.

Both gates are applied to the FALLBACK as well as to a carried path, because the
two resolve to the same place: the fallback is derived from the slug and the slug
from the path. A guard on the carried path alone would have left every one of
these reachable *with no path on the wire at all*. `existsSync` also settles the
case-insensitive collision for free — `ui/card.tsx` IS `ui/Card.tsx` on macOS,
which is exactly how the fallback reached a file the project meant to exclude.

**8. Containment is checked THROUGH symlinks.** `resolve()` is purely lexical and
never follows one, while `mkdirSync(recursive: true)` traverses an existing one
without complaint. While the only reachable target was a flat file at the design
root this could not be reached; the sender choosing the DIRECTORY is what turns a
`.design/ui/x -> /etc` symlink — which git tracks, so a repo supplies it for free
— into a write-outside primitive. Both receivers now realpath the deepest
existing ancestor and re-assert containment against the real root.

**9. The untrusted markers are re-emitted after relocation.**
`writeUntrustedMarkers` (DDR-054 §3 F3) was computed from the PROVISIONAL
descriptor set — every pulled entry still a fallback — and the descriptors are
then mutated in place. Marking once left `_untrusted/INDEX.json` and the
`.claudeignore` block naming a file that is never created, while the genuinely
hub-pushed body sat elsewhere, listed nowhere: the control pointing at a phantom.
Re-marking happens synchronously on each relocation, not in the boot-settle
handler — that handler is fire-and-forget, so a short-lived process never reaches
it, and the window in between is precisely when the marker is wrong.

**10. The fresh-link relaxation closes behind itself.** `freshLink` was a `const`,
so once the first config was written every FURTHER undeclared group was accepted
and appended — self-perpetuating rather than self-closing, and a hub free to
plant directories all session. It is now cleared the moment one group is learned.
Emptiness is also a fact about the FOLDER (`designRootIsBare`), not about the
scan: the scan walks declared groups only and applies the syncable + sandbox
gates, so a project with real work in it scans to zero for several innocent
reasons, and a hub must not get to author a `config.json` into it.

## Consequences

- A canvas in a new nested folder arrives at the same relative path in both
  directions, and linking a project into an empty folder brings the structure.
- The wire gains one optional field. Old peer → new hub and new peer → old hub
  both degrade to the fallback, which is now visible rather than lost.
- The path is resolvable only AFTER a document syncs (the listing carries names
  and byte counts only), so the studio computes a provisional target and
  re-decides it at `onceSynced`, deferring the agent's construction for pulled
  canvases only.
- Both new writers use `atomicWrite`, not `writeFileSync` — `config.json` is
  what rule 8 reads, so a torn read transiently widens the path policy.
- `defaultBodyPath` is deleted rather than deprecated. Leaving it would leave
  its comment, and its comment is the false promise this DDR exists to retire.

## Rejected

- **Derive the path by searching for a matching file.** That is what `pathIndex`
  already does, and it is precisely the case that fails: a canvas the receiver
  has never seen has no file to match. It cannot fix the new-folder case by
  construction.
- **A project-level slug→path manifest document.** One extra document, a second
  write path, and a new class of conflict (two peers editing the manifest) to
  carry information each document already knows about itself — plus an ordering
  dependency that does not exist today.
- **Solving moves.** A move changes the slug, hence the identity, so the old
  document lingers on the hub. Real, pre-existing, and a different feature
  (garbage-collecting orphaned documents).
