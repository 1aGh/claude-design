# DDR-213: A cell syncs to itself, or to nothing

**Date:** 2026-08-06
**Status:** accepted
**Tags:** cloud/cell/collab/crdt/yjs/shared-doc/autocommit/extends-ddr-064/extends-ddr-209
**Supersedes:** —
**Extends:** [DDR-064](DDR-064-single-shared-collab-doc.md), [DDR-209](DDR-209-one-studio-three-shells-the-cell-serves-the-studio.md)
**Plan:** [`feature-desktop-cloud-live-pairing.md`](../../plans/feature-desktop-cloud-live-pairing.md)

## Context

Cloud Phase 27 put the real studio inside the cell, and a member opening
`<project>.cloud.maude.sh` now loads the byte-identical client the desktop
loads. What they do not get is the other person.

A cell holds **two disjoint `Y.Doc` worlds**:

| | who connects | where it lives |
| --- | --- | --- |
| the hub's Hocuspocus documents | the **desktop** (`linkedHub` → the cell) | hub process, SQLite-backed, durable |
| the studio child's collab rooms | **browsers** (`/_ws/collab/<slug>`, proxied) | studio process, in memory |

The only link between them is one-way and not live: the hub's
`afterStoreDocument` writes to disk and commits. Presence is ephemeral room
state and cannot cross a filesystem at all, and a browser edit reaches the
studio room and the disk but never the hub's document — so a desktop peer
subscribed to that document sees nothing. Two people on one project, one in the
app and one in a tab, never meet. That is the headline of the cloud product,
and it did not exist.

This is not an oversight. The hub was the sync brain first (Phase 9), the
browser-in-the-cloud surface reused the dev-server's own rooms (Phase 27), and
**DDR-209 / Phase 27 D2 deliberately forbids the studio child from syncing
out** — honouring the tenant's `linkedHub` inside a cell would dial OUT to a
third-party hub carrying their canvases, and start a SECOND autocommit over the
working tree the hub is already committing. The islands were left as islands on
purpose.

So the question this decides is not "should they be joined" but **"can they be
joined without reversing DDR-209"**.

## Decision

**Unify at the hub, by letting the cell pair with ITSELF.** The studio child
runs a `HocuspocusProvider` to its own cell hub over **loopback**, with
`MAUDE_SHARED_DOC` on, so the browser room's `Y.Doc` **is** the document that
syncs to the hub — the single-shared-doc model of DDR-064, which was fully
built and shipped OFF behind a flag out of caution, not because of a known bug.
The browser and the desktop then converge on one document by CRDT merge, and
presence crosses for free because the awareness bridged into the room is the
provider's.

DDR-209's two fears are preserved **literally**, as conditions rather than as
argument:

1. **No dial-out** — the hub URL must resolve to a loopback host
   (127.0.0.1 / localhost / ::1). Anything else is refused. A cell talking to
   127.0.0.1 is a process talking to itself; nothing leaves the container.
2. **No second committer** — autocommit must be explicitly disabled
   (`MAUDE_SYNC_NO_AUTOCOMMIT=1`), and under pairing the autocommit object is
   never *constructed*, so there is no later branch that could reach a commit.
   The hub's `afterStoreDocument` remains the only committer.

A third condition is ours and narrows further: **shared-doc must be on**.
Without it the loopback provider would open a second `Y.Doc` per canvas beside
the room's — the two-doc world this exists to collapse — and its agent would
become a second doc→file writer for no benefit at all.

The tenant's `.design/config.json` supplies **exactly one** field: `workspaceId`.
Not the URL — that would be the dial-out. But the workspace id decides the wire
document name (DDR-192 §5), and the desktop resolves it from that same field; a
cell that derived a different one would put the browser and the desktop on two
differently-named documents and this whole feature would silently keep doing
what it did before.

### Why the credential is a minted store token and not `HUB_SECRET`

The studio child's environment is deliberately minimal so that a process
handling tenant-shaped requests does not hold the hub's admin bearer. Passing
`HUB_SECRET` to buy a Yjs connection would trade away the reason that minimal
environment exists. The hub mints a scope-`*` token into its own store at boot
(`INSERT OR REPLACE` by label, so the previous value dies rather than
accumulates) and the raw value exists only long enough to reach the child it is
about to spawn. It unlocks documents; it does not unlock `/internal/*` or the
admin API.

