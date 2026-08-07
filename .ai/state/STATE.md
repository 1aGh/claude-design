# Workflow State

> **kgai-active repo** — working state and history live in the knowledge graph, not this file.
> The `flow:workflow-state` skill reads/writes it via `flow:kgai-backend`.

**Status:** done — "a release reaches the fleet" closed 2026-08-07 (only a release tag rolls the cloud, and it proves which one)
**Active plan:** —
**Active task:** —

_2026-08-07:_ **"A release reaches the fleet, and says which one it is" CLOSED + archived — tagging
now deploys the cloud and proves it did.** v0.57.0 put a cell image tagged `v0.57.0` into production
whose hub layer was built from v0.56.0, with every workflow green: `hub-image.yml` runs on tags
only, so `maude-hub:latest` is rebuilt only at release time, and `cells-deploy` derived from it on
any non-tag ref — so a branch push rebuilt the CELL from a hub that could not contain the change.
The existence-based wait could not catch it (`:latest` always exists). **Only a release tag now
builds or pushes a cell image**; a branch push runs the data-plane tests and `wrangler deploy` and
nothing else — which removes the race, the stale derivation, and the same-tag-different-bytes
generator at once. **And green now means a live cell answered on the released version**: the
workflow polls a real tenant until `/health` reports the released version AND the client hash this
run sealed into the image it pushed. The two are complementary, not redundant — the hash catches
"same tag, different bytes", and only the version catches "the layer underneath is a release
behind", because the stale image was internally self-consistent (DDR in the graph,
`d_2152229760ff703da58e2d03`). The version is now readable in the Studio status bar, the hub admin
header, `/health` and `/_config`; `apps/studio` + `apps/hub` join the release line (14 manifests),
which is why `/health` had been reporting `0.0.0`. Two things the plan did not predict: a
pre-existing gate (`config-projection.test.ts`) caught that `/_config` is an explicit client-side
projection, so the version chip would have shipped permanently unrendered; and the tag run's hub
wait was 10 min against a hub build measured at ~16 min, so it would have kept failing after the
`:latest` fix — now 30 min, with the measurement in the comment. **The real proof is the next
release**: if `cells-deploy` goes green while production is stale, the gate is wrong.

_2026-08-07:_ **ACP turn notifications CLOSED + archived — the native shell now tells you when a
chat finishes or needs input, even in a project you're not looking at.** The webview's own
Notification path only ever knew about the project on screen and couldn't see a detached chat at
all; the notify decision moved into the Tauri native shell instead (new `notify.rs` + a background
poller over the sidecar pool + `tauri-plugin-notification`), fed by a new read-only per-chat
activity endpoint (`/_api/acp/activity`, kept off both canvas-origin allowlists). No in-app
settings toggle — macOS's own per-app Notification Center control covers it, deliberately, so
there's no in-app switch a user could flip that also silently loses the awaiting-input signal.
**Two rounds of security fan-out, and the second one mattered as much as the first**: the original
pass found the poller re-trusts an untrusted `_server.json` with no spawn-time authentication and
could otherwise fabricate an unbounded notification flood — mitigated with a per-project cap. The
`/flow:done` closing re-review then found the MITIGATION itself had two real gaps (the cap could be
reset via a normal, attacker-steerable pool-eviction cycle; the command surface had no cap at all)
— both fixed this session, not just noted. The deeper fix (spawn-time authentication instead of
re-trusting the file, which also affects a pre-existing pattern in `sidecar.rs`) is a named
follow-up, not done here. Also incidentally fixed: a real `ReferenceError` bug in
`/_api/acp/running` (a route handler referencing an undeclared `req`), caught by `cargo
check`/`bun run typecheck`, not by inspection. Task 1's WKWebView measurement was never actually
performed — no GUI in the execution environment — and is recorded as an honest open item rather
than assumed away.

