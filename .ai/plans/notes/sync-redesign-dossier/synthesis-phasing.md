# Phasing — strangler increments from v0.60.7 (sync never stops working)

Ground rules: hub+cell ship together (one image tag); the only skew axis is desktop↔hub, governed by the compat matrix (§10). Delete only one release after the replacement soaks. Acceptance bar throughout = file-for-file parity on a REAL tree (alligators + mirror), verified against the built artifacts (trap #10).

## Increment 0 — groundwork, zero wire change (S)
**Ships:** delete desktop `autocommit.ts` + editorOf/writer-wrap/stop-flush wiring (~450, verified dead); extract `cold-start-apply.ts` — one application body for the DDR-102/223 tables, exhaustive switch with compile-time `never` default, fixing the LIVE migrate-seed `recover-seed-dup` fallthrough; both-callers-import-one-module tripwire test; F6 aggregate byte budget on existing pulls.
**Replaces:** the twin cold-start application bodies (drift class #2 dies here, not in the epilogue).
**Verify:** existing cold-start test suite green through the new module; fallthrough regression test; real-tree link smoke.
**Rollback:** git revert — no wire/schema change.

## Increment 1 — hub journal + tail durability, dark (M)
**Ships:** `file_journal` + epoch + persisted sha_cache in hub.db; arg-carrying `recordWrite` at all existing door hook sites; `POST /api/journal/report` (loopback nudge, hub re-hashes disk); **R2 journal-tail write-behind per append + replay-before-epoch-decision in rehydrate + SIGTERM tail flush**; permanent walk-import reconciler (post-bind, boot + periodic); `GET /api/journal` + peer_cursors; `/health` advertises `ledger`; CI grep rename→append tripwire. Nothing consumes it yet.
**Replaces:** nothing (additive).
**Verify:** restore drill extended — backup → wipe → rehydrate → tail replay → head monotonic, epoch preserved; kill-mid-append test; walk-import catches a hand-planted checkout mutation. Run against the real container image (DDR-198).
**Rollback:** routes dark, table inert; zero clients depend on it.

## Increment 2 — the poke; the live bug dies fleet-wide (M)
**Ships:** reserved dotted control doc `maude.files` (branch-independent, scope-mapped); hub `broadcastStateless` coalesced 250 ms; **cell studio child attaches a ctl-only loopback provider OUTSIDE the CELL_LIVE_PAIRING gate** → poke → synthetic `fs:any` → existing `asset`/`css` HMR heal; desktop attaches (capability-gated) → poke triggers existing `pullAssetsOnce`/`pullFilesOnce`; poll STAYS 20 s + poke-miss honesty counter.
**Replaces:** the watcher-gap class (hub-door writes invisible to the child) — ground truth §3 prime suspect.
**Verify:** live: hub-door asset PUT on an UNPAIRED fleet cell heals an open cloud tab without reload (CF containers dataset); poke-loss test (kill WS mid-poke ⇒ poll catches); old-desktop-vs-new-hub shows no phantom doc (dotted-name regression test).
**Rollback:** `linkedHub.fileEvents:false` (config key, not env) on either end ⇒ today's poll cadence exactly.

## Increment 3 — ledger + three-way engine, behind the existing flag (L)
**Ships:** desktop file-ledger (ancestor store, stat cache) + total `decideFile` (full property matrix incl. deletion + epoch-degraded rows, deletion EMISSION still off) + single apply site absorbing `file-pull.ts`'s fetch/verify/quarantine loop; journal-cursor pulls with reanchor; push half: `fs:any` → classifier → hash → ledger → PUT with `ifHead` CAS; size-classed outbox + park-and-skip; mass-drain child above threshold (DDR-222); `.maude-conflict-` naming + foreign-sync-conflict refusal; crossing-write self-detection; referenced-asset prioritization; reanchor cooldown; doručenka per-file rows (refusal outranks cursor, token-bound labels, referenced-but-unoffered state) in `_sync.json` + panel. `linkedHub.syncFiles:true` now selects this engine (opt-in this release). Old lanes untouched and still running.
**Replaces (when flag on):** file-pull LWW-by-wire-mtime (F4 dies), asset-pull reference-scan, probe-guard.
**Verify:** kill-between-writes ordering test; full decideFile property matrix; real-tree 216/216 byte parity (Plane-B acceptance repeat); mixed-era test: v1 push acks feed ancestor adoption so the inc-3 hybrid is defined, not accidental.
**Rollback:** flag off ⇒ v0.60.7 paths (untouched); ledger file is runtime state — deleting it forces a safe re-anchor.

## Increment 4 — F1–F6 hard gate, flag default ON (M)
**Ships:** `/flow:validate-security` as HARD gate: F1 = untrusted-DATA delimiting for all file-lane pulls into `system/**` (scheduled agent-side work, not a citation); F2/F3 = empty-tree css default + config-seed-before-first-pull pinned; F4 structural (inc 3); F5 regression-tested; F6 + accumulation quota; hub-door owner-role gate on code-module (NEW). Single door `PUT /api/file/<rel>` (old doors become thin shims). First-anchor conflict-storm breaker. Flag default flips ON only after gate passes + one soak release.
**Replaces:** dual write doors (as user-facing surface; shims remain).
**Verify:** recorded gate verdict; flip-day dogfood on the project whose hub system/** is stale (the breaker's named triggering shape) — breaker must fire, not mass-revert.
**Rollback:** flag default back off per project (config, no terminal); shims keep every old client alive.

## Increment 5 — burn-down (M)
**Ships (deletes, one release after inc-4 soak):** `asset-pull.ts`, `asset-sweep.ts` + `asset-push-worker.ts` as transfer engine, ~450 of `asset-push.ts` (transport core survives in the door client), fast-push wiring + `requestFastPull` + `REFERENCE_FILE_RE`, `announceWrite` inference bridge, probe route (checkout-only compat shim retained for the legacy window), hub `asset-lane.mjs` sweeper → ~150-line journal-driven write-behind covering ALL classes, `assets.mjs` PUT branches → delegates. Poll 20 s → 60 s ONLY if the miss counter proved ~0. Legacy pull/push client retained ≥2 releases for journal-less self-hosted hubs (compat matrix §10).
**Verify:** `check-bundle-completeness --smoke` (no sweep child left in the .app); new-desktop-vs-old-hub e2e still pushes/pulls via legacy client; store-drift alert (post-boot bucket fallback serving = alarm).
**Rollback:** deletions are clean revert commits; `MAUDE_LEGACY_SWEEP` equivalent kept one release cell-side via workflow_dispatch runbook.

## Increment 6 — deletion propagation (M)
**Ships:** tombstone emission + the local-absent decision rows; `DELETE /api/file` with prevHash; edit-beats-delete revive; `_trash/` quarantine both directions + trash-prefixed R2 mirroring before hub-side overwrite/tombstone; outbound mass-delete AND inbound tombstone-storm breakers (pause + panel prompt); `linkedHub.propagateDeletes` (default per open question #1).
**Replaces:** Plane-B v1's "deletion never propagates" scope cut — the last gap in the iCloud mental model.
**Verify:** branch-switch mass-delete fires the breaker; offline-delete propagates on reconnect; resurrection test (tombstone in lost tail + tail replay ⇒ no resurrect); R2 trash key exists before any cell-side loser is overwritten.
**Rollback:** flag off ⇒ absence propagates nothing (today's posture); tombstone rows inert to old clients.

## Increment 7 — shared-doc epilogue, flag flip only (M)
**Ships:** desktop `MAUDE_SHARED_DOC` default ON (DDR-064 cutover; DDR-213 closed the checklist on cells — re-verify desktop-specific items). NO deletion this release.
**Rollback:** config flip back; both paths coexist.

## Increment 8 — epilogue deletion (S)
**Ships (one release after inc 7 soaks):** delete `agent.ts` + two-doc relay observers + agent-origin queuedOps wiring (~800). Cold-start callers: 1. (Fixes Ledger's M6 flag-into-deleted-code contradiction by construction.)
**Verify:** real-tree link + cold-start matrix on the single applier; perf smoke.
**Rollback:** revert the deletion commit (flag path still exists in the previous release).