# Workflow State

> **kgai-active repo** — working state and history live in the knowledge graph, not this file.
> The `flow:workflow-state` skill reads/writes it via `flow:kgai-backend`.

**Status:** done — Cloud Phase 27 closed 2026-08-04
**Active plan:** —
**Active task:** —

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