_2026-08-06:_ **The deferred live cross-surface run finally happened — and it was not a formality.**
The last unchecked acceptance criterion on desktop ↔ cloud live pairing needed
"a real cell + a desktop app + a browser", so a local stand-in was built with
the fleet's actual topology: split shell/canvas origins through
`apps/cells/dev-edge.mjs`, real capability cookies, two accounts, a linked
desktop peer. The feature was code-complete and test-green, and **wrong in
production in two ways**, both living in the seam between the cell's two
processes where no unit test could see them. (1) Paired edits were never
committed: the hub staged only files it had written itself, and under pairing
the studio's projector always wins the race — so "exactly one committer" was
passing *vacuously*, with zero. (2) The annotations sidecar was written as a
canvas sibling while everything that reads it looks under the flat slug, so the
hub committed a junk file — the one that would reach the tenant's GitHub mirror
— and left the real one untracked. Both fixed, both with regression tests
verified to fail without the fix. A third, smaller finding: the cloud browser's
Changes panel offered Save/Publish and an "unsaved" count for work already
committed, and told a browser user to save from their terminal; it now withdraws
to History wherever the server owns history (desktop untouched — a hub-linked
peer does NOT self-commit, so hiding it there would remove the only local way to
save; verified rather than assumed). **The lesson worth keeping:** a manual
acceptance criterion parked because it "needs real infrastructure" is the only
test that runs the real topology — standing up the faithful stand-in cost one
session and converted three production bugs into three commits.

_2026-08-06:_ **Desktop ↔ cloud live pairing (C2) CLOSED + archived — a cell pairs with itself.**
The studio child now opens a loopback, commit-disabled, shared-doc provider to
its own cell hub (DDR-213, extends DDR-064 + DDR-209), so a browser tab and the
desktop app editing the same cloud project converge on one Y.Doc — presence and
edits cross both ways, the hub stays the sole committer. All six tasks landed:
the workspace-mode guard's one narrow exception, the loopback token minted
per-boot into the child's env, the sole-committer assertion (tested against a
real git repo), the DDR-064 pre-cutover checklist closed (slug collisions,
pinned-room ceiling, consent notice, comments doc→disk cap), the cold-start
seed verified for the cell topology, and — the one real bug the work turned
up — a doc-originated edit produced no `fs:any` inside a container at all
(not a double-fire, the opposite), fixed by having the projector announce its
own writes. Security-reviewed (defender + attacker): a wildcard, non-expiring
pairing token was flagged as a chain-promotable-to-High finding, evaluated
against the already-accepted `HUB_SECRET` precedent in this exact hub and
recorded as a residual with two explicit, reasoned-out follow-ups rather than
patched under review pressure. **Gated**: `CELL_LIVE_PAIRING` is a per-tenant
allowlist, `alligators` only — the live cross-surface run (real cell, real
desktop, real browser, one committer in `git log`) is the one acceptance
criterion left unchecked, and nothing widens past the pilot until it's green.

_2026-08-04:_ **Cloud Phase 26 CLOSED — the operator view, and figures instead of an estimate.**
`/operator` is live behind an allowlist that is empty by default; it is mostly a
route over `fleetBoard`/`costAlarms`, which had been tested and callerless since
Phase 9. Product analytics go to Analytics Engine and never to D1, on a CLOSED
vocabulary — every property an enum, an account id shape-validated — so the
privacy revision that shipped in the same change is a property of the code
rather than a promise. Each project now counts its own designs and build
sandbox, so the €3/cell model finally has real numbers. **The review earned its
keep**: four of the seven stated security invariants turned out weaker than
their comments (none was a broken control), and the counts had been put on the
hub's UNAUTHENTICATED `/health` — a correct disclosure argument about the
studio's endpoint, carried onto one with a different audience. All fixed and now
tested. Customers get one thing directly: the activity page says *why* we
looked, including the platform-wide reads that were previously the only ones
they could not see.

