# DDR-209 — One studio, three shells: the cell serves the studio, and the prune list is reclassified rather than loosened

- **Date:** 2026-08-03
- **Status:** Accepted
- **Area:** cloud / containment / cell / studio / proxy
- **Tags:** cloud, cell, containment, studio, canvas, proxy, role, DDR-193, DDR-195, DDR-206
- **Plan:** [`cloud-phase-27-one-studio-three-shells.md`](../../plans/cloud-phase-27-one-studio-three-shells.md) — Track A′
- **Amends:** DDR-193 §2 (the forbidden-surface vocabulary), DDR-195 ("a cell is the same server minus routes")
- **Extends:** Cloud Phase 25 A0 (the cell BUILDS, the browser EVALUATES)

## The situation this decides

Cloud Phase 25 B3 shipped `apps/hub/src/canvas/studio-page.mjs` — 469 lines
re-implementing a studio whose real client is 15,073 lines. The owner opened
`alligators.cloud.maude.sh` and found a different, poorer application than the
one on his desktop. Phase 27 deletes the reimplementation and runs the real
`apps/studio` server inside the cell, behind an authenticating proxy.

Doing that runs straight into a conflict the plan (Track A′) requires settling
**in writing, before any code**, because the alternative is discovering it as a
red build and "fixing" it by weakening a security guard:

> `pruneForWorkspace()` currently forbids the very routes the cloud studio needs.

`FORBIDDEN_ROUTE_PREFIXES` blocks `/_canvas-shell` and `/_canvas-runtime`. Boot
the real studio in workspace mode today and it refuses exactly the routes the
browser door is made of.

Three questions, decided here.

---

## A′1 — What the containment vocabulary is actually about

**Decision: the forbidden list is reclassified, not shortened. `/_canvas-shell`
and `/_canvas-runtime` move out of "forbidden" and into a NEW, narrower list
whose members are permitted only while an asserted contract holds; seven
secret-bearing surfaces move IN.**

### Why the two entries were listed, and why that reasoning expired

DDR-193 §2 states the invariant:

> No tenant-authored TSX is ever evaluated by vendor-operated compute.

The two entries were written under a premise that a cell is a sync relay which
must never render, so their stated reasons are about rendering:

- `/_canvas-shell` — "the surface that mounts and executes a canvas module"
- `/_canvas-runtime` — "serving the canvas runtime only makes sense if something
  here renders a canvas"

Phase 25 A0 amended the premise: **the cell BUILDS, the viewer's browser
EVALUATES**, in a segregated origin. Under A0 both reasons are now false as
written:

- `/_canvas-shell` returns a static HTML harness with a strict CSP. The cell
  emits a string. The **browser** mounts and executes. Nothing on our compute
  evaluates tenant code by serving it.
- `/_canvas-runtime/*` serves **vendor** bundles — React, motion — pre-built at
  image build from our own source. There is no tenant byte in them, and serving
  them evaluates nothing. The premise "only makes sense if something here
  renders" is precisely what A0 replaced: it makes sense because the browser
  renders.

Leaving them on the list would not be caution; it would be a stale sentence
forcing a second implementation of the browser door — which is the drift this
whole phase exists to delete.

### Why this is a reclassification and not a loosening

`assert-containment.sh` says it best about itself: *"a guard you had to loosen to
keep your build green is a guard that will be loosened again."* So the test
applied here is not "does the build go green" but **"is the guard strictly
stronger after the change than before?"** It is, on four counts:

1. **The two entries do not become unguarded — they become CONDITIONALLY
   permitted.** A new `SANDBOXED_ROUTE_PREFIXES` list names them together with
   the contract that makes them safe, and the boot-assert refuses to start when
   the contract is not armed. Before: absent. After: present only while the
   out-of-process, empty-environment, import-allowlisted build is proven wired.
   A route that used to be *missing* is now *attested*.

2. **The invariant's wording is corrected to what it always protected.** The
   test is EVALUATION on vendor compute, never the serving of bytes. Stated that
   way it keeps catching the 2027 thumbnail endpoint (which would evaluate) and
   stops mis-catching a static harness (which does not).

3. **Seven secret-bearing surfaces join the forbidden list** (Track D1):
   `/_api/cloud`, `/_api/github`, `/_api/hub`, `/_api/claude`, `/_api/acp`,
   `/_api/debug-bundle`, `/_api/design`. These are reachable in a cell today and
   were never named. The net movement of the vocabulary is +7 forbidden, −2
   reclassified-with-a-contract.

4. **The strongest line is untouched.** No browser enters the image. The
   Dockerfile assertion, the entrypoint re-check, the direct-dependency gate and
   the transitive `pnpm why` gate are unmodified. A cell still *cannot* render,
   whatever any route table says.

The CI gate (`scripts/check-containment.sh`) asserts BOTH lists plus the sandbox
arming, so removing the contract is as red as removing a forbidden prefix.

### What stays forbidden, unchanged

`/_api/export` (renders through a headless browser), `/_api/photo-edit` (decodes
tenant media in-process), `/_api/generate` (runs tenant prompts against a
provider key held here), `/_ws/acp` (spawns the user's own `claude` — DDR-123 is
desktop-only).

---

## A′2 — Who serves a canvas

The debate split. SHIPPER would delete `apps/hub/src/canvas/{build,build-worker}`
as redundant once the studio builds its own; BUILDER would keep the hub's canvas
origin and merely point `ctx.canvasOrigin` at it.