Scope `*` rather than a narrower binding because **a cell hub holds exactly one
tenant** — the container boundary already is the scope. Narrowing further would
mean guessing the wire namespace (which depends on the tenant's config and their
current branch) and silently failing to sync whenever the guess was wrong, which
is the failure being fixed.

### Rollout

`CELL_LIVE_PAIRING` is a **per-tenant allowlist**, default off, `*` spelled out
for the fleet. This changes the CRDT layer, so it rolls to one pilot project
(`alligators`), is watched, and only then widens. A fleet-wide boolean would
make the pilot step impossible to express. Env applies at container start, so
changing it needs a real stop → wake, not a config re-push.

## What this cost elsewhere

Four things surfaced while threading the needle, and each is part of the
decision rather than incidental:

- **`.claudeignore` is not written in a cell.** The untrusted-canvas markers
  exist for Claude Code reading the checkout, and nothing runs Claude against a
  cell's tree. `.claudeignore` lives at the repo root, so writing it would put a
  machine-authored file into the tenant's repository, which the hub would then
  commit and mirror to their GitHub. The canvases are no less untrusted; the
  audience for the marker is absent.
- **A projection write announces itself.** In a container the recursive
  `fs.watch` misses our atomic tmp+rename writes, so a peer's edit reached the
  doc and the disk and then stopped: no `fs:any`, no `canvas-hmr`, and the other
  person's canvas iframe stayed on the old render until they reloaded by hand.
  `createContainerWriteBridge` closes that for API writes and cannot close it
  here (it triggers off `activity:suppress`, which the projector never arms), so
  the projector emits the event itself — delayed by the bridge's own margin, so
  a watcher that *does* fire wins and the HMR broadcaster's per-file coalescing
  collapses the pair into one reload. **Keyed by path** (a `Map`, not a flat
  timer bag): three independent `/simplify` review passes (efficiency, reuse,
  altitude) converged on the same gap in the first version of this — two
  writes to the same file inside the 250ms delay window scheduled two
  independent timers and emitted `fs:any` twice, which is two reloads for one
  edit, exactly the failure this mechanism exists to prevent. The three passes
  also proposed routing through `createContainerWriteBridge` itself (arm
  `activity:suppress` from the projector) instead of a parallel mechanism —
  sound in principle, not taken: that bridge is instantiated in `ws.ts` at
  server boot, and coupling the sync runtime to it would make the runtime
  untestable standalone, which every test in
  `test/shared-doc-cell-pairing.test.ts` currently relies on. Duplicating the
  small delay-then-emit shape, with the same per-path coalescing, keeps both
  properties.
- **A projection write that changes nothing now costs nothing.** The `last*`
  guards compare against what the projector wrote, which is null on the first
  pass, so the cold-start `reconcile()` re-wrote every canvas with content
  identical to what was already there. Harmless while nobody was listening; the
  moment the write announced itself it became a spurious reload of every open
  canvas at boot.
- **`sync/limits.ts` exists**, and grew a second job. The byte ceilings lived
  in `sync/codec.ts`, which imports `Y_TYPES` from `collab/persistence.ts`. The
  moment persistence needed a ceiling of its own that became an import cycle
  whose only symptom would have been a `const` read in its temporal dead zone —
  a crash whose stack points at neither file. Numbers depend on nothing, so
  they now live where nothing has to depend back. The doc→disk cap-and-warn
  CHECK itself (not just the numbers) was independently re-typed in both
  `sync/projection.ts` and `collab/persistence.ts` in this same diff before a
  `/simplify` reuse pass caught it; both now call one `withinByteCap` in
  `limits.ts`, parameterized by a log-line label so each subsystem's warning
  stays identifiable as to which one refused.
- **`sync/loopback.ts` exists**, for the same reason a third time. The
  loopback-host predicate was independently re-typed in THREE places inside
  `apps/studio/sync/` — `checkUrlScheme`, `isLoopbackHubUrl`, and
  `cell-pairing.ts`'s own copy, whose comment said out loud "three places
  asking is this loopback and disagreeing is how a guard becomes decorative"
  without fixing it. Now one function, imported by the two files that need it.
  `apps/hub/src/log-safety.mjs` is the hub-side equivalent, for the SAME-app
  duplication between `server.mjs` and `studio-child.mjs` (`isLoopbackSyncUrl`
  and `sanitizeForLog` were byte-for-byte copies with no cycle risk once
  extracted). The CROSS-app duplication between `cell-pairing.ts` and
  `studio-child.mjs` stays two independent checks, deliberately — see Task 1's
  own reasoning above; a `/simplify` reuse pass agreed and did not flag it.

