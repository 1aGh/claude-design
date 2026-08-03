# Cloud Phase 26 — One studio, three shells

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

- [ ] **A1 — spawn the real server as a supervised child.**
  `bun apps/studio/server.ts --root /repo` with `MAUDE_WORKSPACE_MODE=1`, bound
  to 127.0.0.1, own uid, empty env, restart-with-backoff. A dead child makes the
  CELL unhealthy — two processes under tini with no supervisor is how you get a
  container that answers 200 while half-dead.
- [ ] **A2 — the hub becomes a default-deny proxy.** Session termination,
  role → capability from `role-matrix.mjs`, a checked-in DENY-by-default
  `(method, path) × role` manifest covering reads too, and WebSocket upgrade
  proxying. The studio's `readOnlyRefusal` is the second layer.
- [ ] **A3 — per-request role.** The proxy injects the vouched role; in
  workspace mode `projectReadOnly()` reads it instead of the on-disk file.
  `/_config` keeps returning `{...cfg, canvasOrigin, readOnly}` — **the client
  is not touched.**
- [ ] **A4 — fail closed.** Boot with no hub config ⇒ every mutating route 403s.
  A test asserts exactly that.
- [ ] **A5 — delete `studio-page.mjs`** in the same PR that lands the proxy. The
  reimplementation must not survive as a fallback.

### Track B — the design is made of its assets

The grey boxes have a precise cause: canvases reference flat `/assets/<sha8>`
and DS CSS `url()` resolves relative to the stylesheet, but the hub's canvas
origin offers only `/_canvas/asset?path=…` and pins `img-src 'self'`. **Every
photo and every `@font-face` 404s with no fallback.** 266 MB, 793 files, tracked
in git.

- [ ] **B1 — serve them the way localhost does**, off the `/repo` working tree,
  through the real server's existing routes. No new asset server.
- [ ] **B2 — widen `img-src`/`font-src` to the canvas origin**, and replace
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

- [ ] **C1 — role shapes what is OFFERED, never what is VISIBLE.** Remove
  `inspector` and `layers` from `viewerHiddenPanels`. Read-only means cannot
  change, not cannot see — a reviewer needs structure and measured values.
- [ ] **C2 — the agent's absence is stated where the agent would be**, with a
  link to the desktop app. Never a hidden item, never a dead button, never
  silence.
- [ ] **C3 — first open lands on a rendered canvas**, not a chooser, with one
  dismissible line naming what this role can do.

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
- [ ] **D4 — deep, content-addressed health.** Child alive, its `/_health`
  reports the expected project, the served bundle's sha256 equals the sha
  recorded at image build, no stale `index.lock`. **A tag is not an identity; a
  hash is** — the last outage featured a monitor that checked only that
  something answered 200 and a rollback to a tag whose contents CI had
  overwritten.

### Track E — the drift cannot recur

Enforced structurally, never by discipline. Divergence must be a gate someone
deliberately deletes, not a decision someone quietly makes under deadline.

- [ ] **E1 — byte-identity gate.** The cell may serve only the
  `client.bundle.js` + `styles.css` copied from `apps/studio` at image build,
  and it **refuses to boot** when the running bundle's sha256 does not match the
  sha recorded in the image.
- [ ] **E2 — `scripts/check-no-studio-reimpl.sh`** beside `check-containment.sh`:
  fails CI on any studio HTML shell or studio route re-declared under
  `apps/hub/src/`.
- [ ] **E3 — route-manifest test.** Every route surviving `pruneForWorkspace()`
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

- [ ] **Measure cold start against the 2.4 s baseline before and after**, and
  assert an image-size ceiling in CI. If it regresses, ship the pre-compiled
  `maude-server` binary for the cell's arch instead of running from source.

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