_2026-08-04:_ **Cloud Phase 27 CLOSED + archived — one studio, three shells.**
Every track landed. Today closed the shell-origin `/_ws` CSWSH gate, D5's second
half (a `/_health` `rootId` the supervisor compares — a child serving another
tree is killed rather than served), **D2, the preserved dissent** (the two
processes were not racing on a lock, they were running different git engines —
DDR-211), then D1 (a `--cloud` build that ELIMINATES the agent, the shell probes
and the BYOK keys from the binary), D3, B3, C3 and E4 (DDR-212). Two acceptance
lines deliberately NOT ticked and named where they are: desktop E2E has no CI
job at all, and a desktop attached to a real cloud project as a viewer is
owner-gated. **Three bugs, three different instruments** — a browser found a
banner that never rendered, the linter found a cross-scope assignment that would
have crashed every cell boot with storage configured, and writing the parity
spec found C1 was never actually landed (a viewer could not open the Inspector,
so an acceptance line had been false in production).

_2026-08-01:_ **Cloud Phase 24 CLOSED — tracks A + B, plus D2/D5 and D4's code half.**
The funnel now states the bill of materials (a computer, the free app, **your own
Claude subscription**) before the card; the legal pack exists and is linked; per-tenant
config left the Worker globals (customer #2's first boot could have cloned the pilot's
repo); the reconciler's actions became real effects with export-before-teardown; delete
purges the bytes. **C1 walked a real second tenant through the paid wizard** — two cells
concurrent, the new one seeded from nothing, then deleted through the product. **D3 drove
the dunning ladder through a real Stripe test clock.**

Eight defects found by using it rather than testing it: every outbound email had been
403-ing for two days · the deploy workflow had been red since 07-30, hiding a real failure
· an `exported` flap made the promised deletion unreachable · the deletion warning would
have sent ~48× · an empty project could never be deleted · the funnel quoted €19 and
charged €22.99 · `CF_PROVISION_TOKEN` could not attach a domain, so self-service was dead
· a CLI relink erased the role the studio had just written.

Left, all owner gates: **C3/C4** (a real non-technical human with a stopwatch), the Windows
certificate, counsel review, the accountant on *identifikovaná osoba*, and **D1/D3-live**.
Phase 25 C1 (read-only enforcement at the cell) also landed; its client half is open.

_2026-07-30 (side branch):_ **`feature-enhanced-video-editing` closed + PR'd** — TSX-first
manual timeline editor (split/trim/speed/crop/grade/audio/transitions as clip verbs over
`/_api/clip-edit`; three-band iMovie layout + stacked pure-JSX projection; movable layers;
AI placeholder clips; frame-anchored comment tool). 4 dogfood rounds; security review
resolved 3 blockers. Phase 6 deferred. Plan archived; kgai holds the close.

_2026-07-29 (later):_ **Phases 12 + 13 DONE + deployed live.** Signup/login/session
+ Google (unconfigured → honest 503) + project-grant mint at
`https://maude-cloud.maude1agh.workers.dev`, 126 cloud tests. Two live-only
bugs found by deploying: Workers refuse PBKDF2 >100k iterations (fixed by
chaining 6×100k — same work, no weakening), and the v2 migration never ran
against live D1 (fixed: cron applies migrations before sweeping).

_Earlier:_ **Phase 12 deployed live** — `maude-cloud` Worker at
`https://maude-cloud.maude1agh.workers.dev` (/health ok, d1 ok, cron hourly);
Workers/cron/D1 turned out Free-tier-capable, only Containers/Queues/R2 wait
for Phase 11. Deploy path: bun bundle + Cloudflare API multipart PUT.

_2026-07-29:_ four-seat debate (`debate-cloud-selfservice-gap-arc`) resolved the
self-service gaps: **DDR-197** narrows DDR-192 §4 (read-only browser share view
permitted; containment DDR-193 §2 reaffirmed verbatim; browser EDITING deferred
behind the Phase-21 gated spike with both dissents preserved). New plans:
phases 11 (owner vendor unblock) → 12 worker → 13 one-account identity →
14 provision-first checkout → 15 cell+alligators → 16 server-owned checkout →
17 desktop attach → 18 share view → 19 mirror effects → 20 self-admin →
21 editing spike (gated).

_Last closed:_ `cloud-phase-10-ga-launch-github-mirror` (2026-07-29, partial). All ten
phases are archived: 1-4 complete, 5-10 CORE COMPLETE / PARTIAL — the buildable half is
done and tested, deployment is blocked. **DDR-196** records why, and the pattern (split
every vendor-facing component into a pure decision layer and a thin effects layer).

