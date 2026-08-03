# Cloud Phase 27 — One studio, three shells

> Written after the owner opened `alligators.cloud.maude.sh` and found a
> different, poorer application than the one on his desktop: no Files or Layers
> panels, no menu bar, a different toolbar, no search, no branch/LIVE status —
> and every photograph a grey box, every webfont a fallback.
>
> **Phase 25 built the plumbing and then hand-rolled the product.** This phase
> deletes the hand-rolled part and connects what was already there.

## What actually happened

Phase 25's B3 shipped `apps/hub/src/canvas/studio-page.mjs` — **469 lines**
re-implementing a studio whose real client is **15,073 lines**
(`apps/studio/client/app.jsx` → `dist/client.bundle.js`). The expectation was
never a browser-flavoured studio; it was the desktop arrangement applied again:
`apps/desktop` is a thin Tauri shell that spawns the compiled studio server and
points a webview at it (DDR-106). The cloud should wrap the same server and add
auth.

**The repo already said so, twice, before B3 was written:**

1. `apps/studio/workspace-mode.ts` exists precisely so a cell runs the studio's
   own code path with dangerous routes pruned at boot — its whole reason for
   being is that "a second implementation would drift".
2. Phase 25's own C2 built the front-door contract: `/_config` returns
   `readOnly` derived from the role a workspace vouched at sign-in, with the
   comment "it decides what the UI OFFERS and is never what stops a write — the
   cell enforces that".

B3 is the drift both were written to prevent. **This phase is not a new
architecture. It is deleting a detour and joining two shipped halves.**

## The decision (divergent debate, 2026-08-03 — 4 seats, converged, no cross-challenge)

**BUILDER · SHIPPER · BREAKER · USER-ADVOCATE all returned `devserver-in-cell`**
(confidence 9 / 9 / 7 / 9).

**Run the REAL `apps/studio` Bun server inside the cell as a supervised,
loopback-only child; the hub stops rendering UI and becomes a default-deny
authenticating reverse proxy in front of it.** One studio, three shells: Tauri,
cell, npm CLI. The browser loads the byte-identical `client.bundle.js` the
desktop loads.

### Two facts the debate produced that change the design

**The C2 role contract does not survive multi-tenancy as written.**
`projectReadOnly()` → `isHubReadOnly()` reads a per-PROCESS config file — one
role per hub URL. Correct for a desktop with one user; wrong for one cell
process serving an owner and a viewer at once. And it is two-valued
(viewer / not-viewer) against a matrix of 3 roles × 8 capabilities.
→ **The proxy owns the per-session role**, injects it per request, and the
studio's own gate stays as defence in depth, never as the authority.

**That gate fails OPEN — verified, not alleged.**
`isHubReadOnly()` returns `false` from its `catch`; `projectReadOnly()` returns
`false` when `linkedHub` is unset. An unset config or a thrown `normalizeUrl`
yields a fully writable studio. Correct for a local tool; on the internet it is
the whole ballgame.
→ **In a cloud build, read-only is the DEFAULT and an edit role requires
positive proof.**

## Tracks

### Track A — the studio serves the studio

- [x] **A1 — spawn the real server as a supervised child.**
  `bun apps/studio/server.ts --root /repo` with `MAUDE_WORKSPACE_MODE=1`, bound
  to 127.0.0.1, own uid, empty env, restart-with-backoff. A dead child makes the
  CELL unhealthy — two processes under tini with no supervisor is how you get a
  container that answers 200 while half-dead.
- [x] **A2 — the hub becomes a default-deny proxy.** Session termination,
  role → capability from `role-matrix.mjs`, a checked-in DENY-by-default
  `(method, path) × role` manifest covering reads too, and WebSocket upgrade
  proxying. The studio's `readOnlyRefusal` is the second layer.
- [x] **A3 — per-request role.** The proxy injects the vouched role; in
  workspace mode `projectReadOnly()` reads it instead of the on-disk file.
  `/_config` keeps returning `{...cfg, canvasOrigin, readOnly}` — **the client
  is not touched.**
- [x] **A4 — fail closed.** Boot with no hub config ⇒ every mutating route 403s.
  A test asserts exactly that.