**Decision: SHIPPER. The studio serves the canvas — its shell, its module, its
runtime, its assets. The hub's canvas-origin implementation is deleted.**

### Why BUILDER loses despite being the smaller diff

BUILDER's option leaves two implementations of "serve a canvas" in the tree
permanently, because the studio's own shell and build **cannot** be deleted —
the desktop needs them. The cell would use the hub's, the desktop the studio's,
and the acceptance criterion this phase is written against ("**No route is
served by two implementations. A canvas is built by one builder**") would be
unmeetable by construction. It also reproduces exactly the B3 failure at one
level down: a second, poorer implementation of a surface that already exists,
kept alive because deleting it is someone else's phase.

### The objection BUILDER was right about, and how it is answered

BUILDER's real point is not the diff size — it is that `apps/hub/src/canvas/`
is not a naive copy. It is a **sandbox host** (Phase 25 A1): a separate process
under Bun with an empty environment, an import allowlist, a wall-clock deadline
and an RSS ceiling. The studio's own in-process `buildCanvasModule` has none of
those. "Delete the hub's builder" must not mean "build tenant source in the
cell's main process, next to `HUB_SECRET`."

It does not, because **there was only ever one engine**. `build-worker.ts`
imports `apps/studio/canvas-build.ts` — the hub's modules are a *host* around
the studio's engine, not a second engine. So the duplication being deleted is
the host, and the resolution is:

> **One engine, one host: the sandbox moves INTO the studio's workspace-mode
> path.** In workspace mode the studio's canvas-module route does not call
> `buildCanvasModule` in-process — it spawns the same bounded child, with the
> same empty environment, the same `restrictImportsTo`, the same ceilings and
> the same content-hash cache. On the desktop the in-process path is unchanged.

The Phase 25 A1 properties are preserved verbatim and keep their CI assertions;
what changes is which process owns the host, not what the host guarantees. This
is also why `SANDBOXED_ROUTE_PREFIXES` (A′1) exists: the canvas surfaces are
permitted **because** the sandbox is armed, and the boot-assert checks that
rather than trusting it.

---

## A′3 — The hub's now-redundant canvas modules

**Decision: deleted in the same change that lands the proxy. Nothing survives
behind a flag.**

| Module | Verdict |
| --- | --- |
| `canvas/studio-page.mjs` | **Deleted.** The reimplementation this phase exists to remove. |
| `canvas/build.mjs`, `canvas/build-worker.ts` | **Deleted** — the host moves into the studio (A′2). The cache, the counters, the ceilings and the empty-env spawn move with it, not away. |
| `canvas/shell.mjs` | **Deleted.** The studio's `serveCanvasShell` is the one harness. |
| `canvas/project.mjs` | **Deleted** except `designRootFor()`, which is not a studio reimplementation — it is how the *hub* resolves the tenant's design root for its own git/asset lanes. It moves to `src/design-root.mjs`. |
| `canvas/edits.mjs` | **Deleted.** A structured edit op is a write the studio already owns; the proxy forwards to it. |
| `canvas/comments.mjs` | **Deleted.** Phase 25 B5 made both surfaces write the SAME `<designRoot>/_comments/<slug>.json`, so there is **no data migration** — only a second implementation of a read/write path the studio owns. |
| `canvas/render-token.mjs` | **Kept, with a new job.** It is not a studio reimplementation; it is the proxy's capability auth for the **cookieless** canvas origin. A cookie scoped wide enough to cover `canvas.cloud.maude.sh` would be readable by the untrusted canvas origin — which would defeat the DDR-054 split entirely. The capability stays in the URL. |
| `canvas/browser-auth.mjs` | **Kept.** Session termination is the proxy's job, not the studio's. |
| `canvas/routes.mjs` | **Reduced to the proxy** — session → role → deny-by-default manifest → forward. It stops rendering anything. |

---

## Consequences

- The browser loads the byte-identical `client.bundle.js` the desktop loads.
  Files, Layers, Inspector, search, branch/LIVE status arrive for free, because
  they are not reimplemented.
- One new failure mode: the studio is now a **supervised child process** of the
  cell. A dead child must make the CELL unhealthy (Track A1/D5) — a container
  that answers 200 while half-dead is worse than one that is down.
- The client gains exactly one cloud-only input: a canvas capability token
  (`cfg.canvasToken`), appended by `canvasUrl()` the same way `readOnly` already
  is. It is a flag, never a fork of the component (Track C4's rule).
- `role` becomes **per-request**, injected by the proxy. The studio's own
  `projectReadOnly()` gate stays as defence in depth and, in a cloud build,
  **defaults to read-only** — because it currently fails OPEN (`isHubReadOnly()`
  returns `false` from its `catch`; `projectReadOnly()` returns `false` when
  `linkedHub` is unset), which is correct for a local tool and is the whole
  ballgame on the internet.

## Alternatives rejected

- **Keep `studio-page.mjs` "just for this release."** This is USER-ADVOCATE's
  named reservation and it is rejected on record: the hand-written page survives
  exactly as long as it is allowed to, and the first thing every invited
  teammate sees stays grey boxes. It is deleted in the same change as the proxy.
- **Loosen `pruneForWorkspace()` to unblock the build.** Rejected explicitly;
  see A′1's four-count test. The vocabulary is reclassified with a contract and
  grows by five net entries.
- **Run the studio as a second container.** A second container is a second
  network boundary, a second image, a second cold start and a second thing to
  version against the first. The two processes share `/repo` by nature; putting
  a network between them buys isolation we do not get to use, since either can
  write the tree.