## The DDR-064 pre-cutover checklist, closed

Shared-doc shipped OFF behind an unfinished checklist. Turning it on for cells
means closing it, so:

| Item | Verdict |
| --- | --- |
| **A1** — gate `.html` bodies like `.tsx` | **Moot, recorded.** Since Phase 3.6 `.tsx` is the only canvas format; discovery admits `.html` for legacy compatibility and no real project has one. Left as a known residual rather than pretended away. |
| **A4** — detect slug collisions | **Closed.** `slugFor` flattens `/` to `-`, so `ui/a/b.tsx` and `ui/a-b.tsx` produce one slug. Two files on one document is not degradation, it is each writing the other's body over itself forever. **Both** are excluded, not one picked: refusing to sync two canvases is recoverable by renaming; overwriting one with the other is not. |
| **A6** — cap pinned rooms | **Closed.** A shared-doc canvas is a pinned room, deliberately immune to the last-browser-leaves drop — which is exactly why nothing else will ever reclaim it. Ceiling 500 (`MAUDE_MAX_PINNED_ROOMS`), far above the largest in-house project at 83, so it is a runaway guard rather than a product limit. |
| **A7** — one-time consent notice | **Closed.** A one-time warn whenever shared-doc engages against a hub. A cell is exempt **and that is the decision**: the operator turned pairing on per project, the hub is the cell's own loopback, nothing leaves the container — consent was given by configuration, and repeating it per canvas boot trains an operator to skip the line that matters. |
| **comments hub→disk lane** | **Closed.** The codec capped file→doc; this is the other direction, and until shared-doc it barely mattered because the room's doc was populated only by browsers on this machine. Now it is populated by the hub. Same ceilings, so a value that could never be imported can never be written either. The write is refused, not the sync — the doc keeps converging. |
| **`@hocuspocus/provider` advisories** | **Closed.** 4.3.0, current major; `bun audit` reports nothing against `@hocuspocus/*` or `yjs`. (Nine unrelated transitive findings exist in the ACP SDK and `dom-to-svg` chains — pre-existing, off the sync path.) |

## Alternatives rejected

- **C1 — re-home the browser's collab onto the hub's Hocuspocus directly** (the
  proxy stops forwarding `/_ws/collab`; the hub serves it). Cleaner: one doc, no
  bridge, no second process in the loop. Rejected **for now, not on the merits**
  — it requires re-homing the room's other lanes (comments, annotations,
  activity) onto the hub doc, which is a large structural change to make on the
  strength of a model that has never run in production. C2 is the reversible
  pilot that earns the right to do C1; the follow-up is noted, not abandoned.
- **B — the studio child dials its own external hub / the tenant's
  `linkedHub`.** This is the thing DDR-209 forbids, wearing a feature's clothes:
  dial-out plus a second autocommit. Off the table.
- **Let the hub remain the only doc→file writer and have the studio skip its
  projection.** Tempting, since the hub already writes on `afterStoreDocument`
  through a twin of the same merge (`meta-merge.mjs`, held byte-identical by
  test). Rejected because the ordering then stops being ours: the studio would
  have to announce a reload for a file another process had not necessarily
  written yet. Both writers producing identical bytes is redundant and cheap;
  the echo guard drops the second event and the HMR debounce collapses the pair.

## Consequences

- **Attribution changes for browser-originated edits.** They now reach the hub
  over the loopback connection, so `afterStoreDocument` attributes the commit to
  the pairing token rather than to the member. The token is minted with **no
  owner** deliberately — signing a tenant's git history with a machine identity
  dressed up as a person is worse than an honest "unknown". Carrying the real
  editor across the loopback lane is follow-up work, and it is the first thing
  C1 would fix for free.
- Beyond the cell, nothing moves: `MAUDE_SHARED_DOC` stays off by default for
  desktop and self-hosted hubs, and the guard is inert outside workspace mode.
- The live cross-surface run (two surfaces, cursors both ways, reload loses
  nothing, exactly one committer in `git log`) is the gate this decision is
  conditional on. Passing tests are the floor, not the proof.