- [x] **A5 — delete `studio-page.mjs`** in the same PR that lands the proxy. The
  reimplementation must not survive as a fallback.

### Track A′ — the conflict this phase must resolve first

**`pruneForWorkspace()` currently forbids the very routes the cloud studio
needs.** `FORBIDDEN_ROUTE_PREFIXES` blocks `/_canvas-shell` ("the surface that
mounts and executes a canvas module") and `/_canvas-runtime` ("serving the
canvas runtime only makes sense if something here renders a canvas") — written
under DDR-193 §2 when a cell was a sync relay that must never render.

**Phase 25 A0 amended that invariant**: the cell BUILDS, the viewer's browser
EVALUATES, in a segregated origin. The prune list has not caught up. Boot the
real studio in workspace mode today and it refuses exactly the routes the
browser door is made of.

- [x] **A′1 — reconcile the prune list with A0.** Either the studio serves the
  canvas surfaces in workspace mode (and the boot-assert's reasoning is updated
  to A0's build-vs-evaluate line), or it does not and the hub keeps serving
  them. **Decide once, in writing, before any code.** The one outcome that is
  not allowed is loosening the guard to make a build green — `assert-containment.sh`
  says it best about itself: "a guard you had to loosen to keep your build green
  is a guard that will be loosened again."
- [x] **A′2 — resolve who serves a canvas.** The debate split here and the plan
  must not: SHIPPER would delete `apps/hub/src/canvas/{build,build-worker}` as
  redundant once the studio builds its own; BUILDER would keep the hub's canvas
  origin (`shell`, `build`, `render-token`) untouched and merely point
  `ctx.canvasOrigin` at it. **Two canvas builders in one container is the same
  class of duplication this phase exists to delete.** Pick one; whichever loses,
  its modules are deleted in the same PR, not left dormant.
- [x] **A′3 — the hub's now-redundant canvas modules.** `comments.mjs` writes
  the SAME `<designRoot>/_comments/<slug>.json` the studio does (Phase 25 B5's
  "one store, both surfaces"), so there is no data migration — but the module
  becomes a second implementation of a read/write path the studio already owns,
  and goes. Same question for `project.mjs`, `edits.mjs`, `shell.mjs`.

### Track B — the design is made of its assets

The grey boxes have a precise cause: canvases reference flat `/assets/<sha8>`
and DS CSS `url()` resolves relative to the stylesheet, but the hub's canvas
origin offers only `/_canvas/asset?path=…` and pins `img-src 'self'`. **Every
photo and every `@font-face` 404s with no fallback.** 266 MB, 793 files, tracked
in git.

- [x] **B1 — serve them the way localhost does**, off the `/repo` working tree,
  through the real server's existing routes. No new asset server.
- [x] **B2 — widen `img-src`/`font-src` to the canvas origin**, and replace
  `cache-control: no-store` with immutable content-addressed caching so a
  teammate is not refetching photographs on every pan.
- [ ] **B3 — cold start materializes assets from R2** via the existing
  rehydrate/asset lane; `/_api/asset` writes land in the S3 lane.

### Track C — what the browser may and may not differ in

Legitimately absent (physically impossible in a tab): the agent chat, OS menu
bar and native shortcuts, local-filesystem project switching, auto-update.
**Everything the design is MADE of must be identical** for owner, member and
viewer: images, fonts, Files, Layers, Inspector, search, branch/LIVE status,
comments, export, history.

- [x] **C1 — role shapes what is OFFERED, never what is VISIBLE.** Remove
  `inspector` and `layers` from `viewerHiddenPanels`. Read-only means cannot
  change, not cannot see — a reviewer needs structure and measured values.
- [x] **C2 — the agent's absence is stated where the agent would be**, with a
  link to the desktop app. Never a hidden item, never a dead button, never
  silence.
- [ ] **C3 — first open lands on a rendered canvas**, not a chooser, with one
  dismissible line naming what this role can do.
- [x] **C4 — the way back out.** A cloud instance carries a "Back to dashboard"
  affordance in the chrome (and the project's name), because a browser tab has
  no window title and no app switcher to tell a teammate where they are or how
  to leave. This is a cloud-only ADDITION to the shared client, expressed
  through the same cloud flag as C2's agent notice — never a fork of the
  component.

### Track D — safety of exposing a locally-designed server

- [ ] **D1 — a `MAUDE_CLOUD` build ELIMINATES rather than un-routes** the
  subprocess and secret surfaces: `acp/*`, the `bash -c` native installer, the
  `$SHELL -ilc` probes, the exporter subprocess, BYOK generation, system-git,
  and `/_api/{cloud,github,hub,claude,acp,debug-bundle,design}`. **DDR-123's
  "claude never on our infra" only holds if the code is not in the image.**
  CI greps the built bundle for their absence.
- [ ] **D2 — one writer on `/repo`.** Today `workspace-agent`, `design-sync`,
  `repo-checkpoint` and `backup` write the tree and run git while the studio
  writes TSX, `_history/` and `.design/_*.json`, with **no lock on either
  side**. Route hub git through the studio's own `sync/autocommit.ts`; if that
  is too large for one phase, one advisory lock both honour plus a quiesce RPC,
  and a concurrency test that runs an autocommit against a live canvas write.
- [ ] **D3 — per-session runtime state.** `_active.json` (selection, open tabs)
  and `_canvas-state/<slug>.view.json` (camera) are per-machine singletons by
  design (DDR-115). Two members in one cell clobber each other's selection and
  pan/zoom, silently, reading as flakiness. The session dimension lands **with**
  the proxy, not after it.
- [x] **D4 — public identity behind the proxy.** The studio generates absolute
  URLs (`_server.json`, redirects, the canvas origin). Behind the tunnel the
  `Host` header is an internal name, and Phase 25 shipped exactly that bug into
  production twice — a member signing in was sent to an address that was not
  their project. The studio must take its public identity from configuration
  (`HUB_PUBLIC_URL`), never from the request, and a test must assert it with a
  foreign `Host` header set.
- [ ] **D5 — deep, content-addressed health.** Child alive, its `/_health`
  reports the expected project, the served bundle's sha256 equals the sha
  recorded at image build, no stale `index.lock`. **A tag is not an identity; a
  hash is** — the last outage featured a monitor that checked only that
  something answered 200 and a rollback to a tag whose contents CI had
  overwritten.

### Track E — the drift cannot recur

Enforced structurally, never by discipline. Divergence must be a gate someone
deliberately deletes, not a decision someone quietly makes under deadline.

- [x] **E1 — byte-identity gate.** The cell may serve only the
  `client.bundle.js` + `styles.css` copied from `apps/studio` at image build,
  and it **refuses to boot** when the running bundle's sha256 does not match the
  sha recorded in the image.
- [x] **E2 — `scripts/check-no-studio-reimpl.sh`** beside `check-containment.sh`:
  fails CI on any studio HTML shell or studio route re-declared under
  `apps/hub/src/`.
- [x] **E3 — route-manifest test.** Every route surviving `pruneForWorkspace()`
  must map to a capability in `role-matrix.mjs`. A new studio route is red until
  classified — which doubles as the proxy's security guard.
- [ ] **E4 — cloud/desktop parity in E2E.** The `apps/desktop/e2e` specs run a
  second target against the cloud URL from the SAME spec file on the same
  `data-testid`s. "Files panel missing in cloud" becomes a red build, not a
  customer email.

## Cost gate (not an assumption)

The image was slimmed 679 → 157 MB after the platform could not cold-start the
large one, and that RCA leaves size as an unresolved **suspect**. The net add
here is `dist/client.bundle.js` (1.9 MB) + `styles.css` (272 KB) + `client/`;
`media` and `stickers` (17.6 MB) move to R2 behind an `assetBase`.

- [x] **Measured, and the fallback was taken deliberately.** The cell ships the
  pre-compiled `maude-server` for its own arch (`TARGETARCH` → `bun-linux-x64` /
  `bun-linux-arm64`) rather than running from source — running from source would
  mean the studio's whole production closure (remotion, pixi, onnxruntime,
  react-dom) in the image. Measured with `docker image inspect` on amd64, the
  arch the platform runs:

  | | pre-phase | phase 27 | Δ |
  |---|---|---|---|
  | hub | 157 MB | 165 MB | +8 MB (+5.1%) |
  | cell | 195 MB | 204 MB | +9 MB (+4.6%) |

  An entire second server for +9 MB, because the compiled binary REPLACED the
  standalone Bun the image already carried for the build sandbox — `BUN_BE_BUN=1`
  makes one artifact do both jobs (DDR-177). Cold start to a *healthy* cell
  (which now waits for the studio to answer, not just the hub): **0.69 s vs
  0.71 s** baseline, native arm64; 2.77 s under amd64 emulation. Ceiling asserted
  by `scripts/check-image-size.sh`.

## Acceptance

- [ ] A teammate opens the project link, signs in with their Maude account, and
  sees **the same application the owner sees on his desktop** — Files, Layers,
  Inspector, search, toolbar, branch/LIVE status.
- [ ] **Photographs are photographs and the webfont is the webfont**, verified
  against a real customer project, not a synthetic fixture.
- [ ] A viewer can read, comment, download **and inspect**; every write is
  refused at the proxy, and the UI does not offer what the role cannot do.
- [ ] Booting a cell with no role configuration refuses every mutating route.
- [ ] The cell refuses to boot when its bundle's hash does not match the image's.
- [ ] CI fails on a studio reimplementation, on an unclassified studio route,
  and on a cloud/desktop testid divergence.
- [ ] **A teammate can find their way back** to the dashboard, and knows which
  project they are in, without a window title.
- [ ] **The desktop still honours the role too**: connecting Maude Desktop to a
  cloud project as a viewer yields a read-only studio. This already works
  (`isHubReadOnly()` per hub URL) and must not regress — the per-session change
  is the CELL's, not the desktop's.
- [ ] **No route is served by two implementations.** A canvas is built by one
  builder, a comment is written by one writer, and the loser's modules are gone
  from the tree — not dormant behind a flag.

## Preserved dissent

BREAKER alone at confidence 7, and its reservation is the one to keep visible:
**two writers on one worktree in one container.** "The 3 a.m. event is not a
500 — it is a tenant's canvas lost to a half-staged commit or a checkout under a
live writer, in a cell whose /health still says 200 because the hub process is
fine." D2 exists because of it. If D2 cannot be made single-writer within this
phase, the honest move is the advisory lock plus the concurrency test, and to
say so rather than to hope.

USER-ADVOCATE's reservation is different and equally worth keeping: **assets get
deferred behind the auth work and the hand-written page survives "just for this
release"** — so the first thing every invited teammate sees is still grey boxes.
Track B is therefore not a follow-up; it ships with Track A or the phase has not
landed.

---

## Status — 2026-08-03

**Landed:** Track A′ in full, Track A in full, B1/B2, C1/C2/C4, D4, D5 (child
liveness + content-addressed client identity), E1/E2/E3, the cost gate, and the
cell image that makes all of it real. Decision: **[DDR-209](../archive/decisions/DDR-209-one-studio-three-shells-the-cell-serves-the-studio.md)**.

Verified in a RUNNING cell on both arches — the real 1.98 MB `client.bundle.js`
over the proxy, a canvas built by the in-cell sandbox, flat `/assets/<sha8>`
served immutable, all seven D1 surfaces 404, a viewer refused every write and
allowed to comment, header forgery refused, `/health` 503 with the killing
signal while the child is down, and E1 refusing to boot on a substituted bundle.

**Running it found four bugs no test had:** every admin's session was read-only
(pre-existing, shipped in Phase 25 — an account role reaching a project-role
matrix); a read-only bypass over WebSocket (`comments-patch`/`comments-delete`
ungated, while every HTTP equivalent was refused); a viewer could not comment
(the second gate stricter than the authority); and the canvas lane 404'd on a
per-tenant origin (the prefix derived from the tenant id, which exists in both
deployment shapes) — which was the grey boxes, again.

### Deployed — 2026-08-03

`alligators.cloud.maude.sh` is running it. Cell image `maude-cell:v19`, built
from `ghcr.io/1agh/maude-hub:latest`, rolled through `cells-deploy`.

```
ok      : true
studio  : { ok: true, state: "ready", port: 4399, restarts: 0, lastExit: null }
client  : { ok: true, dist/client.bundle.js: 0c807a5c7939, dist/styles.css: 6f42c9fca879 }
canvases: 65
```

That client hash is **the same one the local build produced** — E1's seal
verifying, in production, that the bytes a member downloads are the bytes the
image was built from.

Verified live and unauthenticated: `/` now sends a member to the real sign-in
instead of the hand-rolled `/studio`; every studio route 401s without a session
(the session gate runs BEFORE the manifest, so an unauthenticated caller cannot
map the route table); all nine D1 surfaces refuse; and the segregated canvas
origin answers on its own hostname, 401 without a capability, for this tenant
and for a foreign one alike.

**It shipped blank first.** `Uncaught ReferenceError: cfg is not defined` — the
C1/C2/C4 edits referenced `cfg` inside `Menubar`, which never receives it, so
React mounted nothing in EVERY shell. And the client's `/_config` handler is an
explicit projection rather than a spread (deliberately — it races
`/_index-data`), so the two fields the phase added arrived nowhere: `cloud` (no
chrome) and `canvasToken` (every canvas iframe would have hit the cookieless
origin with no capability — that one had not been found at all).

One cause: **the client was changed and never rendered.** Every check was HTTP,
and a route table says nothing about whether React mounts.
`test/config-projection.test.ts` now reads both sides out of source and demands
they agree; removing `cloud` reds two of its four tests.

Fixed, rolled to v21, and verified by booting the PUBLISHED image
(`ghcr.io/1agh/maude-hub:latest`, bundle `0cf90c6202c5`) signed in, in a real
browser: Files, Layers, search, the full menubar, IDLE/ARTBOARDS/LIVE status,
and "← Dashboard  Alligators" in the chrome.

**Still owner-gated:** opening the real domain with a Maude account, and looking
at whether the alligators project's photographs and webfont render.

Two wiring bugs the data plane surfaced before the roll, both of which would
have 404'd every canvas: the cell was never told its public canvas origin, and
the proxy would have stripped a tenant segment `worker.mjs` had already
removed.

### Not landed — none of it blocks the testing environment, all of it blocks a customer

- [ ] **D2 — one writer on `/repo`.** UNTOUCHED, and it is this phase's preserved
  dissent. Deployed anyway on 2026-08-03 because the platform currently carries
  no customer data — a deliberate, recorded choice, not an oversight, and one
  that stops being available the moment somebody real signs up. `workspace-agent`, `design-sync`, `repo-checkpoint` and `backup` write
  the tree and run git while the studio writes TSX, `_history/` and
  `.design/_*.json`, with no lock on either side. BREAKER's words still apply:
  "the 3 a.m. event is not a 500 — it is a tenant's canvas lost to a half-staged
  commit or a checkout under a live writer, in a cell whose /health still says
  200 because the hub process is fine." Shipping this to a live customer cell is
  taking that bet on their data.
- [ ] **Acceptance's "verified against a real customer project" is half-done.**
  The cell now serves the real 65-canvas alligators checkout and reports it
  healthy, but nobody has SIGNED IN and looked. The photographs and the webfont
  are the specific thing to look at.
- [ ] **D1 — elimination, not un-routing.** The seven secret-bearing surfaces are
  pruned at boot, refused by the manifest, and 404 in a running cell. The code is
  still inside the compiled binary. DDR-123's "claude never on our infra" holds
  operationally; it does not yet hold structurally.
- [ ] **D3 — per-session runtime state, studio half.** The proxy issues a stable
  `x-maude-session` per member (tested); the studio does not partition
  `_active.json` / `_canvas-state/<slug>.view.json` by it, so two members in one
  cell still clobber each other's selection and camera.
- [ ] **D5 — remaining half.** The expected-project assertion and the stale
  `index.lock` check.
- [ ] **B3 — the sweep that lands a browser-uploaded asset in the S3 lane without
  waiting for the next boot.** (Git-tracked assets already return with the
  rehydrated checkout, which is what fixed the grey boxes.)
- [ ] **C3 — first open lands on a rendered canvas.**
- [ ] **E4 — cloud/desktop parity in E2E.**