_Earlier:_ `cloud-phase-4-selfhost-skill` (2026-07-28, core complete).
Phases 1, 2 and 3 closed the same day. Decisions: DDR-192, DDR-193 (arc
umbrellas), DDR-194 (phase-2), DDR-195 (phase-3); DDR-148 corrected in place.

### Phases 5-10 — what is built vs what is blocked

Everything below is written and tested; what is blocked is DEPLOYING it.

| Phase | Built (tested) | Blocked on |
| --- | --- | --- |
| **5** cell | `infra/cell/` image + entrypoint (containment assert, tenant-id guard, refuse-empty-rehydrate), `cli/lib/cell-plan.mjs` (naming, R2-prefix isolation, teardown order, lifecycle machine), containment CI gate extended to the image | persistence spike, `maude cell up` API layer, alligators pilot — need Workers Paid + R2 |
| **6** invites | `apps/hub/src/invites.mjs` + `/join` mint/peek/redeem/revoke, admin surface, 23 tests incl. 8 end-to-end | `maude://` deep link + desktop UI; the timed cold-start gate needs a real human |
| **7** control plane | `apps/cloud/reconcile.mjs` — the derive-don't-react reconciler, 19 tests incl. 20 chaos cycles | the Worker itself (D1/Queues/dashboard) — D1 is reachable, Queues needs Workers Paid |
| **8** billing | `apps/cloud/pricing.{json,mjs}` + real Stripe sandbox catalog, 11 tests | live-mode prices, Checkout + portal + test clocks against a control plane |
| **9-10** | — | need live cells |

**Phase 8 groundwork landed early** because Stripe is the one vendor that IS
usable: the `maude.sh sandbox` account is authenticated and test mode needs no
paid plan. The Phase-0 §3 catalog exists as real sandbox objects and
`apps/cloud/pricing.{json,mjs}` resolves them (live ids deliberately null — live
mode throws rather than falling back). Numbers are a proposal pending sign-off.

Carried into Phase 5 (all need a live host or a paid account):
- 60 MB asset through R2 specifically (phase 3)
- `desktop-e2e workspace-sign-in` — needs the Tauri UI (phase 3)
- `workspace-up`'s remaining verification steps — need a Docker host (phase 4)

**Phases 5-10 are BLOCKED on vendor prerequisites an agent cannot satisfy** —
re-probed live 2026-07-28: Cloudflare account is Free (0 subscriptions),
Containers refuses ("requires the Workers Paid plan"), R2 refuses ("enable R2
through the Dashboard"), 0 zones on the account. Needs a paid plan, R2
enablement, and `cloud.maude.sh` on Cloudflare DNS. See
`.ai/plans/cloud-phase-0b-manual-prep.md`. Phase 4 is local and executable.

Carried forward into later phases:
- Hub doc namespacing is **opt-in** until Phase 3 makes it default-on in workspace mode.
- The collab origin gate refuses-and-resyncs a violating canvas peer rather than
  disconnecting it; revisit before hardening if a false positive is ever observed.

_Older:_ `feature-kgai-ecosystem-integration` (2026-07-28). Two follow-ups need the owner:
`maude kg query "MATCH (f:Element {kind:'follow-up'}) RETURN f.name, f.props"`.

## Where it went

| Want | Ask the graph |
| --- | --- |
| history / "what happened with X" | `maude kg search "<feature>"` · milestone nodes are linked `PROGRESS_ON` → `plan:` |
| a decision's reasoning | `maude kg context --about "<element>"` (full body is stored) |
| my recent movements | `maude kg query "MATCH (d:Decision) WHERE d.author='$(git config user.name)' RETURN d.title, d.recorded_at ORDER BY d.recorded_at DESC LIMIT 10"` |
| where a paused session left off | `/flow:resume` — reconstructs from the last `session:` paused event |
| conflicts | `maude kg conflicts` |

The pre-migration file (930 KB, 88 progress blocks + 127 history rows) is preserved verbatim at
`.ai/archive/state/STATE-pre-kgai-2026-07-28.md`; all of it is in the graph as dated `milestone:` nodes.