## Security review (2026-08-06, `/flow:validate`)

Defender + adversarial passes ran against this diff
(`.ai/logs/security-reviews/main-20260806-0554-defender.md` — 0 blockers, 4
warnings; `main-20260806-0600-attacker.md` — the chain below). Both
independently re-derived every claim in this DDR from the code rather than
taking it on faith, and both are worth reading in full; this section records
what changed as a result and, honestly, what did not.

**Fixed on the spot:** four log lines (`cell-pairing.ts` ×2,
`sync/index.ts`, `studio-child.mjs`) interpolated `MAUDE_LOOPBACK_SYNC_URL`
without stripping control characters, unlike the codebase's own
`sanitizeForLog` precedent (`apps/hub/src/server.mjs`). Exploitability was
already near-zero — that env var is hub-set only, never tenant-reachable —
but a feature whose entire argument is "the URL is provably loopback" should
not be the one place still trusting the string past its hostname. All four
now scrub before logging (mirrored, not shared, per the same
deliberate-duplication reasoning as the loopback checks themselves —
`cell-pairing.ts` and `studio-child.mjs` cannot import from each other
without a cycle or an app boundary crossing).

**Named, not fixed — a wildcard, non-expiring pairing token.**
`mintLoopbackSyncToken` mints `scope: '*'`, no `owner`, no `expiresAt`. The
attacker's chain (Chain 1, promoted to High, impact-conditional — no leak
demonstrated in this diff) composes that with the defender's own finding that
the scope is confined to one tenant *only* by the "one hub process ⇒ one
tenant" architectural invariant, never by the token itself: if the raw value
ever left the studio child's process environment by any channel, it would be
a full-project bearer credential, usable against the tenant's own public hub
endpoint, valid until the next hub restart re-mints it by label.

Verified before deciding, not assumed: `HUB_SECRET` — the hub's existing
admin escape-hatch, already in production — has the **identical** shape
(`server.mjs`: `scope: '*'`, no `expiresAt`, no network-origin binding in
`onAuthenticate`), and is *more* privileged than this token (it also reaches
`/internal/*` and the admin API; the pairing token reaches documents only).
This diff does not introduce a new class of risk — it adds one narrower
instance of a bearer-credential shape this exact server already accepts for
its most powerful credential. That is why this is recorded as a residual
rather than treated as a blocker.

**Why the two stronger mitigations the attacker recommended are follow-up
work, not today's fix:**
- *Bind `onAuthenticate` to the token's `remoteAddress` for this one label.*
  Sound in principle, symmetric with the two existing egress checks. Not
  implemented because whether a raw `request.socket.remoteAddress` check
  actually distinguishes "the studio child's genuine loopback connection"
  from "external traffic that arrived via the cell's own Cloudflare tunnel"
  depends on cloudflared's ingress configuration (server-side, not visible in
  this repo) — if the tunnel proxies to `127.0.0.1:<port>` (a common
  configuration), *every* external request would also present as loopback at
  this exact check, making it a false safety net rather than a real one. A
  control that creates false confidence is worse than no control; this needs
  the actual ingress topology confirmed before it is written, not guessed.
- *Give the token a short `expiresAt` and re-mint on a timer.* The mint
  happens once, at hub boot; the token then rides into an already-spawned
  child's environment, which cannot be updated without either restarting the
  child or adding a live-refresh side-channel — neither of which exists
  today. Adding an expiry without a refresh path would not reduce the leak
  window; it would silently break live pairing on every cell that outlives
  the TTL without a restart, trading a theoretical, undemonstrated risk for a
  guaranteed operational regression on the pilot project. This needs a real
  refresh mechanism designed alongside it, not a bolted-on deadline.
- *Scope the token to `ws/<workspaceId>/<branch>/` instead of `*`.* The
  prefix is only computable from the tenant's own `.design/config.json`,
  which the studio reads and the hub deliberately does not (the hub minting a
  token would need to either read the tenant's file itself — a new coupling —
  or accept the prefix from the studio child post-boot — a new handshake).
  Smaller than the other two, still a real design change, not a review-pass
  patch.

Tracked as explicit follow-up, alongside C1 (which would remove this
credential class entirely by re-homing browser collab directly onto the hub
— no loopback hop, no minted token, nothing to leak).
